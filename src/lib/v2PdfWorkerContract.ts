import type {
  PaintPlan,
  PublicationFontResource,
  PublicationPdfRenderOptions,
} from "../../typesetting-v2/renderer/publication/pdfGenerator";
import type { PublicationPdfMode } from "../../typesetting-v2/renderer/publication/pdfOutputGeometry";

export interface V2PdfWorkerStartMessage {
  type: "start";
  plan: PaintPlan;
  font: PublicationFontResource;
  mode: PublicationPdfMode;
}

export type V2PdfWorkerControlMessage =
  | { type: "pause" }
  | { type: "resume" }
  | { type: "cancel" };

export function createV2PdfWorkerStartMessage(
  plan: PaintPlan,
  font: PublicationFontResource,
  mode: PublicationPdfMode,
): V2PdfWorkerStartMessage {
  return { type: "start", plan, font, mode };
}

export function publicationPdfRenderOptionsFromMessage(
  message: V2PdfWorkerStartMessage,
): PublicationPdfRenderOptions {
  return { mode: message.mode };
}
