/** 挿絵の配置位置: 天側（上部）/ 中央 / 地側（下部）/ ページ全体 */
export type ImagePosition = "top" | "center" | "bottom" | "full";

export type TategakiToken =
  | { type: "text"; value: string }
  | { type: "ruby"; base: string; rt: string }
  | { type: "tcy"; value: string }
  | { type: "image"; id: string; widthMm: number; heightMm: number; position: ImagePosition }
  | { type: "pageBreak" };

const RUBY_PATTERN = /｜([^｜《》\n]+)《([^《》\n]+)》|([一-龠々〆ヵヶ]+)《([^《》\n]+)》/g;
const TCY_PATTERN = /(?<!\d)\d{2}(?!\d)|[!?！？]{2}(?![!?！？])/g;
// 挿絵 marker embedded in the raw text: 【IMG:<id>:<widthMm>:<heightMm>:<position>】
// (the trailing :<position> is optional for backward compatibility with
// documents saved before positioning was introduced; it defaults to "center")
// 改ページ marker: 【改ページ】
export const PAGE_BREAK_MARKER = "【改ページ】";
const MARKER_PATTERN =
  /【IMG:([^:]+):([\d.]+):([\d.]+)(?::(top|center|bottom|full))?】|【改ページ】/g;

/**
 * Parses raw editor text into a flat token stream:
 * ruby notation (｜漢字《かんじ》 or 漢字《かんじ》) becomes `ruby` tokens,
 * tate-chu-yoko candidates (2-digit numbers, !!/!?/?? pairs) become `tcy` tokens,
 * 挿絵 markers become `image` tokens, 改ページ markers become `pageBreak`
 * tokens, everything else stays as `text`.
 */
export function tokenizeTategaki(source: string): TategakiToken[] {
  const tokens: TategakiToken[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(MARKER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push(...tokenizeRubyAndTcy(source.slice(lastIndex, index)));
    }
    if (match[1] !== undefined) {
      tokens.push({
        type: "image",
        id: match[1],
        widthMm: Number(match[2]),
        heightMm: Number(match[3]),
        position: (match[4] as ImagePosition | undefined) ?? "center",
      });
    } else {
      tokens.push({ type: "pageBreak" });
    }
    lastIndex = index + match[0].length;
  }

  if (lastIndex < source.length) {
    tokens.push(...tokenizeRubyAndTcy(source.slice(lastIndex)));
  }

  return tokens;
}

function tokenizeRubyAndTcy(source: string): TategakiToken[] {
  const tokens: TategakiToken[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(RUBY_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push(...tokenizePlainText(source.slice(lastIndex, index)));
    }
    const base = match[1] ?? match[3] ?? "";
    const rt = match[2] ?? match[4] ?? "";
    tokens.push({ type: "ruby", base, rt });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < source.length) {
    tokens.push(...tokenizePlainText(source.slice(lastIndex)));
  }

  return tokens;
}

function tokenizePlainText(text: string): TategakiToken[] {
  const tokens: TategakiToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TCY_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({ type: "text", value: text.slice(lastIndex, index) });
    }
    tokens.push({ type: "tcy", value: match[0] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: "text", value: text.slice(lastIndex) });
  }

  return tokens;
}

/** Visual character weight used for page-break accounting. */
function tokenLength(token: TategakiToken): number {
  if (token.type === "text") return token.value.length;
  if (token.type === "ruby") return token.base.length;
  if (token.type === "image") {
    // No font metrics available at this layer; approximate the vertical
    // space an image occupies as character cells (~5mm per cell).
    return Math.max(1, Math.round(token.heightMm / 5));
  }
  if (token.type === "pageBreak") return 0; // forces a break, occupies no space
  return 1; // a tate-chu-yoko pair occupies a single character cell
}

/** Line metrics a page is paginated against — see `computePageLayout`. */
export interface PageLineMetrics {
  /** 1段（縦書きの1行）に収まる文字数 */
  charsPerLine: number;
  /** 1ページに収まる行（段）数 */
  linesPerPage: number;
}

export const DEFAULT_PAGE_LINE_METRICS: PageLineMetrics = {
  charsPerLine: 20,
  linesPerPage: 40,
};

/**
 * Splits a token stream into pages that fit within `charsPerLine` ×
 * `linesPerPage`. Explicit newlines end their line early — just as
 * `white-space: pre-wrap` renders them in the browser — so the character
 * budget accounts for the space they waste at the end of a line instead of
 * assuming every line is filled to capacity. Without this, pages would be
 * assigned more text than actually fits in the rendered box, and the
 * overflowing tail would be clipped rather than carried to the next page.
 * Ruby and tate-chu-yoko tokens are never split; only plain text tokens can
 * break mid-token.
 */
export function paginateTokens(
  tokens: TategakiToken[],
  metrics: PageLineMetrics = DEFAULT_PAGE_LINE_METRICS
): TategakiToken[][] {
  const charsPerLine = Math.max(Math.floor(metrics.charsPerLine), 1);
  const linesPerPage = Math.max(Math.floor(metrics.linesPerPage), 1);
  return paginateTokensByLines(tokens, charsPerLine, linesPerPage);
}

function paginateTokensByLines(
  tokens: TategakiToken[],
  charsPerLine: number,
  linesPerPage: number
): TategakiToken[][] {
  const pages: TategakiToken[][] = [];
  let currentPage: TategakiToken[] = [];
  // Lines already completed on the current page, and characters placed on
  // the current (still-open) line.
  let lineIndex = 0;
  let lineChars = 0;

  const pushPage = (force = false) => {
    if (currentPage.length > 0 || force) {
      pages.push(currentPage);
    }
    currentPage = [];
    lineIndex = 0;
    lineChars = 0;
  };

  const breakLine = () => {
    lineIndex += 1;
    lineChars = 0;
    if (lineIndex >= linesPerPage) {
      pushPage();
    }
  };

  for (const token of tokens) {
    if (token.type === "pageBreak") {
      // Manual page break: always flush, even mid-page or on an empty page,
      // so an explicit break reliably sends the following content to the next page.
      pushPage(true);
      continue;
    }

    if (token.type === "text") {
      let i = 0;
      const value = token.value;
      while (i < value.length) {
        if (value[i] === "\n") {
          currentPage.push({ type: "text", value: "\n" });
          i += 1;
          breakLine();
          continue;
        }
        const room = charsPerLine - lineChars;
        let j = i;
        while (j < value.length && value[j] !== "\n" && j - i < room) {
          j += 1;
        }
        if (j > i) {
          currentPage.push({ type: "text", value: value.slice(i, j) });
          lineChars += j - i;
          i = j;
        }
        if (lineChars >= charsPerLine) {
          breakLine();
        }
      }
      continue;
    }

    // Atomic (unsplittable) token: start a fresh line first if it wouldn't
    // fit on the remainder of the current one.
    const length = tokenLength(token);
    if (lineChars > 0 && lineChars + length > charsPerLine) {
      breakLine();
    }
    currentPage.push(token);
    lineChars += length;
    if (lineChars >= charsPerLine) {
      breakLine();
    }
  }

  pushPage();

  return pages.length > 0 ? pages : [[]];
}

export function countVisualLength(source: string): number {
  return tokenizeTategaki(source).reduce((sum, t) => sum + tokenLength(t), 0);
}

/** Reverses `tokenizeTategaki`, re-serializing ruby/image tokens back to their marker form. */
export function detokenizeTategaki(tokens: TategakiToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === "ruby") return `｜${token.base}《${token.rt}》`;
      if (token.type === "image") {
        return `【IMG:${token.id}:${token.widthMm}:${token.heightMm}:${token.position}】`;
      }
      if (token.type === "pageBreak") return PAGE_BREAK_MARKER;
      return token.value;
    })
    .join("");
}
