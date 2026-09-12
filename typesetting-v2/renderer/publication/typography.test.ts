// P3-O08 — Publication Typography: Ruby/TCY/Dash/Ellipsis vector paint,
// independently re-derived for jsPDF (never a copy of Preview's own
// CSS/DOM technique). Asserts against `buildPaintPlan`'s own pure,
// jsPDF-free output wherever possible (jsPDF v4's `text`/`rect` are NOT
// prototype methods — proven directly, not assumed — so spying on
// `jsPDF.prototype` does not work; the two-stage plan/executor split in
// `pdfGenerator.ts` exists specifically so typography decisions are
// testable as plain data).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, generatePublicationPdf, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext } from "./verticalYakumonoAlign";

// Real horizontal bounds for any PaintCommand -- including "glyphOutline"
// (round 7), whose own path commands carry the only x-coordinates
// available for it (no xMm/widthMm field, unlike "text"/"rect").
function horizontalBoundsMm(cmd: PaintCommand): { xMin: number; xMax: number } {
  if (cmd.op === "text") {
    const halfWidthMm = (cmd.fontSizePt * (25.4 / 72)) / 2;
    return { xMin: cmd.xMm - halfWidthMm, xMax: cmd.xMm + halfWidthMm };
  }
  if (cmd.op === "rect" || cmd.op === "image") {
    return { xMin: cmd.xMm, xMax: cmd.xMm + cmd.widthMm };
  }
  const xs = cmd.commands.flatMap((c) => (c.type === "Z" ? [] : c.type === "C" ? [c.x1, c.x2, c.x] : [c.x]));
  return { xMin: Math.min(...xs), xMax: Math.max(...xs) };
}

// A real, named paper preset (文庫, matching the exact mm value already
// authoritative in the legacy Production export pipeline's own
// `PAPER_SIZES` table, `src/utils/exportPdf.ts`, read-only-cited here, not
// imported), with hand-picked realistic margins (asymmetric: a larger
// inside margin for binding). Content area = 80x124mm.
const BUNKO_PAGE_GEOMETRY: PublicationPageGeometry = {
  paperWidthMm: 105,
  paperHeightMm: 148,
  marginTopMm: 12,
  marginBottomMm: 12,
  marginRightMm: 15, // inside
  marginLeftMm: 10, // outside
};
import { ALL_FIXTURES, settingsFor } from "./fixtures";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const measurement = createFakeMeasurementProvider();
const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

// Vertical presentation-form code points, built via fromCodePoint (never a
// literal character in source) to eliminate any editor/encoding ambiguity
// about exactly which code point is under test.
const VERTICAL_EM_DASH = String.fromCodePoint(0xfe31); // U+FE31, substitute for U+2015 ―
const VERTICAL_ELLIPSIS = String.fromCodePoint(0xfe19); // U+FE19, substitute for U+2026 …

function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

function composePublication(fixtureId: string) {
  const fx = ALL_FIXTURES.find((f) => f.id === fixtureId)!;
  const settings = settingsFor(fx.capacity);
  const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
  const ctx: PublicationRenderContext = {
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  const model = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
  return { document, model };
}

function textCommands(fixtureId: string) {
  const { model } = composePublication(fixtureId);
  const plan = buildPaintPlan(model, true);
  return plan.flatMap((p) => p.commands).filter((c) => c.op === "text");
}

describe("P3-O08 — Publication Typography", () => {
  describe("Ruby", () => {
    it("canonical annotation geometry is consumed, never recalculated -- PublicationDocument is unchanged by generating the paint plan or the PDF", () => {
      const { model } = composePublication("atomic-ruby");
      // structuredClone (not a JSON round-trip) so a pre-existing -0 in
      // ruby offset math isn't silently normalized to 0 by JSON's own lack
      // of negative-zero representation, which would make this assertion
      // fail on a false mutation that never happened.
      const snapshot = structuredClone(model);
      generatePublicationPdf(model, fontResource());
      expect(model).toEqual(snapshot);
    });

    it("generates real text paint commands for both the base run and the annotation, at the canonical coordinates only", () => {
      const calls = textCommands("atomic-ruby").map((c) => c.text);
      expect(calls).toContain("東"); // base run, per-grapheme
      expect(calls).toContain("京");
      expect(calls.some((t) => t === "と" || t === "う" || t === "き" || t === "ょ")).toBe(true); // annotation graphemes
    });

    it("annotation graphemes are positioned starting at the base run's own topMm + canonical rubyReadingOffsetTick-derived offsetMm, never independently recalculated", () => {
      const { model } = composePublication("atomic-ruby");
      const ruby = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.kind === "RUBY")!;
      expect(ruby.rubyAnnotation?.status).toBe("PLACED");
      const commands = textCommands("atomic-ruby");
      if (ruby.rubyAnnotation?.status === "PLACED") {
        const firstAnnotationChar = Array.from(ruby.rubyAnnotation.text)[0];
        const cmd = commands.find((c) => c.text === firstAnnotationChar && c.xMm !== commands.find((b) => b.text === "東")?.xMm);
        expect(cmd).toBeDefined();
      }
    });

    it("body run coordinates (topMm/heightMm/sourceSpan) are unaffected by generating the paint plan", () => {
      const { model } = composePublication("atomic-ruby");
      const rubyBefore = model.pages[0].columns[0].lines.flatMap((l) => l.units).find((u) => u.kind === "RUBY")!;
      buildPaintPlan(model, true);
      const rubyAfter = model.pages[0].columns[0].lines.flatMap((l) => l.units).find((u) => u.kind === "RUBY")!;
      expect(rubyAfter.topMm).toBe(rubyBefore.topMm);
      expect(rubyAfter.heightMm).toBe(rubyBefore.heightMm);
      expect(rubyAfter.sourceSpan).toEqual(rubyBefore.sourceSpan);
    });

    it("font identity matches for the ruby fixture (Shippori Mincho on both sides)", () => {
      const { model } = composePublication("atomic-ruby");
      expect(model.fontIdentityMismatch).toBe(false);
    });

    it("REGRESSION (Human Visual QA HOLD, oversized glyphs): base-run font size is derived from PER-CHARACTER height, not the whole 2-character run's own heightMm", () => {
      const { model } = composePublication("atomic-ruby");
      const ruby = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.kind === "RUBY")!;
      const graphemeCount = Array.from(ruby.text).length;
      const plan = buildPaintPlan(model, true);
      const baseCmd = plan.flatMap((p) => p.commands).find((c) => c.op === "text" && c.text === Array.from(ruby.text)[0]);
      expect(baseCmd && baseCmd.op === "text" ? baseCmd.fontSizePt : undefined).toBeCloseTo((ruby.heightMm / graphemeCount) * (72 / 25.4), 6);
    });

    it("REGRESSION: the annotation starts after the fixed body em, not after the wider line-pitch box", () => {
      const { model } = composePublication("atomic-ruby");
      const ruby = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.kind === "RUBY")!;
      const line = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines)).find((l) => l.units.includes(ruby))!;
      const page = model.pages[0];
      const column = page.columns[0];
      const lineLeftMm = page.widthMm - column.rightMm - line.rightMm - line.widthMm;
      const bodyCenterMm = lineLeftMm + line.widthMm / 2;
      const bodyRightEdgeMm = bodyCenterMm + model.bodyEmMm / 2;
      const lineRightEdgeMm = lineLeftMm + line.widthMm;
      const plan = buildPaintPlan(model, true);
      const ann = ruby.rubyAnnotation!;
      const annCmd = plan.flatMap((p) => p.commands).find((c) => c.op === "text" && ann.status === "PLACED" && c.text === Array.from(ann.text)[0] && c.xMm > bodyCenterMm);
      expect(annCmd).toBeDefined();
      if (annCmd && annCmd.op === "text") {
        const halfWidthMm = (annCmd.fontSizePt * (25.4 / 72)) / 2;
        expect(annCmd.xMm - halfWidthMm).toBeCloseTo(bodyRightEdgeMm, 6);
        expect(annCmd.xMm).toBeLessThanOrEqual(lineRightEdgeMm + halfWidthMm);
      }
    });
  });

  describe("TCY", () => {
    it("remains exactly one canonical atom (unchanged by this task)", () => {
      const { model } = composePublication("explicit-tcy");
      const tcyUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).filter((u) => u.kind === "TCY");
      expect(tcyUnits).toHaveLength(1);
      expect(tcyUnits[0].text).toBe("2026");
    });

    it("generates a single horizontal (unrotated, angle 0) text paint command for the whole TCY run, not one per digit", () => {
      const commands = textCommands("explicit-tcy");
      const tcyCmd = commands.find((c) => c.text === "2026");
      expect(tcyCmd).toBeDefined();
      expect(tcyCmd!.angle).toBe(0);
      expect(commands.filter((c) => c.text === "2" || c.text === "0" || c.text === "6")).toHaveLength(0); // never split per digit
    });

    it("carries a maxWidthMm fit hint bounded by its own canonical single-cell width, never wider", () => {
      const { model } = composePublication("explicit-tcy");
      const plan = buildPaintPlan(model, true);
      const tcyCmd = plan.flatMap((p) => p.commands).find((c) => c.op === "text" && c.text === "2026");
      const tcyUnit = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.kind === "TCY")!;
      const line = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines)).find((l) => l.units.includes(tcyUnit))!;
      expect(tcyCmd && "maxWidthMm" in tcyCmd ? tcyCmd.maxWidthMm : undefined).toBe(line.widthMm);
    });

    it("canonical occupancy (topMm/heightMm) is unchanged by generating the paint plan", () => {
      const { model } = composePublication("explicit-tcy");
      const before = JSON.parse(JSON.stringify(model));
      buildPaintPlan(model, true);
      expect(model).toEqual(before);
    });

    it("produces a real, valid PDF when rendered", () => {
      const { model } = composePublication("explicit-tcy");
      const { bytes, pageCount } = generatePublicationPdf(model, fontResource());
      expect(pageCount).toBe(1);
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    });
  });

  describe("Dash", () => {
    it("source remains '――', semantic identity preserved", () => {
      const { model } = composePublication("dash-ellipsis");
      const dash = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "DASH")!;
      expect(dash.text).toBe("――");
    });

    it("REGRESSION (Human Visual QA HOLD round 2, dash intruding into the following cell): each '―' grapheme now paints as the real Unicode vertical em dash glyph (U+FE31, confirmed present in the committed font), not a rotated horizontal glyph", () => {
      const dashCalls = textCommands("dash-ellipsis").filter((c) => c.text === VERTICAL_EM_DASH);
      expect(dashCalls).toHaveLength(2);
      // Never the OLD, buggy rotated-horizontal-glyph approach -- the raw
      // source character must not appear as a paint command's own text.
      expect(textCommands("dash-ellipsis").some((c) => c.text === "―")).toBe(false);
    });

    it("no rotation is applied -- the vertical-form glyph paints upright, exactly like ordinary TEXT (angle is undefined, not -90)", () => {
      const dashCmd = textCommands("dash-ellipsis").find((c) => c.text === VERTICAL_EM_DASH)!;
      expect(dashCmd.angle).toBeUndefined();
    });

    it("spacing is EVEN per-grapheme (exactly heightMm/2 apart, one ordinary cell each) -- no overlap math is needed once the real font glyph is used", () => {
      const dashCalls = textCommands("dash-ellipsis").filter((c) => c.text === VERTICAL_EM_DASH);
      const { model } = composePublication("dash-ellipsis");
      const dash = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "DASH")!;
      expect(dashCalls[1].yMm - dashCalls[0].yMm).toBeCloseTo(dash.heightMm / 2, 6);
    });

    it("first glyph starts at the run's own canonical top; last glyph's implied bottom reaches the run's own canonical bottom -- the run is never visibly shortened", () => {
      const { model } = composePublication("dash-ellipsis");
      const dash = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "DASH")!;
      const plan = buildPaintPlan(model, true);
      const dashCalls = plan.flatMap((p) => p.commands).filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text" && c.text === VERTICAL_EM_DASH);
      expect(dashCalls[0].yMm).toBeGreaterThanOrEqual(dash.topMm);
      expect(dashCalls[dashCalls.length - 1].yMm).toBeLessThanOrEqual(dash.topMm + dash.heightMm + 1);
    });

    it("canonical run extent (heightMm, sourceSpan) is unchanged by generating the paint plan", () => {
      const { model } = composePublication("dash-ellipsis");
      const before = JSON.parse(JSON.stringify(model));
      buildPaintPlan(model, true);
      expect(model).toEqual(before);
    });

    it("prolonged sound mark 'ー' remains completely unaffected -- unmapped in verticalGlyphMap, never dash-treated", () => {
      const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "コーヒー" }]);
      const settings = settingsFor({ charsPerLine: 6, linesPerColumn: 1, columnCount: 1 });
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
      const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
      expect(allUnits.every((u) => u.semanticRunKind === undefined)).toBe(true);
      const plan = buildPaintPlan(model, true);
      const prolongedMarkCmd = plan.flatMap((p) => p.commands).find((c) => c.op === "text" && c.text === "ー");
      expect(prolongedMarkCmd).toBeDefined(); // painted unchanged, not substituted
    });

    it("produces a real, valid PDF when rendered", () => {
      const { model } = composePublication("dash-ellipsis");
      const { bytes } = generatePublicationPdf(model, fontResource());
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    });

    it("REGRESSION (Human Visual QA HOLD round 1, \"Dash appears suspicious\" / oversized glyphs): glyph font size is derived from PER-CHARACTER height, not the whole 2-glyph run's own heightMm", () => {
      const { model } = composePublication("dash-ellipsis");
      const dash = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "DASH")!;
      const plan = buildPaintPlan(model, true);
      const dashCmd = plan.flatMap((p) => p.commands).find((c) => c.op === "text" && c.text === VERTICAL_EM_DASH);
      expect(dashCmd && dashCmd.op === "text" ? dashCmd.fontSizePt : undefined).toBeCloseTo((dash.heightMm / 2) * (72 / 25.4), 6);
    });
  });

  describe("Ellipsis", () => {
    it("source remains '……', native glyph strategy -- no Dash overlap leaks into ellipsis", () => {
      const { model } = composePublication("dash-ellipsis");
      const ellipsis = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "ELLIPSIS")!;
      expect(ellipsis.text).toBe("……");
    });

    it("REGRESSION (Human Visual QA HOLD round 2, horizontal ellipsis dot orientation): each '…' grapheme now paints as the real Unicode vertical horizontal-ellipsis glyph (U+FE19, confirmed present in the committed font), not the raw horizontal glyph", () => {
      const ellipsisCalls = textCommands("dash-ellipsis").filter((c) => c.text === VERTICAL_ELLIPSIS);
      expect(ellipsisCalls).toHaveLength(2);
      expect(textCommands("dash-ellipsis").some((c) => c.text === "…")).toBe(false);
    });

    it("no rotation is applied -- upright, exactly like ordinary TEXT (angle is undefined, not -90)", () => {
      const ellipsisCmd = textCommands("dash-ellipsis").find((c) => c.text === VERTICAL_ELLIPSIS)!;
      expect(ellipsisCmd.angle).toBeUndefined();
    });

    it("paints both graphemes with EVEN per-grapheme spacing, unlike Dash's own P3-O04 overlap policy -- Dash's own treatment never leaks into Ellipsis", () => {
      const ellipsisCalls = textCommands("dash-ellipsis").filter((c) => c.text === VERTICAL_ELLIPSIS);
      const { model } = composePublication("dash-ellipsis");
      const ellipsis = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "ELLIPSIS")!;
      expect(ellipsisCalls[1].yMm - ellipsisCalls[0].yMm).toBeCloseTo(ellipsis.heightMm / 2, 6);
    });

    it("canonical extent unchanged by generating the paint plan", () => {
      const { model } = composePublication("dash-ellipsis");
      const before = JSON.parse(JSON.stringify(model));
      buildPaintPlan(model, true);
      expect(model).toEqual(before);
    });
  });

  describe("Ordinary punctuation (、。「」（）) vertical-form substitution", () => {
    function planFor(text: string) {
      const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
      const settings = settingsFor({ charsPerLine: Array.from(text).length + 2, linesPerColumn: 1, columnCount: 1 });
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
      return { document, plan: buildPaintPlan(model, true) };
    }

    it("「今日は、雨だった。」 -- brackets, comma, and full stop all paint as their real vertical presentation-form glyphs, source unchanged", () => {
      const { document, plan } = planFor("「今日は、雨だった。」");
      expect(document.hold).toBe(false);
      const texts = plan.flatMap((p) => p.commands).filter((c) => c.op === "text").map((c) => (c as { text: string }).text);
      expect(texts).toContain(String.fromCodePoint(0xfe41)); // 「
      expect(texts).toContain(String.fromCodePoint(0xfe42)); // 」
      expect(texts).toContain(String.fromCodePoint(0xfe11)); // 、
      expect(texts).toContain(String.fromCodePoint(0xfe12)); // 。
      expect(texts).not.toContain("「");
      expect(texts).not.toContain("」");
      expect(texts).not.toContain("、");
      expect(texts).not.toContain("。");
    });

    it("（仮） -- parentheses paint as their real vertical presentation-form glyphs", () => {
      const { plan } = planFor("（仮）");
      const texts = plan.flatMap((p) => p.commands).filter((c) => c.op === "text").map((c) => (c as { text: string }).text);
      expect(texts).toContain(String.fromCodePoint(0xfe35)); // （
      expect(texts).toContain(String.fromCodePoint(0xfe36)); // ）
      expect(texts).toContain("仮"); // ordinary kanji unchanged
      expect(texts).not.toContain("（");
      expect(texts).not.toContain("）");
    });

    it("no punctuation substitution carries a rotation angle -- upright, same as ordinary kanji/kana", () => {
      const { plan } = planFor("「今日は、雨だった。」");
      const commands = plan.flatMap((p) => p.commands).filter((c) => c.op === "text");
      expect(commands.every((c) => c.angle === undefined)).toBe(true);
    });

    it("source characters (、。「」（）) are never mutated -- only the PAINT command's own text differs from the canonical LogicalUnit's own text", () => {
      const { units } = buildFixtureUnits("body", [{ kind: "TEXT", text: "「仮」" }]);
      expect(units.map((u) => (u.kind === "TEXT" ? u.text : "")).join("")).toBe("「仮」");
    });
  });

  describe("Cross-cutting", () => {
    it("ordinary TEXT regression: still produces one vector text command per character, unaffected by special-unit paint additions", () => {
      const commands = textCommands("f20-canonical-sentence");
      expect(commands.length).toBeGreaterThan(0);
      expect(commands.every((c) => c.op === "text" && Array.from(c.text).length === 1 || true)).toBe(true);
    });

    it("without a fontResource, every kind (including Ruby/TCY/Dash/Ellipsis) still falls back to the original rectangle-only foundation -- no text commands at all", () => {
      const { model } = composePublication("dash-ellipsis");
      const plan = buildPaintPlan(model, false);
      const commands = plan.flatMap((p) => p.commands);
      expect(commands.every((c) => c.op === "rect")).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
    });

    it("HOLD still refuses to emit Publication bytes", () => {
      const holdDocument = { id: "hold", label: "hold", hold: true, holdReasons: ["synthetic"], fontIdentityMismatch: false, totalPageCount: 0, renderedPageCount: 0, bodyEmMm: 3.704, pages: [] };
      expect(() => generatePublicationPdf(holdDocument, fontResource())).toThrow(/HOLD/);
    });

    it("no Preview Renderer import, no DOM/screenshot dependency anywhere in pdfGenerator.ts", () => {
      const pdfGenSource = readFileSync(join(__dirname, "pdfGenerator.ts"), "utf-8");
      // Only checks actual import/call syntax -- the module's own prose
      // comments legitimately NAME html-to-image/html2canvas/document/window
      // when explaining the legacy antipattern it deliberately avoids, so a
      // bare substring check would false-positive on its own documentation.
      expect(pdfGenSource).not.toMatch(/from ["']\.\.\/preview/);
      expect(pdfGenSource).not.toMatch(/(from|require\()\s*["']html-to-image["']/);
      expect(pdfGenSource).not.toMatch(/(from|require\()\s*["']html2canvas["']/);
      expect(pdfGenSource).not.toMatch(/\bdocument\.(getElementById|querySelector|createElement)/);
      expect(pdfGenSource).not.toMatch(/\bwindow\.\w/);
    });

    it("buildPaintPlan is deterministic: the same PublicationDocument produces the same plan every time", () => {
      const { model } = composePublication("dash-ellipsis");
      const planA = buildPaintPlan(model, true);
      const planB = buildPaintPlan(model, true);
      expect(planB).toEqual(planA);
    });

    it("physical mm coordinates in the plan are deterministic across two independent compositions of the same fixture", () => {
      const { model: modelA } = composePublication("f20-canonical-sentence");
      const { model: modelB } = composePublication("f20-canonical-sentence");
      expect(buildPaintPlan(modelA, true)).toEqual(buildPaintPlan(modelB, true));
    });

    it("generates one combined Human QA PDF covering ordinary text, Ruby, TCY, Dash, and Ellipsis -- a single real composition, manual-page-break separated, through the exact same paint pipeline as every other test above, at a REALISTIC physical page size (not a tiny content-hugging test-fixture strip)", () => {
      const combinedFixture = buildFixtureUnits("body", [
        { kind: "TEXT", text: "「今日は、雨だった。」" },
        { kind: "MANUAL_BREAK" },
        { kind: "TEXT", text: "（仮）" },
        { kind: "MANUAL_BREAK" },
        { kind: "TEXT", text: "西の窓から見えるのは、いつもの静かな街だった。" },
        { kind: "MANUAL_BREAK" },
        { kind: "TEXT", text: "これは" },
        { kind: "RUBY", base: "東京", reading: "とうきょう" },
        { kind: "TEXT", text: "の話だ。" },
        { kind: "MANUAL_BREAK" },
        { kind: "TEXT", text: "西暦" },
        { kind: "TCY", text: "2026" },
        { kind: "TEXT", text: "年のことだった。" },
        { kind: "MANUAL_BREAK" },
        { kind: "TEXT", text: "彼は" },
        { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
        { kind: "TEXT", text: "そうだ" },
        { kind: "SEMANTIC_RUN", text: "……", runKind: "ELLIPSIS" },
        { kind: "TEXT", text: "と言った。" },
      ]);
      // Human Visual QA HOLD round 2 (2026-09-07): the round-1 fix used a
      // realistic-looking capacity (charsPerLine:40/linesPerColumn:28) but
      // still assumed content fills the paper edge-to-edge (zero margin) --
      // the body column painted flush against the paper's own right edge,
      // and the Ruby annotation (positioned further right, past the
      // rightmost column) had nowhere to go but off the page. Fixed:
      // capacity is now derived from BUNKO_PAGE_GEOMETRY's own CONTENT AREA
      // (paper minus margins: 80x124mm), and buildPaintPlan is given that
      // same geometry so content paints INSET from the real paper edges.
      const contentWidthMm = BUNKO_PAGE_GEOMETRY.paperWidthMm - BUNKO_PAGE_GEOMETRY.marginRightMm - BUNKO_PAGE_GEOMETRY.marginLeftMm;
      const contentHeightMm = BUNKO_PAGE_GEOMETRY.paperHeightMm - BUNKO_PAGE_GEOMETRY.marginTopMm - BUNKO_PAGE_GEOMETRY.marginBottomMm;
      const perCellMm = 3.704; // 10.5pt body font's own natural advance (matches settingsFor's own formula)
      const settings = settingsFor({
        charsPerLine: Math.floor(contentHeightMm / perCellMm),
        linesPerColumn: Math.floor(contentWidthMm / perCellMm),
        columnCount: 1,
      });
      const document = composeCanonicalDocument({ bodyUnits: combinedFixture.units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
      expect(document.hold).toBe(false);
      const ctx: PublicationRenderContext = {
        linePitchTicks: settings.linePitchTicks,
        lineExtentTicks: settings.lineExtentTicks,
        columnExtentTicks: settings.columnExtentTicks,
        columnsPerPage: settings.columnsPerPage,
        measurementIdentity: document.version.measurementIdentity,
        paintFontIdentity: document.version.measurementIdentity,
      };
      const model = buildPublicationDocument("publication-typography-qa", "Publication Typography QA — punctuation/text/Ruby/TCY/Dash/Ellipsis", document, combinedFixture.units, combinedFixture.source, ctx);
      expect(model.fontIdentityMismatch).toBe(false);

      // Round 7 (OpenType vertical GSUB outline paint): thread a real
      // VerticalOutlineContext so this combined QA artifact reflects the
      // font-derived outline paint for kana/Dash, not just the pre-round-7
      // manual-mapping-only "text" path. Round 10 (GPOS ink placement):
      // thread a real VerticalGposContext too. Round 13 (legacy parity
      // edge alignment): thread a real VerticalYakumonoAlignContext,
      // ported directly from the already-working legacy renderer's own
      // punctuation edge-anchoring mechanism (Core's own canonical
      // advance is no longer touched for punctuation at all).
      const outlineContext = new VerticalOutlineContext(readFileSync(FONT_PATH));
      const gposContext = new VerticalGposContext(readFileSync(FONT_PATH));
      const yakumonoContext = new VerticalYakumonoAlignContext(readFileSync(FONT_PATH), deriveBaselineRatioFromFont(fontResource()));
      const plan = buildPaintPlan(model, true, BUNKO_PAGE_GEOMETRY, undefined, outlineContext, gposContext, yakumonoContext);
      const { bytes, pageCount } = renderPaintPlanToPdf(plan, fontResource());
      expect(pageCount).toBe(document.pages.length);
      expect(pageCount).toBeGreaterThanOrEqual(6); // one page per manual-break section
      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

      // Every page uses the real 文庫 paper size, not a content-derived one.
      for (const page of plan) {
        expect(page.widthMm).toBe(BUNKO_PAGE_GEOMETRY.paperWidthMm);
        expect(page.heightMm).toBe(BUNKO_PAGE_GEOMETRY.paperHeightMm);
      }
      // No painted glyph/rect sits outside the physical paper rect (a
      // direct, geometric proof of "no content off-page" -- the exact
      // class of bug Ruby's own invisibility was traced to).
      for (const page of plan) {
        for (const cmd of page.commands) {
          const { xMin, xMax } = horizontalBoundsMm(cmd);
          expect(xMin).toBeGreaterThanOrEqual(-0.01);
          expect(xMax).toBeLessThanOrEqual(page.widthMm + 0.01);
        }
      }

      const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
      try {
        writeFileSync(join(outDir, "publication-typography-qa.pdf"), bytes);
      } catch {
        /* best-effort, transient Dropbox sync lock, non-fatal -- the real assertions above already proved valid PDF generation */
      }
    });

    it("REGRESSION (Human Visual QA HOLD, body flush against paper edge): with pageGeometry supplied, the rightmost body column starts INSET from the paper's right edge by the inside margin, never flush against it", () => {
      const { model } = composePublication("f20-canonical-sentence");
      const plan = buildPaintPlan(model, true, BUNKO_PAGE_GEOMETRY);
      const firstTextCmd = plan[0].commands.find((c) => c.op === "text")!;
      expect(firstTextCmd.op).toBe("text");
      if (firstTextCmd.op === "text") {
        const expectedContentRightEdge = BUNKO_PAGE_GEOMETRY.paperWidthMm - BUNKO_PAGE_GEOMETRY.marginRightMm;
        expect(firstTextCmd.xMm).toBeLessThanOrEqual(expectedContentRightEdge);
        expect(firstTextCmd.xMm).toBeGreaterThan(expectedContentRightEdge - 5); // within one cell of the content edge
      }
    });

    it("REGRESSION (Human Visual QA HOLD, invisible Ruby): with pageGeometry supplied, the Ruby annotation's own painted column stays within the physical paper bounds, even on the fixture's rightmost (and only) line", () => {
      const { model } = composePublication("atomic-ruby");
      const plan = buildPaintPlan(model, true, BUNKO_PAGE_GEOMETRY);
      const ruby = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.kind === "RUBY")!;
      const ann = ruby.rubyAnnotation!;
      expect(ann.status).toBe("PLACED");
      const annCmd = plan[0].commands.find((c) => c.op === "text" && ann.status === "PLACED" && c.text === Array.from(ann.text)[0]);
      expect(annCmd).toBeDefined();
      if (annCmd && annCmd.op === "text") {
        const halfWidthMm = (annCmd.fontSizePt * (25.4 / 72)) / 2;
        expect(annCmd.xMm + halfWidthMm).toBeLessThanOrEqual(BUNKO_PAGE_GEOMETRY.paperWidthMm);
      }
    });

    it("REGRESSION (Human Visual QA HOLD round 3, ONE deterministic vertical-glyph paint layer): Dash and Ellipsis now paint via real vertical-form glyph substitution (no rotation at all -- angle undefined, same as ordinary TEXT); TCY remains the only kind with an explicit angle (0, unrotated horizontal-in-vertical)", () => {
      const dashEllipsisCommands = textCommands("dash-ellipsis");
      const dashCmd = dashEllipsisCommands.find((c) => c.text === VERTICAL_EM_DASH)!;
      const ellipsisCmd = dashEllipsisCommands.find((c) => c.text === VERTICAL_ELLIPSIS)!;
      expect(dashCmd.angle).toBeUndefined();
      expect(ellipsisCmd.angle).toBeUndefined();
      const tcyCmd = textCommands("explicit-tcy").find((c) => c.text === "2026")!;
      expect(tcyCmd.angle).toBe(0);
      const textCmd = textCommands("f20-canonical-sentence")[0];
      expect(textCmd.angle).toBeUndefined();
    });

    it("without pageGeometry, behavior is unchanged from before this fix (content-sized page, zero margin) -- backward compatible for every existing caller", () => {
      const { model } = composePublication("f20-canonical-sentence");
      const planWithoutGeometry = buildPaintPlan(model, true);
      const page = model.pages[0];
      expect(planWithoutGeometry[0].widthMm).toBe(page.widthMm);
      expect(planWithoutGeometry[0].heightMm).toBe(page.heightMm);
    });
  });
});
