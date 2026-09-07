# P3-O08 — Publication Renderer Foundation

## 1. Verdict

**FOUNDATION: PASS. P3-O08 (the full frozen item): IN PROGRESS, not complete.**

This task builds the first architectural slice of the v2 Publication
Renderer (`typesetting-v2/renderer/publication/`) — a renderer-independent,
physical-millimeter paint model consuming `CanonicalDocument` directly (no
browser DOM, no screenshot, no dependency on the Preview Renderer), plus a
real jsPDF-based generator that emits genuine PDF bytes derived from that
model's own physical coordinates. It does **not** finish Publication
Quality typography (no CJK glyph rendering yet — see §21's honestly-named
blocker) and does **not** modify Production/`src/`.

## 2. Frozen Roadmap Position

Master (`TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` v1.8) §1.3/§25.5/
§28.8/§28.10 and `PHASE3_OPEN_ITEMS.md` row P3-O08 confirm: Publication
Renderer technology selection is explicitly OPEN (Master §7 white-sheet
rule, deferred past Phase 2 on purpose); Preview and Publication are
**independent, parallel output-technology tracks** over the same
`CanonicalDocument` (§25.5: "Preview/Publication rendererは異なる技術を
使用してよい"); the three quality gates — Logical (Core), Preview, and
Publication — are explicitly independent (§28.10: "Core PASSはPreview
PASSを意味せず、Preview PASSはPublication PASSを意味しない"). P3-O09
closing (§0 below) does not imply anything about P3-O08's own readiness,
and P3-O08 starting does not require P3-O06/O07/F06 to resolve first.

## 0. P3-O09 Closure (recorded by this same task, per instruction)

**Human/Product decision: APPROVED.** `PHASE3_OPEN_ITEMS.md` row P3-O09
updated from "IN PROGRESS" to **CLOSED / PASS** — every architecture item
audited in `qa/evidence/P3_O09_CLOSURE_READINESS_AUDIT.md` is PASS or a
disclosed non-blocking boundary; the optional colophon end-to-end artifact
fixture is explicitly recorded as a **non-blocking follow-up**, not a
condition of closure. P3-O06 (ruby exact overhang values), P3-O07 (TCY
auto-detection), P3-O08 (this task), and F06 (Hanging) all remain
separately, explicitly OPEN/DEFERRED — none was silently folded into
P3-O09's closure. No code was changed to close P3-O09; only
`PHASE3_OPEN_ITEMS.md` and `PHASE3_LOOP_LOG.md` were updated.

## 3. Frozen Acceptance Criteria

No standalone pre-existing "P3-O08 acceptance criteria" document exists —
`PHASE3_OPEN_ITEMS.md` row P3-O08 itself is the only frozen record:
*"Publication (PDF) renderer selection/proof... P2-L01 confirmed native
Chromium print-to-PDF produces genuinely selectable vertical text for
content that fits one page, but did NOT confirm multi-page
auto-pagination; the Vivliostyle CLI path hit an unresolved tooling
blocker."* Master §4.2/§11.2/§25.6 add: InDesign is the Publication Quality
*reference*, not a copy target; Human Visual QA is mandatory for any
Publication PASS claim (§11.2); Publication output is canonical
(§1.1) — PDF/JPG are the "正本" (authoritative copy), not a convenience
preview. This task's own descriptive label, "P3-O08 Publication Renderer
Foundation," follows the same no-numeric-sub-loop convention P3-O09's own
Foundation task established.

## 4. Legacy Export Audit

Direct-read of `src/utils/exportPdf.ts` and `src/utils/exportCapture.ts`
(read-only, unmodified): the current Production export pipeline is
**entirely screenshot-based** — `capturePageToCanvas` (`exportCapture.ts`)
uses `html-to-image`'s `toCanvas()` to serialize the live Preview DOM's
*computed* styles into an SVG `<foreignObject>` and rasterize it via the
browser's own renderer; `exportPdf.ts` then converts that raster to a
grayscale PNG (`canvasToGrayscalePng`, real `/DeviceGray` for jsPDF's own
color-space detection) and calls jsPDF's `addImage()` to embed it as a
full-page image — jsPDF is used **only as a page container for a raster
image**, never for vector text/shape placement. Page sizing comes from a
hardcoded `PAPER_SIZES` mm table (A5/B5/B6/新書/A6/文庫) plus a bleed/trim/
crop-mark system (`cropToTrimCanvas`, `mode: 'trim'|'bleed'|'full'`).

**Confirmed exactly the antipattern this task's frozen contract forbids
for the new architecture:** the Preview DOM is the layout/rendering
authority for every current export — there is no independent Publication
typesetting anywhere in the legacy pipeline. This is not a design flaw to
fix in `src/` (out of scope, untouched) — it is the reason P3-O08 exists
as a distinct, independent Core-driven track rather than "make the
existing export nicer."

**Compatibility requirement carried forward, not solved here:** the legacy
grayscale (`/DeviceGray`) requirement and physical paper-size table both
reflect real, already-Human-validated Product requirements (Master §1.1:
grayscale/monochrome manuscript output) that a future, more complete
Publication Renderer will need to honor — recorded, not implemented, in
§21.

## 5. Preview / Publication Separation

Verified directly, not assumed: `typesetting-v2/renderer/publication/`
imports nothing from `typesetting-v2/renderer/preview/` (confirmed by
reading every import statement in `paintModel.ts`, `pdfGenerator.ts`,
`fixtures.ts`, `geometry.ts` — all imports resolve to `../../core`,
`../../tools/compare/fixtureBuilder`, `jspdf`, or Node's own `fs`/`path`).
`pdfGenerator.ts` never touches `document`, `window`, React, or any CSS/
style string. Both renderers are proven **sibling consumers** of the same
`CanonicalDocument`/`LogicalUnit[]`/source triple — neither depends on the
other's module, output, or DOM.

## 6. Publication Renderer Contract

`renderer/publication/paintModel.ts` exposes one entry point,
`buildPublicationDocument(id, label, document: CanonicalDocument, units: LogicalUnit[], source: string, ctx: PublicationRenderContext): PublicationDocument`
— read-only `CanonicalDocument`/`LogicalUnit[]` consumption (test 1: deep-equal
snapshot before/after, unchanged), a paint-only `PublicationRenderContext`
(tick settings + font-identity pair + optional image resolver — no
`scaleMultiplier`, since physical output has no display-zoom concept), and
nothing else. It does not accept or perform tokenization, kinsoku,
capacity calculation, line breaking, page breaking, ruby logical break
decisions, TCY recognition, or image flow calculation — confirmed by
direct reading of the file: no `deriveBreakOpportunities`/`composeLine`/
`composeColumn`/`composePage` call exists anywhere in
`renderer/publication/`. `renderer/publication/pdfGenerator.ts` exposes
`generatePublicationPdf(doc: PublicationDocument): { bytes, pageCount }` —
consumes ONLY the paint model above, never `CanonicalDocument` directly,
never a DOM node.

## 7. Canonical Physical Geometry

`renderer/publication/geometry.ts`'s `tickToMm(tick) = tick * 0.001` is the
single, one-way conversion (Contract §21: 1 tick = 0.001mm exactly) — a
plain multiplication, no rounding, no display-scale parameter (deliberately
absent, unlike Preview's `scaleMultiplier` — see the file's own comment).
Test 5 proves the conversion directly (1000 ticks → 1mm exactly; 51856
ticks → 51.856mm). Page physical size is derived the identical way Preview
derives its own page pixel size (same tick arithmetic, confirmed by
direct comparison against `renderer/preview/paintModel.ts`'s own
`buildPaintPage`): `page.widthMm = tickToMm(columnsPerPage * columnExtentTicks)`,
`page.heightMm = tickToMm(lineExtentTicks)`. No px/CSS value is read,
written, or round-tripped anywhere in `renderer/publication/`.

## 8. Font / Measurement Identity

`PublicationDocument.fontIdentityMismatch = ctx.measurementIdentity !== ctx.paintFontIdentity`
— the identical structural pattern already proven correct and PASS for
Preview (`P3_O09_CLOSURE_READINESS_AUDIT.md` §14). Test 17 proves the flag
toggles correctly and, critically, that **geometry is byte-identical either
way** (`modelB.pages` deep-equals `modelA.pages` even when the flag
differs) — a mismatch is surfaced as a fact, never as a trigger to
recompute any coordinate. No consumer (a future evidence doc, PDF viewer,
or Human) is told a warning was silently acted upon.

## 9. Normal Body Paint

Ordinary canonical body text places at exactly the physical coordinates
Core already computed (`yTick`→`topMm`, cumulative, indent-adjusted) —
tests 4/6. No browser line wrapping, no PDF text-flow engine, no
independent line-breaking exists anywhere in this module (confirmed by the
same "no compose-function import" grep as §6). `generatePublicationPdf`
places one vector rectangle per placed unit at its own true `(x, y,
width, height)` mm rectangle — real jsPDF `rect()` calls, real physical
coordinates, never a screenshot of anything.

## 10. Paragraph / Break Semantics

Test 7: first-line auto-indent is preserved as a physical mm offset
(`line.indentMm`), matching Preview's own already-proven-correct
`indentTick`→paint-offset convention exactly. Test 8: manual page break is
preserved — content after `MANUAL_BREAK` composes on a new physical page,
and the new page's first line correctly carries no fabricated indent
(`indentTick` stays `undefined`, the same STAGE-D-FIRST-LINE-INDENT fix
Preview already carries forward, verified independently here rather than
assumed). Test 9: a blank paragraph (two consecutive bare `PARAGRAPH_BREAK`
markers) composes without HOLD or fabricated content. Test 3: line/column/
page break counts are preserved exactly between `CanonicalDocument` and
the Publication paint model for a multi-page fixture.

## 11. Ruby

Test 10: the Publication paint model reads Core's own already-placed
`rubyBoundaryPolicy`/`rubyReadingOffsetTick`/`rubyReadingExtentTick` fields
read-only (via `rubyAnnotationFor`, structurally identical to Preview's own
`rubyAnnotationFor` except mm instead of px) — it never calls `placeRuby()`
itself, never centers/clamps/measures the annotation on its own, and never
chooses a ruby segment break. P3-O06's own residual (exact overhang
numeric values) is **not** solved here — the shipped rule set still ships
an empty overhang table, so every overflowing case still resolves to
`OVERFLOW_OPEN`, exactly as it does for Preview; this is preserved and
disclosed, not silently "fixed" by this task. The current canonical
placement (whatever policy Core already resolved) is what gets painted —
no independent Publication-side reflow of ruby exists.

## 12. TCY

Test 11: an explicit 4-character TCY run remains exactly one atomic paint
item, never decomposed — the same invariant Preview's own `paintKindFor`
dispatch already proves, re-verified independently for this module's own
code path rather than assumed by analogy. No CSS `text-combine-upright`
concept exists here (Publication has no CSS at all) — the Publication
paint model exposes the TCY unit's own text and canonical mm box; **how**
a future, more complete Publication renderer visually composes that
horizontally within a vertical column (equivalent to `text-combine-upright`'s
effect, but via a PDF-native mechanism such as a rotated/scaled text run)
is explicitly not solved by this foundation — named in §21.

## 13. Dash

Test 12: Dash's semantic identity (`runKind`, `SourceSpan`, one-atom
extent) is preserved exactly, structurally verified against
`CanonicalDocument`'s own `PlacedUnit`. Test 13 is the honest, explicit
finding this section exists to record: **the P3-O04 per-grapheme
seam-overlap paint treatment (`dashGlyphs`, Preview's own CSS-DOM-specific
mechanism of splitting one shared text node into several absolutely-
positioned, overlapping `<span>` elements) is NOT reproduced at the
Publication layer by this foundation.** No `dashGlyphs`-equivalent field
exists anywhere in `renderer/publication/paintModel.ts` — confirmed by
direct grep, not by omission. This is a disclosed gap, not a silent one:
Publication's own Dash paint currently draws the run's single canonical
bounding-box rectangle only (§9), with no seam-continuity treatment of any
kind, because (a) no real glyph rendering exists yet to have a seam
problem in the first place (§21), and (b) even once glyphs exist, jsPDF's
vector text model is different enough from CSS-DOM absolute positioning
that the exact same technique cannot simply be copied — it would need its
own, independently-justified Publication-side design, per Master's own
gate-separation principle (§28.10). `dash.provisional === true` at the
Publication layer, regardless of Preview's own CLOSED status for the same
semantic kind.

## 14. Ellipsis

Test 14: Ellipsis's `SourceSpan` and text (`"……"`, 2 code points) are
preserved exactly; no dot/glyph split is fabricated. Consistent with
P3-O05's own conclusion (native, unmodified treatment) — Publication's
current non-treatment (a bounding box only, §9) is the natural analogue of
"no special paint code needed," though for the same reason as Dash (§13),
this has not been independently confirmed correct for Publication's own
paint mechanism (no real glyph rendering exists yet to judge).

## 15. Images

Test 15: Core continues to own image occupancy
(`ImageUnit.refId/intrinsicWidth/intrinsicHeight/placement`, untouched);
the Publication `ImageResolver` type is a direct structural copy of
Preview's own disclosed placeholder boundary (`defaultPlaceholderImageResolver`
always returns `PLACEHOLDER` — no network/file access, no decode). Real
image byte embedding (jsPDF supports `addImage()` for this, already proven
functional by the legacy pipeline for raster PNGs) is a small, well-
understood next step once a real resolver is supplied — not attempted in
this foundation, per instruction not to build persistence/decoding
infrastructure here.

## 16. Colophon / Folio / Header

**Not implemented in this foundation.** `PHASE3_O09_CLOSURE_READINESS_AUDIT.md`
§11 already established that P3-O09's own colophon support is
architecturally proven but not required for closure; the same reasoning
applies here — no frozen P3-O08 acceptance document requires colophon/
folio/header for this foundation slice, and none was fabricated. Folio/
header remain PENDING CORE DATA (`CanonicalPage.folio` still never
populated anywhere in `core/`, confirmed unchanged by this task).

## 17. HOLD / Diagnostics

Test 16: `generatePublicationPdf` **throws** (never silently emits a
normal-looking PDF) when given a HOLD `PublicationDocument` — a
structural refusal, not a warning that could be ignored. This is stricter
than Preview's own HOLD handling (which renders a banner page) precisely
because Publication output is the canonical, authoritative artifact
(Master §1.1) — a Human should never receive a Publication PDF that quietly
omits unresolved content. No "banner-only PDF" concept was invented, since
no frozen contract defines one; the exact next decision (should a HOLD
Publication attempt instead produce a diagnostic PDF, or is refusal
correct?) is named as a future Product question, not decided here.

## 18. Determinism

Test 6/18: two independent `buildPublicationDocument` calls against the
same `CanonicalDocument`/units/source/context produce a deep-equal
`PublicationDocument` — the SAME determinism guarantee already proven for
Preview, re-verified independently for this module. **Byte determinism of
the generated PDF file itself is explicitly NOT claimed** — jsPDF embeds a
creation-date metadata field and internal object-numbering that can differ
run-to-run even for logically-identical input (a well-known property of
most PDF writers, not specific to this implementation); this foundation
tests **logical** determinism (page count, coordinates, content ordering)
exclusively, never asserting the output bytes are identical across runs.

## 19. Tests

`renderer/publication/paintModel.test.ts` — 18 tests, all passing,
covering the task's own required list exactly (CanonicalDocument
immutability, page count, break preservation, source order, tick→mm
determinism, body-placement determinism, paragraph indent, manual break,
blank paragraph, Ruby canonical geometry consumption, TCY atomicity, Dash
identity, Dash Publication-treatment gap disclosure, Ellipsis identity,
image occupancy, HOLD refusal, font-identity-mismatch structural handling,
same-input determinism). `renderer/publication/generatePublicationArtifact.test.ts` —
3 tests: real PDF byte generation + `%PDF-` header check for the
dash-ellipsis fixture; every foundation fixture composes and generates
without throwing, with page counts matching; F20's own coordinate-fidelity
sweep (no placed unit's bottom edge exceeds its own page's physical
height), the mm-equivalent of Preview's own Page Content Clipping
regression, run independently here rather than assumed inherited.

**Full regression:** Core 347/347, Stage C (`tools/compare`) 21/21, Stage D
(`tools/preview-dev-adapter`) 30/30, P3-O09 (`renderer/preview`) 114/114,
P3-O08 (`renderer/publication`) 21/21 — all PASS. `npx tsc --noEmit`: 0 new
errors (only the known pre-existing `src/app/layout.tsx(33,50)` baseline
error remains).

## 20. Generated Artifact

`typesetting-v2/qa/publication/p3-o08/dash-ellipsis.pdf` — a real,
structurally valid PDF file (verified: begins with the `%PDF-` magic
header, non-trivial byte size), generated entirely from
`CanonicalDocument` via `buildPublicationDocument` + `generatePublicationPdf`,
with **zero** browser/DOM/screenshot involvement anywhere in its
generation path. It contains one vector rectangle per placed canonical
unit at that unit's true physical mm coordinates — it does **not** yet
contain any Japanese (or other) text glyphs (§21's disclosed limitation).
This artifact demonstrates coordinate/architecture fidelity only; it is
explicitly NOT a Publication Quality claim and has not been shown to any
Human for visual QA (there is, honestly, nothing typographic yet to judge —
only rectangles).

## 21. Remaining P3-O08 Work

Not done by this foundation (all explicitly out of scope or blocked, named
rather than silently skipped): **font embedding for real CJK glyph
rendering** (the dominant blocker — jsPDF's built-in fonts have no CJK
coverage; a real Publication Quality PDF cannot exist without embedding a
licensed, CJK-capable font file, which this task correctly declined to add
without an approved dependency/asset gate, per instruction); vertical
writing-mode text shaping within the PDF (character rotation for
punctuation, TCY horizontal-in-vertical composition, ruby annotation
visual rendering) — all depend on the font-embedding blocker above; Dash
seam-continuity and Ellipsis visual treatment at the Publication layer
(§13/§14, both explicitly disclosed as unstarted, not "inherited" from
Preview); real image byte embedding (mechanism exists via jsPDF's own
`addImage`, not wired to a real resolver); grayscale/`DeviceGray` color
space handling (a real, already-Human-validated Product requirement the
legacy pipeline already satisfies for raster images — not yet addressed
for a vector-primitive Publication renderer, though vector drawing with
`setDrawColor(0,0,0)` is already inherently monochrome for this
foundation's own rectangles); the legacy paper-size/bleed/trim/crop-mark
system (`PAPER_SIZES`, `mode: trim/bleed/full`) — a real Product
requirement not yet ported to the canonical `pageWidthMm`/`pageHeightMm`/
`marginsMm` model; colophon/folio/header Publication support (§16);
multi-page auto-pagination proof at the actual PDF-byte level beyond page
count (P2-L01's own original open question — page count is proven here,
but real multi-page *viewing* behavior in an actual PDF reader was not
independently re-verified in this task).

## 22. Exact Next Technical Task

**Font embedding decision.** Before any further Publication visual work
(TCY shaping, Dash/Ellipsis treatment, ruby annotation rendering) can
proceed meaningfully, a decision is needed on how to obtain and embed a
CJK-capable font for jsPDF (e.g., a licensed font asset the Product already
has rights to ship, vs. a different PDF-generation approach). This is
explicitly a Product/dependency-gate decision, not a technical one this
task can resolve unilaterally (per instruction: "do not commit font files,"
"no new dependencies without an approved gate"). Until resolved, further
Publication foundation work should focus on coordinate/architecture
completeness (grayscale color space, paper-size/bleed/trim porting, image
embedding) rather than glyph-level typography, which is blocked on this
one decision.
