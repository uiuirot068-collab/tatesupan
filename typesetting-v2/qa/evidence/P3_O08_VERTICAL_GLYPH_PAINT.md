# P3-O08 — Vertical Glyph Paint Foundation

## 1. Verdict

**MACHINE PASS — ONE deterministic Publication vertical-glyph paint
layer now exists**, replacing the earlier ad-hoc 90° rotation hack. Real
Unicode vertical presentation-form glyphs (measured present in the
committed Shippori Mincho asset, not assumed) are substituted at paint
time for 、。「」（）―… — Dash and Ellipsis now use the exact same generic
mechanism as ordinary punctuation, no longer a special-cased rotation.
The specific reported Dash-intrusion bug is architecturally eliminated
(the real glyph sits in its own cell like any character; no rotated
bounding-box mismatch is possible). Ruby/TCY untouched, re-verified.
Human Visual QA still required — this report does not claim final visual
correctness.

## 2. Coverage Audit (Real, Measured — `fontCapability.test.ts`)

A minimal, self-contained OpenType `cmap` reader (`fontCapability.ts`,
supporting subtable formats 4 and 12 — the two real-world fonts actually
ship) was written and run against the exact committed Shippori Mincho
Regular asset. Source of the vertical-form code points: Unicode's own
official Names List (`unicode.org/charts/nameslist/n_FE10.html` and
`n_FE30.html`), not guessed from memory.

| Source | Vertical form | Name | Present in font? |
|---|---|---|---|
| U+3001 、 | U+FE11 | Vertical Ideographic Comma | **YES** |
| U+3002 。 | U+FE12 | Vertical Ideographic Full Stop | **YES** |
| U+300C 「 | U+FE41 | Vertical Left Corner Bracket | **YES** |
| U+300D 」 | U+FE42 | Vertical Right Corner Bracket | **YES** |
| U+FF08 （ | U+FE35 | Vertical Left Parenthesis | **YES** |
| U+FF09 ） | U+FE36 | Vertical Right Parenthesis | **YES** |
| U+2015 ― | U+FE31 | Vertical Em Dash | **YES** |
| U+2026 … | U+FE19 | Vertical Horizontal Ellipsis | **YES** |
| U+FF01 ！ | U+FE15 | Vertical Exclamation Mark | NO |
| U+FF1F ？ | U+FE16 | Vertical Question Mark | NO |
| U+FF1A ： | U+FE13 | Vertical Colon | NO |
| U+FF1B ； | U+FE14 | Vertical Semicolon | NO |

**Outcome: A** (Shippori contains usable vertical presentation-form
glyphs for every character class this task needed — comma, full stop,
brackets, parentheses, dash, ellipsis) — **preferred over rotation for
all eight.** The four NOT-covered marks (！？：；) are, by standard
Japanese vertical-typesetting convention, conventionally left upright
anyway (no strong left-right reading-order shape to correct) — their
absence blocks nothing.

## 3. Glyph Classification (Data-Driven)

Implemented in `verticalGlyphMap.ts` as a single `Map<number, number>`
(source code point → vertical-form code point), never hardcoded per
fixture:

- **VERTICAL_FORM** — 、。「」（）―…: real substitute glyph exists and is
  used (the eight rows above).
- **UPRIGHT** — everything else: ordinary kanji/kana, ！？：； (no
  substitute exists or is needed), digits, Latin. Painted exactly as
  before, unchanged.
- **POSITION_ADJUSTED** — not used; no character in this task's own
  scope needed pure repositioning without a real substitute glyph, once
  measured against the actual font (comma/full-stop turned out to have
  real substitute GLYPHS, not just an OpenType `vert` repositioning
  need).
- **TCY / DASH / ELLIPSIS** — existing dedicated Publication paint
  paths in `pdfGenerator.ts`; DASH and ELLIPSIS now consult the SAME
  generic `verticalPaintGraphemeFor` helper as ordinary TEXT/RUBY-base,
  rather than maintaining their own special-cased rotation rule.

## 4. Dash — Root Cause Fixed, Not Patched Around

**Root cause of the reported intrusion bug:** the prior 90° rotation
approach rotated a horizontal-stroke glyph's own bounding box; a rotated
glyph's effective footprint does not reliably match the assumed
per-character cell height, so the stroke visibly extended into the
following character's own cell. **Fix:** each `―` grapheme now paints as
the real U+FE31 vertical em dash glyph, UPRIGHT (no rotation at all),
through the exact same per-character-height-slot algorithm already
proven correct for ordinary text — no custom overlap math, no rotation,
no special case. The custom 0.16em-overlap paint function
(`dashGlyphCommands`, and `DASH_OVERLAP_EM`) was removed entirely as dead
code, not merely disabled — this real glyph does not need the seam-hack
Preview's own CSS-DOM approach required, since it is a genuinely
different (better) paint mechanism, not a copy.

**P3-O04 Product scope preserved exactly:** source stays `――` (2
characters), one `SemanticRunUnit`, canonical extent unchanged (proven by
regression test — the `PublicationDocument` model is deep-equal before
and after painting), 2-glyph target still guaranteed (2 `text` paint
commands generated, proven), 3+ still best-effort (same generic
per-grapheme path applies uniformly, no N-specific code exists).

## 5. Ellipsis — Same Mechanism, Independently Verified Not Shared with Dash

Each `…` grapheme now paints as the real U+FE19 vertical horizontal-
ellipsis glyph, upright, same generic path. A dedicated regression test
proves Ellipsis's own spacing is EVEN (exactly `heightMm/2` apart, one
ordinary cell each) — explicitly NOT Dash's own compressed-overlap
spacing, confirming Dash's P3-O04-specific policy never leaks into
Ellipsis (matches P3-O05's own frozen "no special correction beyond
correct glyph selection" conclusion).

## 6. Ordinary Punctuation — Fixed, Not Merely Classified This Time

Unlike the prior task's own honest "classified but not fixed" position,
this task's real cmap audit found the SAME mechanism (vertical-form
glyph substitution) already available and PROVEN present for the
punctuation classes that matter most (brackets, comma, full stop,
parentheses) — so they are fixed here, using the identical generic
mechanism as Dash/Ellipsis, not a separate one-off patch. `「今日は、
雨だった。」` and `（仮）` were used as the required controlled test
fixtures; direct assertions on the paint plan's own commands confirm
each bracket/comma/full-stop/parenthesis paints as its real vertical
form, never the raw horizontal source character, with no rotation.

**Remaining, disclosed, out of this task's own scope:** ！？：；
(exclamation/question/colon/semicolon) have no vertical-form glyph in
this font and are painted upright/unchanged — matching standard
convention, not a gap this task needed to close. Any OTHER punctuation
class not audited here (quotation marks, small kana, iteration marks,
etc.) remains unaudited — not claimed fixed, not silently assumed
correct.

## 7. Ruby / TCY — Not Redesigned, Re-Verified Only

Both kept their existing dedicated paint paths, unchanged in mechanism.
Included in the combined QA PDF and covered by their own pre-existing
regression suites (all still passing) purely to confirm no regression
from this task's own changes — neither was touched structurally.

## 8. QA PDF

Regenerated `publication-typography-qa.pdf` using the real 文庫 paper
preset (105×148mm, 12/12/15/10mm margins) established in the prior task,
now with TWO additional leading sections: `「今日は、雨だった。」` and
`（仮）`, ahead of the existing ordinary-prose/Ruby/TCY/Dash/Ellipsis
sections — 6+ pages total (one per `MANUAL_BREAK` section), same real
composition, same full pipeline (`composeCanonicalDocument` →
`buildPublicationDocument` → `buildPaintPlan` → `renderPaintPlanToPdf`),
no screenshot, no raster manuscript text anywhere.

## 9. Tests

`fontCapability.test.ts` (new, 4 tests): parser sanity checks + the real
coverage audit (§2), asserted as a frozen snapshot object so the
measured result is visible in the test file's own diff. `typography.test.ts`
updates: Dash's own describe block rewritten (rotation/overlap-specific
assertions replaced with vertical-form-substitution assertions: exactly
2 real-glyph commands, no rotation, even spacing, full-extent coverage,
font-size-per-character); Ellipsis's own block similarly updated; a new
"Ordinary punctuation" describe block (4 tests: brackets/comma/full-stop
substitution, parentheses substitution, no-rotation-anywhere, source
never mutated); the combined QA PDF's own page-count assertion bumped
for the 2 new sections. **Full regression:** Core 364/364, Stage C
21/21, Stage D 30/30, P3-O09 114/114, P3-O08 77/77 (66 previous + 4 new
cmap tests + several rewritten/added typography tests) — all PASS.
`npx tsc --noEmit`: 0 new errors.

## 10. Machine vs. Human Verdict Boundary

Per instruction, this report does NOT machine-declare visual typography
PASS for Dash, Ellipsis, or punctuation appearance. What IS proven,
structurally: (a) the correct Unicode code point is selected and painted
for each character class; (b) canonical source/SourceSpan/coordinates
are unchanged; (c) no adjacent-cell intrusion is architecturally possible
for Dash anymore (proven via the same per-character-cell algorithm
ordinary text already uses correctly); (d) no raster/screenshot path, no
Preview DOM dependency. What remains genuinely unverified without eyes on
the rendered PDF: whether the FONT's own vertical-form glyphs actually
LOOK correct (continuous dash line, correctly-oriented brackets,
naturally-positioned comma/period) — a font's glyph DESIGN quality is not
something a coverage/coordinate test can judge.

## 11. Remaining Blockers

1. Human Visual QA of the regenerated PDF — the actual visual outcome of
   this fix is unverified.
2. ！？：；(no vertical form in this font) — left upright per convention;
   not independently confirmed to look correct in context.
3. Other punctuation classes not audited (quotation marks 『』, small
   kana, iteration marks 々, etc.) — unaudited, not claimed correct.
4. Real physical-paper-geometry source still does not exist in Core
   (carried forward from the prior task, unchanged here).

## 12. Exact Next Technical Task

Human Visual QA of `publication-typography-qa.pdf`. If the vertical-form
glyphs look correct, remaining work is JPG output, grayscale color space,
and paper-size/bleed/trim porting (all still explicitly deferred). If
Dash/Ellipsis/brackets still look wrong despite using the "correct"
Unicode code point, the next investigation is the FONT's own glyph
design/metrics for those specific glyphs (a different class of problem
than code-point selection, which this task has now proven is correct).
