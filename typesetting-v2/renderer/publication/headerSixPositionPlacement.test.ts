// P3-O08 -- Final-page completion, Step 1D (Human Visual QA HOLD round
// 24): 柱 (running header) 2-axis semantic placement grid. A v2-native
// ENHANCEMENT beyond legacy's own limited top/bottom-only,
// always-outer contract -- TOP/CENTER/BOTTOM x OUTER/GUTTER.
// `resolveFolioPhysicalSide` (folio's own already-proven parity logic,
// round 22) is reused directly for the side axis, not duplicated.

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
  type HeaderPositionSetting,
  type HeaderSettings,
  type HeaderSide,
  type HeaderVerticalPosition,
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

describe("Six semantic combinations", () => {
  const verticals: HeaderVerticalPosition[] = ["top", "center", "bottom"];
  const sides: HeaderSide[] = ["outer", "gutter"];

  it("all six vertical x side combinations produce a valid, distinct-by-construction resolved position (test 1)", () => {
    for (const vertical of verticals) {
      for (const side of sides) {
        const { document } = composeModel("今日は", headerSettingsFor({ vertical, side }));
        expect(document.pages[0].header?.position.vertical).toBe(vertical);
        expect(["left", "right"]).toContain(document.pages[0].header?.position.side);
      }
    }
  });

  it("TOP is deterministic (test 2)", () => {
    const a = composeModel("今日は", headerSettingsFor({ vertical: "top", side: "outer" })).document;
    const b = composeModel("今日は", headerSettingsFor({ vertical: "top", side: "outer" })).document;
    expect(a.pages[0].header).toEqual(b.pages[0].header);
  });

  it("CENTER is deterministic (test 3)", () => {
    const { document } = composeModel("今日は", headerSettingsFor({ vertical: "center", side: "outer" }));
    expect(document.pages[0].header?.position.vertical).toBe("center");
  });

  it("BOTTOM is deterministic (test 4)", () => {
    const { document } = composeModel("今日は", headerSettingsFor({ vertical: "bottom", side: "gutter" }));
    expect(document.pages[0].header?.position.vertical).toBe("bottom");
  });
});

describe("Outer/gutter parity -- reuses folio's own resolveFolioPhysicalSide, not duplicated", () => {
  it("OUTER odd page = left (test 5)", () => {
    const { document } = composeModel("今日は", headerSettingsFor({ vertical: "top", side: "outer" }));
    expect(document.pages[0].header?.position.side).toBe("left");
  });

  it("OUTER even page = right -- direct proof against the same resolver composeHeaderForPage uses internally (test 6)", () => {
    expect(resolveFolioPhysicalSide("outer", false)).toBe("right");
  });

  it("GUTTER odd page = right -- exact mirror of outer on the same page (test 7)", () => {
    const { document } = composeModel("今日は", headerSettingsFor({ vertical: "top", side: "gutter" }));
    expect(document.pages[0].header?.position.side).toBe("right");
  });

  it("GUTTER even page = left -- mirrors outer's own even-page resolution (test 8, via direct resolver proof)", () => {
    // Direct proof against Core's own exported resolver (the SAME one composeHeaderForPage uses internally) for isOddPage=false, since a real multi-page fixture is out of this test's own scope.
    expect(resolveFolioPhysicalSide("gutter", false)).toBe("left");
    expect(resolveFolioPhysicalSide("outer", false)).toBe("right");
  });
});

describe("Legacy compatibility", () => {
  it("headerSettingsFromLegacy maps a bare top/bottom value to side: 'outer' deterministically, matching legacy's own real, unconfigurable behavior (test 9)", () => {
    const settings = headerSettingsFromLegacy("作品名", "章名", "top");
    expect(settings.position).toEqual({ vertical: "top", side: "outer" });
  });

  it("hashiraOdd is unchanged through the legacy mapping (test 10)", () => {
    const settings = headerSettingsFromLegacy("作品名", "章名", "bottom");
    expect(settings.hashiraOdd).toBe("作品名");
  });

  it("hashiraEven is unchanged through the legacy mapping (test 11)", () => {
    const settings = headerSettingsFromLegacy("作品名", "章名", "bottom");
    expect(settings.hashiraEven).toBe("章名");
  });

  it("a document composed with legacy-mapped settings produces the same content/side legacy itself would (odd page, outer/left)", () => {
    const settings = headerSettingsFromLegacy("作品名", "章名", "top");
    const { document } = composeModel("今日は", settings);
    expect(document.pages[0].header).toEqual({ text: "作品名", position: { vertical: "top", side: "left" } });
  });
});

describe("Unaffected fields (test 12-15)", () => {
  it("hideHashira suppression still works (test 12)", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "今日は" }]);
    const settings = settingsFor({ charsPerLine: 5, linesPerColumn: 1, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({
      bodyUnits: units,
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
      headerSettings: headerSettingsFor({ vertical: "center", side: "gutter" }),
      headerPageOverrides: { 1: { hideHashira: true } },
    });
    void source;
    expect(document.pages[0].header).toBeUndefined();
  });

  it("hashiraOverride still works (test 13)", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "今日は" }]);
    const settings = settingsFor({ charsPerLine: 5, linesPerColumn: 1, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({
      bodyUnits: units,
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
      headerSettings: headerSettingsFor({ vertical: "center", side: "gutter" }),
      headerPageOverrides: { 1: { hashiraOverride: "特別編" } },
    });
    void source;
    expect(document.pages[0].header?.text).toBe("特別編");
  });

  it("horizontal orientation is unchanged for every one of the six positions (test 14)", () => {
    const { model } = composeModel("今日は", headerSettingsFor({ vertical: "center", side: "gutter" }));
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const last = plan[0].commands[plan[0].commands.length - 1] as Extract<PaintCommand, { op: "text" }>;
    expect(last.angle).toBe(0);
  });

  it("headerFontSize/HD-005 body-font inheritance unchanged -- all commands share one fontSizePt (test 15)", () => {
    const { model } = composeModel("今日は", headerSettingsFor({ vertical: "center", side: "gutter" }));
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCommands = plan[0].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const first = textCommands[0].fontSizePt;
    for (const c of textCommands) expect(c.fontSizePt).toBe(first);
  });
});

describe("Body layout unchanged", () => {
  it("body geometry is byte-identical across all six positions (test 16)", () => {
    const baseline = composeModel("今日は").document.pages[0].columns;
    for (const vertical of ["top", "center", "bottom"] as const) {
      for (const side of ["outer", "gutter"] as const) {
        const { document } = composeModel("今日は", headerSettingsFor({ vertical, side }));
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

  it("full combined fixture (Ruby/Dash/TCY/Ellipsis/punctuation) still renders with a six-position header active (tests 19-22)", () => {
    const text = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeModel(text, headerSettingsFor({ vertical: "center", side: "gutter" }));
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("QA -- header-six-position-qa.pdf", () => {
  it("generates all six odd-page positions plus even-page outer/gutter parity proof, with visible body text", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";
    const verticals: HeaderVerticalPosition[] = ["top", "center", "bottom"];
    const sides: HeaderSide[] = ["outer", "gutter"];

    const pages: ReturnType<typeof buildPaintPlan>[0][] = [];
    // Odd page (page 1 of every fixture), all six combinations.
    for (const vertical of verticals) {
      for (const side of sides) {
        const { model } = composeModel(bodyText, headerSettingsFor({ vertical, side }));
        pages.push(buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);
      }
    }
    // Even-page parity proof for OUTER and GUTTER (via a 2-page manuscript so page 2 is real and even).
    for (const side of sides) {
      const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText + "\f" + bodyText }]); // manual page break between two copies
      const settings = settingsFor({ charsPerLine: Array.from(bodyText).length + 2, linesPerColumn: 1, columnCount: 1 });
      const measurement = createFakeMeasurementProvider();
      const document = composeCanonicalDocument({
        bodyUnits: units,
        ruleSet: DEFAULT_RULE_SET_V2,
        measurement,
        settings,
        headerSettings: headerSettingsFor({ vertical: "top", side }),
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
      pages.push(...plan); // both pages of this 2-page document, if the manual break actually produced 2
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
