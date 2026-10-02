// TSP-PHASE13-001 item 1: a 「全面」 image must reach the 3 mm bleed in
// bleed/full PDF output and be clipped to the bleed box, while trim-mode
// PDF keeps painting the canonical trim-based box.
import { inflateSync } from "node:zlib";
import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { renderPaintPlanToPdf, resolveBleedCoverImageBoxMm, type PaintPlan } from "./pdfGenerator";
import { PDF_BLEED_MM, resolvePublicationPdfPageOutput, type PublicationPdfMode } from "./pdfOutputGeometry";

const PAGE = { widthMm: 148, heightMm: 210 };
const PT_PER_MM = 72 / 25.4;

function pngBytes(): Uint8Array {
  return encode({ width: 2, height: 2, data: new Uint8Array(2 * 2 * 3).fill(128), channels: 3 });
}

function planWith(image: { widthMm: number; heightMm: number }, fullPageCover: boolean): PaintPlan {
  return [{
    ...PAGE,
    commands: [{
      op: "image",
      xMm: (PAGE.widthMm - image.widthMm) / 2,
      yMm: (PAGE.heightMm - image.heightMm) / 2,
      widthMm: image.widthMm,
      heightMm: image.heightMm,
      bytes: pngBytes(),
      format: "PNG",
      ...(fullPageCover ? { fullPageCover: true as const } : {}),
    }],
  }];
}

/** Concatenated, inflated page content streams of a jsPDF output. */
function contentStreams(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const text = raw.toString("latin1");
  const out: string[] = [];
  const re = /\/FlateDecode[^>]*>>\s*stream\r?\n/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const start = match.index + match[0].length;
    const end = text.indexOf("endstream", start);
    try {
      out.push(inflateSync(raw.subarray(start, end)).toString("latin1"));
    } catch {
      // image XObject streams with predictors etc. are not page content
    }
  }
  return out.join("\n");
}

/** Image placement matrices (`w 0 0 h x y cm`) in pt. */
function imageMatrices(content: string): Array<{ w: number; h: number; x: number; y: number }> {
  return Array.from(content.matchAll(/([\d.]+) 0 0 ([\d.]+) ([\d.-]+) ([\d.-]+) cm\s*\/I\d+ Do/g)).map((m) => ({
    w: Number(m[1]), h: Number(m[2]), x: Number(m[3]), y: Number(m[4]),
  }));
}

describe("「全面」 image bleed coverage", () => {
  it("covers trim + 3 mm on every side, centred, for a page-aspect image", () => {
    const output = resolvePublicationPdfPageOutput(PAGE.widthMm, PAGE.heightMm, "bleed");
    const box = resolveBleedCoverImageBoxMm(PAGE, PAGE, output);
    expect(box.xMm).toBeLessThanOrEqual(output.bleedBox.xMm + 1e-9);
    expect(box.yMm).toBeLessThanOrEqual(output.bleedBox.yMm + 1e-9);
    expect(box.xMm + box.widthMm).toBeGreaterThanOrEqual(output.bleedBox.xMm + output.bleedBox.widthMm - 1e-9);
    expect(box.yMm + box.heightMm).toBeGreaterThanOrEqual(output.bleedBox.yMm + output.bleedBox.heightMm - 1e-9);
    // centred on the trim page
    expect(box.xMm + box.widthMm / 2).toBeCloseTo(output.trimBox.xMm + PAGE.widthMm / 2, 9);
    expect(box.yMm + box.heightMm / 2).toBeCloseTo(output.trimBox.yMm + PAGE.heightMm / 2, 9);
  });

  it("keeps the image aspect ratio when it differs from the page", () => {
    const output = resolvePublicationPdfPageOutput(PAGE.widthMm, PAGE.heightMm, "full");
    const wide = { widthMm: 300, heightMm: 210 };
    const box = resolveBleedCoverImageBoxMm(wide, PAGE, output);
    expect(box.widthMm / box.heightMm).toBeCloseTo(300 / 210, 9);
    expect(box.heightMm).toBeCloseTo(PAGE.heightMm + PDF_BLEED_MM * 2, 9);
  });

  for (const mode of ["bleed", "full"] as const satisfies readonly PublicationPdfMode[]) {
    it(`${mode}: paints the bleed-covering box inside a bleed-box clip`, () => {
      const output = resolvePublicationPdfPageOutput(PAGE.widthMm, PAGE.heightMm, mode);
      const { bytes } = renderPaintPlanToPdf(planWith(PAGE, true), undefined, { mode });
      const content = contentStreams(bytes);
      const [matrix] = imageMatrices(content);
      expect(matrix).toBeDefined();
      expect(matrix.w / PT_PER_MM).toBeCloseTo(PAGE.widthMm + PDF_BLEED_MM * 2, 2);
      // cover keeps the page aspect, so the height overshoots the bleed and is clipped
      expect(matrix.h / PT_PER_MM).toBeCloseTo(PAGE.heightMm * (PAGE.widthMm + PDF_BLEED_MM * 2) / PAGE.widthMm, 2);
      expect(matrix.h / PT_PER_MM).toBeGreaterThanOrEqual(PAGE.heightMm + PDF_BLEED_MM * 2);
      expect(matrix.x / PT_PER_MM).toBeCloseTo(output.bleedBox.xMm, 2);
      // clip path: `re W n` before the image, wrapped in q/Q
      expect(content).toMatch(/q\s+[\d.\s-]+re\s+W\s+n[\s\S]*\/I\d+ Do[\s\S]*Q/);
    });
  }

  it("trim mode keeps the canonical trim-based box (no clip, no enlargement)", () => {
    const { bytes } = renderPaintPlanToPdf(planWith(PAGE, true), undefined, { mode: "trim" });
    const content = contentStreams(bytes);
    const [matrix] = imageMatrices(content);
    expect(matrix.w / PT_PER_MM).toBeCloseTo(PAGE.widthMm, 2);
    expect(matrix.h / PT_PER_MM).toBeCloseTo(PAGE.heightMm, 2);
    expect(content).not.toMatch(/re\s+W\s+n/);
  });

  it("non-全面 images are untouched in bleed mode", () => {
    const small = { widthMm: 60, heightMm: 40 };
    const output = resolvePublicationPdfPageOutput(PAGE.widthMm, PAGE.heightMm, "bleed");
    const { bytes } = renderPaintPlanToPdf(planWith(small, false), undefined, { mode: "bleed" });
    const [matrix] = imageMatrices(contentStreams(bytes));
    expect(matrix.w / PT_PER_MM).toBeCloseTo(60, 2);
    expect(matrix.x / PT_PER_MM).toBeCloseTo(output.trimBox.xMm + (PAGE.widthMm - 60) / 2, 2);
  });
});
