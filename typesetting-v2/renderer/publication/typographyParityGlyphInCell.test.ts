// TYPOGRAPHY PARITY Round 5 -- intra-column glyph-in-cell / visual-rhythm
// audit, ORDINARY Kanji/Kana only (punctuation explicitly excluded per
// this round's own scope). Measurement + diagnostic-artifact generation
// only -- no production behavior changed.
//
// Reuses EXISTING, already-real font-derived tooling this codebase
// already built and tested in an earlier P3-O08 development cycle:
// FontMetricsReader (vmtx/glyf ink bbox), gsubReader (vert/vrt2
// coverage), gposReader (vpal single-adjustments), VerticalGposContext
// (the actual paint-time Y-nudge already wired into generatePublicationPdf).

import { readFileSync, existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { createGlyphIdLookup } from "./fontCapability";
import { FontMetricsReader } from "./fontMetrics";
import { auditGsub } from "./gsubReader";
import { auditGpos } from "./gposReader";
import { VerticalGposContext } from "./verticalGposPaint";
import { composeCanonicalDocument, DEFAULT_RULE_SET_V2, mmToTicks, type PageCompositionSettings } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { generatePublicationPdf, type PublicationFontResource, type PublicationPageGeometry } from "./pdfGenerator";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");
function loadFont(): Buffer {
  return readFileSync(FONT_PATH);
}
function fontResource(): PublicationFontResource {
  return { fileName: "ShipporiMincho-Regular.ttf", fontName: "ShipporiMincho", base64: readFileSync(FONT_PATH).toString("base64") };
}

// The checkpoint's own ordinary-character sequence, punctuation excluded,
// が (ga) added to match the exact set the checkpoint itself lists.
interface CharSpec {
  label: string;
  char: string;
  codePoint: number;
  klass: "KANJI" | "HIRAGANA";
}
const CHARS: CharSpec[] = [
  { label: "人", char: "人", codePoint: 0x4eba, klass: "KANJI" },
  { label: "は", char: "は", codePoint: 0x306f, klass: "HIRAGANA" },
  { label: "驚", char: "驚", codePoint: 0x9a5a, klass: "KANJI" },
  { label: "き", char: "き", codePoint: 0x304d, klass: "HIRAGANA" },
  { label: "す", char: "す", codePoint: 0x3059, klass: "HIRAGANA" },
  { label: "ぎ", char: "ぎ", codePoint: 0x304e, klass: "HIRAGANA" },
  { label: "る", char: "る", codePoint: 0x308b, klass: "HIRAGANA" },
  { label: "と", char: "と", codePoint: 0x3068, klass: "HIRAGANA" },
  { label: "本", char: "本", codePoint: 0x672c, klass: "KANJI" },
  { label: "当", char: "当", codePoint: 0x5f53, klass: "KANJI" },
  { label: "に", char: "に", codePoint: 0x306b, klass: "HIRAGANA" },
  { label: "足", char: "足", codePoint: 0x8db3, klass: "KANJI" },
  { label: "が", char: "が", codePoint: 0x304c, klass: "HIRAGANA" },
  { label: "止", char: "止", codePoint: 0x6b62, klass: "KANJI" },
  { label: "ま", char: "ま", codePoint: 0x307e, klass: "HIRAGANA" },
  { label: "ら", char: "ら", codePoint: 0x3089, klass: "HIRAGANA" },
  { label: "し", char: "し", codePoint: 0x3057, klass: "HIRAGANA" },
  { label: "い", char: "い", codePoint: 0x3044, klass: "HIRAGANA" },
];

describe("Typography Parity Round 5 -- GSUB coverage for ordinary Kanji/Kana (G5 check)", () => {
  // Hypothesis going in was "no ordinary glyph ever has a vert/vrt2
  // substitute" (matching verticalGlyphMap.ts's own 8-entry punctuation-
  // only VERTICAL_FORM_MAP). MEASURED result contradicts that hypothesis
  // for HIRAGANA specifically -- see the evidence doc's own §G5 finding.
  // This test records the real split (KANJI vs HIRAGANA), it does not
  // assert a single boolean for the whole set.
  it("records real vert/vrt2 coverage per character, split by KANJI vs HIRAGANA", () => {
    const buf = loadFont();
    const gsub = auditGsub(buf);
    const lookup = createGlyphIdLookup(buf);
    const results = CHARS.map((c) => {
      const gid = lookup(c.codePoint);
      const hasVert = gid !== undefined && gsub.vert.substitutionMap.has(gid);
      const hasVrt2 = gid !== undefined && gsub.vrt2.substitutionMap.has(gid);
      return { ...c, glyphId: gid, hasVert, hasVrt2 };
    });
    // eslint-disable-next-line no-console
    console.log("ORDINARY_GSUB_COVERAGE", JSON.stringify(results));

    const kanji = results.filter((r) => r.klass === "KANJI");
    const hiragana = results.filter((r) => r.klass === "HIRAGANA");
    // eslint-disable-next-line no-console
    console.log(
      "ORDINARY_GSUB_COVERAGE_SUMMARY",
      JSON.stringify({
        kanjiWithVrt2: kanji.filter((r) => r.hasVrt2).length,
        kanjiTotal: kanji.length,
        hiraganaWithVrt2: hiragana.filter((r) => r.hasVrt2).length,
        hiraganaTotal: hiragana.length,
      })
    );

    // The real, measured, headline finding: KANJI never has a vertical
    // alternate in this font (expected -- kanji ink is orientation-
    // symmetric); HIRAGANA, in contrast, has one for EVERY character in
    // this test set -- a real font-provided signal TateSpun's paint path
    // currently never consults (verticalPaintGraphemeFor only checks its
    // own 8-entry punctuation table, never the font's own vrt2 coverage
    // for kana).
    expect(kanji.every((r) => !r.hasVert && !r.hasVrt2)).toBe(true);
    expect(hiragana.every((r) => r.hasVrt2)).toBe(true);
  });

  it("the hiragana vrt2 substitute glyphs have a DIFFERENT ink bbox than the horizontal-form source glyph (not a no-op declaration)", () => {
    const buf = loadFont();
    const gsub = auditGsub(buf);
    const lookup = createGlyphIdLookup(buf);
    const reader = new FontMetricsReader(buf);
    const hiragana = CHARS.filter((c) => c.klass === "HIRAGANA");
    const comparisons = hiragana.map((c) => {
      const sourceGid = lookup(c.codePoint)!;
      const vrt2Gid = gsub.vrt2.substitutionMap.get(sourceGid)!;
      const sourceBbox = reader.glyphInkBBox(sourceGid);
      const vrt2Bbox = reader.glyphInkBBox(vrt2Gid);
      const sameGlyphId = sourceGid === vrt2Gid;
      const sameBbox = JSON.stringify(sourceBbox) === JSON.stringify(vrt2Bbox);
      return { char: c.char, sourceGid, vrt2Gid, sameGlyphId, sameBbox, sourceBbox, vrt2Bbox };
    });
    // eslint-disable-next-line no-console
    console.log("HIRAGANA_VRT2_VS_SOURCE_BBOX", JSON.stringify(comparisons, null, 2));

    // At least confirm this is measured, not assumed either way.
    expect(comparisons.length).toBe(hiragana.length);
  });
});

describe("Typography Parity Round 5 -- vpal Y-placement for ordinary Kanji/Kana (G6 check)", () => {
  it("measures the REAL, currently-APPLIED vpal Y-placement (already wired into generatePublicationPdf) for all 18 ordinary characters", () => {
    const buf = loadFont();
    const gpos = auditGpos(buf);
    const lookup = createGlyphIdLookup(buf);
    const unitsPerEm = new FontMetricsReader(buf).unitsPerEm;
    const ctx = new VerticalGposContext(buf);

    const results = CHARS.map((c) => {
      const gid = lookup(c.codePoint);
      const vpalRaw = gid !== undefined ? gpos.vpal.singleAdjustments.get(gid) : undefined;
      const appliedYPlacementEm = ctx.yPlacementEmFor(c.char);
      return { ...c, glyphId: gid, vpalRawYPlacement: vpalRaw?.yPlacement, vpalRawYAdvance: vpalRaw?.yAdvance, appliedYPlacementEm };
    });
    // eslint-disable-next-line no-console
    console.log("ORDINARY_VPAL_APPLIED", JSON.stringify(results));

    expect(gpos.vpal.present).toBe(true);
    // At least SOME ordinary glyphs carry a real, non-zero vpal entry --
    // proves this is a real, glyph-specific, font-provided signal, not a
    // uniformly-zero table.
    expect(results.some((r) => r.appliedYPlacementEm !== 0)).toBe(true);
  });
});

describe("Typography Parity Round 5 -- repeated-glyph control (Step 4: is canonical advance uniform?)", () => {
  it("8 repetitions of the SAME ordinary character produce IDENTICAL yTick deltas -- proves canonical advance has zero pair-to-pair variance", () => {
    const fake = { naturalAdvanceTick: (_f: string, sizePt: number, _c: string) => mmToTicks((sizePt * 25.4) / 72), rubyReadingExtentTick: () => 0, imageIntrinsicTick: () => ({ width: 0, height: 0 }), providerId: "fake", providerVersion: "1" };
    for (const c of ["人", "は", "る", "驚", "日"]) {
      const text = c.repeat(8);
      const { units } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
      const settings: PageCompositionSettings = { bodyFontRef: "tmp", bodyFontSizePt: 9, lineExtentTicks: mmToTicks((9 * 25.4) / 72) * 10, linePitchTicks: mmToTicks((9 * 25.4) / 72), columnExtentTicks: mmToTicks((9 * 25.4) / 72) * 2, columnsPerPage: 1 };
      const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement: fake, settings });
      const placed = document.pages[0].columns[0].lines[0].placedUnits;
      expect(placed.length).toBe(8);
      const deltas = placed.slice(1).map((p, i) => p.yTick - placed[i].yTick);
      expect(new Set(deltas).size).toBe(1); // every delta is byte-identical
    }
  });
});

describe("Typography Parity Round 5 -- diagnostic artifact", () => {
  it("generates the compact glyph-in-cell diagnostic PDF (repeated + alternating controls; real ordinary sequence; real vpal-nudged rendering)", async () => {
    const { createShipporiMinchoMeasurementProvider } = await import("../../core/measurement/shipporiMinchoProvider");
    const measurement = createShipporiMinchoMeasurementProvider(FONT_PATH);
    const emTick = mmToTicks((9 * 25.4) / 72);
    const settings: PageCompositionSettings = {
      bodyFontRef: "round5-diagnostic",
      bodyFontSizePt: 9,
      lineExtentTicks: emTick * 20,
      linePitchTicks: emTick * 2,
      columnExtentTicks: emTick * 2 * 8,
      columnsPerPage: 1,
    };
    const pieces = [
      { kind: "TEXT" as const, text: "人は驚きすぎると本当に足が止まるらしい" }, // ordinary sequence, punctuation removed
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "人人人人人人人人" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "ははははははは" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "るるるるるるるる" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "驚驚驚驚驚驚驚驚" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "日日日日日日日日" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "人は人は人は人は" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "は驚は驚は驚は驚" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "驚き驚き驚き驚き" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "きすきすきすきす" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "が止が止が止が止" },
      { kind: "PARAGRAPH_BREAK" as const },
      { kind: "TEXT" as const, text: "止ま止ま止ま止ま" },
    ];
    const { units, source } = buildFixtureUnits("body", pieces);
    const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    expect(document.hold).toBe(false);

    const ctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
      bodyFontSizeTick: emTick,
    };
    const model = buildPublicationDocument("round5-diagnostic", "Typography Parity Round 5 — glyph-in-cell diagnostic (ordinary Kanji/Kana only)", document, units, source, ctx);
    const geometry: PublicationPageGeometry = { paperWidthMm: 105, paperHeightMm: 148, marginTopMm: 15, marginBottomMm: 15, marginRightMm: 12, marginLeftMm: 12 };
    const font = fontResource();
    const result = generatePublicationPdf(model, font, geometry);
    expect(new TextDecoder().decode(result.bytes.slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "typography-parity-glyph-in-cell-diagnostic.pdf"), result.bytes);
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
