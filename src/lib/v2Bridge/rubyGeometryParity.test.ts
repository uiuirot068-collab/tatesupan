import ReactDOMServer from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createShipporiMinchoMeasurementProvider } from "../../../typesetting-v2/core/measurement/shipporiMinchoProvider";
import { PreviewDocumentView } from "../../../typesetting-v2/renderer/preview/PreviewRenderer";
import { generatePublicationJpgPages } from "../../../typesetting-v2/renderer/publication/jpgExport";
import { FontBinary } from "../../../typesetting-v2/renderer/publication/fontBinary";
import { createGlyphIdLookup } from "../../../typesetting-v2/renderer/publication/fontCapability";
import { FontMetricsReader } from "../../../typesetting-v2/renderer/publication/fontMetrics";
import {
  buildPublicationPaintPlan,
  generatePublicationPdf,
  type PaintCommand,
  type PublicationFontResource,
} from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { composeV2Document } from "./composeV2Document";
import { buildV2PreviewDocument } from "./useV2PreviewAdapter";
import {
  RUBY_PARENT_OPTICAL_INSET_EM,
  rubyLaneGeometry,
} from "../../../typesetting-v2/renderer/rubyLane";

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

function horizontalInkGapEm(base: string, reading: string, insetEm: number): number {
  const font = FontBinary.fromBytes(readFileSync(FONT_PATH));
  const metrics = new FontMetricsReader(font);
  const glyphIdFor = createGlyphIdLookup(font);
  const boxes = (text: string) =>
    Array.from(text).map((character) => {
      const glyphId = glyphIdFor(character.codePointAt(0)!);
      if (glyphId === undefined) throw new Error(`Missing glyph for ${character}`);
      const box = metrics.glyphInkBBox(glyphId);
      if (!box) throw new Error(`Missing ink box for ${character}`);
      return box;
    });
  const parentInkRight = Math.max(...boxes(base).map((box) => box.xMax)) / metrics.unitsPerEm - 0.5;
  const rubyInkLeft =
    rubyLaneGeometry(1).annotationCenterFromParentCenter - insetEm +
    (Math.min(...boxes(reading).map((box) => box.xMin)) / metrics.unitsPerEm - 0.5) *
      rubyLaneGeometry(1).annotationWidth;
  return rubyInkLeft - parentInkRight;
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

  it("uses one measured optical lane inset in Preview and Publication, independent of line pitch", () => {
    const { bridge, preview } = fixtureModels();
    const previewLine = preview.pages.flatMap((page) => page.columns.flatMap((column) => column.lines))
      .find((line) => line.units.some((unit) => unit.text === "髑髏"))!;
    const publicationLine = bridge.model.pages.flatMap((page) => page.columns.flatMap((column) => column.lines))
      .find((line) => line.units.some((unit) => unit.text === "髑髏"))!;
    const ruby = publicationLine.units.find((unit) => unit.text === "髑髏")!;
    const commands = textCommands(bridge.plan.flatMap((page) => page.commands));
    const body = commands.find((command) => command.text === "髑")!;
    const annotation = commands.find((command) => command.text === "も" && command.xMm !== body.xMm)!;
    const laneMm = rubyLaneGeometry(bridge.model.bodyEmMm);
    const lanePx = rubyLaneGeometry(preview.fontSizePx);

    expect(annotation.xMm).toBeCloseTo(
      body.xMm + laneMm.annotationCenterFromParentCenter,
      6,
    );
    expect(laneMm.emBoxGap).toBeCloseTo(
      -bridge.model.bodyEmMm * RUBY_PARENT_OPTICAL_INSET_EM,
      6,
    );
    const annotationRightFromParentCenter =
      laneMm.annotationCenterFromParentCenter + laneMm.annotationWidth / 2;
    const neighboringBodyNearEdge =
      publicationLine.widthMm - bridge.model.bodyEmMm / 2;
    expect(annotationRightFromParentCenter).toBeLessThan(neighboringBodyNearEdge);
    expect(neighboringBodyNearEdge - annotationRightFromParentCenter).toBeCloseTo(
      bridge.model.bodyEmMm * RUBY_PARENT_OPTICAL_INSET_EM,
      // Core's line pitch is an integer GeometryTick, so its mm projection
      // differs from the ideal 1.5em by at most one sub-micron tick rounding.
      2,
    );
    expect(publicationLine.widthMm).toBeGreaterThan(bridge.model.bodyEmMm);
    expect(ruby.rubyAnnotation?.status).toBe("PLACED");

    const html = ReactDOMServer.renderToStaticMarkup(
      PreviewDocumentView({ model: preview, mode: "normal" }),
    );
    expect(html).toContain(
      `left:calc(50% + ${lanePx.annotationStartFromParentCenter}px)`,
    );
    expect(html).toContain(`width:${lanePx.annotationWidth}px`);
    expect(previewLine.widthPx).toBeGreaterThan(preview.fontSizePx);
  });

  it.each([
    ["聯想", "れんそう"],
    ["髑髏", "もぐらもち"],
    ["光", "ひかり"],
  ])("reduces the real-font %s《%s》 ink gap without collision", (base, reading) => {
    const before = horizontalInkGapEm(base, reading, -RUBY_PARENT_OPTICAL_INSET_EM);
    const after = horizontalInkGapEm(base, reading, 0);
    expect(before).toBeGreaterThan(0.1);
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThan(0.09);
    expect(before - after).toBeCloseTo(RUBY_PARENT_OPTICAL_INSET_EM, 6);
  });

  it("keeps short and long Ruby centered independently of the cross-axis lane inset", () => {
    const { bridge } = fixtureModels();
    const ruby = bridge.model.pages.flatMap((page) =>
      page.columns.flatMap((column) =>
        column.lines.flatMap((line) => line.units.filter((unit) => unit.kind === "RUBY")),
      ),
    );
    for (const unit of ruby) {
      expect(unit.rubyAnnotation?.status).toBe("PLACED");
      if (unit.rubyAnnotation?.status !== "PLACED") continue;
      expect(unit.rubyAnnotation.policy).toBe("CENTER");
      expect(unit.topMm + unit.rubyAnnotation.offsetMm + unit.rubyAnnotation.extentMm / 2)
        .toBeCloseTo(unit.topMm + unit.heightMm / 2, 6);
    }
  });

  it("generates a real PDF for the fixture after the paint-only correction", () => {
    const { bridge } = fixtureModels();
    const result = generatePublicationPdf(
      bridge.model,
      fontResource(),
      bridge.pageGeometry,
    );
    expect(result.pageCount).toBeGreaterThan(0);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("renders a real JPG from the same corrected Publication PaintPlan", async () => {
    const { bridge } = fixtureModels();
    const pages = await generatePublicationJpgPages(
      bridge.model,
      fontResource(),
      bridge.pageGeometry,
      "Ruby distance fixture",
      "PRINT",
    );
    expect(pages).toHaveLength(bridge.plan.length);
    expect(pages.every((page) => page.bytes[0] === 0xff && page.bytes[1] === 0xd8)).toBe(true);
  }, 30_000);
});
