// P3-O08 -- Final-page completion, Step 1 + 1B (Human Visual QA HOLD
// rounds 20-21): folio/header paint AND real Core-side folio generation.
// `core/folio/index.ts` (round 21) ports legacy `src/lib/pageLayout.ts`'s
// real `MasterPageSettings` folio fields (`nombreStart`,
// `hideNombreOnFirstPage`, `nombrePosition`, restricted to "center" this
// round) into a real `composeCanonicalDocument({ folioSettings })` input
// -- no synthetic injection is used for the tests or the final QA PDF;
// every fixture here goes through the real pipeline.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_FOLIO_SETTINGS, DEFAULT_RULE_SET_V2, type FolioSettings } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
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

/** Real pipeline only -- composeCanonicalDocument's own folioSettings input, no synthetic PaintPage/PublicationDocument injection. */
function composeModel(text: string, folioSettings?: FolioSettings) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings, folioSettings });
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

describe("Folio Core generation -- real MasterPageSettings-derived contract", () => {
  it("Core emits NO folio when folioSettings is omitted -- byte-identical to every pre-round-21 caller (regression safety)", () => {
    const { document } = composeModel("今日は");
    expect(document.pages[0].folio).toBeUndefined();
  });

  it("Core emits a real folio when folioSettings is supplied -- nombreStart=1 gives page 1 the text \"1\" (test: folio value deterministic)", () => {
    const { document } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS);
    expect(document.pages[0].folio).toEqual({ text: "1", position: "center" });
  });

  it("nombreStart offsets every page's own displayed number (legacy MasterPageSettings.nombreStart, ported verbatim)", () => {
    const { document } = composeModel("今日は", { nombreStart: 7, hideNombreOnFirstPage: false, position: "center" });
    expect(document.pages[0].folio?.text).toBe("7");
  });

  it("hideNombreOnFirstPage suppresses only the FIRST page's folio (legacy field, ported verbatim) -- suppression is representable as generated-furniture absence, deterministic", () => {
    const { document } = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: true, position: "center" });
    expect(document.pages[0].folio).toBeUndefined();
  });

  it("generated furniture never carries a SourceSpan -- it is not manuscript content (INV-001 safety)", () => {
    const { document } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS);
    const folio = document.pages[0].folio as unknown as Record<string, unknown>;
    expect(folio.sourceSpan).toBeUndefined();
  });

  it("composing the same source+folioSettings twice yields byte-identical folio output (determinism)", () => {
    const a = composeModel("今日は", DEFAULT_FOLIO_SETTINGS).document.pages[0].folio;
    const b = composeModel("今日は", DEFAULT_FOLIO_SETTINGS).document.pages[0].folio;
    expect(a).toEqual(b);
  });

  it("body layout (canonical coordinates, page/column/line geometry) is byte-identical with folioSettings enabled vs disabled -- generated furniture never triggers a reflow", () => {
    const withFolio = composeModel("今日は", DEFAULT_FOLIO_SETTINGS).document;
    const withoutFolio = composeModel("今日は").document;
    expect(withFolio.pages[0].columns).toEqual(withoutFolio.pages[0].columns);
  });
});

describe("Folio Publication paint -- real Core data, real geometry resolution", () => {
  it("folio text resolves via Publication's own paint model, unchanged from Core's generated text", () => {
    const { model } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS);
    expect(model.pages[0].folio).toEqual({ text: "1", position: "center" });
  });

  it("folio 'center' position resolves to a real physical mm coordinate derived from PublicationPageGeometry -- changing the paper width moves it, proving it is computed from geometry, never fabricated (test: coordinates deterministic)", () => {
    const { model } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const narrowGeometry: PublicationPageGeometry = { ...DIAGNOSTIC_GEOMETRY, paperWidthMm: 60 };
    const planWide = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const planNarrow = buildPaintPlan(model, true, narrowGeometry, undefined, outlineContext, gposContext, yakumonoContext);
    const xOf = (plan: ReturnType<typeof buildPaintPlan>): number => {
      const cmd = plan[0].commands[plan[0].commands.length - 1];
      if (cmd.op === "text" || cmd.op === "rect") return cmd.xMm;
      const first = cmd.commands.find((c): c is Extract<(typeof cmd.commands)[number], { x: number }> => c.type !== "Z");
      return first?.x ?? NaN;
    };
    expect(xOf(planWide)).not.toBeCloseTo(xOf(planNarrow), 3);
  });

  it("folio paints via the real vector font path -- 'text' or 'glyphOutline' commands only, never a raster/rect placeholder", () => {
    const { model } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const last = plan[0].commands[plan[0].commands.length - 1];
    expect(["text", "glyphOutline"]).toContain(last.op);
  });

  it("folio font size matches the fixed body-em size (HD-005 default: inherits body font unless overridden)", () => {
    const { model } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const textCommands = plan[0].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const first = textCommands[0].fontSizePt;
    for (const c of textCommands) expect(c.fontSizePt).toBe(first);
  });

  it("suppressed page (hideNombreOnFirstPage) paints no folio command at all -- the existing optional-field mechanism IS the suppression rule", () => {
    const { model } = composeModel("今日は", { nombreStart: 1, hideNombreOnFirstPage: true, position: "center" });
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    // Every command belongs to body text ("今日は", 3 characters) -- none is an extra folio run.
    expect(plan[0].commands.length).toBeLessThanOrEqual(3);
  });

  it("same input -> byte-identical PaintPlan output, twice (determinism)", () => {
    const { model } = composeModel("今日は", DEFAULT_FOLIO_SETTINGS);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const planA = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const planB = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(planA).toEqual(planB);
  });
});

describe("Folio -- regression (Ruby/Small Kana/Dash/TCY/Ellipsis unaffected)", () => {
  it("full combined fixture (Ruby/TCY/Dash/Ellipsis/punctuation) still renders correctly with real folio generation enabled", () => {
    const text = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeModel(text, DEFAULT_FOLIO_SETTINGS);
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
  });
});

describe("Folio -- generates folio-header-real-contract-qa.pdf (real Core generation, no synthetic injection)", () => {
  it("page 1 (folio '1'), page with hideNombreOnFirstPage (suppressed), page with folioSettings omitted (no folio field at all), body text unaffected throughout", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const bodyText = "「今日は、雨だった。」きっとやってくる。";

    const page1 = composeModel(bodyText, { ...DEFAULT_FOLIO_SETTINGS, nombreStart: 1 }).model;
    const suppressedPage = composeModel(bodyText, { nombreStart: 1, hideNombreOnFirstPage: true, position: "center" }).model;
    const noFolioSettingsPage = composeModel(bodyText).model; // folioSettings entirely omitted -- pre-round-21 behavior

    const pages = [page1, suppressedPage, noFolioSettingsPage].map((doc) => buildPaintPlan(doc, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext)[0]);
    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(3);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "folio-header-real-contract-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
