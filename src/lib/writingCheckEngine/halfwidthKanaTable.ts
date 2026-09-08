/**
 * Half-width -> full-width katakana/punctuation conversion table (Phase
 * 3). The real, standard JIS X 0201 <-> JIS X 0208 correspondence every
 * OS/IME full-width conversion uses -- not invented here.
 *
 * Built entirely from Unicode CODE POINTS (`String.fromCharCode`), never
 * from typed literal Japanese characters, specifically to eliminate any
 * risk of a transcription error across ~60 individual glyphs (verified
 * empirically in this same session: hand-typing a Unicode escape range
 * for this exact block earlier produced unreliable results). Every
 * output character's own code point is a plain, checkable hex constant
 * in this file's own source -- reviewable and testable without relying
 * on visual inspection of the rendered glyphs themselves.
 */

// U+FF61-U+FF65: half-width punctuation, index-aligned with their real
// full-width targets below.
const PUNCT_SOURCE_START = 0xff61;
const PUNCT_TARGETS = [0x3002, 0x300c, 0x300d, 0x3001, 0x30fb]; // 。「」、・

// U+FF66-U+FF9D: half-width katakana (38 characters), index-aligned.
const KANA_SOURCE_START = 0xff66;
const KANA_TARGETS = [
  0x30f2, // ｦ -> ヲ
  0x30a1,
  0x30a3,
  0x30a5,
  0x30a7,
  0x30a9, // ｧｨｩｪｫ -> ァィゥェォ
  0x30e3,
  0x30e5,
  0x30e7, // ｬｭｮ -> ャュョ
  0x30c3, // ｯ -> ッ
  0x30fc, // ｰ -> ー
  0x30a2,
  0x30a4,
  0x30a6,
  0x30a8,
  0x30aa, // ｱｲｳｴｵ -> アイウエオ
  0x30ab,
  0x30ad,
  0x30af,
  0x30b1,
  0x30b3, // ｶｷｸｹｺ -> カキクケコ
  0x30b5,
  0x30b7,
  0x30b9,
  0x30bb,
  0x30bd, // ｻｼｽｾｿ -> サシスセソ
  0x30bf,
  0x30c1,
  0x30c4,
  0x30c6,
  0x30c8, // ﾀﾁﾂﾃﾄ -> タチツテト
  0x30ca,
  0x30cb,
  0x30cc,
  0x30cd,
  0x30ce, // ﾅﾆﾇﾈﾉ -> ナニヌネノ
  0x30cf,
  0x30d2,
  0x30d5,
  0x30d8,
  0x30db, // ﾊﾋﾌﾍﾎ -> ハヒフヘホ
  0x30de,
  0x30df,
  0x30e0,
  0x30e1,
  0x30e2, // ﾏﾐﾑﾒﾓ -> マミムメモ
  0x30e4,
  0x30e6,
  0x30e8, // ﾔﾕﾖ -> ヤユヨ
  0x30e9,
  0x30ea,
  0x30eb,
  0x30ec,
  0x30ed, // ﾗﾘﾙﾚﾛ -> ラリルレロ
  0x30ef, // ﾜ -> ワ
  0x30f3, // ﾝ -> ン
];

// U+FF9E/FF9F: standalone half-width dakuten/handakuten -> the standard
// SPACING (non-combining) full-width sound marks.
const MARK_SOURCE_START = 0xff9e;
const MARK_TARGETS = [0x309b, 0x309c]; // ﾞﾟ -> ゛゜

const HALFWIDTH_TO_FULLWIDTH = new Map<string, string>();
PUNCT_TARGETS.forEach((code, i) => HALFWIDTH_TO_FULLWIDTH.set(String.fromCharCode(PUNCT_SOURCE_START + i), String.fromCharCode(code)));
KANA_TARGETS.forEach((code, i) => HALFWIDTH_TO_FULLWIDTH.set(String.fromCharCode(KANA_SOURCE_START + i), String.fromCharCode(code)));
MARK_TARGETS.forEach((code, i) => HALFWIDTH_TO_FULLWIDTH.set(String.fromCharCode(MARK_SOURCE_START + i), String.fromCharCode(code)));

// Dakuten/handakuten COMBINING pairs: base full-width kana code point ->
// [voiced code point, semi-voiced code point (0 if none)]. Built the same
// code-point-only way. Only the ハ-series has a real semi-voiced (゜) form;
// ウ's voiced form (ヴ) is a real, standard exception to the simple "+1"
// offset pattern used for the カ/サ/タ/ハ series.
const VOICING: Record<number, [number, number]> = {
  0x30a6: [0x30f4, 0], // ウ -> ヴ (real exception, not base+1)
  0x30ab: [0x30ac, 0], // カ -> ガ
  0x30ad: [0x30ae, 0], // キ -> ギ
  0x30af: [0x30b0, 0], // ク -> グ
  0x30b1: [0x30b2, 0], // ケ -> ゲ
  0x30b3: [0x30b4, 0], // コ -> ゴ
  0x30b5: [0x30b6, 0], // サ -> ザ
  0x30b7: [0x30b8, 0], // シ -> ジ
  0x30b9: [0x30ba, 0], // ス -> ズ
  0x30bb: [0x30bc, 0], // セ -> ゼ
  0x30bd: [0x30be, 0], // ソ -> ゾ
  0x30bf: [0x30c0, 0], // タ -> ダ
  0x30c1: [0x30c2, 0], // チ -> ヂ
  0x30c4: [0x30c5, 0], // ツ -> ヅ
  0x30c6: [0x30c7, 0], // テ -> デ
  0x30c8: [0x30c9, 0], // ト -> ド
  0x30cf: [0x30d0, 0x30d1], // ハ -> バ/パ
  0x30d2: [0x30d3, 0x30d4], // ヒ -> ビ/ピ
  0x30d5: [0x30d6, 0x30d7], // フ -> ブ/プ
  0x30d8: [0x30d9, 0x30da], // ヘ -> ベ/ペ
  0x30db: [0x30dc, 0x30dd], // ホ -> ボ/ポ
};

const HALFWIDTH_DAKUTEN = String.fromCharCode(0xff9e); // ﾞ
const HALFWIDTH_HANDAKUTEN = String.fromCharCode(0xff9f); // ﾟ

/**
 * Converts one half-width katakana/punctuation RUN to its full-width
 * equivalent, combining a base kana with an immediately-following
 * half-width dakuten/handakuten into the single correct voiced/
 * semi-voiced full-width character (e.g. "ｶﾞ" -> "ガ", not "カ゛").
 */
export function convertHalfwidthKanaRun(run: string): string {
  let out = "";
  for (let i = 0; i < run.length; i++) {
    const ch = run[i];
    const mapped = HALFWIDTH_TO_FULLWIDTH.get(ch);
    if (mapped === undefined) {
      out += ch; // defensive: not actually in the half-width block
      continue;
    }
    const next = run[i + 1];
    const baseCode = mapped.codePointAt(0)!;
    const voicing = VOICING[baseCode];
    if (voicing && next === HALFWIDTH_DAKUTEN) {
      out += String.fromCharCode(voicing[0]);
      i += 1;
    } else if (voicing && voicing[1] !== 0 && next === HALFWIDTH_HANDAKUTEN) {
      out += String.fromCharCode(voicing[1]);
      i += 1;
    } else {
      out += mapped;
    }
  }
  return out;
}
