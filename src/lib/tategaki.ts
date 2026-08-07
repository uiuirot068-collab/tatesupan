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

/** A token paired with the [start, end) raw source range it was parsed from. */
export interface OffsetToken {
  token: TategakiToken;
  start: number;
  end: number;
}

/**
 * Parses raw editor text into a flat token stream:
 * ruby notation (｜漢字《かんじ》 or 漢字《かんじ》) becomes `ruby` tokens,
 * tate-chu-yoko candidates (2-digit numbers, !!/!?/?? pairs) become `tcy` tokens,
 * 挿絵 markers become `image` tokens, 改ページ markers become `pageBreak`
 * tokens, everything else stays as `text`.
 */
export function tokenizeTategaki(source: string): TategakiToken[] {
  return tokenizeTategakiWithOffsets(source).map((t) => t.token);
}

/** Same as `tokenizeTategaki`, but retains each token's raw source range. */
export function tokenizeTategakiWithOffsets(source: string): OffsetToken[] {
  const tokens: OffsetToken[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(MARKER_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push(...tokenizeRubyAndTcy(source.slice(lastIndex, index), lastIndex));
    }
    const end = index + match[0].length;
    if (match[1] !== undefined) {
      tokens.push({
        token: {
          type: "image",
          id: match[1],
          widthMm: Number(match[2]),
          heightMm: Number(match[3]),
          position: (match[4] as ImagePosition | undefined) ?? "center",
        },
        start: index,
        end,
      });
    } else {
      tokens.push({ token: { type: "pageBreak" }, start: index, end });
    }
    lastIndex = end;
  }

  if (lastIndex < source.length) {
    tokens.push(...tokenizeRubyAndTcy(source.slice(lastIndex), lastIndex));
  }

  return tokens;
}

function tokenizeRubyAndTcy(source: string, baseOffset: number): OffsetToken[] {
  const tokens: OffsetToken[] = [];
  let lastIndex = 0;

  for (const match of source.matchAll(RUBY_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push(...tokenizePlainText(source.slice(lastIndex, index), baseOffset + lastIndex));
    }
    const base = match[1] ?? match[3] ?? "";
    const rt = match[2] ?? match[4] ?? "";
    tokens.push({
      token: { type: "ruby", base, rt },
      start: baseOffset + index,
      end: baseOffset + index + match[0].length,
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < source.length) {
    tokens.push(...tokenizePlainText(source.slice(lastIndex), baseOffset + lastIndex));
  }

  return tokens;
}

function tokenizePlainText(text: string, baseOffset: number): OffsetToken[] {
  const tokens: OffsetToken[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TCY_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      tokens.push({
        token: { type: "text", value: text.slice(lastIndex, index) },
        start: baseOffset + lastIndex,
        end: baseOffset + index,
      });
    }
    tokens.push({
      token: { type: "tcy", value: match[0] },
      start: baseOffset + index,
      end: baseOffset + index + match[0].length,
    });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({
      token: { type: "text", value: text.slice(lastIndex) },
      start: baseOffset + lastIndex,
      end: baseOffset + text.length,
    });
  }

  return tokens;
}

/** Visual character weight used for page-break accounting. */
function tokenLength(token: TategakiToken): number {
  if (token.type === "text") return token.value.length;
  if (token.type === "ruby") return token.base.length;
  if (token.type === "image") {
    // 挿絵（image）は absolute オーバーレイ描画されるため、本文フローの文字数計算では 0 とする
    return 0;
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
  /** 段組み数（1 または 2）。省略時は1段組として扱う。 */
  columnCount?: number;
  /** 2段組の場合、上段・下段それぞれに収まる行数 */
  linesPerColumn?: number;
}

export const DEFAULT_PAGE_LINE_METRICS: PageLineMetrics = {
  charsPerLine: 20,
  linesPerPage: 40,
};

/**
 * One paginated page. `tokens` is always the full flat token stream for the
 * page (used for 1段組 rendering and paragraph-start accounting); `columns`
 * is populated only for 2段組 pages with the tokens already bucketed into
 * `[topTokens, bottomTokens]` by the same line-wrap pass that produced
 * `tokens`, so no downstream recomputation of the split point is needed.
 */
export interface TategakiPage {
  tokens: TategakiToken[];
  columns: [TategakiToken[], TategakiToken[]] | null;
}

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
): TategakiPage[] {
  const charsPerLine = Math.max(Math.floor(metrics.charsPerLine), 1);
  const linesPerPage = Math.max(Math.floor(metrics.linesPerPage), 1);
  const columnCount = metrics.columnCount === 2 ? 2 : 1;
  const linesPerColumn =
    columnCount === 2
      ? Math.max(Math.floor(metrics.linesPerColumn || linesPerPage / 2), 1)
      : linesPerPage;
  return paginateTokensByLines(tokens, charsPerLine, linesPerPage, columnCount, linesPerColumn);
}

function paginateTokensByLines(
  tokens: TategakiToken[],
  charsPerLine: number,
  linesPerPage: number,
  columnCount: number,
  linesPerColumn: number
): TategakiPage[] {
  const pages: TategakiPage[] = [];
  let currentPage: TategakiToken[] = [];
  let topTokens: TategakiToken[] = [];
  let bottomTokens: TategakiToken[] = [];
  // Lines already completed on the current page, and characters placed on
  // the current (still-open) line.
  let lineIndex = 0;
  let lineChars = 0;

  // Bucket every token into top/bottom as it's placed, in the same pass that
  // decides which line it lands on — avoids a second, separately-accounted
  // pass over an already-paginated page (which drifted from the real line
  // count whenever ruby/tcy tokens, with their non-1:1 char-to-token ratio,
  // were mixed into the flow, causing large chunks of text to vanish).
  const placeToken = (token: TategakiToken) => {
    currentPage.push(token);
    if (columnCount === 2) {
      (lineIndex < linesPerColumn ? topTokens : bottomTokens).push(token);
    }
  };

  const pushPage = (force = false) => {
    if (currentPage.length > 0 || force) {
      pages.push({
        tokens: currentPage,
        columns: columnCount === 2 ? [topTokens, bottomTokens] : null,
      });
    }
    currentPage = [];
    topTokens = [];
    bottomTokens = [];
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
          placeToken({ type: "text", value: "\n" });
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
          placeToken({ type: "text", value: value.slice(i, j) });
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
    placeToken(token);
    lineChars += length;
    if (lineChars >= charsPerLine) {
      breakLine();
    }
  }

  pushPage();

  return pages.length > 0
    ? pages
    : [{ tokens: [], columns: columnCount === 2 ? [[], []] : null }];
}

/**
 * Same pagination as `paginateTokens`, but reports each page's raw source
 * character range `[start, end)` instead of its tokens — used to map an
 * editor caret position (a raw character index) back to a page number.
 * Mirrors `paginateTokensByLines`'s line-wrap accounting exactly so page
 * boundaries always agree with what's actually rendered.
 */
export function computePageSourceRanges(
  source: string,
  metrics: PageLineMetrics = DEFAULT_PAGE_LINE_METRICS
): Array<{ start: number; end: number }> {
  const charsPerLine = Math.max(Math.floor(metrics.charsPerLine), 1);
  const linesPerPage = Math.max(Math.floor(metrics.linesPerPage), 1);
  const offsetTokens = tokenizeTategakiWithOffsets(source);

  const ranges: Array<{ start: number; end: number }> = [];
  let pageStart: number | null = null;
  let pageEnd = 0;
  let lineIndex = 0;
  let lineChars = 0;

  const pushPage = (force = false) => {
    if (pageStart !== null || force) {
      ranges.push({ start: pageStart ?? pageEnd, end: pageEnd });
    }
    pageStart = null;
    lineIndex = 0;
    lineChars = 0;
  };

  const mark = (start: number, end: number) => {
    if (pageStart === null) pageStart = start;
    pageEnd = end;
  };

  const breakLine = () => {
    lineIndex += 1;
    lineChars = 0;
    if (lineIndex >= linesPerPage) {
      pushPage();
    }
  };

  for (const { token, start, end } of offsetTokens) {
    if (token.type === "pageBreak") {
      pushPage(true);
      continue;
    }

    if (token.type === "text") {
      let i = 0;
      const value = token.value;
      while (i < value.length) {
        if (value[i] === "\n") {
          mark(start + i, start + i + 1);
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
          mark(start + i, start + j);
          lineChars += j - i;
          i = j;
        }
        if (lineChars >= charsPerLine) {
          breakLine();
        }
      }
      continue;
    }

    const length = tokenLength(token);
    if (lineChars > 0 && lineChars + length > charsPerLine) {
      breakLine();
    }
    mark(start, end);
    lineChars += length;
    if (lineChars >= charsPerLine) {
      breakLine();
    }
  }

  pushPage();

  if (ranges.length === 0) ranges.push({ start: 0, end: source.length });
  return ranges;
}

/**
 * Maps a raw editor caret position (character index into the full document
 * source) to its 0-based page index, per `computePageSourceRanges`. Indices
 * that fall in the gap between two pages (e.g. right after a page-break
 * marker) resolve to the following page; indices past the end resolve to
 * the last page.
 */
export function findPageIndexForCharIndex(
  ranges: Array<{ start: number; end: number }>,
  charIndex: number
): number {
  if (ranges.length === 0) return 0;
  for (let i = 0; i < ranges.length; i++) {
    if (charIndex < ranges[i].end || i === ranges.length - 1) return i;
  }
  return ranges.length - 1;
}

export function countVisualLength(source: string): number {
  return tokenizeTategaki(source).reduce((sum, t) => sum + tokenLength(t), 0);
}

/**
 * A bare newline is always emitted by `paginateTokensByLines` as its own
 * single-character text token (never merged with surrounding characters),
 * so it doubles as the paragraph-boundary marker for indent rendering.
 */
function isBareNewline(token: TategakiToken): boolean {
  return token.type === "text" && token.value === "\n";
}

/**
 * Flags which tokens begin a new paragraph — immediately after an explicit
 * newline, or the first token when `startsNewParagraph` is true — so the
 * renderer can apply 一字下げ (indent) only at genuine paragraph starts, not
 * at every mid-paragraph line wrap.
 */
export function computeParagraphStartFlags(
  tokens: TategakiToken[],
  startsNewParagraph: boolean
): boolean[] {
  const flags: boolean[] = [];
  let pending = startsNewParagraph;
  for (const token of tokens) {
    if (isBareNewline(token)) {
      flags.push(false);
      pending = true;
      continue;
    }
    flags.push(pending);
    pending = false;
  }
  return flags;
}

/**
 * For each page produced by `paginateTokens`, whether its first content
 * token begins a genuine new paragraph, as opposed to continuing a
 * paragraph that pagination cut off mid-sentence at the page boundary.
 */
export function computePageParagraphStarts(pages: TategakiPage[]): boolean[] {
  const flags: boolean[] = [];
  let pending = true;
  for (const page of pages) {
    let pageFlag: boolean | null = null;
    for (const token of page.tokens) {
      if (isBareNewline(token)) {
        pending = true;
        continue;
      }
      if (pageFlag === null) pageFlag = pending;
      pending = false;
    }
    flags.push(pageFlag ?? pending);
  }
  return flags;
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
