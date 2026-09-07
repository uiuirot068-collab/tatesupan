# P3-O08 — Final-Page Completion, Step 1: Folio/Header Publication Paint (Human Visual QA HOLD round 20)

Continues from `qa/evidence/P3_O08_REMAINING_ITEM_AUDIT.md` (commit
`705decf`), which identified folio/header as a real, scoped gap. Step
1 of the sequence Folio/Header → Structural Colophon → Real Image
Embedding → JPG Export.

## Contract audit (direct reads, not memory)

1. **What folio means in current Core**: `CanonicalPage.folio?: PlacedUnit`
   (`core/layout/schema.ts:78`, "page-decoration layer, Contract §15").
   Contract §15's own text: "Page-decoration layer: folio (page number)
   and 柱 (running header), which are derived *from* page position but
   are not part of the flowing manuscript content stream."
2. **What header (柱) means**: named in Contract §15's prose alongside
   folio, but — confirmed by direct search of `core/layout/schema.ts`
   and every file under `core/` — **柱 has no schema field at all**, not
   even an unpopulated placeholder like folio has. This is an earlier-
   stage gap than folio: there is nothing to "wire" for 柱 in Publication
   because Core has no representation of it whatsoever yet.
3. **Are values already resolved per page?** No. Confirmed directly:
   `folio` never appears in `core/compose/page.ts`, `core/layout/assemble.ts`,
   or anywhere in `core/compose/`/`core/layout/` outside its own type
   declaration. Preview's own `renderer/preview/paintModel.ts` already
   documented this exact same finding (its own comment: "Never
   populated by Core today... Recorded as PENDING CORE DATA, not
   invented here") and passes `page.folio` through as a raw,
   never-painted `PlacedUnit`. Confirmed independently this round, not
   assumed from Preview's own comment.
4. **Left/right page parity**: no parity logic exists anywhere (Core
   never computes odd/even placement; there is no field for it).
   Contract-consistent: if a future Core ever computes a parity-aware
   `xTick`, Publication should paint wherever that tick says — Renderer
   must never decide pagination-adjacent policy itself.
5. **Blank/front-matter suppression**: the field being `?:` (optional)
   IS the entire suppression mechanism — Core omits it, Publication
   paints nothing. No separate suppression flag/rule exists or is
   needed.
6. **Font/style inheritance**: `core/settings/index.ts`'s
   `headerFooterFontRef?: string` ("柱/奥付, independently overridable —
   Master HD-005") is the real, existing font-inheritance policy field.
   HD-005 (`docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` §20.5,
   "柱/奥付フォントの継承と上書き") decides: inherits the body font by
   default, independently overridable. **Note honestly recorded**:
   HD-005's own title names 柱 (header) and 奥付 (colophon) specifically,
   not folio (ノンブル/page number) — Contract §15's own sentence groups
   folio and 柱 together as one "page-decoration layer," so this
   evidence treats HD-005's default (inherit body font) as applying to
   folio too, as the most reasonable reading, not a separately-proven
   fact for folio specifically.
7. **HD-005 override mechanism**: `headerFooterFontRef` is a real
   settings field, but **no override plumbing exists anywhere in
   Publication's own rendering pipeline** — `generatePublicationPdf`/
   `buildPaintPlan` receive exactly one `PublicationFontResource` for
   the whole document, always. Only HD-005's DEFAULT (inherit body
   font) is implemented this round; building a real per-decoration-
   layer font override is explicitly out of scope ("Do NOT invent a new
   page-number/header system") and left for a future round if ever
   needed.

## Architecture

`CanonicalPage.folio` (raw `PlacedUnit`) → `PaintPage.folio`
(`PaintFolio`, pre-resolved `{text, xMm, topMm}`) → real vector paint in
`buildPaintPlan`. This deliberately DIVERGES from Preview's own
raw-pass-through (`folio: page.folio`, unresolved) — documented in
`paintModel.ts`'s own new comment as a considered choice, not an
oversight: Publication's own established two-stage design (`paintModel.ts`
always resolves text/mm up front; `pdfGenerator.ts` never re-touches
raw `LogicalUnit`/source) already applies to every other unit kind, and
folio is kept consistent with it rather than treated as a special case.

**Position contract** (working, since Core supplies no real data to
confirm against yet): `folio.xTick`/`folio.yTick` are treated exactly
like a body `PlacedUnit`'s own coordinates — `xTick` an absolute offset
from the content area's own right edge (mirroring `column.rightMm +
line.rightMm`), `yTick` an absolute offset from the content area's own
top edge (mirroring `placed.yTick`), both converted via the SAME
`tickToMm` every other coordinate in this file uses. Renderer never
computes pagination or decides WHERE on the page folio goes — it only
converts whatever tick Core supplies to mm, exactly as it already does
for body content.

## Implementation

- `renderer/publication/paintModel.ts`: `PaintFolio` (new), `PaintPage.folio?`
  (new field), `buildPaintFolio` (new, resolves text via the same
  `sliceCodePoints`/`source`+`sourceSpan` convention every other unit
  uses), threaded through `buildPaintPage`.
- `renderer/publication/pdfGenerator.ts`: `buildPaintPlan` paints
  `page.folio` (when present and a font is supplied) via the SAME
  `verticalGraphemeCommands` real vector-glyph path body text already
  uses — real GSUB outline paint for characters that need it, real text
  paint otherwise, at the fixed `bodyEmMm` size (HD-005 default). Body
  columns/lines are painted completely unaffected, in the same loop as
  before, before the folio branch — folio can never alter body
  coordinates.

## Since Core has no real producer yet — how this was tested

`folioHeaderPublication.test.ts` constructs a folio-bearing
`PublicationDocument` directly (copying an ALREADY-composed, real
document from `composeCanonicalDocument` and only adding a synthetic
`folio` field) — the same technique many Core tests already use to
exercise one half of a pipeline whose other half has no real producer.
This proves the PAINT mechanism is correct without inventing what
Core's own future folio semantics should be.

## Regression proof

Body layout (canonical coordinates, page/column/line geometry) is
proven byte-identical with or without a folio present, by direct
structural comparison (not just "tests still pass"). Ruby/TCY/Dash/
Ellipsis/punctuation all render correctly on a page that also carries a
folio, in the same combined-fixture test.

## QA artifact

`qa/publication/p3-o08/folio-header-qa.pdf` — 3 pages at realistic 文庫
geometry (105×148mm): odd page (folio present, one `xMm`), even page
(folio present, a different `xMm`, simulating a hypothetical future
left/right-page distinction Core might one day compute), suppressed
page (no folio at all, e.g. a front-matter/blank page) — body text
identical and unaffected across all three.

## Tests

`renderer/publication/folioHeaderPublication.test.ts` (11 tests):
contract-audit proofs (2), text-resolution determinism, odd/even
placement is Core's own decision, suppression via the optional field,
body-layout invariance (byte-identical structural comparison), real
vector paint mechanism, font-size inheritance, determinism,
Ruby/TCY/Dash/Ellipsis/punctuation combined-fixture regression, and the
QA-artifact generator.

**Full regression:** Core 364/364 (unchanged — zero Core files
touched), Stage C 21/21, Stage D 30/30, P3-O09 (Preview) 114/114, P3-O08
(Publication) 230/230 (219 + 11 new) — all PASS. `npx tsc --noEmit`: 0
new errors (only the known pre-existing `src/app/layout.tsx` baseline
error).

## Remaining final-page tasks

1. ~~Folio/Header~~ — this round.
2. Structural Colophon (`core/colophon/index.ts`'s `composeColophon`
   exists, unwired in Publication — same "Core capability exists,
   Publication paint doesn't" pattern as folio was before this round).
3. Real Image Embedding.
4. JPG Export.

## Safety

`src/` (legacy): untouched. Core: untouched (zero files) — this is
Publication paint plumbing only, consuming an already-existing schema
field, never inventing new Core semantics. No new dependency. No push,
no deploy, no reset.
