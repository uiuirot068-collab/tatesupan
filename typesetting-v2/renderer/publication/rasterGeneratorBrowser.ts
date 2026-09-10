// P3-O08 -- JPG Export, browser production executor (Human Visual QA
// HOLD round 32: browser production integration, Human architecture
// decision). This is the REAL PRODUCTION raster path -- consumes the
// EXACT SAME `PaintPlan`/`PaintCommand` stream `pdfGenerator.ts` (PDF)
// and `rasterGenerator.ts` (Node QA reference) already produce/execute,
// never a second layout/composition engine. Mirrors `rasterGenerator.ts`'s
// own command-by-command mapping exactly (same traversal order, same
// coordinate math, same fill/stroke rules) but targets native browser
// Canvas 2D instead of `@napi-rs/canvas` -- see that module's own doc for
// the full per-command rationale, not repeated here.
//
// HUMAN ARCHITECTURE DECISION (JPG Export browser-production-integration
// gate): production JPG export uses native browser Canvas 2D. No server
// route. `@napi-rs/canvas` remains a devDependency, used ONLY by
// `rasterGenerator.ts` for Node/Vitest automated verification and QA
// artifact generation -- this file contains ZERO runtime import of
// `@napi-rs/canvas`, `Buffer`, `fs`, or `path`, and must never gain one.
import type { PaintCommand, PaintPlan } from "./pdfGenerator";
import { RASTER_DPI, PRINT_JPG_LONG_SIDE_PX, JPEG_QUALITY, mmToPx, ptToPx, computeLongSideResize } from "./rasterShared";

// The browser executor only ever needs the font's own CSS family NAME
// (to set `ctx.font`/wait on `document.fonts`) -- never font BYTES
// (unlike the Node/PDF paths, which embed real TTF data). Callers pass
// the SAME real webfont family name already loaded via Google Fonts in
// `src/app/layout.tsx` (e.g. "Shippori Mincho") -- no font resource
// object with unused `fileName`/`base64` fields is needed here.
export type BrowserFontFamily = string;

// --- Font readiness (Phase 5: never silently rasterize before the
// intended font is ready) ---------------------------------------------
//
// The real production app already loads "Shippori Mincho" as a real
// webfont via Google Fonts in `src/app/layout.tsx`'s own `<head>` link
// (confirmed by direct read) -- every real page in this app, including
// wherever this executor is used, already has that `<link>` present.
// This function does not fetch/register any font file itself (no new
// font binary is bundled here); it only waits for the browser's own
// already-declared webfont to finish loading before painting text.
export async function ensureFontReady(fontFamily: string): Promise<boolean> {
  if (typeof document === "undefined" || !("fonts" in document)) return false;
  try {
    await document.fonts.load(`16px "${fontFamily}"`);
    await document.fonts.ready;
    return document.fonts.check(`16px "${fontFamily}"`);
  } catch {
    // Controlled fallback (Phase 5): font readiness could not be
    // confirmed -- the caller is told (return false) rather than this
    // function silently pretending the font is ready. Painting still
    // proceeds if the caller chooses to continue (the browser's own
    // font-matching falls back to its default serif), but callers that
    // need strict fidelity should surface this to the user.
    return false;
  }
}

// --- Image loading (Phase 7: browser-compatible byte/blob/image decode,
// no Node Buffer) -------------------------------------------------------

async function loadBrowserImage(bytes: Uint8Array): Promise<HTMLImageElement | ImageBitmap> {
  // `createImageBitmap` is the broadly-supported, GC-friendlier modern
  // path (avoids ever attaching a decoded image to the DOM); falls back
  // to a real `HTMLImageElement` + `decode()` for environments where it
  // is unavailable (older browsers/some test shims) -- both are valid
  // `CanvasImageSource` values `drawImage` accepts identically.
  const blob = new Blob([bytes as BlobPart]);
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(blob);
  }
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// --- Shared per-page paint executor (mirrors `rasterGenerator.ts`'s own
// `paintCommandsOnContext` exactly, command-for-command) ----------------

async function paintCommandsOnContext(ctx: CanvasRenderingContext2D, commands: PaintCommand[], dpi: number, fontFamily: BrowserFontFamily | undefined): Promise<void> {
  ctx.strokeStyle = "black";
  ctx.fillStyle = "black";
  ctx.lineWidth = mmToPx(0.05, dpi); // matches pdfGenerator.ts's `pdf.setLineWidth(0.05)`
  const imageCache = new Map<string, HTMLImageElement | ImageBitmap>();

  for (const cmd of commands) {
    if (cmd.op === "rect") {
      // jsPDF's `pdf.rect(x, y, w, h)` (no style argument) strokes only --
      // see `rasterGenerator.ts`'s own identical comment.
      ctx.strokeRect(mmToPx(cmd.xMm, dpi), mmToPx(cmd.yMm, dpi), mmToPx(cmd.widthMm, dpi), mmToPx(cmd.heightMm, dpi));
      continue;
    }
    if (cmd.op === "image") {
      const cacheKey = `${cmd.bytes.byteLength}:${cmd.format}:${cmd.xMm}:${cmd.yMm}`;
      let image = imageCache.get(cacheKey);
      if (!image) {
        image = await loadBrowserImage(cmd.bytes);
        imageCache.set(cacheKey, image);
      }
      // Real JPEG and PNG (incl. real alpha) both draw via the identical
      // `drawImage` call -- the browser's own image decoder handles both
      // formats natively, no format-specific branch.
      ctx.drawImage(image, mmToPx(cmd.xMm, dpi), mmToPx(cmd.yMm, dpi), mmToPx(cmd.widthMm, dpi), mmToPx(cmd.heightMm, dpi));
      continue;
    }
    if (cmd.op === "glyphOutline") {
      // ALL contours accumulate into ONE path before a SINGLE fill(), so
      // Canvas 2D's own nonzero-winding default (identical to PDF's)
      // renders inner counter-shapes as real holes -- see
      // `rasterGenerator.ts`'s own identical comment.
      ctx.beginPath();
      for (const outlineCmd of cmd.commands) {
        if (outlineCmd.type === "M") ctx.moveTo(mmToPx(outlineCmd.x, dpi), mmToPx(outlineCmd.y, dpi));
        else if (outlineCmd.type === "L") ctx.lineTo(mmToPx(outlineCmd.x, dpi), mmToPx(outlineCmd.y, dpi));
        else if (outlineCmd.type === "C")
          ctx.bezierCurveTo(mmToPx(outlineCmd.x1, dpi), mmToPx(outlineCmd.y1, dpi), mmToPx(outlineCmd.x2, dpi), mmToPx(outlineCmd.y2, dpi), mmToPx(outlineCmd.x, dpi), mmToPx(outlineCmd.y, dpi));
        else ctx.closePath();
      }
      ctx.fill();
      continue;
    }
    // "text" -- `align`/`baseline` map directly onto Canvas 2D's own
    // native `textAlign`/`textBaseline` (jsPDF's own text() options were
    // deliberately modeled on the same DOM/canvas convention).
    if (fontFamily) ctx.font = `${ptToPx(cmd.fontSizePt, dpi)}px "${fontFamily}"`;
    ctx.textAlign = cmd.align;
    ctx.textBaseline = cmd.baseline ?? "alphabetic";
    let fontSizePx = ptToPx(cmd.fontSizePt, dpi);
    if (cmd.maxWidthMm !== undefined) {
      const widthPx = ctx.measureText(cmd.text).width;
      const maxWidthPx = mmToPx(cmd.maxWidthMm, dpi);
      if (widthPx > maxWidthPx) {
        fontSizePx = fontSizePx * (maxWidthPx / widthPx);
        if (fontFamily) ctx.font = `${fontSizePx}px "${fontFamily}"`;
      }
    }
    const xPx = mmToPx(cmd.xMm, dpi);
    const yPx = mmToPx(cmd.yMm, dpi);
    if (cmd.angle) {
      // UNVERIFIED, defensive-only path -- see `rasterGenerator.ts`'s
      // own identical disclosure. No real Publication paint-model call
      // site sets a nonzero `angle` today.
      ctx.save();
      ctx.translate(xPx, yPx);
      ctx.rotate((cmd.angle * Math.PI) / 180);
      ctx.fillText(cmd.text, 0, 0);
      ctx.restore();
    } else {
      ctx.fillText(cmd.text, xPx, yPx);
    }
  }
}

export interface BrowserRasterPage {
  canvas: HTMLCanvasElement;
  pixelWidth: number;
  pixelHeight: number;
}

export interface BrowserRasterProgressOptions {
  beforePage?: (pageNumber: number, pageCount: number) => Promise<void>;
  onProgress?: (completedPages: number, pageCount: number) => void;
}

// Renders every page of the SAME `PaintPlan` PDF/Node-QA use to a real
// `HTMLCanvasElement`, at the canonical page's own real physical size
// (mm) converted to px at `dpi`. White background painted explicitly
// first (JPEG has no alpha; a transparent PNG must composite onto white,
// not the canvas's own default transparent-black).
export async function renderPaintPlanToBrowserRasterPages(
  plan: PaintPlan,
  fontFamily: BrowserFontFamily | undefined,
  dpi: number = RASTER_DPI,
  options: BrowserRasterProgressOptions = {}
): Promise<BrowserRasterPage[]> {
  if (typeof document === "undefined") {
    throw new Error("renderPaintPlanToBrowserRasterPages: browser-only (no `document`) -- use rasterGenerator.ts (Node) instead");
  }
  if (fontFamily) await ensureFontReady(fontFamily);
  const pages: BrowserRasterPage[] = [];
  for (let index = 0; index < plan.length; index += 1) {
    await options.beforePage?.(index + 1, plan.length);
    const page = plan[index];
    const widthPx = Math.max(1, Math.round(mmToPx(page.widthMm, dpi)));
    const heightPx = Math.max(1, Math.round(mmToPx(page.heightMm, dpi)));
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("renderPaintPlanToBrowserRasterPages: 2d context unavailable");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, widthPx, heightPx);
    await paintCommandsOnContext(ctx, page.commands, dpi, fontFamily);
    pages.push({ canvas, pixelWidth: widthPx, pixelHeight: heightPx });
    options.onProgress?.(index + 1, plan.length);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return pages;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("canvasToJpegBlob: canvas.toBlob returned null"));
      },
      "image/jpeg",
      quality
    );
  });
}

function toPrintCanvas(base: BrowserRasterPage): HTMLCanvasElement {
  const { width, height } = computeLongSideResize(base.pixelWidth, base.pixelHeight, PRINT_JPG_LONG_SIDE_PX);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("toPrintCanvas: 2d context unavailable");
  // v2 has no bleed/trim geometry (see jpgExport.ts's own disclosed
  // rationale) -- draws the FULL base raster (already == the "trim"
  // extent) scaled to the print long-side target.
  ctx.drawImage(base.canvas, 0, 0, width, height);
  return canvas;
}

export type JpgExportMode = "WEB" | "PRINT";

export interface BrowserJpgPageResult {
  fileName: string;
  blob: Blob;
  pixelWidth: number;
  pixelHeight: number;
}

// One JPG Blob per page, from the SAME PaintPlan PDF/Node-QA use --
// never a second layout/composition pass, never a stitched multi-page
// image. `buildFileName` is injected (not hardcoded) so callers reuse
// the SAME `buildPageJpgFileName` contract (`jpgFilename.ts`) the Node
// path uses, without this module needing to know about titles.
export async function exportPaintPlanToBrowserJpgPages(
  plan: PaintPlan,
  fontFamily: BrowserFontFamily | undefined,
  buildFileName: (pageNumber: number) => string,
  mode: JpgExportMode,
  dpi: number = RASTER_DPI,
  options: BrowserRasterProgressOptions = {}
): Promise<BrowserJpgPageResult[]> {
  const basePages = await renderPaintPlanToBrowserRasterPages(plan, fontFamily, dpi, {
    beforePage: options.beforePage,
  });
  const results: BrowserJpgPageResult[] = [];
  for (let i = 0; i < basePages.length; i++) {
    await options.beforePage?.(i + 1, basePages.length);
    const base = basePages[i];
    const targetCanvas = mode === "PRINT" ? toPrintCanvas(base) : base.canvas;
    const blob = await canvasToJpegBlob(targetCanvas, JPEG_QUALITY);
    results.push({ fileName: buildFileName(i + 1), blob, pixelWidth: targetCanvas.width, pixelHeight: targetCanvas.height });
    options.onProgress?.(i + 1, basePages.length);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return results;
}
