/**
 * CST-PORT-011: 表紙・背表紙の文字の約束（COLUMNSTAND `coverText.ts` の移植）。
 *
 * 縦中横の判定は本文と同じトークナイザ（`tokenizeTategaki`）に任せる:
 *   - 明示 `[tate]A5[/tate]`
 *   - 前後を数字に挟まれない2桁の半角数字（"12" は縦中横、"123" は違う）、!!/!? など
 * 表紙・背ではルビを描かない。ルビ記法は親文字だけにして、｜漢字《かんじ》 の
 * 記号が印刷に出ないようにする。挿絵・改ページの記法は表紙では何も描かない。
 */
import { tokenizeTategaki } from "../tategaki";

export type CoverInlineSegment = { kind: "text"; value: string } | { kind: "tcy"; value: string };

export function coverInlineSegments(source: string): CoverInlineSegment[] {
  const segments: CoverInlineSegment[] = [];
  for (const token of tokenizeTategaki(source)) {
    if (token.type === "tcy") {
      segments.push({ kind: "tcy", value: token.value });
      continue;
    }
    if (token.type !== "text" && token.type !== "ruby") continue;
    const value = token.type === "ruby" ? token.base : token.value;
    const previous = segments[segments.length - 1];
    if (previous?.kind === "text") {
      previous.value += value;
    } else if (value) {
      segments.push({ kind: "text", value });
    }
  }
  return segments;
}

/** 横組み: 縦中横の記法は意味がないので文字だけにする。 */
export function coverPlainText(source: string): string {
  return coverInlineSegments(source)
    .map((segment) => segment.value)
    .join("");
}

export function hasRubyMarkup(source: string): boolean {
  return tokenizeTategaki(source).some((token) => token.type === "ruby");
}

/** 縦組みの字数（縦中横のまとまりは1字分）。 */
export function verticalGlyphCount(source: string): number {
  return coverInlineSegments(source).reduce(
    (total, segment) => total + (segment.kind === "tcy" ? 1 : Array.from(segment.value).length),
    0,
  );
}

/**
 * 背文字は常に1本の縦列。「項目ごと」はタイトル → 巻数 → 著者名の順、
 * 「自由入力」は改行ごとの区切りを同じ1本の列の中の間隔として並べる。
 */
export function spineTextParts(spine: {
  textMode: "template" | "free";
  title: string;
  volume: string;
  author: string;
  freeText: string;
}): string[] {
  const raw = spine.textMode === "free" ? spine.freeText.split(/\r?\n/) : [spine.title, spine.volume, spine.author];
  return raw.filter((part) => part.trim().length > 0);
}

export const SPINE_LETTER_SPACING_EM = 0.08;
export const SPINE_PART_GAP_EM = 1;

/** 背文字1本の長さの目安（mm）。注意の表示だけに使う。 */
export function estimateSpineTextLengthMm(parts: string[], fontMm: number): number {
  if (parts.length === 0) return 0;
  const glyphs = parts.reduce((total, part) => total + verticalGlyphCount(part), 0);
  return glyphs * fontMm * (1 + SPINE_LETTER_SPACING_EM) + (parts.length - 1) * fontMm * SPINE_PART_GAP_EM;
}
