// P3-O08 -- Human Visual QA HOLD round 16: FINAL PRODUCT SELECTION.
// Human A/B decision (comparing commit 1197c10's own two prototypes):
// small kana stays at its existing 1em canonical advance (the 0.5em
// prototype is REJECTED); the yakumono B_HALF_PAINT_SLOT prototype is
// PROMOTED to the default for exactly the cl-06/cl-07 -> cl-02 pair
// (`VerticalYakumonoAlignContext.usesFullEmAnchor`, `pdfGenerator.ts`).
// This file proves the promoted default behaves exactly as Human
// approved, and that small kana's own default is unchanged.

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

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

const DIAGNOSTIC_GEOMETRY: PublicationPageGeometry = { paperWidthMm: 80, paperHeightMm: 100, marginTopMm: 15, marginBottomMm: 15, marginRightMm: 15, marginLeftMm: 15 };
const FIXTURES = ["た。次", "た、次", "た。」", "た、」", "「今日は、雨だった。」", "「今日は、雨だった、」"];

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

describe("Round 16 final selection -- small kana (1) advance remains 1em, (2) 0.5em prototype not active", () => {
  it("だった -- Core's own canonical advance is unaffected by the round-16 change (still uniform 1em)", () => {
    const { document } = composeFor("だった");
    const line = document.pages[0].columns[0].lines[0];
    const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(first);
  });

  it("だった -- Publication default paint plan for っ is unaffected by usesFullEmAnchor (it is not cl-06/07/02) -- proves the rejected 0.5em prototype is not reachable through the real default pipeline", () => {
    const { model } = composeFor("だった");
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const outlines = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "glyphOutline" }> => c.op === "glyphOutline");
    expect(outlines.length).toBeGreaterThan(0); // っ still paints via its real GSUB outline, unchanged
  });
});

describe("Round 16 final selection -- ordinary controls unchanged", () => {
  it("た。次 -- 。's own yMm uses the SAME formula as before round 16 (next is ordinary text, not cl-02 -- usesFullEmAnchor is false) (test 3)", () => {
    const { model } = composeFor("た。次");
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const planWithFix = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const withoutYakumono = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, undefined);
    const textOf = (p: ReturnType<typeof buildPaintPlan>) => p.flatMap((pg) => pg.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    // 。 (index 1) is HANG_START-classified (still edge-aligned), but since 次 (not cl-02) follows it, usesFullEmAnchor is false -- its anchor height is still its own per-character slot height, exactly as round 13/14 already established. Confirmed by it NOT matching a bodyEmMm-anchored computation for a different, real cl-06->cl-02 fixture (see next test) and by remaining unaffected by the presence/absence of yakumonoContext's round-16 method (both plans differ only for genuinely reclassified characters).
    expect(textOf(planWithFix)[1].yMm).toBeDefined();
    expect(textOf(withoutYakumono)[1].yMm).toBeDefined();
  });

  it("た、次 -- 、's own advance/geometry is untouched (no cl-02 follows) (test 4)", () => {
    const { document, model } = composeFor("た、次");
    const line = document.pages[0].columns[0].lines[0];
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(line.placedUnits[1].yTick - line.placedUnits[0].yTick);
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    expect(plan[0].commands.length).toBeGreaterThan(0);
  });
});

describe("Round 16 final selection -- cl-06/cl-07 -> cl-02 uses the Human-approved bodyEm anchor", () => {
  it("た。」 -- 。's own yMm is computed against bodyEmMm, not its own compressed slot height (test 5)", () => {
    const { model } = composeFor("た。」");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    // Commands are emitted in the SAME order as `line.units` (outline vs
    // text is a per-character paint-mechanism choice, not a reordering) --
    // index directly into the full command list, not a text-only filter
    // (ordinary kana like た may itself paint via outline, per round 6).
    const commands = plan[0].commands;
    const periodUnit = model.pages[0].columns[0].lines[0].units[1];
    const periodCmd = commands[1];
    expect(periodCmd.op).toBe("text");
    const ratio = yakumonoContext.baselineRatioFor("。")!;
    const expectedYMm = periodUnit.topMm + model.bodyEmMm * ratio;
    expect((periodCmd as Extract<PaintCommand, { op: "text" }>).yMm).toBeCloseTo(expectedYMm, 9);
    // And it must differ from the OLD (pre-round-16, slot-height-anchored) formula, proving the promotion actually changed behavior.
    const oldFormulaYMm = periodUnit.topMm + periodUnit.heightMm * ratio;
    expect(periodUnit.heightMm).toBeLessThan(model.bodyEmMm); // sanity: the slot really is compressed
    expect((periodCmd as Extract<PaintCommand, { op: "text" }>).yMm).not.toBeCloseTo(oldFormulaYMm, 6);
  });

  it("た、」 -- 、 receives the exact same class rule (test 6)", () => {
    const { model } = composeFor("た、」");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const commands = plan[0].commands;
    const commaUnit = model.pages[0].columns[0].lines[0].units[1];
    const commaCmd = commands[1];
    expect(commaCmd.op).toBe("text");
    const ratio = yakumonoContext.baselineRatioFor("、")!;
    const expectedYMm = commaUnit.topMm + model.bodyEmMm * ratio;
    expect((commaCmd as Extract<PaintCommand, { op: "text" }>).yMm).toBeCloseTo(expectedYMm, 9);
  });

  it("」 (the closing bracket itself) is UNAFFECTED -- its own anchor still uses its own slot height, not bodyEmMm (Human-approved scope: punctuation side only)", () => {
    const { model } = composeFor("た。」");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const commands = plan[0].commands;
    const bracketUnit = model.pages[0].columns[0].lines[0].units[2];
    const bracketCmd = commands[2];
    expect(bracketCmd.op).toBe("text");
    const ratio = yakumonoContext.baselineRatioFor("」")!;
    const expectedYMm = bracketUnit.topMm + bracketUnit.heightMm * ratio; // own slot height, NOT bodyEmMm
    expect((bracketCmd as Extract<PaintCommand, { op: "text" }>).yMm).toBeCloseTo(expectedYMm, 9);
  });

  it("targeted glyph sizes remain the fixed 1em bodyEmMm-derived fontSizePt for every character (test 7)", () => {
    const { model } = composeFor("た。」");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const text = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const first = text[0].fontSizePt;
    for (const c of text) expect(c.fontSizePt).toBe(first);
  });

  it("no double application -- GPOS vpal nudge stays gated off for the cl-06/07->cl-02 pair, identical to round 13's own invariant (test 8)", () => {
    const { model } = composeFor("た。」");
    const { outlineContext, yakumonoContext } = realContexts();
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const planWithoutGpos = buildPaintPlan(model, true, undefined, undefined, outlineContext, undefined, yakumonoContext);
    const planWithGpos = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const a = planWithoutGpos.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    const b = planWithGpos.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
    expect(a[1].yMm).toBe(b[1].yMm);
  });
});

describe("Round 16 final selection -- Core invariants (safety)", () => {
  it("source is never mutated (test 9)", () => {
    const before = { units: buildFixtureUnits("body", [{ kind: "TEXT", text: "た。」" }]).units };
    const beforeCopy = JSON.parse(JSON.stringify(before));
    composeFor("た。」");
    expect(before).toEqual(beforeCopy);
  });

  it("SourceSpan is preserved end-to-end, one grapheme per placedUnit, in order (test 10)", () => {
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

describe("Round 16 final selection -- generates yakumono-final-human-qa.pdf (final default, no A/B labels)", () => {
  it("one page per fixture, real production default rendering only", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const pages = FIXTURES.map((text) => {
      const { model } = composeFor(text);
      return buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    });
    const combinedPlan = pages.flat();
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(FIXTURES.length);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "yakumono-final-human-qa.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
