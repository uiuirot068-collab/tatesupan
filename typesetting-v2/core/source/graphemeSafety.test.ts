import { describe, expect, it } from "vitest";
import {
  GraphemeSafetyError,
  assertGraphemeSafeBoundary,
  assertGraphemeSafeSpan,
  codePointLength,
  codePointSlice,
} from "./graphemeSafety";

// F16 fixture data (P3_CORE_IMPLEMENTATION_PLAN.md §10): surrogate pair,
// combining mark, variation selector, emoji modifier, and ZWJ sequences,
// each of which a naive UTF-16 pass could fracture. Every case is written
// as explicit \u escapes, never a literal glyph, so this fixture can never
// be silently re-normalized (e.g. NFC-composed) by an editor or file-
// encoding pass into a different code-point sequence than the one intended.
const F16 = {
  bmpJapanese: "東京", // 東京
  nonBmpSingle: "\u{20000}", // CJK Ext-B ideograph: one code point, one UTF-16 surrogate pair
  mixedBmpNonBmp: "A\u{20000}東", // 'A' + the CJK Ext-B ideograph + '東'
  emojiSingle: "\u{1F600}", // grinning-face emoji: one code point, one surrogate pair
  baseCombiningMark: "é", // "e" + COMBINING ACUTE ACCENT (U+0301): one grapheme, two code points
  variationSequence: "☺️", // WHITE SMILING FACE + VARIATION SELECTOR-16: one grapheme, two code points
  emojiModifier: "\u{1F44D}\u{1F3FD}", // thumbs-up + skin-tone modifier: one grapheme, two code points
  zwjFamily: "\u{1F468}‍\u{1F469}‍\u{1F467}‍\u{1F466}", // man+ZWJ+woman+ZWJ+girl+ZWJ+boy: one grapheme, seven code points
};

describe("codePointLength — code-point count vs. UTF-16 length divergence", () => {
  it("matches JS .length for ASCII and BMP text", () => {
    expect(codePointLength("abc")).toBe(3);
    expect(codePointLength(F16.bmpJapanese)).toBe(2);
    expect(F16.bmpJapanese.length).toBe(2);
  });

  it("diverges from JS .length for a lone non-BMP code point (surrogate pair)", () => {
    expect(F16.nonBmpSingle.length).toBe(2); // UTF-16: two code units
    expect(codePointLength(F16.nonBmpSingle)).toBe(1); // one code point
  });

  it("diverges from JS .length for an emoji surrogate pair", () => {
    expect(F16.emojiSingle.length).toBe(2);
    expect(codePointLength(F16.emojiSingle)).toBe(1);
  });

  it("diverges from JS .length in mixed BMP/non-BMP text", () => {
    expect(F16.mixedBmpNonBmp.length).toBe(4); // 'A' (1) + surrogate pair (2) + '東' (1)
    expect(codePointLength(F16.mixedBmpNonBmp)).toBe(3); // 'A', the non-BMP char, '東'
  });
});

describe("codePointSlice — adversarial naive-string-index fixture", () => {
  it("recovers a full non-BMP character that a naive UTF-16 slice would fracture", () => {
    const naiveSlice = F16.mixedBmpNonBmp.slice(0, 2); // UTF-16 units 0..2: 'A' + lone high surrogate
    const safeSlice = codePointSlice(F16.mixedBmpNonBmp, 0, 2); // code points 0..2: 'A' + the full non-BMP char

    expect(naiveSlice).not.toBe(safeSlice);
    expect(safeSlice).toBe("A" + F16.nonBmpSingle);
    // The naive slice is not even a lone valid character — it contains an
    // unpaired surrogate, proof that string[i]-style indexing is unsafe here.
    expect(naiveSlice.length).toBe(2);
    expect(naiveSlice).not.toBe(F16.nonBmpSingle);
  });

  it("round-trips ordinary Japanese prose unchanged", () => {
    expect(codePointSlice(F16.bmpJapanese, 0, 2)).toBe(F16.bmpJapanese);
    expect(codePointSlice(F16.bmpJapanese, 0, 1)).toBe("東");
    expect(codePointSlice(F16.bmpJapanese, 1, 2)).toBe("京");
  });
});

describe("assertGraphemeSafeBoundary — F16 grapheme-cluster regression fixture", () => {
  it("allows every boundary in plain BMP Japanese text", () => {
    expect(() => assertGraphemeSafeBoundary(F16.bmpJapanese, 0)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.bmpJapanese, 1)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.bmpJapanese, 2)).not.toThrow();
  });

  it("allows the boundary around (but never a naive mid-surrogate offset into) a non-BMP character", () => {
    expect(() => assertGraphemeSafeBoundary(F16.mixedBmpNonBmp, 1)).not.toThrow(); // before the non-BMP char
    expect(() => assertGraphemeSafeBoundary(F16.mixedBmpNonBmp, 2)).not.toThrow(); // after it
    // Note: code-point offsets cannot address "inside" a surrogate pair at
    // all (unlike UTF-16 indices) — this is exactly why Contract §4 mandates
    // code-point addressing as the canonical SourceSpan unit.
  });

  it("rejects a boundary inside a base+combining-mark sequence", () => {
    expect(() => assertGraphemeSafeBoundary(F16.baseCombiningMark, 0)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.baseCombiningMark, 2)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.baseCombiningMark, 1)).toThrow(GraphemeSafetyError);
  });

  it("rejects a boundary inside a variation-selector sequence", () => {
    expect(() => assertGraphemeSafeBoundary(F16.variationSequence, 0)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.variationSequence, 2)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.variationSequence, 1)).toThrow(GraphemeSafetyError);
  });

  it("rejects a boundary inside an emoji + skin-tone-modifier sequence", () => {
    expect(() => assertGraphemeSafeBoundary(F16.emojiModifier, 0)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.emojiModifier, 2)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.emojiModifier, 1)).toThrow(GraphemeSafetyError);
  });

  it("rejects every interior boundary inside a ZWJ emoji sequence", () => {
    const length = codePointLength(F16.zwjFamily);
    expect(length).toBe(7);
    expect(() => assertGraphemeSafeBoundary(F16.zwjFamily, 0)).not.toThrow();
    expect(() => assertGraphemeSafeBoundary(F16.zwjFamily, length)).not.toThrow();
    for (let offset = 1; offset < length; offset++) {
      expect(() => assertGraphemeSafeBoundary(F16.zwjFamily, offset)).toThrow(GraphemeSafetyError);
    }
  });

  it("rejects an out-of-range offset rather than silently clamping it", () => {
    expect(() => assertGraphemeSafeBoundary(F16.bmpJapanese, -1)).toThrow(GraphemeSafetyError);
    expect(() => assertGraphemeSafeBoundary(F16.bmpJapanese, 3)).toThrow(GraphemeSafetyError);
  });

  it("is deterministic across repeated calls on the same input (INV-005 foundation)", () => {
    const results = Array.from({ length: 5 }, () => {
      try {
        assertGraphemeSafeBoundary(F16.baseCombiningMark, 1);
        return "no-throw";
      } catch (error) {
        return error instanceof GraphemeSafetyError ? "threw" : "wrong-error-type";
      }
    });
    expect(results).toEqual(["threw", "threw", "threw", "threw", "threw"]);
  });
});

describe("assertGraphemeSafeSpan", () => {
  it("passes when both span edges land on grapheme boundaries", () => {
    expect(() => assertGraphemeSafeSpan(F16.bmpJapanese, { blockId: "b1", start: 0, end: 1 })).not.toThrow();
  });

  it("rejects a span whose edge lands inside a grapheme cluster", () => {
    expect(() =>
      assertGraphemeSafeSpan(F16.baseCombiningMark, { blockId: "b1", start: 0, end: 1 })
    ).toThrow(GraphemeSafetyError);
  });
});
