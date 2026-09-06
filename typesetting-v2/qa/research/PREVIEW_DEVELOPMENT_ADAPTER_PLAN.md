# TateSpun v2 Preview Development Adapter Plan

- Status: **PLANNING / RESEARCH ONLY. No implementation performed. Human decisions recorded 2026-09-06 (see §0). IMPLEMENTATION: DEFERRED UNTIL AFTER STAGE C.**
- Preflight: branch `design/tatespun-typesetting-v2`, HEAD `725dd8fd45cc40979ee75c13124615ebd1c6248c` (matches expected checkpoint), worktree clean before and after this Loop.
- This document is a **descriptive planning label, not a frozen roadmap Loop ID**: `PREVIEW-ADAPTER-PLAN`. See §2 for why no P3-L/P3-O number was invented.

## 0. Human Decisions Recorded (2026-09-06)

The four decisions raised in §18 have been answered by the Product Owner. This section is the authoritative record; §18 is left below unmodified as the original planning-time framing of the questions asked.

**Decision 1 — Sequencing: APPROVED, follow the frozen migration roadmap.** Stage C (non-Production logical-only comparison harness) comes **before** the visual Preview Adapter / Stage D. The Preview Adapter is **not implemented in this Loop or before Stage C**. Reason (Product Owner): old-engine-vs-Core logical differences must be isolated before introducing renderer/paint differences — conflating the two would make it unclear whether a divergence a reviewer sees is a logical regression or a paint artifact.

**Decision 2 — Ruby placement wiring: APPROVED, do not fix as a Stage C prerequisite.** The `placeRuby()` wiring gap (§3 gap 3, §9) is **not** required to be fixed before Stage C begins. Stage C may compare ruby's logical/body flow (base+reading association, jukugo segment boundaries, break behavior) while explicitly recording annotation *placement* geometry as incomplete — this is a disclosed, known gap, not a blocker for a logical-only diff tool that isn't painting anything. After Stage C completes, evaluate a dedicated Ruby-placement Core micro-loop before Stage D (the first stage that actually paints a reading annotation). **Exception, recorded per Product Owner instruction and binding on whoever executes Stage C:** if Stage C's own work discovers that the missing wiring invalidates the logical comparison itself (e.g., because ruby's composed extent depends on a placement decision Stage C needs to diff), that Loop must **stop and raise it as a prerequisite blocker** — it must not silently patch `compose/line.ts` to route around it mid-Stage-C.

**Decision 3 — Future adapter architecture: APPROVED for future Stage D, not implemented now.** React DOM absolute-positioned development adapter (§6/§15, Option A), lifecycle DISPOSABLE-implementation / EVOLUTIONARY-ideas-and-contracts (§15), ownership boundary `CanonicalDocument` + read-only `LogicalUnit[]` lookup → paint only (§4), with the same MUST-NOT list already recorded in §4 (no re-tokenize, no re-layout, no break/capacity decisions, no remeasure-and-feed-back). Reusable concepts confirmed: input contract shape (§4), GeometryTick→visual one-way conversion (§7), debug overlays (§11), QA fixture model (§12). **No adapter code, component, or route is created by this decision** — this is architecture pre-approval for whenever Stage D is actually scheduled, not an authorization to build now.

**Decision 4 — Human QA fixture: APPROVED, use both.** (1) The canonical regression sentence — 「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」 — and (2) the long, non-repeating fixture at `prototypes/ui-comparison/shared/content.js`'s `MANUSCRIPT_TEXT`. Repeated filler prose (e.g. F19's test-only `"あいうえお...".repeat(4)`) is confirmed **not** a substitute for either, per §12's own finding.

**Roadmap position, restated per this checkpoint:** next actual frozen roadmap stage is **Stage C** (`CORE_MIGRATION_ROLLBACK_PLAN.md` §1/§2 — a non-Production, logical-only comparison harness between the current/legacy typesetting behavior and the v2 Canonical Core: page count, break positions, column assignment; no rendering). The Preview development adapter corresponds to **Stage D** (later visual comparison work), sequenced after Stage C. No numeric P3-L identifier is invented for either.

**Open items, explicitly kept unchanged by this checkpoint (none are closed or silently resolved here):** P3-O03, P3-O04, P3-O05, P3-O06, P3-O08, P3-O09 all remain OPEN; F06 remains DEFERRED. The ruby-placement wiring gap (§3 gap 3) is recorded as a **KNOWN PRE-STAGE-D REVIEW ITEM** — not closed, not silently fixed, to be evaluated as its own micro-loop after Stage C per Decision 2.

---

## 1. Executive Summary

The v2 Canonical Core (the "brain" that decides where every character, ruby annotation, and page break goes) is built, tested, and Human-approved (Gate G1, 2026-09-06). Nothing can see it yet — there is no visual tool that turns its output into a picture a person can look at. This document plans a small, **disposable, dev-only** tool that paints the Core's decisions on screen well enough for a person to sanity-check them side-by-side with the current live app — without that tool becoming a second typesetting engine by accident.

The single most important finding: the frozen migration plan (`CORE_MIGRATION_ROLLBACK_PLAN.md`) already names the step that comes right after where the project stands today, and it is **not** a visual tool. It is **Stage C**, a numbers-only comparison (does the new Core produce the same page count and break points as the old app, for the same manuscript?) with no rendering at all. A visual "Preview Development Adapter" corresponds to the frozen plan's **Stage D**, which is explicitly sequenced *after* Stage C. Building the visual adapter now, before Stage C exists, is not forbidden, but it is a sequencing question for the Human to decide explicitly (§16) — this plan does not decide it silently.

The second most important finding: the Core's own output format (`CanonicalDocument`) is missing two things a painter needs — which *kind* of thing each placed piece is (plain text vs. ruby vs. TCY vs. image), and its actual text content. Both are recoverable without the adapter re-doing any of the Core's job, by also handing the adapter the same input list of manuscript pieces (`LogicalUnit[]`) that was fed into the Core, purely as a read-only lookup table. A third finding, more serious: the Core's own ruby-placement math (`core/ruby/index.ts`) is fully written and tested, but nothing currently calls it during composition — today's `CanonicalDocument` places a whole ruby group as one plain block with no record of where the small reading text should sit. This is a gap in the Core itself, not something the adapter should paper over by inventing its own ruby placement rule.

Recommendation: build a minimal **React DOM, absolutely-positioned** adapter (Option A) — not SVG, not Canvas — because it is the cheapest way to get inspectable, per-unit debug overlays working, and because the team already has DOM/React fluency from the current Editor. Keep it strictly disposable-in-spirit: assume it will be thrown away or heavily rewritten once real Preview Renderer technology (P3-O09) is chosen, and design nothing in it that the final Renderer would be sad to inherit.

---

## 2. Frozen Roadmap Position

**Direct-read sources:** `docs/implementation/P3_CORE_LOOP_ROADMAP.md`, `research/PHASE3_LOOP_LOG.md`, `docs/architecture/PHASE3_OPEN_ITEMS.md`, `docs/implementation/P3_CORE_IMPLEMENTATION_PLAN.md` §14-18, `docs/implementation/CORE_MIGRATION_ROLLBACK_PLAN.md` (all sections).

**Where the project actually stands:**
- P3-L04 through P3-L15 (+ P3-L15A gap closure): **CLOSED**, 174/174 → 265/265 tests passing as of `8e64fbc`/`725dd8f`.
- Human Gate G1: **PASS, 9/9 YES** (`qa/human/P3_G1_CANONICAL_CORE_REVIEW.md`), approving the Canonical Logical Core milestone only — not any Renderer, not P3-O12, not F06, not Editor integration.
- P3-O12 (capacity geometry policy): **CLOSED** (`8e64fbc`), versioned legacy/v2-native dispatch implemented, not yet wired to any Editor/`src/` caller.
- Editor Feature Inventory: **FROZEN** (`qa/inventory/CURRENT_EDITOR_FEATURE_INVENTORY.md`).
- In the migration-stage vocabulary (`CORE_MIGRATION_ROLLBACK_PLAN.md` §1): **Stage A and Stage B are complete.** Stage C has not been started (`typesetting-v2/tools/` does not exist at all — confirmed by direct glob).

**Formal remaining Phase 3 / migration items, in frozen order:**

| Stage/ID | What it is | Status | Visual? |
|---|---|---|---|
| Stage C | Non-Production **logical-only** comparison harness: same manuscript through old engine (`src/lib/pageLayout.ts`/`tategaki.ts`, read-only) and new Core, diffing page count / break positions / column assignment. Lives under `typesetting-v2/tools/compare/`. | **NOT STARTED** | **NO — no rendering at all** |
| Stage D | "Preview comparison behind an explicit development path" — first point a Preview Renderer consumes Core output for **visual** comparison. | NOT STARTED, sequenced after Stage C | **YES** |
| P3-O09 | Preview Renderer technology selection (final, Production-facing) | OPEN | YES (final) |
| P3-O08 | Publication Renderer technology selection | OPEN | N/A (print/PDF, separate) |
| Stage E–H | Publication comparison, mandatory-preset Human QA, controlled integration, old-engine retirement | NOT STARTED | Later |

**Direct answers to the four roadmap questions posed by this Loop's brief:**

1. **Formal remaining Phase 3 items:** Stage C (comparison harness) is the next unstarted frozen item; P3-O09/P3-O08 (Renderer technology selection) remain OPEN and unscheduled; Stage D depends on both Stage C being done and some Preview technology existing to test.
2. **Is "Preview development adapter" already an official Loop/milestone?** **NO, not under that name.** The closest frozen concept is Stage D ("Preview comparison behind an explicit development path"), which is a description of purpose, not a scoped Loop with a timebox/acceptance-criteria row the way P3-L04–L15 have. Stage C — the actually-next frozen item — is explicitly **not** visual.
3. **Is P3-O09 the next formal roadmap item?** **NO.** Per the Stage table, Stage C precedes any Preview Renderer work, and P3-O09 itself is a technology-selection decision, not a next-in-line implementation step.
4. **Any prerequisite explicitly ordered before P3-O09?** **YES** — Stage C (§2 table above) and, per `P3_CORE_IMPLEMENTATION_PLAN.md` §18 integration entry criterion 6, "a comparison adapter (Stage C) exists and has been run at least once against a real manuscript shape" is one of eight named criteria before any `src/` integration (Stage G) — a stricter, later gate than what this Loop is scoping, but evidence that Stage C is treated as load-bearing, not optional busywork.

**Per this Loop's brief, no P3-L or P3-O number is invented for the work planned here.** The descriptive label used throughout this document is **`PREVIEW-ADAPTER-PLAN`**, and it is explicitly framed in §14/§16 as informal groundwork that runs *alongside or ahead of*, but does not replace, the frozen Stage C logical comparison harness.

---

## 3. Current CanonicalDocument Output

**Direct-read sources:** `core/layout/schema.ts`, `core/index.ts`, `core/units/*.ts`, `core/layout/assemble.ts`, `core/compose/{line,column,page}.ts`, `core/ruby/index.ts`, `core/tcy/index.ts`, `core/colophon/index.ts`, `core/diagnostics/index.ts`, `core/version/index.ts`, `core/trace/index.ts`, `core/geometry/tick.ts`, `core/source/span.ts`, `core/measurement/facts.ts`.

**What is actually implemented and returned by `composeCanonicalDocument()` today:**

- `CanonicalDocument { pages, colophon?, version, warnings, errors, hold, trace }` — all fields populated on every call (§ `layout/schema.ts`).
- `CanonicalPage { id, order, columns, folio? }` — **`folio` is declared in the schema but `compose/page.ts`'s `composePage()` never sets it.** Confirmed by direct read: the returned page object literal is `{ id, order, columns }` only. This matches the Editor Inventory's own note ("Core page-decoration layer, P3-L08 partial via `folio?` field") — a known, already-disclosed gap, not new.
- `CanonicalColumn { id, order, lines, residualSpaceTick }` — residual space (Natural Pitch leftover) is real and populated (INV-004 evidence).
- `CanonicalLine { id, order, placedUnits }`.
- `PlacedUnit { id, sourceSpan, xTick, yTick, hanging?, rubyBoundaryPolicy? }` — **`xTick` is hard-coded to `0` for every unit** (compose/line.ts places units only along one axis, `yTick`, which accumulates by advance); **`hanging` and `rubyBoundaryPolicy` are declared but never assigned anywhere in `compose/`** (grep-verified: neither field name appears in `compose/line.ts`, `compose/column.ts`, or `compose/page.ts`).
- `VersionMetadata { coreSchemaVersion, ruleSetVersion, settingsVersion, measurementIdentity }` — fully populated, deterministic.
- `warnings []` — the array exists but nothing in the current Core ever pushes a `LayoutWarning` (only `errors` is ever populated, via `holdToLayoutError`). Not a bug — `diagnostics/computeHold()` was built generically, F17's malformed-notation case is the only exercised trigger and it produces an `error`, not a `warning`.
- `trace.events[]` — populated with real `TraceEvent`s (rule applied, alternatives considered, outcome) for every line-cut and kinsoku decision; observationally-only, byte-identical with/without a recorder (INV-005-adjacent property, test-verified).

**Three concrete gaps a painter needs to know about, none of which should be silently worked around by the adapter itself:**

1. **`PlacedUnit` has no `kind` discriminator and no text content.** A `TextUnit`'s `text`, a `RubyUnit`'s `baseSpan`/`readingSpan`/`segments`, a `TCYUnit`'s `displayText`, an `ImageUnit`'s `refId` — none of this survives into `PlacedUnit`. Only `sourceSpan` (a `{blockId, start, end}` code-point range) does.
   - **Resolution that does NOT require re-layout:** `DocumentCompositionInput.bodyUnits` (the exact `LogicalUnit[]` array the adapter itself constructs and hands to `composeCanonicalDocument()`) already contains every unit's `kind` and content, indexed by the same `SourceSpan` coordinate system `PlacedUnit.sourceSpan` uses. The adapter keeps this array in memory as a **read-only span→unit lookup table** (a plain array scan or a sorted-by-`start` binary search — an indexing operation, not a typesetting decision) and joins it against `PlacedUnit.sourceSpan` at paint time. This is explicitly allowed under the "CanonicalDocument + render-only configuration" input contract (§4) because the lookup table is inert data the adapter already had, not something it derives by re-running kinsoku/capacity/break logic.
2. **No explicit extent (width/height) field on `PlacedUnit`.** Within one line, unit *i*'s extent along the line axis is recoverable as `placedUnits[i+1].yTick - placedUnits[i].yTick` (or, for the line's last unit, `lineExtentTicks - residual - placedUnits[last].yTick`, where `lineExtentTicks` comes from render-context settings, §7) — because `compose/line.ts` places units contiguously with no gaps. This is arithmetic on already-canonical numbers, not a new layout decision, so it is safe for the adapter to do. **The per-line and per-column physical extents themselves (`lineExtentTicks`, `linePitchTicks`, `columnExtentTicks`) are not carried on `CanonicalDocument` at all** — they live only in the `PageCompositionSettings` object the Editor/harness already owns and passed into the Core. The adapter needs this same settings object as part of its render context (§7), not as something it invents.
3. **Ruby placement is written but not wired in.** `core/ruby/index.ts` exports two pure, fully-tested functions: `deriveRubyBreakOpportunities()` (consumed by `breaks/opportunity.ts` — this one **is** wired in) and `placeRuby()` (computes `{ policy, readingOffsetTick }` from base/reading extents and overhang allowances — grep-verified **not called anywhere under `core/compose/`**). Today, a `RUBY` unit is composed into exactly one opaque `PlacedUnit` spanning its combined `span` (base+reading), with an advance of `perCellAdvance * spanWidth` — no `rubyBoundaryPolicy`, no reading-offset, and no distinction between the base's cells and the reading's own extent is exposed on the output at all. This is a **Core wiring gap**, disclosed as a Human decision point in §9 and §16 — not something this planning document resolves, and not something the adapter should fix by inventing its own ruby-centering rule inside paint code (see INV-002/INV-009 discussion, §4).

**Answer to the audit's own checklist:**

| Item | Present in CanonicalDocument today? |
|---|---|
| Page/column/line representation | YES |
| Placed-unit representation | YES, but positional-only (no kind/content/extent — see gaps 1-2) |
| GeometryTick coordinates/extents | Positions YES; explicit extents NO (derivable, see gap 2) |
| SourceSpan / source mapping | YES, code-point offsets, verified INV-001 |
| VersionMetadata | YES, fully populated |
| Warnings/errors/HOLD | YES (errors/hold populated; warnings array exists but unexercised) |
| Ruby output | PARTIAL — opaque single placed block only, no placement geometry (gap 3) |
| TCY output | Logical-cell cost only (`tcyCellCost`); no visual rotation/shaping field exists by design (Renderer-only, P3-O03) |
| Semantic dash/ellipsis runs | Logical run only (`kind`, `runKind`, `length`); deliberately zero pixel fields (Renderer-only, P3-O04/O05) |
| Image output | `ImageUnit` carries `intrinsicWidth/Height` (ticks) and `placement`; composed as one `PlacedUnit` like text, real extent since P3-L15A |
| Colophon output | YES — isolated `ColophonBlock.pages`, never threaded through body pages (verified in `colophon/index.ts`) |
| Manual-page-break trace | Consumed structurally (`forcedBreak` closes column+page); the `MANUAL_BREAK` unit itself produces a zero-width marker span, no visible `PlacedUnit` |
| Page-decoration/folio fields | Declared (`CanonicalPage.folio?`) but **not populated** (gap, already disclosed in Editor Inventory) |
| Capacity geometry (P3-O12) | Available via `core/settings/capacityPolicy.ts`, **not yet wired to any Editor/adapter caller** — the adapter's render context must call this itself to get `charsPerLine`/`linesPerColumn` in ticks |

---

## 4. Adapter Ownership Boundary

**Smallest stable input contract**, confirmed workable against the actual schema above:

```
render(
  canonicalDocument: CanonicalDocument,   // from core/index.ts, unmodified
  sourceUnitsLookup: LogicalUnit[],        // the SAME array passed into composeCanonicalDocument() — read-only span index, never re-tokenized
  renderContext: DevRenderContext          // §7 — scale, settings echo, debug flags, font asset map
)
```

This matches the brief's preferred shape ("CanonicalDocument + render-only configuration") with one explicit, justified addition — the read-only unit lookup — because §3 established that omitting it would otherwise force the adapter to either (a) guess a unit's kind from raw text pattern-matching, which is a silent second Normalizer, or (b) have Core mutate its schema to inline content, which is out of this Loop's scope and not requested by the roadmap. Passing the same array is neither.

**Verified against the four invariants named in the brief:**

- **INV-002 (Renderer cannot mutate breaks):** the adapter never calls `deriveBreakOpportunities`, `composeLine`, `composeColumn`, or `composePage` — it only reads `CanonicalDocument.pages[].columns[].lines[].placedUnits[]`, which are already final. PASS by construction (the adapter's only Core imports, if any, would be pure paint-adjacent helpers — see the ruby caveat below, flagged not resolved).
- **INV-003 (Ruby cannot move body):** since the adapter never recomputes `xTick`/`yTick` for non-ruby units, and any ruby-reading paint offset is additive/annotation-only (drawn beside, not instead of, the base's already-fixed position), body position is untouched regardless of how §9's ruby-painting question is resolved. PASS.
- **INV-004 (Natural Pitch / no page-fill stretch):** the adapter paints `residualSpaceTick` as visible empty space at the end of a column; it must never distribute it across lines to "fill" a page. This is a paint-code discipline item, not a data gap — recorded here as a hard rule for whichever Loop implements the adapter.
- **INV-009 (Renderer alignment cannot mutate canonical layout):** the tick→px scale conversion (§7) is one-way; nothing computed at paint time (font metrics, browser reflow, `getBoundingClientRect`) may write back into a `GeometryTick` value or influence a later composition call. PASS by construction as long as the adapter has no feedback path into `DocumentCompositionInput` — which this contract shape (adapter receives a finished `CanonicalDocument`, never rebuilds one) structurally prevents.

**The adapter MUST NOT** (per the brief, all confirmed non-negotiable given the ownership boundary above): tokenize manuscript again, re-run kinsoku, choose line/page breaks, calculate capacity, remeasure layout, move body text because of ruby, invent jukugo breaks, change image flow, or change colophon placement. None of these are needed given the input contract above — every one of them is already fully decided in `CanonicalDocument` or in the settings object the adapter echoes back as read-only render context.

---

## 5. Renderer Technology Options

See §14 for the full scored comparison. Summary of the reset: the frozen architecture (Master §7 "white-sheet" rule) intentionally never committed to DOM/CSS-writing-mode/Canvas/SVG/WASM/HarfBuzz/browser-native ruby for the **final** Preview Renderer — that remains P3-O09, OPEN. This document does not silently re-decide P3-O09. It only picks a technology for the **temporary, disposable development adapter**, where simplicity/inspectability legitimately outweigh the final-Renderer concerns (font fidelity, ruby optical quality, performance at scale) that make P3-O09 a genuinely hard, still-open decision.

---

## 6. Recommended Adapter Architecture

**Option A — Minimal React DOM, absolutely-positioned glyphs**, one `<div>` (or `<span>`) per `PlacedUnit`, positioned via inline `style.left/top` computed from `xTick`/`yTick` × a render-time scale factor. See §14 for the scored comparison against SVG/Canvas.

Shape:
- `typesetting-v2/tools/preview-dev-adapter/` (non-production location, mirrors Stage C's `typesetting-v2/tools/compare/` naming convention) — **not** under `src/`, **not** a Next.js route, **not** wired into the live Editor.
- A single render function `renderCanonicalDocumentDev(document, sourceUnitsLookup, renderContext)` returning React elements (or, if a full app harness is undesirable for a first pass, a static HTML string with inline styles — see §14's Option A sub-variant tradeoff).
- One page-index selector (renders one `CanonicalPage` at a time, or a small explicit N — see §13), not a scroll-everything-at-once clone of the legacy `PreviewPane.tsx`.

This is the same technology family as the current Editor (React), which the brief explicitly warns against choosing "just because it is familiar" — but here the choice survives that check on its own merits (see §14's scoring), not by default.

---

## 7. GeometryTick → Visual Coordinate Boundary

**One-way conversion, defined once, called only at paint time:**

```
px = tick / TICKS_PER_MM * MM_TO_PX_SCALE   // e.g. 1000 ticks/mm * (renderContext.scale px/mm)
```

`renderContext` carries:
- `scale` (px per mm, a pure display zoom factor — changing it must never change any `GeometryTick` value, only how large it is drawn)
- an echo of the **same `PageCompositionSettings`** object passed into `composeCanonicalDocument()` (needed to know `lineExtentTicks`/`linePitchTicks`/`columnExtentTicks`/page physical size for absolute column/page positioning, per §3 gap 2 — the adapter reads these, never recomputes them)
- `debugOverlays` (§11, a set of flags)
- `fontAssetMap` (§15 — font identity → actual paintable font resource; explicitly separate from `MeasurementFacts.providerId`/`providerVersion`)
- `imageResolver` (`refId` → actual displayable image URL/blob for dev purposes; a placeholder rectangle is an acceptable v0 resolver, §10)

**MUST NOT be in `renderContext`:** anything that can change a break, a capacity number, a kinsoku rule, or a page-flow decision. If a value could ever cause two different `CanonicalDocument`s to be needed for the "same" render, it does not belong here — it belongs upstream, in `DocumentCompositionInput`.

**No browser-measured width may ever change line break, page break, ruby body position, capacity, or column count** — enforced structurally, not just by convention, because the adapter's render function has no return channel back into Core (§4's contract is one-directional: `CanonicalDocument` in, pixels out, nothing out the other side).

---

## 8. Minimum v0 Feature Set

**MUST HAVE FOR FIRST VISUAL GATE:**
- Plain text (multiple lines, multiple columns, multiple pages)
- Manual page breaks (visibly distinct page boundary where `forcedBreak` occurred)
- Natural Pitch residual behavior (visible empty space at column end, never stretched)
- Source-position/debug overlay (§11) — this is what makes the gate diagnostic rather than decorative
- HOLD state rendering (§12) — a document that couldn't compose must never look like a normal approved page

**SECOND PASS (visible, but explicitly marked non-final quality):**
- Ruby — painted using Core's existing (if unwired, directly-imported-and-called, see §9's caveat) `placeRuby()` geometry, or, failing that, a deliberately naive centered placeholder, clearly not claiming final optical quality
- TCY — rendered as a simple rotated/boxed group occupying its `logicalCells` width, not claiming final shaping (P3-O03 stays open)
- Dash/ellipsis — painted as plain consecutive glyphs, no optical alignment tuning (P3-O04/O05 stay open)
- Images — placeholder rectangle at the correct position/extent (real decode not required for a logical-comparison gate)
- Colophon — its own page(s), rendered with the same plain-text painter, positioned by page-occupancy only

**FINAL PREVIEW RENDERER ONLY (explicitly deferred past this adapter):**
- Folio/header (nombre/hashira) — Core doesn't populate `folio` yet (§3 gap 1); no adapter work can outrun that
- Final font aesthetics, final ruby optical overhang, final TCY shaping, dash micro-alignment, any Publication PDF quality

**Reasoning:** the first Human gate (§12) is judging *logical* correspondence (does the page/line/column flow match what the manuscript should produce), which the MUST-HAVE list alone can demonstrate. Ruby/TCY/dash/images/colophon materially help a reviewer trust the gate isn't cherry-picking simple cases, so SECOND PASS is worth doing in the same Loop if time allows, but the gate itself does not require visual perfection on any of them.

---

## 9. Ruby / TCY / Dash / Ellipsis Strategy

**Ruby:** Core provides enough *shape* (via the original `RubyUnit.baseSpan`/`readingSpan`/`segments`, recoverable through the §3/§4 lookup table) but not enough *composed geometry* — `placeRuby()` is never invoked during composition (§3 gap 3). Two honest options for the adapter, **neither of which is "solve P3-O06 accidentally"**:
  (a) Paint the ruby group as one plain block (current actual Core output) with a small, visibly-marked "ruby: base+reading not yet separated" debug badge — zero extra logic, fully honest about the gap.
  (b) Have the adapter's paint code **directly import and call** `core/ruby`'s existing, tested, pure `placeRuby()` function (not reimplement it) against the base/reading extents it can already compute from the lookup table and `MeasurementFacts`. This uses Core's own already-approved geometry function for a paint-only annotation offset — it does not invent a new rule, and since the ruby-overhang table is currently all-zero (P3-O06 residual, still OPEN), the only two reachable outcomes today are CENTER and OVERFLOW_OPEN, both already Human-approved policies (Master §25.6).

  **This plan recommends (b)**, but flags explicitly in §16 that the cleaner long-term fix is a small Core patch (wiring `placeRuby()`'s result into `PlacedUnit.rubyBoundaryPolicy` during `compose/line.ts`'s ruby-atom handling) — that is Core work, one Human decision away, not adapter work, and should not be silently done inside this Loop.

  Distinguishing **logical correctness** ("is this the right base text with the right reading text, in the right order, unbroken except at declared jukugo segments") from **final ruby typography quality** ("is the overhang/centering pixel-perfect") is exactly the MUST-HAVE vs. SECOND-PASS split in §8 — the adapter's debug overlay (§11) should label ruby blocks with their `rubyKind` (ATOMIC/JUKUGO) and segment count so a reviewer judges the former, not the latter.

**TCY:** `logicalCells` (already decided, Core-owned) vs. final rotation/shaping (P3-O03, Renderer-only, still blocked by the unexplained P2-L06 CSS `text-combine-upright` failure). v0 paints TCY as a simple box occupying its declared cell-width with the `displayText` inside (rotated 90° via a plain CSS transform is acceptable for a dev adapter — this is not claiming to solve P3-O03's specific browser bug, just to show *where* the group sits and *how wide* it logically is). **P3-O03 is not solved by this Loop.**

**Dash/ellipsis (P3-O04/O05, both OPEN):** paint as plain consecutive glyphs from the run's source text, no optical edge-spacing. The adapter must not attempt the "slightly left-shifted" fix that was never verified in Phase 2 — that remains explicitly a future Renderer-polish item.

---

## 10. Images / Colophon / Page Decorations

**Images:** `ImageUnit.intrinsicWidth/Height` (real ticks since P3-L15A) plus `placement` are sufficient to paint a correctly-positioned, correctly-sized placeholder rectangle. Real image decode is unrelated to the logical-layout comparison this gate is judging — a labeled gray box (with `refId` as a debug label) is sufficient for v0.

**Colophon:** Core represents it as an isolated `ColophonBlock.pages` (never inside body columns/lines) — confirmed structurally isolated by `colophon/index.ts`'s own signature (cannot accept or return a body `CanonicalColumn`/`CanonicalLine`). For v0, render the colophon's page(s) with the exact same plain-text page/column/line painter used for the body — this is sufficient to prove page-occupancy and isolation; no dedicated horizontal-layout treatment is required yet. **This concerns only the v2 Canonical Core's colophon representation** — nothing here touches or replaces the legacy Production's two colophon systems (vertical body-embedded `bookStructure.ts`, horizontal isolated `colophon.ts`/TSP-LOOP-005), both of which remain fully live and unmodified.

**Page decorations (folio/nombre/hashira):** Core's `CanonicalPage.folio?` field exists in the schema but is **not populated** by the current `composePage()` (§3 gap 1, already disclosed in the Editor Inventory as "P3-L08 partial"). The adapter cannot paint what Core doesn't yet produce — this is recorded as a **partial gap**, not a blocker for the basic adapter, since no roadmap item requires folio painting before the first visual gate (§8).

---

## 11. Debug Overlay / Traceability

Recommended smallest useful set, chosen because each answers a "why did the Core do this" question a raw JSON dump makes tedious:

- **Page/column/line index** — printed in a corner of each region, so a reviewer can say "page 3, column 2, line 5" out loud while comparing against the legacy Preview.
- **Source span** — on hover or as a persistent small label, the `[start, end)` code-point range each `PlacedUnit` covers, letting a reviewer jump back to the exact manuscript text.
- **Unit kind** — TEXT/RUBY/TCY/SEMANTIC_RUN/IMAGE/MANUAL_BREAK, color-coded, resolved via the §3/§4 lookup table.
- **HOLD/error badge** — a page or line that failed to compose (§12) must be visibly flagged, not silently blank.
- **Residual space** — the column's trailing `residualSpaceTick`, rendered as a measured, labeled gap (proves INV-004's "reported, not absorbed" property visually).
- **Break reason** (from `TraceEvent.ruleApplied`/`outcome`) — shown at the specific position a line/column/page actually cut, on demand (click/hover), not painted on every line by default (would be too noisy for a first gate).

Not recommended for v0 (real, but lower-value relative to implementation cost): a rule-trace-id cross-reference UI, per-glyph GeometryTick coordinate tooltips beyond the span label, or a full trace-event timeline scrubber — these are legitimate SECOND-PASS or FINAL-tool features, not gate-blocking.

---

## 12. Human Visual QA Plan

**Workflow (no browser automation, no headless capture — a person opens two things and looks):**
- **A. Current Production/legacy Preview** — the existing `PreviewPane.tsx`/`PageCard.tsx` FixedSlot rendering, run against a fixture manuscript with equivalent settings.
- **B. v2 development adapter** — the same fixture manuscript, tokenized into `LogicalUnit[]` by hand (or by a small, disclosed, non-Core helper — this Loop does not design a Normalizer), composed via `composeCanonicalDocument()`, painted by the adapter.
- A person compares A and B side by side, page by page, at the same settings preset, and answers the FIRST VISUAL GATE questions below.

**Fixtures:**
- The **canonical regression sentence** (mandatory, per this Loop's own instruction) — `REGRESSION_CORPUS_SPEC.md` §1 / `composeCanonicalDocument.test.ts`'s F20: 「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」
- The **existing longer, non-repeating Human QA prose fixture**, located at `prototypes/ui-comparison/shared/content.js`'s `MANUSCRIPT_TEXT` — a genuine multi-paragraph sample (not filler) already used for Phase 1 UI-A/B/C comparison, containing the canonical sentence plus two further paragraphs and one dash-run (``――``) line. **Not replaced with repeated filler text**, per this Loop's explicit instruction. Recommend extending a copy of it (not the shared UI-comparison original) with one ruby example, one explicit TCY example, one manual page-break marker, and one image marker, so the SECOND-PASS features in §8 have real coverage in the same fixture family rather than a patchwork of tiny isolated snippets (those tiny snippets — `phase2-japanese-capability-poc/FIXTURES.md` — remain useful for targeted feature checks but are each too short to judge page/column flow).
- **F19's test-only "long prose"** (`"あいうえお...".repeat(4)`, 100 code points of repeated kana) is confirmed to be **test filler, not a Human QA fixture** — it exists only to force a multi-page split deterministically in an automated test and should not be presented to a Human reviewer as a real prose sample.

**FIRST VISUAL GATE — what the Human is judging:**
- Page count matches (or every divergence is understood and expected — e.g. Natural Pitch's no-stretch vs. legacy `justified` stretch)
- Line-break correspondence (same words end each line, modulo already-approved stricter kinsoku, HG-1/HG-2)
- Column flow order (top-to-bottom, right-to-left column order matches)
- Manual break position (the `【改ページ】` marker's page boundary lands in the same place)
- Natural Pitch "feel" (visible residual space at column ends, not stretched to fill)
- Obvious ruby/body correspondence (reading sits near its base, even if not pixel-final)
- Obvious TCY grouping (the digit/mark group is visually one rotated unit, even if shaping isn't final)
- Image space reservation (a placeholder occupies the declared extent at the declared position)

**Explicitly NOT yet being judged at this gate:** final font aesthetics, final ruby optical overhang, final TCY shaping, dash micro-alignment, any Publication PDF quality — restated from `P3_CORE_IMPLEMENTATION_PLAN.md` §15's own Gate-G1 framing, extended here to the adapter's own first gate.

---

## 13. Performance / Page Count Boundary

Full virtualization is explicitly **not** required for v0. Recommended boundary: the dev adapter renders **at most the pages a reviewer is actually comparing in one sitting** — a simple page-index selector (render page N, or pages N..N+k for a small k, e.g. 3-5) rather than mounting an entire long manuscript at once. This is a deliberate **non-reproduction** of the legacy Preview's "every page mounts simultaneously" behavior (Editor Inventory §1 finding #3, §2 "every Preview page mounts simultaneously... a potential performance cliff... a v2 Renderer should deliberately not reproduce without consideration"). Full-document correctness stays independently testable via the existing headless Core test suite (F19-style multi-page fixtures) — the adapter's own page-limited rendering is a display convenience, not a coverage gap, because the *logical* document was already fully composed in memory regardless of how many pages get painted.

**What must not become permanent architecture accidentally:** the page-index selector's simplicity (no lazy-loading, no scroll virtualization, no route-level code-splitting) is acceptable *because this tool is disposable* (§16) — if any part of this adapter is later carried into the real Preview Renderer (P3-O09), its performance characteristics must be re-evaluated against real manuscript scale at that time, not assumed to already be proven here.

---

## 14. Compare Implementation Shapes

| Criterion | A. React DOM absolute-position | B. SVG painter | C. Canvas painter |
|---|---|---|---|
| Canonical fidelity (paints exactly the tick positions, no reflow) | STRONG — `position:absolute` + inline `left/top` never reflows against content | STRONG — `x`/`y` attributes are exact, no reflow | STRONG — pixel-drawn, no reflow |
| Risk of accidentally becoming a second layout engine | GOOD — DOM text nodes can in principle wrap/reflow if a developer forgets `white-space:nowrap`/fixed sizing; a real but easily-guarded risk | STRONG — SVG `<text>` never auto-wraps; geometry is always explicit | STRONG — Canvas has no layout model at all, nothing to accidentally reflow |
| Debug inspectability | STRONG — real DOM nodes, browser devtools element inspector, hover/click handlers, CSS-based overlays all "just work" | GOOD — devtools can inspect SVG nodes too, slightly less ergonomic for rich hover tooltips/badges than HTML | WEAK — a canvas is one opaque bitmap to devtools; any hover/click debug overlay must be hand-built with manual hit-testing |
| Ruby/TCY extensibility | STRONG — nested `<div>`s/CSS transforms trivially express a reading annotation beside a base run | GOOD — nested `<text>`/`<tspan>` works but is more verbose for annotation offsets | MIXED — must manually track every glyph's hit-region for later interaction; fine for static paint, worse for iteration speed |
| Image support | STRONG — `<img>`/background-image, trivial | GOOD — `<image>` element, trivial | GOOD — `drawImage`, trivial but blocks on load callbacks |
| Human QA ease (does it look inspectable/trustworthy) | STRONG | GOOD | MIXED — a static bitmap reads as more "finished" than it is, risking a reviewer judging final quality prematurely |
| Performance at v0's bounded page count (§13) | GOOD — fine at a handful of pages; would need virtualization at real-manuscript scale (explicitly deferred, §13) | GOOD — same caveat | STRONG — Canvas scales better raw-pixel-wise, but this advantage is irrelevant at v0's bounded scope |
| Implementation cost | STRONG — lowest, reuses existing React/CSS fluency from the current Editor | MIXED — same team has less day-to-day SVG-authoring practice | MIXED — most manual bookkeeping (no DOM tree to lean on at all) |
| Transition value to final Preview Renderer (P3-O09) | MIXED — if P3-O09 ultimately does **not** select DOM/CSS-writing-mode (a live, still-OPEN Master §7 question), this adapter's paint code is fully disposable, by design (§16) | MIXED — same caveat, SVG is one of several live P3-O09 candidates per Master §7's own un-decided list | MIXED — same caveat |

**No fourth option scored separately:** the brief's own optional "CSS vertical-writing blocks" variant is treated as a sub-variant of Option A (DOM), not a distinct category — it would reintroduce native `writing-mode:vertical-rl` reflow, which is exactly the "current Preview's `PageCard.tsx` deliberately does NOT use" precedent (Editor Inventory §7) that a *painter of already-decided positions* has no reason to reintroduce. Scored inline: **WEAK** as a v0 choice, since it would let the browser's own line-wrapping compute positions the Core already computed, directly risking a silent second layout engine (the exact failure mode INV-002/INV-009 exist to prevent).

---

## 15. Recommended Adapter Architecture (Decision)

**Recommended: Option A, React DOM absolute-positioned painter**, for the reasons scored in §14 — it wins or ties on every criterion except raw Canvas performance headroom, which is irrelevant at v0's deliberately bounded page count (§13).

**Lifecycle: DISPOSABLE, leaning slightly EVOLUTIONARY on ideas, not code.** This is not the foundation of P3-O09. P3-O09 remains a genuinely open, harder decision (does the final Preview Renderer even use DOM? native `vertical-rl`? WASM+Canvas for shaping control? — Master §7 white-sheets all of this on purpose, and Phase 2's own PoC evidence on TCY/CSS is inconclusive, P3-O03). Treating this adapter as "the start of P3-O09" would quietly foreclose that decision by sheer inertia — exactly the failure mode the brief's Question 2 warns against.

**What should survive into the final Preview Renderer, regardless of its eventual technology:**
- The input contract shape (§4): `CanonicalDocument` + read-only unit lookup + render-only context — this is a Core Contract-level decision, not tied to DOM/SVG/Canvas.
- The debug-overlay concept set (§11), even if the final Renderer's *production* mode hides them entirely — the underlying data (span, unit kind, break reason, HOLD state) is worth keeping queryable.
- The GeometryTick→pixel one-way conversion discipline (§7).
- The Human QA fixture (§12's extended `MANUSCRIPT_TEXT`) as a standing comparison asset.

**What is dev-only and should NOT be assumed to survive:**
- The actual React components / CSS / paint code itself.
- The page-index-selector-only performance shortcut (§13).
- Any ruby-painting workaround chosen in §9 option (a) or (b) — both are explicitly interim, pending the Core wiring fix named in §9/§16.

**What would trigger abandoning the adapter approach entirely** (not just this technology choice): if, during SECOND PASS work, painting ruby/TCY/dash reveals that `CanonicalDocument`'s schema itself needs a shape change (e.g., `PlacedUnit` genuinely needs a `kind`/extent field, not just a paint-time lookup) — that is a Core Contract change, and continuing to build adapter features against a schema known to be about to change would be wasted, disposable-on-arrival work; the right move at that point is to pause the adapter and take the schema question back to Core as its own small Loop first.

---

## 16. Transition to P3-O09 Preview Renderer

This adapter is explicitly **not** Stage D and not P3-O09. Per §2's Stage table, Stage D is "Preview comparison behind an explicit development path" using an actual Preview Renderer technology decision (P3-O09) — which remains open. This adapter is better understood as **informal groundwork that could inform Stage D's later technology decision**, run in parallel with, not instead of, the still-required Stage C.

**Human decision this document surfaces, does not resolve:**
1. Should `PREVIEW-ADAPTER-PLAN` proceed **before, alongside, or only after** Stage C's logical-only comparison harness is built? (This plan's authors' inclination: alongside is fine — the two tools answer different questions, page-count/break-position diffing vs. "does it look right," and neither blocks the other technically — but this is a sequencing call for the Product Owner, not something this Loop decides unilaterally, since the frozen migration plan's own stage order lists C before D.)
2. Should the ruby-composition wiring gap (§3 gap 3, §9) be fixed in Core first (a small, well-scoped follow-up Loop touching only `compose/line.ts` + `layout/schema.ts`'s `PlacedUnit.rubyBoundaryPolicy`/a new reading-offset field) before or alongside the adapter's ruby painting work?

**Proposed next actual task** (descriptive label, **not a frozen roadmap Loop ID**, per this Loop's own instruction not to invent a P3-L/P3-O number): **`PREVIEW-ADAPTER-IMPLEMENTATION`** — scoped to §8's MUST-HAVE feature set only, Option A architecture (§15), against the extended `MANUSCRIPT_TEXT` fixture (§12), explicitly timeboxed and explicitly not touching `src/`, `core/compose/`, or `core/layout/schema.ts`. If the Human decision in point 2 above favors fixing the ruby wiring gap first, that should be its own small, separate Core-side Loop (touching only `core/compose/line.ts` and `core/layout/schema.ts`) — this document does not scope that Loop's acceptance criteria, since it is Core work, out of this planning Loop's own boundary (`src/ modifications: NOT AUTHORIZED` extends analogously to unplanned `core/` modifications not requested by this Loop's brief).

---

## 17. Risks / HOLD Conditions

- **A document with `hold: true` must never be painted as an approved normal page.** Recommended v0 treatment: a red/error panel showing the triggering `LayoutError.message` and its `sourceSpan`, in place of the page/column that failed to compose — styling detail is unimportant, the semantic distinction (this is not an approved layout) is what matters.
- **Font-identity mismatch risk:** `MeasurementFacts.providerId`/`providerVersion` (the identity Core's layout math was computed against) is a different axis from `renderContext.fontAssetMap` (the actual font file the adapter paints with, §7). If the dev adapter paints with a font whose metrics don't match the `MeasurementFacts` the Core composed against (e.g., a fake/fixture provider was used for composition but a real webfont is loaded for paint), line-ending punctuation could visually overflow or underflow its computed cell even though the Core's own numbers are internally consistent. **Recommended dev-visible warning:** a small badge naming the `measurementIdentity` string next to the render, and a same-page note if the adapter's `fontAssetMap` was not deliberately matched to it — never a silent remeasure/reflow to compensate (that would violate INV-009). Final font-loading architecture is explicitly not solved by this Loop.
- **Sequencing risk (§16):** proceeding with a visual adapter without the Stage C logical-diff harness existing means a visual "looks right" judgment could pass while the *numbers* (page count, exact break offsets vs. the old engine) have never been machine-diffed — a Human eyeballing pages is not a substitute for Stage C's mechanical comparison. This document does not treat the adapter as satisfying any Stage C entry criterion.
- **Ruby wiring gap (§3/§9) risk:** if SECOND PASS ruby painting silently normalizes into "the way the adapter does it," future readers could mistake that for an approved Core decision rather than a disclosed, still-open gap. Recommend the debug overlay (§11) always labels ruby blocks as using adapter-computed (not Core-composed) placement until the Core wiring fix (§16 point 2) lands.

---

## 18. Human Decisions Required

1. **Sequencing:** build `PREVIEW-ADAPTER-PLAN`'s implementation before, alongside, or after Stage C's logical comparison harness (§16 point 1)?
2. **Ruby wiring:** fix the Core-side `placeRuby()` wiring gap (§3 gap 3) as its own small prerequisite Loop, or accept the adapter directly calling `core/ruby`'s existing pure function for paint-only geometry as an interim measure (§9 option (b))?
3. **Approve** the recommended architecture (Option A, React DOM absolute-positioned, §15) and the MUST-HAVE v0 feature scope (§8) as the basis for a future `PREVIEW-ADAPTER-IMPLEMENTATION` task?
4. **Approve** extending a copy of `prototypes/ui-comparison/shared/content.js`'s `MANUSCRIPT_TEXT` (not the shared original) with one ruby/TCY/manual-break/image example each, as the primary Human QA fixture for the first visual gate (§12)?

