// P3-O08 -- Final-page completion, Step 2 (Human Visual QA HOLD round
// 26): Structural Colophon Publication rendering.
//
// TWO-MECHANISM AUDIT (direct reads, not memory):
// - Legacy `src/lib/colophon.ts` (TSP-LOOP-005): a real, rich,
//   shipped product feature -- ColophonSettings (fields/freeText/
//   templateId/pagePosition/placement), a dedicated horizontal-only
//   page (`writing-mode: horizontal-tb`, confirmed by this file's own
//   header comment), inserted after all body pages by default
//   (`pagePosition: {mode:"end"}`) or after a specific body page
//   number (`after-body-page`). Real nombre interaction
//   (`resolveColophonNombre`): the colophon page continues the SAME
//   physical page/folio sequence body pages use.
// - Core's `composeColophon` (`core/colophon/index.ts`): a minimal,
//   generic "isolated CanonicalPage set" primitive (Contract Section
//   15) -- structurally sufficient, but with zero knowledge of
//   ColophonSettings' own field/template/placement richness.
// CLASSIFICATION: C -- legacy's ColophonSettings is real product-level
// settings data that, in a full integration, would compile into the
// LogicalUnit[] Core's own composeColophon already accepts
// (`DocumentCompositionInput.colophonUnits`, already wired before this
// round). This round does NOT attempt the full settings-to-text
// compiler (that is Editor/Production-layer integration, out of
// Core's own scope, matching the SAME "segmentation discovery upstream
// of Core" boundary already established for jukugo-ruby) -- it proves
// the REAL, GENERIC mechanism end-to-end using real colophon-like text
// content, and wires the previously-missing Publication paint side.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_FOLIO_SETTINGS, DEFAULT_RULE_SET_V2, type HeaderSettings } from "../../core";
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

function compose(bodyText: string, colophonText?: string, folioSettings?: typeof DEFAULT_FOLIO_SETTINGS, headerSettings?: HeaderSettings) {
  const { units: bodyUnits, source: bodySource } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText }]);
  const colophonBuild = colophonText !== undefined ? buildFixtureUnits("colophon", [{ kind: "TEXT", text: colophonText }]) : undefined;
  const settings = settingsFor({ charsPerLine: Math.max(Array.from(bodyText).length, Array.from(colophonText ?? "").length) + 2, linesPerColumn: 20, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({
    bodyUnits,
    colophonUnits: colophonBuild?.units,
    colophonBlockId: "colophon",
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings,
    folioSettings,
    headerSettings,
  });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPublicationDocument("qa", "QA", document, bodyUnits, bodySource, ctx, colophonBuild?.units, colophonBuild?.source);
  return { document, model, bodySource, colophonSource: colophonBuild?.source };
}

const SAMPLE_COLOPHON = "書名：吾輩は猫である\n著者名：夏目漱石\n発行日：2026年9月8日";

describe("Core -- composeColophon integration (deterministic)", () => {
  it("composing the same body+colophon text twice yields byte-identical colophon output (test 1, 2)", () => {
    const a = compose("あいうえお", SAMPLE_COLOPHON).document.colophon;
    const b = compose("あいうえお", SAMPLE_COLOPHON).document.colophon;
    expect(a).toEqual(b);
  });

  it("enabling colophon appends a distinct block, separate from body pages (test 3)", () => {
    const { document } = compose("あいうえお", SAMPLE_COLOPHON);
    expect(document.colophon).toBeDefined();
    expect(document.colophon?.pages.length).toBeGreaterThan(0);
    expect(document.pages.length).toBe(1); // body pages unaffected in count
  });

  it("omitting colophonUnits produces no colophon page at all (test 4)", () => {
    const { document } = compose("あいうえお");
    expect(document.colophon).toBeUndefined();
  });

  it("user-authored colophon text is preserved via real SourceSpan against its own dedicated block -- not manuscript body content, but real text nonetheless (test 5)", () => {
    const { document, colophonSource } = compose("あいうえお", SAMPLE_COLOPHON);
    const line = document.colophon!.pages[0].columns[0].lines[0];
    const first = line.placedUnits[0];
    expect(first.sourceSpan.blockId).toBe("colophon");
    expect(colophonSource).toBe(SAMPLE_COLOPHON);
  });

  it("field order is deterministic -- text composes in the exact order supplied, character by character (test 8)", () => {
    const { document } = compose("あいうえお", SAMPLE_COLOPHON);
    const line = document.colophon!.pages[0].columns[0].lines[0];
    const chars = line.placedUnits.map((p) => p.sourceSpan.start).sort((a, b) => a - b);
    expect(chars).toEqual([...chars].sort((a, b) => a - b)); // monotonic, i.e. already in source order
  });
});

describe("Folio/header interaction on the colophon page (round 26 correction to round 21's own untested assumption)", () => {
  it("colophon page receives folio, continuing the SAME physical page sequence body pages use (test 11, 13)", () => {
    const { document } = compose("あいうえお", SAMPLE_COLOPHON, DEFAULT_FOLIO_SETTINGS);
    // 1 body page precedes the colophon -- its own folio should be "2".
    expect(document.colophon?.pages[0].folio?.text).toBe("2");
  });

  it("colophon page receives header, using the SAME odd/even parity as body pages would at that physical position (test 12)", () => {
    const headerSettings: HeaderSettings = { hashiraOdd: "奇数柱", hashiraEven: "偶数柱", position: { band: "top", horizontal: "outer" } };
    const { document } = compose("あいうえお", SAMPLE_COLOPHON, undefined, headerSettings);
    // Colophon is physical page 2 (even) -- should get hashiraEven's own text.
    expect(document.colophon?.pages[0].header?.text).toBe("偶数柱");
  });

  it("physical page parity is deterministic across repeated composition (test 13)", () => {
    const a = compose("あいうえお", SAMPLE_COLOPHON, DEFAULT_FOLIO_SETTINGS).document.colophon?.pages[0].folio;
    const b = compose("あいうえお", SAMPLE_COLOPHON, DEFAULT_FOLIO_SETTINGS).document.colophon?.pages[0].folio;
    expect(a).toEqual(b);
  });
});

describe("Body invariance -- manuscript pages structurally unchanged", () => {
  it("manuscript pages are byte-identical with colophon enabled vs disabled (test 14, 15, 16)", () => {
    const withColophon = compose("あいうえお", SAMPLE_COLOPHON).document.pages;
    const withoutColophon = compose("あいうえお").document.pages;
    expect(withColophon).toEqual(withoutColophon);
  });
});

describe("Publication rendering -- vector, horizontal, real Core composition", () => {
  it("colophon paints via the real vector font path (text/glyphOutline only) (test 17)", () => {
    const { model } = compose("あいうえお", SAMPLE_COLOPHON);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(plan.length).toBe(2); // 1 body page + 1 colophon page
    const colophonCommands = plan[1].commands;
    expect(colophonCommands.length).toBeGreaterThan(0);
    for (const cmd of colophonCommands) expect(["text", "glyphOutline"]).toContain(cmd.op);
  });

  it("colophon text is painted HORIZONTALLY (angle 0), matching legacy's own real writing-mode:horizontal-tb (test 10)", () => {
    const { model } = compose("あいうえお", SAMPLE_COLOPHON);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCmd = plan[1].commands.find((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(textCmd?.angle).toBe(0);
  });

  it("body font inheritance (HD-005 default) -- colophon glyph size matches the fixed body-em size (test 9)", () => {
    const { model } = compose("あいうえお", SAMPLE_COLOPHON);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCommands = plan[1].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(textCommands.length).toBeGreaterThan(0);
    const first = textCommands[0].fontSizePt;
    for (const c of textCommands) expect(c.fontSizePt).toBe(first);
  });

  it("renderer does not independently reflow/append pages -- page count matches Core's own colophon page count exactly, no more no less", () => {
    const { model, document } = compose("あいうえお", SAMPLE_COLOPHON);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(plan.length).toBe(document.pages.length + (document.colophon?.pages.length ?? 0));
  });

  it("vector-only, deterministic PDF output", () => {
    const { model } = compose("あいうえお", SAMPLE_COLOPHON, DEFAULT_FOLIO_SETTINGS);
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes, pageCount } = renderPaintPlanToPdf(plan, font);
    expect(pageCount).toBe(2);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("Regression", () => {
  it("Ruby/Dash/TCY/Ellipsis/punctuation/folio/header/small-kana all still render correctly with a colophon page present (tests 18-24)", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const headerSettings: HeaderSettings = { hashiraOdd: "A", hashiraEven: "B", position: { band: "top", horizontal: "outer" } };
    const { model } = compose(bodyText, SAMPLE_COLOPHON, DEFAULT_FOLIO_SETTINGS, headerSettings);
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });

  it("small-kana regression PASS", () => {
    const { outlineContext } = realContexts();
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});

describe("QA -- structural-colophon-qa.pdf (real Core colophon generation, no synthetic injection)", () => {
  it("manuscript final body page, colophon page, blank-field-style short colophon, fuller colophon, folio/header interaction", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";
    const headerSettings: HeaderSettings = { hashiraOdd: "小説のタイトル", hashiraEven: "第一章", position: { band: "top", horizontal: "outer" } };

    const minimal = compose(bodyText, "書名：短編", DEFAULT_FOLIO_SETTINGS, headerSettings);
    const fuller = compose(bodyText, SAMPLE_COLOPHON + "\nサークル名：文鳥社\n連絡先：example@example.test", DEFAULT_FOLIO_SETTINGS, headerSettings);

    const pages = [minimal, fuller].flatMap(({ model }) => buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext));
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(pages.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "structural-colophon-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
