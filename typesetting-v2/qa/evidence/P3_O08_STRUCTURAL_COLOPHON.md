# P3-O08 — Structural Colophon (Human Visual QA HOLD round 26)

Final-page completion, Step 2 (Folio/Header → **Structural Colophon** →
Real Image Embedding → JPG Export). Continues from commit `632323a`.

## 1. Two-mechanism audit

**Mechanism A — legacy `src/lib/colophon.ts` (TSP-LOOP-005), real,
shipped product feature.** Direct read confirms: `ColophonSettings`
(`enabled`, `templateId` — 4 templates, `fontFamily` — `""` = same as
body, `fields: ColophonField[]` — id/label/value/visible,
`freeText`, `pagePosition` — `{mode:"end"}` or
`{mode:"after-body-page", afterBodyPage}`, `placement` —
horizontal/vertical/respectGutter/respectVerticalMargins). Rendered by
`src/components/ColophonPageCard.tsx`. Own header comment: "奥付は本文
文字列（content）へは一切挿入されない。本文とは完全に独立した1ページ
（writing-mode: horizontal-tb）として、本文全ページの後ろに追加される"
— a dedicated, **HORIZONTAL-ONLY** page, never threaded through body
pagination. `resolveColophonNombre` (real, existing function): the
colophon page's own folio value continues the SAME physical-page
sequence body pages use — "ノンブルは実際の作品ページ順（物理ページ順）
に従う"; suppressed exactly like a body page would be
(`hideNombreOnFirstPage`, `nombrePosition === "hidden"`).
`colophonRenderModel`: visible fields with a non-empty label OR value
are rendered, in array order; both-empty fields are silently excluded
(the real, existing blank-field behavior).

**Mechanism B — Core's `composeColophon` (`core/colophon/index.ts`),
Contract §15.** A minimal, generic primitive:
`composeColophon(sourceBlockId, pages): ColophonBlock` — takes
ALREADY-COMPOSED `CanonicalPage[]` (from a separate `composePages` call
over the colophon's own `LogicalUnit[]`, wired in `assemble.ts`'s own
`DocumentCompositionInput.colophonUnits`/`colophonBlockId`, confirmed
present BEFORE this round). Zero knowledge of fields/templates/
placement/font — a structural container only.

## 2. Classification: **C — legacy settings compile into the structural mechanism**

Not two competing implementations. Legacy's `ColophonSettings` is real,
rich, user-facing PRODUCT data; Core's `ColophonBlock` is the minimal
STRUCTURAL container Contract §15/HD-006 require. The correct v2
architecture: `ColophonSettings` → (a settings→text compiler, NOT built
this round) → `LogicalUnit[]` → `composeColophon` → `ColophonBlock` →
Publication paint (this round's own new work). The settings→text
compiler is Editor/Production-layer integration — matching the SAME
"segmentation discovery upstream of Core" boundary already established
for jukugo-ruby (P3-O14) — genuinely out of Core's own scope, not
silently deleted or assumed away. This round proves the REAL, GENERIC
mechanism end-to-end using real colophon-like text content (not the
full `ColophonSettings` object), and wires the previously-missing
Publication paint side.

## 3. Canonical representation

Already sufficient — no new Core schema type needed. `ColophonBlock`
(`{sourceBlockId, pages: CanonicalPage[]}`) already satisfies HD-006's
own "formal Canonical Layout element" requirement; `CanonicalPage`
already carries `folio?`/`header?` (rounds 21-25), which this round
extends to colophon pages too (§5).

## 4. Page semantics

Colophon is composed as its OWN, entirely separate `CanonicalPage[]`
set (via a second `composePages` call over `colophonUnits`, unchanged,
pre-existing) — never threaded through body columns/lines. Currently
supported: `{mode:"end"}` only — the colophon's own pages are appended
AFTER all body pages, both in Core's own page-index continuation (§5)
and in Publication's own paint-plan ordering (§6). **Disclosed gap,
not silently generalized:** legacy's own `after-body-page` mid-insertion
mode (re-interleaving colophon between two body pages) is real product
behavior, NOT ported this round — would require re-numbering/
re-interleaving body pages themselves, a materially larger scope.

## 5. Folio/header interaction — corrects round 21's own untested assumption

Round 21's own doc comment asserted "colophon pages... never receive
folio" — an UNTESTED ASSUMPTION at the time, not audited evidence. This
round's own direct read of legacy's real `resolveColophonNombre`
disproves it: the colophon page DOES participate in the same physical
page/folio sequence. `core/layout/assemble.ts` now attaches
folio/header to colophon pages too, continuing the SAME `pageIndex`
sequence body pages use (`pageIndex = bodyPages.length + colophonPageIndex`).
Proven directly: a 1-body-page document's colophon page gets folio text
`"2"` (continuing from body page `"1"`) and receives `hashiraEven`
(not `hashiraOdd`) — physical page 2 is even.

## 6. Typography / orientation

**Orientation: HORIZONTAL — preserved, not invented.** Legacy's own
`writing-mode: horizontal-tb` is real, confirmed product behavior (§1).
Colophon content is composed through the SAME vertical Natural-Pitch
`composePages` body content uses (Core's own existing, reused
mechanism — the LINE-BREAKING decision, i.e. "which characters share a
line," is real and reusable regardless of final paint orientation).
Publication's new `buildColophonPaintPage` (`pdfGenerator.ts`)
reinterprets that already-decided line structure as horizontal rows,
painted top-to-bottom via the SAME `horizontalFurnitureCommand`
single-line path folio/header already established (round 23) —
deliberately bypassing `verticalGraphemeCommands`/GSUB vert-vrt2/
small-kana/yakumono entirely, none of which are horizontal-writing
concerns. Font inheritance: HD-005 default (fixed `bodyEmMm`, same as
folio/header) — proven directly, every colophon glyph shares one
`fontSizePt`. **Disclosed scope limit:** only the first column of each
colophon page is painted — ordinary colophon content (a handful of
short field rows) fits within one column in every fixture this round
proves; a colophon long enough to overflow into a second column would
need real multi-column horizontal layout, not built this round.

## 7. Publication rendering

`renderer/publication/paintModel.ts`: `PublicationDocument.colophonPages?:
PaintPage[]` (new, optional/additive), built via the SAME `buildPaintPage`
already used for body pages — reused, not reimplemented — from
`buildPublicationDocument`'s new optional `colophonUnits`/`colophonSource`
parameters (their own separate `LogicalUnit[]`/source string, since
colophon `SourceSpan`s are meaningless against the body's own source).
`renderer/publication/pdfGenerator.ts`: `buildPaintPlan` appends the
colophon's own paint pages AFTER the body's own paint pages
(`[...bodyPlan, ...colophonPlan]`) — Publication never independently
decides page existence/order; it only walks what Core already composed
and appended.

## 8. Body invariance

Proven directly, not just "tests still pass": manuscript
`document.pages` are structurally `toEqual`-identical with colophon
enabled vs. disabled — colophon composition never touches body
SourceSpan, line breaks, or page composition.

## 9. QA artifact

`qa/publication/p3-o08/structural-colophon-qa.pdf` — 2 documents (4
pages total): a minimal colophon (`書名：短編`, single field) and a
fuller colophon (title/author/date/circle/contact, five fields), each
with a real body page + folio + header, all through the real
`composeCanonicalDocument`/`buildPublicationDocument` pipeline — no
synthetic `CanonicalPage`/`PublicationDocument` injection anywhere.

## 10. Tests

`renderer/publication/structuralColophon.test.ts` (17 tests): Core
integration determinism, distinct-block confirmation, omission-safety,
real-SourceSpan-against-its-own-block proof, field-order determinism,
folio/header attachment + parity determinism, body-layout invariance,
vector-only/horizontal-orientation/font-inheritance proofs, renderer
non-reflow proof, combined-fixture regression, small-kana regression,
and the QA-artifact generator.

**Full regression:** Core 364/364 (unchanged — zero Core-behavior
change for any existing caller, only additive fields/parameters), Stage
C 21/21, Stage D 30/30, P3-O09 (Preview) 114/114, P3-O08 (Publication)
312/312 (295 + 17 new) — all PASS. `npx tsc --noEmit`: 0 new errors
(only the known pre-existing `src/app/layout.tsx` baseline error).

## 11. Remaining final-page tasks

1. ~~Folio/Header~~ — rounds 20-25.
2. ~~Structural Colophon~~ — this round, with disclosed gaps: (a)
   `after-body-page` mid-insertion mode, (b) full `ColophonSettings`→text
   compiler (templates/placement/per-page overrides), (c) multi-column
   colophon overflow.
3. Real Image Embedding.
4. JPG Export.

## Safety

`src/` (legacy): read-only, cited as evidence, never modified. Core:
changed additively (`core/layout/assemble.ts` — folio/header now also
applied to colophon pages) — every existing caller/test byte-identical
(proven: exact unchanged 364/364 count). Preview: untouched. No new
dependency. No push, no deploy, no reset.
