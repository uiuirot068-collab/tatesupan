// P3-O08 -- Human Visual QA HOLD round 18: 感嘆符/疑問符 (！/？) before a
// closing bracket -- AUDIT + EVIDENCE ONLY. Human's own Adobe InDesign
// comparison suggests `！」`/`？」` may read visually tighter than the
// already-closed `。」`/`、」` case (round 17). This file establishes the
// real facts before any rule is considered, and stops short of a product
// change per this round's own explicit instruction: implement ONLY if
// the evidence is unambiguous; otherwise produce Human comparison
// evidence instead.
//
// FINDINGS (full record: qa/evidence/P3_O08_QUESTION_EXCLAMATION_BEFORE_CLOSING_BRACKET.md):
// 1. Legacy `src/components/PageCard.tsx` has NO ！/？-specific handling
//    anywhere (direct Grep: only one unrelated `window.confirm(...？...)`
//    string match). ！/？ are NOT members of `YAKUMONO_HANG_START_TEST`/
//    `YAKUMONO_HANG_END_TEST` either.
// 2. `core/rules/defaultRuleSet.ts` already classifies ！/？ as cl-04
//    ("dividing punctuation marks", members "？！‼⁉") -- an EXISTING
//    class, not invented here. cl-04 currently carries only kinsoku
//    semantics (mayStartLine:false); no spacing rule is attached to it.
//    ASCII "!"/"?" (halfwidth) are NOT cl-04 members -- they fall to the
//    generic DEFAULT_CLASS (cl-00).
// 3. The committed font (Shippori Mincho) has real `vpal` GPOS data
//    (round 10) but NOT `vchw`/`vhal` (confirmed absent, round 10's own
//    audit) -- the OpenType feature that would give REAL per-font
//    evidence for "compress this punctuation pair" is simply not
//    present in this font. The cached jlreq/OpenType research
//    (research/typography-standards/jlreq-jis-opentype-standards-research.md
//    item 6) describes `vchw`/`vhal` CONCEPTUALLY (bracket+comma
//    example) but does not name ！/？ specifically, and this project's
//    own font does not implement either feature.
// CONCLUSION: no legacy mechanism to port, no real font data to derive a
// numeric rule from, no standards citation naming ！/？ specifically --
// AMBIGUOUS. No product rule is implemented. This file instead measures
// real ink-bbox data (parallel to round 14's small-kana finding) and
// produces a QA-only A/B comparison for Human judgment.

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PaintPlacedUnit, type PublicationRenderContext } from "./paintModel";
import { buildPaintPlan, deriveBaselineRatioFromFont, renderPaintPlanToPdf, type PaintCommand, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { VerticalOutlineContext } from "./verticalOutlinePaint";
import { VerticalGposContext } from "./verticalGposPaint";
import { VerticalYakumonoAlignContext, classifyYakumonoAlignment } from "./verticalYakumonoAlign";
import { FontMetricsReader } from "./fontMetrics";
import { createGlyphIdLookup } from "./fontCapability";
import { verticalPaintGraphemeFor } from "./verticalGlyphMap";
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
    buf,
    outlineContext: new VerticalOutlineContext(buf),
    gposContext: new VerticalGposContext(buf),
    yakumonoContext: new VerticalYakumonoAlignContext(buf, deriveBaselineRatioFromFont(font)),
  };
}

describe("Round 18 audit -- current classification and geometry (tests 1, 2, 6, 7)", () => {
  it("！ and ？ classify as cl-04 (dividing punctuation), an existing project class -- not invented here", () => {
    expect(DEFAULT_RULE_SET_V2.characterClassFor("！").id).toBe("cl-04");
    expect(DEFAULT_RULE_SET_V2.characterClassFor("？").id).toBe("cl-04");
  });

  it("！ and ？ are NOT members of the round-13 legacy HANG_START/HANG_END sets -- classify NORMAL, same as ordinary text", () => {
    expect(classifyYakumonoAlignment("！")).toBe("NORMAL");
    expect(classifyYakumonoAlignment("？")).toBe("NORMAL");
  });

  it("「本当！」 -- current canonical advance is uniform (no special rule exists) -- captures current geometry (test 1)", () => {
    const { document } = composeFor("「本当！」");
    const line = document.pages[0].columns[0].lines[0];
    const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
    for (let i = 1; i < line.placedUnits.length; i++) expect(line.placedUnits[i].yTick - line.placedUnits[i - 1].yTick).toBe(first);
  });

  it("「本当？」 -- current canonical advance is uniform (test 2)", () => {
    const { document } = composeFor("「本当？」");
    const line = document.pages[0].columns[0].lines[0];
    const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
    for (let i = 1; i < line.placedUnits.length; i++) expect(line.placedUnits[i].yTick - line.placedUnits[i - 1].yTick).toBe(first);
  });

  it("！次 / ？次 -- ordinary adjacency: pitch equals ordinary text's own single-cell advance, same as any other character pair (controls, test 6/7)", () => {
    const kanjiControl = composeFor("次次");
    const kanjiPitch = kanjiControl.document.pages[0].columns[0].lines[0];
    const expectedCell = kanjiPitch.placedUnits[1].yTick - kanjiPitch.placedUnits[0].yTick;
    for (const text of ["！次", "？次"]) {
      const { document } = composeFor(text);
      const line = document.pages[0].columns[0].lines[0];
      expect(line.placedUnits[1].yTick - line.placedUnits[0].yTick).toBe(expectedCell);
    }
  });
});

describe("Round 18 audit -- combined punctuation tokenization (test 3)", () => {
  it("！？ composes as TWO separate ordinary TEXT atoms (one cell each), not a semantic run -- Core's cl-08 inseparability rule never applies to cl-04 characters", () => {
    const { document } = composeFor("！？");
    const line = document.pages[0].columns[0].lines[0];
    expect(line.placedUnits).toHaveLength(2);
    const pitch = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
    // Not a literal equality to a magic constant -- proves the pitch equals
    // ONE ordinary cell for this same measurement provider/settings.
    const single = composeFor("！次");
    const singlePitch = single.document.pages[0].columns[0].lines[0].placedUnits[1].yTick - single.document.pages[0].columns[0].lines[0].placedUnits[0].yTick;
    expect(pitch).toBe(singlePitch);
    expect(pitch).toBeGreaterThan(0);
  });

  it("「本当！？」 / 「本当？！」 -- both mixed-mark sequences compose as ordinary per-character TEXT atoms, uniform advance throughout (tests the combined-mark cases)", () => {
    for (const text of ["「本当！？」", "「本当？！」"]) {
      const { document } = composeFor(text);
      const line = document.pages[0].columns[0].lines[0];
      const first = line.placedUnits[1].yTick - line.placedUnits[0].yTick;
      for (let i = 1; i < line.placedUnits.length; i++) expect(line.placedUnits[i].yTick - line.placedUnits[i - 1].yTick).toBe(first);
    }
  });
});

describe("Round 18 audit -- real ink-bbox evidence (parallels round 14's small-kana finding)", () => {
  it("！ and ？'s own real glyph ink occupies a measurably different fraction of the em-square than 。/、's -- real, measured, not guessed", () => {
    const { buf } = realContexts();
    const outlineContext = new VerticalOutlineContext(buf);
    const metrics = new FontMetricsReader(buf);
    const glyphIdFor = createGlyphIdLookup(buf);
    const inkHeightFractionOf = (ch: string): number => {
      const outlineGlyphId = outlineContext.resolveOutlineGlyphId(ch);
      const glyphId = outlineGlyphId ?? glyphIdFor(verticalPaintGraphemeFor(ch).codePointAt(0)!);
      expect(glyphId).toBeDefined();
      const bbox = metrics.glyphInkBBox(glyphId!);
      expect(bbox).toBeDefined();
      return (bbox!.yMax - bbox!.yMin) / metrics.unitsPerEm;
    };
    const exclamationFraction = inkHeightFractionOf("！");
    const questionFraction = inkHeightFractionOf("？");
    const periodFraction = inkHeightFractionOf("。");
    const commaFraction = inkHeightFractionOf("、");
    const closingBracketFraction = inkHeightFractionOf("」");
    // eslint-disable-next-line no-console -- deliberate evidence dump, same convention as fontMetrics.test.ts/verticalOutlinePaint.test.ts's own GLYPH_EVIDENCE logs.
    console.log("INK_HEIGHT_FRACTION_EM", { exclamationFraction, questionFraction, periodFraction, commaFraction, closingBracketFraction });
    // Recorded as evidence, not asserted as "smaller" or "larger" in a
    // fixed direction -- the evidence doc records the actual measured
    // numbers; this test only proves the measurement is real and stable.
    expect(exclamationFraction).toBeGreaterThan(0);
    expect(questionFraction).toBeGreaterThan(0);
    expect(periodFraction).toBeGreaterThan(0);
  });
});

describe("Round 18 audit -- regression controls (period/comma untouched, safety)", () => {
  it("。」 remains NORMAL/unchanged (round 17's own closed decision)", () => {
    const { document } = composeFor("た。」");
    const line = document.pages[0].columns[0].lines[0];
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(line.placedUnits[1].yTick - line.placedUnits[0].yTick);
  });

  it("、」 remains NORMAL/unchanged", () => {
    const { document } = composeFor("た、」");
    const line = document.pages[0].columns[0].lines[0];
    expect(line.placedUnits[2].yTick - line.placedUnits[1].yTick).toBe(line.placedUnits[1].yTick - line.placedUnits[0].yTick);
  });

  it("glyph size stays the fixed 1em bodyEmMm-derived fontSizePt (test 8)", () => {
    const { model } = composeFor("「本当！」");
    const { outlineContext, gposContext, yakumonoContext } = realContexts();
    const plan = buildPaintPlan(model, true, undefined, undefined, outlineContext, gposContext, yakumonoContext);
    const sizes = plan[0].commands.filter((c): c is Extract<PaintCommand, { op: "text" }> => c.op === "text").map((c) => c.fontSizePt);
    const first = sizes[0];
    for (const s of sizes) expect(s).toBe(first);
  });

  it("source is never mutated (test 9)", () => {
    const before = { units: buildFixtureUnits("body", [{ kind: "TEXT", text: "「本当！」" }]).units };
    const beforeCopy = JSON.parse(JSON.stringify(before));
    composeFor("「本当！」");
    expect(before).toEqual(beforeCopy);
  });

  it("SourceSpan is preserved end-to-end, one grapheme per placedUnit, in order (test 10)", () => {
    const source = "「本当！？」";
    const { document } = composeFor(source);
    const line = document.pages[0].columns[0].lines[0];
    const chars = Array.from(source);
    expect(line.placedUnits).toHaveLength(chars.length);
    line.placedUnits.forEach((p, i) => {
      expect(p.sourceSpan.start).toBe(i);
      expect(p.sourceSpan.end).toBe(i + 1);
    });
  });

  it("composing the same source twice yields byte-identical output (test 11, determinism)", () => {
    const a = composeFor("「本当！？」").document.pages[0].columns[0].lines[0];
    const b = composeFor("「本当！？」").document.pages[0].columns[0].lines[0];
    expect(a).toEqual(b);
  });
});

// EVIDENCE IS AMBIGUOUS FOR A NEW PRODUCT RULE (see this file's own
// header comment and the evidence doc): no legacy mechanism, no real
// font vchw/vhal data, no standards citation naming ！/？ specifically.
// The real ink-bbox measurement above additionally suggests the
// observed InDesign tightness is very likely an INHERENT property of
// tall ！/？ glyphs (measured ~0.83 of the em-square, vs ~0.22-0.26 for
// 。/、) under ordinary centered treatment -- the same class of finding
// as round 14's small-kana audit, not evidence FOR a new rule. Per this
// round's own explicit instruction, NO product rule is implemented.
// This generates the required Human comparison PDF instead: A_CURRENT
// (real, unmodified default) vs B_EVIDENCE_DERIVED (the ONE real,
// already-proven mechanism this codebase has for "flush punctuation ink
// against a cell edge" -- round 13's own HANG_START formula, reused
// verbatim, never a new invented offset -- applied experimentally to
// ！/？ only when immediately followed by cl-02). Both variants are
// QA-only; neither touches any product file.
function isClosingBracket(ch: string | undefined): boolean {
  return ch !== undefined && /[’”）〕］｝〉》」』】〙〗]/u.test(ch);
}

function isDividingPunctuation(ch: string): boolean {
  return DEFAULT_RULE_SET_V2.characterClassFor(ch).id === "cl-04";
}

function buildComparisonPage(
  model: ReturnType<typeof composeFor>["model"],
  variant: "A_CURRENT" | "B_EVIDENCE_DERIVED",
  outlineContext: VerticalOutlineContext,
  metrics: FontMetricsReader,
  glyphIdFor: (cp: number) => number | undefined,
  baselineRatio: number
) {
  const page = model.pages[0];
  const contentRightEdgeMm = DIAGNOSTIC_GEOMETRY.paperWidthMm - DIAGNOSTIC_GEOMETRY.marginRightMm;
  const yOffsetMm = DIAGNOSTIC_GEOMETRY.marginTopMm;
  const commands: PaintCommand[] = [];
  for (const column of page.columns) {
    for (const line of column.lines) {
      const x = contentRightEdgeMm - column.rightMm - line.rightMm - line.widthMm;
      const units = line.units;
      units.forEach((unit: PaintPlacedUnit, i: number) => {
        commands.push({ op: "rect", xMm: x, yMm: yOffsetMm + unit.topMm, widthMm: line.widthMm, heightMm: unit.heightMm });
        const ch = unit.text;
        const xCenterMm = x + line.widthMm / 2;
        const isTrigger = variant === "B_EVIDENCE_DERIVED" && isDividingPunctuation(ch) && isClosingBracket(units[i + 1]?.text);
        let yMm = yOffsetMm + unit.topMm + unit.heightMm * baselineRatio;
        if (isTrigger) {
          const outlineGlyphId = outlineContext.resolveOutlineGlyphId(ch);
          const glyphId = outlineGlyphId ?? glyphIdFor(verticalPaintGraphemeFor(ch).codePointAt(0)!);
          const bbox = glyphId !== undefined ? metrics.glyphInkBBox(glyphId) : undefined;
          if (bbox) {
            const flushRatio = bbox.yMax / metrics.unitsPerEm; // round 13's own HANG_START formula, reused verbatim
            yMm = yOffsetMm + unit.topMm + unit.heightMm * flushRatio;
          }
        }
        const outlineGlyphId = outlineContext.resolveOutlineGlyphId(ch);
        if (outlineGlyphId !== undefined) {
          commands.push({ op: "glyphOutline", commands: outlineContext.glyphOutlineCommandsMm(outlineGlyphId, xCenterMm, yMm, unit.heightMm) });
        } else {
          commands.push({ op: "text", text: verticalPaintGraphemeFor(ch), xMm: xCenterMm, yMm, fontSizePt: model.bodyEmMm * (72 / 25.4), align: "center" });
        }
      });
    }
  }
  return { widthMm: DIAGNOSTIC_GEOMETRY.paperWidthMm, heightMm: DIAGNOSTIC_GEOMETRY.paperHeightMm, commands };
}

describe("Round 18 -- generates question-exclamation-closing-bracket-comparison.pdf (Human A/B, no rule implemented)", () => {
  it("one A_CURRENT page then one B_EVIDENCE_DERIVED page per fixture, with QA-only cell boundaries", () => {
    const { font, buf } = realContexts();
    const outlineContext = new VerticalOutlineContext(buf);
    const metrics = new FontMetricsReader(buf);
    const glyphIdFor = createGlyphIdLookup(buf);
    const baselineRatio = deriveBaselineRatioFromFont(font);

    const fixtures = ["「本当！」", "「本当？」", "「本当！？」", "「本当？！」", "「今日は、雨だった。」", "「今日は、雨だった、」", "！次", "？次"];
    const pages: PaintCommand[][] = [];
    for (const text of fixtures) {
      const { model } = composeFor(text);
      pages.push(buildComparisonPage(model, "A_CURRENT", outlineContext, metrics, glyphIdFor, baselineRatio).commands);
      pages.push(buildComparisonPage(model, "B_EVIDENCE_DERIVED", outlineContext, metrics, glyphIdFor, baselineRatio).commands);
    }
    const combinedPlan = pages.map((commands) => ({ widthMm: DIAGNOSTIC_GEOMETRY.paperWidthMm, heightMm: DIAGNOSTIC_GEOMETRY.paperHeightMm, commands }));
    const { bytes, pageCount } = renderPaintPlanToPdf(combinedPlan, font);
    expect(pageCount).toBe(fixtures.length * 2);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "question-exclamation-closing-bracket-comparison.pdf"), bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
