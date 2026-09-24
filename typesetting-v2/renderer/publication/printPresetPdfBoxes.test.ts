import { describe, expect, it } from "vitest";
import { PAPER_SIZE_TEMPLATES } from "../../../src/constants/paperSizes";
import { renderPaintPlanToPdf, type PaintPlan } from "./pdfGenerator";
import {
  PDF_BLEED_MM,
  PDF_CROP_MARK_MARGIN_MM,
  resolvePublicationPdfPageOutput,
  type PublicationPdfMode,
} from "./pdfOutputGeometry";

const PT_PER_MM = 72 / 25.4;
const PRINT_PRESETS = ["A5", "B5", "B6", "新書", "A6", "文庫"] as const;
const MODES = ["trim", "bleed", "full"] as const satisfies readonly PublicationPdfMode[];

type PdfBox = { x1Mm: number; y1Mm: number; x2Mm: number; y2Mm: number };

function serializedBoxesMm(
  bytes: Uint8Array,
  name: "MediaBox" | "CropBox" | "BleedBox" | "TrimBox",
): PdfBox[] {
  const raw = Buffer.from(bytes).toString("latin1");
  const re = new RegExp(
    `/${name}\\s*\\[\\s*([\\d.-]+)\\s+([\\d.-]+)\\s+([\\d.-]+)\\s+([\\d.-]+)\\s*\\]`,
    "g",
  );
  return Array.from(raw.matchAll(re)).map((match) => ({
    x1Mm: Number(match[1]) / PT_PER_MM,
    y1Mm: Number(match[2]) / PT_PER_MM,
    x2Mm: Number(match[3]) / PT_PER_MM,
    y2Mm: Number(match[4]) / PT_PER_MM,
  }));
}

function expectBox(actual: PdfBox, expected: PdfBox): void {
  expect(actual.x1Mm).toBeCloseTo(expected.x1Mm, 3);
  expect(actual.y1Mm).toBeCloseTo(expected.y1Mm, 3);
  expect(actual.x2Mm).toBeCloseTo(expected.x2Mm, 3);
  expect(actual.y2Mm).toBeCloseTo(expected.y2Mm, 3);
}

describe("V2 print PDF boxes — all six product paper presets", () => {
  for (const presetName of PRINT_PRESETS) {
    const preset = PAPER_SIZE_TEMPLATES[presetName];
    for (const mode of MODES) {
      it(`${presetName} ${preset.width}x${preset.height}mm / ${mode}`, () => {
        const output = resolvePublicationPdfPageOutput(preset.width, preset.height, mode);
        const plan: PaintPlan = [{ widthMm: preset.width, heightMm: preset.height, commands: [] }];
        const { bytes, pageCount } = renderPaintPlanToPdf(plan, undefined, { mode });
        expect(pageCount).toBe(1);

        const media = serializedBoxesMm(bytes, "MediaBox");
        const crop = serializedBoxesMm(bytes, "CropBox");
        const bleed = serializedBoxesMm(bytes, "BleedBox");
        const trim = serializedBoxesMm(bytes, "TrimBox");
        expect(media).toHaveLength(1);
        expect(crop).toHaveLength(1);
        expect(bleed).toHaveLength(1);
        expect(trim).toHaveLength(1);

        const mediaExpected: PdfBox = {
          x1Mm: 0,
          y1Mm: 0,
          x2Mm: output.widthMm,
          y2Mm: output.heightMm,
        };
        expectBox(media[0], mediaExpected);
        expectBox(crop[0], mediaExpected);

        const trimInset = mode === "trim"
          ? 0
          : mode === "bleed"
            ? PDF_BLEED_MM
            : PDF_CROP_MARK_MARGIN_MM + PDF_BLEED_MM;
        expectBox(trim[0], {
          x1Mm: trimInset,
          y1Mm: trimInset,
          x2Mm: trimInset + preset.width,
          y2Mm: trimInset + preset.height,
        });

        const bleedInset = mode === "full" ? PDF_CROP_MARK_MARGIN_MM : 0;
        expectBox(bleed[0], mode === "trim"
          ? mediaExpected
          : {
              x1Mm: bleedInset,
              y1Mm: bleedInset,
              x2Mm: bleedInset + preset.width + PDF_BLEED_MM * 2,
              y2Mm: bleedInset + preset.height + PDF_BLEED_MM * 2,
            });

        expect(output.cropMarks).toHaveLength(mode === "full" ? 16 : 0);
      });
    }
  }
});
