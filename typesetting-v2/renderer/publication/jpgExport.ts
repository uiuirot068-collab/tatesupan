// P3-O08 -- Final-page completion, JPG Export (Human Visual QA HOLD
// round 31). Export CONTRACT layer -- filenames, print/web geometry
// transform, ZIP packaging -- kept separate from `rasterGenerator.ts`'s
// low-level PaintCommand-to-Canvas executor, per this round's own
// "keep filenames outside low-level raster rendering" instruction.
//
// PRODUCT CONTRACT (recovered from `src/utils/exportImage.ts` /
// `src/utils/exportFilename.ts`, real legacy source -- NOT imported from
// `src/`, faithfully re-implemented here as v2's own owned copy of the
// same real, cited contract; see qa/evidence/... for full citations):
//   - one JPG per page, never a stitched multi-page image
//   - print JPG: crop to the TrimGuide trim rect, then resize ONCE so
//     the long side = `PRINT_JPG_LONG_SIDE_PX` (1600), quality 0.95
//   - web JPG: no crop, no resize -- canonical raster size as rendered,
//     quality 0.95
//   - filename: `${sanitizeFilename(title)}_${3-digit page number}.jpg`
//   - ZIP filename: `${sanitizeFilename(title)}_jpg.zip`
//
// DISCLOSED SIMPLIFICATION (JPG Export scope audit): legacy's "crop to
// TrimGuide" step removes a bleed margin that exists in legacy's own DOM
// capture. v2's `PublicationPageGeometry` has no bleed/trim field at all
// (bleed/trim was explicitly out of scope for the whole P3-O08 final-page
// sequence, never implemented for Publication PDF either) -- so for v2,
// the canonical page raster's own full extent already equals what legacy
// would call the "trim rect." The crop step therefore degrades to a real,
// disclosed no-op (`toPrintCanvas` starts directly from the full base
// raster) rather than being silently dropped or invented against a
// geometry field that does not exist.
import JSZip from "jszip";
import { createCanvas, type Canvas } from "@napi-rs/canvas";
import { renderPaintPlanToRasterPages, PRINT_JPG_LONG_SIDE_PX, JPEG_QUALITY, RASTER_DPI, type RasterPage } from "./rasterGenerator";
import { buildPublicationPaintPlan, type PaintPlan, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import type { PublicationDocument } from "./paintModel";

export type JpgExportMode = "WEB" | "PRINT";

// --- Filename contract (ported verbatim from `src/utils/exportFilename.ts`) ---

const FALLBACK_TITLE = "無題のドキュメント";
const FORBIDDEN_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(FORBIDDEN_FILENAME_CHARS, "")
    .trim()
    .replace(/[.\s]+$/, "");
  return cleaned.length > 0 ? cleaned : FALLBACK_TITLE;
}

function padPageNumber(pageNumber: number): string {
  return String(pageNumber).padStart(3, "0");
}

export function buildPageJpgFileName(title: string, pageNumber: number): string {
  return `${sanitizeFilename(title)}_${padPageNumber(pageNumber)}.jpg`;
}

export function buildZipFileName(title: string): string {
  return `${sanitizeFilename(title)}_jpg.zip`;
}

// --- Print/web geometry transform ---

function computeLongSideResize(pixelWidth: number, pixelHeight: number, longSidePx: number): { width: number; height: number } {
  const longSide = Math.max(pixelWidth, pixelHeight);
  const scale = longSidePx / longSide;
  return { width: Math.max(1, Math.round(pixelWidth * scale)), height: Math.max(1, Math.round(pixelHeight * scale)) };
}

function toPrintCanvas(base: RasterPage): Canvas {
  const { width, height } = computeLongSideResize(base.pixelWidth, base.pixelHeight, PRINT_JPG_LONG_SIDE_PX);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  // See module doc: no separate trim-rect crop exists in v2's page
  // geometry, so this draws the FULL base raster (already == the "trim"
  // extent) scaled to the print long-side target -- the one real
  // transform legacy's print path applies that v2 can currently support.
  ctx.drawImage(base.canvas, 0, 0, width, height);
  return canvas;
}

export interface JpgPageResult {
  fileName: string;
  bytes: Uint8Array;
  pixelWidth: number;
  pixelHeight: number;
}

// One JPG per page, from the SAME PaintPlan PDF uses -- never a second
// layout/composition pass, never a stitched multi-page image.
export async function exportPaintPlanToJpgPages(plan: PaintPlan, fontResource: PublicationFontResource | undefined, title: string, mode: JpgExportMode, dpi: number = RASTER_DPI): Promise<JpgPageResult[]> {
  const basePages = await renderPaintPlanToRasterPages(plan, fontResource, dpi);
  return basePages.map((base, i) => {
    const targetCanvas = mode === "PRINT" ? toPrintCanvas(base) : base.canvas;
    const bytes = new Uint8Array(targetCanvas.toBuffer("image/jpeg", JPEG_QUALITY));
    return {
      fileName: buildPageJpgFileName(title, i + 1),
      bytes,
      pixelWidth: targetCanvas.width,
      pixelHeight: targetCanvas.height,
    };
  });
}

export interface JpgZipResult {
  fileName: string;
  bytes: Uint8Array;
  pages: JpgPageResult[];
}

// Reuses the ALREADY-approved `jszip` dependency (no new dependency) --
// mirrors legacy's own `exportPagesToZip` (JSZip + file-saver) contract,
// minus the browser-only file-saver download step (a UI-layer concern,
// explicitly out of this engine module's scope per this round's own
// instruction).
export async function exportPaintPlanToJpgZip(plan: PaintPlan, fontResource: PublicationFontResource | undefined, title: string, mode: JpgExportMode, dpi: number = RASTER_DPI): Promise<JpgZipResult> {
  const pages = await exportPaintPlanToJpgPages(plan, fontResource, title, mode, dpi);
  const zip = new JSZip();
  for (const page of pages) zip.file(page.fileName, page.bytes);
  const zipBytes = await zip.generateAsync({ type: "uint8array" });
  return { fileName: buildZipFileName(title), bytes: zipBytes, pages };
}

// Real production entrypoint mirroring `generatePublicationPdf` --
// SAME HOLD/unresolved-image pre-flight refusal (INV-010: never a
// silent broken-image JPG export), reused via `buildPublicationPaintPlan`
// rather than duplicated.
export async function generatePublicationJpgPages(
  doc: PublicationDocument,
  fontResource: PublicationFontResource | undefined,
  pageGeometry: PublicationPageGeometry | undefined,
  title: string,
  mode: JpgExportMode,
  dpi: number = RASTER_DPI
): Promise<JpgPageResult[]> {
  const plan = buildPublicationPaintPlan(doc, fontResource, pageGeometry, "generatePublicationJpgPages: refusing to emit a Publication JPG");
  return exportPaintPlanToJpgPages(plan, fontResource, title, mode, dpi);
}

export async function generatePublicationJpgZip(
  doc: PublicationDocument,
  fontResource: PublicationFontResource | undefined,
  pageGeometry: PublicationPageGeometry | undefined,
  title: string,
  mode: JpgExportMode,
  dpi: number = RASTER_DPI
): Promise<JpgZipResult> {
  const plan = buildPublicationPaintPlan(doc, fontResource, pageGeometry, "generatePublicationJpgZip: refusing to emit a Publication JPG");
  return exportPaintPlanToJpgZip(plan, fontResource, title, mode, dpi);
}
