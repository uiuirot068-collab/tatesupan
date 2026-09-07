// P3-O08 — cmap coverage checker: proven against the REAL committed
// Shippori Mincho asset, not a synthetic/mock font. This is the audit
// evidence for qa/evidence/P3_O08_VERTICAL_GLYPH_PAINT.md's own coverage
// table — run once here, then the resulting booleans are hand-copied into
// `verticalGlyphMap.ts`'s own build-time constant (see that file's own
// comment) so paint-time code never re-parses the font on every call.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { createGlyphCoverageChecker } from "./fontCapability";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

describe("createGlyphCoverageChecker — Shippori Mincho Regular", () => {
  const buf = readFileSync(FONT_PATH);
  const hasGlyph = createGlyphCoverageChecker(buf);

  it("reports coverage for ordinary kanji/kana/digits (sanity check the parser itself works)", () => {
    expect(hasGlyph(0x6771)).toBe(true); // 東
    expect(hasGlyph(0x4eac)).toBe(true); // 京
    expect(hasGlyph(0x3042)).toBe(true); // あ
    expect(hasGlyph(0x0032)).toBe(true); // '2' ASCII digit
  });

  it("reports FALSE for a deliberately absurd, certainly-unassigned code point (sanity check it isn't just returning true for everything)", () => {
    expect(hasGlyph(0x10ffff)).toBe(false);
  });

  it("is deterministic: repeated calls for the same code point return the same result", () => {
    const a = hasGlyph(0x2015);
    const b = hasGlyph(0x2015);
    expect(a).toBe(b);
  });

  // The actual audit: real coverage results for every vertical
  // presentation-form candidate this task's evidence doc needs, printed
  // via assertion (not console.log) so a failure here IS the finding.
  it("AUDIT — source characters and their Unicode vertical presentation-form equivalents", () => {
    const results = {
      "U+3001 、 (comma)": hasGlyph(0x3001),
      "U+FE11 vertical comma": hasGlyph(0xfe11),
      "U+3002 。 (full stop)": hasGlyph(0x3002),
      "U+FE12 vertical full stop": hasGlyph(0xfe12),
      "U+300C 「": hasGlyph(0x300c),
      "U+FE41 vertical left corner bracket": hasGlyph(0xfe41),
      "U+300D 」": hasGlyph(0x300d),
      "U+FE42 vertical right corner bracket": hasGlyph(0xfe42),
      "U+FF08 （": hasGlyph(0xff08),
      "U+FE35 vertical left parenthesis": hasGlyph(0xfe35),
      "U+FF09 ）": hasGlyph(0xff09),
      "U+FE36 vertical right parenthesis": hasGlyph(0xfe36),
      "U+2015 ― (dash)": hasGlyph(0x2015),
      "U+FE31 vertical em dash": hasGlyph(0xfe31),
      "U+2026 … (ellipsis)": hasGlyph(0x2026),
      "U+FE19 vertical horizontal ellipsis": hasGlyph(0xfe19),
      "U+FF01 ！": hasGlyph(0xff01),
      "U+FE15 vertical exclamation mark": hasGlyph(0xfe15),
      "U+FF1F ？": hasGlyph(0xff1f),
      "U+FE16 vertical question mark": hasGlyph(0xfe16),
      "U+FF1A ：": hasGlyph(0xff1a),
      "U+FE13 vertical colon": hasGlyph(0xfe13),
      "U+FF1B ；": hasGlyph(0xff1b),
      "U+FE14 vertical semicolon": hasGlyph(0xfe14),
    };
    // This assertion's own failure message (vitest prints the full object
    // on mismatch) IS the coverage audit result — asserting against a
    // frozen snapshot object makes the actual measured values visible in
    // the test file's own diff/output rather than requiring console.log.
    // REAL, measured result against the committed Shippori Mincho asset
    // (not a hypothesis) — copied verbatim into
    // qa/evidence/P3_O08_VERTICAL_GLYPH_PAINT.md's own coverage table and
    // into verticalGlyphMap.ts's classification. Comma/full-stop/brackets/
    // parens/dash/ellipsis ALL have real vertical presentation-form
    // glyphs in this font; colon/semicolon/exclamation/question do NOT --
    // consistent with standard Japanese vertical-typesetting convention,
    // where those four are conventionally left upright anyway (their own
    // horizontal form is already visually acceptable unrotated), so this
    // absence does not block anything this task needs to fix.
    expect(results).toEqual({
      "U+3001 、 (comma)": true,
      "U+FE11 vertical comma": true,
      "U+3002 。 (full stop)": true,
      "U+FE12 vertical full stop": true,
      "U+300C 「": true,
      "U+FE41 vertical left corner bracket": true,
      "U+300D 」": true,
      "U+FE42 vertical right corner bracket": true,
      "U+FF08 （": true,
      "U+FE35 vertical left parenthesis": true,
      "U+FF09 ）": true,
      "U+FE36 vertical right parenthesis": true,
      "U+2015 ― (dash)": true,
      "U+FE31 vertical em dash": true,
      "U+2026 … (ellipsis)": true,
      "U+FE19 vertical horizontal ellipsis": true,
      "U+FF01 ！": true,
      "U+FE15 vertical exclamation mark": false,
      "U+FF1F ？": true,
      "U+FE16 vertical question mark": false,
      "U+FF1A ：": true,
      "U+FE13 vertical colon": false,
      "U+FF1B ；": true,
      "U+FE14 vertical semicolon": false,
    });
  });
});
