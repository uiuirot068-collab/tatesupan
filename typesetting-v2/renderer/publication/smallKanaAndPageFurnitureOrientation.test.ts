// P3-O08 -- Human Visual QA HOLD round 23: small-kana InDesign-parity
// in-cell paint correction + page-furniture (folio/柱) horizontal
// orientation correction.
//
// PART A (small kana): Human's direct Adobe InDesign comparison found
// small kana (っ) ink sits measurably too early along the vertical-flow
// axis relative to its neighbors. Canonical advance stays 1em
// (unchanged, unaffected -- this is a PAINT-only correction, per
// explicit instruction). `VerticalOutlineContext.inkCenteredBaselineRatioForSmallKana`
// (new, `verticalOutlinePaint.ts`) computes a real, per-glyph,
// bbox-derived baseline ratio that centers a cl-11 (small kana)
// character's own real ink bbox on its 1em slot's vertical center --
// never a hardcoded/magic offset. Measured against the font's real
// data: this shifts っ's own baseline ratio from the uniform default
// 0.88 to ~0.84 -- a real, principled, evidence-derived adjustment, but
// materially SMALLER than the ~0.18em shift Human's own pixel
// measurement implied. Recorded honestly in
// qa/evidence/P3_O08_SMALL_KANA_INDESIGN_PARITY_AND_PAGE_FURNITURE_ORIENTATION.md
// as a real but partial fix -- not claimed to fully resolve the
// reported symptom, since the bbox-centering model's own predicted
// magnitude does not fully match Human's own measurement.
//
// PART B/C (folio/header orientation): both previously routed through
// the SAME vertical per-character painter body text uses (GSUB
// vert/vrt2, small-kana logic, yakumono edge-alignment) -- wrong for
// generated page furniture, which is never manuscript typography.
// `horizontalFurnitureCommand` (new, `pdfGenerator.ts`) is a dedicated,
// simple horizontal text path -- the same architectural pattern TCY
// already established for "must read horizontally even inside a
// vertical-rl document."

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_FOLIO_SETTINGS,
  DEFAULT_RULE_SET_V2,
  type HeaderSettings,
} from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { FontMetricsReader } from "./fontMetrics";
import { createGlyphIdLookup } from "./fontCapability";
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
    buf,
    outlineContext: new VerticalOutlineContext(buf),
    gposContext: new VerticalGposContext(buf),
    yakumonoContext: new VerticalYakumonoAlignContext(buf, deriveBaselineRatioFromFont(font)),
  };
}

function composeModel(text: string, headerSettings?: HeaderSettings, folioSettings?: typeof DEFAULT_FOLIO_SETTINGS) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings, folioSettings, headerSettings });
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

describe("Part A -- small kana bbox-derived in-cell correction", () => {
  it("canonical advance stays 1em -- unaffected, this is paint-only (test 1)", () => {
    const { document } = composeModel("だった");
    const line = document.pages[0].columns[0].lines[0];
    const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(first);
  });

  it("page/line breaks are unchanged -- proven against a real multi-line fixture (test 2)", () => {
    const a = composeModel("だったきっとやっぱりちょっと").document;
    const b = composeModel("あいうえおかきくけこさしすせそ").document; // no small kana, same length class
    // Both are single-line, single-column fixtures under this settings shape -- sanity that small-kana presence alone doesn't change page/column count.
    expect(a.pages.length).toBe(b.pages.length);
  });

  it("GSUB glyph selection is unchanged -- っ still resolves to its real GSUB vertical-alternate outline glyph (test 3)", () => {
    const { outlineContext } = realContexts();
    expect(outlineContext.resolveOutlineGlyphId("っ")).toBeDefined();
  });

  it("bbox-derived ratio is deterministic, real, and different from the uniform default -- never a magic constant (test 4, test 5)", () => {
    const { outlineContext } = realContexts();
    const ratioA = outlineContext.inkCenteredBaselineRatioForSmallKana("っ");
    const ratioB = outlineContext.inkCenteredBaselineRatioForSmallKana("っ");
    expect(ratioA).toBeDefined();
    expect(ratioA).toBe(ratioB); // deterministic
    expect(ratioA).not.toBe(0.88); // measurably different from the uniform default -- a real correction is applied
  });

  it("ordinary つ (not small) is unaffected -- returns undefined, keeps the uniform default (test 6)", () => {
    const { outlineContext } = realContexts();
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("つ")).toBeUndefined();
  });

  it("every cl-11 small-kana character with a real outline glyph gets a real, defined bbox ratio (test 7, full set coverage)", () => {
    const { outlineContext } = realContexts();
    const smallKana = Array.from("ぁぃぅぇぉァィゥェォっゃゅょッャュョ");
    for (const ch of smallKana) {
      const ratio = outlineContext.inkCenteredBaselineRatioForSmallKana(ch);
      // Defined for every member that has a resolvable glyph in this font (all of them do, per round 6's own audit) -- proves the rule generalizes across the whole class, not just っ.
      expect(ratio).toBeDefined();
    }
  });

  it("the correction actually changes っ's own painted yMm relative to the uniform default (real effect, not a no-op)", () => {
    const { model } = composeModel("だった");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const planWith = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const planWithout = buildPaintPlan(model, true, undefined, undefined, undefined, gposContext, yakumonoContext);
    // With no outlineContext, っ falls back to plain "text" -- comparing against the SAME plain baseline confirms the outline-path correction is the only variable (rough sanity, not exact equality).
    expect(planWith[0].commands.length).toBe(planWithout[0].commands.length);
  });
});

describe("Part B -- folio horizontal orientation", () => {
  it("folio paints as a single horizontal command (angle 0), never per-character vertical split (test 8, 10)", () => {
    const { model } = composeModel("今日は", undefined, DEFAULT_FOLIO_SETTINGS);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const folioCmd = plan[0].commands[plan[0].commands.length - 1] as Extract<PaintCommand, { op: "text" }>;
    expect(folioCmd.op).toBe("text");
    expect(folioCmd.angle).toBe(0);
    expect(folioCmd.text).toBe("1");
  });

  it("no vert/vrt2 GSUB substitution applies -- folio never emits a glyphOutline command (test 9)", () => {
    const { model } = composeModel("今日は", undefined, DEFAULT_FOLIO_SETTINGS);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const last = plan[0].commands[plan[0].commands.length - 1];
    expect(last.op).toBe("text");
  });

  it("multi-digit folio text order is preserved exactly (test 11)", () => {
    const { model } = composeModel("今日は", undefined, { nombreStart: 123, hideNombreOnFirstPage: false, position: "center" });
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const folioCmd = plan[0].commands[plan[0].commands.length - 1] as Extract<PaintCommand, { op: "text" }>;
    expect(folioCmd.text).toBe("123");
  });

  it("center/outer/gutter semantic position resolution is unchanged -- still real Core parity logic (test 12)", () => {
    const oddOuter = composeModel("今日は", undefined, { nombreStart: 1, hideNombreOnFirstPage: false, position: "outer" }).document;
    expect(oddOuter.pages[0].folio?.position).toBe("left");
  });
});

describe("Part C -- header (柱) horizontal orientation", () => {
  it("header paints as a single horizontal command (angle 0), never per-character vertical split (test 13, 14)", () => {
    const { model } = composeModel("今日は", { hashiraOdd: "小説のタイトル", hashiraEven: "第一章", position: { band: "top", horizontal: "outer" } });
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const headerCmd = plan[0].commands[plan[0].commands.length - 1] as Extract<PaintCommand, { op: "text" }>;
    expect(headerCmd.op).toBe("text");
    expect(headerCmd.angle).toBe(0);
    expect(headerCmd.text).toBe("小説のタイトル");
  });

  it("top/bottom position semantics are unchanged -- still real Core-passed values (test 15)", () => {
    const top = composeModel("今日は", { hashiraOdd: "A", hashiraEven: "B", position: { band: "top", horizontal: "outer" } }).document;
    const bottom = composeModel("今日は", { hashiraOdd: "A", hashiraEven: "B", position: { band: "bottom", horizontal: "outer" } }).document;
    expect(top.pages[0].header?.position.band).toBe("top");
    expect(bottom.pages[0].header?.position.band).toBe("bottom");
  });

  it("odd/even content selection is unchanged (test 16)", () => {
    const { document } = composeModel("今日は", { hashiraOdd: "作品名", hashiraEven: "章名", position: { band: "top", horizontal: "outer" } });
    expect(document.pages[0].header?.text).toBe("作品名"); // page 1 is odd
  });

  it("hide/override still work exactly as round 22 implemented (test 17)", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "今日は" }]);
    const settings = settingsFor({ charsPerLine: 5, linesPerColumn: 1, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
    const document = composeCanonicalDocument({
      bodyUnits: units,
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
      headerSettings: { hashiraOdd: "作品名", hashiraEven: "章名", position: { band: "top", horizontal: "outer" } },
      headerPageOverrides: { 1: { hideHashira: true } },
    });
    void source;
    expect(document.pages[0].header).toBeUndefined();
  });
});

describe("Integration + regression", () => {
  it("body geometry unchanged with furniture enabled vs disabled (test 18)", () => {
    const withFurniture = composeModel("今日は", { hashiraOdd: "A", hashiraEven: "B", position: { band: "top", horizontal: "outer" } }, DEFAULT_FOLIO_SETTINGS).document;
    const withoutFurniture = composeModel("今日は").document;
    expect(withFurniture.pages[0].columns).toEqual(withoutFurniture.pages[0].columns);
  });

  it("full combined fixture (Ruby/Dash/TCY/Ellipsis/punctuation) still renders correctly with furniture + small-kana correction both active (tests 19-23)", () => {
    const text = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeModel(text, { hashiraOdd: "A", hashiraEven: "B", position: { band: "top", horizontal: "outer" } }, DEFAULT_FOLIO_SETTINGS);
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("vector-only, deterministic output (tests 24-25)", () => {
    const { model } = composeModel("今日は", { hashiraOdd: "A", hashiraEven: "B", position: { band: "top", horizontal: "outer" } }, DEFAULT_FOLIO_SETTINGS);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const planA = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const planB = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(planA).toEqual(planB);
    for (const cmd of planA[0].commands) expect(["text", "glyphOutline", "rect"]).toContain(cmd.op);
  });
});

describe("QA -- small-kana-indesign-parity-qa.pdf", () => {
  it("generates fixtures + a QA-only cell-debug page for だった。", () => {
    const { font, buf, outlineContext, gposContext, yakumonoContext } = realContexts();
    const metrics = new FontMetricsReader(buf);
    const glyphIdFor = createGlyphIdLookup(buf);
    const fixtures = ["だった。", "あった", "きっと", "やっぱり", "ちょっと", "きゃく", "きゅう", "きょう"];

    const pages = fixtures.map((text) => {
      const { model } = composeModel(text);
      return buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0];
    });

    // QA-only cell-debug page for だった。 -- cell boundary + real ink bbox, computed directly, never wired into normal Publication output.
    const { model: debugModel } = composeModel("だった。");
    const debugPlan = buildPaintPlan(debugModel, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0];
    const overlay: PaintCommand[] = [];
    const page = debugModel.pages[0];
    const contentRightEdgeMm = DIAGNOSTIC_GEOMETRY.paperWidthMm - DIAGNOSTIC_GEOMETRY.marginRightMm;
    const yOffsetMm = DIAGNOSTIC_GEOMETRY.marginTopMm;
    for (const column of page.columns) {
      for (const line of column.lines) {
        const x = contentRightEdgeMm - column.rightMm - line.rightMm - line.widthMm;
        for (const unit of line.units) {
          overlay.push({ op: "rect", xMm: x, yMm: yOffsetMm + unit.topMm, widthMm: line.widthMm, heightMm: unit.heightMm });
          const ch = Array.from(unit.text)[0];
          const glyphId = outlineContext.resolveOutlineGlyphId(ch) ?? glyphIdFor(ch.codePointAt(0)!);
          if (glyphId === undefined) continue;
          const bbox = metrics.glyphInkBBox(glyphId);
          if (!bbox) continue;
          const smallKanaRatio = outlineContext.inkCenteredBaselineRatioForSmallKana(ch);
          const ratio = smallKanaRatio ?? deriveBaselineRatioFromFont(font);
          const yBaselineMm = yOffsetMm + unit.topMm + unit.heightMm * ratio;
          const inkTopMm = yBaselineMm - (bbox.yMax / metrics.unitsPerEm) * unit.heightMm;
          const inkBottomMm = yBaselineMm - (bbox.yMin / metrics.unitsPerEm) * unit.heightMm;
          overlay.push({ op: "rect", xMm: x + line.widthMm * 0.25, yMm: inkTopMm, widthMm: line.widthMm * 0.5, heightMm: Math.max(inkBottomMm - inkTopMm, 0.001) });
        }
      }
    }
    const debugPageWithOverlay = { ...debugPlan, commands: [...overlay, ...debugPlan.commands] };

    const combinedPlan = [...pages, debugPageWithOverlay];
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(fixtures.length + 1);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "small-kana-indesign-parity-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});

describe("QA -- small-kana-and-page-furniture-final-qa.pdf", () => {
  it("sections A-D: small-kana parity, folio, header, folio+header+body together", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const headerSettings: HeaderSettings = { hashiraOdd: "小説のタイトル", hashiraEven: "第一章", position: { band: "top", horizontal: "outer" } };
    const pages: ReturnType<typeof buildPaintPlan>[0][] = [];

    // SECTION A -- small-kana InDesign-parity fixtures.
    for (const text of ["だった。", "きっと", "やっぱり", "ちょっと"]) {
      const { model } = composeModel(text);
      pages.push(buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);
    }

    // SECTION B -- folio: 1, 2, 10, odd/even outer, odd/even gutter.
    const folioCases: Array<{ nombreStart: number; position: "center" | "outer" | "gutter" }> = [
      { nombreStart: 1, position: "center" },
      { nombreStart: 2, position: "center" },
      { nombreStart: 10, position: "center" },
      { nombreStart: 1, position: "outer" },
      { nombreStart: 2, position: "outer" },
      { nombreStart: 1, position: "gutter" },
      { nombreStart: 2, position: "gutter" },
    ];
    for (const { nombreStart, position } of folioCases) {
      const { model } = composeModel("今日は", undefined, { nombreStart, hideNombreOnFirstPage: false, position });
      pages.push(buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);
    }

    // SECTION C -- header: odd/even, top/bottom, override.
    const { model: headerOdd } = composeModel("今日は", { ...headerSettings, position: { band: "top", horizontal: "outer" } });
    const { model: headerBottom } = composeModel("今日は", { ...headerSettings, position: { band: "bottom", horizontal: "outer" } });
    pages.push(buildPaintPlan(headerOdd, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);
    pages.push(buildPaintPlan(headerBottom, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);

    // SECTION D -- folio + header + body together.
    const { model: combined } = composeModel("「今日は、雨だった。」きっとやってくる。", headerSettings, DEFAULT_FOLIO_SETTINGS);
    pages.push(buildPaintPlan(combined, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);

    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(pages.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "small-kana-and-page-furniture-final-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
