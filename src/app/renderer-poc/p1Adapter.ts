/**
 * TateSpun Renderer PoC — Phase P1: Token → HTML adapter.
 *
 * 既存 lib/tategaki.ts の `tokenizeTategaki()` が生成する `TategakiToken[]`
 * を、paged-media engine(Vivliostyle, repo外scratch PoC)へ渡せる安全な
 * HTML文書文字列へ変換する。
 *
 * 禁止事項の再確認(P1指示 section 3/11):
 * - paginateTokensByLines() / buildLineSlots() / FixedSlotLine は使用しない
 * - 文字単位のabsolute配置・slotIndex・glyph offsetは行わない
 * - TategakiPage[]（FixedSlot用ページ分割結果）へは変換しない
 *
 * ここでの「pagination」はcolumn/pageへの折返しを一切含まない —— それは
 * paged-media engine(Vivliostyle)側の仕事。このadapterがやるのは
 * 「\n単位の段落分割」と「トークンをsemantic HTMLへ落とすこと」だけ
 * （P0-Aのconvert.tsと同じ設計方針。pageBreak/imageトークンの扱いのみ
 * P0-Aでは対象外だったため今回新たに追加する）。
 */
import { tokenizeTategaki, type TategakiToken } from "@/lib/tategaki";

// 会話文（かぎ括弧などで始まる段落）は一字下げしない、という組版慣行。
// P0-Aのconvert.tsと同じ文字集合をこのファイル内で独立に再現する。
const OPENING_BRACKETS = "「『（〈《【〔［｛“‘";
const INDENT_SPACE = "　"; // U+3000: 原稿側の手動字下げと二重にならないよう検出する

/** \n区切りの1行(=段落開始単位)。pageBreakトークンは独立したブロックとして扱う。 */
type P1Block =
  | { kind: "paragraph"; tokens: TategakiToken[]; autoIndent: boolean }
  | { kind: "pageBreak" };

function firstVisibleChar(token: TategakiToken): string {
  if (token.type === "ruby") return token.base.charAt(0);
  if (token.type === "tcy") return token.value.charAt(0);
  if (token.type === "text") return token.value.charAt(0);
  if (token.type === "image") return "";
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
 * 生のTateSpun原稿テキストを、\n区切りの段落ブロックへ分解する。
 * pageBreakトークンは独立した`{kind:"pageBreak"}`ブロックとして流れを
 * 断ち切る（そのトークン自体は消失させず、後段でsemanticな改ページ
 * markerへ変換する）。imageトークンはconvert.ts(P0-A)と異なり、ここでは
 * 「消失させない」という指示に従い、段落内のインラインプレースホルダー
 * として保持する（token streamから読み飛ばさない）。
 */
export function splitIntoP1Blocks(source: string): P1Block[] {
  const tokens = tokenizeTategaki(source);
  const lines: TategakiToken[][] = [[]];
  const blocks: P1Block[] = [];

  const flushLines = () => {
    for (const lineTokens of lines) {
      blocks.push({ kind: "paragraph", tokens: lineTokens, autoIndent: needsAutoIndent(lineTokens) });
    }
    lines.length = 0;
    lines.push([]);
  };

  for (const token of tokens) {
    if (token.type === "pageBreak") {
      flushLines();
      blocks.push({ kind: "pageBreak" });
      continue;
    }
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
  flushLines();

  return blocks;
}

/**
 * HTML特殊文字のescape。adapterがraw source由来の文字列(text/ruby base・
 * rt/tcy value/image id)をHTML文字列へ直接埋め込む唯一の箇所であり、
 * ここを通さない文字列を出力へ混ぜてはならない(P1 section 6のセキュリティ
 * 要件: 「raw sourceを危険なinnerHTMLとしてそのまま渡さない」)。
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function tokenToHtml(token: TategakiToken): string {
  if (token.type === "ruby") {
    return `<ruby>${escapeHtml(token.base)}<rt>${escapeHtml(token.rt)}</rt></ruby>`;
  }
  if (token.type === "tcy") {
    return `<span class="p1-tcy">${escapeHtml(token.value)}</span>`;
  }
  if (token.type === "image") {
    // Phase P1: 実画像は解決しない安全なplaceholder。tokenのid/position情報は
    // 保持したままdata属性へ載せ、token自体を消失させない。
    // <p>の子要素になり得るため、block要素(<div>)ではなくinline要素(<span>)
    // で保持する — HTML5のcontent model上<p>内にblock要素は置けず、
    // <div>のままだとHTMLパーサが<p>を暗黙終了し段落/indent構造が崩れうる。
    return (
      `<span class="p1-image-placeholder" data-image-id="${escapeHtml(token.id)}" ` +
      `data-position="${escapeHtml(token.position)}">［挿絵: ${escapeHtml(token.id)}］</span>`
    );
  }
  if (token.type === "pageBreak") return ""; // splitIntoP1Blocks never places this in a paragraph's tokens
  // text
  return escapeHtml(token.value);
}

function blockToHtml(block: P1Block): string {
  if (block.kind === "pageBreak") {
    // CSS Fragmentationの標準的な明示改ページ手法。空要素だが
    // break-after:page で次のcontentを新しいpageへ強制的に送る
    // (P0-B2で確認したVivliostyleのpage-box機構と同じ標準CSSプロパティ)。
    return `<div class="p1-page-break" aria-hidden="true"></div>`;
  }
  const cls = block.autoIndent ? "" : " no-indent";
  if (block.tokens.length === 0) {
    // 空行: 段落間の空きを1行分確保する(P0-AのTokenView同様、ゼロ幅スペース)。
    return `<p class="p1-para${cls}">​</p>`;
  }
  const inner = block.tokens.map(tokenToHtml).join("");
  return `<p class="p1-para${cls}">${inner}</p>`;
}

export interface P1DocumentOptions {
  fontFamily: string;
  /**
   * 診断専用の2D grid overlayを表示するか(既定false)。DIAGNOSTIC OVERLAY
   * ONLY — layout計算には一切使わない。CSS `position: fixed` はCSS Paged
   * Mediaの仕様上ページごとに繰り返し描画される(running header/footerと
   * 同じ仕組み)ため、body直下に1個置くだけで生成された全pageへ同じgrid
   * が重なる。glyphをgridへ吸着させる・grid単位でabsolute配置するといった
   * 補正は一切行わない —— ブラウザ/Vivliostyleが自然に配置した結果へ、
   * 観察用の目盛りを重ねて表示するだけ。
   */
  grid: boolean;
}

const DEFAULT_OPTIONS: P1DocumentOptions = {
  fontFamily: '"Noto Serif JP", serif',
  grid: false,
};

/**
 * TategakiToken[]から、A5 paged-media向けの完全なHTML文書文字列を組み立てる。
 * P0-B/P0-B2で検証済みの@page/typography設定(148mm×210mm, margin18mm,
 * writing-mode:vertical-rl, text-orientation:mixed, line-break:strict)を
 * そのまま踏襲する — このPoCが検証したいのは「安全にtokenを渡せるか」
 * であって、typography自体はP0-B/B2で既にPASS済みのため変更しない。
 */
export function tokensToP1Document(source: string, options: Partial<P1DocumentOptions> = {}): string {
  const { fontFamily, grid } = { ...DEFAULT_OPTIONS, ...options };
  const blocks = splitIntoP1Blocks(source);
  const body = blocks.map(blockToHtml).join("\n");
  // body直下の直接の子として置く(<p>の中には入れない)。CSS content model上
  // <p>はphrasing contentしか許さないため、他要素と同じ理由でここでも
  // 段落タグの外に置く必要がある(P1-A image placeholderの修正と同じ配慮)。
  const gridOverlay = grid ? `<div class="p1-diag-grid" aria-hidden="true"></div>\n` : "";

  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>TateSpun P1 Adapter Output</title>
<link
  href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700&family=Shippori+Mincho:wght@400;700&display=swap"
  rel="stylesheet"
/>
<style>
  @page { size: 148mm 210mm; margin: 18mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    line-break: strict;
    word-break: normal;
    overflow-wrap: normal;
    font-family: ${fontFamily};
    font-size: 9pt;
    line-height: 1.7;
    color: #000;
  }
  p.p1-para { margin: 0; text-indent: 1em; }
  p.p1-para.no-indent { text-indent: 0; }
  .p1-tcy { text-combine-upright: all; }
  rt { font-size: 0.5em; }
  .p1-page-break { break-after: page; }
  .p1-image-placeholder {
    writing-mode: horizontal-tb;
    display: inline-block;
    border: 1px dashed #999;
    padding: 4px 8px;
    font-size: 8pt;
    color: #666;
  }
  /*
   * --- P1 diagnostic 2D grid overlay (visual QA only) ---
   * position: fixed はCSS Paged Mediaの仕様でページごとに繰り返し描画
   * される(running header/footerと同じ機構)ため、1個の要素だけで全page
   * へ同じgridが重なる。pointer-events/z-indexはUI操作を奪わないための
   * 保険。glyph配置には一切関与しない — 純粋な背景画像レイヤー。
   *
   * 縦線(vertical): column境界(赤、5.4mm間隔 = 9pt文字サイズ×1.7行間)と
   * column中心線(青、境界から半column=2.7mmずらした位置)の2層。
   * 横線(horizontal): 1文字送り相当の基準線(緑、9pt=1em間隔)。
   */
  .p1-diag-grid {
    position: fixed;
    inset: 18mm;
    pointer-events: none;
    z-index: 9999;
    background-image:
      repeating-linear-gradient(
        to left,
        rgba(220, 0, 0, 0.4) 0,
        rgba(220, 0, 0, 0.4) 0.5px,
        transparent 0.5px,
        transparent calc(9pt * 1.7)
      ),
      repeating-linear-gradient(
        to left,
        transparent 0,
        transparent calc(9pt * 1.7 / 2 - 0.25px),
        rgba(0, 90, 220, 0.45) calc(9pt * 1.7 / 2 - 0.25px),
        rgba(0, 90, 220, 0.45) calc(9pt * 1.7 / 2 + 0.25px),
        transparent calc(9pt * 1.7 / 2 + 0.25px),
        transparent calc(9pt * 1.7)
      ),
      repeating-linear-gradient(
        to bottom,
        rgba(0, 150, 0, 0.35) 0,
        rgba(0, 150, 0, 0.35) 0.5px,
        transparent 0.5px,
        transparent 9pt
      );
  }
</style>
</head>
<body>
${gridOverlay}${body}
</body>
</html>
`;
}

/** token count only (metrics用)。ここではsplit/変換は行わず単純にトークン総数を返す。 */
export function countTokens(source: string): number {
  return tokenizeTategaki(source).length;
}
