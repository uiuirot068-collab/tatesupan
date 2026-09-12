import ReactDOMServer from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createShipporiMinchoMeasurementProvider } from "../../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { DEFAULT_RUBY_SCALE } from "../../../typesetting-v2/core";
import { PreviewDocumentView } from "../../../typesetting-v2/renderer/preview/PreviewRenderer";
import {
  buildPublicationPaintPlan,
  generatePublicationPdf,
  type PaintCommand,
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

function fontResource(): PublicationFontResource {
  return {
    fileName: "ShipporiMincho-Regular.ttf",
    fontName: "Shippori Mincho",
    base64: readFileSync(FONT_PATH).toString("base64"),
  };
}

function fixtureModels() {
  const bridge = composeV2Document({
    title: "Three blocker fixture",
    content: FIXTURE,
    settings: DEFAULT_PAGE_SETTINGS,
    measurement: createShipporiMinchoMeasurementProvider(FONT_PATH),
  });
  const preview = buildV2PreviewDocument(bridge, {});
  return { bridge, preview };
}

function textCommands(commands: PaintCommand[]) {
  return commands.filter(
    (command): command is Extract<PaintCommand, { op: "text" }> => command.op === "text",
  );
}

describe("three-blocker ruby geometry parity", () => {
  it("keeps 髑髏 and 聯想 canonical placement unchanged and projects their vertical geometry identically", () => {
    const { bridge, preview } = fixtureModels();
    const canonicalBefore = structuredClone(bridge.document);
    const publicationBefore = structuredClone(bridge.model);
    const ruby = bridge.model.pages.flatMap((page) =>
      page.columns.flatMap((column) =>
        column.lines.flatMap((line) => line.units.filter((unit) => unit.kind === "RUBY")),
      ),
    );
    const previewRuby = preview.pages.flatMap((page) =>
      page.columns.flatMap((column) =>
        column.lines.flatMap((line) => line.units.filter((unit) => unit.kind === "RUBY")),
      ),
    );

    expect(ruby.map((unit) => unit.text)).toEqual(["髑髏", "聯想"]);
    expect(previewRuby.map((unit) => unit.text)).toEqual(["髑髏", "聯想"]);
    for (let index = 0; index < ruby.length; index += 1) {
      const publicationAnnotation = ruby[index].rubyAnnotation;
      const previewAnnotation = previewRuby[index].rubyAnnotation;
      expect(publicationAnnotation?.status).toBe("PLACED");
      expect(previewAnnotation?.status).toBe("PLACED");
      if (publicationAnnotation?.status !== "PLACED" || previewAnnotation?.status !== "PLACED") continue;
      const pxPerMm = preview.fontSizePx / bridge.model.bodyEmMm;
      expect(previewRuby[index].topPx).toBeCloseTo(ruby[index].topMm * pxPerMm, 6);
      expect(previewRuby[index].heightPx).toBeCloseTo(ruby[index].heightMm * pxPerMm, 6);
      expect(previewAnnotation.offsetPx).toBeCloseTo(publicationAnnotation.offsetMm * pxPerMm, 6);
      expect(previewAnnotation.extentPx).toBeCloseTo(publicationAnnotation.extentMm * pxPerMm, 6);
      expect(previewAnnotation.policy).toBe(publicationAnnotation.policy);
    }

    buildPublicationPaintPlan(bridge.model, fontResource(), bridge.pageGeometry, "fixture");
    expect(bridge.document).toEqual(canonicalBefore);
    expect(bridge.model).toEqual(publicationBefore);
  });

  it("anchors Preview and Publication ruby immediately after the fixed body em, independent of line pitch", () => {
    const { bridge, preview } = fixtureModels();
    const previewLine = preview.pages.flatMap((page) => page.columns.flatMap((column) => column.lines))
      .find((line) => line.units.some((unit) => unit.text === "髑髏"))!;
    const publicationLine = bridge.model.pages.flatMap((page) => page.columns.flatMap((column) => column.lines))
      .find((line) => line.units.some((unit) => unit.text === "髑髏"))!;
    const ruby = publicationLine.units.find((unit) => unit.text === "髑髏")!;
    const commands = textCommands(bridge.plan.flatMap((page) => page.commands));
    const body = commands.find((command) => command.text === "髑")!;
    const annotation = commands.find((command) => command.text === "も" && command.xMm !== body.xMm)!;
    const annotationEmMm = bridge.model.bodyEmMm * DEFAULT_RUBY_SCALE;

    expect(annotation.xMm - annotationEmMm / 2).toBeCloseTo(
      body.xMm + bridge.model.bodyEmMm / 2,
      6,
    );
    expect(publicationLine.widthMm).toBeGreaterThan(bridge.model.bodyEmMm);
    expect(ruby.rubyAnnotation?.status).toBe("PLACED");

    const html = ReactDOMServer.renderToStaticMarkup(
      PreviewDocumentView({ model: preview, mode: "normal" }),
    );
    expect(html).toContain(`left:calc(50% + ${preview.fontSizePx / 2}px)`);
    expect(html).toContain(`width:${preview.fontSizePx * DEFAULT_RUBY_SCALE}px`);
    expect(previewLine.widthPx).toBeGreaterThan(preview.fontSizePx);
  });

  it("generates a real PDF for the fixture after the paint-only correction", () => {
    const { bridge } = fixtureModels();
    const result = generatePublicationPdf(
      bridge.model,
      fontResource(),
      bridge.pageGeometry,
      "fixture",
    );
    expect(result.pageCount).toBeGreaterThan(0);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
  });
});
