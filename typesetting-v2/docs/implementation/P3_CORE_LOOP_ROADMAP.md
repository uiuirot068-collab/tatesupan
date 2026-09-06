# P3 Core Implementation Loop Roadmap

- Status: **P3-L04 through P3-L15: ALL AUTOMATED WORK CLOSED (2026-09-06, hardening applied at P3-L05A/P3-L06A). HUMAN GATE G1: PENDING.** Defines every Loop from the first Core source file through the Canonical multi-page Core regression milestone. Vitest dependency gate CLOSED (see pre-requisite section immediately below). **Re-scoping note:** at execution time, Product Owner instructions renumbered every Loop from the original P3-L09 through P3-L14: original L06+L07 merged into executed **P3-L06**; original L09 (+L08 measurement, absorbed as a prerequisite) → executed **P3-L07**; original L10 → executed **P3-L08**; original L11 (Ruby) → executed **P3-L09**; original L12 (TCY+SemanticRun) → executed **P3-L10**; original L13 (Images+Colophon) → executed **P3-L11**; original L14 (Warnings/Errors/HOLD+Versioning) → executed **P3-L12**. **P3-L15 (this section, below) executed under its own original, unrenumbered number** — `composeCanonicalDocument()` and `core/index.ts` are implemented, F01–F20 accounted for, all 8 presets sweep against real production capacity data, and the automated acceptance criteria all PASS. This document's own per-Loop section bodies below reflect the ORIGINAL numbering/scope and are superseded by each Loop's own status note and by `research/PHASE3_LOOP_LOG.md`, which records what was actually built — that log is the authoritative sequencing record from P3-L06 onward. **Nothing further proceeds until Human Gate G1 is answered** (`typesetting-v2/qa/human/P3_G1_CANONICAL_CORE_REVIEW.md`) — Master is not modified, Phase 3 is not closed, no `src/` integration occurs. `tsc --noEmit` and `vitest run` (170/170) pass — see `PHASE3_LOOP_LOG.md` and `typesetting-v2/qa/evidence/P3_G1_CANONICAL_CORE_EVIDENCE.md` for exact acceptance-criteria evidence.
- Every Loop ends with: tests PASS → scope audit (nothing outside `typesetting-v2/core/` and its docs/fixtures/tests changed) → Human Gate if marked YES → checkpoint commit (see `P3_CORE_IMPLEMENTATION_PLAN.md` §20).
- If the same implementation failure/workaround repeats 2–3 times inside one Loop: **stop the Loop, record the blocker in `research/PHASE3_LOOP_LOG.md`, do not keep looping.** This rule applies to every Loop below without being repeated per-row.
- No Loop below exceeds 90 minutes. None require a >120-minute opaque block; any Loop that starts to exceed 120 minutes in practice must be split into a new Loop ID, not extended.

## Pre-requisite: test runner dependency gate

**CLOSED (2026-09-06).** Product Owner explicitly approved installing a test runner as the zeroth step of P3-L04. `vitest@^3.2.7` was installed (not the newest `vitest@5`, which requires `@types/node >=22` — incompatible with this repo's pinned `@types/node@^20`; installing it would have forced an unrelated, unapproved dependency bump). A transitive `nanoid` high-severity advisory surfaced on install and was resolved with `npm audit fix` (0 vulnerabilities remain). `npm run test` (`vitest run`) and `npm run test:watch` are now available; `npx tsc --noEmit` remains the zero-install baseline gate run alongside it. See `CORE_TEST_STRATEGY.md` §1 for full detail.

---

### P3-L04 — Core Foundation

- **Status (2026-09-06): scaffolding complete, verifying against acceptance criteria.** `core/geometry/tick.ts`, `core/version/index.ts`, `core/source/span.ts`, `core/layout/schema.ts`, `core/settings/index.ts` written; `core/geometry/tick.test.ts` and `core/source/span.test.ts` added. `npx tsc --noEmit` and `npx vitest run` both pass (6/6 tests green). `layout/schema.ts`'s `CanonicalDocument` intentionally omits `trace`/`warnings`/`errors`/`hold` for now — those fields depend on modules (`trace/`, `diagnostics/`) that don't exist until P3-L07/P3-L14 per `CORE_MODULE_MAP.md`'s own allowed-deps table for this module (row 21: geometry/source-span/version only); adding them now would mean importing from modules that aren't there yet. Not yet done: the forbidden-import grep check and the final scope audit before checkpoint commit.
- **Goal:** Scaffold `typesetting-v2/core/`; implement `geometry/`, `version/`, `source/span.ts`, `layout/schema.ts` (types only), `settings/` (type only). Get `tsc --noEmit` and the newly-approved test runner both running green on an empty-but-real module tree.
- **Timebox:** 60 min.
- **Inputs:** `TATESPUN_V2_CORE_CONTRACT.md` §4/§16/§20/§21/§25, `TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md`, `CORE_MODULE_MAP.md` rows 1–3, 21, 24.
- **Files/modules expected to change:** new files only under `typesetting-v2/core/geometry/`, `core/version/`, `core/source/span.ts`, `core/layout/schema.ts`, `core/settings/`; new `typesetting-v2/core/__tests__/` (or co-located `*.test.ts`, runner-dependent).
- **Tests required:** `GeometryTick` arithmetic (integer-only, no float leakage — construct a test that would fail if `mmToTicks` returned a float), `mmToTicks()` round-trip against known values, `SourceSpan` shape sanity.
- **Invariant(s) tested:** INV-013 (integer ticks, never float canonical storage).
- **Acceptance criteria:** `tsc --noEmit` passes repo-wide (does not break existing `src/` type-check); test runner executes the above tests green; zero imports from `src/`, DOM, React, or any UI package anywhere under `core/`.
- **Human QA required:** NO.
- **Rollback boundary:** delete `typesetting-v2/core/` entirely; no other file touched.
- **Dependencies:** test-runner dependency gate (above) approved first.
- **Explicitly NOT included:** any LogicalUnit, any rule data, any composition logic.

---

### P3-L05 — Source Mapping + Grapheme Safety + LogicalUnit Foundation

- **Status (2026-09-06): CLOSED.** `core/source/graphemeSafety.ts` (+ `.test.ts`, 16 tests) and `core/units/*.ts` + `index.ts` (+ `index.test.ts`, 5 tests) implemented exactly per this entry's own spec below. `npx tsc --noEmit` and `npx vitest run` (27/27) both pass; zero forbidden imports (grep-verified); no `package.json`/lockfile/`vitest.config.ts` change. See `research/PHASE3_LOOP_LOG.md` P3-L05 entry for full evidence.
- **Goal:** Implement `source/graphemeSafety.ts` and the `LogicalUnit` discriminated union (`units/`) with only `TextUnit` fully exercised; declare (but do not yet implement composition for) the other five kinds so later Loops extend, not restructure, the union.
- **Timebox:** 75 min.
- **Inputs:** Contract §5/§6, INV-011, fixture F16.
- **Files/modules expected to change:** `core/source/graphemeSafety.ts`, `core/units/*.ts`.
- **Tests required:** F16 (surrogate pair / emoji ZWJ / variation sequence never split), code-point-length vs. UTF-16-length divergence case, a deliberately-adversarial "naive `string[i]` would break this" fixture.
- **Invariant(s) tested:** INV-011, INV-001 (span survives the type layer unmodified).
- **Acceptance criteria:** all six `LogicalUnit` kinds type-check as a discriminated union; grapheme-safety assertion rejects a deliberately-fractured test span; F16 passes.
- **Human QA required:** NO.
- **Rollback boundary:** revert `core/source/graphemeSafety.ts` and `core/units/`; `core/geometry`/`version`/`layout/schema` from P3-L04 untouched.
- **Dependencies:** P3-L04.
- **Explicitly NOT included:** RuleSetVersion/character classes, any break logic, ruby/TCY/semantic-run composition (types only, no behavior).

---

### P3-L06 — Japanese Rule Data + Character Classes

- **Status (2026-09-06): CLOSED — merged with the original P3-L07 below into one executed Loop** (Product Owner re-scoping; see roadmap header). `core/rules/characterClass.ts` (generic `buildCharacterClassLookup` algorithm + `CharacterClass`/`RuleSetVersion` types) and `core/rules/defaultRuleSet.ts` (`DEFAULT_RULE_SET_V2` data: cl-01/02/04/05/06/07/09/10/11/12/13, cl-08 `cl08PairRule`, `hangingPunctuationScope`, empty `rubyOverhangAllowance`) are implemented exactly per this entry's spec, encoding only classes with a READY row in `PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md` — the full 900-cell Table-2 grid remains OPEN and was not fabricated. 24 tests pass (`core/rules/defaultRuleSet.test.ts`). See `research/PHASE3_LOOP_LOG.md` P3-L06 entry for full evidence.
- **Goal:** Implement `rules/characterClass.ts` and `rules/defaultRuleSet.ts` — the full cl-01–cl-30 table as **data**, HG-1/HG-2 strict policy, cl-08 pair rule, hanging scope, zero-valued ruby-overhang table.
- **Timebox:** 60 min.
- **Inputs:** Contract §7, `PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md`, P3-O01 (READY), P3-O06 (READY for capability, values OPEN).
- **Files/modules expected to change:** `core/rules/characterClass.ts`, `core/rules/defaultRuleSet.ts`.
- **Tests required:** F04 (cl-05 strict prohibition), F05 (cl-12/13 strict prohibition), cl-08 pair-rule unit tests (same-kind inseparable / different-kind separable) directly against the jlreq-sourced worked example.
- **Invariant(s) tested:** none new directly, but this is the data every later break-opportunity invariant depends on (regression risk if wrong: silent, so test coverage here is high-value).
- **Acceptance criteria:** `DEFAULT_RULE_SET_V2` is loadable, its cl-05/cl-12/cl-13 `mayStartLine` flags are `false` (HG-1/HG-2), `rubyOverhangAllowance` is present but all-zero (not omitted — the *capability* must exist per HG-4).
- **Human QA required:** NO (values already Human-approved at P3-L01; this Loop only encodes them as data).
- **Rollback boundary:** revert `core/rules/`; nothing else depends on it yet.
- **Dependencies:** P3-L04.
- **Explicitly NOT included:** break-opportunity derivation (consumes this data next Loop), any non-zero ruby-overhang value (still OPEN, P3-O06 residual).

---

### P3-L07 (original numbering) — Break Opportunity Derivation

- **Status (2026-09-06): CLOSED — executed together with P3-L06 above as one combined Loop.** `core/breaks/opportunity.ts` (`deriveBreakOpportunities`, covering TEXT internal kinsoku, cl-08 semantic-run pairing, RubyUnit JUKUGO declared-segment boundaries, MANUAL_BREAK forcing) and `core/trace/` (`TraceEvent`/`LayoutDecisionTrace`/`createTraceRecorder`) are implemented. Also went beyond this entry's original scope at Product Owner's direction: a capacity-independent `core/breaks/decision.ts` (`deriveManualBreakDecisions`, INV-006) was added — the original roadmap deferred all `BreakDecision` work to a later Loop, but the manual-forced case needs no capacity math, so it was pulled forward rather than left half-designed. Every `BreakOpportunityReason` value is reached by at least one test; trace-on/trace-off byte-identical output is verified. 17+3=20 tests pass (`core/breaks/opportunity.test.ts`, `core/breaks/decision.test.ts`). The Loop that is now renumbered **P3-L07** (see roadmap header) is the original P3-L09 (Natural-Pitch Line Composer + Break Decision) — its own capacity-dependent `BreakDecision` work (`CAPACITY_REACHED`, `HANGING_DEFERRAL`) remains fully unstarted. See `research/PHASE3_LOOP_LOG.md` P3-L06 entry for full evidence (both original Loops are recorded together there, matching how they were executed).
- **Goal:** Implement `breaks/opportunity.ts` (pure function over TEXT units + the default RuleSetVersion) and `trace/` (recorder, observational-only property enforced by test), plus the cl-08 opportunity rule for `semanticRuns/`.
- **Timebox:** 75 min.
- **Inputs:** Contract §8/§23, `CORE_INVARIANTS.md`.
- **Files/modules expected to change:** `core/breaks/opportunity.ts`, `core/trace/`, `core/semanticRuns/` (opportunity logic only).
- **Tests required:** F01 (plain prose, mostly `ALLOWED`), F02 (line-start prohibited punctuation → `PROHIBITED_KINSOKU`), F03 (line-end prohibited opening bracket → `PROHIBITED_KINSOKU`), F11/F12 (dash/ellipsis same-kind → `PROHIBITED_GROUP`), a trace-on-vs-trace-off determinism test.
- **Invariant(s) tested:** INV-005 (partial — opportunity derivation is deterministic), the "tracing is observational" property named in Contract §23.
- **Acceptance criteria:** every `BreakOpportunityReason` value is reachable by at least one fixture; disabling trace recording produces byte-identical `BreakOpportunity[]` output.
- **Human QA required:** NO.
- **Rollback boundary:** revert `core/breaks/opportunity.ts`, `core/trace/`, `core/semanticRuns/`.
- **Dependencies:** P3-L05, P3-L06.
- **Explicitly NOT included:** actual `BreakDecision`-making (capacity-aware line filling — next stage), ruby-internal opportunities (P3-L11), TCY (P3-L12).

---

### P3-L08 — Measurement Boundary + Fake Provider

- **Goal:** Implement `measurement/facts.ts` (interface) and `measurement/fakeProvider.ts` (deterministic fixture-backed implementation).
- **Timebox:** 45 min.
- **Inputs:** Contract §17, INV-009.
- **Files/modules expected to change:** `core/measurement/`.
- **Tests required:** same inputs → same `naturalAdvanceTick`/`rubyReadingExtentTick`/`imageIntrinsicTick` outputs across repeated calls; a documented fixture-value table (e.g. "10mm font size → 10000 ticks normal advance") that later Loops' fixtures cite by name rather than re-deriving.
- **Invariant(s) tested:** INV-005 (measurement determinism), INV-009 groundwork (no live-recompute path exists in the fake provider by construction).
- **Acceptance criteria:** fake provider is the only `MeasurementFacts` implementation in the codebase; no font-shaping/browser/canvas call exists anywhere under `core/`.
- **Human QA required:** NO.
- **Rollback boundary:** revert `core/measurement/`.
- **Dependencies:** P3-L04 (geometry).
- **Explicitly NOT included:** any real font/browser measurement adapter (P3-O08/O09 territory, explicitly out of Core scope, Contract §17/§29).

---

### P3-L09 — Natural-Pitch Line Composer + Break Decision

- **Goal:** Implement `breaks/decision.ts` and `compose/line.ts` for TEXT-only content: capacity-aware line filling, `residualSpaceTick`, decision-trace wiring, determinism end-to-end for a single line/column.
- **Timebox:** 90 min (largest single-concept Loop in the roadmap; split into P3-L09a/b if kinsoku-edge handling is not stable by minute 90 — do not silently extend).
- **Inputs:** Contract §8/§18/§19/§23/§24, `pageLayout.ts`'s capacity-formula family (read-only reference, not imported).
- **Files/modules expected to change:** `core/breaks/decision.ts`, `core/compose/line.ts`, `core/settings/` (ingestion function now used, not just typed).
- **Tests required:** F01–F05, F18 (capacity/residual margin case), a repeated-run byte-identical determinism test (mirrors the Phase 2 P2-L05 evidence bar).
- **Invariant(s) tested:** INV-004 (no page-fill stretch, residual reported not absorbed), INV-005 (full determinism), INV-013 (all coordinates integer ticks).
- **Acceptance criteria:** a full column of F01-style prose fills to capacity and reports residual space rather than stretching pitch; F04/F05 kinsoku decisions match P3-L07's opportunities exactly (no re-derivation, no divergence).
- **Human QA required:** NO.
- **Rollback boundary:** revert `core/breaks/decision.ts`, `core/compose/line.ts`; settings ingestion function reverts to type-only.
- **Dependencies:** P3-L07, P3-L08.
- **Explicitly NOT included:** ruby, TCY, images, multi-column/page assembly (single line/column scope only), hanging punctuation (defer to this Loop's follow-up only if time allows — otherwise its own micro-Loop before P3-L10).

---

### P3-L10 — Column + Page Composition

- **Goal:** Implement `compose/column.ts` and `compose/page.ts`: multi-column filling (§20 CASE 8), manual page break (`MANUAL_FORCED`), folio page-decoration stub.
- **Timebox:** 75 min.
- **Inputs:** Contract §13/§15/§19/§20, INV-006.
- **Files/modules expected to change:** `core/compose/column.ts`, `core/compose/page.ts`.
- **Tests required:** F13 (manual page break, forced regardless of remaining capacity), F15 (two-column layout, independent residual tracking per column, identical rule application in both columns).
- **Invariant(s) tested:** INV-006 (manual break always traceable and forced), INV-001 (source mapping survives page assembly).
- **Acceptance criteria:** F13's break occurs even when the column is under capacity, residual space is retained not stretched; F15's two columns apply identical kinsoku/hanging rules with independently-tracked residual.
- **Human QA required:** NO.
- **Rollback boundary:** revert `core/compose/column.ts`, `core/compose/page.ts`.
- **Dependencies:** P3-L09.
- **Explicitly NOT included:** ruby/TCY/images/colophon (still TEXT-only through page level).

---

### P3-L11 — Ruby Composition (Atomic + Jukugo)

- **Goal:** Implement `ruby/` — break-opportunity mapping for `ATOMIC` and `JUKUGO`, base-position invariant, geometry-clamp placement layered with the (zero-valued) overhang table.
- **Timebox:** 90 min.
- **Inputs:** Contract §9/§9.1, INV-003/007/008, P3-O14 (segmentation stays upstream — an un-segmented `JUKUGO` candidate defaults to `ATOMIC`).
- **Files/modules expected to change:** `core/ruby/`, `core/breaks/opportunity.ts` (extended to call into `ruby/` for `RUBY` units).
- **Tests required:** F07 (atomic/group ruby, fully unbroken), F08 (jukugo with explicit `segments`, legal internal breaks only at segment boundaries), F09 (overlong ruby, geometry clamp engaged), a "no `segments` array provided" test asserting `ATOMIC` fallback (never a guessed split).
- **Invariant(s) tested:** INV-003 (base position identical to no-ruby coordinates, 0-tick delta), INV-007 (atomic never internally breaks), INV-008 (jukugo breaks only at declared boundaries).
- **Acceptance criteria:** F07/F08/F09 all pass; the missing-`segments` fallback test proves the Core never invents a split.
- **Human QA required:** NO (optionally, a diagnostic trace dump may be spot-checked informally given HG-3/HG-4's Product sensitivity, but this is not a blocking gate — no Preview/Publication renderer exists yet to make a visual judgment meaningful).
- **Rollback boundary:** revert `core/ruby/`; `breaks/opportunity.ts`'s `RUBY` extension point reverts to a no-op stub.
- **Dependencies:** P3-L07 (opportunity derivation), P3-L06 (overhang table shape).
- **Explicitly NOT included:** group-ruby's distinct break rule (P3-O15, still OPEN — continues to be treated identically to atomic mono-ruby, not designed further here), non-zero overhang values (P3-O06 residual, still OPEN).

---

### P3-L12 — TCY + Semantic Run Line-Composer Integration

- **Goal:** Implement `tcy/` and wire both `tcy/` and P3-L07's existing `semanticRuns/` opportunity logic fully into `compose/line.ts`'s capacity math.
- **Timebox:** 60 min.
- **Inputs:** Contract §10/§11, P3-O07/O03/O04/O05 (all explicitly non-blocking per Contract §29 boundary).
- **Files/modules expected to change:** `core/tcy/`, `core/compose/line.ts` (extended).
- **Tests required:** F10 (explicit TCY unit, one logical-cell-consuming atomic group for capacity purposes).
- **Invariant(s) tested:** none new; exercises INV-005 determinism against a richer unit mix.
- **Acceptance criteria:** F10 passes; explicit TCY requires no auto-detection logic (P3-O07 stays out of scope, per Contract §10).
- **Human QA required:** NO.
- **Rollback boundary:** revert `core/tcy/`; `compose/line.ts` reverts to its P3-L09 TEXT-only state.
- **Dependencies:** P3-L09, P3-L07.
- **Explicitly NOT included:** TCY auto-detection (P3-O07), any visual combine/rotation (P3-O03, Renderer-only).

---

### P3-L13 — Images + Colophon + Structured Elements

- **Goal:** Implement `images/` (flow placement) and `colophon/` (`ColophonBlock` as a distinct `CanonicalDocument`-level element, isolated from body pagination).
- **Timebox:** 75 min.
- **Inputs:** Contract §14/§15, Master HD-006, `TSP-LOOP-005` colophon isolation precedent (memory: `tsp-loop-005-colophon`).
- **Files/modules expected to change:** `core/images/`, `core/colophon/`.
- **Tests required:** F14 (image block — fits-capacity check, break-before/after), a colophon fixture asserting it does **not** appear inside any body `CanonicalColumn`/`CanonicalLine`.
- **Invariant(s) tested:** INV-001 (image/colophon source spans survive), the §15 structural separation (manuscript-flow vs. page-decoration vs. colophon — three categories, never mixed).
- **Acceptance criteria:** F14 passes; colophon fixture's `ColophonBlock.pages` is populated independently of `CanonicalDocument.pages`.
- **Human QA required:** NO.
- **Rollback boundary:** revert `core/images/`, `core/colophon/`.
- **Dependencies:** P3-L10 (page composition), P3-L08 (image intrinsic measurement).
- **Explicitly NOT included:** image decode/paint (Renderer-only, Contract §14/§28).

---

### P3-L14 — Warnings / Errors / HOLD + Versioning Metadata

- **Goal:** Implement `diagnostics/` (`LayoutWarning`, `LayoutError`, `computeHold()`) and wire `VersionMetadata` (`coreSchemaVersion`/`ruleSetVersion`/`settingsVersion`/`measurementIdentity`) into the assembled `CanonicalDocument`.
- **Timebox:** 60 min.
- **Inputs:** Contract §25/§26, INV-010.
- **Files/modules expected to change:** `core/diagnostics/`, `core/layout/assemble.ts` (version wiring only — full assembly is P3-L15).
- **Tests required:** F17 (malformed notation / HOLD case) — asserts `CanonicalDocument.hold === true` and the triggering `LayoutError` is present, not silently downgraded to a `LayoutWarning`.
- **Invariant(s) tested:** INV-010.
- **Acceptance criteria:** F17 passes; a document with zero errors/serious warnings has `hold === false`; version metadata fields are all populated and non-empty on every assembled document.
- **Human QA required:** NO.
- **Rollback boundary:** revert `core/diagnostics/`.
- **Dependencies:** P3-L06 (ruleSetVersion id), P3-L08 (measurementIdentity), P3-L04 (settingsVersion, coreSchemaVersion).
- **Explicitly NOT included:** exact HOLD-triggering thresholds beyond the F17 malformed case (Contract §26 explicitly defers exhaustive threshold design to implementation time — this Loop implements the mechanism, not every possible trigger).

---

### P3-L15 — Canonical Regression Suite / 8-Preset Logical Verification (Core milestone)

- **Status (2026-09-06): AUTOMATED WORK CLOSED. HUMAN GATE G1: PENDING.** `core/layout/assemble.ts`'s `composeCanonicalDocument()` and `core/index.ts` implemented; F19/F20 (verbatim from `REGRESSION_CORPUS_SPEC.md` §1) and an 8-preset sweep (real production `charsPerLine`/`linesPerColumn`/`fontSizePt` from `src/constants/paperSizes.ts`, read-only) all pass. The "minimal local diagnostic viewer" deliverable was produced as two static evidence documents (`typesetting-v2/qa/human/P3_G1_CANONICAL_CORE_REVIEW.md`, `typesetting-v2/qa/evidence/P3_G1_CANONICAL_CORE_EVIDENCE.md`) rather than an interactive tool, given this Loop's timebox — no manuscript upload, static/local, matching the deliverable's actual requirement. 170/170 tests pass. See `research/PHASE3_LOOP_LOG.md`'s P3-L15 entry for full evidence. **No Human answer has been filled in; Master is unmodified; Phase 3 is not closed.**
- **Goal:** Implement `layout/assemble.ts` (`composeCanonicalDocument`, the full orchestration) and `index.ts` (public entry point); run F19/F20 plus an 8-preset settings sweep at the logical level; build the minimal local diagnostic viewer (JSON/trace dump, static/local, no manuscript upload) used for the Human Gate below.
- **Timebox:** 90 min.
- **Inputs:** every prior Loop's module; `CURRENT_PRODUCT_COMPATIBILITY_MATRIX.md` for the 8 mandatory presets' settings values.
- **Files/modules expected to change:** `core/layout/assemble.ts`, `core/index.ts`, a new `typesetting-v2/tools/core-trace-viewer/` (or equivalent local diagnostic script — see `P3_CORE_IMPLEMENTATION_PLAN.md` §16).
- **Tests required:** F19 (long prose, multi-page, deterministic page-break points), F20 (canonical regression sentence — the pre-v2 hard case, Master §0 motivation — logical-level only, no pixel comparison), one `composeCanonicalDocument` run per mandatory preset asserting it produces a valid (non-`hold`, unless intentionally malformed) `CanonicalDocument`.
- **Invariant(s) tested:** every INV-001 through INV-013, run together for the first time end-to-end (a regression net, not new coverage).
- **Acceptance criteria:** all 20 F-series fixtures pass in one suite run; all 8 presets produce a valid `CanonicalDocument`; determinism holds across a repeated full-document run (byte/integer-identical).
- **Human QA required:** **YES — see `P3_CORE_IMPLEMENTATION_PLAN.md` §15 Gate G1.** What the Human reviews: the diagnostic trace/JSON dump for a representative subset of fixtures (kinsoku decisions, jukugo-ruby segment breaks, capacity/residual behavior) — logical correctness only, no rendering exists yet to judge.
- **Rollback boundary:** revert `core/layout/assemble.ts`, `core/index.ts`, the trace viewer tool; every module below it (P3-L04–P3-L14) is independently unaffected and already checkpointed.
- **Dependencies:** all of P3-L04–P3-L14.
- **Explicitly NOT included:** any Renderer (Preview or Publication), any `src/` integration, any PDF/JPG output. This Loop is the **integration-gate entry point** (`P3_CORE_IMPLEMENTATION_PLAN.md` §18), not integration itself.

---

## Summary table

| Loop | Name | Timebox | Human QA | Depends on |
|---|---|---|---|---|
| P3-L04 | Core Foundation | 60m | NO | test-runner gate |
| P3-L05 | Source Mapping + Grapheme Safety + LogicalUnit | 75m | NO | L04 |
| P3-L06 | Japanese Rule Data + Character Classes | 60m | NO | L04 |
| P3-L07 | Break Opportunity Derivation | 75m | NO | L05, L06 |
| P3-L08 | Measurement Boundary + Fake Provider | 45m | NO | L04 |
| P3-L09 | Natural-Pitch Line Composer + Break Decision | 90m | NO | L07, L08 |
| P3-L10 | Column + Page Composition | 75m | NO | L09 |
| P3-L11 | Ruby Composition | 90m | NO | L06, L07 |
| P3-L12 | TCY + Semantic Run Integration | 60m | NO | L07, L09 |
| P3-L13 | Images + Colophon | 75m | NO | L08, L10 |
| P3-L14 | Warnings/Errors/HOLD + Versioning | 60m | NO | L04, L06, L08 |
| P3-L15 | Canonical Regression Suite (milestone) | 90m | **YES (Gate G1)** | all above |

Twelve Loops, first-source-file to Canonical Core regression milestone. Maximum single-Loop timebox: 90 minutes. None exceed 120 minutes.
