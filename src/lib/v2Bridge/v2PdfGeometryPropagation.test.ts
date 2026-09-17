import { describe, expect, it } from "vitest";
import type { PaintPlan, PublicationFontResource } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import type { PublicationPdfMode } from "../../../typesetting-v2/renderer/publication/pdfOutputGeometry";
import {
  createV2PdfWorkerStartMessage,
  publicationPdfRenderOptionsFromMessage,
} from "../v2PdfWorkerContract";

const plan: PaintPlan = [{ widthMm: 148, heightMm: 210, commands: [] }];
const font: PublicationFontResource = {
  fileName: "fixture.ttf",
  fontName: "Fixture",
  base64: "AA==",
};

describe("V2 PDF mode worker propagation", () => {
  it.each(["trim", "bleed", "full"] satisfies PublicationPdfMode[])(
    "carries %s from browser start message into generator options",
    (mode) => {
      const message = createV2PdfWorkerStartMessage(plan, font, mode);
      expect(message).toEqual({ type: "start", plan, font, mode });
      expect(publicationPdfRenderOptionsFromMessage(message)).toEqual({ mode });
    },
  );
});
