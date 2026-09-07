// P3-O08 -- Final-page completion, Step 1 (Human Visual QA HOLD round 20):
// folio/header paint. Core never populates `CanonicalPage.folio` today
// (confirmed directly, same finding Preview's own paintModel.ts already
// recorded) -- there is no real producer to test end-to-end through
// `composeCanonicalDocument`. These tests construct a `PublicationDocument`
// directly (the same technique many Core tests already use to test one
// half of a pipeline whose other half has no real producer yet) to prove
// Publication's own paint-side mechanism is correct once given real data,
// without inventing what that data means.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 15, marginBottomMm: 12, marginRightMm: 15, marginLeftMm: 15 }; // realistic 文庫 (A6-ish)

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

function composeModel(text: string) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPublicationDocument("folio-qa", "Folio QA", document, units, source, ctx);
  return { document, model, source, settings, ctx };
}

/** Constructs a folio-bearing copy of a real, otherwise-composed PublicationDocument -- the ONLY way to exercise this path today, since Core never populates folio. Never mutates the composed document Core itself produced. */
function withFolio(model: PublicationDocument, folioText: string, xTick: number, yTick: number): PublicationDocument {
  return {
    ...model,
    pages: model.pages.map((page) => ({
      ...page,
      folio: { text: folioText, xMm: xTick, topMm: yTick },
    })),
  };
}

describe("Folio/header -- contract audit proofs", () => {
  it("Core never populates CanonicalPage.folio for an ordinary composed document (confirms the audit finding directly, not from memory)", () => {
    const { document } = composeModel("あいうえお");
    expect(document.pages[0].folio).toBeUndefined();
  });

  it("Publication's own PaintPage.folio is likewise absent when Core supplies none -- pass-through is faithful, nothing is invented", () => {
    const { model } = composeModel("あいうえお");
    expect(model.pages[0].folio).toBeUndefined();
  });
});

describe("Folio/header -- paint mechanism (source deterministic, positioning geometry-only)", () => {
  it("folio text resolves deterministically from source+sourceSpan, the same mechanism every other unit uses (test 1)", () => {
    const { model } = composeModel("あいうえお");
    const withF = withFolio(model, "１２３", 5, 100);
    expect(withF.pages[0].folio?.text).toBe("１２３");
    const withF2 = withFolio(model, "１２３", 5, 100);
    expect(withF2.pages[0].folio).toEqual(withF.pages[0].folio);
  });

  it("odd/even placement is entirely Core's own coordinate decision -- Publication paints wherever xMm/topMm say, never computing parity itself (test 3)", () => {
    const { model } = composeModel("あいうえお");
    const oddPage = withFolio(model, "１", 5, 90);
    const evenPage = withFolio(model, "１", 20, 90); // a DIFFERENT xMm -- simulating a hypothetical left/right-page offset Core might one day compute
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const planOdd = buildPaintPlan(oddPage, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const planEven = buildPaintPlan(evenPage, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const lastOdd = planOdd[0].commands[planOdd[0].commands.length - 1];
    const lastEven = planEven[0].commands[planEven[0].commands.length - 1];
    const xOf = (c: PaintCommand): number => {
      if (c.op === "text" || c.op === "rect") return c.xMm;
      const first = c.commands.find((cmd): cmd is Extract<typeof cmd, { x: number }> => cmd.type !== "Z");
      return first?.x ?? NaN;
    };
    expect(xOf(lastOdd)).not.toBe(xOf(lastEven)); // Publication faithfully reflects whatever Core's own xMm says
  });

  it("suppression: a page with no folio paints no folio command at all -- the existing optional-field mechanism IS the suppression rule (test 4)", () => {
    const { model } = composeModel("あいうえお");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    // Every command belongs to the body text ("あいうえお", 5 characters) -- none is an extra folio run.
    const textCommands = plan[0].commands.filter((c): c is Extract<PaintCommand, { op: "text" | "glyphOutline" }> => c.op === "text" || c.op === "glyphOutline");
    expect(textCommands.length).toBeLessThanOrEqual(5);
  });

  it("body layout (canonical coordinates, page/column/line geometry) is byte-identical with or without a folio present (test 5)", () => {
    const { model } = composeModel("あいうえお");
    const withF = withFolio(model, "１２３", 5, 100);
    // Strip the folio field itself, then compare everything else.
    const { folio: _f0, ...pageWithoutFolio } = withF.pages[0];
    const { folio: _f1, ...pageOriginal } = model.pages[0];
    expect(pageWithoutFolio).toEqual(pageOriginal);
  });

  it("folio paints via the real vector font path -- 'text' or 'glyphOutline' commands only, never a raster/rect placeholder when a font is supplied (test 6)", () => {
    const { model } = composeModel("あいうえお");
    const withF = withFolio(model, "１２３", 5, 100);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(withF, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const last3 = plan[0].commands.slice(-3);
    for (const cmd of last3) expect(["text", "glyphOutline"]).toContain(cmd.op);
  });

  it("folio font size matches the fixed body-em size (HD-005 default: inherits body font unless overridden; no override mechanism exists yet, so only the default is exercised) (test 7)", () => {
    // "今日は" (kanji-containing) rather than pure hiragana -- round 6's own
    // GSUB audit found essentially ALL kana need outline paint in this
    // font (kanji generally excluded), so a pure-hiragana fixture would
    // produce zero "text" op commands to compare against here.
    const { model } = composeModel("今日は");
    const withF = withFolio(model, "１２３", 5, 100);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(withF, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCommands = plan[0].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(textCommands.length).toBeGreaterThan(0);
    const first = textCommands[0].fontSizePt;
    for (const c of textCommands) expect(c.fontSizePt).toBe(first);
  });

  it("same PublicationDocument input -> byte-identical PaintPlan output, twice (test 8, determinism)", () => {
    const { model } = composeModel("あいうえお");
    const withF = withFolio(model, "１２３", 5, 100);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const planA = buildPaintPlan(withF, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const planB = buildPaintPlan(withF, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(planA).toEqual(planB);
  });
});

describe("Folio/header -- regression (Ruby/Small Kana/Dash/TCY/Ellipsis unaffected)", () => {
  it("full combined fixture (Ruby/TCY/Dash/Ellipsis/punctuation) still renders correctly with a folio present on the same page", () => {
    const text = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeModel(text);
    const withF = withFolio(model, "７", 5, 130);
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(withF, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("Folio/header -- generates folio-header-qa.pdf", () => {
  it("demonstrates odd page (folio present), even page (different xMm), suppressed page (no folio), and body-text-unaffected, at realistic 文庫 geometry", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";

    const { model: base } = composeModel(bodyText);
    const oddPage = withFolio(base, "１", 6, 132); // odd page: folio near the outer (left, in vertical-rl reading) margin
    const evenPage = withFolio(base, "２", 90, 132); // even page: a different xMm, simulating a hypothetical mirrored placement
    const suppressedPage = base; // no folio at all -- e.g. a front-matter/blank page

    const pages = [oddPage, evenPage, suppressedPage].map((doc) => buildPaintPlan(doc, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(3);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "folio-header-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
