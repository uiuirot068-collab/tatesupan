# P3-O08 — Yakumono Legacy-Parity Paint Port (Human Visual QA HOLD round 13)

## 1. Legacy Production Mechanism (Recovered, Not Reinterpreted)

Direct read of `src/components/PageCard.tsx` (lines 29-49, 2083-2113 —
already fully cited in `qa/evidence/P3_O08_YAKUMONO_LEGACY_PARITY_AUDIT.md`,
re-read again this round per its own instruction not to work from
memory): every character occupies an UNCHANGED, full-size canonical
slot; punctuation is anchored to one EDGE of that slot instead of
centered, via CSS flex `justify-content`. Closing-type marks
(句読点＋終わり括弧・引用符) hug the column-START edge; opening-type
marks (始め括弧・引用符) hug the column-END edge; everything else stays
centered. `vpal` is separately, selectively re-enabled for the same
character set to keep the real font's own punctuation glyph shapes, but
the header comment describes this as secondary — the load-bearing fix
is the edge anchor.

## 2. Exact Regex/Classification Provenance

Ported VERBATIM into `renderer/publication/verticalYakumonoAlign.ts`
from `PageCard.tsx:47` and `:49` (not reinterpreted, not re-derived from
jlreq theory):

```js
// HANG_START — src/components/PageCard.tsx:47
/[、。，．」』）〉》】〕］｝｠”’]/u
// HANG_END — src/components/PageCard.tsx:49
/[「『（〈《【〔［｛｟“‘]/u
```

Verified directly (`verticalYakumonoAlign.test.ts`) against every
character in both sets.

## 3. Canonical Model Corrections/Retirements

**Both prior canonical-layer experiments are retired, not preserved:**

- Round 8's "full-em body + negative pair adjustment"
  (`applyYakumonoCompression`, `yakumonoSpacingScope`).
- Round 11's "half-em intrinsic body + explicit side space"
  (`bodyAdvanceTickFor`, `yakumonoSpaceAfterEm`, `yakumonoHalfBodyScope`).

`core/compose/line.ts`'s `computeAtoms` is back to the exact pre-round-8
form: `advanceTickFor` returns `perCellAdvance` unconditionally for
every TEXT atom, no character-class branching of any kind.
`RuleSetVersion` no longer carries any yakumono-scope field at all (both
`yakumonoSpacingScope` and `yakumonoHalfBodyScope` are gone). Verified:
Core's own regression suite is back to **364/364** — the EXACT count
before round 8 ever touched this file.

Round 8's own test file (`core/compose/yakumonoSpacing.test.ts`) was
already deleted in round 11. Round 11's own test file
(`core/compose/yakumonoHalfBody.test.ts`) is deleted this round. One
pre-existing test in `core/compose/page.test.ts` (predates all yakumono
work, incidentally used `「` as ordinary fixture text) is restored to
its original, pre-round-8 assertion.

## 4. Publication Edge-Alignment Mapping

New module: `renderer/publication/verticalYakumonoAlign.ts`.
`VerticalYakumonoAlignContext` (font bytes parsed once per render,
per-grapheme result memoized) exposes `baselineRatioFor(grapheme):
number | undefined` — `undefined` for NORMAL (unclassified) characters
(callers fall back to the existing centered default, round 5's
`deriveBaselineRatioFromFont`), a real, computed ratio otherwise.

**Translation from CSS flex-start/flex-end to jsPDF's baseline-anchored
paint model — grounded in real font data, not guessed:** this project
already has REAL, measured per-glyph ink bounding boxes
(`fontMetrics.ts`'s `glyphInkBBox`, built in round 5/7). Instead of
centering the baseline at a fixed fraction of the cell (the existing
default), the override computes the fraction that flushes the ACTUAL
painted glyph's own real ink against the correct cell edge:

- **HANG_START** (flush ink-top to cell-top): `baselineRatio = yMax / unitsPerEm`
- **HANG_END** (flush ink-bottom to cell-bottom): `baselineRatio = 1 + yMin / unitsPerEm`

Both formulas verified directly against real font data
(`verticalYakumonoAlign.test.ts`'s own "HANG_START/HANG_END formula...
verified directly against real font data" tests, computing the expected
ratio independently from `FontMetricsReader` and asserting the
context's own output matches to 10 decimal places).

**Resolved against the ACTUAL painted glyph, not the source character's
own glyph** — when a real Unicode vertical presentation form exists
(round 6, e.g. `。` → U+FE12), the ink bbox is read for THAT glyph, via
`verticalPaintGraphemeFor`, matching exactly what `pdfGenerator.ts`'s
own "text" paint path actually draws. Verified directly (test: "the
override is derived from the ACTUAL painted glyph's real ink bbox...").

**No glyph scaling anywhere.** Font size remains the fixed `bodyEmMm`
(round 9), completely unaffected by this module — verified directly
(`glyphSizeIndependence.test.ts`'s full 14-test suite still passes
unmodified; a new test in this round's own QA file confirms every
character, including edge-aligned ones, shares the identical
`fontSizePt`).

**Canonical slot never mutated.** `PublicationDocument` is
byte-identical whether or not a `yakumonoContext` is supplied — verified
directly.

## 5. GPOS Interaction — No Double Application

Round 10's `VerticalGposContext` (real `vpal` YPlacement nudge) is
explicitly GATED OFF for any grapheme the yakumono edge-alignment
override applies to (`pdfGenerator.ts`'s own `verticalGraphemeCommands`:
`gposOffsetMm` is forced to `0` whenever `yakumonoBaselineRatio !==
undefined`). Legacy's own comment describes `vpal` as secondary to the
edge-anchor fix, not a second correction layered on top of it — applying
both would double-apply placement. Verified directly: a dedicated test
proves a HANG_END-classified character's own `yMm` is byte-identical
whether or not a `gposContext` is also supplied alongside the
`yakumonoContext`.

The GPOS/`vpal` infrastructure itself (`gposReader.ts`,
`verticalGposPaint.ts`) is otherwise fully preserved and still used —
for NORMAL (non-yakumono) characters, its existing behavior is
completely unchanged.

## 6. `isGridRenderableLine` Scope Caveat

Recorded, per the independent Explore agent's own corroborating audit:
legacy's FixedSlot yakumono-positioning mechanism only applies to lines
composed ENTIRELY of text/ruby/tcy tokens. A line containing a
page-break or image token falls back to legacy's own plain browser text
flow (`TokenView`), with no custom edge-anchoring at all. This port
targets the ordinary grid-renderable body-text path — the same scope
every Human QA fixture in this whole task chain has ever exercised.
v2's own Core/Publication architecture has no equivalent
"grid-renderable vs. not" distinction (every line composes uniformly),
so there is no corresponding v2-side branch to port for this caveat —
recorded as an open compatibility boundary, not silently generalized
past what was proven.

## 7. Mixed Image/Page-Break Boundary

Out of scope for this port, per explicit instruction. Not modeled,
not broadened into.

## 8. QA Artifact

`qa/publication/p3-o08/yakumono-legacy-parity-qa.pdf` (new) — one page
per required control fixture: A (`た。次`), B (`た、次`), C (`た。」`),
D (`た、」`), E (`」次`), F (`先「次`), G (`。」`), plus the original
reported sentence (`「今日は、雨だった。」`), at a generously large
diagnostic size (80×100mm sheet, `charsPerLine: 20` slot budget so no
fixture accidentally wraps to a second page). `publication-typography-qa.pdf`
regenerated too, with a real `VerticalYakumonoAlignContext` threaded
through. Both generated only after every structural test above passed.
The old `yakumono-spacing-qa.pdf` (round 8) and `yakumono-half-body-qa.pdf`
(round 11) generation tests are deleted, not left to depend on a
possibly-stale, possibly-locked file — a fresh, single artifact for this
round's own mechanism is generated instead.

## 9. Human Recheck Requirement

**REQUIRED.** This is a real, new paint-time positioning mechanism —
though ported from an already-accepted implementation and grounded in
real font ink-bbox data (not tuned by eye), its actual visual result in
THIS renderer (jsPDF vector paint, not a live browser) has not been
visually confirmed. Human Visual QA of `yakumono-legacy-parity-qa.pdf`
(all 8 fixtures) and the regenerated combined PDF is the next required
step before this item can be marked PASS.

## 10. Remaining P3-O08 Blockers

- Human Visual QA of this round's own regenerated PDFs (§9).
- `isGridRenderableLine`-equivalent scope caveat (§6) — not a blocker
  for current fixtures, but a known, disclosed gap if a future fixture
  mixes yakumono text with page-break/image content on the same line.
- Everything else already tracked in `docs/architecture/PHASE3_OPEN_ITEMS.md`'s
  own P3-O08 row (grayscale, paper bleed/trim, colophon/folio, real
  image embedding, Production integration) is unaffected by this round.

## 11. Tests

`verticalYakumonoAlign.test.ts` (11 tests): classification ported
verbatim + verified against every character in both sets; real
font-derived baseline-ratio overrides for HANG_START/HANG_END, verified
directly against independently-computed expected values; NORMAL returns
`undefined`; determinism; the override is resolved against the actually
painted (post-presentation-form) glyph, not the source glyph.
`yakumonoLegacyParityQa.test.ts` (10 tests): canonical advance is
uniform again (no compression); every pitch in the reported-symptom
sentence is identical; source/SourceSpan invariance; glyph size
invariance; canonical-slot invariance; edge alignment measurably shifts
painted position for classified characters only; no GPOS double
application; real PDF generation; the focused diagnostic QA artifact.
`glyphSizeIndependence.test.ts`: one test rewritten (was asserting the
now-retired compression, now asserts uniform advance), 13 others
unmodified and still passing.

**Full regression:** Core 364/364 (the EXACT pre-round-8 baseline count
— confirms clean retirement), Stage C 21/21, Stage D 30/30, P3-O09
(Preview) 114/114, P3-O08 (Publication) 182/182 — all PASS. `npx tsc
--noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error).

## 12. Safety

`src/` (legacy): read-only, never modified. Core: changed, but only to
RETIRE two failed experiments back to their original, long-proven-stable
form — net effect is Core returning to an EARLIER, already-validated
state, not a new untested one. Preview: untouched (zero files). No new
dependency. No push, no deploy, no reset.
