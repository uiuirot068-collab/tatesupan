# P3-O08 — Publication Typography

## 1. Verdict

**MACHINE PASS.** Ruby, TCY, Dash, and Ellipsis are each independently
re-derived for vector PDF paint in `renderer/publication/pdfGenerator.ts`,
reproducing the same frozen semantic/canonical decisions Preview already
established, without copying any of Preview's CSS/DOM implementation
technique (none of which exists in a PDF's own paint model). A combined
Human QA PDF (`qa/publication/p3-o08/publication-typography-qa.pdf`) was
generated covering all four treatments plus ordinary body text in one
real, multi-page, manual-page-break-separated composition. Ready for
Human Visual QA; not yet claimed as final Publication Quality.

## 2. Preconditions

Confirmed at task start: P3-O08 Foundation PASS, CJK font embedding PASS
(Human PDF QA PASS), real Shippori Mincho MeasurementFacts PASS, and
`measurementIdentity === paintFontIdentity` (both "Shippori Mincho
Regular"). All three prior evidence docs
(`P3_O08_PUBLICATION_RENDERER_FOUNDATION.md`,
`P3_O08_FONT_EMBEDDING_GATE.md`, `P3_O08_REAL_MEASUREMENT_FACTS.md`)
re-read before writing any code for this task.

## 3. Measurement / Font Identity

Every fixture composed in this task's own tests uses `createFakeMeasurementProvider()`
(matching every other Publication test in this session — the real
provider's parity with it was already proven exhaustively in the prior
task) and the same committed Shippori Mincho asset for painting. Every
test that checks `model.fontIdentityMismatch` asserts `false`.

## 4. Publication Paint Architecture

**Audited jsPDF's actual capabilities before writing paint code** (not
from memory): `text(str, x, y, {align, angle, baseline})` — `align` ∈
`{left, center, right, justify}`, `angle` accepts a rotation in degrees
(or a matrix), `baseline` ∈ `{alphabetic, ideographic, bottom, top,
middle, hanging}` (`node_modules/jspdf/types/index.d.ts:556-570`,
directly read). `getTextWidth(text)` measures a string against the
currently-set font/size, in the document's own configured unit (mm here).
`rect(x, y, w, h)` for vector rectangles. No character-spacing/kerning
primitive was needed or used.

**Critical discovery, not assumed:** `vi.spyOn(jsPDF.prototype, "text")`
throws `"text does not exist"` — jsPDF v4's plugin system attaches
`text`/`rect`/etc. as per-instance own properties, not shared prototype
methods, so classic prototype-spying does not work. **Architectural
response:** split `pdfGenerator.ts` into two stages — `buildPaintPlan(doc,
hasFont): PaintPlan` (pure, jsPDF-free, plain-data `PaintCommand[]` per
page) and `renderPaintPlanToPdf(plan, fontResource)` (a thin, mechanical
executor with zero typography decisions of its own, just calls jsPDF
primitives per command). Every typography assertion in
`typography.test.ts` tests `buildPaintPlan`'s own pure output directly —
more precise and more robust than spying on library internals would have
been anyway. `generatePublicationPdf` is now a two-line composition of
both stages (unchanged public signature/behavior for existing callers).

## 5. Ruby Audit

Direct-read of `core/compose/line.ts` before writing paint code: a RUBY
`PlacedUnit` carries `rubyBoundaryPolicy`/`rubyReadingOffsetTick`/
`rubyReadingExtentTick`, already consumed read-only by
`renderer/publication/paintModel.ts`'s own `rubyAnnotationFor` (unchanged
by this task) into `RubyAnnotationPaint{status:"PLACED", policy, offsetMm,
extentMm, text}`. Confirmed: a RUBY placed atom carries its FULL base
string (e.g. `"東京"`, both characters together — unlike TEXT, which is one
atom per character), so per-grapheme splitting for painting happens at
paint time, not at composition time.

## 6. Ruby Scale Observation — Classification

**Classification: B — paint-only choice, NOT a canonical measurement
contract gap.** Reasoning, following the task's own required audit: (1)
the canonical `rubyReadingExtentTick` represents RESERVED SPACE (the
extent the reading run must not overflow without triggering
`OVERFLOW_OPEN`), computed from the body font size per
`qa/evidence/P3_O08_REAL_MEASUREMENT_FACTS.md` §8's own finding — it is
NOT a claim about what font SIZE the annotation must be painted at; (2)
Preview's own already-Human-approved implementation
(`renderer/preview/PreviewRenderer.tsx`'s `.ruby-annotation { font-size:
0.55em; }`) already paints the annotation SMALLER than the reserved
extent's own body-font-size-based magnitude would suggest — a
Renderer-only, paint-time sizing decision, independent of the canonical
value, already shipped and Human-QA'd; (3) nothing in the frozen Core
Contract (§17/§18) claims the Renderer must paint text at exactly the
font size the extent was CALCULATED against — only that it must not
recalculate the extent itself. **Publication re-derives the same
paint-time ratio (`RUBY_ANNOTATION_FONT_RATIO = 0.55`) independently**,
citing Preview's own precedent rather than copying its CSS mechanism. No
Core change was made or needed; this task did not proceed down a
"canonical blocker" branch because none was found.

## 7. Ruby Paint

`buildPaintPlan` → `unitCommands` (RUBY branch): base run painted via
`verticalGraphemeCommands` (per-grapheme, vertically stacked, matching
ordinary TEXT's own algorithm); when `rubyAnnotation.status === "PLACED"`,
the annotation's own graphemes are painted starting at `unit.topMm +
ann.offsetMm`, spanning `ann.extentMm`, at `RUBY_ANNOTATION_FONT_RATIO ×
bodyFontSize`, positioned to the physical right of the base column (the
vector equivalent of Preview's `left: 100%` CSS). Fixture
(`atomic-ruby`): 東京《とうきょう》. Tests confirm: annotation text commands
exist for both base and reading graphemes; `PublicationDocument` is
unchanged by generating the plan or the PDF (via `structuredClone`, not a
JSON round-trip — see §13's own methodology note); font identity match;
canonical body coordinates unaffected.

## 8. TCY Paint

TCY ("tate-chu-yoko" — horizontal-in-vertical) painted as ONE horizontal
(unrotated, `angle: 0`) text command for the whole run — never per-digit,
never rotated (an earlier draft of this task's own code mistakenly set
`angle: -90`, which would have made "2026" read sideways; caught and
fixed before this evidence was written — see §15). Fit strategy: a single
measure-then-scale pass using the REAL registered font's own
`getTextWidth` (executed in `renderPaintPlanToPdf`, since `buildPaintPlan`
itself stays jsPDF-free — the plan carries a `maxWidthMm` hint bounded by
the unit's own canonical single-cell `line.widthMm`, never wider). No
general auto-fit policy was invented — P3-O03's own frozen evidence never
defined a numeric fitting rule (Preview relies on the browser's own
`text-combine-upright` engine, which has no PDF equivalent); this is the
smallest deterministic strategy for the currently-approved `explicit-tcy`
fixture (`西暦2026年`). TCY remains exactly one canonical atom throughout
(unchanged, confirmed by test) — no auto-detection was implemented or
touched (P3-O07 remains untouched and OPEN).

## 9. Dash Paint

Re-derived P3-O04's own approved concept (native Shippori Mincho glyph +
per-grapheme paint split + 0.16em overlap) independently for vector
coordinates — never importing Preview's `dashGlyphsFor` (Publication and
Preview remain sibling, non-dependent consumers). `DASH_OVERLAP_EM = 0.16`
re-declared as its own constant, citing P3-O04's evidence doc as the
source of the value, not the code. Algorithm: identical shape to
Preview's own (first glyph starts at the run's own canonical top, each
subsequent glyph overlaps the previous by half the overlap amount on each
shared edge, last glyph's bottom reaches the run's own canonical bottom —
the run is never visibly shortened), computed in physical mm instead of
px. Fixture (`dash-ellipsis`): exactly 2 paint commands for `"――"`,
overlap proven deterministically (second glyph's own y strictly less than
one full nominal cell below the first). 3+ consecutive dashes were **not**
specially handled or tested — matching P3-O04's own scope boundary
(guaranteed quality target remains the 2-glyph run; `ー` the prolonged
sound mark confirmed structurally unaffected, never semantic-run-treated).

## 10. Ellipsis Paint

Native glyph, no special correction — matching P3-O05's own Preview
conclusion exactly (no seam-continuity problem exists for a discrete
dot-cluster glyph, unlike Dash's continuous stroke). Explicitly verified
NOT to share Dash's overlap treatment: the two `"…"` graphemes are spaced
EVENLY (exactly `heightMm / 2` apart), never compressed by
`DASH_OVERLAP_EM`, proven by a direct test comparing the two treatments'
own spacing math.

## 11. Source / Body Invariants

Proven for every treatment (not merely asserted): `SourceSpan`,
`sourceSpan`, page/column/line structure, and body canonical coordinates
are all unchanged by calling `buildPaintPlan` and/or `generatePublicationPdf`
— confirmed via `structuredClone`/deep-clone snapshots taken before
painting and compared after, for Ruby, TCY, Dash, and Ellipsis
independently. `CanonicalDocument` itself is never touched by any
Publication code (unchanged since the Foundation task — no new import of
`composeCanonicalDocument`'s own internals anywhere in
`renderer/publication/`).

## 12. Vector / Raster Boundary

**100% vector.** No Ruby/TCY/Dash/Ellipsis treatment rasterizes manuscript
text into an image — every one is real `jsPDF.text()` calls against the
registered Shippori Mincho font, confirmed by direct inspection of
`buildPaintPlan`'s own output (every command is `{op: "text", ...}` for
these kinds when a font is supplied; only `IMAGE` and the no-font fallback
path use `{op: "rect", ...}`). No `html-to-image`, `html2canvas`, DOM, or
`window`/`document` browser API is imported or called anywhere in
`pdfGenerator.ts` — verified by a dedicated regression test scanning the
module's own source for import/call syntax (not bare substring matching,
which would false-positive on the module's own prose comments explaining
the antipattern it avoids).

## 13. Tests

`typography.test.ts` — 27 new tests: Ruby (5: geometry consumption,
text-command generation, annotation offset positioning, body-coordinate
invariant, font identity), TCY (5: atomicity, horizontal-unrotated
command, maxWidthMm fit-hint bound, occupancy invariant, valid-PDF
generation), Dash (6: source identity, exactly-2-glyphs, overlap
determinism, full-extent coverage, extent invariant, prolonged-mark
unaffected, valid-PDF generation — 7 counted individually), Ellipsis (3:
source identity, even-spacing vs. Dash, extent invariant),
Cross-cutting (8: TEXT regression, no-font rectangle fallback, HOLD
refusal, no-Preview/no-DOM import scan, plan determinism ×2, combined
Human QA PDF generation). **Methodology note:** invariant tests use
`structuredClone` rather than a JSON round-trip for before/after
snapshots — a JSON round-trip silently normalizes `-0` to `0`
(JSON has no negative-zero representation), which would have made a
pre-existing, harmless `-0` in one ruby offset computation (mathematically
equal to `0`, a float-representation curiosity predating this task, not
introduced by it) look like a false mutation. **Full regression:** Core
364/364, Stage C 21/21, Stage D 30/30, P3-O09 114/114, P3-O08 59/59 (30
previous + 27 new + 2 pre-existing artifact-write resilience fixes) — all
PASS. `npx tsc --noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx(33,50)` baseline error).

## 14. Human QA PDF

`typesetting-v2/qa/publication/p3-o08/publication-typography-qa.pdf` — a
single, real, 4-page (one per `MANUAL_BREAK`-separated section)
composition covering: ordinary vertical body text, Ruby (東京《とうきょう》),
TCY (2026 inside 西暦…年のことだった), Dash (――) and Ellipsis (……) together
in one final sentence. Generated entirely through the same
`composeCanonicalDocument` → `buildPublicationDocument` →
`buildPaintPlan` → `renderPaintPlanToPdf` pipeline every other test in
this task exercises — no screenshot, no special-cased demo code path.
Individual per-treatment PDFs from the prior task
(`dash-ellipsis.pdf`, `f20-vector-text.pdf`) remain available alongside it.

**READY FOR HUMAN PUBLICATION QA: YES.** A Human should inspect: Ruby
reading visible and attached to the correct base run; TCY digits
horizontal and contained within their column; Dash reading as one
continuous line with native stroke weight; Ellipsis reading naturally;
no catastrophic overlap, clipping, or mispositioning anywhere. This
machine report does not and cannot claim final visual quality.

## 15. Remaining P3-O08 Work

Not attempted, per instruction: JPG output; grayscale/`DeviceGray` color
space for vector paint; the legacy paper-size/bleed/trim/crop-mark system;
colophon/folio/header Publication support; real image byte embedding;
Production integration; P3-O06's own exact ruby overhang numeric values
(this task's Ruby paint uses whatever policy Core already resolved —
`OVERFLOW_OPEN` for the current fixture, since the overhang table remains
empty — never fabricating a numeric budget); P3-O07 TCY auto-detection
(explicit TCY only, as instructed). One implementation mistake was caught
and corrected during this task before being shipped: an initial TCY
`angle: -90` (which would have rotated "2026" to read sideways, defeating
the entire purpose of tate-chu-yoko) was fixed to `angle: 0` before any
test or evidence was written against it.

## 16. Exact Next Technical Task

Human Visual QA of `publication-typography-qa.pdf` (and the individual
per-fixture PDFs) — the next MACHINE task, after that Human review,
depends on its outcome: either refine a specific treatment the Human
flags, or proceed to a still-open P3-O08 item (grayscale color space,
paper-size/bleed/trim porting, or JPG output) if Human QA passes cleanly.
