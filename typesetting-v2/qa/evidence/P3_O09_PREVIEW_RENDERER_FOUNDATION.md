# P3-O09 — Preview Renderer Foundation

## 1. Verdict

**FOUNDATION: PASS. P3-O09 (the full frozen item): IN PROGRESS, not complete.**

This task builds the first architectural slice of the final v2 Preview Renderer (`typesetting-v2/renderer/preview/`) — normal-body rendering, Natural Pitch, paragraph/manual-break semantics, bounded page window, HOLD handling, a real NORMAL/DEBUG mode split, and clean paint boundaries for ruby/TCY/dash/ellipsis/image. It does **not** finish special-unit visual quality (P3-O03/O04/O05/O06 remain OPEN) and does **not** integrate into Production/`src/`.

## 2. Frozen Roadmap Position

Direct-read of `docs/architecture/PHASE3_OPEN_ITEMS.md` row P3-O09: *"Preview renderer implementation | OPEN | Phase 2's PoC renderers used plain HTML/CSS ... as a paint surface ... this is a PoC convenience, not a selected Phase 5 Preview Renderer technology | Blocks Phase 5 start | Phase 5 start | Yes"*. Cross-checked against `TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` §Phase list: Phase 3 = Core Typesetting Engine (pagination/lines/columns/kinsoku/hanging/ruby/tcy/punctuation/images/page break — the work this branch has been doing, G1-approved); Phase 4 = Publication Renderer (P3-O08, OPEN); Phase 5 = Preview Renderer (P3-O09, OPEN).

**Roadmap contradiction check (explicitly required before starting):** the Master's phase list is numbered sequentially (3 → 4 → 5), but nothing in `PHASE3_OPEN_ITEMS.md`'s own table, its Notes section ("Items P3-O08/O09 are output-technology decisions Master §7's white-sheet rule already deferred past Phase 2"), or `REQUIREMENTS_TRACEABILITY.md` (V2-ARCH-003: *"Preview Renderer → Publication Renderer separation preserved; renderers may differ in technology"*) states that Phase 4 (Publication) must complete before Phase 5 (Preview) may begin — they are recorded as independent, parallel output-technology tracks over the same `CanonicalDocument`, not a strict sequence. **No genuine contradiction found; not stopped.** P3-O09 is confirmed the correct, frozen next item; no numeric sub-loop was invented (this document uses the descriptive label "P3-O09 Preview Renderer Foundation," per instruction).

## 3. Stage D → Final Renderer Audit

| Piece | Disposition | Notes |
|---|---|---|
| `tickToPx` one-way tick→px conversion | REUSE CONCEPT ONLY | Re-derived as `renderer/preview/geometry.ts`'s own copy — same Contract §21 formula, no import from `tools/preview-dev-adapter/` |
| `CanonicalDocument` input contract | REUSE AS-IS | Same Core types (`../../core`), unchanged — this is Core's contract, not Stage D's |
| Read-only `LogicalUnit[]` span lookup (`findOwningUnit`) | REUSE CONCEPT ONLY | Re-implemented in `paintModel.ts`, same algorithm, same text-duplication-avoidance convention (slice the placed atom's own span, never the owning unit's full span) |
| Page/column/line mapping | REUSE CONCEPT ONLY | Same tick-delta-based extent derivation; renamed `ViewX` → `PaintX` to mark this as the foundation's own contract |
| React absolute positioning | REUSE CONCEPT ONLY | Same `position:absolute` painting strategy; component tree restructured around an explicit `mode: "normal" \| "debug"` prop (Stage D had no such split) |
| Font paint metric (`fontSizePx`) | REUSE AS-IS (fix carried forward) | `tickToPx(linePitchTicks, scale)` — the exact STAGE-D-GLYPH-PAINT-SCALE fix, never a hardcoded constant |
| Paragraph indent paint (`indentTick` → `topPx` offset) | REUSE AS-IS (fix carried forward) | The exact STAGE-D-FIRST-LINE-INDENT-VISUAL-HOLD fix — correct from this foundation's first line of code |
| Image placeholder | REWRITE FOR FINAL RENDERER | Stage D painted a fixed placeholder box inline; this foundation introduces a real `ImageResolver` abstraction boundary (`ImageResolution = PLACEHOLDER \| RESOLVED`), decoupling Core's occupancy from what actually paints inside it |
| HOLD rendering | REUSE CONCEPT ONLY | Same structural exclusion (HOLD documents never render `pages`, only a banner) |
| Bounded page window | REUSE CONCEPT ONLY | Same `maxPages`/`renderedPageCount`/`totalPageCount` split; `PreviewPage` extracted as an explicit, independently-render-able component (§9) |
| Debug overlays | REWRITE FOR FINAL RENDERER | Stage D's debug badges/markers were always-on (checkbox-toggle CSS only); this foundation gates them by an explicit `mode` prop so NORMAL PREVIEW never contains the DOM nodes at all, not just visually hidden ones |
| Static SSR artifact generator (`generateArtifact.test.ts`) | REWRITE FOR FINAL RENDERER | New file (`generateFoundationArtifact.test.ts`), writes to a separate path (`qa/visual/p3-o09-preview/`), generates both a NORMAL and a DEBUG artifact; the mechanism (vitest test writing static HTML via `react-dom/server`) is reused, but the renderer's own source files do not import anything from `tools/preview-dev-adapter/` |
| Fixture navigation | DISCARD (mechanism); REUSE (data) | No client-side navigation JS existed in Stage D either; fixture *content* (F20, long-prose, paragraph/blank-line, manual-page-break, two-column, multi-page, ruby, TCY, dash/ellipsis, image, HOLD) is re-declared in `renderer/preview/fixtures.ts`, not imported from Stage D's fixtures file |
| Hardcoded QA styling (orange debug blocks, always-visible badges) | DISCARD | Replaced by the NORMAL/DEBUG split (§ below) |
| Provisional special-unit badges | REWRITE FOR FINAL RENDERER | Kept as a content-level `provisional` flag (visible in both modes, since it is real information about the unit's own status, not dev-only styling) but the ruby-annotation-PENDING text label is DEBUG-only (never shown in NORMAL PREVIEW, per instruction to avoid misleading dev badges polluting normal architecture) |

**Reused, unmodified (not rewritten):** `tools/compare/fixtureBuilder.ts`'s `buildFixtureUnits` — pure offset arithmetic already shared by Stage C and Stage D; continuing that pattern a third time is the established convention, not a new dependency, and is Core-adjacent test infrastructure rather than the disposable Stage D QA tool itself.

## 4. Final Renderer Contract

`typesetting-v2/renderer/preview/paintModel.ts` exposes exactly one entry point for body content, `buildPaintDocument(id, label, document: CanonicalDocument, units: LogicalUnit[], source: string, ctx: PreviewRenderContext): PaintDocument`, and one for colophon content, `buildColophonPaintPages(colophon: ColophonBlock, units, source, ctx): PaintPage[]`. Consumed inputs: `CanonicalDocument` (read-only), the same `LogicalUnit[]` the caller composed against (read-only span lookup, never re-tokenized), a paint-only `PreviewRenderContext` (scale, echoed settings, optional `maxPages`, optional `imageResolver`, font-identity pair), and nothing else. It does **not** accept or perform: tokenization, kinsoku, capacity calculation, line breaking, page breaking, ruby logical break decisions, TCY recognition, or image flow calculation — none of these exist anywhere in `renderer/preview/`, confirmed by direct reading of every file in the module (grep for `deriveBreakOpportunities`, `composeLine`, `composeColumn`, `composePage`, `computeAtoms` inside `renderer/` returns zero matches).

## 5. Canonical Ownership Boundary

Verified by test 1 (`paintModel.test.ts`): a deep-equal snapshot of `CanonicalDocument` taken before calling `buildPaintDocument` is unchanged after. No Renderer API in `paintModel.ts` or `PreviewRenderer.tsx` accepts a `CanonicalDocument` and returns a mutated one, or exposes any setter/mutation hook over canonical layout — every exported function is a pure read → transform → new-object return.

## 6. Geometry / Font Paint Boundary

`renderer/preview/geometry.ts`'s `tickToPx` is the single, one-way GeometryTick→px conversion (own file, no re-export of the Stage D copy). `fontSizePx` is derived from `ctx.linePitchTicks` (the canonical body font's own em-size in ticks) through the identical `tickToPx` path every other geometry value uses — no hardcoded font-size constant exists anywhere in `renderer/preview/` (confirmed by grep: no bare `px` numeric literal appears in any `font-size`/`fontSize` position in `PreviewRenderer.tsx`). Test 6 proves the font-size ratio between two scales equals the page-width ratio exactly. CSS px values are consumed only by React inline styles for painting; nothing in `renderer/preview/` writes back into `core/`, `MeasurementFacts`, capacity, or line/page composition.

## 7. Normal Body Rendering

All 15 "MUST IMPLEMENT" items are present and covered by a named test in `paintModel.test.ts` / `generateFoundationArtifact.test.ts`: page shell (§9), columns (test 11), normal TEXT (F20 fixture, test 3), multiple logical lines (test 7/8/9/10), multiple columns (test 11), multiple pages (test 12), paragraph forced breaks (test 9), automatic first-line indent (test 7), blank paragraphs (test 10), manual page breaks (test 8), Natural Pitch spacing (residual space threaded through unchanged as `residualSpaceTick`/`residualSpacePx`, never stretched — no new stretch logic exists in `paintModel.ts`), image canonical occupancy (test 14, placeholder/resolver boundary), HOLD/fatal diagnostics (test 15), bounded page window (test 13), source trace/debug capability (`PaintDebugInfo`, §15 below).

## 8. Paragraph / Manual Break Semantics

Both fixes proven correct at Stage D (§19 of `STAGE_D_PREVIEW_ADAPTER_IMPLEMENTATION.md`) are carried forward as this foundation's own, already-correct behavior from its first line of code — not re-discovered bugs: `topPx` is computed as `tickToPx(placed.yTick + (line.indentTick ?? 0), scale)` (test 7), and manual-page-break handling relies on the already-fixed `core/compose/column.ts` paragraph-start consumption logic, so a page-ending line's own paragraph-start status is never re-exposed to the next page (test 8). No new Core change was needed or made by this task.

## 9. Page / Column / Window Architecture

`PreviewPage` (`PreviewRenderer.tsx`) is a standalone, independently-invocable React component taking exactly one `PaintPage` plus `fontSizePx`/`mode` — it does not require its sibling pages to exist or be rendered, and `PreviewDocumentView` maps over `model.pages` calling it once per page. This is the "stable Page component boundary" the task requires for future virtualization; full virtualization (windowed/lazy DOM mounting) is explicitly **not** implemented here (bounded composition via `ctx.maxPages` is sufficient for this foundation, per instruction) — the old engine's "mount every page forever" behavior is not present (`renderedPageCount` is always `≤ maxPages` when set, test 13).

## 10. Images

Core continues to own occupancy (`ImageUnit.refId/intrinsicWidth/intrinsicHeight/placement`, untouched). The Renderer's new `ImageResolver` type (`(refId: string) => { kind: "PLACEHOLDER" } | { kind: "RESOLVED"; url: string }`) is the paint-content boundary; `defaultPlaceholderImageResolver` always returns `PLACEHOLDER` (no network/file access, no decode). Surrounding text is never repositioned based on any resolved-image dimension — the image unit's own paint extent is derived exactly like any other placed atom, from `yTick` deltas already fixed by Core (test 14).

## 11. Ruby Status

Logical grouping and base-text body placement: PASS (test 16 — the base unit paints at the identical `tickToPx(yTick + indent, scale)` coordinate as any other unit; the annotation's PENDING status carries no coordinate of its own and never shifts it). Annotation placement: **PENDING**, recorded as `RubyAnnotationStatus = "PENDING"` — confirmed by direct grep that `core/ruby/index.ts`'s `placeRuby()` is never invoked by the compose pipeline and `PlacedUnit.rubyBoundaryPolicy` is never set anywhere outside its own type declaration (`schema.ts`). No exact canonical annotation geometry exists to paint, so none is fabricated. The PENDING label is DEBUG-mode-only (never shown in NORMAL PREVIEW, per instruction not to let a provisional badge pollute the normal architecture).

**RUBY PLACEMENT MICRO-LOOP REQUIRED NEXT: YES.** A final Preview cannot paint ruby annotation at all — not even provisionally positioned — until `placeRuby()` is wired into the compose pipeline and `PlacedUnit` (or a new field) actually carries computed annotation geometry. This is a concrete technical dependency (the Renderer has nothing to paint without it), not an undefined Product-behavior question, so it is named here as the next task rather than asked as a Human Product decision.

## 12. TCY Status

`PaintUnitKind` recognizes `TCY` as one atomic paint item (test 17: exactly one `PaintPlacedUnit` for a 4-character TCY run, never decomposed). No auto-detection logic exists (`TCYUnit` is only ever produced by explicit fixture/Normalizer input, never inferred inside `renderer/preview/`). Shaping (rotation/scaling to fit vertically) is not implemented — the unit paints as ordinary horizontal text inside its own box, a clean, disclosed placeholder boundary for P3-O03 to implement without touching Core layout.

## 13. Dash / Ellipsis Status

Both are painted via the same generic `PaintPlacedUnit` path as TEXT — semantic identity (`runKind`), source order, and canonical placement (`yTick`) are preserved exactly (tests 18/19); no centering/optical-alignment adjustment of any kind was added. `provisional: true` is set for both kinds, visible in both NORMAL and DEBUG mode as a real content-level fact (not dev-only chrome).

## 14. Colophon / Folio / Header

**Colophon:** sufficient `CanonicalDocument` geometry is already available — `ColophonBlock` is, by Core's own design (`core/colophon/index.ts`), just `{ sourceBlockId, pages: CanonicalPage[] }`, identical in shape to body pages. `buildColophonPaintPages` reuses the exact same page/column/line/unit paint logic as the body, parameterized by a fixed `orientation: "horizontal"` Renderer-side convention (TSP-LOOP-005 precedent — colophon is typeset horizontally; no per-document Core flag exists for this, none was invented). Proven by a direct test reusing an already-composed page's real geometry as a hand-built `ColophonBlock`.

**Folio/header:** `CanonicalPage.folio?: PlacedUnit` exists in the schema (Contract §15) but is never populated anywhere in `core/` (confirmed by grep — `folio` appears only in its own type declaration). `PaintPage.folio` passes this field through unchanged; the Renderer paints nothing extra when it is absent (today, always). **Recorded as PENDING CORE DATA** — no folio/header placement was invented.

## 15. Debug / Traceability

`PaintDebugInfo` (attached to every `PaintPlacedUnit`) exposes: page/column/line order, source span, unit kind, the raw `GeometryTick` `yTick` coordinate, `isParagraphStartLine`, and `manualBreakBeforePage`. `PreviewRenderer.tsx`'s DEBUG mode additionally surfaces this as visible badges/tooltips (page label, column/line residual-space badge, per-unit debug tooltip, ruby-annotation-pending label) and HOLD reasons are always shown (both modes — a HOLD state is real content information, not dev-only chrome). Break-reason-per-unit (the specific `BreakOpportunityReason` that produced a given cut) is **not** exposed — `PlacedUnit` itself carries no such field from Core, and reconstructing it would require re-deriving break opportunities inside the Renderer, which is explicitly prohibited (§4). This is a disclosed limitation, not a silent gap. NORMAL mode renders none of this — confirmed directly by test 21 (`class="debug-info"`, `class="page-label"`, `annotation pending` all absent from the NORMAL artifact's HTML, all present in the DEBUG artifact's).

## 16. Tests

24 new tests across two files:
- `paintModel.test.ts` (19 tests): CanonicalDocument immutability, page-count/line-break non-mutation, GeometryTick determinism, scale-changes-paint-only, font-paint-scaling, first-line indent, manual-break non-fabrication, paragraph-break preservation, blank-paragraph preservation, multi-column source order, multi-page source order, bounded page window, image occupancy, HOLD exclusion, ruby body position, TCY atomicity, dash preservation, ellipsis preservation.
- `generateFoundationArtifact.test.ts` (5 tests): artifact generation (writes both NORMAL and DEBUG HTML), debug-mode-does-not-alter-layout, normal-mode-omits-debug-decoration, provisional-badge-vs-debug-only-label distinction, colophon horizontal-orientation convention.

All 21 items from the task's own "P3-O09 FOUNDATION TESTS" list are covered (numbered inline above where a specific numbered test exists; items without a distinct number — e.g. "CanonicalDocument immutability," "renderer cannot change page count/line breaks" — are tests 1/2/3).

## 17. Human Visual Artifact

`typesetting-v2/qa/visual/p3-o09-preview/index.html` (NORMAL PREVIEW) and `.../debug.html` (DEBUG / INSPECTION) — both non-Production, Human-openable, generated by a vitest test side effect (no bundler, no dev server, no client-side JavaScript). The historical Stage D artifact (`qa/visual/stage-d/index.html`) is untouched, preserved as-is. All 11 controlled fixtures (F20, long non-repeating prose, paragraph+blank-line, manual-page-break, two-column, multi-page, ruby, TCY, dash/ellipsis, image, HOLD) are present in both artifacts. This artifact demonstrates architecture/visual continuity only — it is not a final special-unit typography judgment (ruby annotation, TCY shaping, dash/ellipsis optical alignment all remain visibly unfinished by design, per §11–13).

## 18. Remaining P3-O09 Work

Not done by this foundation task (all explicitly out of scope per the task's own instructions): Production/`src/` integration; final ruby annotation geometry + paint (blocked on the ruby placement micro-loop, §11); TCY visual shaping (P3-O03); dash/ellipsis optical alignment (P3-O04/O05); exact ruby overhang numeric values (P3-O06 residual); full page-window virtualization beyond the bounded-window mechanism already present; any Publication-renderer sharing (P3-O08 stays fully separate, untouched).

## 19. Next Technical Task

**Ruby Placement Micro-Loop** — wiring `core/ruby/index.ts`'s `placeRuby()` into the compose pipeline so a `PlacedUnit` (or a new, explicitly-scoped field) carries real annotation geometry. This is chosen over P3-O03/O04/O05 by dependency order, not Human preference: the final Preview Renderer cannot paint ruby annotation in any form — not even a provisionally-positioned one — without this Core-level wiring existing first, whereas TCY shaping, dash alignment, and ellipsis alignment are all pure Renderer-side visual polish that can proceed independently of any further Core change. This is a technical dependency conclusion, not a Product-behavior question, so no Human Product decision is requested for it; a Human Product decision would only become necessary if the wiring work surfaces a genuine undecided policy question (e.g., an exact overhang numeric value, already tracked separately as the P3-O06 residual).
