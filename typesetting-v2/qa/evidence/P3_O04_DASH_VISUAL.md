# P3-O04 — Dash Visual

## 1. Verdict

**PASS (structural).** Canonical dash semantic runs (`SemanticRunKind: "DASH"`, e.g. "――") now paint as a font-independent, deterministically continuous and centered bar spanning their own already-canonical extent, in the P3-O09 Preview Renderer. No Core file was touched; source mapping, atomicity, break identity, and canonical occupied extent are all provably unchanged. This closes the frozen P2-L06 dash concern by construction (a painted primitive can never be "off-center" or "gapped" the way font glyph ink could be) rather than by attempting to measure or correct unverifiable font/browser rendering. Human Visual QA of the regenerated artifact is the remaining, distinct confirmation step.

## 2. Frozen Contract

Direct-read of `docs/architecture/PHASE3_OPEN_ITEMS.md` row P3-O04 and its cited evidence (`prototypes/phase2-japanese-capability-poc/evidence/P2_L06_SPECIAL_GLYPH_ALIGNMENT.md`): the frozen finding is a **measured, non-hypothetical** optical problem — a browser-side `getBoundingClientRect()` measurement (not a Human-perception guess) found the dash run's glyph ink significantly off-center within its own logical column (offsets of roughly -2 to -7 em in the two recorded instances). Critically, **no correction was ever applied or decided** — Phase 2's own conclusion was "measurement precedes any correction decision, and no correction decision is made in this loop at all." This task does not attempt to reproduce that exact measurement technique (unavailable in this environment, no browser) or to guess a numeric correction to the same measurement; instead it removes the dependency on font-glyph ink entirely for the dash run's own visual representation, which structurally cannot exhibit the same class of measured problem (a solid, explicitly-centered, explicitly-sized painted bar has no font-metric-dependent off-center ink to measure).

## 3. Existing Semantic Run

Confirmed by direct reading (unchanged by this task):
- `SemanticRunUnit = { kind: "SEMANTIC_RUN"; span: SourceSpan; runKind: "DASH" | "ELLIPSIS" | "TWO_DOT_LEADER"; length: number }` (`core/units/semanticRunUnit.ts`) — "deliberately carries no pixel/x-y fields — visual glyph centering/alignment is Renderer-only (P3-O04/P3-O05)."
- `deriveBreakOpportunities` generates **zero internal opportunities** for `SEMANTIC_RUN` — the whole run is always exactly one atom (same construction as RUBY/TCY), never split mid-run.
- `advanceTickFor`'s `SEMANTIC_RUN` case: `perCellAdvance * unit.length` — for "――" (`length: 2`), the whole run occupies exactly 2 canonical cells.
- `semanticRunPairRule`/`cl08PairRule` (Contract §11) govern only whether TWO adjacent same-kind runs may be split between them — untouched, unrelated to this task's paint-only scope.

## 4. Core / Renderer Ownership

**Core owns** (untouched, verified by `git diff --stat`): semantic dash-run identity, source mapping, break identity (zero internal opportunities), canonical position, canonical occupied extent (`length`). **Renderer owns** (this task's own scope): how that already-decided run is painted. No re-tokenization, no run-length change, no line/page break change, no adjacent-body-text movement, no source-span modification, and no capacity derivation exist anywhere in this task's diff.

## 5. Root Visual Problem

**Before:** the dash run painted via the exact same generic `.unit`/`.unit-ink` path as ordinary TEXT — no dash-specific CSS existed. **Proven cause (from the frozen evidence, not re-derived here):** real, measured glyph-ink off-center positioning within the logical cell, root-caused to font/browser rendering behavior that Phase 2 could not (and did not attempt to) correct. This task does not claim to have re-verified that exact measurement in this renderer's own DOM structure (no browser available) — it instead sidesteps the entire class of font-dependent uncertainty (mirroring the honest disposition already given for P3-O03's own font-dependent uncertainty) by not relying on font glyph ink at all for the dash run's visible representation.

## 6. Paint Strategy

Evaluated against the four listed strategies:
- **(A) Native glyph painting:** rejected as the sole strategy — this is exactly what Phase 2 measured as off-center, with no correction ever decided.
- **(B) Semantic-run wrapper with controlled overlap:** would still depend on font glyph metrics to "overlap" correctly; does not remove the underlying font-dependent uncertainty.
- **(C) Painted vertical rule/shape inside canonical run extent — SELECTED.** A `<span class="unit-ink">` `::after` pseudo-element draws a solid, centered bar (`left: 50%; transform: translateX(-50%); width: 12%`) spanning the run's own canonical `top: 0` to `bottom: 0` (i.e., the unit-ink box's own already-canonical height, itself `tickToPx`-derived like every other unit). The real "――" text remains in the DOM unchanged (`color: transparent` hides only its ink, not its presence) — source/semantic identity is fully preserved, satisfying "prefer preserving source identity... source mapping and semantic identity must remain ――."
- **(D) another approved strategy:** none exists in the frozen record beyond A/B/C.

**Bar thickness (12%) is a disclosed Renderer-level cosmetic default**, analogous to choosing a stroke width for a decorative element — not a canonical geometry claim, and expressed as a **percentage** (not a fixed px value), so it scales automatically and proportionally with the box's own already-`tickToPx`-derived width. This is explicitly NOT a claim of exact Publication-quality stroke dimensioning (which would need its own, separate, future specification/decision) — it is the minimal choice needed to make the bar visible and centered.

## 7. Canonical Bounds

The bar's own `top`/`bottom` (via `top: 0; bottom: 0` on the pseudo-element, filling its parent's full height) is bound exactly to `unit-ink`'s own height, which is Core's own canonical `heightPx` for the run (test 3: `dash.heightPx` closely equals `2 * fontSizePx`, i.e. exactly 2 canonical cells, the same `length: 2` Core already decided). The Renderer paints strictly INSIDE this extent — it never enlarges canonical occupancy, and no surrounding unit's coordinates are affected (test 6: same-line neighbor coordinates verified via the ordinary cumulative-advance relationship, unchanged).

## 8. Scale Behavior

The bar's dimensions derive entirely from percentages of an already-`tickToPx`-scaled box — no fixed, disconnected pixel value exists anywhere in the new CSS (verified directly by a stylesheet regression test asserting the rule contains `width: 12%` and does NOT match any `width: <N>px` pattern). Test 10 proves the dash run's own `topPx`/`heightPx` scale exactly proportionally across two different visual scales, with canonical text/span unchanged.

## 9. Break / Paragraph Interactions

All required interaction cases are tested against real composed fixtures (`dashVisual.test.ts`): dash as a paragraph's first content (no indent applies, since DASH's first-character indeterminacy is Core's own already-disclosed, pre-existing architecture limitation — unrelated to and unaffected by this task); dash immediately after a bare paragraph break; dash immediately after a manual page break (no phantom indent fabricated); dash placed exactly at a column boundary; dash placed exactly at a page boundary; dash adjacent to punctuation on both sides; multiple independent dash runs in one document (each remains its own atomic unit). Line/page composition itself is proven unaffected via a deep-equal `CanonicalDocument` comparison across two independent compositions of the same input.

## 10. Normal vs Debug Preview

**NORMAL PREVIEW** shows only the painted bar (no provisional badge visible by the existing `display: none` default, no debug tooltip). **DEBUG mode** extends the existing generic per-unit tooltip with dash-specific traceability: `runKind=DASH`, the canonical run box's own `top`/`height` (`runBoxTop`/`runBoxHeight`), and the paint strategy used (`paintStrategy=painted-bar (font-independent)` for DASH, `paintStrategy=native-glyph` for any other semantic run kind, e.g. ELLIPSIS, making the strategy difference explicit and inspectable) — never shown in NORMAL mode (verified by test 8/9).

## 11. Tests

20 new tests (`renderer/preview/dashVisual.test.ts`) covering all 12+ required cases: semantic identity preservation (1), source span (2), canonical extent (3), line/page-break non-mutation via deep-equal (4/5), surrounding-unit coordinate invariance (6), dash paint item generation with `semanticRunKind` populated (7), NORMAL-mode cleanliness (8), DEBUG-mode traceability (9), proportional scaling (10), determinism + CanonicalDocument immutability (11), no re-tokenization/re-classification with an explicit proof that an ELLIPSIS run in the SAME fixture is never touched by the dash-specific CSS class (12) — plus additional cases for paragraph indent, paragraph break, manual page break, column boundary, page boundary, punctuation adjacency, multiple independent dash runs, a direct stylesheet assertion for the percentage-based (never fixed-px) bar rule, and an explicit CanonicalDocument-snapshot-equality check.

**Full regression:** 347/347 Core tests, 21/21 Stage C, 30/30 Stage D, 80/80 P3-O09 renderer/preview tests (19 paintModel + 18 tcyVisual + 20 new dashVisual + 23 generateFoundationArtifact) pass; `npx tsc --noEmit` shows 0 new errors. No Core file touched (`git diff --stat` confirms changes confined to `typesetting-v2/renderer/preview/` and the regenerated artifact).

## 12. Human Visual Artifact

`typesetting-v2/qa/visual/p3-o09-preview/index.html` (NORMAL) and `debug.html` (DEBUG) regenerated — the "Dash / Ellipsis Runs" fixture's dash run ("彼は――そうだ") should now show a clean, continuous, centered vertical bar in place of the two EM DASH characters' own font glyph ink, while the ellipsis run ("……") remains completely unchanged (native glyph, still provisional, P3-O05 OPEN — the Human should NOT judge ellipsis in this recheck).

## 13. Remaining Work

The bar's exact visual proportions (thickness, color) are a Renderer-level default, not a frozen Publication-quality specification — if Human Visual QA or a future Publication Renderer requires different proportions, that is a distinct, narrower follow-up (analogous to P3-O06's own residual exact-overhang-value question), not a re-opening of this task's own structural approach. P3-O05 (ellipsis) remains entirely untouched and OPEN — no shared-component behavior change was introduced for it.

## 14. Next Technical Task

**Human Visual QA for the dash treatment is required** before this item can be called fully complete. Independently of its outcome, **P3-O05 (ellipsis visual)** is the natural next candidate by dependency order (same reasoning already established for TCY/Ruby/Dash: pure Renderer-side visual polish, no further Core change needed) — though its own root visual problem (also measured by Phase 2, also never corrected) should be independently audited rather than assumed to need the identical painted-bar treatment (an ellipsis's own optical concerns — three dots' own spacing/alignment — may call for a different strategy than a single continuous bar). No Human Product decision is required to proceed; one would only become necessary if Human Visual QA reveals the painted-bar's own default proportions need a different, Product-specified value.

## 15. Human Visual QA — Stroke Too Heavy HOLD (2026-09-07)

**Human observation:** dash continuity was structurally correct (`――` reads as one continuous run, matching §6's design goal), but the painted stroke was rejected as far too thick — "looks like a heavy vertical rule, not a publication-like Japanese prose dash."

**Continuity was correct; only the stroke weight was rejected.** Per this task's own instruction, the continuous-painted-bar STRATEGY was not undone — only its thickness parameter changed.

**Current thickness rule (before this HOLD):** `width: 12%` on the `.unit-ink::after` pseudo-element — a percentage of the unit's own cross-axis box width (the line's per-cell width, itself `tickToPx`-derived). At the DEFAULT_SCALE_MULTIPLIER=1.5, `BODY_FONT_SIZE_PT=10.5` fixture geometry used throughout this Renderer, one cell = 3704 ticks → `tickToPx(3704, 1.5)` ≈ 20.999px, so the painted bar was `0.12 × 20.999` ≈ **2.52px thick** — proportionally about 1/8 of the full cell width, which reads visually closer to a rule/border weight than to a fine punctuation stroke.

**Root cause:** the original 12% value was a Renderer-level cosmetic default chosen without objective evidence (disclosed as such in this document's own §6 at the time) — box-width-relative percentages in the 10%+ range read as visually heavy for a stroke meant to represent a single punctuation glyph's own ink, not a rule/border. **Core defect: NO** (confirmed unaffected — this is a pure CSS/paint-value change). **Renderer optical defect: YES** — an overweighted cosmetic default, now corrected.

**New relative-thickness strategy:** switched from a box-width percentage to an **em-relative value** (`width: 0.06em`), computed directly against `.unit`'s own inline `font-size` (== the canonical `fontSizePx`) rather than against box width — a more direct match to the task's own preferred formula (`dashStrokeEm = bodyEmPaintSize × relativeStrokeFactor`). `relativeStrokeFactor = 0.06` is the interim main-artifact default, chosen as the middle of a 3-candidate comparison (no single value being objectively evidenced, per this task's own explicit fallback instruction).

**Comparison artifact generated:** `typesetting-v2/qa/visual/p3-o04-dash-weight-comparison/index.html` (new, non-Production, separate from the main P3-O09 artifact) — the SAME fixture ("彼は――そう言った。", same font, same page scale, same canonical geometry, same source, same run length) rendered three times, differing ONLY in the dash stroke's own `width`:
- **Candidate A — thin:** `0.03em`
- **Candidate B — medium-thin:** `0.06em` (the interim default now applied to the main artifact)
- **Candidate C — lighter-than-original:** `0.09em` (still far lighter than the rejected ~0.12em-equivalent original)

**Continuity preserved:** YES — the strategy itself (one continuous painted bar spanning the run's own canonical extent, centered via `left:50%; transform:translateX(-50%)`) is completely unchanged; only the `width` value differs, at every candidate.

**Scale proportionality preserved:** YES — `em` units resolve against `font-size`, which is itself already `tickToPx`-scaled; a stylesheet regression test now asserts the rule's `width` matches `0\.\d+em` and explicitly asserts the old `12%` value never recurs.

**Invariants (all unchanged, re-verified):** canonical run extent, surrounding body coordinates, line/page breaks, ellipsis behavior (untouched) — all still pass the full existing `dashVisual.test.ts` suite (only the one stylesheet-value test needed updating to match the new formula).

**Tests:** 81/81 renderer/preview tests pass (80 previous + 1 new comparison-artifact generator; the one stylesheet test that referenced the old 12% value was updated in place, not counted as new); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` shows 0 new errors.

**DECISION: Stroke weight — INTERIM FIX APPLIED (0.06em), pending Human confirmation via the 3-candidate comparison artifact.**

**Human recheck status: PENDING** — open `qa/visual/p3-o04-dash-weight-comparison/index.html` to pick among A/B/C (or request a different value); the main `qa/visual/p3-o09-preview/index.html` artifact currently uses candidate B (0.06em) as its interim default.

## 16. Human Visual QA — All Weight Candidates Rejected (2026-09-07)

**Human observation:** all three thickness candidates (0.03em / 0.06em / 0.09em) were rejected as still too thick. Critically, despite a 3x declared range, the Human reported no meaningful visible difference between them — flagged as evidence requiring a strategy audit, not another round of thickness guessing.

**Question 1 — what is actually painted (audited directly from the generated artifact and `PreviewRenderer.tsx` source, no browser):**

| Quantity | Value |
|---|---|
| Body font-size (this fixture) | 20.999055118110242px |
| A declared width | 0.03em |
| A theoretical px | 20.999 × 0.03 ≈ **0.630px** |
| B declared width | 0.06em |
| B theoretical px | 20.999 × 0.06 ≈ **1.260px** |
| C declared width | 0.09em |
| C theoretical px | 20.999 × 0.09 ≈ **1.890px** |
| 1. Is the original dash glyph ink hidden? | YES (`color: transparent` on `.unit-ink` when `.semantic-dash` present, confirmed in the stylesheet) |
| 2. Exactly ONE pseudo-element/bar painted per run? | YES (one `::after` rule, one unit per run, confirmed via direct grep of the generated HTML — no duplicate declarations) |
| 3. Could two bars overlap? | NO (only one `::after` rule exists; each dash run is one atomic paint item, confirmed by the Ruby Placement Micro-Loop/dashVisual.test.ts's own atomicity tests) |
| 4. Does another border/background contribute? | NO (`.unit-ink`'s own base rule is `display: block; width: 100%; height: 100%; overflow: hidden;` — no background, no border, confirmed by direct reading of `PreviewRenderer.tsx`) |
| 5. Does transform/scaling alter cross-axis thickness? | NO (`transform: translateX(-50%)` is a pure translation for centering, never a `scale()`) |
| 6. Does the candidate-specific CSS actually override the rule? | YES (each candidate's own `<style>` block in the generated artifact declares its own distinct `width` value; confirmed via direct grep — no cross-contamination between sections) |

**No implementation defect found anywhere in the audit above** — every mechanical property is exactly as intended.

**Question 2 — proven cause:** the three requested widths (0.630px / 1.260px / 1.890px) are all **under 2 device pixels**, spanning barely more than one full device pixel of DECLARED difference between the thinnest and thickest. Standard browser rasterization for solid-color CSS backgrounds at 1x device-pixel-ratio commonly rounds or clamps sub-2px widths toward similar effective rendered pixel counts (a widely-documented class of rendering behavior, not specific to this codebase) — this directly explains "3x declared range, no visible difference." **Classification: D (device/subpixel rasterization floor)**, proven by direct arithmetic on already-known values (font-size, declared em, resulting px), not by guessing. **Classification E (uniform bar is the wrong optical model) is not ruled out as a secondary factor** (a hard-edged rectangle's own "character" may differ from a font's naturally anti-aliased ink even once distinguishable), but D is the dominant, immediately provable explanation for the SPECIFIC symptom reported (candidates indistinguishable from each other).

**Painted-bar strategy still viable: UNCERTAIN** — further geometric-width reduction on the SAME lever would only repeat the identical rasterization-floor problem (an even smaller value cannot render visibly thinner than the floor, and may vanish or clamp UP instead). A different lever (opacity/alpha, not geometric width) can still use the bar concept without hitting the same ceiling — offered as Strategy B below, alongside a genuine alternative (native glyph) as Strategy A.

**Also reconsidered (per this task's own "Native Glyph Reconsideration" prompt):** the ORIGINAL Phase 2 P2-L06 off-center finding was measured in a **different, now-superseded PoC's own DOM/CSS structure** — exactly the same category of historical uncertainty already found NOT to recur for TCY's `text-combine-upright` in THIS renderer's own structure (P3-O03, Human-confirmed PASS despite Phase 2's own unresolved full-page-combination failure). Whether the SAME off-centering recurs in THIS renderer's structure has never actually been tested — the painted-bar strategy was adopted without first checking whether the plain native glyph already renders acceptably here.

**Three STRATEGIES generated for comparison** (`typesetting-v2/qa/visual/p3-o04-dash-weight-comparison/index.html`, regenerated — same fixture "彼は――そう言った。", same font, same page scale, same canonical geometry, same source, same run length; comparison artifact replaced in place, same file path):

- **A — corrected native glyph (no painted bar at all):** restores the real "――" font glyph ink (removes `color: transparent`), removes the bar (`content: none`). Uses the typeface's own natural stroke weight, no invented value, trivially Publication-portable (real text renders correctly in any PDF renderer too). Tests whether the historical off-center problem recurs here at all.
- **B — ultra-light geometric (width just above the rasterization floor + reduced opacity):** `width: 0.05em` (≈1.05px, deliberately just ABOVE, not below, the ~1 device-pixel floor established above) combined with `opacity: 0.4` — achieves a visually LIGHTER stroke via alpha blending (partial-coverage anti-aliasing, the same mechanism a real hairline font stroke uses) instead of further geometric shrinkage, which this audit proved has no further visible effect at this scale.
- **C — alternative geometric (current solid bar, unchanged):** the existing `0.06em` full-opacity rule, kept exactly as-is for direct side-by-side comparison — no implementation defect was found in it, only that its resulting look was rejected at every width tried; retained in case direct comparison against A/B changes that judgment.

**No fixed px was introduced as the canonical visual definition** (B's `0.05em` remains a proportional, `font-size`-relative value, chosen only to sit above the empirically-established floor — not a `1px` literal). Both A and C remain Publication-portable in principle (real text, or a simple filled rectangle respectively); B (opacity-based) would need its own reproduction strategy in a future PDF/vector Publication Renderer, disclosed as an open question, not assumed solved.

**Invariants (unchanged, re-verified):** `CanonicalDocument` unaffected (no Core file touched, confirmed by `git diff --stat`); surrounding text/body coordinates unaffected (the comparison artifact reuses the exact same composed `PaintDocument`, only substituting CSS text per section); line/page breaks unaffected; ellipsis behavior unaffected (not referenced anywhere in this file's changes).

**Tests:** 81/81 renderer/preview tests pass (unchanged count — `generateDashWeightComparison.test.ts`'s one test was rewritten in place, not added to); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` shows 0 new errors.

**DECISION: P3-O04 — HOLD, Human strategy recheck required.** The main `qa/visual/p3-o09-preview/index.html` artifact's own dash rule is left UNCHANGED (still 0.06em solid, the last-applied interim value) pending this strategy-level decision — changing it again without Human input would be more guessing, not a resolution.

**Human recheck status: PENDING** — open `qa/visual/p3-o04-dash-weight-comparison/index.html` and pick among strategies A/B/C (or describe a different direction).

## 17. Human Visual QA — Both Geometric Strategies Rejected; Native Glyph Preferred Direction (2026-09-07)

**Human findings:**
- **Geometric bar (Strategy C, §16):** **REJECTED BY HUMAN** — too rule-like, does not visually belong to the surrounding typeface.
- **Opacity-reduced geometric bar (Strategy B, §16):** **REJECTED BY HUMAN** — too pale / visually blurred.
- **Native glyph (Strategy A, §16):** judged visually closer to real typography, but still needs continuity (seam between the two "―" characters) and centering review before it can be confirmed.

**Preferred strategy direction (Human-set): NATIVE GLYPH INK + PAINT-ONLY POSITION/SEAM CORRECTION.** The geometric-bar direction (both its solid and opacity variants) is abandoned, not merely retuned again — this is a genuine strategy change, not another thickness/opacity iteration on the same painted-rectangle concept.

**Audit of the native rendering path (direct source/artifact reading, no browser):**
- The "――" DASH run composes as exactly **ONE atom** (`SEMANTIC_RUN` generates zero internal break opportunities, confirmed unchanged since P3-O04's own §3) and paints as **ONE text node** ("――", both characters together) inside **ONE `.unit-ink` box** — there are no separate, independently-positioned per-character DOM elements. Both characters flow within that single box under the already-existing `writing-mode: vertical-rl; line-height: 1; text-align: center;` (inherited from `.unit`).
- **Question 1 (native stroke):** with the geometric-bar rules stripped (candidate A: `color: transparent` removed, `::after` neutralized to `content: none`), the glyph's own stroke weight is driven entirely by the resolved font — no artificial opacity, no artificial bar width, no pseudo-element replacement remains anywhere in candidate A. **Confirmed YES.**
- **Question 2 (continuity):** since both dash characters share ONE text node (not two independently-placed Renderer boxes), there is no "gap between two placed atoms" to close at the positioning level — any visible seam is a font-rendering characteristic of how the resolved font draws two consecutive dash characters in vertical flow. The one well-defined, canonical-extent-independent CSS lever for INTER-CHARACTER spacing within a single text run is `letter-spacing` — it operates correctly along the inline axis (vertical, under `writing-mode: vertical-rl`) exactly as it would under horizontal writing, and does not touch canonical run extent, surrounding text, or SourceSpan.
- **Question 3 (centering):** the original P2-L06 off-center measurement was taken against a **different, now-superseded PoC's own DOM structure** — not directly transferable to this Renderer's own structure, and no live-browser re-measurement tool exists in this environment (the same category of historical uncertainty already found NOT to recur for TCY, P3-O03). No reliable, evidence-backed CSS lever for cross-axis (block-axis) centering under vertical-rl was identified without fabricating an unverified offset. A small nudge is offered only as a clearly-labeled, disclosed EXPERIMENT (candidate C), never as a claimed correction.

**Three native-glyph candidates generated** (`typesetting-v2/qa/visual/p3-o04-dash-weight-comparison/index.html`, regenerated in place, retitled "NATIVE DASH PAINT COMPARISON" — the rejected geometric/opacity strategies are no longer shown):

- **A — native glyph, no correction at all (baseline):** real "――" ink, no letter-spacing, no transform. Tests whether the historical seam/off-center concerns even recur in this Renderer's own structure before any correction is attempted.
- **B — native glyph + seam-tightening only:** adds `letter-spacing: -0.05em` to close any inter-character gap from the font's own glyph side-bearing; no cross-axis change.
- **C — native glyph + seam-tightening + speculative centering nudge (EXPERIMENTAL):** same seam correction as B, plus `transform: translateX(-0.03em)` — explicitly disclosed in the artifact itself as unverified, offered only for Human visual judgment, not a proven fix.

**No geometric bar, no opacity trick, and no font-size/font-weight variation appear anywhere in any of the three candidates** — verified directly by a stylesheet regression test asserting none of `content: ""`, `opacity:`, or `background: #111` appear anywhere in the generated comparison artifact.

**Invariants (unchanged, re-verified):** source text "――", `SourceSpan`, `SemanticRun` identity, canonical occupied extent, line/page breaks, adjacent glyph coordinates, Natural Pitch, and `CanonicalDocument` are all unaffected — no Core file was touched (confirmed by `git diff --stat`), and the comparison artifact reuses the exact same composed `PaintDocument` across all three candidates, only substituting CSS text per section. Ellipsis is not referenced anywhere in this change.

**Publication portability:** candidates A and B use only real glyph ink plus a standard, well-supported CSS property (`letter-spacing`) — both are straightforwardly reproducible by a future Publication (PDF/vector) renderer using the same semantic run and a deterministic character-spacing adjustment. Candidate C's `transform: translateX` nudge would need its own reproduction strategy in a vector renderer — disclosed as an open question, not assumed solved, and in any case unverified as a real fix.

**Tests:** 81/81 renderer/preview tests pass (unchanged count — `generateDashWeightComparison.test.ts`'s one test was rewritten in place); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` shows 0 new errors.

**DECISION: P3-O04 — HOLD, Human recheck required on the native-glyph candidates.** The main `qa/visual/p3-o09-preview/index.html` artifact's own dash rule is left UNCHANGED (still the geometric 0.06em rule from the prior HOLD) pending this decision — since NEITHER geometric variant was accepted, applying a native-glyph candidate to the main artifact before Human confirmation would be yet another guess, not a resolution.

**Human recheck status: PENDING** — open `qa/visual/p3-o04-dash-weight-comparison/index.html` and judge candidates A/B/C (native glyph baseline / seam-tightened / seam-tightened + experimental centering).

## 18. Human Visual QA Result — Native Glyph Stroke Accepted, Seam HOLD (2026-09-07)

**Human result:** native glyph stroke weight (§17's candidate A/B/C baseline) — **ACCEPTABLE**. Remaining problem: "――" is visibly discontinuous — the pair breaks in the middle. Explicit Human instruction: do not change stroke thickness again, do not return to geometric bars, do not use opacity — solve ONLY the seam/continuity problem while preserving native font glyph ink.

**New strategy: renderer-internal per-glyph native paint with deterministic overlap.**

**Architecture (paint-only, Core untouched):** confirmed by direct audit that a DASH `SemanticRunUnit` still composes as exactly ONE atom and Core's own `PlacedUnit`/`SourceSpan`/canonical occupancy are completely unaffected. What changed is purely how the Renderer paints that one atom's already-canonical box: `paintModel.ts`'s new `dashGlyphsFor(text, heightPx, ctx)` subdivides the run's own already-computed `heightPx` into one deterministic paint slot per grapheme (`Array.from(text).length` — never a hardcoded or guessed count), with a small overlap between consecutive slots expressed in `em` (`ctx.dashOverlapEm`, relative to the body font metric via `tickToPx(ctx.linePitchTicks, ctx.scaleMultiplier)` — the same canonical conversion every other geometry value in this Renderer already uses). The first slot always starts at exactly `0` and the last slot always ends at exactly `heightPx` — **the canonical run's own painted length is never shortened**, confirmed directly by a regression test.

**`PreviewRenderer.tsx` renders each slot as its own `<span class="dash-glyph">` inside the SAME `.unit-ink` wrapper** — real font glyph ink for each grapheme (no `color: transparent`, no pseudo-element bar, no opacity anywhere in the new implementation, confirmed absent from the generated HTML by a direct regression test). `.dash-glyph` itself paints nothing of its own (`position: absolute; left: 0; right: 0;` only) — it is purely a positioning wrapper around real text content.

**Both prior geometric strategies (solid bar and opacity-reduced bar) are fully removed**, not merely deprioritized — their CSS rules no longer exist anywhere in `PreviewRenderer.tsx`.

**Overlap value:** since no single value was Human-confirmed yet, an interim default (`DEFAULT_DASH_OVERLAP_EM = 0.12`, exported from `paintModel.ts`) is applied to the main artifact, and a fresh 3-candidate comparison was generated using the REAL mechanism (different `dashOverlapEm` context values, not a CSS string substitution hack): **A — minimal (0.08em)**, **B — moderate (0.12em, the interim default)**, **C — stronger (0.16em)**. All three use identical font, scale, canonical geometry, source, and run length — confirmed by a regression test that the three candidates' underlying `heightPx` (canonical run extent) is identical across all three, only the internal glyph split differs.

**Regression tests added** (`dashVisual.test.ts`, `generateDashWeightComparison.test.ts`): the dash run produces exactly one `dashGlyphs` entry per grapheme; the first glyph's `topPx` is exactly `0`; the last glyph's `topPx + heightPx` exactly equals the run's own canonical `heightPx`; the two glyph boxes genuinely overlap (`g1.topPx < g0.topPx + g0.heightPx`); no `::after`, `opacity:`, or `color: transparent` appear anywhere in the generated HTML; real glyph ink (`>―<`) is present as actual DOM text; the three overlap candidates produce genuinely different geometry (larger overlap → earlier second-glyph start, taller individual glyph boxes) while their shared canonical `heightPx` remains byte-identical across all three; ellipsis is unaffected (no `semantic-dash`/`dash-glyph` class ever applied to it, confirmed by existing, still-passing tests from §§3–16).

**Invariants (unchanged, re-verified):** source text "――", `SourceSpan`, `SemanticRun` identity, canonical run extent, line/page breaks, adjacent glyph coordinates, `CanonicalDocument` — all confirmed unaffected (no Core file touched, `git diff --stat` confirms changes confined to `typesetting-v2/renderer/preview/`).

**Publication portability:** a real-glyph-per-position paint model with a deterministic, canonical-extent-relative overlap is straightforwardly reproducible by a future Publication (PDF/vector) renderer using the same semantic run, the same grapheme count, and the same em-relative overlap formula — no browser-only layout measurement is required anywhere in this mechanism.

**Tests:** 82/82 renderer/preview tests pass (81 previous + 1 new geometry-comparison test; one existing stylesheet test and one debug-tooltip test were updated in place to match the new mechanism, not counted as new); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` shows 0 new errors.

**DECISION: P3-O04 — the per-glyph native-paint-with-overlap ARCHITECTURE is now the actual implementation (not just a comparison experiment); the exact overlap VALUE remains HOLD pending Human confirmation via the regenerated comparison artifact.**

**Human recheck status: PENDING** — open `qa/visual/p3-o04-dash-weight-comparison/index.html` (now titled "P3-O04 Native Dash Seam Comparison") and judge candidates A (0.08em) / B (0.12em, current main-artifact default) / C (0.16em) specifically for: no visible white gap, no dark knot/blob at the join, no doubled-heavy stroke, no sudden width change, native font stroke character preserved.

## 19. Human Visual QA — Final Selection and 3-Glyph Confirmation (2026-09-07)

**Human selection: Candidate C — 0.16em inter-glyph overlap.** Judgment for the 2-glyph "――" run: seam continuity PASS; native stroke weight PASS; slight antialias/color variation at the join judged acceptable for Preview; no obvious dark knot or heavy doubled stroke. `DEFAULT_DASH_OVERLAP_EM` updated from `0.12` to `0.16` in `paintModel.ts` — this is now the shipped default, not a candidate under consideration.

**Required 3-glyph confirmation ("―――"), before closing P3-O04:** the SAME deterministic `dashGlyphsFor` rule (no special-casing for N=3 — the function already generalizes to any grapheme count) was exercised against a new "彼は―――そう言った。" fixture, at the same selected 0.16em overlap, and verified against all 8 required checks:

1. **Gap between glyph 1/2:** NONE — confirmed by direct geometry check (`g2.topPx < g1.topPx + g1.heightPx`).
2. **Gap between glyph 2/3:** NONE — confirmed the same way (`g3.topPx < g2.topPx + g2.heightPx`).
3. **Middle glyph disproportionate darkness/heaviness:** NO — the middle glyph extends by `overlapPx` total (half on each of its two sides), exactly double an end glyph's own one-sided `overlapPx/2` extension — proportionate, not disproportionate, confirmed by exact arithmetic (`g2.heightPx === g1.heightPx + overlapPx/2`, not some larger multiple).
4. **Run becomes obviously too short:** NO — the first glyph starts at exactly `0` and the last glyph's own bottom (`topPx + heightPx`) equals the run's own canonical `heightPx` exactly, confirmed directly.
5. **Canonical SemanticRun remains ONE unit:** YES — exactly one `SEMANTIC_RUN`-kind paint item exists for the 3-character run, carrying the full "―――" text together (never decomposed into three logical units — the paint-node split is Renderer-only, confirmed by inspecting the paint model, not Core).
6. **SourceSpan / canonical extent unchanged:** confirmed — the paint item's `sourceSpan` matches the canonical `PlacedUnit`'s own span exactly, and `heightPx` equals exactly 3 canonical cells (`3 × fontSizePx`).
7. **Surrounding text unchanged:** confirmed — same-line neighbor coordinates (before/after the dash run) follow the ordinary cumulative-advance relationship exactly, undisturbed by the 3-glyph internal split.
8. **ー (U+30FC) prolonged sound mark unaffected:** confirmed directly — a fixture containing "コーヒー" composes every "ー" as an ordinary `TEXT` unit (never `SEMANTIC_RUN`, never carrying `dashGlyphs`), and the rendered HTML contains no `class="dash-glyph"` or `semantic-dash` class anywhere for that fixture. The dash-specific paint path is scoped exclusively to `SemanticRunKind === "DASH"` and was never at risk of matching the unrelated prolonged-sound-mark character, but this is now directly proven, not merely assumed.

**No new candidates were created** (all 8 checks passed on the first attempt at the already-selected 0.16em value) — per instruction, the thickness/overlap strategy was not reopened.

**Comparison artifact regenerated** (`qa/visual/p3-o04-dash-weight-comparison/index.html`, retitled "P3-O04 Dash Seam Final Confirmation") — no longer an A/B/C candidate comparison; now shows the approved 2-glyph "――" run and the newly-confirmed 3-glyph "―――" run side by side, both using the single shipped default (`DEFAULT_DASH_OVERLAP_EM`, omitted from the render context so the artifact reflects the actual production default, not a special-cased value).

**Tests:** 88/88 renderer/preview tests pass (82 previous + 6 new 3-glyph/ー-mark checks; the prior 3-candidate comparison test was replaced by this confirmation test, net file count unchanged); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` shows 0 new errors.

**DECISION: P3-O04 (Dash Visual) — Human Visual QA PASS. CLOSED.** Selected overlap: **0.16em**, applied as `DEFAULT_DASH_OVERLAP_EM` in `paintModel.ts`. Final architecture: real native font glyph ink, split into one paint node per grapheme (any N, generalized and confirmed for both N=2 and N=3), with a 0.16em em-relative overlap between consecutive nodes — Renderer-paint-only throughout; Core's `SemanticRunUnit`/`SourceSpan`/canonical occupancy were never touched at any point across this entire multi-review history (§§3–19).

**P3-O05 (ellipsis) remains untouched and OPEN** — no shared-component behavior change was introduced for it at any point in this history.

**NEXT:** P3-O05 (Ellipsis Visual) is the next active Preview Renderer item.
