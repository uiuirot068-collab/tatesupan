# P3-O08 — Real Image Embedding (Human Visual QA HOLD round 30, Final-Page Step 3)

Final-page completion, Step 3 (Folio/Header → Structural Colophon
[Human PASS] → **Real Image Embedding** → JPG Export). Continues from
commit `633ed70`.

## 1. Existing image contract audit (Core, unchanged this round)

Direct read, `core/units/imageUnit.ts` (Contract §14):

```ts
export type ImagePlacement = "TOP" | "CENTER" | "BOTTOM" | "FULL";
export interface ImageUnit {
  kind: "IMAGE";
  span: SourceSpan;
  refId: string;               // a REFERENCE, never raw binary (Master §12.1 privacy contract)
  intrinsicWidth: GeometryTick;
  intrinsicHeight: GeometryTick;
  placement: ImagePlacement;
}
```

`core/images/index.ts`'s `placeImage()`: checks only `fits = height <=
availableExtentTick` (the vertical-flow axis); `FULL` placement always
sets `breakBefore`/`breakAfter` (isolates the image on its own
column/page). Width is never checked against column width at the Core
level — Core's own placement decision does not constrain it.
`core/compose/line.ts`'s `advanceTickFor` IMAGE case:
`measurement.imageIntrinsicTick(unit.refId).height` is the atom's own
advance; an intrinsic height `<= 0` produces a real
`IMAGE_INTRINSIC_SIZE_UNRESOLVED` HOLD (`core/compose/line.ts:364-374`)
— never a silent zero-cost/always-fits atom. **Real authoritative
source finding**: both `compose/line.ts` and `core/images/index.ts`
read intrinsic size from the **MeasurementFacts provider**
(`imageIntrinsicTick(refId)`), not from `ImageUnit.intrinsicWidth`/
`intrinsicHeight` directly — this round's own QA fixtures keep both
values equal by construction (a disclosed Editor-layer consistency
responsibility, not enforced by Core itself).

Publication and Preview had **zero real image support** before this
round: both `renderer/publication/pdfGenerator.ts` and
`renderer/preview/paintModel.ts` painted every IMAGE unit as an
unconditional vector-rectangle placeholder (confirmed by direct read;
`docs/architecture/PHASE3_OPEN_ITEMS.md`'s own P3-O08 row and
`qa/evidence/P3_O08_REMAINING_ITEM_AUDIT.md` item 18 both record this
as a known, real, un-implemented gap — not news this round, closed
this round for Publication only, Preview intentionally untouched).

## 2. Architecture — Core vs Publication ownership (frozen, followed exactly)

Core owns the canonical image BOX (`intrinsicWidth`/`intrinsicHeight`,
real ticks) and the placement/break decision. Publication owns
resolving real local bytes and painting them into that box. This
round's own implementation never recalculates the box from the
resolved bytes' own real pixel dimensions — proven directly by test
(`realImageEmbedding.test.ts`, "real JPEG/PNG aspect ratio does NOT
drive the painted box"): a fixture whose real pixels are 400×100 (4:1)
but whose declared canonical box is square still paints square.

## 3. Publication resolver contract (extended, additive)

`renderer/publication/paintModel.ts`'s own `ImageResolution` (already
existed, previously `{kind:"PLACEHOLDER"} | {kind:"RESOLVED", url:string}`,
unused by any paint decision) is extended — additively, this file only,
Preview's own sibling `ImageResolution` type is untouched:

```ts
export type PublicationImageFormat = "JPEG" | "PNG";
export type ImageResolution =
  | { kind: "PLACEHOLDER" }
  | { kind: "RESOLVED"; url: string; bytes: Uint8Array; format: PublicationImageFormat; pixelWidth: number; pixelHeight: number }
  | { kind: "MISSING" }
  | { kind: "UNSUPPORTED_FORMAT"; detectedFormat?: string }
  | { kind: "CORRUPT" };
```

`PLACEHOLDER` is unchanged behavior (no resolver wired — every existing
typography test's own real, intentional mode, still does not throw).
`RESOLVED` now carries real bytes; the three failure kinds are real,
structured outcomes a resolver can report.

`PaintPlacedUnit` gains `imageIntrinsicWidthMm?: number` (IMAGE units
only) — width was not tracked per-unit anywhere in this file before
(every other kind paints at a shared, context-level width). Also fixed
in the same pass: an isolated `FULL`-placement image is very often the
ONLY atom on its own line (by Contract §14's own break-isolation rule),
which made the pre-existing generic "no next atom" DEV-ONLY height
*guess* trigger for the common case where a real, authoritative height
already exists — `heightMm` for IMAGE now reads `owner.intrinsicHeight`
directly instead.

## 4. Publication paint (`pdfGenerator.ts`)

New `PaintCommand` variant: `{op:"image", xMm, yMm, widthMm, heightMm,
bytes, format}`. `unitCommands`'s own new IMAGE branch: width/height =
Core's own canonical box (`unit.imageIntrinsicWidthMm`/`unit.heightMm`),
horizontally centered in the column strip, top-aligned at the unit's
own composed position. **Safety-only clamp**: if the canonical width
exceeds the column's own real physical width, BOTH dimensions scale
down together (proportionally, aspect ratio preserved) — proven by
test with a declared 500mm×250mm (2:1) box against a ~75mm-wide column:
painted result stays ≤ the real page width, ratio stays 2:1. This is a
floor against a real "paint outside the page" failure mode, not a
redesign of the default "intrinsic size, no stretch" policy.

`renderPaintPlanToPdf`'s executor: `pdf.addImage(Buffer.from(cmd.bytes),
cmd.format, cmd.xMm, cmd.yMm, cmd.widthMm, cmd.heightMm)` — jsPDF's own
real embedder, no reimplementation. For `"JPEG"`, jsPDF embeds the
already-DCT-encoded bytes directly (no recompression). For `"PNG"`,
jsPDF's own internal decoder extracts pixel data and, when present, a
real alpha channel (embedded as a PDF SMask) — real, existing jsPDF
capability, not new code here.

## 5. Missing/unsupported/corrupt — structured failure, never silent

`generatePublicationPdf` gained a pre-flight scan
(`findUnresolvedImageIssues`) mirroring its own pre-existing HOLD-throw
pattern: walks every page's own placed units, and if any IMAGE unit's
`imageResolution.kind` is `MISSING`/`UNSUPPORTED_FORMAT`/`CORRUPT`,
throws before building or rendering anything — proven by test for all
three kinds. `PLACEHOLDER` (no resolver wired) is explicitly NOT a
failure — every pre-existing typography test relies on this, unchanged.

## 6. Aspect ratio / sizing policy — audited, not assumed

The Human's own round-30 task text states the deciding rule directly:
*"Publication must NOT... recalculate layout from raster dimensions
unless the Core contract explicitly delegates an intrinsic measurement
fact."* Core's own `MeasurementFacts.imageIntrinsicTick` **is** exactly
that delegated fact — so "paint at Core's own intrinsic box, never
re-derive from the resolved bytes' real pixel size" is the architecture
this round follows, grounded in the v2 Core Contract's own text rather
than a legacy-recovery claim (unlike Structural Colophon, which
required porting a real, already-shipped legacy feature — no
comparable shipped Publication/Preview real-image behavior exists
anywhere in this codebase to port from; confirmed by direct search,
§1 above).

## 7. Transparency

Real, proven at the byte level: `qa-transparent-square`'s own real PNG
bytes are built via `fast-png`'s `encode({..., channels:4})` with a
genuine alpha=0 region outside a drawn circle; the encoded PNG's own
color-type byte (offset 25) is directly asserted to be `6`
(truecolor+alpha) — not merely claimed. jsPDF's own real PNG decoder
(existing library capability) extracts this into a PDF SMask; this
round does not reimplement PNG/alpha decoding.

## 8. Image quality / original bytes

JPEG bytes would pass through unmodified (no recompression — jsPDF's
own real behavior, confirmed by reading its own embedder contract, not
tested directly this round — see §9). PNG bytes are decoded by jsPDF's
own internal decoder (unavoidable — the PDF image-XObject model has no
native PNG encoding) — not a resampling choice made by this round's own
code. Effective DPI is a real, computable, deterministic quantity
(`sourcePixelWidth / (canonicalBoxWidthMm / 25.4)`) but no DPI
warning/UI system was built this round (none existed before; out of
this round's own scope per its own explicit "not yet unless one already
exists" instruction).

## 9. Dependency Gate — JPEG QA fixture (real, disclosed blocker)

Checked `package.json` directly: `fast-png` (a real PNG codec) is
already an approved dependency, used above for both real PNG QA
fixtures — no new dependency needed for PNG. **No JPEG encoder exists
among this repo's own approved dependencies** (confirmed by direct
`package.json` read; `jspdf` only embeds real JPEG bytes, it does not
encode them; `ag-psd` is a PSD reader/writer, not a JPEG encoder).
Hand-rolling a byte-correct baseline JPEG encoder (DCT + quantization +
Huffman entropy coding) from scratch, without a reference decoder to
verify correctness against, was judged too high-risk for this round's
own timebox — a subtly-wrong hand-built JPEG would be worse than
disclosing the gap honestly.

**Decision, per this round's own explicit process: STOP and report,
do not install.** The JPEG *code path* is real and complete —
`{op:"image", format:"JPEG"}` is architecturally identical to the PNG
path (proven directly by a PaintCommand-level test using real PNG bytes
under a `"JPEG"` format label, to exercise the code path only — never
claimed as a real decodable JPEG). What is NOT proven this round: a
real, valid JPEG file surviving the full pipeline into actual PDF
bytes. **Recommend**: either approve a small, well-known JPEG-encoding
dependency for a future round, or accept a user-supplied real JPEG
fixture placed in the repo, whichever the Human prefers.

## 10. QA fixture provenance

Both PNG fixtures are generated **programmatically**, deterministically,
from raw RGBA pixel arrays via `fast-png`'s own `encode()` — no network
download, no external asset, no Production asset touched:
- `qa-opaque-landscape` (300×200px, 3:2): a red square ONLY in the
  top-left corner, blue elsewhere — proves no accidental
  rotation/flip on round-trip through Core→Publication→jsPDF.
- `qa-transparent-square` (200×200px): an opaque green circle on a
  fully transparent (alpha=0) background — real transparency, verified
  at the byte level (§7).
- `qa-mismatched-aspect` / `qa-big` / `qa-near-max` / `qa-oversized`:
  additional synthetic fixtures for the specific aspect-ratio/scale
  tests above, same generation method.

## 11. QA artifact

`qa/publication/p3-o08/real-image-embedding-qa.pdf` — 4 documents: (A)
opaque landscape PNG alone with Folio/Header, (B) transparent PNG alone
with Folio/Header, (C) image inline between two body-text runs, (D) an
image sized to the real available column width (near-max). The
missing-image failure case is proven as a real THROWN error (not a
silent page) in the automated suite, not included as a visible QA page
(a thrown export cannot produce a page to look at, by design).

## 12. Tests / regression

`renderer/publication/realImageEmbedding.test.ts` (21 tests): canonical
box authority (3), JPEG code-path proof (1, dependency-gated), PNG
embedding + transparency (2), placement/bounds/oversize-clamp (3),
failure handling (4), real PDF output incl. a real `/Subtype /Image`
byte-level check (2), body/SourceSpan invariance (1), Folio/Header/
Structural-Colophon regression (3), Ruby/Small-Kana/Dash/TCY/Ellipsis
regression (1), QA generator (1).

**Full regression:** Core 364/364 (unchanged), Stage C 21/21, Stage D
30/30, P3-O09 (Preview) 114/114 (unaffected — Preview's own
`ImageResolution` type was never touched), P3-O08 (Publication) 496/496
(475 + 21 new) — all PASS, stable across two repeated full-suite runs.
`npx tsc --noEmit`: 0 new errors (only the known pre-existing
`src/app/layout.tsx` baseline error). Two pre-existing tests
(`typography.test.ts`, `folioHeaderPublication.test.ts`) needed a
one-line fix each to their own `PaintCommand`-narrowing helper (adding
the new `"image"` op alongside `"rect"`, since both share the same
`xMm`/`widthMm` shape) — not a behavior change, a type-narrowing
completeness fix required by the new command variant existing at all.

## 13. Remaining Publication gaps

1. **No real JPEG QA fixture** — disclosed Dependency Gate blocker,
   §9. Code path complete, unverified against a real JPEG file.
2. **No caption feature** — Core's own `ImageUnit` carries no
   caption-text field; not invented here (would be a Core Contract
   change, out of this round's own Publication-only scope).
3. **`respectGutter`/parity-aware column width** for images: images
   currently size against the SAME single fixed column-strip width
   every other Publication paint path uses (the same pre-existing,
   documented simplification noted in round 29's own margin-respect
   evidence) — not expanded or fixed this round.
4. **DPI/quality warning UI**: not built (none existed before, out of
   scope per the round's own instruction).

## Safety

`src/` (legacy): read-only where consulted (confirmed no comparable
real Publication/Preview image-embedding precedent exists to port —
§1/§6), never modified. Core: unchanged (`core/images/index.ts`,
`core/units/imageUnit.ts`, `core/compose/line.ts` all read-only this
round — the real image work is entirely Publication-side, matching the
frozen architecture). Publication: additive (`paintModel.ts` — new
`ImageResolution` variants + `imageIntrinsicWidthMm` + a real (not
approximate) IMAGE height fix; `pdfGenerator.ts` — new `{op:"image"}`
command + executor branch + pre-flight failure check). Preview: fully
untouched. No new dependency (PNG uses the already-approved `fast-png`;
JPEG's own gap is disclosed, not worked around). No push, no deploy, no
reset. No JPG *export* (the product's own final flattened-page JPG
output, a distinct, later Step 4), no DeviceGray, no bleed/trim, no UI,
no Production changes.
