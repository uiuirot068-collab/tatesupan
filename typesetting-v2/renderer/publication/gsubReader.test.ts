// P3-O08 — OpenType vertical GSUB audit (Human Visual QA HOLD round 6): the
// audit's own ground-truth evidence, against the REAL committed Shippori
// Mincho asset. `console.log` blocks are deliberate raw evidence,
// transcribed into qa/evidence/P3_O08_OPENTYPE_VERTICAL_GSUB_AUDIT.md.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { auditGsub, hasGsubTable } from "./gsubReader";
import { createGlyphIdLookup, findCodePointForGlyphId } from "./fontCapability";
import { FontMetricsReader } from "./fontMetrics";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function loadFont(): Buffer {
  return readFileSync(FONT_PATH);
}

describe("gsubReader -- GSUB table presence + vert/vrt2 feature detection (real Shippori Mincho asset)", () => {
  it("detects whether GSUB is present at all", () => {
    const buf = loadFont();
    const present = hasGsubTable(buf);
    // eslint-disable-next-line no-console
    console.log("HAS_GSUB", present);
    expect(typeof present).toBe("boolean");
  });

  it("parses GSUB deterministically -- same font, same audit result twice", () => {
    const buf = loadFont();
    const a = auditGsub(buf);
    const b = auditGsub(buf);
    expect(a.hasGsub).toBe(b.hasGsub);
    expect(a.scriptTags).toEqual(b.scriptTags);
    expect(a.vert.present).toBe(b.vert.present);
    expect(a.vrt2.present).toBe(b.vrt2.present);
    expect(Array.from(a.vert.substitutionMap.entries())).toEqual(Array.from(b.vert.substitutionMap.entries()));
  });

  it("records the full audit result -- scripts, vert/vrt2 presence, lookup types used", () => {
    const buf = loadFont();
    const audit = auditGsub(buf);
    // eslint-disable-next-line no-console
    console.log(
      "GSUB_AUDIT",
      JSON.stringify(
        {
          hasGsub: audit.hasGsub,
          scriptTags: audit.scriptTags,
          vertPresent: audit.vert.present,
          vertLookupTypes: audit.vert.lookupTypesUsed,
          vertSubstitutionCount: audit.vert.substitutionMap.size,
          vrt2Present: audit.vrt2.present,
          vrt2LookupTypes: audit.vrt2.lookupTypesUsed,
          vrt2SubstitutionCount: audit.vrt2.substitutionMap.size,
        },
        null,
        2
      )
    );
    expect(audit.hasGsub).toBe(true);
  });

  it("fails structurally (throws) on a malformed GSUB rather than silently reporting no substitution", () => {
    const buf = loadFont();
    const tables = new Map<string, { offset: number; length: number }>();
    const numTables = buf.readUInt16BE(4);
    let gsubOffset = -1;
    for (let i = 0; i < numTables; i++) {
      const entryOffset = 12 + i * 16;
      const tag = buf.toString("latin1", entryOffset, entryOffset + 4);
      if (tag === "GSUB") gsubOffset = buf.readUInt32BE(entryOffset + 8);
    }
    expect(gsubOffset).toBeGreaterThan(0);
    const corrupted = Buffer.from(buf);
    // Point scriptListOffset far past the end of the file -- must throw, not silently return empty.
    corrupted.writeUInt16BE(0xffff, gsubOffset + 4);
    expect(() => auditGsub(corrupted)).toThrow();
  });
});

interface CharSpec {
  label: string;
  char: string;
  codePoint: number;
}

const CONTROL_CHARS: CharSpec[] = [
  { label: "ordinary-tsu", char: "つ", codePoint: 0x3064 },
  { label: "ta", char: "た", codePoint: 0x305f },
  { label: "hi (day/sun)", char: "日", codePoint: 0x65e5 },
];

const SMALL_KANA_CHARS: CharSpec[] = [
  { label: "small-tsu (hiragana)", char: "っ", codePoint: 0x3063 },
  { label: "small-ya (hiragana)", char: "ゃ", codePoint: 0x3083 },
  { label: "small-yu (hiragana)", char: "ゅ", codePoint: 0x3085 },
  { label: "small-yo (hiragana)", char: "ょ", codePoint: 0x3087 },
  { label: "small-tsu (katakana)", char: "ッ", codePoint: 0x30c3 },
  { label: "small-ya (katakana)", char: "ャ", codePoint: 0x30e3 },
  { label: "small-yu (katakana)", char: "ュ", codePoint: 0x30e5 },
  { label: "small-yo (katakana)", char: "ョ", codePoint: 0x30e7 },
];

const PUNCTUATION_CHARS: CharSpec[] = [
  { label: "comma", char: "、", codePoint: 0x3001 },
  { label: "period", char: "。", codePoint: 0x3002 },
  { label: "open-corner-bracket", char: "「", codePoint: 0x300c },
  { label: "close-corner-bracket", char: "」", codePoint: 0x300d },
  { label: "open-paren", char: "（", codePoint: 0xff08 },
  { label: "close-paren", char: "）", codePoint: 0xff09 },
];

const DASH_ELLIPSIS_CHARS: CharSpec[] = [
  { label: "dash", char: "―", codePoint: 0x2015 },
  { label: "ellipsis", char: "…", codePoint: 0x2026 },
];

const UNCOVERED_CONTROL_CHARS: CharSpec[] = [
  { label: "exclamation", char: "！", codePoint: 0xff01 },
  { label: "question", char: "？", codePoint: 0xff1f },
  { label: "colon", char: "：", codePoint: 0xff1a },
  { label: "semicolon", char: "；", codePoint: 0xff1b },
];

const ALL_CHARS = [...CONTROL_CHARS, ...SMALL_KANA_CHARS, ...PUNCTUATION_CHARS, ...DASH_ELLIPSIS_CHARS, ...UNCOVERED_CONTROL_CHARS];

// Presentation-form codepoints the existing manual Unicode-substitution
// path (verticalGlyphMap.ts) maps punctuation/dash/ellipsis source
// characters to -- used below to compare "manual mapping" vs "GSUB
// mapping" glyph identity.
const PRESENTATION_FORM_FOR: Record<number, number> = {
  0x3001: 0xfe11,
  0x3002: 0xfe12,
  0x300c: 0xfe41,
  0x300d: 0xfe42,
  0xff08: 0xfe35,
  0xff09: 0xfe36,
  0x2015: 0xfe31,
  0x2026: 0xfe19,
};

describe("gsubReader -- real vert/vrt2 substitution results for the required character set", () => {
  it("resolves the vert/vrt2 substitution (if any) for every required character, and compares it against the existing manual Unicode-presentation-form mapping", () => {
    const buf = loadFont();
    const glyphIdFor = createGlyphIdLookup(buf);
    const audit = auditGsub(buf);

    const evidence = ALL_CHARS.map((spec) => {
      const sourceGlyphId = glyphIdFor(spec.codePoint);
      const vertGlyphId = sourceGlyphId !== undefined ? audit.vert.substitutionMap.get(sourceGlyphId) : undefined;
      const vrt2GlyphId = sourceGlyphId !== undefined ? audit.vrt2.substitutionMap.get(sourceGlyphId) : undefined;
      const presentationCodePoint = PRESENTATION_FORM_FOR[spec.codePoint];
      const presentationGlyphId = presentationCodePoint !== undefined ? glyphIdFor(presentationCodePoint) : undefined;
      return {
        label: spec.label,
        codePoint: "U+" + spec.codePoint.toString(16).toUpperCase().padStart(4, "0"),
        sourceGlyphId,
        vertGlyphId,
        vrt2GlyphId,
        vertDiffersFromSource: vertGlyphId !== undefined ? vertGlyphId !== sourceGlyphId : undefined,
        vrt2DiffersFromSource: vrt2GlyphId !== undefined ? vrt2GlyphId !== sourceGlyphId : undefined,
        manualPresentationFormGlyphId: presentationGlyphId,
        gsubMatchesManualMapping:
          presentationGlyphId !== undefined ? (vertGlyphId ?? vrt2GlyphId) === presentationGlyphId : undefined,
      };
    });

    // eslint-disable-next-line no-console
    console.log("VERT_VRT2_EVIDENCE", JSON.stringify(evidence, null, 2));

    // Every character in this required set must resolve to SOME real glyph ID (coverage sanity check).
    for (const row of evidence) expect(row.sourceGlyphId, `no glyph for ${row.label}`).toBeDefined();
  });

  it("determinism: resolving the same character's vert substitution twice yields the identical glyph ID", () => {
    const buf = loadFont();
    const glyphIdFor = createGlyphIdLookup(buf);
    const audit1 = auditGsub(buf);
    const audit2 = auditGsub(buf);
    for (const spec of SMALL_KANA_CHARS) {
      const g = glyphIdFor(spec.codePoint)!;
      expect(audit1.vert.substitutionMap.get(g)).toBe(audit2.vert.substitutionMap.get(g));
    }
  });

  it("PAINT CAPABILITY: are the kana vert-alternate glyph IDs reachable through ANY Unicode code point this font's cmap defines? (jsPDF can only paint via a Unicode string, never a raw glyph ID)", () => {
    const buf = loadFont();
    const glyphIdFor = createGlyphIdLookup(buf);
    const audit = auditGsub(buf);

    const results = SMALL_KANA_CHARS.map((spec) => {
      const sourceGlyphId = glyphIdFor(spec.codePoint)!;
      const vertGlyphId = audit.vert.substitutionMap.get(sourceGlyphId)!;
      const reachableCodePoint = findCodePointForGlyphId(buf, vertGlyphId);
      return {
        label: spec.label,
        sourceGlyphId,
        vertGlyphId,
        reachableViaCodePoint: reachableCodePoint !== undefined ? "U+" + reachableCodePoint.toString(16).toUpperCase() : undefined,
        paintableByJsPdfTextApi: reachableCodePoint !== undefined,
      };
    });
    // eslint-disable-next-line no-console
    console.log("KANA_VERT_PAINT_CAPABILITY", JSON.stringify(results, null, 2));

    // Sanity: findCodePointForGlyphId correctly finds the SOURCE code
    // point for its own glyph (proves the reverse-lookup mechanism itself
    // is correct, not merely always returning undefined).
    const taSourceGlyphId = glyphIdFor(0x305f)!; // た
    expect(findCodePointForGlyphId(buf, taSourceGlyphId)).toBe(0x305f);
  });

  it("PAINT CAPABILITY: is the dash's GSUB-selected vertical glyph reachable via a Unicode code point, and does it differ from the manually-mapped U+FE31 glyph?", () => {
    const buf = loadFont();
    const glyphIdFor = createGlyphIdLookup(buf);
    const audit = auditGsub(buf);
    const dashSourceGlyphId = glyphIdFor(0x2015)!;
    const dashVertGlyphId = audit.vert.substitutionMap.get(dashSourceGlyphId)!;
    const manualGlyphId = glyphIdFor(0xfe31)!; // vertical em dash presentation form, currently used by verticalGlyphMap.ts
    const reachable = findCodePointForGlyphId(buf, dashVertGlyphId);
    // eslint-disable-next-line no-console
    console.log(
      "DASH_GSUB_VS_MANUAL",
      JSON.stringify({ dashSourceGlyphId, dashVertGlyphId, manualGlyphId, differ: dashVertGlyphId !== manualGlyphId, reachableViaCodePoint: reachable !== undefined ? "U+" + reachable.toString(16).toUpperCase() : undefined })
    );
    expect(dashVertGlyphId).not.toBe(manualGlyphId);
  });

  it("OUTLINE FALLBACK AUDIT: are the unreachable vert-alternate glyphs simple or composite outlines? (affects how substantial a from-scratch outline-to-vector-path decoder would be)", () => {
    const buf = loadFont();
    const glyphIdFor = createGlyphIdLookup(buf);
    const reader = new FontMetricsReader(buf);
    const audit = auditGsub(buf);

    const targets = [...SMALL_KANA_CHARS.map((s) => s.codePoint), 0x2015].map((cp) => {
      const sourceGlyphId = glyphIdFor(cp)!;
      const vertGlyphId = audit.vert.substitutionMap.get(sourceGlyphId)!;
      const bbox = reader.glyphInkBBox(vertGlyphId);
      return { codePoint: "U+" + cp.toString(16).toUpperCase(), vertGlyphId, isComposite: bbox?.isComposite, numberOfContours: bbox?.numberOfContours };
    });
    // eslint-disable-next-line no-console
    console.log("VERT_ALTERNATE_OUTLINE_KIND", JSON.stringify(targets, null, 2));
    for (const t of targets) expect(t.isComposite).toBeDefined();
  });
});
