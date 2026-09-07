# P3-O08 — Vertical Cell-Local Positioning & Ruby Scale Correction

## 1. Verdict

**PART B (Ruby scale): FIXED — a real, proven Core measurement bug,
corrected with an explicit Human-approved value (0.5), applied
consistently across Core, Preview, and Publication.** **PART A
(punctuation cell-local positioning, small kana): INFRASTRUCTURE BUILT,
NOT machine-selected — three named, disclosed candidate strategies
generated for Human comparison, since the exact correct offset cannot be
verified without rendering the PDF.** Neither part was treated as "one
bug" — they were investigated, classified, and resolved independently, as
instructed.

## 2. Human Failures (Round 4)

1. Closing corner bracket `」` visually far from the preceding `。`.
2. Small kana `っ` (in ordinary prose containing `だった`) does not sit
   naturally in its vertical cell.
3. Ruby `とうきょう` attached to `東京` spans much too much vertical
   distance.

## 3. Part B — Ruby Scale Re-Audit

### 3.1 Diagnostic Trace (real, measured — `rubyScaleDiagnostic.test.ts`)

Against the `atomic-ruby` fixture (東京《とうきょう》, 10.5pt body):

| Quantity | Before | After |
|---|---|---|
| Base run canonical extent | 7.408mm (2 × 3.704mm) | unchanged |
| Reading code-point count | 5 | unchanged |
| `rubyReadingExtentTick`, in mm | **18.52mm** (5 × 3.704mm, full body em) | **9.26mm** (5 × 1.852mm, body em × 0.5) |
| Annotation/base extent ratio | **2.5×** | **1.25×** |
| `rubyScale` applied anywhere | NO (declared field, never read) | YES (`DEFAULT_RUBY_SCALE = 0.5`, applied at `compose/line.ts`'s own measurement call site) |

### 3.2 Classification

**B — canonical `rubyReadingExtentTick` was too long because `rubyScale`
was missing from measurement**, proven not assumed: the formula
(`core/measurement/fakeProvider.ts` and `shipporiMinchoProvider.ts`) was
`naturalAdvanceTick(fontRef, bodyFontSizePt, "") × readingCharCount` — the
reading run was measured at FULL body-em size, with `rubyScale` never
read anywhere in the call path (`core/compose/line.ts` passed
`settings.bodyFontSizePt` directly, confirmed by the exact same finding
already recorded, but not fixed, in the prior task's own
`P3_O08_REAL_MEASUREMENT_FACTS.md` §8). No separate Publication-painter
stretching bug was found on top of this — Ruby's canonical extent alone
fully explains the "much too long" symptom.

### 3.3 Frozen Value Search — None Found, Then Explicitly Approved

Searched the entire `typesetting-v2/` tree for `rubyScale` — found only
the type declaration (`LayoutSettings.rubyScale: number`), never a numeric
assignment anywhere (Core, Stage C, Stage D, Preview, Publication, or any
test fixture). Checked Master's own decision text: §HD (line 1327)
explicitly states *"具体的な数値・慣例は本決定では凍結しない"*
("specific numeric values/conventions are not frozen by this decision")
for the closely-related ruby-overhang question — the same "not frozen"
status applies to ruby scale. **Per instruction, did not invent a value.**
Presented the diagnostic finding to the Human via a structured decision
question; **Human/Product decision: `rubyScale = 0.5`**, now a canonical
typography setting (not a Publication-only workaround), to be applied
identically everywhere ruby annotation is sized.

### 3.4 Implementation — One Authoritative Constant, Three Consumers

`DEFAULT_RUBY_SCALE = 0.5` defined once, in `core/settings/index.ts`
(alongside `LayoutSettings.rubyScale`'s own declaration), exported from
`core/index.ts`:

1. **Core measurement** (`core/compose/line.ts`): `CompositionSettings`
   gained an optional `rubyScale?: number` field (optional so no existing
   settings-construction call site across the whole codebase needed
   updating — omitting it falls back to `DEFAULT_RUBY_SCALE`). The
   `rubyReadingExtentTick` call site now passes
   `settings.bodyFontSizePt * (settings.rubyScale ?? DEFAULT_RUBY_SCALE)`
   instead of the raw body size. Never touches the BASE run's own
   `advanceTick`/coordinates (unchanged code path, untouched by this fix).
2. **Preview paint** (`renderer/preview/PreviewRenderer.tsx`): the
   `.ruby-annotation` CSS rule's `font-size` is no longer an
   independently-hardcoded `0.55em` — it now interpolates
   `${DEFAULT_RUBY_SCALE}em` directly from the same imported Core
   constant.
3. **Publication paint** (`renderer/publication/pdfGenerator.ts`):
   `RUBY_ANNOTATION_FONT_RATIO` is no longer its own separate `0.55` — it
   is now `DEFAULT_RUBY_SCALE` itself, imported from `../../core`.

**No more separate 0.5 Core / 0.55 Preview / 0.55 Publication values** —
one constant, three consumers, confirmed by direct code read of all three
files after the change.

### 3.5 Body Invariant

Proven, not merely claimed: `core/compose/rubyPlacement.test.ts`'s own
pre-existing tests for base-run `xTick`/`yTick`/`sourceSpan` continue to
pass UNCHANGED (only the reading-extent-dependent assertions — offset/
extent values that were always downstream of the reading measurement —
were updated to their new, correctly-scaled values, using a new
`READING_CELL` constant computed the same way the real code now computes
it, not a hand-derived magic number). Page/column/line/break-related
tests (`page.test.ts`, `column.test.ts`, `composeCanonicalDocument.test.ts`,
`line.test.ts`, `paragraphSemantics.test.ts`) all pass unmodified.

### 3.6 Preview / Publication Regression

Preview's own 114-test `renderer/preview/` suite passes unmodified after
the CSS constant change (the Ruby Anchor/Annotation Missing/Page Content
Clipping HOLD regressions from the original Ruby Placement Micro-Loop all
still pass, confirming the anchor-correctness fix from that loop is
independent of and unaffected by the font-SIZE change here).
`generateFoundationArtifact.test.ts`'s own artifact-generation test
regenerated `qa/visual/p3-o09-preview/index.html`/`debug.html`
automatically as part of this run. Publication's own 90-test
`renderer/publication/` suite passes, including the updated
`rubyScaleDiagnostic.test.ts` now asserting the AFTER state.

## 4. Part A — Cell-Local Positioning (Punctuation + Small Kana)

### 4.1 Why Vertical-Form Substitution Alone Is Not Enough

Confirmed, not assumed: jsPDF paints every glyph via ordinary HORIZONTAL
baseline metrics (`BASELINE_RATIO`, a fixed fraction of cell height),
never the font's own vertical origin/metrics (`vhea`/`vmtx` tables — not
parsed by this foundation, which only reads `cmap`, per the prior task's
own scope). A vertical-form punctuation glyph's own ink is very likely
positioned differently within its advance box than an ordinary kanji's —
substituting the correct GLYPH SHAPE (prior task) does not by itself
guarantee correct cell-local INK POSITION.

### 4.2 Honest Epistemic Limit

Without rendering the actual PDF, the exact correct cell-local offset for
any punctuation class or small kana cannot be machine-verified. Rather
than invent one number and ship it as fact — the same mistake already
made and corrected twice this task chain (Dash's rotation angle, the
original small offset formulas) — this task builds the INFRASTRUCTURE
(a data-driven, per-class Y-offset system) and generates **three named,
disclosed candidates** for Human comparison, never presenting any one as
"the correct value."

### 4.3 Classification (Data-Driven, `verticalGlyphMap.ts`)

- `classifyPunctuation(grapheme)`: `OPEN_BRACKET` (「（), `CLOSE_BRACKET`
  (」）), `COMMA` (、), `PERIOD` (。), or `undefined` for anything else.
- `isSmallKana(grapheme)`: true for the full hiragana/katakana small-kana
  set (ぁぃぅぇぉゃゅょっゎ + katakana equivalents), false otherwise —
  proven to NOT match ordinary kana (つ ≠ っ, や ≠ ゃ).
- `cellLocalOffsetFor(grapheme, candidate)`: returns a Y offset (as a
  fraction of one cell height) for the classified character under a named
  candidate, `{yOffsetEm: 0}` for anything unclassified.

### 4.4 Three Candidates

- **A_BASELINE**: zero offset everywhere — the exact prior (pre-this-task)
  behavior, byte-identical, the default when no candidate is specified.
- **B_STANDARD**: open brackets/comma/period shifted toward the cell's
  own start (−0.15 to −0.25em); close brackets shifted toward its own end
  (+0.15em); small kana shifted toward the start (−0.15em) — reasoned
  from standard JIS/Adobe vertical-typesetting convention (opening marks
  bias toward the top, closing marks toward the bottom, comma/period
  toward their real upper-left position), not verified against this
  specific font's own glyph design.
- **C_STRONG**: the same directional bias as B, roughly double the
  magnitude, for comparison.

Proven directly (`cellLocalOffset.test.ts`): ordinary kanji/kana/digits
get ZERO offset under every candidate (never touched); open/close
brackets get opposite-signed offsets under B/C (never the same
direction); C's magnitude exceeds B's for every affected class;
`PublicationDocument` (canonical coordinates) is byte-identical across
all three candidates — only the PAINT command's own `yMm` changes.

### 4.5 Comparison Artifacts

- `typesetting-v2/qa/publication/p3-o08/punctuation-position-comparison-{A_BASELINE,B_STANDARD,C_STRONG}.pdf`
  — `「今日は、雨だった。」`, one PDF per candidate, same font/scale/
  coordinates, only the punctuation offset differing.
- `typesetting-v2/qa/publication/p3-o08/small-kana-position-comparison-{A_BASELINE,B_STANDARD,C_STRONG}.pdf`
  — `だった。`, same pattern (plus a single `small-kana-position-comparison.pdf`
  matching the task's own requested filename, containing the B_STANDARD
  candidate as the representative file).

**Human should inspect these and choose** — this task does not and
cannot machine-select a winner.

## 5. QA PDF

`publication-typography-qa.pdf`'s own underlying logic is corrected (ruby
scale) and regenerated successfully by its own test on this task's first
run — **however, on a later re-run to double check freshness, the file
was found locked** (`rm` itself failed with "Device or resource busy"),
most likely because it is currently open in a PDF viewer for Human
review. The CORRECTNESS of its content is proven independently by passing
tests (`rubyScaleDiagnostic.test.ts`, `typography.test.ts`'s own Ruby
geometry assertions) regardless of the file's own on-disk freshness at
any given moment — but the file on disk may be stale until it is closed
and this task's own test suite is re-run once more. Recorded honestly
rather than silently claimed current.

## 6. Tests

`rubyScaleDiagnostic.test.ts` (new, 1 test — the frozen before/after
trace), `cellLocalOffset.test.ts` (new, 12 tests — classification,
candidate neutrality, paint integration, comparison-PDF generation),
`core/compose/rubyPlacement.test.ts` (6 assertions updated to the
correctly-scaled expected values, using a `READING_CELL` constant
computed the same way the real code computes it, never a hand-derived
number). **Full regression:** Core 364/364, Stage C 21/21, Stage D 30/30,
P3-O09 (Preview) 114/114, P3-O08 (Publication) 90/90 — all PASS.
`npx tsc --noEmit`: 0 new errors.

## 7. Safety

Core changed: YES, but narrowly and explicitly authorized (a genuinely
missing, Human-approved measurement value, applied only to ruby reading
extent — never body advance, breaks, or Natural Pitch, all proven
unchanged by the still-passing regression suite). Preview changed: YES,
explicitly authorized this round (`.ruby-annotation` CSS constant only,
no structural/layout change). `src/`/Production: untouched. No new
dependency, no font binary added.

## 8. Remaining

Cell-local offset candidate selection (Part A) — awaiting Human review of
the comparison PDFs. If B or C is chosen, promoting it to the default
`cellLocalCandidate` for the main pipeline is a small, isolated follow-up
(the infrastructure and every call site already support it). If none
look right, further investigation would need real font vertical-metrics
(`vhea`/`vmtx`) parsing — a larger undertaking, not started here.
