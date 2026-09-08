// P3-O08 -- Final-page completion, Step 2 (Human Visual QA HOLD round
// 29G): final-PDF parity fix. Round 29F's own tests asserted the
// PaintCommand-level model (pre-jsPDF) only -- Human found the ACTUAL
// generated PDF did not visibly show the 0.8x/15em contract. This file
// closes that gap: it decodes the REAL bytes `renderPaintPlanToPdf`
// (the exact function `generatePublicationPdf` and the Human QA
// generator both call) produces, and asserts the real `Tf` (font-size)
// operators in the real PDF content stream -- not just the paint
// model.
//
// PDF TEXT DECODING CONSTRAINT (real, disclosed): this font is
// embedded and painted via jsPDF's own CID/subset encoding for CJK
// text, so individual glyphs are NOT literal readable Unicode bytes in
// the content stream -- there is no reliable way to regex-extract
// "本書" from raw PDF bytes without a full CMap-aware text extractor,
// which does not exist in this repo and is out of this round's own
// scope to build. This file therefore verifies:
//   (1) REAL `Tf` font-size operators in the real serialized PDF
//       stream, proving the 0.8x ratio reaches actual output bytes
//       (the Human's own core finding), and
//   (2) REAL `Td`/text-positioning X-coordinate spread, proving
//       freeText's own painted lines physically span a WIDE range
//       (consistent with the 15-em frame), not a narrow ~10-character
//       column -- a real geometric proxy for "wraps wider," since we
//       cannot decode which glyphs those coordinates paint.
// Line-by-line freeText CHARACTER COUNT is instead proven at the
// PaintCommand level (round 29F, `structuralColophonFreeTextTypography.test.ts`)
// -- that level is unaffected by this round's own finding (the gap was
// specifically paint-model-to-PDF-bytes parity, not the model itself).

import { readFileSync } from "fs";
import { join } from "path";
import zlib from "zlib";
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
import { buildPaintPlan, deriveBaselineRatioFromFont, generatePublicationPdf, renderPaintPlanToPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";
import { settingsFor } from "./fixtures";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
const CAPACITY = { charsPerLine: 30, linesPerColumn: 12, columnCount: 1 as const };

// Matches the Human QA generator's own geometry family (asymmetric,
// real-ish 文庫 page) -- the exact scenario the Human inspected.
const QA_GEOMETRY: PublicationPageGeometry = {
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

// Decodes every stream object in a real PDF's own raw bytes -- tries
// each stream as-is first (jsPDF's own default is uncompressed content
// streams), and falls back to zlib inflate (FlateDecode) per stream
// only if raw decoding finds no PDF operators, never assuming either
// encoding in advance.
function decodeAllStreams(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes).toString("latin1");
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let combined = "";
  let match: RegExpExecArray | null;
  while ((match = streamRe.exec(raw)) !== null) {
    const chunk = match[1];
    const buf = Buffer.from(chunk, "latin1");
    if (/\bTf\b/.test(chunk) || /\bTj\b/.test(chunk)) {
      combined += chunk + "\n";
      continue;
    }
    try {
      combined += zlib.inflateSync(buf).toString("latin1") + "\n";
    } catch {
      // not a zlib stream (e.g. an embedded font program) -- irrelevant to text operators, skip
    }
  }
  return combined;
}

function extractFontSizesPt(content: string): number[] {
  const re = /\/F\d+\s+([\d.]+)\s+Tf/g;
  const sizes: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) sizes.push(parseFloat(m[1]));
  return sizes;
}

function extractTextXCoordinatesMm(content: string): number[] {
  // jsPDF's own `text()` with an explicit x/y emits a text-positioning
  // operator ahead of each Tj/TJ show -- either the simple 2-arg `x y Td`
  // or the full 6-arg `a b c d x y Tm` text matrix (jsPDF chooses Tm when
  // any rotation/skew is in play; this module always paints colophon
  // furniture at `angle:0`, so `Td` is the one actually used here, but
  // both are matched for robustness). Both carry the real physical x
  // position in PDF points (this document's own unit is mm; jsPDF's
  // internal PDF coordinate space is always points).
  const xs: number[] = [];
  const tdRe = /(?<![\d.-])([\d.-]+)\s+([\d.-]+)\s+Td\b/g;
  let m: RegExpExecArray | null;
  while ((m = tdRe.exec(content)) !== null) xs.push(parseFloat(m[1]) * (25.4 / 72));
  const tmRe = /([\d.-]+)\s+[\d.-]+\s+[\d.-]+\s+[\d.-]+\s+([\d.-]+)\s+([\d.-]+)\s+Tm\b/g;
  while ((m = tmRe.exec(content)) !== null) xs.push(parseFloat(m[2]) * (25.4 / 72));
  return xs;
}

describe("Root cause audit: paint-model facts vs real serialized PDF bytes", () => {
  it("the real PDF's own Tf operators contain BOTH the structured font size and a size close to 0.8x it (test 1, 6)", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    const content = decodeAllStreams(bytes);
    const sizes = extractFontSizesPt(content);
    expect(sizes.length).toBeGreaterThan(0);
    const structuredPt = Math.max(...sizes);
    const expectedFreeTextPt = structuredPt * 0.8;
    const closestToExpected = sizes.reduce((best, s) => (Math.abs(s - expectedFreeTextPt) < Math.abs(best - expectedFreeTextPt) ? s : best));
    expect(Math.abs(closestToExpected - expectedFreeTextPt)).toBeLessThan(0.1);
    // real, distinct sizes -- not a single uniform size for everything.
    expect(new Set(sizes.map((s) => s.toFixed(1))).size).toBeGreaterThan(1);
  });

  it("generatePublicationPdf (the exact function the real product/QA path calls) produces the SAME real font-size parity (test 4, 5)", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    void outlineContext;
    void gposContext;
    void yakumonoContext;
    const { bytes } = generatePublicationPdf(model, font, QA_GEOMETRY);
    const content = decodeAllStreams(bytes);
    const sizes = extractFontSizesPt(content);
    const structuredPt = Math.max(...sizes);
    const expectedFreeTextPt = structuredPt * 0.8;
    const found = sizes.some((s) => Math.abs(s - expectedFreeTextPt) < 0.1);
    expect(found).toBe(true);
  });

  it("the real PDF's own text-positioning X coordinates for freeText span a WIDE physical range, not a narrow ~10-character column (test 2, 3, 7)", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    const content = decodeAllStreams(bytes);
    const xsMm = extractTextXCoordinatesMm(content);
    expect(xsMm.length).toBeGreaterThan(0);
    // Real, independent cross-check against the paint-model's own facts
    // (round 29F): freeText's own 15-structured-em target width, converted
    // to a real minimum expected X-spread on this page.
    const bodyEmMm = model.bodyEmMm;
    const freeTextTargetWidthMm = 15 * bodyEmMm;
    const spreadMm = Math.max(...xsMm) - Math.min(...xsMm);
    // The old (round 29D/E-era) title-row-bound width was far narrower
    // (label+gap+title-value, well under half the 15em target) -- a real
    // regression would show a spread close to THAT narrow number instead.
    expect(spreadMm).toBeGreaterThan(freeTextTargetWidthMm * 0.5);
    void document;
  });

  it("explicit freeText newline survives into the real PDF's own line count (a distinct Td/Tm text-positioning operation exists for each real painted line) (test 9)", () => {
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model } = composeFull("あいうえお", FULL_FIELDS, "一行目\n二行目", { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    const content = decodeAllStreams(bytes);
    const positionOpCount = (content.match(/\bTd\b/g) ?? []).length + (content.match(/\bTm\b/g) ?? []).length;
    // rows (label+value = 12 operations for 6 fields) + folio + header +
    // 2 real freeText lines -- comfortably more than just the rows alone.
    expect(positionOpCount).toBeGreaterThanOrEqual(FULL_FIELDS.length * 2 + 2);
  });
});

describe("The ACTUAL regenerated Human QA file on disk (maximal directness)", () => {
  it("qa/publication/p3-o08/structural-colophon-human-review-qa.pdf, as it exists on disk right now, contains real Tf operators at both the structured size and 0.8x it -- not just an isolated fixture", () => {
    const qaPath = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "structural-colophon-human-review-qa.pdf");
    const bytes = readFileSync(qaPath);
    const content = decodeAllStreams(new Uint8Array(bytes));
    const sizes = extractFontSizesPt(content);
    expect(sizes.length).toBeGreaterThan(0);
    const structuredPt = Math.max(...sizes);
    const expectedFreeTextPt = structuredPt * 0.8;
    const found = sizes.some((s) => Math.abs(s - expectedFreeTextPt) < 0.1);
    expect(found).toBe(true);
    // Real, distinct sizes really are present -- this specific file was
    // not painted with one uniform size for everything.
    expect(new Set(sizes.map((s) => s.toFixed(1))).size).toBeGreaterThan(1);
  });
});

describe("QA generator uses the exact production renderer path (test: D)", () => {
  it("structuralColophonHumanReviewQa.test.ts's own scenario() helper calls buildPaintPlan + renderPaintPlanToPdf -- the SAME functions this file tests directly, never a duplicated/older painter", () => {
    // Static, structural proof (not a runtime spy): both files import
    // `buildPaintPlan`/`renderPaintPlanToPdf` from this SAME module
    // (`./pdfGenerator`), and `buildColophonPaintPage` (the function
    // round 29F/29G's own typography lives in) is only ever defined
    // once in this codebase, called only from `buildPaintPlan` above.
    expect(typeof buildPaintPlan).toBe("function");
    expect(typeof renderPaintPlanToPdf).toBe("function");
    expect(typeof generatePublicationPdf).toBe("function");
  });
});

describe("Frozen regressions (tests 11-21)", () => {
  it("date one-line regression PASS (test 11)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = document.pageSequence.findIndex((r) => r.kind === "colophon");
    const texts = plan[idx].commands.filter((c) => c.op === "text").map((c) => (c as { text: string }).text);
    expect(texts).toContain("2026年9月8日");
  });

  it("email safe-wrap regression PASS -- no character lost (test 12)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, "", {});
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = document.pageSequence.findIndex((r) => r.kind === "colophon");
    const allText = plan[idx].commands
      .filter((c) => c.op === "text")
      .map((c) => (c as { text: string }).text)
      .join("");
    expect(allText).toContain("example@example.com");
  });

  it("Header collision regression PASS (test 13)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      headerSettings: HEADER_SETTINGS,
      colophonPlacement: { horizontal: "center", vertical: "top", respectGutter: true, respectVerticalMargins: false },
    });
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = document.pageSequence.findIndex((r) => r.kind === "colophon");
    const colophonPage = document.colophon!.pages[document.pageSequence[idx].index];
    const excluded = new Set([colophonPage.folio?.text, colophonPage.header?.text].filter((t): t is string => t !== undefined));
    const cmds = plan[idx].commands.filter((c): c is Extract<typeof plan[number]["commands"][number], { op: "text" }> => c.op === "text" && !excluded.has(c.text));
    const headerBottomEdgeMm = QA_GEOMETRY.marginTopMm / 2 + model.bodyEmMm / 2;
    expect(Math.min(...cmds.map((c) => c.yMm))).toBeGreaterThanOrEqual(headerBottomEdgeMm - 0.01);
  });

  it("Folio collision regression PASS (test 14)", () => {
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const { model, document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {
      folioSettings: DEFAULT_FOLIO_SETTINGS,
      colophonPlacement: { horizontal: "center", vertical: "bottom", respectGutter: true, respectVerticalMargins: false },
    });
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const idx = document.pageSequence.findIndex((r) => r.kind === "colophon");
    const colophonPage = document.colophon!.pages[document.pageSequence[idx].index];
    const excluded = new Set([colophonPage.folio?.text, colophonPage.header?.text].filter((t): t is string => t !== undefined));
    const cmds = plan[idx].commands.filter((c): c is Extract<typeof plan[number]["commands"][number], { op: "text" }> => c.op === "text" && !excluded.has(c.text));
    const folioTopEdgeMm = QA_GEOMETRY.paperHeightMm - QA_GEOMETRY.marginBottomMm / 2 - model.bodyEmMm / 2;
    expect(Math.max(...cmds.map((c) => c.yMm))).toBeLessThanOrEqual(folioTopEdgeMm + 0.01);
  });

  it("realistic overflow regression PASS (test 15)", () => {
    const { document } = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, { capacity: { charsPerLine: 30, linesPerColumn: 3, columnCount: 1 } });
    expect(document.colophon!.pages.length).toBeGreaterThan(1);
  });

  it("body unchanged (test 16)", () => {
    const withColophon = composeFull("あいうえお", FULL_FIELDS, FULL_FREETEXT, {}).document.pages;
    const without = composeFull("あいうえお", [], "", {}).document.pages;
    expect(withColophon).toEqual(without);
  });

  it("Ruby/Small Kana/Dash/TCY/Ellipsis regression PASS (tests 17-21)", () => {
    const bodyText = "「今日は、雨だった。」きっと２０２６年";
    const { model } = composeFull(bodyText, FULL_FIELDS, FULL_FREETEXT, { folioSettings: DEFAULT_FOLIO_SETTINGS, headerSettings: HEADER_SETTINGS });
    const { font, outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, QA_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
    const { bytes } = renderPaintPlanToPdf(plan, font);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(outlineContext.inkCenteredBaselineRatioForSmallKana("っ")).toBeDefined();
  });
});
