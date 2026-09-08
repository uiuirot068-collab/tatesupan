import { describe, expect, it } from "vitest";
import { convertHalfwidthKanaRun } from "./halfwidthKanaTable";

describe("convertHalfwidthKanaRun", () => {
  it("converts a plain half-width katakana run to full-width", () => {
    expect(convertHalfwidthKanaRun("ﾃｽﾄ")).toBe("テスト");
  });

  it("converts half-width punctuation (｡｢｣､･)", () => {
    expect(convertHalfwidthKanaRun("｡｢｣､･")).toBe("。「」、・");
  });

  it("combines a base kana with a following half-width dakuten into one voiced character", () => {
    expect(convertHalfwidthKanaRun("ｶﾞ")).toBe("ガ");
    expect(convertHalfwidthKanaRun("ﾊﾟ")).toBe("パ"); // handakuten (semi-voiced)
    expect(convertHalfwidthKanaRun("ﾊﾞ")).toBe("バ"); // dakuten (voiced)
  });

  it("applies the real ウ->ヴ voicing exception (not a simple base+1 offset)", () => {
    expect(convertHalfwidthKanaRun("ｳﾞ")).toBe("ヴ");
  });

  it("leaves a standalone dakuten with no precedable base as its own spacing full-width mark", () => {
    expect(convertHalfwidthKanaRun("ﾞ")).toBe("゛");
    expect(convertHalfwidthKanaRun("ﾟ")).toBe("゜");
  });

  it("does not attach a handakuten to a base with no semi-voiced form (e.g. カ has no ゜ pairing)", () => {
    // ｶ (カ) has no handakuten pairing -- the ﾟ must fall through as its
    // own standalone spacing mark, never silently dropped or merged wrong.
    expect(convertHalfwidthKanaRun("ｶﾟ")).toBe("カ゜");
  });

  it("every mapped output code point falls within the expected full-width ranges", () => {
    const HALFWIDTH_PUNCT_AND_KANA = "｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ";
    for (const ch of HALFWIDTH_PUNCT_AND_KANA) {
      const out = convertHalfwidthKanaRun(ch);
      const code = out.codePointAt(0)!;
      // Full-width katakana block (U+30A0-U+30FF), the CJK punctuation
      // range this table's own punctuation targets fall in (U+3000-U+303F),
      // or the combining Katakana-Hiragana sound marks ゛/゜ (U+309B/U+309C,
      // technically inside the Hiragana block U+3040-U+309F).
      const inKatakanaBlock = code >= 0x30a0 && code <= 0x30ff;
      const inCjkPunctBlock = code >= 0x3000 && code <= 0x303f;
      const inSoundMarkBlock = code === 0x309b || code === 0x309c;
      expect(inKatakanaBlock || inCjkPunctBlock || inSoundMarkBlock, `code point for input "${ch}" (U+${code.toString(16)}) out of range`).toBe(true);
    }
  });

  it("passes through a character not in the half-width block unchanged (defensive)", () => {
    expect(convertHalfwidthKanaRun("A")).toBe("A");
  });
});
