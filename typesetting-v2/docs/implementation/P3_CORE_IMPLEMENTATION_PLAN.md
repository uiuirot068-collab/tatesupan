# P3-L03 — Canonical Core Implementation Plan

- Status: **P3-L03: REVIEWED / FROZEN FOR IMPLEMENTATION (2026-09-06, Master v1.8 §28).** Core implementation: NOT STARTED. This document defines how implementation will proceed; it does not itself implement anything. P3-L04 may begin once the Vitest dependency gate (`P3_CORE_LOOP_ROADMAP.md` pre-requisite section) is separately resolved.
- Builds on: `docs/core/TATESPUN_V2_CORE_CONTRACT.md` (FROZEN), `CORE_INVARIANTS.md`, `TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md`, `CORE_RESPONSIBILITY_MATRIX.md`, `docs/architecture/PHASE3_OPEN_ITEMS.md`, Master v1.7 §27.
- Companion documents (each is a required deliverable of this same Loop): `CORE_MODULE_MAP.md`, `P3_CORE_LOOP_ROADMAP.md`, `CORE_TEST_STRATEGY.md`, `CORE_MIGRATION_ROLLBACK_PLAN.md`, `CORE_IMPLEMENTATION_RISK_REGISTER.md`.

---

## 1. Purpose

Define, before any Core source file is written, exactly where implementation lives, how it is decomposed into independently testable Loops, how each Loop is tested, and how the whole effort stays isolated from Production until an explicit, evidence-gated integration decision. This plan is itself the P3-L03 deliverable — it authorizes P3-L04 to begin, it does not begin implementation.

## 2. Current frozen baseline

Canonical Master v1.7; Phase 0–2 CLOSED; P3-L01 (Japanese rule freeze) CLOSED; P3-L02 (Core Contract) CLOSED/FROZEN. Direction: C1-NATURAL. The frozen Contract's authority split (Core vs. Renderer vs. Normalizer vs. Measurement Provider), geometry precision (integer `GeometryTick`, 1 tick = 0.001mm), source addressing (Unicode code-point offsets, grapheme-safe grouping), and the 13 named invariants (`CORE_INVARIANTS.md`) are treated here as **given, not re-derived**. This Loop plans against them; it does not reopen them.

## 3. Implementation principles

1. Small, independently testable, independently revertible Loops — never "implement entire Core" as one step.
2. Pure, deterministic primitives first; composition logic built upward from them (§6/§7).
3. Tests specified before or alongside each Loop's implementation, never after the fact as an afterthought.
4. No Loop touches `src/` (Production) before the explicit integration gate (§18).
5. Every frozen invariant maps to at least one automated test before the Loop that could violate it is considered done (§12).
6. Open items (P3-O03/04/05/06/07/08/09/14/15) are mapped to a stage so they are visibly tracked, never silently forgotten or silently force-closed by an implementation shortcut (§13).
7. A repeated (2–3×) implementation failure/workaround stops the Loop and gets recorded, rather than being looped through indefinitely (`P3_CORE_LOOP_ROADMAP.md` header rule).

## 4. Implementation location

**Recommendation: `typesetting-v2/core/`.**

Reasoning:
- **Isolation:** `typesetting-v2/` is already the established home for all Phase 0–3 non-Production work (docs, research, prototypes, fixtures). Nothing under it is imported by `src/` today (confirmed by read-only inspection — `src/lib/*.ts` has no reference to `typesetting-v2/`). Placing Core there continues that existing, proven boundary rather than inventing a new one.
- **TypeScript/tooling compatibility:** the repo's root `tsconfig.json` already `include`s `**/*.ts` with no path restriction to `src/` — files under `typesetting-v2/core/` are type-checked by the existing `tsc --noEmit` immediately, with zero config change.
- **Ease of testing:** a future test runner (recommended: Vitest, `CORE_TEST_STRATEGY.md` §1) can be pointed at `typesetting-v2/core/` without touching `src/`'s build pipeline at all.
- **No accidental Production import:** Next.js's build (`next build`) only compiles what `src/` (via the `@/*` path alias) actually imports. Since nothing in `src/` references `typesetting-v2/core/`, Core code is structurally inert to Production until something in `src/` deliberately imports it — which is exactly the integration gate (§18).
- **Clear migration path:** Stage G of the migration plan (`CORE_MIGRATION_ROLLBACK_PLAN.md`) is precisely "something in `src/` starts importing `typesetting-v2/core/index.ts`" — a single, auditable, greppable event, not a restructuring.

Rejected alternatives: `typesetting-v2/src/core/` (adds a redundant `src/` segment inside a directory that is not itself a compilation root — no benefit over `typesetting-v2/core/` and risks confusion with the real `src/`); `typesetting-v2/engine/` (equally isolated, but "engine" collides with the existing product's informal name for the *old* system in conversation/docs — "core" matches the Contract's own vocabulary, `TATESPUN_V2_CORE_CONTRACT.md` etc.). Not created in this Loop — documentation only, per this Loop's own scope rule.

Production isolation: **YES.** Future integration path: §18.

## 5. Module boundaries

See `CORE_MODULE_MAP.md` for the full table (25 modules, responsibilities, allowed/forbidden dependencies, contract types, test level, first Loop). No module is a monolithic `typesettingEngine.ts`. Every module maps to a named Contract section or Responsibility Matrix row.

## 6. Dependency DAG

```
Tier 0  geometry · version · source/span
Tier 1  units (types) · rules/characterClass · measurement/facts · settings (types) · layout/schema
Tier 2  source/graphemeSafety · rules/defaultRuleSet
Tier 3  breaks/opportunity · trace
Tier 4  measurement/fakeProvider
Tier 5  breaks/decision
Tier 6  ruby · tcy · semanticRuns · images  (each plugs INTO composition, composition does not depend on them existing first)
Tier 7  compose/line
Tier 8  compose/column
Tier 9  compose/page · colophon · diagnostics
Tier 10 layout/assemble
Tier 11 index.ts
```

Dependencies flow strictly downward (a Tier-N module may depend on Tier <N modules only; no cycles). **No module at any tier imports DOM, Canvas, a PDF library, React, UI state, SNS, cloud, or AI** — this is verified structurally (grep for such imports under `core/`) as part of every Loop's acceptance criteria, not merely asserted here.

## 7. Implementation order

Derived from the candidate order in the loop brief (A–O), reordered where the frozen Contract's own dependency evidence justified it:

1. Geometry + source span + version metadata + canonical schema types (Tier 0/1 types) — P3-L04
2. Grapheme-safe source mapping + LogicalUnit union — P3-L05
3. Character-class / RuleSet data — P3-L06
4. Break opportunity + trace (**moved earlier than the candidate order's "F" measurement step** — opportunity derivation needs only units + rules, not measurement, so it can be built and tested before the measurement boundary exists) — P3-L07
5. Measurement contract + fake provider — P3-L08
6. Break decision + Natural-Pitch line composition — P3-L09
7. Column/page composition + manual break — P3-L10
8. Ruby — P3-L11
9. TCY + semantic-run integration — P3-L12
10. Images + colophon/structured elements — P3-L13
11. Warnings/errors/HOLD + versioning — P3-L14
12. 8-preset Canonical Layout verification (regression milestone) — P3-L15

Full per-Loop detail (timebox, inputs, files, tests, gate, rollback, dependencies) is in `P3_CORE_LOOP_ROADMAP.md` — that document is the authoritative sequencing artifact; this section is its summary.

## 8. Test strategy

Full detail in `CORE_TEST_STRATEGY.md`. Summary: type-check first (available today, zero install), a single Human-approved test-runner addition (Vitest recommended) at the start of P3-L04, then unit / fixture / golden / determinism / source-mapping / invariant / failure-HOLD / 8-preset-logical test levels, strictly before any Human visual QA becomes relevant (§15).

## 9. Measurement-provider strategy

`measurement/facts.ts` defines the `MeasurementFacts` contract only (P3-L08). `measurement/fakeProvider.ts` supplies deterministic, documented, named fixture values (e.g. "10mm body font size → 10000 ticks natural advance") for every Loop from P3-L08 through P3-L15. **No real font-shaping/browser/canvas measurement adapter is selected or implemented anywhere in this plan** — that choice is explicitly out of scope (Contract §17, Master §7 white-sheet rule) and belongs to whichever future Loop first needs real Renderer-adjacent measurement (P3-O08/O09 territory).

## 10. Fixture taxonomy

| ID | Scenario | First Loop | Corresponds to regression-corpus category |
|---|---|---|---|
| F01 | Plain Japanese sentence | P3-L07 | #1 |
| F02 | Line-start prohibited punctuation | P3-L07 | #16 |
| F03 | Line-end prohibited opening bracket | P3-L07 | #17 |
| F04 | cl-05 strict policy (HG-1) | P3-L06 | #16 (extended) |
| F05 | cl-12/cl-13 strict policy (HG-2) | P3-L06 | #16 (extended) |
| F06 | Hanging punctuation candidate | P3-L09 (follow-up scope) | #18 |
| F07 | Atomic/group ruby | P3-L11 | #9 |
| F08 | Jukugo ruby with explicit segments | P3-L11 | #10 (extended) |
| F09 | Overlong ruby (geometry clamp) | P3-L11 | #10 |
| F10 | TCY explicit | P3-L12 | #11, #14 |
| F11 | ―― semantic run | P3-L07 | #7 |
| F12 | …… semantic run | P3-L07 | #8 |
| F13 | Manual page break | P3-L10 | #19 |
| F14 | Image block | P3-L13 | #21 |
| F15 | Two-column layout | P3-L10 | #20 |
| F16 | Surrogate pair / emoji ZWJ / variation sequence | P3-L05 | (new — not in the pre-existing 23-category corpus) |
| F17 | Malformed notation / HOLD | P3-L14 | (new) |
| F18 | Capacity/residual margin case | P3-L09 | (new, sharpens #22) |
| F19 | Long prose across multiple pages | P3-L15 | #22 |
| F20 | Canonical regression sentence (Master §0 hard case) | P3-L15 | Regression Corpus §1 |

The pre-existing long Human-QA prose corpus (`typesetting-v2/fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md`) is preserved **separately** from this F-series set — F-series fixtures are short and synthetic, one phenomenon each; the long prose corpus remains reserved for later Human visual renderer comparison and is never used as a Core golden-snapshot input (`CORE_TEST_STRATEGY.md` §6).

## 11. Golden-output policy

See `CORE_TEST_STRATEGY.md` §4. Summary: logical/data artifacts (LogicalUnits, BreakOpportunities/Decisions, trace semantics, page/column/line assignment, GeometryTicks, SourceSpans, warnings/errors/hold) may be golden-tested; DOM/pixels/raster/PDF bytes may not, during Core implementation. Snapshot updates require line-by-line review — never a blanket "update until green."

## 12. Invariant test matrix

| Invariant | Tested starting Loop | Fixture(s) |
|---|---|---|
| INV-001 (source mapping never lost) | P3-L05 | F16, all subsequent fixtures |
| INV-002 (renderer cannot mutate breaks) | Not testable until a Renderer exists — enforced structurally in the meantime (no Renderer code exists yet) | — (Stage D/E, `CORE_MIGRATION_ROLLBACK_PLAN.md`) |
| INV-003 (ruby never moves body position) | P3-L11 | F07, F08 |
| INV-004 (Natural Pitch never stretches) | P3-L09 | F18 |
| INV-005 (determinism) | P3-L07 (opportunity) → P3-L08 (measurement) → P3-L09 (line) → P3-L15 (full document) | repeated-run tests at each stage |
| INV-006 (manual break traceable) | P3-L10 | F13 |
| INV-007 (atomic ruby never breaks) | P3-L11 | F07 |
| INV-008 (jukugo breaks only at declared boundaries) | P3-L11 | F08 |
| INV-009 (renderer alignment never mutates Core) | Structural until a Renderer exists (same status as INV-002) | — (Stage D/E) |
| INV-010 (unresolved serious condition cannot silently PASS) | P3-L14 | F17 |
| INV-011 (never fractures a user-perceived character) | P3-L05 | F16 |
| INV-012 (no network/AI dependency) | Structural, every Loop (grep-checked, no test fixture needed) | — |
| INV-013 (integer tick geometry, no float leakage) | P3-L04 | geometry unit tests, then every subsequent fixture |

All 13 invariants from `CORE_INVARIANTS.md` are mapped; none renumbered. INV-002/INV-009 cannot be *executed* as tests until a Renderer exists (there is nothing yet that could violate them) — they are enforced structurally (no Renderer code exists under this plan) and become real tests at Stage D/E of the migration plan, not silently dropped.

## 13. Open-item dependency mapping

| Open item | Blocks Core skeleton? | Stage mapped |
|---|---|---|
| P3-O03 (TCY visual renderer) | No | Future Renderer work, outside this plan; P3-L12 ships the logical `TCYUnit` without it |
| P3-O04/O05 (dash/ellipsis visual alignment) | No | Same — P3-L07/L12 ship the semantic run without any pixel field |
| P3-O06 residual (exact ruby overhang budgets) | No | P3-L06/L11 ship the overhang table shape with all-zero values; real values are a future, narrower Human decision |
| P3-O07 (TCY auto-detection threshold) | No | P3-L12 ships explicit-TCY only; auto-detection stays a future Normalizer-level policy |
| P3-O08 (Publication/PDF renderer) | No | `CORE_MIGRATION_ROLLBACK_PLAN.md` Stage E |
| P3-O09 (Preview renderer) | No | `CORE_MIGRATION_ROLLBACK_PLAN.md` Stage D |
| P3-O14 (jukugo segmentation mechanism) | No | P3-L11 honors provided `segments`, defaults to `ATOMIC` when absent — the discovery mechanism itself remains a separate future loop |
| P3-O15 (group-ruby distinct rule) | No | P3-L11 continues treating group-ruby as `ATOMIC` (same as mono-ruby); not silently permanently closed — the risk register (`CORE_IMPLEMENTATION_RISK_REGISTER.md`) flags the schema as extensible for when this resolves |

No open item blocks P3-L04 through P3-L15. Every one is either explicitly deferred to a stage past this plan's scope, or given a safe, non-guessing default consistent with the frozen Contract.

## 14. Loop roadmap

See `P3_CORE_LOOP_ROADMAP.md` — 12 Loops, P3-L04 through P3-L15, each 45–90 minutes, none exceeding 120 minutes, first-source-file through Canonical Core regression milestone.

## 15. Human QA gates

Core is mostly non-visual; Human QA is not requested after every pure-data Loop. Exactly one Human Gate exists inside this plan's scope:

**Gate G1 (P3-L15, end of roadmap):** what the Human sees — a local, static diagnostic trace/JSON dump (§16) for a representative subset of the 20 F-series fixtures. What they judge — whether the *logical* decisions look right: correct kinsoku pushes, correct jukugo-ruby segment breaks, correct residual-space reporting, correct HOLD triggering on the malformed fixture. What is explicitly **not** yet being judged — any rendered glyph, font choice, pixel alignment, or visual rhythm; no Preview or Publication renderer exists at this point in the plan.

Beyond Gate G1, two further Human Gates exist but are **outside this plan's scope** (they belong to future Loops per the migration plan): the first real Preview Renderer's output (Stage D) and Publication PDF output (Stage E) — both restated here only so they are not confused with Gate G1's purely-logical review.

## 16. Diagnostics

A minimal, local, non-production diagnostic tool set is planned (not implemented in this Loop): a source-span inspector, a logical-unit dump, a break-opportunity table, a line-composition trace view, and a page-layout JSON viewer — collectively delivered as part of P3-L15's scope (`P3_CORE_LOOP_ROADMAP.md`), living under `typesetting-v2/tools/core-trace-viewer/` or an equivalent local script. No manuscript upload; static/local only, consistent with the privacy plan (§22).

## 17. Migration stages

See `CORE_MIGRATION_ROLLBACK_PLAN.md` §1 for the full A–H stage table. Summary: A (isolated dev, this plan's scope) → B (Core regression complete) → C (non-Production comparison adapter) → D (Preview comparison, dev-path only) → E (Publication comparison) → F (Human QA across mandatory presets) → G (controlled integration) → H (old-engine retirement gate, not scheduled).

## 18. Integration entry criteria

No `src/` integration occurs merely because Core tests pass. Full 8-point criteria list in `CORE_MIGRATION_ROLLBACK_PLAN.md` §3: invariant suite PASS, all mandatory features represented (including safe CONTRACT-GAP defaults), deterministic multi-page fixture PASS, source mapping PASS, no serious HOLD silently downgraded, a comparison adapter exists and has been run, a rollback path is in place, and explicit Human/Product approval to begin integration.

## 19. Rollback

Two levels, detailed in `CORE_MIGRATION_ROLLBACK_PLAN.md` §4: per-Loop rollback (each Loop names its own revertible file/module boundary in `P3_CORE_LOOP_ROADMAP.md`) and Product-level rollback (the old engine stays live and unmodified through every stage up to the not-yet-scheduled retirement gate).

## 20. Commit/checkpoint strategy

Every successful Loop (P3-L04 through P3-L15) ends with: tests PASS (type-check + runner, once approved) → scope audit (only `typesetting-v2/core/` and this Loop's named docs/fixtures/tools changed, nothing in `src/`) → Human Gate if the Loop's row in `P3_CORE_LOOP_ROADMAP.md` marks one → a checkpoint commit. Suggested commit-message convention: `TSP v2: implement <loop name>` (e.g. `TSP v2: implement core geometry foundation` for P3-L04). Not every micro-edit needs its own checkpoint; every completed Loop does. No commit is created by this planning Loop (P3-L03) itself. No push, no deploy, ever performed automatically by any Loop in this roadmap.

## 21. Production quality gates

Three distinct, never-merged gates: **Logical correctness** (Core invariant suite + fixtures — this plan's entire scope), **Visual Preview quality** (a future, separate gate once a Preview Renderer exists — Stage D), **Publication output quality** (a future, separate gate once a Publication Renderer exists — Stage E). Core PASS does not imply Preview PASS. Preview PASS does not imply Publication PASS.

## 22. Performance gates

Not optimized prematurely; no caching complexity introduced in any Loop in this roadmap. Future measurement points to watch once real manuscript-scale data exists: normalization time, break-opportunity derivation time, line/column/page composition time, memory per manuscript size. Performance becomes a gate only once Stage C's comparison adapter runs against realistic manuscript sizes (not before) — no numeric threshold is set by this plan.

## 23. Privacy

Restated, not new: all Core development and fixture data is local; no manuscript upload; no network dependency (INV-012); fixtures are synthetic/approved regression prose, not real user manuscripts. Consistent with Master §12.1/§20.3.

## 24. Known risks

See `CORE_IMPLEMENTATION_RISK_REGISTER.md` for the full table (10 risks: Unicode/offset mismatch, grapheme segmentation inconsistency, incomplete rule table, floating-point leakage, measurement-provider instability, ruby-segment-model narrowness, renderer-reflow drift, legacy-capacity-assumption leakage, PoC-as-production drift, overlarge Loops). Highest-priority: floating-point leakage and Unicode/offset mismatch, both because they fail silently rather than loudly.

## 25. Implementation start criteria

P3-L04 may begin once: (a) this plan and its four companion documents are reviewed/accepted (no code implication in that review — it is a planning-artifact review), and (b) the single test-runner dependency (Vitest) is explicitly Human-approved for install (`P3_CORE_LOOP_ROADMAP.md` pre-requisite section) — the one dependency-install decision in the entire roadmap, deliberately isolated so it is not buried inside a larger implementation change.

## 26. Explicit non-goals (of this plan, and of P3-L04–P3-L15 collectively)

- No Renderer (Preview or Publication) technology is selected or implemented.
- No `src/` file is modified.
- No dependency is installed by this planning Loop (P3-L03).
- No PDF/JPG byte output exists anywhere in this roadmap's scope.
- Jukugo auto-segmentation (P3-O14), group-ruby's distinct rule (P3-O15), TCY auto-detection (P3-O07), exact ruby-overhang values (P3-O06 residual), and Publication/Preview renderer selection (P3-O08/O09) are not resolved by this roadmap — they are safely deferred, not silently closed.
- Old engine retirement is not scheduled.
- Master is not modified or incremented by this Loop.

---

## PoC reuse policy

Phase 2 prototype material under `typesetting-v2/prototypes/phase2-typography-poc/` is classified, not bulk-adopted:

- **EVIDENCE ONLY** — the PoC's demonstrated feasibility of C1-NATURAL, source-mapping (P2-L05), and determinism (byte-identical repeated runs). Informs confidence in this plan's direction; contributes no code.
- **TEST FIXTURE CANDIDATE** — any PoC manuscript sample that already exercises a phenomenon on the F01–F20 list is a candidate *input text* for that fixture, re-authored/trimmed as needed — never imported as executable code.
- **ALGORITHM REFERENCE** — the PoC's kinsoku/ruby-boundary handling logic may be read for approach inspiration when implementing `breaks/opportunity.ts` or `ruby/`, but re-written against the frozen Contract's actual types (the PoC predates INV-001–013 and the `GeometryTick` precision hardening, so its code shape does not match the current contract).
- **SAFE TO PORT** — none identified. No PoC source file is imported verbatim into `typesetting-v2/core/` by this plan; PoC success (Human QA PASS in Phase 2) demonstrated the *direction*, not production-grade, Contract-conformant code.

No PoC code is copied into implementation during P3-L03 (this Loop) or authorized to be copied verbatim by any future Loop in `P3_CORE_LOOP_ROADMAP.md`.
