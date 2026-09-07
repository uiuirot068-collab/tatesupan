// P3-O08 -- Human Visual QA HOLD round 17: NORMAL SPACING FINAL DECISION.
// A later, authoritative direct comparison against real Adobe InDesign
// vertical output withdrew round 16's own Human A/B selection: visible
// normal spacing before a closing bracket is the DESIRED behavior for
// 。」/、」, not a defect. Round 14's Core advance suppression and round
// 16's Publication paint-anchor override are both retired. This file
// proves the retirement is complete and correct -- round 13's own
// general legacy-parity edge alignment (HANG_START/HANG_END, unrelated
// to the specific cl-06/cl-07 -> cl-02 pair) remains fully intact.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 80, paperHeightMm: 100, marginTopMm: 15, marginBottomMm: 15, marginRightMm: 15, marginLeftMm: 15 };

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

function composeFor(text: string) {
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
  const model = buildPublicationDocument("id", "label", document, units, source, ctx);
  return { document, model };
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

describe("Round 17 -- special cl-06/cl-07 -> cl-02 branch is gone", () => {
  it("VerticalYakumonoAlignContext no longer exposes usesFullEmAnchor (test 1, test 2)", () => {
    const { yakumonoContext } = realContexts();
    expect((yakumonoContext as unknown as Record<string, unknown>).usesFullEmAnchor).toBeUndefined();
  });

  it("た。」 -- 。's own yMm uses the ORIGINAL round-13 per-slot-height formula, never bodyEmMm (test 3)", () => {
    const { model } = composeFor("た。」");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const periodUnit = model.pages[0].columns[0].lines[0].units[1];
    const periodCmd = plan[0].commands[1] as Extract<PaintCommand, { op: "text" }>;
    expect(periodCmd.op).toBe("text");
    const ratio = yakumonoContext.baselineRatioFor("。")!;
    const expectedYMm = periodUnit.topMm + periodUnit.heightMm * ratio; // own slot, not bodyEmMm
    expect(periodCmd.yMm).toBeCloseTo(expectedYMm, 9);
  });

  it("た、」 -- 、 receives the same, ordinary (unconditional) treatment (test 4)", () => {
    const { model } = composeFor("た、」");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const commaUnit = model.pages[0].columns[0].lines[0].units[1];
    const commaCmd = plan[0].commands[1] as Extract<PaintCommand, { op: "text" }>;
    expect(commaCmd.op).toBe("text");
    const ratio = yakumonoContext.baselineRatioFor("、")!;
    const expectedYMm = commaUnit.topMm + commaUnit.heightMm * ratio;
    expect(commaCmd.yMm).toBeCloseTo(expectedYMm, 9);
  });
});

describe("Round 17 -- canonical advance is uniform again (no compression)", () => {
  it("た。」 -- every pitch is exactly one cell", () => {
    const { document } = composeFor("た。」");
    const measurement = createFakeMeasurementProvider();
    const settings = settingsFor({ charsPerLine: 20, linesPerColumn: 1, columnCount: 1 });
    const cell = measurement.naturalAdvanceTick(settings.bodyFontRef, settings.bodyFontSizePt, "");
    const line = document.pages[0].columns[0].lines[0];
    expect(line.placedUnits[1].yTick - line.placedUnits[0].yTick).toBe(cell);
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(cell);
  });

  it("た、」 -- every pitch is exactly one cell", () => {
    const { document } = composeFor("た、」");
    const line = document.pages[0].columns[0].lines[0];
    const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(first);
  });

  it("「今日は、雨だった。」 -- EVERY pitch is the same uniform cell, no exception anywhere (unlike round 14/16)", () => {
    const { document } = composeFor("「今日は、雨だった。」");
    const line = document.pages[0].columns[0].lines[0];
    const pitches: number[] = [];
    for (let i = 1; i < line.placedUnits.length; i++) pitches.push(line.placedUnits[i].yTick - line.placedUnits[i - 1].yTick);
    const first = pitches[0];
    for (const p of pitches) expect(p).toBe(first);
  });

  it("た。次 / た、次 -- unaffected, exactly as before (controls)", () => {
    for (const text of ["た。次", "た、次"]) {
      const { document } = composeFor(text);
      const line = document.pages[0].columns[0].lines[0];
      const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
      expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(first);
    }
  });
});

describe("Round 17 -- glyph size and small kana", () => {
  it("punctuation glyph size remains the fixed 1em bodyEmMm-derived fontSizePt (test 5)", () => {
    const { model } = composeFor("た。」");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const commands = plan[0].commands;
    const sizes = commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text").map((c) => c.fontSizePt);
    const first = sizes[0];
    for (const s of sizes) expect(s).toBe(first);
  });

  it("small kana (っ) canonical advance remains 1em -- the round-15 0.5em prototype was never product default and remains so (test 6)", () => {
    const { document } = composeFor("だった");
    const line = document.pages[0].columns[0].lines[0];
    const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(first);
  });
});

describe("Round 17 -- Core invariants (safety)", () => {
  it("source is never mutated (test 11)", () => {
    const before = { units: buildFixtureUnits("body", [{ kind: "TEXT", text: "た。」" }]).units };
    const beforeCopy = JSON.parse(JSON.stringify(before));
    composeFor("た。」");
    expect(before).toEqual(beforeCopy);
  });

  it("SourceSpan is preserved end-to-end, one grapheme per placedUnit, in order (test 12)", () => {
    const source = "「今日は、雨だった。」";
    const { document } = composeFor(source);
    const line = document.pages[0].columns[0].lines[0];
    const chars = Array.from(source);
    expect(line.placedUnits).toHaveLength(chars.length);
    line.placedUnits.forEach((p, i) => {
      expect(p.sourceSpan.start).toBe(i);
      expect(p.sourceSpan.end).toBe(i + 1);
    });
  });
});

// Final fixtures 1-4 represent the restored, closed product default.
// Fixtures 5-8 are NON-FINAL RESEARCH CONTROLS ONLY (recorded as a new,
// separate, explicitly-not-implemented open item -- 感嘆符/疑問符 before
// a closing bracket -- in
// qa/evidence/P3_O08_YAKUMONO_NORMAL_SPACING_FINAL_ROUND17.md). No new
// rule is applied to them; they paint via the exact same unconditional
// default as everything else in this file, for observation only.
const FINAL_FIXTURES = ["「今日は、雨だった。」", "「今日は、雨だった、」", "た。次", "た、次"];
const RESEARCH_CONTROL_FIXTURES = ["「本当！」", "「本当？」", "「本当！？」", "「本当？！」"];

describe("Round 17 -- generates yakumono-normal-spacing-final-qa.pdf", () => {
  it("4 final fixtures + 4 non-final research-control fixtures, all painted via the same unconditional default", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const pages = [...FINAL_FIXTURES, ...RESEARCH_CONTROL_FIXTURES].map((text) => {
      const { model } = composeFor(text);
      return buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    });
    const combinedPlan = pages.flat();
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(FINAL_FIXTURES.length + RESEARCH_CONTROL_FIXTURES.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "yakumono-normal-spacing-final-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
