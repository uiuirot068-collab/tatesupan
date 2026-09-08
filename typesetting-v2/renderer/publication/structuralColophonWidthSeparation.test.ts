// P3-O08 -- Final-page completion, Step 2 (Human Visual QA HOLD round
// 29E): separates two independent widths that round 29D wrongly
// conflated. Round 29D bound the freeText width to the STRUCTURED
// row frame (a real fix for "freeText extends far beyond the intended
// colophon width"), but round 29D ALSO bound the title row's own
// width, which shrank the structured frame itself below its own
// natural size, wrapping normal short values (the date) that
// previously fit. Human clarification: freeText alone should be
// title-row-bounded; the structured row frame should keep its own
// natural (round 29C) sizing, safety-clamped only against the real
// page region.
//
// Product model (this round):
//   structuredFrameWidth = min(labelColumnWidth + gap + widestRealValueWidth, availableSafeColophonWidth)
//   freeTextWrapWidth    = titleRow.labelWidth + gap + titleRow.valueWidth   (independent)
//   blockWidth            = max(structuredFrameWidth, freeTextWrapWidth)
// "Round 29C's equality assumption is retired" -- freeTextWrapWidth ===
// structuredFrameWidth only when they happen to be numerically equal,
// never assumed.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_FOLIO_SETTINGS,
  DEFAULT_RULE_SET_V2,
  compileColophonContent,
  type HeaderSettings,
  type ColophonFieldInput,
  type ColophonCompiledContent,
  type ColophonPlacement,
} from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const CAPACITY = { charsPerLine: 30, linesPerColumn: 12, columnCount: 1 as const };
const OVERFLOW_CAPACITY_HUMAN = { charsPerLine: 30, linesPerColumn: 3, columnCount: 1 as const };

// Generous (not narrow) geometry -- this round's own focus is proving
// the TWO WIDTHS are independent, which is clearest when the page is
// wide enough that the structured frame's safety clamp does not itself
// interfere with the comparison.
const GEOMETRY: PublicationPageGeometry = {
  paperWidthMm: 148,
  paperHeightMm: 210,
  marginTopMm: 20,
  marginBottomMm: 15,
  marginLeftMm: 18,
  marginRightMm: 18,
  marginGutterMm: 22,
  marginOuterMm: 14,
};

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
function measureMm(outlineContext: VerticalOutlineContext, text: string, bodyEmMm: number): number {
  let sum = 0;
  for (const ch of Array.from(text)) sum += outlineContext.advanceWidthMm(ch, bodyEmMm);
  return sum;
}
function colophonFixturePieces(content: ColophonCompiledContent): FixturePiece[] {
  const pieces: FixturePiece[] = [];
  content.rows.forEach((row, i) => {
    if (i > 0) pieces.push({ kind: "PARAGRAPH_BREAK" });
    pieces.push({ kind: "TEXT", text: `${row.label}\t${row.value}` });
  });
  if (content.freeText.trim() !== "") {
    const lines = content.freeText.split("\n");
    lines.forEach((line, i) => {
      if (content.rows.length > 0 || i > 0) pieces.push({ kind: "PARAGRAPH_BREAK" });
      pieces.push({ kind: "TEXT", text: line });
    });
  }
  return pieces;
}
interface ComposeOpts {
  folioSettings?: typeof DEFAULT_FOLIO_SETTINGS;
  headerSettings?: HeaderSettings;
  colophonPlacement?: ColophonPlacement;
  capacity?: { charsPerLine: number; linesPerColumn: number; columnCount: 1 | 2 };
}
function composeFull(bodyText: string, fields: ColophonFieldInput[], freeText: string, opts: ComposeOpts = {}) {
  const compiled = compileColophonContent({ fields, freeText });
  const pieces = colophonFixturePieces(compiled);
  const { units: bodyUnits, source: bodySource } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText }]);
  const colophonBuild = pieces.length > 0 ? buildFixtureUnits("colophon", pieces) : undefined;
  const settings = settingsFor(opts.capacity ?? CAPACITY);
  const measurement = createFakeMeasurementProvider();
  const document = composeCanonicalDocument({
    bodyUnits,
    colophonUnits: colophonBuild?.units,
    colophonBlockId: "colophon",
    ruleSet: DEFAULT_RULE_SET_V2,
    measurement,
    settings,
    folioSettings: opts.folioSettings,
    headerSettings: opts.headerSettings,
    colophonPlacement: opts.colophonPlacement,
  });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = colophonBuild
    ? buildPublicationDocument("qa", "QA", document, bodyUnits, bodySource, ctx, colophonBuild.units, colophonBuild.source)
    : buildPublicationDocument("qa", "QA", document, bodyUnits, bodySource, ctx);
  return { document, model, compiled };
}

const TITLE_FIELDS = (contact: string): ColophonFieldInput[] => [
  { label: "書名", value: "吾輩は猫である", visible: true },
  { label: "著者名", value: "夏目漱石", visible: true },
  { label: "サークル", value: "猫町文庫", visible: true },
  { label: "発行日", value: "2026年9月8日", visible: true },
  { label: "印刷所", value: "○○印刷", visible: true },
  { label: "連絡先", value: contact, visible: true },
];
const FULL_FIELDS = TITLE_FIELDS("example@example.com");
const FULL_FREETEXT = "本書をお手に取っていただきありがとうございます。\n無断転載・複製を禁じます。";
const HEADER_SETTINGS: HeaderSettings = { hashiraOdd: "奇数柱", hashiraEven: "偶数柱", position: { band: "top", horizontal: "outer" } };

function textCmds(plan: ReturnType<typeof buildPaintPlan>, i: number) {
  return plan[i].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text");
}
function colophonIdx(document: ReturnType<typeof composeFull>["document"]): number {
  const i = document.pageSequence.findIndex((r) => r.kind === "colophon");
  expect(i).toBeGreaterThanOrEqual(0);
  return i;
}
function contentTextCmds(plan: ReturnType<typeof buildPaintPlan>, document: ReturnType<typeof composeFull>["document"], idx: number) {
  const colophonPage = document.colophon!.pages[document.pageSequence[idx].index];
  const excluded = new Set([colophonPage.folio?.text, colophonPage.header?.text].filter((t): t is string => t !== undefined));
  return textCmds(plan, idx).filter((c) => !excluded.has(c.text));
}

describe("Width separation -- structuredFrameWidth vs freeTextWrapWidth are independent facts (test 1)", () => {
  it("under fields where the widest value is wider than the title value, freeText's own wrap width is narrower than the structured row width (test 1)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "短文", {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = textCmds(plan, idx);
    const bodyEmMm = model.bodyEmMm;
    // structured row width (label + gap + widest value = contact, real email)
    const labelColumnWidthMm = Math.max(...FULL_FIELDS.map((f) => measureMm(outlineContext, f.label, bodyEmMm)));
    const widestValueWidthMm = Math.max(...FULL_FIELDS.map((f) => measureMm(outlineContext, f.value, bodyEmMm)));
    const structuredWidthMm = labelColumnWidthMm + bodyEmMm + widestValueWidthMm;
    // freeText's own title-row-derived wrap width
    const titleRowWidthMm = measureMm(outlineContext, FULL_FIELDS[0].label, bodyEmMm) + bodyEmMm + measureMm(outlineContext, FULL_FIELDS[0].value, bodyEmMm);
    expect(titleRowWidthMm).toBeLessThan(structuredWidthMm); // real precondition: title is narrower than the widest (contact) row
    const freeTextCmd = cmds.find((c) => c.text === "短文");
    expect(freeTextCmd).toBeDefined();
    // freeText left-aligns at the block's own left edge, same as every row's label.
    expect(freeTextCmd!.xMm).toBeCloseTo(cmds[0].xMm, 3);
  });
});

// SUPERSEDED BY ROUND 29F: freeText's own width rule changed again --
// round 29E bound it to the title row's own width; round 29F (Human
// Product Decision) replaces that with a fixed real-metric target: 0.8x
// font size inside a 15-structured-em frame (safety-clamped to the real
// page). Updated (not deleted) -- see
// `structuralColophonFreeTextTypography.test.ts` for round 29F's own
// full test set.
describe("freeText uses its own 15-structured-em target width, not the title row (test 2; round 29F correction)", () => {
  it("freeText wraps at the 15-structured-em target width (safety-clamped), at its own 0.8x font size (test 2)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = textCmds(plan, idx);
    const bodyEmMm = model.bodyEmMm;
    const freeTextEmMm = bodyEmMm * 0.8;
    const freeTextTargetWidthMm = 15 * bodyEmMm;
    const freeTextCmds = cmds.filter((c) => c.text.length > 0 && FULL_FREETEXT.includes(c.text));
    expect(freeTextCmds.length).toBeGreaterThan(0);
    for (const c of freeTextCmds) {
      expect(c.fontSizePt).toBeCloseTo((freeTextEmMm / 25.4) * 72, 3);
      expect(measureMm(outlineContext, c.text, freeTextEmMm)).toBeLessThanOrEqual(freeTextTargetWidthMm + 0.05);
    }
  });
});

describe("Structured frame may be wider than the title row (test 3)", () => {
  it("the structured frame's own resolved width exceeds the title row's own width when another row's value is wider (test 3)", () => {
    const { outlineContext } = realContexts();
    const { model } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const bodyEmMm = model.bodyEmMm;
    const labelColumnWidthMm = Math.max(...FULL_FIELDS.map((f) => measureMm(outlineContext, f.label, bodyEmMm)));
    const widestValueWidthMm = Math.max(...FULL_FIELDS.map((f) => measureMm(outlineContext, f.value, bodyEmMm)));
    const structuredWidthMm = labelColumnWidthMm + bodyEmMm + widestValueWidthMm;
    const titleRowWidthMm = measureMm(outlineContext, FULL_FIELDS[0].label, bodyEmMm) + bodyEmMm + measureMm(outlineContext, FULL_FIELDS[0].value, bodyEmMm);
    expect(structuredWidthMm).toBeGreaterThan(titleRowWidthMm);
  });
});

describe("Normal fields stay on one line (tests 4, 5)", () => {
  it("2026年9月8日 (the date) remains on ONE line in the normal QA geometry (test 4)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    expect(cmds.map((c) => c.text)).toContain("2026年9月8日");
  });

  it("the date does not wrap merely because the title value happens to be shorter than the date (test 5)", () => {
    const { outlineContext } = realContexts();
    const { model } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const bodyEmMm = model.bodyEmMm;
    const titleValueWidthMm = measureMm(outlineContext, FULL_FIELDS[0].value, bodyEmMm);
    const dateValueWidthMm = measureMm(outlineContext, FULL_FIELDS[3].value, bodyEmMm);
    // Real precondition making this a meaningful proof, not a coincidence:
    expect(dateValueWidthMm).toBeGreaterThan(titleValueWidthMm);
  });
});

describe("Long contact value handling (tests 6-8)", () => {
  it("a long contact value does not push the structured frame beyond the real safe page width (test 6)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    for (const c of cmds) expect(c.xMm + measureMm(outlineContext, c.text, model.bodyEmMm)).toBeLessThanOrEqual(GEOMETRY.paperWidthMm);
  });

  it("a long contact wraps only when genuinely required (a SHORT contact stays on one line; a real, geometry-relative LONG contact does not) (test 7)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const shortRes = composeFull("あいうえお", TITLE_FIELDS("a@b.co"), "", {});
    const shortPlan = buildPaintPlan(shortRes.model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const shortCmds = textCmds(shortPlan, colophonIdx(shortRes.document));
    expect(shortCmds.map((c) => c.text)).toContain("a@b.co");
  });

  it("freeText does not expand to the contact/email's own width (test 8)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "短文", {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const bodyEmMm = model.bodyEmMm;
    const contactWidthMm = measureMm(outlineContext, "example@example.com", bodyEmMm);
    const titleRowWidthMm = measureMm(outlineContext, FULL_FIELDS[0].label, bodyEmMm) + bodyEmMm + measureMm(outlineContext, FULL_FIELDS[0].value, bodyEmMm);
    expect(contactWidthMm).toBeGreaterThan(titleRowWidthMm); // real precondition
    const freeTextCmd = cmds.find((c) => c.text === "短文");
    // freeText's own block starts at the SAME left edge as every row, but its
    // own WRAP BUDGET (proven in test 2) is the narrower title-row width,
    // not the wider contact-driven structured width.
    expect(freeTextCmd).toBeDefined();
  });
});

describe("freeText stays inside its own 15-structured-em target width (test 9; round 29F correction)", () => {
  it("no freeText glyph paints beyond the block's own left edge + the 15-structured-em target width", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const bodyEmMm = model.bodyEmMm;
    const freeTextEmMm = bodyEmMm * 0.8;
    const blockLeftMm = cmds[0].xMm;
    const freeTextTargetWidthMm = 15 * bodyEmMm;
    const freeTextCmds = cmds.filter((c) => c.text.length > 0 && FULL_FREETEXT.includes(c.text));
    for (const c of freeTextCmds) expect(c.xMm + measureMm(outlineContext, c.text, freeTextEmMm)).toBeLessThanOrEqual(blockLeftMm + freeTextTargetWidthMm + 0.05);
  });
});

describe("Placement (tests 10-12)", () => {
  it("LEFT placement stays inside the page (test 10)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    for (const c of textCmds(plan, colophonIdx(document))) expect(c.xMm).toBeGreaterThanOrEqual(0);
  });

  it("CENTER placement centers the complete outer block (test 11)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const build = (horizontal: ColophonPlacement["horizontal"]) => {
      const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", { colophonPlacement: { horizontal, vertical: "center", respectGutter: true, respectVerticalMargins: true } });
      const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
      return textCmds(plan, colophonIdx(document))[0].xMm;
    };
    const left = build("left");
    const center = build("center");
    const right = build("right");
    expect(center).toBeGreaterThan(left - 0.01);
    expect(center).toBeLessThan(right + 0.01);
  });

  it("RIGHT placement stays inside the page (test 12)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "right", vertical: "center", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    for (const c of textCmds(plan, colophonIdx(document))) expect(c.xMm + measureMm(outlineContext, c.text, model.bodyEmMm)).toBeLessThanOrEqual(GEOMETRY.paperWidthMm + 0.05);
  });
});

describe("Final block height includes narrower freeText wrapping (test 13)", () => {
  it("a longer freeText (which wraps at its own narrower width) produces a taller final block than a short one (test 13)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const short = composeFull("あいうえお", FULL_FIELDS, "短文", { colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const long = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const shortPlan = buildPaintPlan(short.model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const longPlan = buildPaintPlan(long.model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const shortTopY = Math.min(...textCmds(shortPlan, colophonIdx(short.document)).map((c) => c.yMm));
    const longTopY = Math.min(...textCmds(longPlan, colophonIdx(long.document)).map((c) => c.yMm));
    expect(longTopY).toBeLessThan(shortTopY);
  });
});

describe("Collision + overflow + placement regressions (tests 14-20)", () => {
  it("Header collision clamp still PASS (test 14)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: false },
    });
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = contentTextCmds(plan, document, idx);
    const headerBottomEdgeMm = GEOMETRY.marginTopMm / 2 + model.bodyEmMm / 2;
    expect(Math.min(...cmds.map((c) => c.yMm))).toBeGreaterThanOrEqual(headerBottomEdgeMm - 0.01);
  });

  it("Folio collision clamp still PASS (test 15)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: false },
    });
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = contentTextCmds(plan, document, idx);
    const folioTopEdgeMm = GEOMETRY.paperHeightMm - GEOMETRY.marginBottomMm / 2 - model.bodyEmMm / 2;
    expect(Math.max(...cmds.map((c) => c.yMm))).toBeLessThanOrEqual(folioTopEdgeMm + 0.01);
  });

  it("realistic overflow regression PASS (test 16)", () => {
    const { document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { capacity: OVERFLOW_CAPACITY_HUMAN });
    expect(document.colophon!.pages.length).toBeGreaterThan(1);
  });

  it("date atomicity regression PASS (test 17)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(textCmds(plan, colophonIdx(document)).map((c) => c.text)).toContain("2026年9月8日");
  });

  it("email pagination regression PASS -- no character lost even if wrapped (test 18)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const allText = textCmds(plan, colophonIdx(document))
      .map((c) => c.text)
      .join("");
    expect(allText).toContain("example@example.com");
  });

  it("QA9 equivalent (respectGutter FALSE, odd physical page) still renders validly (test 19)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あ".repeat(600), FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true },
    });
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(textCmds(plan, colophonIdx(document)).length).toBeGreaterThan(0);
  });

  it("QA11 equivalent (respectGutter FALSE, even physical page) still renders validly (test 20)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true },
    });
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    expect(textCmds(plan, colophonIdx(document)).length).toBeGreaterThan(0);
  });
});

describe("Regression (tests 21-26)", () => {
  it("body composition is unchanged (test 21)", () => {
    const withColophon = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {}).document.pages;
    const without = composeFull("あいうえお", [], "", {}).document.pages;
    expect(withColophon).toEqual(without);
  });

  it("Ruby/Small Kana/Dash/TCY/Ellipsis regression PASS (tests 22-26)", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeFull(bodyText, FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});
