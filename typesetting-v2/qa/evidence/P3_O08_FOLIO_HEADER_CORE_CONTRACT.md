# P3-O08 — Folio/Header Core Contract Completion (Human Visual QA HOLD round 21)

Continues from `qa/evidence/P3_O08_FOLIO_HEADER_PUBLICATION.md` (commit
`ab903ff`), which wired Publication's own paint side but left Core
generation missing. This round audits the REAL, existing legacy product
contract and ports what's recoverable within scope.

## 1. Legacy/product audit (direct reads, not memory)

Legacy `src/lib/pageLayout.ts` has a **real, fully-shipped, much richer
contract** than Core's own bare `folio?: PlacedUnit` placeholder ever
implied — found by direct read, not assumed absent.

### FOLIO (ノンブル)

| Question | Answer (legacy `MasterPageSettings`/`PageOverride`) |
|---|---|
| Enable/disable | No global on/off; `PageOverride.hideNombre` (per-page) + `MasterPageSettings.hideNombreOnFirstPage` |
| Starting value | `nombreStart: number` (default 1) |
| Numbering source | Sequential physical page order from `nombreStart` |
| Physical vs logical | Physical page sequence (no distinct logical/physical split found) |
| Odd/even placement | `nombrePosition: "center" \| "gutter" \| "outer" \| "hidden"` — gutter/outer are position CONCEPTS, not separately odd/even-keyed fields; resolving "which physical side is gutter for this page" is a separate, unresolved question (§4 below) |
| First-page behavior | `hideNombreOnFirstPage: boolean` (default false) |
| Blank-page behavior | Not separately specified — governed by the same per-page `hideNombre` override |
| Font size | `nombreFontSize?: number` (default 5pt for 文庫), with `recommendedNombreFontSizePt` fallback (body−3pt, min 6pt) when not customized |
| Font inheritance | `nombreFontFamily?: string` (`""` = same as body, the default) |

### HEADER (柱)

| Question | Answer |
|---|---|
| Exposed in current product | **YES** — real, shipped fields |
| Text source | User-typed strings: `hashiraOdd`/`hashiraEven` (master), `PageOverride.hashiraOverride` (per-page) — NOT auto-derived from title/author document metadata |
| Enable/disable | `PageOverride.hideHashira` (per-page); no separate master on/off beyond an empty string |
| Odd/even behavior | Distinct content per parity: `hashiraOdd` vs `hashiraEven` |
| Position | `hashiraPosition: "top" \| "bottom"` |
| Font size | `headerFontSize?: number` (default 8pt) |
| Body-font inheritance | HD-005 (Master §20.5): inherits body font by default, independently overridable — no separate font-FAMILY field found for 柱 specifically (unlike nombre's `nombreFontFamily`), consistent with Phase 0's own freeze text ("settings UI/data model TBD in later phases") |

**Classification: HEADER is FOUND (real product behavior), not PARTIAL
or NONE** — this corrects round 20's own working assumption that 柱 had
"no Core representation... nothing to wire." It has real legacy
behavior; it simply has no v2 Core representation yet, and — given its
content is arbitrary user-authored text (not derivable from any
existing Core input) plus a real odd/even+position+suppression
contract — porting it fully is a distinctly-scoped task, not a natural
extension of this round's own folio work. **Not implemented this round
due to scope, not because no behavior exists.**

## 2. Decision gate classification

- **FOLIO: B — partial contract exists, one class of value unresolved.**
  Sequential numbering, `nombreStart`, `hideNombreOnFirstPage`, and
  `"center"` position are fully recoverable and implemented this round.
  `"gutter"`/`"outer"` resolution (§4) and the full font-size/font-family
  override surface are real but out of this round's scope.
- **HEADER: C, with real evidence — recorded as an explicit, scoped
  future item, not invented.** Proven via §1's own table, not guessed
  absent.

## 3. Generated-furniture source semantics

Folio/header are generated page furniture, never manuscript characters
— `core/layout/schema.ts`'s `CanonicalPage.folio` was previously typed
`PlacedUnit` (which REQUIRES a `SourceSpan`, an INV-001-protected,
manuscript-content-only concept). Confirmed — by direct audit — to have
never actually been populated by any Core module, so changing its exact
shape is a clean, non-breaking change. New type:

```ts
export type FolioPosition = "center" | "gutter" | "outer"; // legacy NombrePosition, minus "hidden" (represented by folio's own absence)
export interface GeneratedPageFurniture {
  text: string;   // generated content -- never sliced from manuscript source
  position: FolioPosition;
}
export interface CanonicalPage {
  ...
  folio?: GeneratedPageFurniture; // was PlacedUnit
}
```

No manuscript `SourceSpan` is ever fabricated — proven directly by a
dedicated test.

## 4. Physical-geometry boundary — architectural gap, reported not faked

Core's own tick-coordinate system is content-relative (column/line
extent in ticks) — it has NO concept of physical paper size or margins
(`PublicationPageGeometry` is a Publication-paint-boundary-only
concept, established only at `generatePublicationPdf`'s own call site).
Legacy's `nombreBottomMargin`/`nombrePosition: "gutter"|"outer"` require
knowing the PAPER's own physical bottom margin and which physical side
(left/right) is "inside" for a given page — Core cannot express this
today without fabricating a physical-geometry concept it doesn't own.

**This is the "STOP that branch" case the task itself anticipated.**
Resolution: `GeneratedPageFurniture.position` carries a SEMANTIC value
only (`FolioPosition`); Core generates content + semantic position;
Publication (which owns real `PublicationPageGeometry` margins) resolves
"center" into physical mm. `"gutter"`/`"outer"` are ported into the
TYPE (so a future round needs no schema change) but `core/folio/index.ts`
only ever GENERATES `"center"` this round, and Publication paints
NOTHING for `"gutter"`/`"outer"` rather than faking a position — both
sides agree, no silent wrong output anywhere in the pipeline.

**Remaining Human/Product decision, explicitly not assumed:** which
physical side is "inside" (gutter) for an odd vs. even page, given
TateSpun's own book-binding direction convention. This blocks
`"gutter"`/`"outer"` generation+resolution specifically — nothing else.

## 5. Core → Preview/Publication flow

`core/layout/assemble.ts`'s `composeCanonicalDocument` gains an
OPTIONAL, additive `folioSettings?: FolioSettings` input. When omitted
(every existing caller, including all 364 Core tests), behavior is
byte-identical to before this round — proven directly, not just "tests
still pass" (Core 364/364, the exact unchanged count). When supplied,
`core/folio/index.ts`'s `composeFolioForPage` (ported verbatim from
legacy field names/defaults/semantics) attaches `folio` to each body
page post-composition — colophon pages, per Contract §15, are a
distinct isolated block and never receive one.

Both `renderer/preview/paintModel.ts` and `renderer/publication/paintModel.ts`
consume the SAME `CanonicalPage.folio` field — Preview's own type
updated to `GeneratedPageFurniture` (was `PlacedUnit`, now consistent
with the schema change) but its paint logic is unchanged (still a raw
pass-through, still painted by nothing downstream — Preview has built
no folio paint logic at all, a separate, not-yet-scoped item). No
duplicate logic was created — one Core generator, two Renderer
consumers, exactly the intended architecture.

## 6. Publication implementation

`renderer/publication/paintModel.ts`: `PaintFolio` simplified to
`{text, position}` (identical shape to `GeneratedPageFurniture` — no
tick-to-mm conversion needed any more, since position is semantic).
`renderer/publication/pdfGenerator.ts`: resolves `position === "center"`
into `xCenter = paperWidthMm / 2`, `topMm = paperHeightMm - marginBottomMm`
— both derived directly from `PublicationPageGeometry`, proven by a test
showing the folio's own painted position moves when paper width changes
(never a fixed/fabricated coordinate). Paints via the SAME real vector
font path body text uses (`verticalGraphemeCommands`), at the fixed
`bodyEmMm` size (HD-005 default).

## 7. Regression proof

Body layout (`document.pages[0].columns`) proven byte-identical with
`folioSettings` enabled vs. omitted, by direct structural comparison.
Ruby/TCY/Dash/Ellipsis/punctuation all render correctly on a page that
also carries a real, Core-generated folio.

## 8. QA artifact

`qa/publication/p3-o08/folio-header-real-contract-qa.pdf` — 3 pages, all
through the REAL `composeCanonicalDocument({ folioSettings })` pipeline
(no synthetic `PublicationDocument`/`PaintPage` injection anywhere):
page with folio "1" (`nombreStart: 1`), page with
`hideNombreOnFirstPage: true` (suppressed — no folio painted), page with
`folioSettings` entirely omitted (pre-round-21 behavior, no `folio`
field on the page at all). Body text identical and unaffected across
all three. Round 20's own `folio-header-qa.pdf` (synthetic-injection
proof-of-mechanism) is left on disk as superseded historical record,
not deleted.

## 9. Remaining Human/Product decisions

1. Which physical side is "gutter" (inside) for a given page's own
   parity + TateSpun's binding-direction convention — blocks
   `"gutter"`/`"outer"` folio position generation+resolution.
2. Whether/how to port 柱 (running header) — real product behavior
   exists (§1), scope not yet sized for a dedicated round.
3. Full nombre font-size/font-family override surface (legacy's
   `nombreFontSize`/`nombreFontFamily`) — only HD-005's own default
   (inherit body font, fixed size) is implemented; no override plumbing
   exists in Publication's rendering pipeline yet (same gap round 20
   already recorded).

## 10. Next final-page task

**Structural Colophon** — same "Core capability may exist, Publication
paint doesn't" pattern folio had before round 20; `core/colophon/index.ts`'s
`composeColophon` already exists and is unwired in Publication.

## Tests

`renderer/publication/folioHeaderPublication.test.ts` rewritten (15
tests, real pipeline only, zero synthetic injection): Core generation
(omission-safety, value/suppression/determinism, no-SourceSpan-fakery,
body-layout invariance), Publication paint (text/position resolution,
real-geometry-derived coordinates, vector-only paint, font-size
inheritance, suppression, determinism), combined-fixture regression,
and the QA-artifact generator.

**Full regression:** Core 364/364 (the EXACT pre-round-21 count —
confirms the new optional field changes nothing for any existing
caller), Stage C 21/21, Stage D 30/30, P3-O09 (Preview) 114/114, P3-O08
(Publication) 234/234 (219 + 15 new, replacing round 20's own 11) — all
PASS. `npx tsc --noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error).

## Safety

`src/` (legacy): read-only, cited as evidence, never modified. Core:
changed (`core/layout/schema.ts`, `core/layout/assemble.ts`, new
`core/folio/index.ts`, `core/index.ts` exports) — but additive and
optional throughout; every existing caller/test is byte-identical.
Preview: one type-only change (`PlacedUnit` → `GeneratedPageFurniture`
for its own `folio?` field), zero behavior change. No new dependency.
No push, no deploy, no reset.
