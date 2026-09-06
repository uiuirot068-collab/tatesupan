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
