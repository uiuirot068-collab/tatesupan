# P3-O12 Capacity Geometry Validation

- **Status: VALIDATION LOOP (P3-O12-D). Confirms the already Human-approved and already-implemented (P3-O12-C) policy behaves correctly from a document-lifecycle/product perspective — no redesign, no Renderer work, no `src/` changes.**
- Branch: `design/tatespun-typesetting-v2`, HEAD before this Loop: `8e64fbc`.
- Builds on: `typesetting-v2/qa/research/P3_O12_CAPACITY_GEOMETRY_AUDIT.md` (§1-§17, the research + Human approval + P3-O12-C implementation), `typesetting-v2/core/settings/capacity*.ts` (the implementation being validated, unmodified by this Loop).
- New evidence added by this Loop: `typesetting-v2/core/settings/capacityProductValidation.test.ts` (50 new tests, product/lifecycle-framed, reusing the existing exported functions only — no new capacity arithmetic).

---

## 1. Validation Verdict

**PASS.** All 20 pass criteria in the P3-O12-D brief are met. P3-O12 moves from IMPLEMENTED/READY-FOR-VALIDATION to **CLOSED** — meaning the pure Core policy work item is closed, not that Production/Editor integration exists or has been tested. See §13 for the exact, explicit conditions that remain before any real document is affected.

## 2. Approved Product Policy

Restated, not re-decided (full detail: audit §13/§16.8):

1. Existing documents without a persisted capacity-formula identity are legacy-frozen.
2. Opening an existing document never migrates it.
3. An ordinary save never migrates it.
4. An explicit geometry/capacity commit is the only migration trigger.
5. Once migrated, a document uses the v2-native formula and records that identity.
6. New documents begin from current Production-compatible effective preset behavior (the *live* legacy formula's own output, not `PAPER_SIZE_TEMPLATES`'s stale literals).
7. A new document becomes v2-native the same way an existing one does — an explicit commit.
8. Legacy `justified` stretch-to-fill must never enter v2-native/Canonical Core.
9. The legacy two-column max-capacity bug must never be copied into v2-native.
10. The legacy compatibility path may preserve old behavior only where necessary to prevent existing-document reflow.

## 3. Legacy Document Lifecycle

Validated in `capacityProductValidation.test.ts` Part 1, by walking a simulated old document (no persisted `capacityFormulaVersion`) through `documentOpen → ordinarySave → unrelatedSettingsEdit → documentOpen (reload)` using only `deriveCapacityForEvent` — the same function a future Editor adapter would call.

- **Formula identity stays `"legacy-frozen"` at every one of the 4 steps** — no event in that sequence ever produces `"v2-1"`.
- **Effective capacity is byte-identical across all 4 steps** (39×15 for 文庫 1段, matching the audit's §10 hand-verified number) — proving there is no drift merely from repeated derivation.
- Exhaustive check (Part 3): iterating the policy API's own closed `CapacitySettingsEvent` set against a legacy document, **only `"explicitGeometryCommit"` ever changes `formulaVersion`** — the other three (`documentOpen`, `ordinarySave`, `unrelatedSettingsEdit`) provably do not, for every event the type system allows to exist.

**Legacy effective capacity for representative old documents** (Part 1, second describe block):

| Document | Stored target | Effective capacity | Path used |
|---|---|---|---|
| A5 1段 | 0 (auto) | 54×21 | legacy-frozen only (`result.legacy` defined, `"v2" in result"` is false) |
| 文庫 1段 | 0 (auto) | 39×15 | legacy-frozen only |
| A5 2段 | 9999 (impossible) | 59×23 | legacy-frozen only — reproduces the documented bug (audit §10), stored target still clamped, never trusted outright (59 < 9999) |

## 4. Explicit Migration Lifecycle

Validated in Part 2, full lifecycle through the pure policy API:

1. `documentOpen` (no persisted version) → `"legacy-frozen"`.
2. `explicitGeometryCommit` → `"v2-1"`, with a specific effective capacity.
3. **Persisting that returned identity and re-deriving via a plain `documentOpen`** (simulating a reload) → still `"v2-1"`, with **identical** `charsPerLine`/`linesPerColumn` to step 2 — the migration is not a one-time side effect that a normal reload would undo.
4. Ordinary saves/opens/unrelated edits **after** migration never revert a `"v2-1"` document to `"legacy-frozen"` — verified for all three non-commit events.
5. Repeated `explicitGeometryCommit` calls with identical inputs produce identical results, both from a legacy starting point and from an already-`"v2-1"` starting point (idempotent re-commit).

## 5. Legacy Compatibility Parity

Every number in this section is copied from the audit's own §10 hand-verified evidence — this Loop adds no new numbers, only re-proves them from the lifecycle/product framing (Part 1) in addition to the function-level framing already covered by `capacityLegacyFrozen.test.ts` (P3-O12-C, still green, unmodified). 文庫 1段 39×15, A5 1段 54×21, A5 2段's explicit-max 59×23 (the bug) — all PASS.

## 6. V2-Native Physical Validity

Part 4 extends physical-validity coverage beyond the presets `capacityV2Native.test.ts` already checked, adding: B5 2段, a narrow-margin case (文庫, margins halved), a large-font case (文庫, 8.5pt→24pt), and a high-line-pitch case (文庫, lineHeightRatio 1.7→2.5). For every case:

- `charsPerLine ≥ 1` and `linesPerColumn ≥ 1` (physically feasible geometry always yields usable capacity).
- `charsPerLine × advanceTick ≤ columnHeightTick` and `linesPerColumn × linePitchTick ≤ textAreaWidthTick` — **capacity never exceeds the real physical extent**, on either axis, for any case tested.
- All tick values are integers (deterministic rounding, GeometryTick throughout).
- Residual space is non-negative on both axes.

**Column gap is respected**, proven structurally, not just numerically: for A5 2段, removing the 8mm column gap strictly increases the derived per-column height (`89000 ticks` vs. `85000 ticks`) and never decreases the resulting `charsPerLine` — i.e. the gap value is actually consumed by the formula, not silently ignored.

## 7. Two-Column Bug Isolation

Part 5, the closure-critical test:

- A legacy document with the A5 2段 impossible target still returns **59 chars/line** through `deriveCapacityForEvent` — the bug remains fully present and reachable via the public policy API for any document that hasn't migrated (by design, per policy point 9/10 — "preserve old behavior only where necessary to prevent existing-document reflow").
- The **same** document, run through `explicitGeometryCommit` instead, returns a result that (a) is **not** 59, and (b) is proven physically valid via `charsPerLine × advanceTick ≤ columnHeightTick` against the corrected per-column extent.
- **No-shared-helper proof, generalized to every 2-column preset** (not just A5 2段): for all 6 two-column fixtures (文庫/A5/B5/B6/新書/A6 2段 — Web 2段 also checked separately), v2-native's `columnHeightTick` is proven strictly less than the full undivided text-area height the legacy bug mistakenly uses (`columnHeightTick × 2 + columnGapTick == fullHeightTick`, and `columnHeightTick < fullHeightTick` always holds) — the two formulas provably never share that intermediate value for any mandatory preset, not just the one case originally investigated.

## 8. Natural Pitch / MeasurementFacts

**INV-004 (no stretch-to-fill):** for every one of the 16 preset fixtures, `charsPerLine×advance + residualMainAxisTick == columnHeightTick` and the equivalent cross-axis identity both hold exactly — no space is silently absorbed anywhere. Additionally, a structural (TypeScript-shape) check confirms `V2NativeCapacityInputMm` has no field a hidden per-preset pitch multiplier could even be read from (Contract §18's "no preset-specific pitch multiplier exists in any LayoutSettings shape").

**MeasurementFacts determinism, isolated per axis:**
- Halving the main-axis advance (a custom `MeasurementFacts` override) increases `charsPerLine`, as expected, and changes `advanceTick` accordingly — no other field silently disagrees.
- Doubling **only** `lineHeightRatio` (geometry input, not a measurement override) leaves `charsPerLine` **completely unchanged** and strictly decreases `linesPerColumn` — proving the main-axis and cross-axis derivations are genuinely independent, not coincidentally correlated.

## 9. Mandatory Presets

All 8 mandatory preset names (文庫, A5, B5, B6, 新書, A6, Web閲覧用, plus the implicit 8th being the 1段/2段 pairing already present in every preset) have at least one representable fixture, each producing a positive, valid capacity through the full policy dispatch (`deriveCapacityForEvent`), not merely through the underlying formula functions directly.

**`PAPER_SIZE_TEMPLATES` classification — explicitly reconfirmed, per this Loop's own Part 9 instruction:** `src/constants/paperSizes.ts`'s `PAPER_SIZE_TEMPLATES` is the **live** Production preset-definition source (margins, font size, line-height, column gap, nombre settings) and remains untouched, unmodified, and un-deprecated by any work in P3-O12-A/B/C/D. The narrower, already-evidenced finding (audit §6/§10) is only that its **stored `cols1`/`cols2` `charsPerLine`/`linesPerColumn` literal fields** are cosmetic/stale relative to the live runtime derivation — Production's own `PageSettingsPanel.tsx` overwrites them immediately via `deriveCapacityFromCurrentMargins` on every preset switch. `capacityFixtures.ts` transcribes the **margin/font/line-height/column** fields (the live ones) from `PAPER_SIZE_TEMPLATES` as literal test data, and does not import the source file (Core has zero `src/` dependency, per `CORE_MODULE_MAP.md`).

## 10. Web Boundary

Part 9's dedicated tests confirm: (a) computing a Web fixture's capacity and then a print preset's capacity in sequence produces a print result **identical** to computing the print preset alone (no shared mutable state, i.e. the derivation functions are pure) — so Web geometry cannot contaminate a print preset's canonical geometry by call ordering or otherwise; (b) Web's fixture mm values are exactly `768/2.2` and `1024/2.2` (the one legitimate px→mm boundary conversion, matching Production's own `PX_PER_MM=2.2`, audit §7), and once past that conversion, `deriveV2NativeCapacity` treats the Web fixture exactly like any print preset — there is no Web-specific branch anywhere in `capacityV2Native.ts` or `capacityLegacyFrozen.ts`, mirroring the audit's own finding about Production's `computePageLayout`.

## 11. Existing-Document Compatibility Claim

> "After P3-O12 integration is eventually wired into the Editor, an old document with no capacity formula version can be opened and saved without changing its pagination merely because TateSpun has upgraded to the v2 capacity system."

**CONDITIONAL — PASS at the Core-policy level, conditional on Editor wiring not yet built.** The pure policy API (`deriveCapacityForEvent`) makes this true *by construction*: a missing version resolves to `"legacy-frozen"` (§3), and every non-`"explicitGeometryCommit"` event is proven, exhaustively over the API's own closed event set, to leave that identity and its resulting capacity numbers unchanged (§3, Part 3). The claim is CONDITIONAL, not unconditional PASS, purely because of integration facts this Loop cannot itself supply:

1. The future Editor adapter must actually call `deriveCapacityForEvent` with `"documentOpen"` (not `"explicitGeometryCommit"`) when a document is merely opened — this is an Editor-side wiring correctness requirement, not a Core policy gap (the Core policy makes the *correct* choice available and makes the *wrong* choice for this scenario unreachable except by explicitly passing the wrong event name).
2. The future Editor adapter must call it with `"ordinarySave"` (or `"unrelatedSettingsEdit"`), never `"explicitGeometryCommit"`, for an autosave triggered by a content/manuscript edit — same category of condition.
3. `PageSettings`/`DocumentRecord` must actually gain the persisted `capacityFormulaVersion` field (or equivalent) for `resolveCapacityFormulaVersion`'s "missing ⇒ legacy-frozen" behavior to have anything meaningful to read — this schema addition does not exist yet (by design; §15 of the audit, unauthorized by any Loop so far).

No browser, DOM, or actual `PageSettingsPanel.tsx` testing has been performed — this claim is a Core-policy-correctness statement, not a Production-integration test result.

## 12. New-Document Readiness Claim

> "New documents can begin with Production-compatible initial capacity behavior and later migrate to v2-native only after an explicit geometry commit."

**CONDITIONAL — PASS at the Core-policy level, same category of condition as §11.** `initializeNewDocumentCapacity()` is proven (new tests, end of `capacityProductValidation.test.ts`) to (a) always start `"legacy-frozen"`, (b) produce a capacity number identical to calling `deriveLegacyFrozenCapacity` directly on that preset's live geometry (never the stale `PAPER_SIZE_TEMPLATES` literal — e.g. proven not to equal 文庫's stored 38×16 in `capacityPolicy.test.ts`, P3-O12-C), and (c) only move to `"v2-1"` via the same `explicitGeometryCommit` path an existing document would use — there is no separate "new document" migration mechanism to keep in sync with the existing-document one. Conditional only because `db.ts`'s `createDocument()` does not yet call this function (unauthorized `src/` integration).

## 13. Remaining Integration Conditions

Consolidated from §11/§12 — these are Editor/`src/`-side wiring correctness requirements, not open Core-policy questions:

1. `PageSettings`/`DocumentRecord` needs the persisted `capacityFormulaVersion` field added (schema change, `src/lib/pageLayout.ts`/`src/lib/db.ts`).
2. The document-load effect (`TategakiEditor.tsx`, per the P3-O12-B trace) must call the dispatch with `"documentOpen"`, never `"explicitGeometryCommit"`.
3. The autosave path must call the dispatch with `"ordinarySave"` (or not call it at all if content-only edits don't touch geometry — audit §16.7 already established that ordinary content saves don't need to touch capacity fields at all).
4. Only `PageSettingsPanel.tsx`'s geometry/capacity "設定を反映" commit path may call the dispatch with `"explicitGeometryCommit"`.
5. `createDocument()` should call `initializeNewDocumentCapacity()` (or equivalent) instead of hardcoding `DEFAULT_PAGE_SETTINGS`'s current literal 39×15 for 文庫 — though note this is presently equivalent in *value* (both already equal the live legacy formula's own 文庫 1段 output), so this condition is about establishing the *mechanism* going forward, not fixing a currently-wrong number today.

None of these five conditions were open Product decisions requiring a new Human Gate — all five are direct, mechanical consequences of the already-approved policy (audit §13/§16.8) and the already-implemented pure functions (P3-O12-C) meeting the real Editor code the P3-O12-B trace already mapped.

## 14. Regression Results

```
npx tsc --noEmit   → only the pre-existing baseline error (src/app/layout.tsx:33, LayoutProps). Zero new errors.
npx vitest run     → 24 test files, 315 tests, ALL PASSING (265 pre-existing [174 + 91 from P3-O12-C] + 50 new from this Loop).
```

## 15. Closure Decision

**P3-O12: CLOSED**, scoped exactly as follows — this closes the **Core capacity-policy research/implementation/validation work item** (the geometry→capacity derivation question, its Human-approved versioned-compatibility policy, and its pure, tested implementation). It does **not** close, authorize, or imply:

- Editor/`src/` integration (§13's 5 conditions remain to be built, in a separate, future, explicitly-authorized Loop).
- Any Renderer work (Preview, Publication, UI-C) — untouched, unstarted.
- Any Production behavior change — `src/` remains byte-for-byte unmodified across P3-O12-A/B/C/D.
- Any change to Master (`v1.8`, unmodified) or to any other still-OPEN item (P3-O03/O04/O05/O06 residual/O07/O08/O09/O14/O15, F06).

The distinction the loop brief itself asked to preserve — **IMPLEMENTED POLICY vs. NOT-YET-WIRED EDITOR INTEGRATION** — is exactly the distinction this closure respects: the policy is closed as correct and validated; its connection to real user documents remains a deliberately separate, future, explicit decision.
