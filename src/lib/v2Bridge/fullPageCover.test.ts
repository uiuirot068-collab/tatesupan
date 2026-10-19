import { describe, expect, it } from "vitest";
import { fullPageCoverRect } from "../imageGeometry";
import { resolveBleedCoverImageBoxMm } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { resolvePublicationPdfPageOutput } from "../../../typesetting-v2/renderer/publication/pdfOutputGeometry";

// TSP-PRINT-004 (P4-8): one 「全面」 rule for the Preview, the trim PDF / JPG
// and the bleed PDF.
describe("fullPageCoverRect", () => {
  const page = { widthMm: 105, heightMm: 148 };

  it("covers the page plus the bleed with the marker's aspect ratio, centred", () => {
    const rect = fullPageCoverRect({ widthMm: 80, heightMm: 40 }, page, 3);
    expect(rect.heightMm).toBeCloseTo(154);
    expect(rect.widthMm).toBeCloseTo(308);
    expect(rect.xMm + rect.widthMm / 2).toBeCloseTo(page.widthMm / 2);
    expect(rect.yMm).toBeCloseTo(-3);
  });

  it("is the bleed PDF's box (so a trim PDF crops what the bleed PDF prints inside the trim)", () => {
    const size = { widthMm: 40, heightMm: 60 };
    const output = resolvePublicationPdfPageOutput(page.widthMm, page.heightMm, "bleed");
    const trimCover = fullPageCoverRect(size, page, 0);
    // The bleed executor re-covers from the command's own box (its aspect ratio).
    const bleedBox = resolveBleedCoverImageBoxMm(trimCover, page, output);
    const rect = fullPageCoverRect(size, page, 3);
    expect(bleedBox.xMm - output.contentOffsetXMm).toBeCloseTo(rect.xMm);
    expect(bleedBox.yMm - output.contentOffsetYMm).toBeCloseTo(rect.yMm);
    expect(bleedBox.widthMm).toBeCloseTo(rect.widthMm);
    expect(bleedBox.heightMm).toBeCloseTo(rect.heightMm);
  });

  it("without bleed covers the page exactly (px papers)", () => {
    const rect = fullPageCoverRect({ widthMm: 100, heightMm: 100 }, page, 0);
    expect(rect).toEqual({ xMm: (105 - 148) / 2, yMm: 0, widthMm: 148, heightMm: 148 });
  });
});
