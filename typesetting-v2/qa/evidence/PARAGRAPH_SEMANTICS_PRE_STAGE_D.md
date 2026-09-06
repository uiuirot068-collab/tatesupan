# Paragraph Semantics Pre-Stage-D

- Status: **PASS.** Human Product Decisions A (一字下げ auto-indent) and B (bare-newline paragraph break) implemented as minimal, Contract-consistent Core additions. Root Cause B (Stage C) fully resolved. Root Cause A resolved everywhere the architecture allows; two narrow, disclosed residual gaps remain (RUBY/SEMANTIC_RUN paragraph-starts, and one not-fully-diagnosed long-prose case) — neither is silently hidden.
- Preflight: branch `design/tatespun-typesetting-v2`, HEAD `dbf468084b3d8e32a2625c16f22d60d7e4ee5439` (matches expected checkpoint — the Stage C gap review), worktree clean before start.
- Descriptive task label: **PARAGRAPH-SEMANTICS-PRE-STAGE-D** (not a frozen numeric P3-L identifier, per this Loop's own instruction).

---

## 1. Human Decisions

Recorded and approved before this Loop began (recap, not re-litigated here):

- **Decision A:** TateSpun v2 preserves Japanese automatic paragraph-first-line one-character indentation (一字下げ). Normalizer identifies paragraph boundaries/starts; Core owns the logical indentation decision and extent; Renderer only paints the already-decided position. No manuscript-source mutation, no literal full-width-space insertion, source mapping stays intact.
- **Decision B:** A manuscript bare newline is an explicit paragraph break. It must end the current logical line and must not be discarded or treated as ordinary whitespace. Represented explicitly in the logical model (no reuse of `ManualBreakUnit`, which is a distinct, page-closing concept).
- **Root Cause C (legacy's manual-page-break phantom empty line): explicitly NOT adopted.** v2's `ManualBreakUnit` continues to produce no phantom line; this Loop added a regression test guarding against ever accidentally reintroducing one.

---

## 2. Recovered Legacy Behavior (TSP-LOOP-029, direct-read of `src/lib/tategaki.ts`)

Read directly, not inferred, from `paginateTokensByLines`/`computePageSourceRanges` and their shared helpers:

- **First paragraph:** `pendingParagraphStart` starts `true` at document start — the very first paragraph is indented too (not skipped), same as every other paragraph.
- **After a bare `\n`:** the "\n" branch (`if (value[i] === "\n") { ...; breakLine(); pendingParagraphStart = true; continue; }`) always sets `pendingParagraphStart = true` for whatever comes next — including a second consecutive `\n`, since that branch never calls `openLineBudget` itself.
- **Explicit leading whitespace:** `paragraphNeedsAutoIndent(firstChar)` returns `false` when `firstChar === AUTO_INDENT_CHAR` (U+3000 full-width space) — a manuscript that already typed a leading full-width space is not double-indented. No other whitespace character is special-cased.
- **Blank line (`\n\n`):** the second `\n` is processed as its own zero-content line (never reaches `openLineBudget`, since that branch short-circuits before any content check) — legacy renders a genuine empty line, not a collapsed/removed one.
- **Manual page break interaction:** the `pageBreak` branch never touches `pendingParagraphStart` — content immediately after a 【改ページ】 marker is indented only if `pendingParagraphStart` happened to already be `true` from an unconsumed preceding `\n`, never as a rule tied to the page break itself.
- **Exempt openers:** `AUTO_INDENT_EXEMPT_OPENERS = "「『（〈《【〔［｛"conversation openers plus "“‘"` — ported verbatim into `compose/line.ts`'s `AUTO_INDENT_EXEMPT_OPENERS`.
- **Ruby/TCY/image interaction:** `firstVisibleTokenChar` special-cases only `ruby` (→ `token.base.charAt(0)`) and `tcy`/`text` (→ their own stored value); everything else (image, pageBreak) returns `""`, and `paragraphNeedsAutoIndent("")` is `false` — a paragraph starting with an image never gets auto-indented in legacy either.
- **Headings/markup:** out of scope for `tategaki.ts`'s tokenizer/paginator (handled by a separate module, `tocGenerator.ts`) — no interaction to model here.

---

## 3. Logical Model

**New LogicalUnit kind:** `ParagraphBreakUnit { kind: "PARAGRAPH_BREAK"; span: SourceSpan }` (`core/units/paragraphBreakUnit.ts`). `span` covers the actual line-ending source characters (1 code point for `\n`, 2 for `\r\n`) — a real, non-zero-width span, not a zero-width marker, so the newline's own source range is never silently discarded (mirrors production's own 【改ページ】 marker having real source width despite zero pagination cost).

**Ownership**, per the approved split:
- Normalizer (still not built in this repo — P3-O14 already names it as not-yet-designed) would own recognizing raw `\n`/`\r\n` in manuscript text and emitting `PARAGRAPH_BREAK` units with correct spans. This Loop does **not** build that recognizer (would be "a complete Normalizer project," explicitly out of scope) — fixtures continue to hand-author `LogicalUnit[]` directly, now including `PARAGRAPH_BREAK` where appropriate (see `typesetting-v2/tools/compare/fixtureBuilder.ts`'s new `PARAGRAPH_BREAK` piece).
- Core owns everything downstream of an already-recognized `PARAGRAPH_BREAK` unit: forced line termination, first-line indent decision/extent, and next-line paragraph-start tracking across column/page transitions.

**New break-opportunity reason:** `PARAGRAPH_FORCED` (`core/breaks/opportunity.ts`) — positioned at the unit's own **end** (not start, unlike `MANUAL_FORCED`), so its own zero-cost atom belongs to the line it terminates, exactly mirroring legacy's "\n" token being the last thing placed on the line it ends.

**New boundary-legality split** (`core/compose/line.ts`): `BoundaryLegality` is now `"LEGAL" | "ILLEGAL" | "FORCED_LINE" | "FORCED_PAGE"` — `MANUAL_FORCED` maps to `FORCED_PAGE` (unchanged behavior: closes column+page), `PARAGRAPH_FORCED` maps to `FORCED_LINE` (ends only the current line; `forcedBreak` stays `false`). A new `LineCompositionResult.endedAtParagraphBreak` field carries the "next line is a paragraph start" signal, threaded through `ColumnCompositionResult.nextLineIsParagraphStart` and `PageCompositionResult.nextLineIsParagraphStart` so it survives column and page transitions exactly like legacy's single global `pendingParagraphStart` does — never reset by a page boundary, only by an actual `PARAGRAPH_FORCED` cut.

**Indent representation:** `CanonicalLine.indentTick?: GeometryTick` (`core/layout/schema.ts`) — present only when auto-indent was applied to that line, carrying the reserved logical extent for a future Renderer to paint as leading blank space. Absent (not zero) when no indent applies.

---

## 4. Bare-Newline Semantics

Implemented exactly as Decision B specifies: `advanceTickFor`'s `PARAGRAPH_BREAK` case returns `0` (zero line-extent cost, matching legacy's implicit zero `tokenLength`); the `PARAGRAPH_FORCED` opportunity unconditionally ends the line at that position regardless of remaining capacity (verified by `paragraphSemantics.test.ts`'s "forces the current line to end... even under capacity" test). Consecutive `PARAGRAPH_BREAK` units (a manuscript blank line) are never collapsed — each gets its own atom and its own forced cut, producing a genuine empty `CanonicalLine` entry, verified by a dedicated test. CRLF is supported by giving the `ParagraphBreakUnit`'s span 2 code points instead of 1 — verified end to end (span preserved, no truncation, `consumedThroughOffset` accounts for both code points).

---

## 5. First-Line Indent Semantics

Implemented in `compose/line.ts`: `needsAutoIndent(firstVisibleCharFor(units[0]))`, gated by the caller-supplied `isParagraphStart` flag. `firstVisibleCharFor` is determinable for `TEXT` (`unit.text`) and `TCY` (`unit.displayText`) — both store their own content directly — but **not** for `RUBY` (`RubyUnit` stores only `baseSpan`, never the base text) or `SEMANTIC_RUN` (stores only `length`, never its literal characters).

**Disclosed architecture limitation, not fixed this Loop:** a paragraph starting with a RUBY or SEMANTIC_RUN unit will not receive auto-indent in v2, unlike legacy (whose own tokens store this content directly and can check it). Fixing this would require a Core schema change (storing text on `RubyUnit`/`SemanticRunUnit`, or giving `compose/line.ts` access to the original source text) — out of this narrowly-scoped Loop's boundary. Confirmed by direct Stage C testing: `atomic-ruby` and `ellipsis-run` fixtures (both start with the affected unit kind) show a residual, pre-declared `EXPECTED_INDENT_UNDETERMINABLE_FOR_RUBY_FIRST_UNIT` difference; every other fixture starting with ordinary TEXT resolved cleanly.

---

## 6. Source Mapping

Verified by direct test (`paragraphSemantics.test.ts`): a `PARAGRAPH_BREAK`'s own placed span always equals its full declared source range (1 or 2 code points), never truncated or fabricated; the indent itself contributes no `PlacedUnit` and no `SourceSpan` of its own (it is purely a budget/geometry adjustment surfaced via `CanonicalLine.indentTick`, not a phantom source character). `consumedThroughOffset` after a paragraph-break cut always equals the break's own span end — no gap, no double-count.

---

## 7. Manual Page Break Interaction

Confirmed distinct and non-interfering: `MANUAL_FORCED` (page-closing) and `PARAGRAPH_FORCED` (line-only) are different `BreakOpportunityReason` values, mapped to different `BoundaryLegality` outcomes, with only `MANUAL_FORCED` setting `forcedBreak`/closing the column+page. A dedicated regression test (`compare.test.ts`'s "manual-page-break: NEWLY DISCOVERED...") continues to assert the phantom-line finding is legacy-only and confirms v2's `ManualBreakUnit` still produces no such artifact after this Loop's changes — Root Cause C is unaffected by this Loop, exactly as intended (Human decision: not adopted, not ported).

---

## 8. Stage C Root Cause A Result

**RESOLVED** for every fixture whose paragraph starts with an ordinary `TEXT` unit: `baseline-ascii-kana`, `two-column-flow`, `dash-run`, `explicit-tcy`, `hanging-punctuation-f06` (already clean before), `jukugo-ruby-declared-segments` (already clean before) all now show **0 unexpected differences** attributable to indent (confirmed by re-running the full Stage C suite after implementation — see `compare.test.ts`'s updated `two-column-flow` test, now asserting `MATCH`).

**One narrow, pre-existing, UNRELATED structural artifact surfaced** by `two-column-flow` once content divides exactly evenly: legacy's `page.columns = [topTokens, bottomTokens]` is a fixed 2-element array (`tategaki.ts`), always populated even when the second column ends up empty; v2's `composePage` only creates as many `CanonicalColumn` entries as actually needed. Zero content difference (every populated line matches exactly) — reclassified as `EXPECTED_LEGACY_FIXED_COLUMN_ARRAY_ARTIFACT`, LOW severity, in `fixtures.ts`.

**Two residual gaps remain, both disclosed (§5, §9)** — not silently hidden as resolved.

---

## 9. Stage C Root Cause B Result

**FULLY RESOLVED.** `paragraph-break-gap` (the fixture Root Cause B is named after) now shows a clean `MATCH` on line count (2 = 2) and zero unexpected differences, after being re-authored to use the new `PARAGRAPH_BREAK` unit (a literal `\n` inside a `TextUnit.text` string remains inert — Decision B is a distinct unit kind, not embeddable). `long-non-repeating-prose` (which has two real `\n\n` paragraph boundaries at realistic prose scale) was similarly re-authored and improved substantially (13 unexpected → 6), but retains a **residual, NOT FULLY DIAGNOSED discrepancy**:

**Disclosed, not resolved:** on `long-non-repeating-prose`'s second and third paragraphs (both start with ordinary, non-exempt TEXT — "窓" and "―" respectively), legacy's observed line lengths do not match this Loop's hand-derived expectation of legacy's own indent behavior (a direct re-reading of `tategaki.ts`'s `pendingParagraphStart`/`openLineBudget` code predicts legacy should reserve the same 1-cell indent v2 now does, but the empirically-observed legacy output shows full, non-reduced line lengths at this specific point — a 2-character-per-line residual gap remains, MEDIUM severity, no content lost). This was investigated via direct Stage C fixture testing (not guessed) but not fully root-caused within this Loop's timebox — the likely candidates (an uninvestigated kinsoku/nowrap interaction specific to this text, or a subtlety in how `pendingParagraphStart` interacts with a double-newline immediately followed by content, that this Loop's manual code-trace did not correctly capture) are named here for a future investigation, not silently declared "expected." Left as raw, undeclared `UNEXPECTED_DIFFERENCE` in `long-non-repeating-prose`'s Stage C result — MUST NOT be reclassified until actually understood.

---

## 10. Root Cause C Non-Adoption

Confirmed unchanged and untouched by this Loop (§7). Legacy's manual-page-break phantom empty line remains a **KNOWN LEGACY DIFFERENCE — NOT PORTED**. No Core change was made on account of it; the existing Stage C regression test guarding this continues to pass.

---

## 11. Regression Results

- `npx vitest run` (Core suite): **330/330 passing** (315 pre-existing + 15 new `paragraphSemantics.test.ts` tests). 3 pre-existing `compose/page.test.ts` tests needed their fixture text changed to start with an auto-indent-exempt opening bracket (`「`) so unrelated capacity-mechanics tests weren't perturbed by the new, correctly-implemented indent feature — not weakened, retuned to preserve original intent.
- `npx vitest run --config typesetting-v2/tools/compare/vitest.config.ts` (Stage C suite): **21/21 passing**, including 2 tests updated from "reproduces the gap" to "RESOLVED" and one new/adjusted expectation for the disclosed structural artifact (§8).
- `npx tsc --noEmit`: 0 new errors (same pre-existing `src/app/layout.tsx` baseline).
- `git status`/`git diff --stat`: confirmed `src/`, Production, `package.json`, and the lockfile are byte-for-byte unmodified throughout.

---

## 12. Stage D Readiness

The two Product-policy gaps that made Stage D's first visual gate potentially misleading (Root Causes A and B, per `STAGE_C_LOGICAL_COMPARISON.md` §16) are now resolved for the overwhelming majority of realistic manuscript content (plain-text paragraph starts). The residual RUBY/SEMANTIC_RUN-first-paragraph gap (§5) and the not-fully-diagnosed long-prose residual (§9) are both narrow, disclosed, and low-impact relative to before — a Stage D reviewer briefed on these two specific residuals (rather than on two pervasive, undiagnosed gaps affecting nearly every paragraph) can now reasonably interpret the first visual gate's "line-break correspondence" criterion.

**READY FOR STAGE D:** YES, with the two residuals above disclosed to reviewers rather than resolved. No further Human Product decision is required to proceed — the approved architecture (React DOM absolute-position adapter) and ruby-placement disposition (`PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §0 Decision 2) are unaffected by this Loop's work.
