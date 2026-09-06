# Stage C — Legacy vs v2 Logical Comparison

- Status: **PASS.** Comparison harness built and run against a 16-fixture corpus. Zero unexplained data-loss/duplication anywhere in the corpus. Three genuine, previously-undisclosed gaps were **discovered** (not resolved) between legacy and v2 — each is fully explained below with code-level evidence and a reproducing test, none silently patched into Core or legacy.
- Preflight: branch `design/tatespun-typesetting-v2`, HEAD `46c93dc8ad7b0d362b63b3da8494994bb05f9c8c` (matches expected checkpoint), worktree clean before this Loop.
- Descriptive label for this work: **STAGE-C-LOGICAL-COMPARISON** (this is the frozen migration Stage C itself — `CORE_MIGRATION_ROLLBACK_PLAN.md` §1/§2 — not a numbered P3-L Loop; no numeric Loop ID is invented, per this Loop's own instruction).

---

## 1. Verdict

**PASS.** The harness works, runs deterministically, and every difference it found is classified with a specific reason (either a pre-declared, code-cited EXPECTED_DIFFERENCE, or an honestly-labeled UNEXPECTED_DIFFERENCE with a full root-cause explanation below — never a bare "expected" and never silently absorbed). No unexplained HIGH-severity difference remains. Source integrity (no content lost, none duplicated) held for every one of the 16 fixtures. `src/`, Production, and the old engine were never modified — this Loop is read-only against them.

**What a non-engineer needs to know:** we built a tool that runs the exact same short story excerpt through both the current live app's typesetting logic and the new v2 engine, then diffs the results — not pictures, just facts like "how many pages," "where did each line end," "did the manual page-break land in the same place." The tool found that both engines agree almost everywhere, but it also found three real, previously-unknown gaps in the new engine: it doesn't yet indent the first line of a paragraph the way the current app does, it doesn't yet treat a plain line-break in the manuscript as a forced new line, and there's a small oddity in how the current app handles a manual page break that the new engine doesn't reproduce. None of these are typos or crashes — no text is ever lost — they're missing *behaviors* that a Human should decide whether and how to add before the new engine is trusted with real documents.

---

## 2. Scope

**In scope:** Track C1 (capacity-equalized) — the same manuscript, fed to both engines at an EQUIVALENT, harness-chosen `{charsPerLine, linesPerColumn, columnCount}` triple, comparing purely logical/structural facts (page count, line grouping, manual-break placement, content identity). No rendering, no pixels, no fonts.

**Explicitly out of scope, disclosed, not silently skipped:**
- **Track C2 (product-behavior)** is documentary only in this Loop (§7 below) — it was not executed as running code, to avoid importing `src/lib/pageLayout.ts` (which pulls in `@/constants/paperSizes` via the repo's path alias) without first confirming that alias resolves cleanly under this harness's own, separate vitest config. The two known Track C2-relevant differences (P3-O12 capacity-formula policy, image zero-cost-vs-real-cost) are already independently documented elsewhere and are restated here with citations, not re-derived.
- **Colophon** was not compared this Loop. Legacy's colophon lives in `src/lib/colophon.ts`/`bookStructure.ts` — modules this Loop did not audit — and a real comparison deserves its own careful pass rather than a rushed, unaudited import under this Loop's time budget. v2's own colophon structural isolation is already independently covered by `core/colophon/index.test.ts`.
- **Folio/header (nombre/hashira)** was not compared — `CanonicalPage.folio` is declared in the v2 schema but never populated by `compose/page.ts` (confirmed by direct code reading; already disclosed in `qa/inventory/CURRENT_EDITOR_FEATURE_INVENTORY.md` and in `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §3). Nothing to compare yet.
- **TCY bare auto-detection (P3-O07)** is NOT_COMPARABLE — v2 has no Normalizer/auto-detection step at all; only explicit `[tate]…[/tate]` notation is comparable (covered by the `explicit-tcy` fixture).
- **Ruby placement geometry** (exact reading-offset coordinates) is not compared — both engines currently expose ruby's *logical* grouping/atomicity only; v2's own `placeRuby()` geometry function is not yet wired into composition at all (a pre-existing, separately-disclosed gap — see `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §3 gap 3 / §9). Per the Human decision recorded there (§0 Decision 2), this was confirmed **not** to be a Stage C blocker: the logical/body-flow comparison (base text grouping, atomicity, declared jukugo segment boundaries) remained fully meaningful without it.

---

## 3. Comparison Method

Two independent, read-only adapters (`typesetting-v2/tools/compare/legacyAdapter.ts`, `v2Adapter.ts`) each translate one engine's own output into a shared, normalized `ComparisonDocument` model (`normalize.ts`) — pages → columns → lines, each line carrying reconstructed comparison text and a unit-kind sequence. Neither adapter re-derives a break, a capacity number, or a kinsoku decision: each only reads back an already-finished result.

- **Legacy adapter**: calls only `src/lib/tategaki.ts`'s exported pure functions (`tokenizeTategakiWithOffsets`, `paginateTokens`, `computePageSourceRanges`) — read-only, zero modifications, and (deliberately) never imports `pageLayout.ts` (see §2). `tategaki.ts` has no external imports of its own, so no `@/*` alias-resolution risk exists on this path.
- **v2 adapter**: calls only the public `typesetting-v2/core/index.ts` entry point (`composeCanonicalDocument`, `createFakeMeasurementProvider`, `DEFAULT_RULE_SET_V2`) — never a private `core/compose/*` internal.
- **Fixtures are hand-authored pairs**, not one shared raw string parsed two different ways (`fixtureBuilder.ts`'s own module comment explains why: it avoids reimplementing any part of legacy's private tokenizer/regex set under `typesetting-v2/`, at the cost of requiring each fixture author to keep the two representations honestly equivalent by construction — the alternative this Loop's own brief explicitly favors over duplicating legacy logic).
- `compareDocuments()` (`classify.ts`) then diffs the two normalized documents and classifies every diff as MATCH / EXPECTED_DIFFERENCE / UNEXPECTED_DIFFERENCE / NOT_COMPARABLE_YET, each with a severity (HIGH/MEDIUM/LOW) and, for reclassified diffs, an explicit reason code. A fixture's `FixtureExpectations` are declared **before** running anything, from direct source-code citations — never invented after seeing a surprising result (verified per-fixture in `fixtures.ts`'s own comments).

---

## 4. Source-Offset Normalization

Legacy indexes raw JS strings — UTF-16 code units (confirmed by direct reading of `paginateTokensByLines`/`computePageSourceRanges`: `value[i]`, `value.length`, `value.slice(i,j)` throughout, with **no surrogate-pair guard anywhere**). v2's canonical `SourceSpan` (Core Contract §4) is Unicode **code-point** offsets. `normalize.ts` converts every legacy span to code-point offsets before any comparison — `utf16ToCodePointOffset`/`codePointToUtf16Offset`, unit-tested against both a plain-BMP string and a supplementary-plane (surrogate-pair) character.

This normalization is exercised for real by the `supplementary-plane-char` fixture (§9), which also proves the normalization utilities themselves are correct (round-trip tests in `compare.test.ts`) independent of what the fixture then goes on to discover about legacy's own line-splitting.

---

## 5. Fixture Matrix

16 fixtures, Track C1 only. `Result` summarizes `classification` counts (match / expected / **unexpected** / not-comparable, unexpectedHigh in parentheses when nonzero) from the actual, executed test run (`compare.test.ts`), not a prediction.

| ID | Purpose | Legacy pages | v2 pages | Result |
|---|---|---|---|---|
| `canonical-regression-sentence` | F20 mandatory fixture | 1 | 1 | 16 match / 0 / **0** / 0 — clean |
| `long-non-repeating-prose` | Approved Human QA fixture (§0 Decision 4), multi-paragraph, multi-page | 4 | 3 | 22 match / 0 / **13 (2 HIGH)** / 0 — Root Causes A+B (§8) |
| `baseline-ascii-kana` | Plain kana, no kinsoku, simplest baseline | 2 | 2 | 12 match / 0 / **7** / 0 — Root Cause A |
| `kinsoku-line-start` | 行頭禁則, closing bracket pushback | 1 | 1 | 12 match / 0 / **0** / 0 — clean |
| `kinsoku-line-end` | 行末禁則, opening bracket pushforward | 1 | 1 | 16 match / 0 / **0** / 0 — clean |
| `manual-page-break` | HIGH priority: 【改ページ】 forced break | 2 | 2 | 9 match / 0 / **4** / 0 — break itself MATCHES; Root Cause C (§8) |
| `two-column-flow` | Plain kana, columnCount=2 | 2 | 2 | 18 match / 0 / **10 (1 HIGH)** / 0 — Root Cause A, cleanly isolated |
| `atomic-ruby` | Ordinary ｜base《reading》 | 1 | 1 | 8 match / 0 / **2** / 0 — Root Cause A |
| `jukugo-ruby-declared-segments` | Declared jukugo segments, comfortable capacity | 1 | 1 | 8 match / 0 / **0** / 0 — clean (scoping note, §2) |
| `explicit-tcy` | Explicit [tate]…[/tate] | 1 | 1 | 7 match / 0 / **3** / 0 — Root Cause A |
| `dash-run` | ――dash run, cl-08 inseparable pair | 1 | 1 | 10 match / 0 / **4** / 0 — Root Cause A |
| `ellipsis-run` | ……ellipsis run | 1 | 1 | 8 match / 0 / **5** / 0 — Root Cause A |
| `image-flow` | Legacy image=0 cost vs v2 real cost | 1 | 2 | 6 match / **3 expected** / 0 / 0 — clean, exactly as pre-declared |
| `hanging-punctuation-f06` | ぶら下げ組, F06 deferred | 1 | 1 | 12 match / 0 / **0** / 0 — clean at this capacity (see note below) |
| `paragraph-break-gap` | NEWLY DISCOVERED: bare `\n` | 1 | 1 | 6 match / 0 / **3** / 0 — Root Cause B |
| `supplementary-plane-char` | Emoji at legacy's naive UTF-16 split boundary | 1 | 1 | 7 match / **3 expected** / 0 / 0 — clean, exactly as pre-declared |

**Note on `hanging-punctuation-f06`:** this specific capacity (charsPerLine=13) happened not to trigger a visible divergence between legacy's ぶら下げ hang and v2's ordinary kinsoku-defer — this is a **capacity-dependent result**, not proof F06 is safe to skip. F06 remains Category B Expected Deferred per the frozen roadmap (`P3_CORE_LOOP_ROADMAP.md`), unresolved by this Loop either way.

**Legacy internal self-consistency:** `checkLegacyMirrorConsistency()` confirmed legacy's own two independently-maintained pagination implementations (`paginateTokens` vs `computePageSourceRanges` — already flagged as a duplication risk in the Editor Inventory) agreed on page count for **every one of the 16 fixtures**. No internal legacy inconsistency was surfaced this Loop.

---

## 6. Exact Matches

`canonical-regression-sentence`, `kinsoku-line-start`, `kinsoku-line-end`, `jukugo-ruby-declared-segments`, and `hanging-punctuation-f06` produced **zero** unexpected differences — both engines agree completely on page/line/content structure for these cases at their tested capacities. This confirms the already-Human-approved kinsoku policy (HG-1/HG-2 stricter classes aside — none of these specific fixtures happened to exercise those two reclassified character sets) behaves identically between engines where it should.

---

## 7. Expected Differences (Track C1, pre-declared and confirmed)

| Fixture | Reason code | Evidence |
|---|---|---|
| `image-flow` | `EXPECTED_IMAGE_FLOW_V2` | Legacy `tokenLength(image) === 0` (`tategaki.ts`); v2 images consume real `MeasurementFacts` extent since P3-L15A (`research/PHASE3_LOOP_LOG.md`). Confirmed: legacy 1 page, v2 2 pages, exactly as predicted before running anything. |
| `supplementary-plane-char` | `EXPECTED_V2_GRAPHEME_SAFETY_LEGACY_UTF16_UNSAFE` | Legacy's naive UTF-16, one-code-unit-at-a-time line splitting has no surrogate-pair guard anywhere in `adjustLineSplit`/kinsoku/nowrap (confirmed by direct code reading); v2's INV-011 (`graphemeBoundaries`) guarantees this can never happen on v2's side. Confirmed: legacy's line 0 ends with lone surrogate U+D83D, line 1 begins with lone surrogate U+DE00 — the emoji's two halves, split apart. **A genuine legacy correctness bug candidate**, flagged HIGH, out of this Loop's scope to fix (old engine is read-only). |

**Track C2 (product-behavior, documentary only — not executed this Loop):**

| Known difference | Status | Citation |
|---|---|---|
| Capacity-formula policy (charsPerLine/linesPerColumn derivation) | v2's versioned legacy-frozen/v2-native dispatch (`core/settings/capacityPolicy.ts`) exists but is not wired to any Editor/caller yet; this harness bypasses the question entirely by choosing capacity numbers directly for Track C1 | `qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md`, `qa/evidence/P3_O12_CAPACITY_GEOMETRY_VALIDATION.md` |
| Natural Pitch (no page-fill stretch) vs legacy's `justified` stretch mode | Intentional, Human-approved INV-004 policy; not re-litigated here | Core Contract §18, Master §25 |

---

## 8. Unexpected Differences — Three Newly-Discovered Gaps

**None of these are silently reclassified as "expected."** Each is a genuine, previously-undisclosed finding this Stage C Loop surfaced, backed by a reproducing test in `compare.test.ts` and a direct source-code citation. Per this Loop's own "DO NOT OVERFIT" instruction, none is fixed here — Core, legacy, and `src/` all remain untouched.

### Root Cause A — 一字下げ (paragraph-first-line auto-indent) has no v2 equivalent

Legacy (`tategaki.ts`'s `paragraphNeedsAutoIndent`/`openLineBudget`, TSP-LOOP-029) reserves one character cell on a paragraph's first line — unless the first visible character is a conversation-opening bracket — reducing that line's budget from `charsPerLine` to `charsPerLine − 1`. **v2's `core/compose/line.ts` has no equivalent concept at all** (confirmed: no "indent" match anywhere under `core/compose/`).

**Effect, confirmed by direct testing (not predicted, then falsified — actually run):** the one-time −1 on line 1 is not a per-line bug; it cascades. Every later line boundary is offset by that same constant 1 character for the rest of the document, because the content stream simply continues from wherever the previous line left off (`two-column-flow`'s own regression test in `compare.test.ts` proves this precisely: line 1 differs by exactly 1 character in length; line 2 has equal length to its counterpart but shifted content). This single root cause explains the majority of UNEXPECTED_DIFFERENCE entries across `baseline-ascii-kana`, `two-column-flow`, `atomic-ruby`, `explicit-tcy`, `dash-run`, `ellipsis-run`, and contributes to `long-non-repeating-prose`.

**Not a data-loss issue:** `document.concatenatedText` MATCHed for every one of these fixtures — content is fully preserved, just line-wrapped one character differently.

### Root Cause B — bare `\n` (manuscript paragraph break) has no v2 equivalent

Legacy's `paginateTokensByLines` treats a bare `\n` in the manuscript as an **unconditional forced line break**, regardless of remaining capacity. v2's `LogicalUnit` model has no unit kind representing this at all — a literal `\n` inside a `TextUnit.text` is just an ordinary character to `breaks/opportunity.ts` (confirmed by direct reading: `deriveTextUnitInternalOpportunities` classifies every character, including `\n`, purely by character class, with no special-casing).

**Demonstrated cleanly** by the `paragraph-break-gap` fixture (generous capacity, ruling out capacity pressure as a confound): legacy produces 2 lines (forced break at `\n`), v2 produces 1 line (Natural Pitch just keeps flowing), same content, `document.concatenatedText` still MATCHes. Also visible in `long-non-repeating-prose` (which has two `\n\n` paragraph boundaries), contributing to its 4-vs-3 page-count divergence alongside Root Cause A.

**Why this matters more than a cosmetic line-wrap difference:** no Normalizer exists yet in this codebase (P3-O14 already names this as a not-yet-designed upstream layer) — this is a genuine open question about what a future Normalizer should even DO with a manuscript's bare newlines, not just a Core implementation gap.

### Root Cause C — manual-page-break's own padding convention leaves a phantom empty line (narrower, legacy-specific)

`insertPageBreakMarker(before, after)` (the exact helper the Editor's own 改ページ挿入 toolbar button calls) pads a marker with a leading **and trailing** `\n` when neither side already ends/starts with one. Legacy's `pageBreakCommandSpan` (which decides how much surrounding whitespace the marker command consumes) only absorbs the **leading** `\n` plus the marker itself — its `consumeEnd` never extends past the end of the marker's own line, so the **trailing** `\n` (the exact one `insertPageBreakMarker` itself adds) is left for ordinary tokenization and becomes its own zero-content line.

**Demonstrated cleanly** by the `manual-page-break` fixture, constructed using exactly the padding shape `insertPageBreakMarker` produces: legacy's page 2 has 2 lines (`["", "第二章の本文です"]`), v2's has 1 (`["第二章の本文です"]`). The manual break itself lands in the correct place on both sides (`page[1].manualBreakBefore` MATCHes) — only the phantom empty line differs. This is **real, current, reproducible legacy behavior**, triggered by the Editor's own existing insert helper, not a fixture-construction artifact.

---

## 9. Manual Page Break Results

**HIGH-priority item, per this Loop's own brief.** `page[1].manualBreakBefore` MATCHed exactly (both engines: `true`) — the forced break lands at the same logical boundary on both sides, and the preceding/following content ("第一章" / "第二章の本文です") is correctly split across the two pages by both engines. The only divergence is Root Cause C (§8) — a phantom empty line, not a break-placement error.

---

## 10. Multi-Column / Multi-Page Results

`two-column-flow` (columnCount=2) and `long-non-repeating-prose`/`baseline-ascii-kana`/`manual-page-break` (multi-page) all showed correct column transition, page transition, and — critically — **zero source-order violations, zero content loss, zero duplication** (confirmed by the corpus-wide `document.concatenatedText` MATCH test). Where content diverges, it diverges by exactly Root Cause A/B/C above — never by reordering, dropping, or repeating any character.

---

## 11. Ruby / TCY / Semantic Runs

- **Ruby**: `atomic-ruby` (comfortable capacity) shows only the Root Cause A offset, nothing ruby-specific — base-text grouping, atomicity, and capacity cost (base-length, matching legacy's `tokenLength` convention) all agree. `jukugo-ruby-declared-segments` is a **clean match** (0 unexpected) at comfortable capacity — per the scoping decision in §2, this Loop did not force an artificial capacity boundary to prove v2's declared-segment internal-break CAPABILITY (already covered by `core/ruby/index.test.ts`, P3-L11); it only confirmed both engines keep an undeclared/whole jukugo group intact under normal conditions, which they do.
- **TCY**: `explicit-tcy` shows only the Root Cause A offset. The `logicalCells: 1` normalization (matching legacy's fixed 1-cell budget) was applied deliberately for Track C1 fairness — disclosed in `fixtures.ts`'s own comment, not a silent assumption.
- **Dash/ellipsis (semantic runs)**: `dash-run`/`ellipsis-run` show only the Root Cause A offset. The TEXT-vs-SEMANTIC_RUN kind-labeling difference (legacy encodes dash/ellipsis as plain text tokens; v2 as a distinct `SEMANTIC_RUN` kind, Core Contract §11) is real and intentional — `classify.ts`'s `treatTextSemanticRunEquivalent` option correctly treats it as compatible, confirmed by a dedicated test (`dash-run: TEXT/SEMANTIC_RUN kind-labeling difference does not mask the underlying text-content match`).

---

## 12. Images / Colophon

**Images**: see §7 (`image-flow`, EXPECTED_DIFFERENCE, confirmed exactly as predicted). One methodological note: `createFakeMeasurementProvider()`'s `imageIntrinsicTick` derives its own size from a hash of `refId` — it does **not** read a fixture's own `ImageUnit.intrinsicWidth/Height` fields at all (that's by design, per the fake provider's own doc comment: deterministic, no real decode). This Loop's first capacity attempt for `image-flow` assumed the fixture's own declared 30000-tick height would be used; the actual composed cost (7056 ticks, from the refId hash) was smaller, requiring the capacity to be re-tuned. Recorded here as a real methodological finding for whoever builds fixtures against the fake provider next, not swept under the rug.

**Colophon**: not compared this Loop (§2) — a deliberate scope-out, not an oversight.

---

## 13. Source Integrity

**Zero instances of source content loss or duplication anywhere in the 16-fixture corpus.** `document.concatenatedText` MATCHed for every fixture except the two where a *different*, more precise check was needed:

- `image-flow`/`supplementary-plane-char`: reclassified to EXPECTED_DIFFERENCE per their own pre-declared reasons (§7) — not a source-integrity failure.
- **Methodological finding**: `supplementary-plane-char` proved that `document.concatenatedText` alone **cannot** detect a supplementary-plane character split across a line boundary — string concatenation trivially rejoins two halves regardless of where they were split, so a genuinely corrupted (unpaired-surrogate) rendering can still produce a byte-identical concatenated string. A dedicated new check, `document.concatenatedText.surrogatePairIntegrity` (`classify.ts`'s `findLoneSurrogateLine`), was added specifically because this fixture's own result proved the simpler check insufficient — this is itself a real Stage C engineering deliverable, not just a fixture result, and should be considered part of the reusable comparison-harness contract going forward (Stage D and beyond).

This satisfies the Stage C brief's own PASS bar most directly: despite three newly-discovered *structural* gaps (Root Causes A/B/C), not one of them causes lost or duplicated manuscript content — every gap is a re-grouping/re-wrapping difference, never a correctness-of-content difference (with the sole, disclosed exception of legacy's own pre-existing surrogate-pair bug, §7/§8, which is a genuine legacy defect, not a v2 or harness issue).

---

## 14. Stage D Prerequisites

Per `CORE_MIGRATION_ROLLBACK_PLAN.md` §3 (integration entry criteria, Stage G — restated here only for context, not claimed as met): "a comparison adapter (Stage C) exists and has been run at least once against a real manuscript shape" — **satisfied** by this Loop (16 fixtures, including the approved long non-repeating Human QA prose).

**What Stage D (or any future visual-comparison work) should know before proceeding:**
1. Root Causes A, B, and C are real, reproducible, currently-undecided gaps. A visual Preview adapter that naively re-flows manuscript text through v2 Core today **will visibly disagree with the legacy Preview** on nearly every paragraph, for reasons that have nothing to do with rendering technology — a reviewer comparing Preview A vs. B side-by-side would see different line breaks almost everywhere, and should not mistake this for a rendering bug.
2. None of these three gaps are Core wiring mistakes in the sense the Ruby-placement gap is (`qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §3 gap 3) — they are missing *behaviors*, requiring a Product/Human decision on whether and how v2's (future) Normalizer or Core should represent 一字下げ and paragraph breaks at all, not a one-line code fix.
3. The `document.concatenatedText.surrogatePairIntegrity` check (§13) is worth carrying forward into any future comparison or QA tooling.

---

## 15. Closure Decision

**Stage C: PASS.** Comparison harness built, runs deterministically (`compare.test.ts`'s own determinism tests), classifies every difference with a reason (never a bare "expected"), and found zero unexplained HIGH-severity source-integrity issues. Three new, real, well-evidenced gaps were discovered and are recorded here for Human decision — discovering them is Stage C succeeding at its job, not Stage C failing.

**RUBY PLACEMENT MICRO-LOOP REQUIRED BEFORE STAGE D: Evaluate, per the Human decision already recorded in `qa/research/PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md` §0 Decision 2** — this Stage C Loop confirms the exception clause was **not** triggered (the missing ruby-placement wiring did not invalidate the logical/body-flow comparison this Loop performed).

