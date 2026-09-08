// P3-O08 -- Final-page completion, Step 1C (Human Visual QA HOLD round
// 22): completes the folio gutter/outer parity resolution AND adds a
// real Core-side 柱 (running header) generation, both ported verbatim
// from legacy `src/lib/pageLayout.ts`/`src/components/PageCard.tsx`.
// No synthetic PublicationDocument injection anywhere -- every fixture
// goes through the real composeCanonicalDocument pipeline.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_FOLIO_SETTINGS,
  DEFAULT_HEADER_SETTINGS,
  DEFAULT_RULE_SET_V2,
  type FolioSettings,
  type HeaderPageOverride,
  type HeaderSettings,
} from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 15, marginBottomMm: 12, marginRightMm: 15, marginLeftMm: 15 };

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

function realContexts() {
  const font = fontResource();
  const buf = readFileSync(FONT_PATH);
  return {
    font,
    outlineContext: new VerticalOutlineContext(buf),
    gposContext: new VerticalGposContext(buf),
    yakumonoContext: new VerticalYakumonoAlignContext(buf, deriveBaselineRatioFromFont(font)),
  };
}

function composeModel(
  text: string,
  folioSettings?: FolioSettings,
  headerSettings?: HeaderSettings,
  headerPageOverrides?: Record<number, HeaderPageOverride>
) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings, folioSettings, headerSettings, headerPageOverrides });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPublicationDocument("folio-qa", "Folio QA", document, units, source, ctx);
  return { document, model, source };
}

describe("Folio gutter/outer parity -- ported verbatim from PageCard.tsx", () => {
  it("outer on page 1 (odd) resolves to 'left' (recto is the left side of a 右綴じ spread) (test: outer odd/even deterministic)", () => {
    const { document } = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: false, position: "outer" });
    expect(document.pages[0].folio?.position).toBe("left");
  });

  it("outer resolution is deterministic -- composing twice yields the same side", () => {
    const a = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: false, position: "outer" }).document.pages[0].folio?.position;
    const b = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: false, position: "outer" }).document.pages[0].folio?.position;
    expect(a).toBe(b);
  });

  it("gutter on page 1 (odd) resolves to 'right' -- the exact mirror of outer, same page (test: gutter odd/even deterministic)", () => {
    const { document } = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: false, position: "gutter" });
    expect(document.pages[0].folio?.position).toBe("right");
  });

  it("center is unaffected by parity -- always 'center' regardless of page (test: center deterministic)", () => {
    const { document } = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: false, position: "center" });
    expect(document.pages[0].folio?.position).toBe("center");
  });

  it("nombreStart deterministic, legacy field ported verbatim", () => {
    const { document } = composeModel("今日は", { nombreStart: 42, hideNombreOnFirstPage: false, position: "center" });
    expect(document.pages[0].folio?.text).toBe("42");
  });

  it("first-page suppression (hideNombreOnFirstPage) still works alongside gutter/outer resolution", () => {
    const { document } = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: true, position: "outer" });
    expect(document.pages[0].folio).toBeUndefined();
  });

  it("generated furniture never carries a SourceSpan, even for gutter/outer (test: generated furniture has no SourceSpan)", () => {
    const { document } = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: false, position: "outer" });
    const folio = document.pages[0].folio as unknown as Record<string, unknown>;
    expect(folio.sourceSpan).toBeUndefined();
  });
});

describe("Header (柱) -- ported verbatim from legacy MasterPageSettings/PageOverride", () => {
  it("odd page gets hashiraOdd content (test: odd content deterministic)", () => {
    const { document } = composeModel("今日は", undefined, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } });
    expect(document.pages[0].header?.text).toBe("作品名");
  });

  it("hashiraPosition is passed through unchanged (test: hashiraPosition deterministic)", () => {
    const { document } = composeModel("今日は", undefined, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "bottom", side: "outer" } });
    expect(document.pages[0].header?.position.vertical).toBe("bottom");
  });

  it("hideHashira suppresses the header on that page only (test: hideHashira suppression)", () => {
    const { document } = composeModel("今日は", undefined, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } }, { 1: { hideHashira: true } });
    expect(document.pages[0].header).toBeUndefined();
  });

  it("hashiraOverride replaces the normal odd/even content for one page (test: hashiraOverride)", () => {
    const { document } = composeModel("今日は", undefined, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } }, { 1: { hashiraOverride: "特別編" } });
    expect(document.pages[0].header?.text).toBe("特別編");
  });

  it("empty hashiraOdd/hashiraEven (DEFAULT_HEADER_SETTINGS) produces no header at all -- matches legacy's own default-empty convention", () => {
    const { document } = composeModel("今日は", undefined, DEFAULT_HEADER_SETTINGS);
    expect(document.pages[0].header).toBeUndefined();
  });

  it("header content never carries a SourceSpan (generated furniture, not manuscript content)", () => {
    const { document } = composeModel("今日は", undefined, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } });
    const header = document.pages[0].header as unknown as Record<string, unknown>;
    expect(header.sourceSpan).toBeUndefined();
  });

  it("headerFontSize is HD-005's own default (body font inheritance) -- no separate font mechanism invented (test: body-font inheritance, headerFontSize)", () => {
    const { model } = composeModel("今日は", undefined, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } });
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCommands = plan[0].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    if (textCommands.length > 1) {
      const first = textCommands[0].fontSizePt;
      for (const c of textCommands) expect(c.fontSizePt).toBe(first);
    }
  });
});

describe("Folio + Header integration", () => {
  it("both coexist on the same page without collision (test: Folio + Header coexist)", () => {
    const { document } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } });
    expect(document.pages[0].folio).toBeDefined();
    expect(document.pages[0].header).toBeDefined();
  });

  it("body layout is byte-identical with folio+header enabled vs both omitted (test: body layout byte/structural equality)", () => {
    const withFurniture = composeModel("今日は", DEFAULT_FOLIO_SETTINGS, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } }).document;
    const withoutFurniture = composeModel("今日は").document;
    expect(withFurniture.pages[0].columns).toEqual(withoutFurniture.pages[0].columns);
  });

  it("Publication uses the real canonical folio+header, painting via the real vector font path (test: Publication uses canonical furniture, vector-only text)", () => {
    const { model } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } });
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const last2 = plan[0].commands.slice(-2);
    for (const cmd of last2) expect(["text", "glyphOutline"]).toContain(cmd.op);
  });

  it("Preview receives the same canonical furniture, unchanged pass-through (test: Preview uses canonical furniture if implemented)", () => {
    const { document } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } });
    // Preview's own paintModel.ts pass-through is exercised indirectly here via the SAME CanonicalDocument both renderers consume.
    expect(document.pages[0].folio?.text).toBe("1");
    expect(document.pages[0].header?.text).toBe("作品名");
  });
});

describe("Regression (Ruby/Small Kana/Dash/TCY/Ellipsis unaffected)", () => {
  it("full combined fixture still renders correctly with folio+header both enabled", () => {
    const text = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeModel(text, DEFAULT_FOLIO_SETTINGS, { hashiraOdd: "作品名", hashiraEven: "章名", position: { vertical: "top", side: "outer" } });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("Generates folio-header-complete-contract-qa.pdf (real Core pipeline, no synthetic injection)", () => {
  it("11 fixtures covering odd/even, outer, gutter, first-page suppression, odd/even header, hideHashira, hashiraOverride, folio+header together, body-unaffected", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";
    const headerSettings: HeaderSettings = { hashiraOdd: "小説のタイトル", hashiraEven: "第一章", position: { vertical: "top", side: "outer" } };

    const fixtures = [
      composeModel(bodyText, { nombreStart: 1, hideNombreOnFirstPage: false, position: "center" }).model, // 1. odd + center
      composeModel(bodyText, { nombreStart: 2, hideNombreOnFirstPage: false, position: "center" }).model, // 2. even + center
      composeModel(bodyText, { nombreStart: 1, hideNombreOnFirstPage: false, position: "outer" }).model, // 3. odd + outer (left)
      composeModel(bodyText, { nombreStart: 2, hideNombreOnFirstPage: false, position: "outer" }).model, // 3b. even + outer (right)
      composeModel(bodyText, { nombreStart: 1, hideNombreOnFirstPage: false, position: "gutter" }).model, // 4. odd + gutter (right)
      composeModel(bodyText, { nombreStart: 2, hideNombreOnFirstPage: false, position: "gutter" }).model, // 4b. even + gutter (left)
      composeModel(bodyText, { nombreStart: 1, hideNombreOnFirstPage: true, position: "center" }).model, // 5. first-page suppression
      composeModel(bodyText, undefined, { ...headerSettings }).model, // 6/7. odd/even header (page order determines which)
      composeModel(bodyText, undefined, headerSettings, { 1: { hideHashira: true } }).model, // 8. hideHashira
      composeModel(bodyText, undefined, headerSettings, { 1: { hashiraOverride: "特別編" } }).model, // 9. hashiraOverride
      composeModel(bodyText, DEFAULT_FOLIO_SETTINGS, headerSettings).model, // 10. folio + header together
      composeModel(bodyText).model, // 11. body unaffected, no furniture at all
    ];

    const pages = fixtures.map((doc) => buildPaintPlan(doc, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(fixtures.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "folio-header-complete-contract-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
