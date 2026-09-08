# P3-O08 — Structural Colophon: Margin-Respect Semantics (Human Visual QA HOLD round 29, Step 2D)

Final-page completion, Step 2 completion (Folio/Header → Structural
Colophon → Real Image Embedding → JPG Export). Continues from commit
`f2f2172`. Round 28 disclosed one remaining gap and withheld full
closure: `ColophonPlacement.respectGutter`/`.respectVerticalMargins`
were carried through the contract but had no effect on Publication
placement. This round closes it.

## 1. Legacy audit — REAL BEHAVIOR, not a no-op

Direct read, `src/components/ColophonPageCard.tsx:81-98`:

```
//  - respectGutter ON : ノド側=marginGutter / 小口側=marginOuter（左右非対称、parity 依存）
//  - respectGutter OFF: 既存 marginGutter/marginOuter の小さい方を左右対称に
//  - respectVerticalMargins ON : 天=marginTop / 地=marginBottom
//  - respectVerticalMargins OFF: 既存 marginTop/marginBottom の小さい方を天地対称に
const gutterOuterMin = Math.min(settings.marginGutter, settings.marginOuter);
const leftMarginMm = placement.respectGutter
  ? isOddPage ? settings.marginOuter : settings.marginGutter
  : gutterOuterMin;
const rightMarginMm = placement.respectGutter
  ? isOddPage ? settings.marginGutter : settings.marginOuter
  : gutterOuterMin;
const topMarginMm = placement.respectVerticalMargins ? settings.marginTop : vMarginMin;
const bottomMarginMm = placement.respectVerticalMargins ? settings.marginBottom : vMarginMin;
```

Both flags gate the actual, real placement-AREA rectangle passed to a
CSS flexbox (`:100-120`) whose `justify-content`/`align-items` then
implement `horizontal`/`vertical` WITHIN that area — so `respectGutter`/
`respectVerticalMargins` are not independent of `horizontal`/`vertical`
(round 28); they define the box those axes resolve inside, including
`"center"`.

- **`respectGutter`**: `isOddPage`-dependent. ON: asymmetric — the
  GUTTER side (binding margin) gets `marginGutter`, the OUTER side gets
  `marginOuter`, swapped by parity (odd page: left=outer/right=gutter;
  even: mirrored — the SAME convention Core's own
  `resolveFolioPhysicalSide` already encodes, round 22). OFF: both
  sides get `Math.min(marginGutter, marginOuter)` (symmetric).
- **`respectVerticalMargins`**: no parity dependency. ON: top/bottom
  use the real, independently-set `marginTop`/`marginBottom`. OFF: both
  become `Math.min(marginTop, marginBottom)` (symmetric).

**Neither flag is a legacy no-op.** Both are real, load-bearing
geometry decisions in the shipped renderer.

## 2. Publication resolution

`pdfGenerator.ts`'s `buildColophonPaintPage` now computes
`placementLeftMm`/`placementRightMm`/`placementTopMm`/`placementBottomMm`
(the placement AREA's own bounds) from `respectGutter`/
`respectVerticalMargins` before computing `contentLeftMm`/
`contentRightMm`/`contentAreaTopMm`/`contentAreaBottomMm` — the SAME
variables round 28's `horizontal`/`vertical` anchor logic already
consumes, unchanged. This is why `"center"` is provably NOT exempt
(§4): it resolves against whatever these flags produced, exactly like
`"left"`/`"right"`/`"top"`/`"bottom"` do.

`respectGutter`'s side resolution reuses Core's own
`resolveFolioPhysicalSide("outer", isOddPage)` (round 22) — not a new,
second isOddPage→side mapping. `isOddPage` itself is derived in
`buildPaintPlan` from each colophon page's own position in
`doc.pageSequence` (the SAME final physical index round 28 already
uses for folio/header) — never re-decided, only re-read for this one
additional purpose.

## 3. `PublicationPageGeometry` — smallest sufficient extension

Two new OPTIONAL fields: `marginGutterMm?`, `marginOuterMm?`. Every
OTHER paint path (body content, folio, header) is completely
untouched — they still use the pre-existing `marginLeftMm`/
`marginRightMm` as one fixed, parity-independent rectangle for the
whole document (a real, pre-existing v2 simplification, not resolved
by this round and out of scope for it — see §6). When
`marginGutterMm`/`marginOuterMm` are omitted (every round-26/27/28
caller), `respectGutter` has NO distinguishable effect — both `true`
and `false` fall back to `marginLeftMm`/`marginRightMm` symmetrically,
proven by the unchanged 361/361 Publication regression before this
round's own new tests were added. This is an honest inertness in the
ABSENCE of real gutter/outer data, not a disguised no-op — every test
in this round supplies real, deliberately asymmetric
`marginGutterMm`/`marginOuterMm` to prove the flag actually changes
output.

## 4. Parity + center proof (not a symmetric false-positive)

All margin-respect tests use `ASYMMETRIC_GEOMETRY`
(`marginTopMm:22`/`marginBottomMm:8`, `marginGutterMm:26`/
`marginOuterMm:11`) — a symmetric fixture would make `respectGutter`/
`respectVerticalMargins` true vs false paint identically regardless of
whether the flag actually did anything, which would prove nothing.
Proven directly: on a real ODD physical colophon page, `respectGutter`
puts the (small) outer margin on the left; on a real EVEN physical
page, the (large) gutter margin lands on the left instead — the exact
mirrored pair legacy's own formula produces. `respectGutter:false`
collapses both to `min(gutter,outer)` regardless of parity.
`respectVerticalMargins` similarly shown against the real, unequal
top/bottom values. **`"center"`/`"center"` placement's own resolved
position differs** between `{respectGutter:true, respectVerticalMargins:true}`
and `{respectGutter:false, respectVerticalMargins:false}` under this
asymmetric geometry — proving center is genuinely computed inside the
resolved area, not a separate, flag-blind code path.

## 5. Multi-page continuation

A multi-page colophon's own continuation pages each carry their OWN
real physical index (round 28), so `respectGutter`'s parity-dependent
margin choice correctly ALTERNATES page-to-page across a real
multi-page colophon — proven directly (consecutive colophon pages'
own resolved left margins differ, each matching one of the two real
`marginGutterMm`/`marginOuterMm` values). The round-28 vertical
top-anchoring continuation rule is unchanged by this round.

## 6. Remaining gap — disclosed, not silently expanded

Body content, folio, and header painting still use one fixed,
parity-independent `marginLeftMm`/`marginRightMm` for the entire
document — a real, pre-existing v2 Publication simplification that
predates this round and colophon entirely. This round deliberately
does NOT extend gutter/outer parity-awareness to those paint paths —
that would be a materially larger, document-wide geometry change, well
beyond "porting the last two `ColophonPlacement` fields." Structural
Colophon's own product contract (fields, freeText, templates,
pagePosition, after-body-page, all 4 `ColophonPlacement` fields,
overflow, provenance, orientation, font inheritance) is now fully
ported and tested.

## 7. Real-settings QA

`qa/publication/p3-o08/structural-colophon-margin-respect-qa.pdf` — 10
documents (A–J), all through the real compiler, deliberately asymmetric
geometry: A–D (horizontal left/right × respectGutter true/false), E–H
(vertical top/bottom × respectVerticalMargins true/false), I–J
(center/center × both flags true vs both false).

`qa/publication/p3-o08/structural-colophon-final-product-qa.pdf`
(round 28's own 5-document artifact) regenerated with the same
asymmetric geometry now present, so documents C/D's own
`respectGutter`/`respectVerticalMargins:true` settings are visibly
distinguishable from A/B/E's defaults.

## Tests

`renderer/publication/structuralColophonMarginRespect.test.ts` (18
tests): `respectGutter` parity/symmetry (4), `respectVerticalMargins`
(4), center-not-exempt (1), both-flags-together (1), multi-page
continuation parity (1), regression (5: body invariance, page-order
invariance, folio, header, Ruby/Dash/TCY/Ellipsis/Small-Kana combined),
and 2 QA generators (focused + regenerated integrated artifact).

**Full regression:** Core 364/364 (unchanged), Stage C 21/21, Stage D
30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication) 379/379 (361 +
18 new) — all PASS. `npx tsc --noEmit`: 0 new errors (only the known
pre-existing `src/app/layout.tsx` baseline error).

## Safety

`src/` (legacy): read-only, cited as evidence, never modified.
Publication: additive (`pdfGenerator.ts` — two new optional
`PublicationPageGeometry` fields, `buildColophonPaintPage`'s own
placement-area resolution, `buildPaintPlan`'s isOddPage derivation for
colophon pages only; `paintModel.ts` — `colophonPlacement` now carries
the full `ColophonPlacement` instead of a 2-field subset). No Core
schema change this round (round 28's `ColophonPlacement` already
carried both fields for contract fidelity). Body/folio/header paint
paths byte-identical (proven: existing 361 Publication tests
unaffected). No new dependency. No push, no deploy, no reset. No image
embedding, no JPG, no DeviceGray, no bleed/trim, no UI, no Production
changes.
