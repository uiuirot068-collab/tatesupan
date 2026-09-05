# Core Test Strategy

- Status: **P3-L04: IN PROGRESS (2026-09-06).** **Vitest dependency gate: CLOSED — approved by Product Owner (2026-09-06) and installed** as the zeroth step of P3-L04 (`P3_CORE_LOOP_ROADMAP.md` pre-requisite section). `vitest@^3.2.7` was installed rather than the newest 3.x-successor major (`vitest@5`), because `vitest@5` requires `@types/node >=22.0.0` while the root project pins `@types/node@^20` — installing 5.x would have forced an unrelated, unapproved `@types/node` bump. `vitest@3.2.7` is the latest release compatible with `@types/node ^20` under the repo's current Node/TypeScript baseline. A transitive `nanoid` high-severity advisory (GHSA-2v37-7h3g-55p8, dev-only) surfaced on install and was resolved via `npm audit fix` (0 vulnerabilities remain). `npx vitest run` and `npx tsc --noEmit` both execute against `typesetting-v2/core/`; see `P3_CORE_LOOP_ROADMAP.md` for per-Loop progress.

## 1. Test tooling audit (read-only, current state)

Read-only inspection of the repo root (`package.json`, `tsconfig.json`) found:

- **No test runner installed.** No `jest`, `vitest`, `mocha`, or equivalent in `dependencies`/`devDependencies`. No `*.test.*` or `*.spec.*` files anywhere outside `node_modules`. No `jest.config.*`/`vitest.config.*`.
- `tsconfig.json` already `include`s `**/*.ts` repo-wide (not scoped to `src/`), `strict: true`, `noEmit: true` — so `npx tsc --noEmit` **already works today** as a zero-install type-check gate over anything placed under `typesetting-v2/core/`. This is available immediately, with no dependency change, and should be the first automated gate in every Loop even before a real test runner is approved.
- The app is Next.js 16 / React 19 / TypeScript 5, ESM (`"module": "esnext"`, `"moduleResolution": "bundler"`).

**Recommended runner: Vitest.** Rationale: native ESM + TS support with no transpile config needed (matches this repo's `moduleResolution: "bundler"`), fast, minimal footprint, does not require jsdom/browser environment for pure-function Core tests (Core has zero DOM dependency by contract, so a `node` test environment suffices), and is the most common modern choice for a Next.js + TS repo that has no existing test infrastructure to conflict with.

**Dependency install performed in this Loop (P3-L04): YES**, per explicit Product Owner approval recorded 2026-09-06 (`vitest@^3.2.7` in `devDependencies`, `test`/`test:watch` scripts added to `package.json`, `vitest.config.ts` added at repo root scoping `include` to `typesetting-v2/core/**/*.test.ts`). `@vitest/coverage-v8` was not installed — not needed by any Loop's acceptance criteria yet; add it only if a future Loop's coverage requirement calls for it, as its own decision.

## 2. Test levels

| Level | What it covers | Depends on runner? | When it starts |
|---|---|---|---|
| Type-check | Every module boundary in `CORE_MODULE_MAP.md` compiles under `strict: true`; no forbidden import (DOM/Canvas/PDF/React/UI/SNS/cloud/AI) anywhere under `core/` | No — `tsc --noEmit` | P3-L04 |
| Unit | Pure-function behavior of one module in isolation (e.g. `mmToTicks`, `cl08PairRule`, `assertGraphemeSafeBoundary`) | Yes | P3-L04 |
| Fixture | A named F0x scenario run through the relevant module(s), asserting structural/numeric output | Yes | P3-L05 onward |
| Golden/snapshot | A stable JSON shape frozen and diffed on change (see §4, Golden-Output Policy) | Yes | P3-L07 onward (BreakOpportunity/Decision shapes), P3-L15 (full CanonicalDocument) |
| Determinism | Same input run twice ⇒ byte/integer-identical output | Yes | P3-L07 (opportunity), P3-L08 (measurement), P3-L09 (line), P3-L15 (full document) |
| Source-mapping | Every LogicalUnit/PlacedUnit's SourceSpan survives a transformation unmodified | Yes | P3-L05 onward |
| Invariant/property-style | Directly names an INV-0xx ID and asserts it holds across the fixture set that exercises it | Yes | Per-Loop, see `P3_CORE_LOOP_ROADMAP.md`'s "Invariant(s) tested" column |
| Failure/HOLD | Malformed input produces the correct `LayoutError`/`hold` state, never a silent PASS or a thrown exception that crashes composition | Yes | P3-L14 |
| 8-preset logical | Each of the 8 mandatory presets' `LayoutSettings` produces a valid `CanonicalDocument` at the logical level (no rendering) | Yes | P3-L15 |
| Human visual QA | A person judges rendered output | N/A — not a runner-level test | Not before a Preview Renderer exists (see §5) |
| Publication QA | A person judges PDF/print output | N/A | Not before a Publication Renderer exists (see §5) |

## 3. What is explicitly NOT screenshot-tested

Pure Core development never asserts against: browser DOM shape, pixel screenshots, or renderer raster output. `CanonicalDocument` output is data (JSON-shaped, integer-tick geometry) — comparable exactly, not with epsilon/visual tolerance. This mirrors Contract §20's own statement that renderer DOM/PDF-object shape is never canonical.

## 4. Golden-output policy

**May be frozen as golden/snapshot:**
- Normalized `LogicalUnit[]` for a given fixture input
- `BreakOpportunity[]` / `BreakDecision[]`
- `LayoutDecisionTrace` (semantic content — rule id, alternatives, outcome; not free-text wording that might be refactored)
- Page/column/line assignment shape (which `PlacedUnit` landed in which `CanonicalLine`/`CanonicalColumn`/`CanonicalPage`)
- `PlacedUnit.xTick`/`yTick` and all other `GeometryTick` fields
- `SourceSpan` mappings
- `LayoutWarning`/`LayoutError`/`hold` output

**Must NOT be frozen as golden during Core implementation:** browser DOM, pixel screenshots, renderer raster output, any PDF byte sequence.

**Golden update discipline:** a snapshot diff must be reviewed line-by-line before being accepted — **"update snapshots until tests pass" is never an acceptable workflow step in this roadmap.** A snapshot change that isn't traceable to an intentional Contract/RuleSetVersion change is a regression, not a refresh.

## 5. Human visual QA boundary vs. Publication QA boundary

- **Pure Core Loops (P3-L04–P3-L14): no Human visual QA.** There is nothing visual to judge yet — output is JSON/trace data.
- **P3-L15 (Gate G1):** first meaningful Human Gate — a person reviews the diagnostic trace/JSON dump for representative fixtures. They judge whether *logical* decisions look right (did kinsoku push the right character, did jukugo break where segments said it could, is residual space reported rather than stretched). They are explicitly **not** judging any rendered glyph, font, or pixel — none exists at this stage.
- **First Preview Renderer (future, P3-O09 stage, outside this roadmap):** first point Human visual QA of actual painted output becomes meaningful.
- **Publication/PDF output (future, P3-O08 stage, outside this roadmap):** Publication QA boundary — a distinct, later gate; Core PASS and Preview PASS do not imply Publication PASS (`P3_CORE_IMPLEMENTATION_PLAN.md` §21).

## 6. Regression corpus alignment

The F01–F20 taxonomy (`P3_CORE_IMPLEMENTATION_PLAN.md` §10) is a Core-level, logical-assertion re-expression of the existing `typesetting-v2/fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md` 23-category corpus — that spec already anticipates this split explicitly (its own §3: "automated checks (Phase 3+) verify logical/data-level guarantees... not pixel identity"). The long Human-QA prose corpus referenced there (once assembled) stays a **separate artifact** from the F-series technical fixtures — F-series fixtures are short, synthetic, and purpose-built to isolate one phenomenon each; the long prose corpus is for later Human visual comparison across renderers and is never used as a golden-snapshot input during Core development.
