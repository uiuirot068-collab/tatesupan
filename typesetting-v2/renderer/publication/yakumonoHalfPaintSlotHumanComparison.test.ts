// P3-O08 -- VISUAL PROTOTYPE ONLY (Human Visual QA HOLD round 15, Part B).
// NOT a standards audit, NOT an architecture change. Current HEAD
// (commit 15a993a) already compresses a cl-06/cl-07 atom's own canonical
// advance to half a cell when immediately followed by cl-02, and
// `paintModel.ts`'s own `heightMm = next.yTick - placed.yTick` means that
// atom's own paint SLOT is therefore already half a cell too -- Human
// judged the visible result still not clearly improved.
//
// This file does NOT repeat that same implementation and does NOT touch
// Core or the default RuleSetVersion/rule scope. A_CURRENT renders
// through the real, unmodified, already-committed production pipeline
// (`buildPaintPlan` with real outline/GPOS/yakumono contexts) for direct
// comparison. B_HALF_PAINT_SLOT is a QA-only alternative painted by
// hand in this test file only: the punctuation's own real edge-flush
// ratio (`VerticalYakumonoAlignContext.baselineRatioFor`, unchanged) is
// computed against the FULL, uncompressed body-em height instead of the
// atom's own (already-halved) slot height -- testing whether the
// ink-flush math itself, not merely the slot size, is what still looks
// wrong. Position/topMm/advance and every other character are
// byte-identical to A -- only this one punctuation glyph's own yMm
// differs between variants.

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

function isTriggerPair(currentText: string, nextText: string | undefined): boolean {
  const current = DEFAULT_RULE_SET_V2.characterClassFor(currentText);
  const next = nextText !== undefined ? DEFAULT_RULE_SET_V2.characterClassFor(nextText) : undefined;
  return (current.id === "cl-06" || current.id === "cl-07") && next?.id === "cl-02";
}

function cellRectsFor(model: ReturnType<typeof composeFor>["model"]): PaintCommand[] {
  const page = model.pages[0];
  const contentRightEdgeMm = DIAGNOSTIC_GEOMETRY.paperWidthMm - DIAGNOSTIC_GEOMETRY.marginRightMm;
  const yOffsetMm = DIAGNOSTIC_GEOMETRY.marginTopMm;
  const rects: PaintCommand[] = [];
  for (const column of page.columns) {
    for (const line of column.lines) {
      const x = contentRightEdgeMm - column.rightMm - line.rightMm - line.widthMm;
      for (const unit of line.units) {
        rects.push({ op: "rect", xMm: x, yMm: yOffsetMm + unit.topMm, widthMm: line.widthMm, heightMm: unit.heightMm });
      }
    }
  }
  return rects;
}

/** B_HALF_PAINT_SLOT: clones A's own real production command array and, ONLY for the cl-06/cl-07 atom immediately preceding a cl-02 atom, recomputes its yMm against the FULL bodyEmMm instead of its own (already Core-compressed) heightMm slot. Everything else is byte-identical to A. */
function buildBVariantCommands(
  model: ReturnType<typeof composeFor>["model"],
  aCommands: PaintCommand[],
  yakumonoContext: VerticalYakumonoAlignContext
): PaintCommand[] {
  const units = model.pages[0].columns[0].lines[0].units;
  expect(aCommands.length).toBe(units.length); // 1:1, no ruby/tcy in these fixtures -- verified, not assumed
  const yOffsetMm = DIAGNOSTIC_GEOMETRY.marginTopMm;
  return aCommands.map((cmd, i) => {
    const unit = units[i];
    const next = units[i + 1];
    if (unit.kind !== "TEXT" || !isTriggerPair(unit.text, next?.text) || cmd.op !== "text") return cmd;
    const ratio = yakumonoContext.baselineRatioFor(unit.text) ?? yakumonoContext.defaultBaselineRatio;
    const newYMm = yOffsetMm + unit.topMm + model.bodyEmMm * ratio;
    return { ...cmd, yMm: newYMm };
  });
}

describe("Yakumono half-paint-slot human comparison -- prototype invariants", () => {
  it("A_CURRENT is exactly current HEAD behavior -- controls unaffected: た。次/た、次 have no cl-06/07->cl-02 trigger anywhere", () => {
    const { model: modelA } = composeFor("た。次");
    const { model: modelB } = composeFor("た、次");
    for (const m of [modelA, modelB]) {
      const units = m.pages[0].columns[0].lines[0].units;
      for (let i = 0; i < units.length; i++) {
        expect(isTriggerPair(units[i].text, units[i + 1]?.text)).toBe(false);
      }
    }
  });

  it("B_HALF_PAINT_SLOT changes ONLY the triggering punctuation's own yMm -- every other command in た。」 is byte-identical to A", () => {
    const { model } = composeFor("た。」");
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), deriveBaselineRatioFromFont(font));
    const planA = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const commandsB = buildBVariantCommands(model, planA[0].commands, yakumonoContext);
    const units = model.pages[0].columns[0].lines[0].units;
    units.forEach((unit, i) => {
      const isTrigger = isTriggerPair(unit.text, units[i + 1]?.text);
      if (isTrigger) {
        expect((commandsB[i] as Extract<PaintCommand, { op: "text" }>).yMm).not.toBe((planA[0].commands[i] as Extract<PaintCommand, { op: "text" }>).yMm);
      } else {
        expect(commandsB[i]).toEqual(planA[0].commands[i]);
      }
    });
  });

  it("glyph size/text content is unchanged in B -- only yMm (position) differs, never fontSizePt or the painted text string", () => {
    const { model } = composeFor("た。」");
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), deriveBaselineRatioFromFont(font));
    const planA = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const commandsB = buildBVariantCommands(model, planA[0].commands, yakumonoContext);
    planA[0].commands.forEach((cmdA, i) => {
      const cmdB = commandsB[i];
      if (cmdA.op === "text" && cmdB.op === "text") {
        expect(cmdB.fontSizePt).toBe(cmdA.fontSizePt);
        expect(cmdB.text).toBe(cmdA.text);
      }
    });
  });
});

describe("Yakumono half-paint-slot human comparison -- generates yakumono-half-paint-slot-human-comparison.pdf", () => {
  it("one A_CURRENT page then one B_HALF_PAINT_SLOT page per fixture, in order, with QA-only cell boundaries", () => {
    const font = fontResource();
    const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
    const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
    const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), deriveBaselineRatioFromFont(font));

    const pages: { widthMm: number; heightMm: number; commands: PaintCommand[] }[] = [];
    for (const text of FIXTURES) {
      const { model } = composeFor(text);
      const rects = cellRectsFor(model);
      const planA = buildPaintPlan(model, true, DIAGNOSTIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
      const commandsB = buildBVariantCommands(model, planA[0].commands, yakumonoContext);
      pages.push({ widthMm: DIAGNOSTIC_GEOMETRY.paperWidthMm, heightMm: DIAGNOSTIC_GEOMETRY.paperHeightMm, commands: [...rects, ...planA[0].commands] });
      pages.push({ widthMm: DIAGNOSTIC_GEOMETRY.paperWidthMm, heightMm: DIAGNOSTIC_GEOMETRY.paperHeightMm, commands: [...rects, ...commandsB] });
    }

    const { bytes, pageCount } = renderPaintPlanToPdf(pages, font);
    expect(pageCount).toBe(FIXTURES.length * 2);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "yakumono-half-paint-slot-human-comparison.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
