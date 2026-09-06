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
