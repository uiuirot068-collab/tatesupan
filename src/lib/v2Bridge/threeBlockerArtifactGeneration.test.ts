import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ReactDOMServer from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createShipporiMinchoMeasurementProvider } from "../../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import {
  PREVIEW_RENDERER_DOCUMENT_STYLES,
  PREVIEW_RENDERER_STYLES,
  PreviewDocumentView,
} from "../../../typesetting-v2/renderer/preview/PreviewRenderer";
import { generatePublicationJpgPages } from "../../../typesetting-v2/renderer/publication/jpgExport";
import {
  generatePublicationPdf,
  type PublicationFontResource,
} from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { composeV2Document } from "./composeV2Document";
import { buildV2PreviewDocument } from "./useV2PreviewAdapter";

const FONT_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "typesetting-v2",
  "qa",
  "publication",
  "p3-o08",
  "font-poc",
  "fonts",
  "ShipporiMincho-Regular.ttf",
);
const FIXTURE = [
  "「モオル——Mole……」",
  "モオルは｜髑髏《もぐらもち》と云ふ英語だった。",
  "この｜聯想《れんそう》も僕には愉快ではなかった。",
  "が、僕は三三秒の後、[tate]Mole[/tate]を la mort に綴り直した。",
].join("\n");

describe("three-blocker Human QA artifact generation", () => {
  const artifactDirectory = process.env.TATESPUN_THREE_BLOCKER_ARTIFACT_DIR;
  const generate = artifactDirectory ? it : it.skip;

  generate("writes PDF and JPG from the same real-font Publication model", async () => {
    const font: PublicationFontResource = {
      fileName: "ShipporiMincho-Regular.ttf",
      fontName: "Shippori Mincho",
      base64: readFileSync(FONT_PATH).toString("base64"),
    };
    const bridge = composeV2Document({
      title: "TateSpun Three Blocker QA",
      content: FIXTURE,
      settings: DEFAULT_PAGE_SETTINGS,
      measurement: createShipporiMinchoMeasurementProvider(FONT_PATH),
    });
    const pdf = generatePublicationPdf(bridge.model, font, bridge.pageGeometry);
    const jpg = await generatePublicationJpgPages(
      bridge.model,
      font,
      bridge.pageGeometry,
      "TateSpun Three Blocker QA",
      "PRINT",
    );

    const preview = buildV2PreviewDocument(bridge, {});
    const previewMarkup = ReactDOMServer.renderToStaticMarkup(
      PreviewDocumentView({ model: preview, mode: "normal" }),
    );
    const previewHtml = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${PREVIEW_RENDERER_DOCUMENT_STYLES}${PREVIEW_RENDERER_STYLES}</style></head><body><main style="text-orientation:upright;-webkit-text-orientation:upright">${previewMarkup}</main></body></html>`;

    mkdirSync(artifactDirectory!, { recursive: true });
    writeFileSync(join(artifactDirectory!, "tatespun-three-blocker.pdf"), pdf.bytes);
    writeFileSync(join(artifactDirectory!, "tatespun-three-blocker-preview.html"), previewHtml, "utf8");
    for (const page of jpg) {
      writeFileSync(join(artifactDirectory!, page.fileName), page.bytes);
    }
    expect(pdf.pageCount).toBe(jpg.length);
    expect(jpg.length).toBeGreaterThan(0);
    expect(jpg.every((page) => page.bytes[0] === 0xff && page.bytes[1] === 0xd8)).toBe(true);
  }, 30_000);
});
