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
export function tokenLength(token: TategakiToken): number {
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
  /**
   * `tokens` grouped into explicit rendered lines (each the tokens placed
   * before one `breakLine()` call). Rendering one line element per entry
   * here — instead of letting the browser's own word-wrap decide where a
   * line ends — keeps the DOM's line boundaries identical to what
   * pagination already decided, so a line can never silently absorb an
   * extra (or one fewer) character than `charsPerLine` allows.
   */
  lines: TategakiToken[][];
  /** Same per-line grouping as `lines`, pre-split into [topLines, bottomLines] for 2段組 pages. */
  columnLines: [TategakiToken[][], TategakiToken[][]] | null;
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

/**
 * The two doubled-punctuation "families" Japanese typesetting treats as a
 * single glyph pair (――, ……) — matches the families PageCard.tsx's own
 * nowrap-rendering pattern recognizes (`[―—]{2,}` / `[…‥]{2,}`), so
 * pagination and rendering agree on what counts as one run. A dash directly
 * followed by an ellipsis (mixed families) is not a recognized run.
 */
const NOWRAP_RUN_FAMILIES: readonly RegExp[] = [/[―—]/, /[…‥]/];

function nowrapRunFamily(char: string): RegExp | null {
  for (const family of NOWRAP_RUN_FAMILIES) {
    if (family.test(char)) return family;
  }
  return null;
}

/**
 * If `splitIndex` lands inside a same-family run of ―― / …… characters,
 * snaps it down to the nearest point that keeps every fragment placed on
 * this line at least 2 characters long — these doubled marks read as a
 * single glyph pair, so splitting them 1+1 (or stranding a lone ― / … next
 * to unrelated text) looks like a typo rather than the intended mark. Runs
 * longer than 2 may still be split at any even offset (2, 4, 6, …), so a
 * long "……………" can wrap in 2-character chunks; a run whose *total* length
 * is odd may still end with a 1-character fragment on its very last line,
 * since no split point can avoid that.
 *
 * When fewer than 2 run characters fit before `splitIndex` (so no in-run
 * snap point exists), the whole run is deferred to the next line instead —
 * this is always preferred over a 1+1 split, and unlike the old
 * `allowDefer`-gated version, doesn't require the caller's line to already
 * hold content: deferring only needs `runStart > minIndex` (i.e. at least
 * one ordinary character still lands on this line), which room-limited
 * `splitIndex` guarantees for any `charsPerLine >= 2`. The sole case that
 * can't defer is `charsPerLine === 1` landing exactly on the run's first
 * character — a single-cell line has no room for even one character ahead
 * of the run, so no split can avoid separating the pair there; `allowDefer`
 * (true once this line already holds something from an earlier token)
 * still permits deferring even then, since the line isn't left empty.
 */
function adjustSplitForNowrapRun(
  value: string,
  splitIndex: number,
  minIndex: number,
  allowDefer: boolean
): number {
  if (splitIndex <= minIndex || splitIndex >= value.length) return splitIndex;
  const family = nowrapRunFamily(value[splitIndex - 1]);
  if (!family || !family.test(value[splitIndex])) return splitIndex;

  let runStart = splitIndex - 1;
  while (runStart > minIndex && family.test(value[runStart - 1])) runStart -= 1;

  const offsetIntoRun = splitIndex - runStart;
  const snapped = offsetIntoRun % 2 === 0 ? offsetIntoRun : offsetIntoRun - 1;
  if (snapped >= 2) return runStart + snapped;
  if (runStart > minIndex) return runStart;
  return allowDefer ? runStart : splitIndex;
}

/**
 * 行頭禁則: characters that must never begin a line — closing brackets,
 * common punctuation, small kana, the prolonged sound mark, and iteration
 * marks.
 */
const LINE_START_PROHIBITED = new Set(
  "、。，．！？‼⁉）］｝〕〉》」』】〙〗ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶー々ゝゞヽヾ"
);

/** 行末禁則: opening brackets, which must never end a line. */
const LINE_END_PROHIBITED = new Set("（［｛〔〈《「『【〘〖");

export function isLineStartProhibited(char: string): boolean {
  return LINE_START_PROHIBITED.has(char);
}

export function isLineEndProhibited(char: string): boolean {
  return LINE_END_PROHIBITED.has(char);
}

/**
 * Adjusts a naive split point `splitIndex` (`value.slice(minIndex,
 * splitIndex)` is about to become this line's content) so it never leaves
 * an opening bracket as the line's last character, nor a closing bracket /
 * small kana / prolonged mark / iteration mark as the next line's first.
 *
 * Both cases are resolved the same way — 追い出し (pushing characters off
 * this line onto the next) — and never by 追い込み (pulling characters from
 * the next line onto this one past `charsPerLine`): this line's rendered
 * column has a fixed height sized for exactly `charsPerLine` characters
 * (see PageCard.tsx), so growing a line past that count would overflow the
 * column box and clip under `overflow: hidden`. Retreating only ever
 * shrinks a line, never grows one, so every line this function produces
 * still satisfies charCount <= charsPerLine.
 *
 * - 行末禁則 (line-end): while the character just before the split is
 *   prohibited there (an opening bracket), the split backs off by one.
 * - 行頭禁則 (line-start): while the character at the split is prohibited
 *   there (a closing bracket / small kana / prolonged mark / iteration
 *   mark), the split backs off by one more instead of advancing — this
 *   carries at least one preceding ordinary character over to the next
 *   line together with the run of prohibited characters, so the next line
 *   no longer starts with one.
 *
 * Both checks run in the same loop so a mixed run (e.g. an opening bracket
 * immediately followed by prohibited-start punctuation) resolves in one
 * pass. When `allowFullDefer` is false, backing off stops one character
 * short of `minIndex` instead of reaching it — guaranteeing at least one
 * character still lands on this line — for the same reason as
 * `adjustSplitForNowrapRun`'s `allowDefer`: an already-empty line can't be
 * allowed to defer *everything* it's handed, or it spins forever
 * re-deferring the same unplaced text. This is a one-character floor, not
 * "skip backing off altogether" — a line that already holds a few
 * characters before hitting a trailing bracket run still gets every one of
 * them pushed off, `allowFullDefer` or not.
 *
 * Only ever moves within `[minIndex, value.length]`, so it can neither
 * strand nor duplicate characters.
 */
function adjustSplitForKinsoku(
  value: string,
  minIndex: number,
  splitIndex: number,
  allowFullDefer: boolean
): number {
  let j = splitIndex;
  const backOffFloor = allowFullDefer ? minIndex : Math.min(minIndex + 1, value.length);

  while (
    j > backOffFloor &&
    (isLineEndProhibited(value[j - 1]) || (j < value.length && isLineStartProhibited(value[j])))
  ) {
    j -= 1;
  }

  return j;
}

/**
 * Combines the nowrap-run and kinsoku split adjustments used by both
 * `paginateTokensByLines` and `computePageSourceRanges`, so the two share
 * one definition of "where a line is actually allowed to end" instead of
 * two independently-maintained copies.
 *
 * A single nowrap-then-kinsoku pass isn't enough: kinsoku's retreat (backing
 * off past a trailing opening bracket, or past a run-final closing bracket /
 * small kana / prolonged mark that would otherwise start the next line) can
 * land the split back *inside* a ――/…… run that the nowrap check already
 * cleared at the original position — e.g. splitting "え――」" (charsPerLine
 * budget lands right after the pair, but "」" can't start the next line)
 * would, without re-checking, retreat one character into the middle of the
 * pair instead of past the whole thing. So the two adjustments run in a
 * loop, each re-validating the other's output, until a fixed point is
 * reached. Both underlying adjustments only ever retreat (never advance)
 * within `[minIndex, splitIndex]`, so `j` is strictly non-increasing and
 * bounded below by `minIndex` — the loop always terminates in at most
 * `splitIndex - minIndex` iterations; the `value.length` guard below is
 * just a defensive upper bound against that invariant ever being violated.
 */
function adjustLineSplit(
  value: string,
  minIndex: number,
  splitIndex: number,
  allowDefer: boolean
): number {
  let j = splitIndex;
  for (let guard = 0; guard <= value.length; guard += 1) {
    const afterNowrap = adjustSplitForNowrapRun(value, j, minIndex, allowDefer);
    const afterKinsoku = adjustSplitForKinsoku(value, minIndex, afterNowrap, allowDefer);
    if (afterKinsoku === j) return afterKinsoku;
    j = afterKinsoku;
  }
  return j;
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
  // Completed lines on the current page, and the tokens placed on the
  // current (still-open) line, mirrored alongside currentPage/lineChars so
  // every page can report its exact line grouping for rendering.
  let lines: TategakiToken[][] = [];
  let currentLine: TategakiToken[] = [];
  // Lines already completed on the current page, and characters placed on
  // the current (still-open) line.
  let lineIndex = 0;
  let lineChars = 0;
  // True immediately after the line just closed was ended because content
  // filled it to exactly `charsPerLine` (an auto-wrap), as opposed to being
  // ended by an explicit "\n" in the source. A single "\n" found right after
  // such a fill is redundant with the break that already happened — without
  // this, it would open, and immediately close, its own empty line, adding a
  // phantom blank column that has no counterpart in the source text.
  let lineFilledByWrap = false;
  // The page most recently closed by ordinary line/page-fill flow — char
  // fill, an explicit "\n", or kinsoku/nowrap deferring everything off the
  // line — as opposed to an explicit 【改ページ】, while the page opened
  // after it is still completely empty (nothing placed yet). A zero-length
  // image token arriving in this window is the trailing attachment of a
  // page the user inserted an image into at its full/closed boundary — see
  // `appendTrailingImage` — not the first content of the next page. Cleared
  // the instant either real content lands on the new page (`placeToken`) or
  // an explicit page break is seen, both of which commit the new page as a
  // distinct one no image should be pulled back across.
  let lastSoftClosedPage: TategakiPage | null = null;

  // Bucket every token into top/bottom as it's placed, in the same pass that
  // decides which line it lands on — avoids a second, separately-accounted
  // pass over an already-paginated page (which drifted from the real line
  // count whenever ruby/tcy tokens, with their non-1:1 char-to-token ratio,
  // were mixed into the flow, causing large chunks of text to vanish).
  const placeToken = (token: TategakiToken) => {
    lastSoftClosedPage = null;
    currentPage.push(token);
    currentLine.push(token);
    if (columnCount === 2) {
      (lineIndex < linesPerColumn ? topTokens : bottomTokens).push(token);
    }
  };

  // Appends a zero-length image token onto a page that's already been
  // pushed, instead of onto the freshly-opened next page. Safe to mutate in
  // place: `pushPage` rebinds every one of its local working arrays
  // (`currentPage`, `lines`, `topTokens`, `bottomTokens`) to fresh arrays
  // the moment a page is pushed, so `page`'s own arrays are never touched by
  // pagination of any later page. Only `page.tokens` and the last entry of
  // `page.lines` need a direct push — `page.columnLines` was built via
  // `lines.slice(...)`, a shallow copy that already shares those same
  // per-line array objects, so mutating the shared last line is
  // automatically visible there too without a separate update.
  const appendTrailingImage = (page: TategakiPage, token: TategakiToken) => {
    page.tokens.push(token);
    page.lines[page.lines.length - 1].push(token);
    if (page.columns) {
      const section = page.lines.length <= linesPerColumn ? 0 : 1;
      page.columns[section].push(token);
    }
  };

  const pushPage = (force = false): TategakiPage | null => {
    if (currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = [];
    }
    let pushed: TategakiPage | null = null;
    if (currentPage.length > 0 || force) {
      pushed = {
        tokens: currentPage,
        columns: columnCount === 2 ? [topTokens, bottomTokens] : null,
        lines,
        columnLines:
          columnCount === 2 ? [lines.slice(0, linesPerColumn), lines.slice(linesPerColumn)] : null,
      };
      pages.push(pushed);
    }
    currentPage = [];
    topTokens = [];
    bottomTokens = [];
    lines = [];
    lineIndex = 0;
    lineChars = 0;
    return pushed;
  };

  const breakLine = () => {
    lines.push(currentLine);
    currentLine = [];
    lineIndex += 1;
    lineChars = 0;
    lineFilledByWrap = false;
    if (lineIndex >= linesPerPage) {
      lastSoftClosedPage = pushPage();
    }
  };

  for (const token of tokens) {
    if (token.type === "pageBreak") {
      // Manual page break: normally always flush, even mid-page or on an
      // empty page, so an explicit break reliably sends the following
      // content to the next page. Exception: if the page was *just* soft-
      // closed (line/char fill, "\n", or a trailing image attached to it)
      // and nothing has landed on the new page yet, this break names the
      // exact same boundary a second time — force-pushing here would add a
      // phantom empty page with no counterpart in the source. Absorb only
      // that first, coincident break; a second consecutive 【改ページ】 finds
      // lastSoftClosedPage already cleared and force-pushes normally,
      // producing the blank page the user explicitly asked for.
      // A hard boundary — no image after this point may be pulled back
      // across it onto the page that just closed.
      lineFilledByWrap = false;
      if (lastSoftClosedPage !== null && currentPage.length === 0) {
        lastSoftClosedPage = null;
      } else {
        lastSoftClosedPage = null;
        pushPage(true);
      }
      continue;
    }

    if (token.type === "image") {
      // Zero-length (see tokenLength): must never touch lineChars/lineIndex/
      // lineFilledByWrap, in either branch below — otherwise placing one
      // right after a wrap-filled line would clear lineFilledByWrap and
      // un-suppress that line's own redundant trailing "\n", mistaking it
      // for a second, real line break. Read into a local const first — see
      // the mirrored branch in computePageSourceRanges for why.
      const closedPage = lastSoftClosedPage;
      if (closedPage && currentPage.length === 0) {
        appendTrailingImage(closedPage, token);
      } else {
        placeToken(token);
      }
      continue;
    }

    if (token.type === "text") {
      let i = 0;
      const value = token.value;
      while (i < value.length) {
        if (value[i] === "\n") {
          if (lineFilledByWrap) {
            // The line that just closed was already ended by filling up to
            // charsPerLine; this "\n" doesn't mark a second, separate line
            // end, so consume it without emitting a token or a blank line.
            i += 1;
            lineFilledByWrap = false;
            continue;
          }
          placeToken({ type: "text", value: "\n" });
          i += 1;
          breakLine();
          continue;
        }
        // Real content is being placed on the current line now, so whatever
        // it was before (freshly wrapped-full, or not) no longer applies —
        // only a break decided below can make it true again.
        lineFilledByWrap = false;
        const startI = i;
        // A completely empty line can't be allowed to defer everything to
        // "the next line" — there is no next line yet, so that would just
        // spin forever. Only a line that already holds something may defer.
        const isFreshLine = lineChars === 0;
        const room = charsPerLine - lineChars;
        let j = i;
        while (j < value.length && value[j] !== "\n" && j - i < room) {
          j += 1;
        }
        j = adjustLineSplit(value, i, j, !isFreshLine);
        if (j > i) {
          placeToken({ type: "text", value: value.slice(i, j) });
          lineChars += j - i;
          i = j;
        }
        // j === startI means this iteration placed nothing at all (no room
        // left, or every candidate character was deferred by nowrap-run /
        // kinsoku protection) — that still has to force a break so the
        // outer loop makes progress instead of spinning forever on the
        // same index.
        const wasFilled = lineChars >= charsPerLine;
        if (wasFilled || j === startI) {
          breakLine();
          lineFilledByWrap = wasFilled;
        }
      }
      continue;
    }

    // Atomic (unsplittable) token — ruby or tcy, image/pageBreak already
    // handled above: start a fresh line first if it wouldn't fit on the
    // remainder of the current one.
    const length = tokenLength(token);
    if (lineChars > 0 && lineChars + length > charsPerLine) {
      breakLine();
    }
    placeToken(token);
    lineChars += length;
    const wasFilled = lineChars >= charsPerLine;
    lineFilledByWrap = false;
    if (wasFilled) {
      breakLine();
      lineFilledByWrap = true;
    }
  }

  pushPage();

  return pages.length > 0
    ? pages
    : [
        {
          tokens: [],
          columns: columnCount === 2 ? [[], []] : null,
          lines: [],
          columnLines: columnCount === 2 ? [[], []] : null,
        },
      ];
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
  // Mirrors paginateTokensByLines's lineFilledByWrap: true right after a line
  // was closed by filling to charsPerLine, so the very next "\n" — redundant
  // with that break — can be skipped instead of being counted as its own line.
  let lineFilledByWrap = false;
  // Mirrors paginateTokensByLines's lastSoftClosedPage: the range most
  // recently closed by ordinary line/page-fill flow (not an explicit
  // 【改ページ】), while nothing has been marked on the next page yet — see
  // that function for why a trailing zero-length image marker should extend
  // this range instead of starting a new one.
  let lastSoftClosedRange: { start: number; end: number } | null = null;
  // TS's control-flow narrowing of a `let` doesn't see through calls to the
  // closures below (mark/breakLine) that assign it, so reading the variable
  // straight from a loop body iteration narrows it to `null` unconditionally
  // instead of the true union — routing every read through a function with
  // an explicit return type sidesteps that and narrows correctly downstream.
  const readLastSoftClosedRange = (): { start: number; end: number } | null => lastSoftClosedRange;

  const pushPage = (force = false): { start: number; end: number } | null => {
    let pushed: { start: number; end: number } | null = null;
    if (pageStart !== null || force) {
      pushed = { start: pageStart ?? pageEnd, end: pageEnd };
      ranges.push(pushed);
    }
    pageStart = null;
    lineIndex = 0;
    lineChars = 0;
    return pushed;
  };

  const mark = (start: number, end: number) => {
    lastSoftClosedRange = null;
    if (pageStart === null) pageStart = start;
    pageEnd = end;
  };

  const breakLine = () => {
    lineIndex += 1;
    lineChars = 0;
    lineFilledByWrap = false;
    if (lineIndex >= linesPerPage) {
      lastSoftClosedRange = pushPage();
    }
  };

  for (const { token, start, end } of offsetTokens) {
    if (token.type === "pageBreak") {
      // Mirrors paginateTokensByLines's pageBreak branch: absorb only a
      // break that names the same boundary a just-finished soft close
      // already marked, so the phantom {n,n} range doesn't appear (the
      // marker's own source span is never included in any page's range
      // either way — mark() is never called for it here or below — so
      // absorbing this one doesn't shift any later offset).
      lineFilledByWrap = false;
      if (lastSoftClosedRange !== null && pageStart === null) {
        lastSoftClosedRange = null;
      } else {
        lastSoftClosedRange = null;
        pushPage(true);
      }
      continue;
    }

    if (token.type === "image") {
      // Zero-length: never advances lineChars/lineIndex/lineFilledByWrap —
      // see the mirrored branch in paginateTokensByLines for why.
      const closedRange = readLastSoftClosedRange();
      if (closedRange && pageStart === null) {
        closedRange.end = end;
      } else {
        mark(start, end);
      }
      continue;
    }

    if (token.type === "text") {
      let i = 0;
      const value = token.value;
      while (i < value.length) {
        if (value[i] === "\n") {
          if (lineFilledByWrap) {
            // Redundant with the fill-triggered break that already closed
            // this line — same rule as paginateTokensByLines, so page
            // boundaries here don't drift from what's actually rendered.
            i += 1;
            lineFilledByWrap = false;
            continue;
          }
          mark(start + i, start + i + 1);
          i += 1;
          breakLine();
          continue;
        }
        lineFilledByWrap = false;
        const startI = i;
        const isFreshLine = lineChars === 0;
        const room = charsPerLine - lineChars;
        let j = i;
        while (j < value.length && value[j] !== "\n" && j - i < room) {
          j += 1;
        }
        j = adjustLineSplit(value, i, j, !isFreshLine);
        if (j > i) {
          mark(start + i, start + j);
          lineChars += j - i;
          i = j;
        }
        const wasFilled = lineChars >= charsPerLine;
        if (wasFilled || j === startI) {
          breakLine();
          lineFilledByWrap = wasFilled;
        }
      }
      continue;
    }

    // ruby or tcy — image/pageBreak already handled above.
    const length = tokenLength(token);
    if (lineChars > 0 && lineChars + length > charsPerLine) {
      breakLine();
    }
    mark(start, end);
    lineChars += length;
    const wasFilled = lineChars >= charsPerLine;
    lineFilledByWrap = false;
    if (wasFilled) {
      breakLine();
      lineFilledByWrap = true;
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

/** Serializes a single image token back to its 【IMG:...】 marker form (see `MARKER_PATTERN`). */
export function formatImageMarker(token: Extract<TategakiToken, { type: "image" }>): string {
  return `【IMG:${token.id}:${token.widthMm}:${token.heightMm}:${token.position}】`;
}

/** Reverses `tokenizeTategaki`, re-serializing ruby/image tokens back to their marker form. */
export function detokenizeTategaki(tokens: TategakiToken[]): string {
  return tokens
    .map((token) => {
      if (token.type === "ruby") return `｜${token.base}《${token.rt}》`;
      if (token.type === "image") return formatImageMarker(token);
      if (token.type === "pageBreak") return PAGE_BREAK_MARKER;
      return token.value;
    })
    .join("");
}

/**
 * Finds the exact `[start, end)` span of a specific image's 【IMG:...】
 * marker within raw source text, by reusing `tokenizeTategakiWithOffsets`
 * (the same tokenizer pagination itself runs) rather than a hand-rolled
 * regex — so this can never disagree with how the rest of the pipeline
 * parses markers. Built for image-editing operations that must splice the
 * original source string in place (insert/replace/delete just this one
 * marker) instead of detokenizing and rewriting an entire page: pagination
 * tokens are a display-oriented, intentionally lossy view of the source
 * (see `paginateTokensByLines`'s redundant-`\n` consumption), so
 * reconstructing text from them and writing it back as the saved document
 * would silently drop characters the pagination pass never round-trips.
 * Returns `null` if no marker with that id exists in `source`. If more than
 * one marker somehow shares an id (ids are `crypto.randomUUID()`-generated
 * and nothing else in this codebase mints or duplicates them, so this
 * shouldn't occur in practice), the first match wins.
 */
export function findImageTokenRange(
  source: string,
  imageId: string
): { start: number; end: number; token: Extract<TategakiToken, { type: "image" }> } | null {
  for (const { token, start, end } of tokenizeTategakiWithOffsets(source)) {
    if (token.type === "image" && token.id === imageId) {
      return { start, end, token };
    }
  }
  return null;
}
