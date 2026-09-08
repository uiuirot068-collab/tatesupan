# P3-O08 — Structural Colophon: Final Placement (Human Visual QA HOLD round 28, Step 2C)

Final-page completion, Step 2 completion (Folio/Header → Structural
Colophon → Real Image Embedding → JPG Export). Continues from commit
`44fb873`. Round 27 (`P3_O08_STRUCTURAL_COLOPHON_REAL_PRODUCT_PORT.md`)
disclosed two gaps and withheld Human PASS: `{mode:"after-body-page"}`
was resolved but not wired into actual page composition, and
`ColophonPlacement` was not ported at all. This round closes both.

## 1. `after-body-page` wiring

`core/layout/assemble.ts` now calls the already-ported
`resolveColophonInsertion` (round 27) with a new
`DocumentCompositionInput.colophonPagePosition` (optional, defaulting to
`{mode:"end"}` — byte-identical to every round-20-through-27 caller)
to get `precedingBodyPages`. It then builds the real final physical
page order directly: `[...body pages 0..precedingBodyPages-1,
...ALL colophon pages, ...remaining body pages]`. Proven by test: `end`
placement yields `[...body, ...colophon]`; `after-body-page:1`/`:3`
insert immediately after the 1st/3rd body page; `after-body-page:5`
(the last real body page) is identical to `end`; `after-body-page:999`
(beyond the real body count) falls back to `end` exactly, never
crashes, never drops the colophon (all four are real legacy contract
guarantees, not new behavior invented here — `src/lib/colophon.ts:266-277`).

## 2. Final page-order ownership

`CanonicalDocument.pageSequence: PhysicalPageRef[]` (new,
`core/layout/schema.ts`) — `{kind:"body"|"colophon", index}` references
into `pages`/`colophon.pages`, never a duplicate copy of page data.
Core computes this; Publication (`pdfGenerator.ts`'s `buildPaintPlan`)
only WALKS it to interleave body/colophon paint pages in the correct
physical order — it never decides insertion order itself. When
`pageSequence` is absent (a hand-built `PublicationDocument` fixture
predating this round, `paintModel.test.ts`), `buildPaintPlan` falls
back to the exact pre-round-28 `[...bodyPlan, ...colophonPlan]`
concatenation — byte-identical for that caller.

## 3. Parity effects (folio/header) after insertion

Folio/header are no longer computed from a page's position within its
OWN (body-only or colophon-only) composition — they are computed from
each page's own index in the FINAL PHYSICAL SEQUENCE
(`pageSequence.forEach((ref, physicalIndex) => ...)`), for BOTH body
and colophon pages alike. Proven: with a colophon inserted after body
page 2 (of 5), folio numbering across the whole final sequence (body,
then colophon, then remaining body) is strictly monotonic — the
insertion correctly shifts every subsequent body page's own folio
number up. Header odd/even parity alternates correctly across the same
sequence, including immediately before/after the insertion point (a
later body page's own parity really can flip, exactly as the task's own
framing anticipated).

## 4. Body composition invariant

Proven directly: `document.pages` (lines/columns/breaks/`sourceSpan`s)
is `toEqual`-identical between `{mode:"end"}` and
`{mode:"after-body-page", afterBodyPage:2}` for the SAME body/colophon
input — insertion changes ONLY furniture (folio/header), never the
manuscript's own composed content. This is the same invariant round 26
already proved for colophon-present-vs-absent; this round extends it to
colophon-position-vs-position.

## 5. Real `ColophonPlacement` values (`src/lib/colophon.ts:67-74`)

```
ColophonPlacement {
  horizontal: "left" | "center" | "right";
  vertical: "top" | "center" | "bottom";
  respectGutter: boolean;
  respectVerticalMargins: boolean;
}
DEFAULT_COLOPHON_PLACEMENT = { horizontal:"center", vertical:"center", respectGutter:true, respectVerticalMargins:true };
```

Real legacy application (`ColophonPageCard.tsx:100-120`, direct read):
`horizontal`/`vertical` are flexbox `justify-content`/`align-items` on
a placement AREA; `respectGutter`/`respectVerticalMargins` (parity-
dependent, `:85-98`) decide that area's own margins (asymmetric
gutter/outer split when ON, symmetric `min(gutter,outer)` when OFF).
All 9 horizontal×vertical combinations round-trip through
`ColophonBlock.placement` unchanged (proven by test) — no enum value
invented or dropped.

## 6. Canonical semantic mapping

`core/colophon/index.ts`: `DEFAULT_COLOPHON_PLACEMENT` ported verbatim;
`composeColophon(sourceBlockId, pages, placement?)` attaches
`placement ?? DEFAULT_COLOPHON_PLACEMENT` onto the resulting
`ColophonBlock`. `ColophonBlock.placement` is OPTIONAL (not required)
specifically so a hand-built `ColophonBlock` fixture predating this
round (`renderer/preview/generateFoundationArtifact.test.ts`'s own
`{ sourceBlockId, pages }` literal) keeps type-checking unchanged — the
real compiler path always populates it. Resolution here is a pure enum
carry-through (no parity dependency for `horizontal`/`vertical`
themselves) — Core does not compute physical mm, only the semantic
choice, per "Core resolves semantics, Publication resolves mm."

## 7. Publication geometry resolution

`paintModel.ts`: `PublicationDocument.pageSequence?`/`.colophonPlacement?`
(both optional/additive) carry Core's decisions through unresolved-to-mm.
`pdfGenerator.ts`'s `buildColophonPaintPage`:
- `horizontal` anchors each NON-tab (freeText/plain) line's own text at
  the content box's left/right/center edge via jsPDF's own
  `align:"left"|"right"|"center"` (the same deterministic,
  font-metric-based mechanism already trusted for round 27's own
  label/value row split — no character-count estimate anywhere). A
  tab-joined ROW (round 27) is deliberately NOT re-anchored by
  `horizontal` — it already spans the full content width by
  construction (label flush-left, value flush-right, matching legacy's
  own fixed 2-column `FragmentRow` grid), a disclosed simplification.
- `vertical` shifts the whole content block's own start Y, computed
  from a real, deterministic quantity (composed LINE COUNT × the fixed
  per-line height every line already paints at — never a
  character-count guess) — but ONLY when the colophon composed onto
  exactly ONE page (matching legacy's own real single-page model
  exactly). See §8 for the multi-page case.
- Round 26 also left a real gap discovered THIS round: colophon pages
  have carried a real Core-generated `header` since round 26, but
  `buildColophonPaintPage` never painted it. Fixed here, mirroring the
  body page header paint exactly.
- `respectGutter`/`respectVerticalMargins` are READ NOWHERE in
  Publication — see §10.

## 8. Overflow continuation behavior

Legacy has no multi-page colophon concept at all (a real, single fixed
page). v2's own overflow extension (round 27: `composePages` naturally
produces >1 colophon page rather than clipping) therefore has no legacy
precedent for what `vertical` should do across pages. This round
defines and discloses the smallest consistent rule: `vertical` applies
ONLY when the colophon is exactly one page; a multi-page colophon
ALWAYS top-anchors every one of its pages, regardless of the requested
`vertical`. Rationale, not just an implementation shortcut: repeating
`"bottom"`/`"center"` independently per page would make each page's own
content height (the true one for that page, e.g. a shorter final page)
produce a DIFFERENT start position per page, breaking visual
reading-flow continuity across the colophon's own pages — top-anchoring
uniformly is the one rule that keeps a multi-page colophon reading like
one continuous flow. Proven by test: with `vertical:"bottom"` requested
on a real 5+-page colophon, every page's own first painted line starts
at the identical Y. Also proven: every real compiled row/freeText line
still appears somewhere in the painted output across all colophon pages
(no silent clipping) — no new overflow algorithm was written, this is
`composePages`' own pre-existing mechanism (round 27), exercised
honestly with insertion now real.

## 9. Real-settings QA

`qa/publication/p3-o08/structural-colophon-final-product-qa.pdf` — 5
documents, all through the real `ColophonFieldInput[]`/`freeText`
compiler, zero synthetic plain-text final fixtures:
- **A** — end placement, default `ColophonPlacement`, folio/header.
- **B** — `after-body-page:2` insertion on a real 5-body-page document,
  folio/header shown across the insertion point.
- **C** — alternate placement (`horizontal:"left"`, `vertical:"top"`).
- **D** — a multi-page colophon (7 real fields + 3-line freeText)
  inserted mid-body (`after-body-page:2`), proving contiguous insertion
  + top-anchored continuation together.
- **E** — blank optional field + hidden field (both filtered) + real
  multiline freeText.

## 10. Remaining gaps — disclosed, not faked

**`respectGutter`/`respectVerticalMargins` are NOT acted on.** Real
legacy behavior is parity-dependent (asymmetric gutter/outer margin
split when ON, `Math.min(gutter,outer)` symmetric fallback when OFF,
`ColophonPageCard.tsx:85-98`). `PublicationPageGeometry`
(`pdfGenerator.ts`) has a SINGLE fixed `marginLeftMm`/`marginRightMm`
for the entire document — no distinct gutter/outer fields, no per-page
parity variance at all. Faithfully porting these two fields would
require extending `PublicationPageGeometry` itself (a geometry-model
change touching every page's margin resolution, body pages included) —
materially larger than this round's scope, and not attempted. The type
carries both fields for contract fidelity (round-trip proven, test 11)
so a future round can complete this without another settings-shape
change.

**Multi-column colophon overflow within one page** (disclosed rounds
26/27, unchanged): still only the first column of each colophon page is
painted.

## Tests

`renderer/publication/structuralColophonFinalPlacement.test.ts` (23
tests): page-position wiring (7), page-furniture-after-insertion (3),
`ColophonPlacement` semantics (9), overflow continuation (2),
regression (1), and the final QA generator (1).

**Full regression:** Core 364/364 (unchanged), Stage C 21/21, Stage D
30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication) 361/361 (338 + 23
new) — all PASS. `npx tsc --noEmit`: 0 new errors (only the known
pre-existing `src/app/layout.tsx` baseline error). Also fixed in
passing: `PaintCommand`'s `"text"` variant's own `align` field was
missing `"right"` (round 27 worked around this with an unsafe `as`
cast) — widened to `"left"|"center"|"right"`, the cast removed.

## Safety

`src/` (legacy): read-only, cited as evidence, never modified. Core:
additive (`core/layout/schema.ts` — `ColophonPlacement`,
`PhysicalPageRef`, `CanonicalDocument.pageSequence`;
`core/colophon/index.ts` — `DEFAULT_COLOPHON_PLACEMENT`, `composeColophon`'s
new optional 3rd param; `core/layout/assemble.ts` — insertion + final
sequence + per-physical-index furniture). Publication: additive
(`paintModel.ts` — two new optional fields; `pdfGenerator.ts` —
`buildPaintPlan` interleaving, `buildColophonPaintPage` placement +
missing header paint, `align` type widened). No new dependency. No
push, no deploy, no reset. No image embedding, no JPG, no DeviceGray,
no bleed/trim, no UI, no Production changes.
