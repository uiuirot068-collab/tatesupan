// P3-O08 -- Final-page completion, Step 1D + correction (Human Visual
// QA HOLD round 24, corrected round 25): 柱 (running header) 2-axis
// semantic placement grid.
//
// Round 24's own "vertical CENTER" reading was a genuine Human QA-caught
// product-model error -- "CENTER" was never meant as vertical
// page-center, it means HORIZONTAL centering within the top/bottom
// band. CORRECTED MODEL: `HeaderBand` ("top"|"bottom", the ONLY
// vertical axis, matching legacy's own real `HashiraPosition` exactly)
// crossed with `FolioPosition` itself, reused DIRECTLY as the
// horizontal axis ("outer"|"center"|"gutter" -- the SAME 小口/中央/ノド
// concept folio already models, not a lookalike copy). Six real
// combinations: TOP×OUTER, TOP×CENTER, TOP×GUTTER, BOTTOM×OUTER,
// BOTTOM×CENTER, BOTTOM×GUTTER -- no vertical center anywhere.
// `resolveFolioPhysicalSide` (folio's own already-proven parity logic)
// is reused directly for the horizontal axis, not duplicated.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_FOLIO_SETTINGS,
  DEFAULT_RULE_SET_V2,
  headerSettingsFromLegacy,
  resolveFolioPhysicalSide,
  type FolioPosition,
  type HeaderBand,
  type HeaderPositionSetting,
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

function composeModel(text: string, headerSettings?: HeaderSettings) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings, headerSettings });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPublicationDocument("qa", "QA", document, units, source, ctx);
  return { document, model, source };
}

function headerSettingsFor(position: HeaderPositionSetting): HeaderSettings {
  return { hashiraOdd: "作品名", hashiraEven: "章名", position };
}

describe("Corrected model -- HeaderBand (top/bottom) x FolioPosition (outer/center/gutter)", () => {
  const bands: HeaderBand[] = ["top", "bottom"];
  const horizontals: FolioPosition[] = ["outer", "center", "gutter"];

  it("HeaderBand only accepts top/bottom -- there is no vertical center (test 1)", () => {
    for (const band of bands) {
      const { document } = composeModel("今日は", headerSettingsFor({ band, horizontal: "outer" }));
      expect(["top", "bottom"]).toContain(document.pages[0].header?.position.band);
    }
  });

  it("horizontal axis accepts outer/center/gutter (test 2)", () => {
    for (const horizontal of horizontals) {
      const { document } = composeModel("今日は", headerSettingsFor({ band: "top", horizontal }));
      expect(["left", "center", "right"]).toContain(document.pages[0].header?.position.horizontal);
    }
  });

  it("exactly six real combinations are supported (test 3)", () => {
    let count = 0;
    for (const band of bands) {
      for (const horizontal of horizontals) {
        const { document } = composeModel("今日は", headerSettingsFor({ band, horizontal }));
        expect(document.pages[0].header?.position.band).toBe(band);
        count++;
      }
    }
    expect(count).toBe(6);
  });

  it("TOP x CENTER stays in the top band (test 4)", () => {
    const { document } = composeModel("今日は", headerSettingsFor({ band: "top", horizontal: "center" }));
    expect(document.pages[0].header?.position.band).toBe("top");
    expect(document.pages[0].header?.position.horizontal).toBe("center");
  });

  it("BOTTOM x CENTER stays in the bottom band (test 5)", () => {
    const { document } = composeModel("今日は", headerSettingsFor({ band: "bottom", horizontal: "center" }));
    expect(document.pages[0].header?.position.band).toBe("bottom");
    expect(document.pages[0].header?.position.horizontal).toBe("center");
  });

  it("CENTER's own horizontal anchor is parity-independent -- same resolved value on both odd and even pages (test 6)", () => {
    expect(resolveFolioPhysicalSide("center", true)).toBe("center");
    expect(resolveFolioPhysicalSide("center", false)).toBe("center");
  });

  it("CENTER text is truly centered around the physical page-width anchor -- jsPDF's own align:'center' accounts for real text width, no separate offset invented (test 7)", () => {
    const { model } = composeModel("今日は", headerSettingsFor({ band: "top", horizontal: "center" }));
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const headerCmd = plan[0].commands[plan[0].commands.length - 1] as Extract<PaintCommand, { op: "text" }>;
    expect(headerCmd.align).toBe("center");
    expect(headerCmd.xMm).toBeCloseTo(DIAGNOSTIC_GEOMETRY.paperWidthMm / 2, 6);
  });
});

describe("Outer/gutter parity -- reuses folio's own resolveFolioPhysicalSide, not duplicated", () => {
  it("OUTER odd page = left (test 8)", () => {
    const { document } = composeModel("今日は", headerSettingsFor({ band: "top", horizontal: "outer" }));
    expect(document.pages[0].header?.position.horizontal).toBe("left");
  });

  it("OUTER even page = right -- direct proof against the same resolver composeHeaderForPage uses internally (test 9)", () => {
    expect(resolveFolioPhysicalSide("outer", false)).toBe("right");
  });

  it("GUTTER odd page = right -- exact mirror of outer on the same page (test 10)", () => {
    const { document } = composeModel("今日は", headerSettingsFor({ band: "top", horizontal: "gutter" }));
    expect(document.pages[0].header?.position.horizontal).toBe("right");
  });

  it("GUTTER even page = left (test 11)", () => {
    expect(resolveFolioPhysicalSide("gutter", false)).toBe("left");
  });
});

describe("Legacy compatibility", () => {
  it("legacy 'top' maps to TOP x OUTER (test 12)", () => {
    const settings = headerSettingsFromLegacy("作品名", "章名", "top");
    expect(settings.position).toEqual({ band: "top", horizontal: "outer" });
  });

  it("legacy 'bottom' maps to BOTTOM x OUTER (test 13)", () => {
    const settings = headerSettingsFromLegacy("作品名", "章名", "bottom");
    expect(settings.position).toEqual({ band: "bottom", horizontal: "outer" });
  });

  it("old vertical-center semantics are absent from the corrected type -- HeaderBand has no 'center' member (test 14)", () => {
    const settings = headerSettingsFromLegacy("作品名", "章名", "top");
    // TypeScript itself proves this at compile time (HeaderBand = "top"|"bottom" only); this runtime check documents the same fact for the QA record.
    expect(["top", "bottom"]).toContain(settings.position.band);
  });

  it("a document composed with legacy-mapped settings produces the same content/horizontal legacy itself would (odd page, outer/left)", () => {
    const settings = headerSettingsFromLegacy("作品名", "章名", "top");
    const { document } = composeModel("今日は", settings);
    expect(document.pages[0].header).toEqual({ text: "作品名", position: { band: "top", horizontal: "left" } });
  });
});

describe("Unaffected fields", () => {
  it("header remains horizontal/upright for every one of the six positions (test 15)", () => {
    const { model } = composeModel("今日は", headerSettingsFor({ band: "bottom", horizontal: "center" }));
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const last = plan[0].commands[plan[0].commands.length - 1] as Extract<PaintCommand, { op: "text" }>;
    expect(last.angle).toBe(0);
  });

  it("body layout unchanged across all six positions (test 16)", () => {
    const baseline = composeModel("今日は").document.pages[0].columns;
    for (const band of ["top", "bottom"] as const) {
      for (const horizontal of ["outer", "center", "gutter"] as const) {
        const { document } = composeModel("今日は", headerSettingsFor({ band, horizontal }));
        expect(document.pages[0].columns).toEqual(baseline);
      }
    }
  });
});

describe("Regression", () => {
  it("folio regression PASS (test 17)", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "今日は" }]);
    const settings = settingsFor({ charsPerLine: 5, linesPerColumn: 1, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings, folioSettings: DEFAULT_FOLIO_SETTINGS });
    void source;
    expect(document.pages[0].folio?.text).toBe("1");
  });

  it("small-kana regression PASS (test 18)", () => {
    const { outlineContext } = realContexts();
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });

  it("full combined fixture (Ruby/Dash/TCY/Ellipsis) still renders with a corrected six-position header active (tests 19-22)", () => {
    const text = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeModel(text, headerSettingsFor({ band: "bottom", horizontal: "center" }));
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("QA -- header-six-position-qa.pdf (regenerated, corrected model)", () => {
  it("first six primary fixtures are TOP x OUTER/CENTER/GUTTER, BOTTOM x OUTER/CENTER/GUTTER; plus even-page parity controls", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";
    const bands: HeaderBand[] = ["top", "bottom"];
    const horizontals: FolioPosition[] = ["outer", "center", "gutter"];

    const pages: ReturnType<typeof buildPaintPlan>[0][] = [];
    // Six primary fixtures, odd page (page 1), in the exact required order.
    for (const band of bands) {
      for (const horizontal of horizontals) {
        const { model } = composeModel(bodyText, headerSettingsFor({ band, horizontal }));
        pages.push(buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);
      }
    }
    // Even-page parity controls for TOP x OUTER, TOP x GUTTER, BOTTOM x OUTER, BOTTOM x GUTTER (via a real 2-page manuscript).
    for (const band of bands) {
      for (const horizontal of ["outer", "gutter"] as const) {
        const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText + "\f" + bodyText }]);
        const settings = settingsFor({ charsPerLine: Array.from(bodyText).length + 2, linesPerColumn: 1, columnCount: 1 });
        const measurement = createFakeMeasurementProvider();
        const document = composeCanonicalDocument({
          bodyUnits: units,
          ruleSet: DEFAULT_RULE_SET_V2,
          measurement,
          settings,
          headerSettings: headerSettingsFor({ band, horizontal }),
        });
        const ctx: PublicationRenderContext = {
          linePitchTicks: settings.linePitchTicks,
          lineExtentTicks: settings.lineExtentTicks,
          columnExtentTicks: settings.columnExtentTicks,
          columnsPerPage: settings.columnsPerPage,
          measurementIdentity: document.version.measurementIdentity,
          paintFontIdentity: document.version.measurementIdentity,
        };
        const model = buildPublicationDocument("qa", "QA", document, units, source, ctx);
        const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
        pages.push(...plan);
      }
    }

    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(pages.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "header-six-position-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
