# P3-O08 — Publication Physical Page & Vertical Paint Foundation

## 1. Verdict

**PARTIAL.** Physical page/content-box model: fixed and proven (real 文庫
paper size + margins, content INSET from paper edges, no painted content
outside the paper rect). Ruby: now provably within paper bounds (root
cause was the missing margin, not a Ruby-specific bug). Dash and Ellipsis:
given a best-effort 90° glyph rotation (jsPDF has no vertical-substitution
capability, confirmed by exhaustive API audit) — rotation DIRECTION is
this task's own best-effort choice, not independently visually verified,
and is explicitly flagged for the next round of Human Visual QA. **A
broader, GENERAL VERTICAL GLYPH ORIENTATION problem was found and
classified, NOT fixed** (ordinary punctuation — brackets/commas/periods —
likely also needs vertical-form treatment; see §7). TCY unaffected,
re-verified after the page-geometry fix.

## 2. Human HOLD Evidence

Second Human Visual QA round on the regenerated PDF found: (1) the page's
outer size was now approximately realistic (~104×148mm) but the body
column painted flush against the paper's right edge, with no margin; (2)
Ruby reading text existed in the PDF's own content stream but was not
visible on the rendered page — the Human's own hypothesis (body `東京` on
the rightmost column, annotation painting further right, likely pushed
outside the physical page) was confirmed correct by this task's own trace
(§5); (3) Dash `――` painted as two horizontal bars, not a vertical
Japanese dash; (4) Ellipsis `……` painted with horizontal dot orientation;
(5) TCY flagged for re-evaluation only after the content-box model was
fixed (not itself broken).

## 3. Question A — Where Does Real Paper Geometry Live?

Direct-read, before writing any code: `core/layout/schema.ts`'s
`CanonicalPage = {id, order, columns, folio?}` — confirmed (again,
independently of the prior task's own already-correct finding) zero
physical fields. `core/settings/index.ts`'s `LayoutSettings` DOES declare
`pageWidthMm`/`pageHeightMm`/`marginsMm: {top, right, bottom, left}` — but
its own doc comment states plainly: *"ingestion is implemented when
P3-L09 wires it into the line composer"* — confirmed NOT yet wired, by
direct read of `core/compose/page.ts`'s `PageCompositionSettings` (only
`columnsPerPage` + tick-based line/column extents, no margin/paper field
anywhere) and `core/compose/line.ts`/`column.ts` (no `marginsMm`/
`pageWidthMm` reference anywhere in either file). **Conclusion: no
authoritative resolved physical-paper-geometry source exists anywhere in
the currently-implemented Core.** This is a real, disclosed, pre-existing
gap (the `LayoutSettings` TYPE was declared at P3-L09 but never actually
consumed) — not something this task fabricates evidence for or silently
patches inside Core.

**Architecture adopted, per the task's own explicit permission**
("CanonicalDocument + ResolvedPublicationGeometry → Publication Renderer
if the frozen architecture supports render-only physical context"):
`renderer/publication/pdfGenerator.ts` now defines its own
`PublicationPageGeometry` interface (`paperWidthMm, paperHeightMm,
marginTopMm, marginBottomMm, marginRightMm [inside], marginLeftMm
[outside]`) — a Renderer-owned, render-only physical context, entirely
separate from `CanonicalDocument`. It is optional and additive to
`buildPaintPlan`/`generatePublicationPdf`; omitting it preserves the
exact prior (content-sized page, zero margin) behavior byte-for-byte
(proven by a dedicated regression test). **No Core change was made** —
the gap is real but fixing it inside Core (wiring `LayoutSettings` all
the way through `composePage`/`composeColumn`/`composeLine`) is a larger,
separate undertaking than this task's own scope, and per instruction this
task stops and reports rather than silently expanding into a Core change.

## 4. Question B — Page Size vs. Body Box (QA Fixture Record)

| Field | Value |
|---|---|
| physical page width mm | 105 |
| physical page height mm | 148 |
| inside (right) margin mm | 15 |
| outside (left) margin mm | 10 |
| top margin mm | 12 |
| bottom margin mm | 12 |
| body content rect | 80mm × 124mm |
| first/rightmost column x (before fix) | `page.widthMm - lineWidthMm` = flush against the content-sized "page" (which WAS the whole paper before this fix) |
| current PDF body x (after fix) | `(paperWidthMm - marginRightMm) - lineWidthMm` = inset 15mm from the real paper's right edge |
| distance body ink → right paper edge (before) | ~0mm (flush) |
| distance body ink → right paper edge (after) | 15mm (the declared inside margin) |

Paper size (105×148mm) matches the exact 文庫 value already authoritative
in the legacy Production export pipeline's own `PAPER_SIZES` table
(`src/utils/exportPdf.ts`, read-only-cited, not imported). Margins
(12/12/15/10mm) are this task's own hand-picked, disclosed, realistic
values (asymmetric, larger inside margin for binding) — not independently
sourced from a frozen Product spec, since none was found wired into Core
(§3). Content-area-derived capacity: `charsPerLine = floor(124/3.704) =
33`, `linesPerColumn = floor(80/3.704) = 21`.

## 5. Ruby — Traced Before Patching Position

Per instruction, did NOT shift Ruby left until visible — traced the
actual coordinate chain first: `atomic-ruby` fixture is `[TEXT "これは",
RUBY(東京/とうきょう), TEXT "の話だ。"]`, all of which fit on a single line
(line 0, the RIGHTMOST — and in this small fixture's own capacity, only
— line). The Ruby annotation paints to the physical right of its own
base line (`x + lineWidthMm + gap`), i.e., FURTHER toward the paper's
outer/right edge than the base run itself. Before this fix, "the page"
WAS the content's own right edge — meaning the base line's own right
edge already sat AT the (fake) page boundary, leaving the annotation
with literally zero room and pushing it off the emitted page entirely.
**Root cause confirmed: the missing margin, not a Ruby-specific
coordinate bug** (the underlying offset/extent math itself, already
regression-tested in the prior task, was correct). With `BUNKO_PAGE_GEOMETRY`
supplied, the base line now sits 15mm inside the real paper edge, and a
direct regression test proves the annotation's own painted column stays
within `[0, paperWidthMm]` for this exact fixture.

## 6. Question C — Vertical Glyph Orientation, Capability Audit

**jsPDF has no OpenType vertical-writing-mode substitution
capability — confirmed exhaustively, not assumed.** A case-insensitive
search of `node_modules/jspdf/types/index.d.ts` for `vert`/`Vertical`/
`writingMode`/`GSUB` returns exactly one match:
`getVerticalCoordinateString(value: number): number` — a coordinate-system
helper (converts a y-value between jsPDF's own top-down mm convention and
PDF's native bottom-up point convention), entirely unrelated to font
glyph shaping or `vert`/`vrt2` OpenType feature selection. jsPDF's own
README documents only whole-string `angle` rotation as a text-orientation
control — no per-glyph feature, no vertical metrics, no glyph
substitution table access of any kind.

**Determination:** the smallest deterministic, vector-only, no-new-
dependency paint-level fix available is rotating the GLYPH itself by 90°
via jsPDF's existing `angle` option — this was already proven viable for
horizontal-in-vertical TCY (used at `angle: 0` deliberately) and is now
applied in the OPPOSITE sense (a full 90° rotation, not zero) to
Dash/Ellipsis specifically, per §8/§9.

## 7. Ordinary Punctuation — Audited, Classified, NOT Fixed

**Per instruction: audited honestly rather than treating "characters
arranged top-to-bottom" as equivalent to "vertical typography is
correct."** Every ordinary TEXT-kind character (including 、。「」（）) is
currently painted through the identical, unrotated `verticalGraphemeCommands`
path as any kanji/kana character — no rotation, no in-cell repositioning
of any kind. Real Japanese vertical typesetting requires, for at least
these classes: corner brackets 「」 and parentheses （） conventionally
use a ROTATED (or dedicated vertical-form) glyph; commas/periods 、。
conventionally use a REPOSITIONED (not necessarily rotated) glyph, moved
toward the upper-left of their own em-square, often via a font's own
`vert` OpenType substitution. **Neither of these is implemented.**

**Classification: GENERAL VERTICAL GLYPH ORIENTATION BLOCKER — distinct
from, and larger than, Dash/Ellipsis's own simple 90°-rotation fix.**
Dash and Ellipsis were fixable with a single, uniform rotation (their own
glyphs are simple, roughly-symmetric strokes/dot-clusters with no
directional reading-order asymmetry beyond left-to-right vs top-to-bottom).
Brackets and punctuation are NOT uniformly fixable the same way — each
character class needs its OWN correct treatment (rotation for some,
repositioning for others, potentially a dedicated vertical Unicode form
for others still), which is a substantially larger, curated-data-driven
undertaking. **Explicitly not attempted in this task**, per instruction
not to keep special-case-patching character by character — named here as
its own future item (§10), not silently left unaddressed.

## 8. Dash — Vertical Orientation Fix

`dashGlyphCommands` now attaches `angle: DASH_ELLIPSIS_ROTATION_DEGREES`
(`-90`) to every glyph command. P3-O04's own approved Preview policy
(native stroke weight, 2-glyph guaranteed target, 0.16em overlap) is
otherwise completely unchanged — only the glyph's own paint ORIENTATION
was added; the overlap/positioning math from the prior task is untouched
and re-verified by its own still-passing regression tests. **Rotation
direction (-90, i.e., clockwise) is this task's own best-effort choice,
reasoned as: rotating a horizontal glyph clockwise moves its own
original LEFT end to the TOP** — NOT independently visually verified.

## 9. Ellipsis — Vertical Orientation Fix

Same `angle: -90` rotation applied to `verticalGraphemeCommands` calls
for ELLIPSIS specifically (via an explicit parameter, never silently
shared code path with Dash — confirmed Dash's own overlap treatment is
still NOT applied to Ellipsis, matching P3-O05's frozen scope exactly).
**Same rotation-direction caveat as Dash (§8) applies**, with an
additional dimension for ellipsis specifically: a 3-dot horizontal glyph
rotated -90° should read its 3 dots top-to-bottom in the SAME order they
originally read left-to-right — this specific property (dot ORDER after
rotation, not just "is it rotated") has not been independently verified
and is named explicitly for Human Visual QA.

## 10. TCY — Re-verified, Unaffected

TCY continues to paint with `angle: 0` (explicitly, never rotated — that
is the entire point of tate-chu-yoko) and was not touched by the
page-geometry fix beyond inheriting the same coordinate-offset mechanism
every other kind now shares. Re-verified after the geometry fix: atomicity
unchanged, horizontal-unrotated command unchanged, canonical occupancy
unchanged (all pre-existing regression tests still pass unmodified).

## 11. Publication Coordinate Contract (Clarified)

- **PaperRect**: `PublicationPageGeometry.paperWidthMm/paperHeightMm` —
  the real, physical output sheet.
- **ContentRect**: `paperRect` minus margins — where composed content is
  actually placed; its own dimensions must match what Core's own
  `lineExtentTicks`/`columnExtentTicks` assumed when composing (this
  task's own QA fixture derives its capacity from the content rect
  directly, by hand, since no Core-side formula exists to call — see §4).
- **Canonical body origin**: content rect's own top-right corner (vertical-rl).
- **Column/line origins**: `contentRightEdgeMm - column.rightMm -
  line.rightMm - line.widthMm`, unchanged in FORM from the prior task,
  only the reference edge changed (content rect's own right edge, not the
  paper's).
- **Unit-local placement**: `yOffsetMm (= marginTopMm) + unit.topMm`,
  unchanged in form.

All physical, GeometryTick/mm-derived throughout — no CSS px, no browser
layout, no content-bounding-box masquerading as paper size (the exact
defect this task fixes).

## 12. QA Fixture

Regenerated `publication-typography-qa.pdf` using `BUNKO_PAGE_GEOMETRY`
(105×148mm, 12/12/15/10mm margins) with content-area-derived capacity
(`charsPerLine:33, linesPerColumn:21`) — not an arbitrary page size with
zero margins. Same content coverage as before (ordinary prose including
、。「」, Ruby 東京《とうきょう》, TCY 2026, Dash ――, Ellipsis ……), same
manual-page-break-separated single real composition, same full pipeline.

## 13. Regressions Added

`typography.test.ts` — 4 new tests: (1) rightmost body column starts
inset from the paper's right edge by the declared margin, never flush;
(2) Ruby annotation's own painted column stays within paper bounds on
the fixture's rightmost line; (3) Dash/Ellipsis carry a -90° rotation,
TCY explicitly carries 0°, ordinary TEXT/Ruby-base carry no rotation at
all; (4) omitting `pageGeometry` preserves the exact prior (content-sized,
zero-margin) behavior — backward compatible. Plus, inline in the combined
QA PDF's own test: every page uses the real paper size (not a
content-derived one), and no painted command's own bounds fall outside
the physical paper rect (a direct, geometric "nothing off-page" proof,
covering the exact class of defect Ruby's own invisibility was traced
to). **Tests:** 66/66 `renderer/publication/` (62 previous + 4 new). Full
regression: Core 364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114 —
all PASS. `npx tsc --noEmit`: 0 new errors.

## 14. Remaining Blockers

1. **Rotation direction for Dash/Ellipsis (-90°) is unverified** — a
   best-effort, disclosed choice, not confirmed against a rendered page.
2. **General Vertical Glyph Orientation Blocker (§7)** — ordinary
   punctuation (brackets, commas, periods, and likely others not yet
   audited: quotation marks, small kana, etc.) has NO vertical-form
   treatment at all. This is a real, likely-visible defect in the QA
   PDF's own ordinary prose section, named honestly rather than hidden
   behind Dash/Ellipsis's own narrower fix.
3. **No real physical-paper-geometry source exists in Core** (§3) — this
   task's own `PublicationPageGeometry` is a Renderer-only workaround,
   correctly scoped as such, but a future task may need to decide whether
   `LayoutSettings.pageWidthMm`/`marginsMm` should finally be wired into
   Core's own composition (a genuine, larger architectural decision, not
   started here).

## 15. Exact Next Technical Task

Human Visual QA of the regenerated `publication-typography-qa.pdf`,
specifically checking: (a) body text now sits inset from the page edges
with visible margins; (b) Ruby annotation is now visible and correctly
positioned; (c) Dash/Ellipsis rotation — do they now read as intended
vertical forms, and is the rotation DIRECTION correct (not mirrored/
upside-down)? If rotation direction is wrong, flip
`DASH_ELLIPSIS_ROTATION_DEGREES` from -90 to 90 (a one-line, clearly
isolated fix). Separately and independently: a Product/technical decision
on whether to invest in the General Vertical Glyph Orientation Blocker
(§7) now or defer it — this is a substantially larger effort than
anything done in this task and was not started.
