import { describe, expect, it } from "vitest";
import { renderPaintPlanToPdf, renderPaintPlanToPdfAsync, type PaintPlan } from "./pdfGenerator";
import {
  PDF_BLEED_MM,
  PDF_CROP_MARK_MARGIN_MM,
  resolvePublicationPdfPageOutput,
  type PublicationPdfMode,
} from "./pdfOutputGeometry";

const PT_PER_MM = 72 / 25.4;

function mediaBoxesMm(bytes: Uint8Array): Array<{ widthMm: number; heightMm: number }> {
  const raw = Buffer.from(bytes).toString("latin1");
  return Array.from(raw.matchAll(/\/MediaBox\s*\[\s*0(?:\.0)?\s+0(?:\.0)?\s+([\d.]+)\s+([\d.]+)\s*\]/g)).map((match) => ({
    widthMm: Number(match[1]) / PT_PER_MM,
    heightMm: Number(match[2]) / PT_PER_MM,
  }));
}

function firstRectangleOperands(bytes: Uint8Array): number[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const match = raw.match(/([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+re/);
  if (!match) throw new Error("Expected a rectangle operator in generated PDF.");
  return match.slice(1).map(Number);
}

function strokedLineCount(bytes: Uint8Array): number {
  const raw = Buffer.from(bytes).toString("latin1");
  return Array.from(raw.matchAll(/[\d.-]+\s+[\d.-]+\s+m\s+[\d.-]+\s+[\d.-]+\s+l\s+S/g)).length;
}

function normalizedPdf(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("latin1")
    .replace(/\/ID\s*\[\s*<[^>]+>\s*<[^>]+>\s*\]/g, "/ID [<normalized> <normalized>]");
}

const SIMPLE_PLAN: PaintPlan = [{
  widthMm: 148,
  heightMm: 210,
  commands: [{ op: "rect", xMm: 10, yMm: 20, widthMm: 5, heightMm: 7 }],
}];

describe("V2 publication PDF output geometry", () => {
  it.each([
    ["trim", 148, 210, 0, 0],
    ["bleed", 154, 216, 3, 0],
    ["full", 184, 246, 18, 16],
  ] satisfies Array<[PublicationPdfMode, number, number, number, number]>) (
    "resolves A5 %s with Legacy-parity dimensions, offset, and marks",
    (mode, widthMm, heightMm, offsetMm, markCount) => {
      const output = resolvePublicationPdfPageOutput(148, 210, mode);
      expect(output.widthMm).toBe(widthMm);
      expect(output.heightMm).toBe(heightMm);
      expect(output.contentOffsetXMm).toBe(offsetMm);
      expect(output.contentOffsetYMm).toBe(offsetMm);
      expect(output.trimBox).toEqual({ xMm: offsetMm, yMm: offsetMm, widthMm: 148, heightMm: 210 });
      expect(output.cropMarks).toHaveLength(markCount);
    },
  );

  it.each([
    ["B5", 182, 257],
    ["B6", 128, 182],
    ["文庫", 105, 148],
  ])("uses the generic formula for %s", (_name, trimWidthMm, trimHeightMm) => {
    const bleed = resolvePublicationPdfPageOutput(trimWidthMm, trimHeightMm, "bleed");
    const full = resolvePublicationPdfPageOutput(trimWidthMm, trimHeightMm, "full");
    expect(bleed.widthMm).toBe(trimWidthMm + PDF_BLEED_MM * 2);
    expect(bleed.heightMm).toBe(trimHeightMm + PDF_BLEED_MM * 2);
    expect(full.widthMm).toBe(trimWidthMm + PDF_BLEED_MM * 2 + PDF_CROP_MARK_MARGIN_MM * 2);
    expect(full.heightMm).toBe(trimHeightMm + PDF_BLEED_MM * 2 + PDF_CROP_MARK_MARGIN_MM * 2);
  });

  it("matches the established Legacy full-mode crop-mark coordinates", () => {
    const output = resolvePublicationPdfPageOutput(148, 210, "full");
    expect(output.cropMarks).toEqual([
      { x1Mm: 15, y1Mm: 18, x2Mm: 5, y2Mm: 18 },
      { x1Mm: 15, y1Mm: 15, x2Mm: 5, y2Mm: 15 },
      { x1Mm: 18, y1Mm: 15, x2Mm: 18, y2Mm: 5 },
      { x1Mm: 15, y1Mm: 15, x2Mm: 15, y2Mm: 5 },
      { x1Mm: 169, y1Mm: 18, x2Mm: 179, y2Mm: 18 },
      { x1Mm: 169, y1Mm: 15, x2Mm: 179, y2Mm: 15 },
      { x1Mm: 166, y1Mm: 15, x2Mm: 166, y2Mm: 5 },
      { x1Mm: 169, y1Mm: 15, x2Mm: 169, y2Mm: 5 },
      { x1Mm: 15, y1Mm: 228, x2Mm: 5, y2Mm: 228 },
      { x1Mm: 15, y1Mm: 231, x2Mm: 5, y2Mm: 231 },
      { x1Mm: 18, y1Mm: 231, x2Mm: 18, y2Mm: 241 },
      { x1Mm: 15, y1Mm: 231, x2Mm: 15, y2Mm: 241 },
      { x1Mm: 169, y1Mm: 228, x2Mm: 179, y2Mm: 228 },
      { x1Mm: 169, y1Mm: 231, x2Mm: 179, y2Mm: 231 },
      { x1Mm: 166, y1Mm: 231, x2Mm: 166, y2Mm: 241 },
      { x1Mm: 169, y1Mm: 231, x2Mm: 169, y2Mm: 241 },
    ]);
  });

  it.each([
    ["trim", 148, 210, 0, 0],
    ["bleed", 154, 216, 3, 0],
    ["full", 184, 246, 18, 16],
  ] satisfies Array<[PublicationPdfMode, number, number, number, number]>) (
    "serializes %s MediaBox, unchanged command size, correct origin, and expected marks",
    (mode, expectedWidthMm, expectedHeightMm, offsetMm, markCount) => {
      const { bytes } = renderPaintPlanToPdf(SIMPLE_PLAN, undefined, { mode });
      const boxes = mediaBoxesMm(bytes);
      expect(boxes).toHaveLength(1);
      expect(boxes[0].widthMm).toBeCloseTo(expectedWidthMm, 3);
      expect(boxes[0].heightMm).toBeCloseTo(expectedHeightMm, 3);

      const [xPt, , widthPt, heightPt] = firstRectangleOperands(bytes);
      expect(xPt / PT_PER_MM).toBeCloseTo(10 + offsetMm, 3);
      expect(widthPt / PT_PER_MM).toBeCloseTo(5, 3);
      expect(Math.abs(heightPt) / PT_PER_MM).toBeCloseTo(7, 3);
      expect(strokedLineCount(bytes)).toBe(markCount);
    },
  );

  it("keeps historical no-options output identical to explicit trim apart from jsPDF's random document ID", () => {
    expect(normalizedPdf(renderPaintPlanToPdf(SIMPLE_PLAN).bytes)).toBe(
      normalizedPdf(renderPaintPlanToPdf(SIMPLE_PLAN, undefined, { mode: "trim" }).bytes),
    );
  });

  it.each([
    ["trim", 148, 210],
    ["bleed", 154, 216],
    ["full", 184, 246],
  ] satisfies Array<[PublicationPdfMode, number, number]>)(
    "applies %s in the async worker renderer without mutating the canonical plan",
    async (mode, expectedWidthMm, expectedHeightMm) => {
      const before = JSON.stringify(SIMPLE_PLAN);
      const { bytes } = await renderPaintPlanToPdfAsync(SIMPLE_PLAN, undefined, { mode });
      const [box] = mediaBoxesMm(bytes);
      expect(box.widthMm).toBeCloseTo(expectedWidthMm, 3);
      expect(box.heightMm).toBeCloseTo(expectedHeightMm, 3);
      expect(JSON.stringify(SIMPLE_PLAN)).toBe(before);
    },
  );

  it("fails closed for an invalid runtime mode", () => {
    expect(() => resolvePublicationPdfPageOutput(148, 210, "printer" as PublicationPdfMode)).toThrow(
      "Unsupported publication PDF mode: printer",
    );
  });
});
