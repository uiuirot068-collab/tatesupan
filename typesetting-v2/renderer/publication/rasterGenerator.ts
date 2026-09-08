// P3-O08 -- Final-page completion, JPG Export (Human Visual QA HOLD
// round 31 onward). Consumes the EXACT SAME `PaintPlan`/`PaintCommand`
// stream `pdfGenerator.ts`'s `renderPaintPlanToPdf` already produces and
// executes -- never a second layout/composition engine (per this
// round's own frozen architecture rule and
// `docs/architecture/PUBLICATION_OUTPUT_RESEARCH.md` section 5: "Both
// PDF and JPG could share one source of truth"). This module is the
// raster-executor SIBLING to `renderPaintPlanToPdf`, not a replacement
// for or a fork of it -- it makes no typography/composition decisions
// of its own, it only paints the already-decided command stream onto a
// `@napi-rs/canvas` Canvas instead of a jsPDF document.
//
// DEPENDENCY GATE: `@napi-rs/canvas` approved by Human product decision
// (JPG Export scope audit) specifically so JPG generation can run
// server-side (Node/Vitest) with the same byte-level, low-Human-QA-burden
// testing rigor already established for PDF/image-embedding this
// project cycle -- a Node-side QA REFERENCE implementation, not the
// production path (round 32: production uses `rasterGeneratorBrowser.ts`,
// native Canvas 2D -- see that module's own doc for why). `devDependency`
// only; never imported by any browser-facing module.
import { createCanvas, GlobalFonts, loadImage, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { PaintCommand, PaintPlan, PublicationFontResource } from "./pdfGenerator";
import { RASTER_DPI, mmToPx, ptToPx } from "./rasterShared";

export { RASTER_DPI, PRINT_JPG_LONG_SIDE_PX, JPEG_QUALITY } from "./rasterShared";

// One process-lifetime registration per font name -- `GlobalFonts` is a
// real global registry (mirrors jsPDF's own per-document
// `addFileToVFS`/`addFont`, but napi-rs/canvas's registry is process-wide,
// not per-Canvas), so re-registering the identical bytes under the same
// name on every call would be wasted work, not a correctness problem
// (napi-rs/canvas's own `register` is safe to call more than once).
const registeredFontNames = new Set<string>();

function ensureFontRegistered(fontResource: PublicationFontResource): void {
  if (registeredFontNames.has(fontResource.fontName)) return;
  const buffer = Buffer.from(fontResource.base64, "base64");
  GlobalFonts.register(buffer, fontResource.fontName);
  registeredFontNames.add(fontResource.fontName);
}

// Real image bytes decode to a napi-rs/canvas `Image` once per distinct
// byte array reference within a single render call -- avoids redundant
// decode work when the SAME image (by refId) appears on multiple pages
// of one export batch, without persisting any manuscript image data
// beyond the lifetime of this function call (INV/privacy: no ambient
// caching across unrelated calls).
async function paintCommandsOnContext(ctx: SKRSContext2D, commands: PaintCommand[], dpi: number, fontResource: PublicationFontResource | undefined): Promise<void> {
  ctx.strokeStyle = "black";
  ctx.fillStyle = "black";
  ctx.lineWidth = mmToPx(0.05, dpi); // matches pdfGenerator.ts's `pdf.setLineWidth(0.05)`
  const imageCache = new Map<string, Awaited<ReturnType<typeof loadImage>>>();

  for (const cmd of commands) {
    if (cmd.op === "rect") {
      // jsPDF's `pdf.rect(x, y, w, h)` (no style argument) strokes only
      // (jsPDF's own default style is 'S') -- never fills. Canvas
      // equivalent: strokeRect, not fillRect.
      ctx.strokeRect(mmToPx(cmd.xMm, dpi), mmToPx(cmd.yMm, dpi), mmToPx(cmd.widthMm, dpi), mmToPx(cmd.heightMm, dpi));
      continue;
    }
    if (cmd.op === "image") {
      const cacheKey = `${cmd.bytes.byteLength}:${cmd.format}:${cmd.xMm}:${cmd.yMm}`;
      let image = imageCache.get(cacheKey);
      if (!image) {
        image = await loadImage(Buffer.from(cmd.bytes));
        imageCache.set(cacheKey, image);
      }
      // Real JPEG and PNG (incl. real alpha, composited by Skia's own
      // decoder) both draw via the identical `drawImage` call -- no
      // format-specific branch, mirroring jsPDF's own single `addImage`
      // call site in `renderPaintPlanToPdf`.
      ctx.drawImage(image, mmToPx(cmd.xMm, dpi), mmToPx(cmd.yMm, dpi), mmToPx(cmd.widthMm, dpi), mmToPx(cmd.heightMm, dpi));
      continue;
    }
    if (cmd.op === "glyphOutline") {
      // Mirrors `renderPaintPlanToPdf`'s own glyphOutline executor
      // exactly: ALL contours accumulate into ONE path before a SINGLE
      // fill(), so Canvas 2D's own nonzero-winding default (identical
      // to PDF's) renders inner counter-shapes as real holes.
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
    // deliberately modeled on the same DOM/canvas convention, so no
    // translation table is needed for either value space).
    if (fontResource) ctx.font = `${ptToPx(cmd.fontSizePt, dpi)}px "${fontResource.fontName}"`;
    ctx.textAlign = cmd.align;
    ctx.textBaseline = cmd.baseline ?? "alphabetic";
    let fontSizePx = ptToPx(cmd.fontSizePt, dpi);
    // Same TCY measure-then-scale-down fit pass as `renderPaintPlanToPdf`
    // (`pdf.getTextWidth`), using Canvas's own real registered-font
    // metrics (`measureText`) instead of jsPDF's -- the two font-shaping
    // engines are not guaranteed byte-identical, an accepted "pixel-level
    // rendering nuance" difference per the frozen Logical Layout
    // Consistency Contract (canonical layout itself is untouched; this
    // is a paint-time-only visual fit, same as PDF's own).
    if (cmd.maxWidthMm !== undefined) {
      const widthPx = ctx.measureText(cmd.text).width;
      const maxWidthPx = mmToPx(cmd.maxWidthMm, dpi);
      if (widthPx > maxWidthPx) {
        fontSizePx = fontSizePx * (maxWidthPx / widthPx);
        if (fontResource) ctx.font = `${fontSizePx}px "${fontResource.fontName}"`;
      }
    }
    const xPx = mmToPx(cmd.xMm, dpi);
    const yPx = mmToPx(cmd.yMm, dpi);
    if (cmd.angle) {
      // UNVERIFIED, defensive-only path: no real Publication paint-model
      // call site sets a nonzero `angle` today (confirmed by direct
      // search -- every "text" command in `pdfGenerator.ts` sets
      // `angle: 0` or omits it entirely). Included for API completeness
      // only; if a future round introduces real rotated text, this
      // rotation direction must be empirically verified against jsPDF's
      // own output before being trusted.
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

export interface RasterPage {
  canvas: Canvas;
  pixelWidth: number;
  pixelHeight: number;
}

// Renders every page of the SAME `PaintPlan` PDF uses to a real raster
// Canvas, at the canonical page's own real physical size (mm) converted
// to px at `dpi` -- the base render is geometry-neutral (no print/web
// crop or resize decision is made here; see `jpgExport.ts` for that
// separation, mirroring legacy's own `capturePageToCanvas` /
// `applyPrintJpgGeometry` separation). White background is painted
// explicitly first (round 31: JPEG has no alpha channel; a real
// transparent PNG image painted onto an unpainted/black canvas would
// composite onto black, not the intended white page).
export async function renderPaintPlanToRasterPages(plan: PaintPlan, fontResource: PublicationFontResource | undefined, dpi: number = RASTER_DPI): Promise<RasterPage[]> {
  if (fontResource) ensureFontRegistered(fontResource);
  const pages: RasterPage[] = [];
  for (const page of plan) {
    const widthPx = Math.max(1, Math.round(mmToPx(page.widthMm, dpi)));
    const heightPx = Math.max(1, Math.round(mmToPx(page.heightMm, dpi)));
    const canvas = createCanvas(widthPx, heightPx);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, widthPx, heightPx);
    await paintCommandsOnContext(ctx, page.commands, dpi, fontResource);
    pages.push({ canvas, pixelWidth: widthPx, pixelHeight: heightPx });
  }
  return pages;
}
