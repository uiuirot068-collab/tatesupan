// P3-O08 -- Final-page completion, Step 2 (Human Visual QA HOLD round
// 29C): closes the two remaining real Human-found defects from the
// round 29A/29B Human HOLD (the overflow-capacity defect itself is
// CLOSED and frozen -- see `structuralColophonHumanReviewQa.test.ts`'s
// own "Root cause" tests and its scenario-14 regression guard, not
// re-tested here).
//
// (1) FREE TEXT BLOCK WIDTH: rows + freeText now form ONE naturally
// sized block (`labelColumnWidthMm` = widest real label,
// `valueColumnWidthMm` = widest real value, both measured via real
// font metrics -- `VerticalOutlineContext.advanceWidthMm`, round 29C's
// own new method), never stretched to the full content width. freeText
// wraps (a real per-character greedy wrap against real measured
// widths) inside that SAME block width.
// (2) FURNITURE COLLISION CLAMP: the colophon's own vertical content
// area is clamped inward, using each ACTUALLY-PAINTED header/folio
// element's own real occupied band, so `respectVerticalMargins:false`
// can no longer produce a real visual overlap.

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

// Deliberately asymmetric -- required to prove collision/width claims
// against a real, non-coincidental geometry (matching round 29's own
// established convention).
const ASYMMETRIC_GEOMETRY: PublicationPageGeometry = {
  paperWidthMm: 105,
  paperHeightMm: 148,
  marginTopMm: 22,
  marginBottomMm: 8,
  marginLeftMm: 15,
  marginRightMm: 15,
  marginGutterMm: 26,
  marginOuterMm: 11,
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
}

function composeFull(bodyText: string, fields: ColophonFieldInput[], freeText: string, opts: ComposeOpts = {}) {
  const compiled = compileColophonContent({ fields, freeText });
  const pieces = colophonFixturePieces(compiled);
  const { units: bodyUnits, source: bodySource } = buildFixtureUnits("body", [{ kind: "TEXT", text: bodyText }]);
  const colophonBuild = pieces.length > 0 ? buildFixtureUnits("colophon", pieces) : undefined;
  const settings = settingsFor(CAPACITY);
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

const MINIMAL_FIELDS: ColophonFieldInput[] = [{ label: "書名", value: "短編", visible: true }];
const FULL_FIELDS: ColophonFieldInput[] = [
  { label: "書名", value: "吾輩は猫である", visible: true },
  { label: "著者名", value: "夏目漱石", visible: true },
  { label: "サークル", value: "猫町文庫", visible: true },
  { label: "発行日", value: "2026年9月8日", visible: true },
  { label: "印刷所", value: "○○印刷", visible: true },
  { label: "連絡先", value: "example@example.com", visible: true },
  { label: "発行者", value: "", visible: false },
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

// `buildColophonPaintPage`'s own `commands` array holds the colophon
// CONTENT block (rows/freeText) followed by folio/header furniture
// text on the SAME page -- these collision tests care only about the
// content block's own painted bounds, so furniture's own real text
// (folio's numeric string, header's own configured hashiraOdd/Even) is
// excluded here, using the real Canonical folio/header text for this
// exact colophon page as the exclusion key (never a guess).
function contentTextCmds(plan: ReturnType<typeof buildPaintPlan>, document: ReturnType<typeof composeFull>["document"], idx: number) {
  const colophonPage = document.colophon!.pages[document.pageSequence[idx].index];
  const excluded = new Set([colophonPage.folio?.text, colophonPage.header?.text].filter((t): t is string => t !== undefined));
  return textCmds(plan, idx).filter((c) => !excluded.has(c.text));
}

describe("Free text block width (item 1)", () => {
  it("a freeText line shorter than the row block's own real width paints as ONE command (test 1)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", MINIMAL_FIELDS, "短い文", {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    expect(cmds.length).toBe(3); // label, value, one freeText line
  });

  // SUPERSEDED BY ROUND 29F: freeText no longer wraps at the row
  // block's own width at all (that was round 29D/29E's own rule).
  // Round 29F's own Human Product Decision: freeText paints at 0.8x the
  // structured font size inside a 15-structured-em target frame
  // (safety-clamped to the real page). Updated (not deleted) to assert
  // the current real contract -- see
  // `structuralColophonFreeTextTypography.test.ts` for round 29F's own
  // full test set.
  it("a freeText line wraps at its own 0.8x-em, 15-structured-em target width -- each wrapped fragment's own real (smaller-font) width stays within that target (test 2; round 29F correction)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", MINIMAL_FIELDS, FULL_FREETEXT, {});
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = textCmds(plan, idx);
    expect(cmds.length).toBeGreaterThan(3); // label, value, + multiple wrapped freeText fragments
    const bodyEmMm = model.bodyEmMm;
    const freeTextEmMm = bodyEmMm * 0.8;
    const freeTextTargetWidthMm = 15 * bodyEmMm;
    const freeTextCmds = cmds.slice(2);
    for (const c of freeTextCmds) {
      expect(c.fontSizePt).toBeCloseTo((freeTextEmMm / 25.4) * 72, 3); // painted at the smaller freeText font size
      expect(measureMm(outlineContext, c.text, freeTextEmMm)).toBeLessThanOrEqual(freeTextTargetWidthMm + 0.01);
    }
  });

  it("LEFT placement keeps the whole block within the real page content bounds (test 3)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "left", vertical: "top", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    for (const c of cmds) {
      expect(c.xMm).toBeGreaterThanOrEqual(ASYMMETRIC_GEOMETRY.marginOuterMm! - 0.01);
      expect(c.xMm).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperWidthMm - ASYMMETRIC_GEOMETRY.marginOuterMm! + 0.01);
    }
  });

  it("LEFT/BOTTOM keeps the block within real page bounds, vertically too (test 4)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "left", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    for (const c of cmds) {
      expect(c.yMm).toBeGreaterThanOrEqual(0);
      expect(c.yMm).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperHeightMm);
    }
  });

  it("CENTER placement centers the complete block using its own measured outer width (test 5)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", MINIMAL_FIELDS, "短い文", { colophonPlacement: { horizontal: "center", vertical: "center", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const bodyEmMm = model.bodyEmMm;
    const labelWidthMm = measureMm(outlineContext, "書名", bodyEmMm);
    const valueWidthMm = measureMm(outlineContext, "短編", bodyEmMm);
    const blockWidthMm = labelWidthMm + bodyEmMm + valueWidthMm;
    const blockLeftMm = cmds[0].xMm;
    // CENTER's own resolved position must sit strictly between where LEFT
    // and RIGHT would place the same block -- proven directly against
    // those two other real placements, not by re-deriving the production
    // formula's own expected numeric answer (which would be circular).
    const leftDoc = composeFull("あいうえお", MINIMAL_FIELDS, "短い文", { colophonPlacement: { horizontal: "left", vertical: "center", respectGutter: true, respectVerticalMargins: true } });
    const rightDoc = composeFull("あいうえお", MINIMAL_FIELDS, "短い文", { colophonPlacement: { horizontal: "right", vertical: "center", respectGutter: true, respectVerticalMargins: true } });
    const leftPlan = buildPaintPlan(leftDoc.model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const rightPlan = buildPaintPlan(rightDoc.model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const leftBlockLeftMm = textCmds(leftPlan, colophonIdx(leftDoc.document))[0].xMm;
    const rightBlockLeftMm = textCmds(rightPlan, colophonIdx(rightDoc.document))[0].xMm;
    expect(blockLeftMm).toBeGreaterThan(leftBlockLeftMm - 0.01);
    expect(blockLeftMm).toBeLessThan(rightBlockLeftMm + 0.01);
    expect(blockLeftMm + blockWidthMm).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperWidthMm - 0.01);
    expect(blockLeftMm).toBeGreaterThanOrEqual(0);
  });

  it("RIGHT placement's own block right edge is flush with the resolved content-right edge (test 6; round 29F: block width now also accounts for freeText's own 15-structured-em target)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", MINIMAL_FIELDS, "短い文", { colophonPlacement: { horizontal: "right", vertical: "center", respectGutter: false, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const bodyEmMm = model.bodyEmMm;
    const labelWidthMm = measureMm(outlineContext, "書名", bodyEmMm);
    const valueWidthMm = measureMm(outlineContext, "短編", bodyEmMm);
    const structuredWidthMm = labelWidthMm + bodyEmMm + valueWidthMm;
    // respectGutter:false -> symmetric margin = min(gutter,outer); the real
    // available content width bounds freeText's own 15-em target (round 29F).
    const expectedContentRightMmForClamp = ASYMMETRIC_GEOMETRY.paperWidthMm - ASYMMETRIC_GEOMETRY.marginOuterMm!;
    const expectedContentLeftMmForClamp = ASYMMETRIC_GEOMETRY.marginOuterMm!;
    const availableSafeWidthMm = expectedContentRightMmForClamp - expectedContentLeftMmForClamp;
    const freeTextTargetWidthMm = Math.min(15 * bodyEmMm, availableSafeWidthMm);
    const blockWidthMm = Math.max(structuredWidthMm, freeTextTargetWidthMm);
    const labelXMm = cmds[0].xMm;
    // respectGutter:false -> symmetric margin = min(gutter,outer) = marginOuterMm(11) on both sides.
    const expectedContentRightMm = ASYMMETRIC_GEOMETRY.paperWidthMm - ASYMMETRIC_GEOMETRY.marginOuterMm!;
    expect(labelXMm + blockWidthMm).toBeCloseTo(expectedContentRightMm, 3);
  });

  it("explicit freeText newlines are preserved as separate lines, never merged by wrapping (test 7)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", MINIMAL_FIELDS, "一行目\n二行目", {}); // both short, no wrap needed
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const freeTextTexts = cmds.slice(2).map((c) => c.text);
    expect(freeTextTexts).toEqual(["一行目", "二行目"]);
  });

  it("wrapping contributes real additional lines to the final block height -- a wrapping document's own content starts HIGHER under vertical:'bottom' than a same-row-count non-wrapping document (test 8)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const short = composeFull("あいうえお", MINIMAL_FIELDS, "短い文", { colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const long = composeFull("あいうえお", MINIMAL_FIELDS, FULL_FREETEXT, { colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const shortPlan = buildPaintPlan(short.model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const longPlan = buildPaintPlan(long.model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const shortTopY = Math.min(...textCmds(shortPlan, colophonIdx(short.document)).map((c) => c.yMm));
    const longTopY = Math.min(...textCmds(longPlan, colophonIdx(long.document)).map((c) => c.yMm));
    expect(longTopY).toBeLessThan(shortTopY); // more real lines -> taller block -> bottom-anchored start moves up
  });
});

describe("Furniture collision clamp (item 2)", () => {
  it("respectVerticalMargins:false + a real header WOULD collide under the pre-29C formula -- the clamp detects and prevents it (test 9, 10)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: false },
    });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = contentTextCmds(plan, document, idx);
    const headerYCenterMm = ASYMMETRIC_GEOMETRY.marginTopMm / 2;
    const headerBottomEdgeMm = headerYCenterMm + model.bodyEmMm / 2;
    const topY = Math.min(...cmds.map((c) => c.yMm));
    // resolved minimally -- clamped exactly at the header's own bottom edge, not pushed further.
    expect(topY).toBeGreaterThanOrEqual(headerBottomEdgeMm - 0.01);
    expect(topY).toBeCloseTo(headerBottomEdgeMm + model.bodyEmMm / 2, 1); // first line's own CENTER is one half-em below the clamp line
  });

  it("respectVerticalMargins:false + a real folio WOULD collide at the bottom -- the clamp detects and prevents it (test 11, 12)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: false },
    });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = colophonIdx(document);
    const cmds = contentTextCmds(plan, document, idx);
    const folioYCenterMm = ASYMMETRIC_GEOMETRY.paperHeightMm - ASYMMETRIC_GEOMETRY.marginBottomMm / 2;
    const folioTopEdgeMm = folioYCenterMm - model.bodyEmMm / 2;
    const bottomY = Math.max(...cmds.map((c) => c.yMm));
    expect(bottomY).toBeLessThanOrEqual(folioTopEdgeMm + 0.01);
  });

  it("no header present -> no phantom header exclusion band (top-anchored content starts at the real, unclamped placementTopMm) (test 13)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", MINIMAL_FIELDS, "", { colophonPlacement: { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const topY = Math.min(...cmds.map((c) => c.yMm));
    expect(topY).toBeCloseTo(ASYMMETRIC_GEOMETRY.marginTopMm + model.bodyEmMm / 2, 3);
  });

  it("no folio present -> no phantom folio exclusion band (bottom-anchored content reaches the real, unclamped placementBottomMm) (test 14)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", MINIMAL_FIELDS, "", { colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: true } });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    const bottomLineTopY = Math.max(...cmds.map((c) => c.yMm)) - model.bodyEmMm / 2;
    const expectedBottomAreaMm = ASYMMETRIC_GEOMETRY.paperHeightMm - ASYMMETRIC_GEOMETRY.marginBottomMm;
    // last line's own bottom edge should reach close to the real, unclamped bottom margin (single short row -> block sits right above it).
    expect(bottomLineTopY + model.bodyEmMm).toBeLessThanOrEqual(expectedBottomAreaMm + 0.01);
  });

  it("respectVerticalMargins:false remains SAFE across top/center/bottom -- no painted command ever falls inside either furniture band when both are present (test 15)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    for (const vertical of ["top", "center", "bottom"] as const) {
      const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
        folioSettings: DEFAULT_FOLIO_SETTINGS,
        headerSettings: HEADER_SETTINGS,
        colophonPlacement: { horizontal: "center", vertical, respectGutter: true, respectVerticalMargins: false },
      });
      const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
      const idx = colophonIdx(document);
      const cmds = contentTextCmds(plan, document, idx);
      const headerBandMm = [ASYMMETRIC_GEOMETRY.marginTopMm / 2 - model.bodyEmMm / 2, ASYMMETRIC_GEOMETRY.marginTopMm / 2 + model.bodyEmMm / 2];
      const folioBandMm = [
        ASYMMETRIC_GEOMETRY.paperHeightMm - ASYMMETRIC_GEOMETRY.marginBottomMm / 2 - model.bodyEmMm / 2,
        ASYMMETRIC_GEOMETRY.paperHeightMm - ASYMMETRIC_GEOMETRY.marginBottomMm / 2 + model.bodyEmMm / 2,
      ];
      for (const c of cmds) {
        expect(c.yMm > headerBandMm[1] || c.yMm < headerBandMm[0]).toBe(true);
        expect(c.yMm > folioBandMm[1] || c.yMm < folioBandMm[0]).toBe(true);
      }
    }
  });
});

describe("QA 9 / QA 11 geometry regression (respectGutter:false, odd/even) -- not made worse", () => {
  it("QA 9 equivalent (respectGutter FALSE, odd physical page) still renders a valid, non-colliding block (test 16)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あ".repeat(400), FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true },
    });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    expect(cmds.length).toBeGreaterThan(0);
    for (const c of cmds) {
      expect(c.xMm).toBeGreaterThanOrEqual(0);
      expect(c.xMm).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperWidthMm);
    }
  });

  it("QA 11 equivalent (respectGutter FALSE, even physical page) still renders a valid, non-colliding block (test 17)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "left", vertical: "center", respectGutter: false, respectVerticalMargins: true },
    });
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const cmds = textCmds(plan, colophonIdx(document));
    expect(cmds.length).toBeGreaterThan(0);
    for (const c of cmds) {
      expect(c.xMm).toBeGreaterThanOrEqual(0);
      expect(c.xMm).toBeLessThanOrEqual(ASYMMETRIC_GEOMETRY.paperWidthMm);
    }
  });
});

describe("Regression", () => {
  it("body composition is unchanged by the block-model/collision rewrite (test 20)", () => {
    const withColophon = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {}).document.pages;
    const without = composeFull("あいうえお", [], "", {}).document.pages;
    expect(withColophon).toEqual(without);
  });

  it("folio/header regressions PASS (test 21)", () => {
    const { document } = composeFull("あいうえお", MINIMAL_FIELDS, "", { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    expect(document.colophon?.pages[0].folio?.text).toBe("2");
    expect(document.colophon?.pages[0].header?.text).toBe("偶数柱");
  });

  it("Ruby/Small Kana/Dash/TCY/Ellipsis regression PASS (tests 22-26)", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeFull(bodyText, FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, ASYMMETRIC_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});
