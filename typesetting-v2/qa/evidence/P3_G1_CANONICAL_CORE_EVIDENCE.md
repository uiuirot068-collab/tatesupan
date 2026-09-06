# P3-L15 — Canonical Core Regression Suite — Machine Evidence

- Status: **AUTOMATED WORK COMPLETE. HUMAN GATE G1: PENDING.**
- Companion to `typesetting-v2/qa/human/P3_G1_CANONICAL_CORE_REVIEW.md` (non-engineer summary). This document is the checked evidence backing every claim there.
- Substitutes for `typesetting-v2/tools/core-trace-viewer/`: given this Loop's timebox, evidence is delivered as this static document (JSON/trace excerpts drawn directly from passing automated tests) rather than a separate interactive tool. No manuscript upload occurred; every value here is either a real test assertion or read-only-sourced production data, never fabricated.

## 1. Test counts

| Metric | Value |
|---|---|
| Starting baseline (before this Loop) | 153 / 153 PASS |
| Ending total | 170 / 170 PASS |
| New this Loop | 17 |
| Regressions | 0 |
| Weakened/deleted existing assertions | 0 |

## 2. F01–F20 fixture accounting

| Fixture | Covered by | Status |
|---|---|---|
| F01 plain Japanese prose | `breaks/opportunity.test.ts`, `compose/line.test.ts` | PASS (prior Loops) |
| F02 line-start prohibition | `breaks/opportunity.test.ts` | PASS (prior) |
| F03 line-end prohibition | `breaks/opportunity.test.ts` | PASS (prior) |
| F04 strict cl-05 (HG-1) | `rules/defaultRuleSet.test.ts` | PASS (prior) |
| F05 strict cl-12/cl-13 (HG-2) | `rules/defaultRuleSet.test.ts` | PASS (prior) |
| F06 hanging rule capability | `rules/defaultRuleSet.test.ts` (`hangingPunctuationScope`) | PARTIAL — scope data exists (cl-06/cl-07); no eligibility-check function or physical hanging application exists yet. Not claimed as fully PASS; explicit deferral, not silent gap. |
| F07 atomic/group ruby | `ruby/index.test.ts`, cross-feature test (this Loop) | PASS |
| F08 explicit-segment jukugo ruby | `ruby/index.test.ts` | PASS |
| F09 overlong ruby geometry policy | `ruby/index.test.ts` | PASS (mechanism proven; real HG-4 overhang values remain P3-O06 residual OPEN) |
| F10 TCY explicit | `tcy/index.test.ts`, cross-feature test (this Loop) | PASS |
| F11 dash run | `breaks/opportunity.test.ts`, `compose/line.test.ts`, cross-feature test | PASS |
| F12 ellipsis run | `breaks/opportunity.test.ts` | PASS |
| F13 manual page break | `compose/page.test.ts`, cross-feature test (this Loop) | PASS |
| F14 image (fits-capacity, break-before/after) | `images/index.test.ts` | PASS (standalone function; NOT wired into automatic page-fill — see §9 integration gap) |
| F15 two-column flow | `compose/page.test.ts`, 8-preset sweep (this Loop) | PASS |
| F16 Unicode/grapheme safety | `source/graphemeSafety.test.ts`, `breaks/opportunity.test.ts`, `compose/line.test.ts` | PASS |
| F17 warning/error/HOLD | `diagnostics/index.test.ts`, HOLD gate test (this Loop) | PASS |
| F18 Natural Pitch / residual space | `compose/line.test.ts`, `compose/page.test.ts`, Natural Pitch gate (this Loop) | PASS |
| F19 multi-page long prose | `layout/composeCanonicalDocument.test.ts` (this Loop) | PASS |
| F20 canonical regression sentence | `layout/composeCanonicalDocument.test.ts` (this Loop) | PASS |

All 20 accounted for: 18 full PASS, 2 explicit partial/documented-gap (F06, F14) — neither silently claimed complete.

## 3. Invariant matrix (CORE_INVARIANTS.md authority, none renumbered)

| ID | Description | Status | Evidence |
|---|---|---|---|
| INV-001 | Source mapping never lost | PASS | Contiguity check across full page/column/line/placed-unit tree, cross-feature test |
| INV-002 | Renderer cannot mutate logical breaks | STRUCTURAL | No Renderer exists yet — enforced by absence, not by test (same status since P3-L03 plan) |
| INV-003 | Ruby cannot move canonical body positions | PASS | `ruby/index.test.ts` structural check (no base-coordinate field exists in `placeRuby`'s return type); cross-feature test confirms base placement is ordinary |
| INV-004 | Natural Pitch never stretches | PASS | Residual-space assertions at line/column/page level, this Loop's Natural Pitch gate test |
| INV-005 | Determinism | PASS | F19 repeat-run full structural equality; `computeHold`, `placeRuby`, `tcyCellCost` unit-level determinism tests |
| INV-006 | Manual break explicit and traceable | PASS | Cross-feature test: manual break forces ≥2 pages, verified via real composition, not assumed |
| INV-007 | Atomic/group ruby unbroken | PASS | Zero internal break opportunities generated, by construction (`ruby/index.test.ts`) |
| INV-008 | Jukugo breaks only at declared boundaries | PASS | 3-segment test proving only declared boundaries produce opportunities |
| INV-009 | Renderer alignment cannot mutate Core | STRUCTURAL | Same as INV-002 — no Renderer exists yet |
| INV-010 | Serious unresolved condition cannot silently PASS | PASS | HOLD gate test: impossible layout → `hold: true`, `BLOCKS_HOLD` error present, zero warnings substituted |
| INV-011 | Never fractures a user-perceived character | PASS | F16 grapheme-boundary tests; atom derivation exclusively via `graphemeBoundaries()` |
| INV-012 | No network/AI dependency | STRUCTURAL | No such import exists anywhere under `core/` (grep-verified every Loop) |
| INV-013 | Integer 0.001mm canonical geometry | PASS | Geometry gate test: every tick field in an assembled document checked `Number.isInteger` |

13/13 invariants accounted for. 11 PASS (tested), 2 STRUCTURAL (correctly not yet testable — no Renderer exists to violate them).

## 4. Cross-feature regression fixture

One combined manuscript (`core/layout/composeCanonicalDocument.test.ts`, "Cross-feature regression") containing, in one LogicalUnit stream: ordinary prose with kinsoku-relevant punctuation, an ATOMIC ruby unit, an explicit TCY unit, a same-kind DASH pair, a MANUAL_BREAK, and trailing prose — composed under a two-column-per-page setting.

Result: `hold: false`, zero errors, ≥2 pages (manual break honored), full source-span contiguity/boundedness verified by direct tree walk, ruby base placement confirmed present as an ordinary placed unit (not specially offset).

A second, explicitly separate test in the same block documents the ImageUnit integration gap (see §9) rather than including it in the "everything passes cleanly" fixture, which would have misrepresented that gap as resolved.

## 5. Source-mapping audit

Verified end to end: source code-point range → LogicalUnit → BreakOpportunity → composed line → column → page → `PlacedUnit.sourceSpan`. The cross-feature test walks every placed unit in the assembled document and confirms: `0 ≤ start ≤ end ≤ (total source length)` for every one, and the manually-broken second prose section's start offset is found among the placed units (nothing dropped). No UTF-16 code-unit offset appears anywhere in the public `SourceSpan` contract — offsets are Unicode code points throughout (verified since P3-L05/P3-L06).

## 6. Determinism audit

F19's long-prose fixture (100 code points, deliberately exceeding one column's capacity) composed twice under identical `RuleSetVersion`/`MeasurementFacts`/settings — `expect(second).toEqual(first)` passes as a full deep-structural comparison, covering pages, columns, lines, placed units, `VersionMetadata`, `warnings`, `errors`, `hold`, and every `TraceEvent`. No ID field contains non-deterministic content (all IDs are derived from source offsets, e.g. `line-${start}-${end}`, `placed-${start}-${end}`) — no normalization was needed or applied to make this comparison pass.

## 7. Natural Pitch / HOLD / Versioning results

- **Natural Pitch:** residual space explicit and positive when content doesn't fill a column; character-to-character pitch (`yTick` delta) confirmed constant (equal to one cell's natural advance) — never widened.
- **HOLD:** `lineExtentTicks: 0` (impossible) → `hold: true`, exactly one `BLOCKS_HOLD` `LayoutError`, zero warnings substituted in its place.
- **Versioning:** every `VersionMetadata` field (`coreSchemaVersion`, `ruleSetVersion`, `settingsVersion`, `measurementIdentity`) confirmed non-empty on every assembled document across all tests in this Loop.

## 8. Geometry audit

Every `GeometryTick` field (`xTick`, `yTick`, `residualSpaceTick`) in a representative assembled multi-page document checked via `Number.isInteger` — zero floating-point canonical values found. No CSS px or renderer-native unit appears anywhere under `core/` (grep-verified, zero matches for forbidden imports every Loop including this one).

## 9. Known integration gap: images

`core/images/index.ts`'s `placeImage()` (Contract §14 fits-capacity + break-before/after decision) exists and is independently tested (P3-L11/original-P3-L13) but was never wired into `compose/line.ts`'s atom-cost model — `cellCountFor` returns `0` for `IMAGE` units, meaning an image atom is always "free" and always placed regardless of its real intrinsic size. This is disclosed here as a real, named scope gap for a future Loop (most naturally alongside whichever Loop first performs full end-to-end `layout/assemble.ts` image wiring), not silently absorbed into a "PASS" claim.

## 10. P3-O12 disclosure (page-preset geometry)

The 8-preset sweep in this Loop uses **real** `charsPerLine`/`linesPerColumn`/`fontSizePt` values read directly (read-only) from production's `src/constants/paperSizes.ts` `PAPER_SIZE_TEMPLATES` — not arbitrary placeholders as in P3-L08. All 8 presets (文庫, A5 1段, A5 2段, B5, B6, 新書, A6, Web閲覧用) produce a valid, non-`hold` `CanonicalDocument`.

**This does not resolve P3-O12.** The mm-to-character-count *derivation formula* itself (`computeMaxCapacityChars`, `computeAutoCharsPerLine`, `deriveMaxCapacityFromMargins` in production `src/lib/pageLayout.ts`) has not been reimplemented, ported, or independently re-verified in Core. This Loop proves the Core's logical/schema machinery can *consume* each preset's already-known character/line counts correctly — it does not prove the Core can *derive* them from raw millimeter page/margin dimensions. **P3-O12 remains OPEN.**

| Claim | Status |
|---|---|
| 8-preset logical/schema support | **PASS** |
| Real preset capacity/geometry formula (mm → chars/lines) | **OPEN (P3-O12)** |
| Placeholder geometry presented as final Product authority | **NO — not claimed anywhere in this evidence** |

## 11. Open items — unchanged status (none resolved, none fabricated, this Loop)

P3-O03, P3-O04, P3-O05, P3-O06 residual, P3-O07, P3-O08, P3-O09, P3-O12, P3-O14, P3-O15 — all remain OPEN exactly as before this Loop. This Loop did not touch, narrow, or silently close any of them.

## 12. Scope audit

- `npx vitest run`: 170/170 PASS.
- `npx tsc --noEmit`: exits non-zero; the only reported error is the pre-existing, unrelated `src/app/layout.tsx(33,50)` `LayoutProps` gap present since P3-L04 — **0 new TypeScript errors** from this Loop.
- Forbidden-import grep (DOM/React/Next/`src/`) under `core/`: zero matches.
- `git status --short` before commit: only `core/layout/assemble.ts` (extended with `composeCanonicalDocument`), `core/index.ts` (new, the roadmap-named public entry point), `core/layout/composeCanonicalDocument.test.ts` (new), plus this evidence pair and the loop-log/roadmap status updates. No `src/`, `package.json`, lockfile, or `vitest.config.ts` change.
- No new dependency installed.
- No push, no deploy.

## 13. Decision

**P3-L15 AUTOMATED: PASS.**
**HUMAN GATE G1: PENDING** — awaiting Product Owner review of `typesetting-v2/qa/human/P3_G1_CANONICAL_CORE_REVIEW.md`'s scorecard. No Human answer has been filled in by this session. Master is not modified. Phase 3 is not closed. No push, no deploy.
