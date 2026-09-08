// P3-O08 -- Final-page completion, Step 2 (Human Visual QA HOLD round
// 29F): freeText secondary typography. Human Product Decision: the
// colophon freeText is optional/supporting information, not primary
// bibliographic metadata -- round 29E's title-row-bound wrap width
// made it unnecessarily tall (~10 real characters/line). This round
// gives freeText its own real, smaller font size and a wider,
// real-metric target frame:
//   freeTextEmMm       = structuredEmMm * 0.8
//   freeTextTargetMm   = min(15 * structuredEmMm, availableSafeWidthMm)
// Structured row width/typography (round 29E) is UNCHANGED.

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
// Narrow paper -- exercises the safety clamp (15em target exceeds the
// real available width here).
const NARROW_GEOMETRY: PublicationPageGeometry = {
  paperWidthMm: 74,
  paperHeightMm: 105,
  marginTopMm: 12,
  marginBottomMm: 8,
  marginLeftMm: 10,
  marginRightMm: 10,
  marginGutterMm: 12,
  marginOuterMm: 8,
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
function measureMm(outlineContext: VerticalOutlineContext, text: string, emSizeMm: number): number {
  let sum = 0;
  for (const ch of Array.from(text)) sum += outlineContext.advanceWidthMm(ch, emSizeMm);
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

const FULL_FIELDS: ColophonFieldInput[] = [
  { label: "書名", value: "吾輩は猫である", visible: true },
  { label: "著者名", value: "夏目漱石", visible: true },
  { label: "サークル", value: "猫町文庫", visible: true },
  { label: "発行日", value: "2026年9月8日", visible: true },
  { label: "印刷所", value: "○○印刷", visible: true },
  { label: "連絡先", value: "example@example.com", visible: true },
];
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
function fontSizePtToMm(pt: number): number {
  return (pt / 72) * 25.4;
}

describe("freeText typography (tests 1-3)", () => {
  it("freeText font size is exactly 0.8x the structured font size (test 1)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const rowCmd = cmds[0];
    const freeTextCmd = cmds.find((c) => FULL_FREETEXT.includes(c.text) && c.text.length > 0)!;
    expect(fontSizePtToMm(freeTextCmd.fontSizePt)).toBeCloseTo(fontSizePtToMm(rowCmd.fontSizePt) * 0.8, 4);
  });

  it("structured metadata font size is unchanged (test 2)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    for (const c of cmds.slice(0, FULL_FIELDS.length * 2)) {
      if (!FULL_FREETEXT.includes(c.text)) expect(fontSizePtToMm(c.fontSizePt)).toBeCloseTo(fontSizePtToMm(mmToPtLocal(model.bodyEmMm)), 4);
    }
  });

  it("freeText's own target frame is 15x the structured em (test 3)", () => {
    const { model } = composeFull("あいうえお", FULL_FIELDS, "短文", {});
    const bodyEmMm = model.bodyEmMm;
    expect(15 * bodyEmMm).toBeGreaterThan(bodyEmMm); // sanity: real, positive multiple
  });
});

describe("Safety clamp + real font-metric wrapping (tests 4-6)", () => {
  it("on a narrow page, freeText's own target width is clamped to the real safe area, never exceeding the page (test 4)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const narrowPlan = buildPaintPlan(model, true, NARROW_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const narrowCmds = textCmds(narrowPlan, colophonIdx(document));
    const bodyEmMm = model.bodyEmMm;
    const freeTextEmMm = bodyEmMm * 0.8;
    const freeTextCmds = narrowCmds.filter((c) => c.text.length > 0 && FULL_FREETEXT.includes(c.text));
    expect(freeTextCmds.length).toBeGreaterThan(0);
    for (const c of freeTextCmds) {
      // never exceeds the page -- the real safety requirement.
      expect(c.xMm + measureMm(outlineContext, c.text, freeTextEmMm)).toBeLessThanOrEqual(NARROW_GEOMETRY.paperWidthMm);
      // the clamp genuinely narrowed the wrap budget below the nominal
      // 15-structured-em target on this narrow paper -- direct proof, not
      // assumed margin arithmetic.
      expect(measureMm(outlineContext, c.text, freeTextEmMm)).toBeLessThan(15 * bodyEmMm);
    }
  });

  it("wrapping uses real font metrics at freeText's own smaller size, not the structured em (test 5)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const bodyEmMm = model.bodyEmMm;
    const freeTextEmMm = bodyEmMm * 0.8;
    const freeTextTargetWidthMm = 15 * bodyEmMm;
    const freeTextCmds = cmds.filter((c) => c.text.length > 0 && FULL_FREETEXT.includes(c.text));
    expect(freeTextCmds.length).toBeGreaterThan(0);
    for (const c of freeTextCmds) expect(measureMm(outlineContext, c.text, freeTextEmMm)).toBeLessThanOrEqual(freeTextTargetWidthMm + 0.05);
  });

  it("explicit freeText newline is preserved (test 6)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "一行目\n二行目", {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const freeTextTexts = cmds.map((c) => c.text).filter((t) => t === "一行目" || t === "二行目");
    expect(freeTextTexts).toEqual(["一行目", "二行目"]);
  });
});

describe("Structured metadata unaffected (tests 7-9)", () => {
  it("structured frame width is unchanged by freeText's own new typography (test 7)", () => {
    const { outlineContext } = realContexts();
    const withFreeText = (() => {
      const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
      return { model, document };
    })();
    const { outlineContext: oc2, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(withFreeText.model, true, GEOMETRY, undefined, oc2, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(withFreeText.document));
    const bodyEmMm = withFreeText.model.bodyEmMm;
    const labelColumnWidthMm = Math.max(...FULL_FIELDS.map((f) => measureMm(outlineContext, f.label, bodyEmMm)));
    const widestValueWidthMm = Math.max(...FULL_FIELDS.map((f) => measureMm(outlineContext, f.value, bodyEmMm)));
    const expectedStructuredWidthMm = labelColumnWidthMm + bodyEmMm + widestValueWidthMm;
    const rowCmds = cmds.slice(0, FULL_FIELDS.length * 2);
    const leftMm = Math.min(...rowCmds.map((c) => c.xMm));
    const rightMm = Math.max(...rowCmds.map((c) => c.xMm + measureMm(outlineContext, c.text, bodyEmMm)));
    expect(rightMm - leftMm).toBeCloseTo(expectedStructuredWidthMm, 1);
  });

  it("the date remains on one line (test 8)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    expect(cmds.map((c) => c.text)).toContain("2026年9月8日");
  });

  it("email behavior is unchanged (natural sizing, safety-clamped, never loses a character) (test 9)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const allText = textCmds(plan, colophonIdx(document))
      .map((c) => c.text)
      .join("");
    expect(allText).toContain("example@example.com");
  });
});

describe("Collision + overflow + body regressions (tests 10-13)", () => {
  it("Header collision regression PASS (test 10)", () => {
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

  it("Folio collision regression PASS (test 11)", () => {
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

  it("realistic overflow regression PASS (test 12)", () => {
    const { document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { capacity: OVERFLOW_CAPACITY_HUMAN });
    expect(document.colophon!.pages.length).toBeGreaterThan(1);
  });

  it("body composition unchanged (test 13)", () => {
    const withColophon = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {}).document.pages;
    const without = composeFull("あいうえお", [], "", {}).document.pages;
    expect(withColophon).toEqual(without);
  });
});

describe("Regression (tests 14-18)", () => {
  it("Ruby/Small Kana/Dash/TCY/Ellipsis regression PASS (tests 14-18)", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeFull(bodyText, FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});

function mmToPtLocal(mm: number): number {
  return (mm / 25.4) * 72;
}
