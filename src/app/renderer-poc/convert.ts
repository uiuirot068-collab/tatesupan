/**
 * TateSpun Renderer PoC (Phase P0-A) 専用の変換処理。
 *
 * 既存 lib/tategaki.ts の tokenizer をそのまま再利用し(未改変)、ruby/TCY
 * 記法の解釈だけを既存実装に委ねる。pagination(charsPerLine折返し・kinsoku
 * ・改ページ)は一切再現しない —— それはこのPoCが「ブラウザに任せられる
 * か」を確認したい対象そのものなので、意図的に実装しない。
 *
 * ここでやるのは「\n単位で行(=TateSpunの段落開始単位)に割る」ことだけ。
 * lib/tategaki.ts の computeParagraphStartFlags と同じ規則(改行直後は
 * 新しい段落)に従う。
 */
import { tokenizeTategaki, type TategakiToken } from "@/lib/tategaki";

// 会話文（かぎ括弧などで始まる段落）は一字下げしない、という組版慣行。
// PageCard.tsx の OPENING_BRACKETS と同じ文字集合をPoC側で独立に再現する
// (指示により既存実装からのimportはせず、PoC内で完結させる)。
const OPENING_BRACKETS = "「『（〈《【〔［｛“‘";
const INDENT_SPACE = "　"; // U+3000: 原稿側の手動字下げと二重にならないよう検出する

export interface PocLine {
  key: string;
  tokens: TategakiToken[];
  /** 段落先頭への1em自動字下げを適用してよいか */
  autoIndent: boolean;
}

function firstVisibleChar(token: TategakiToken): string {
  if (token.type === "ruby") return token.base.charAt(0);
  if (token.type === "tcy") return token.value.charAt(0);
  if (token.type === "text") return token.value.charAt(0);
  return "";
}

function needsAutoIndent(tokens: TategakiToken[]): boolean {
  const first = tokens[0];
  if (!first) return false;
  const ch = firstVisibleChar(first);
  if (!ch) return false;
  return !OPENING_BRACKETS.includes(ch) && ch !== INDENT_SPACE;
}

/**
 * 生のTateSpun原稿テキストを、\n区切りの行(=段落開始単位)へ分解する。
 * tokenizeTategaki() の出力はtext token内に\nを含み得るため、text token
 * だけをこの関数側で\n位置に分割する。ruby/tcyトークンは\nを含まない
 * (tokenizer側の仕様)ためそのまま1行へ積む。
 *
 * image/pageBreakトークンはこのPoCの検証範囲外(golden corpusに含まれない
 * ため実際には出現しない想定)として読み飛ばす。
 */
export function splitIntoPocLines(source: string): PocLine[] {
  const tokens = tokenizeTategaki(source);
  const lines: TategakiToken[][] = [[]];

  for (const token of tokens) {
    if (token.type === "image" || token.type === "pageBreak") continue;
    if (token.type !== "text" || !token.value.includes("\n")) {
      lines[lines.length - 1].push(token);
      continue;
    }
    const parts = token.value.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part.length > 0) lines[lines.length - 1].push({ type: "text", value: part });
    });
  }

  return lines.map((lineTokens, index) => ({
    key: `line-${index}`,
    tokens: lineTokens,
    autoIndent: needsAutoIndent(lineTokens),
  }));
}
