import { PAGE_BREAK_MARKER, tokenizeTategakiWithOffsets } from "./tategaki";
import { extractHeadingOffsets } from "../utils/tocGenerator";

export interface TocSettingsItem {
  title: string;
  pageNumber: number;
}

/**
 * Where the work-owned TOC enters the publication (Phase 11 Human-QA round 2).
 *
 * The anchor is a manuscript position, not a page number, so it survives
 * editing: 「本文の前」, 「本文の後」, or 「見出し◯◯の前」. A heading anchor stores
 * both its index and title; resolution prefers the title (see
 * `resolveTocInsertion`). Body page numbers would drift on every keystroke
 * and could split a paragraph across the TOC.
 */
export type TocPosition =
  | { mode: "start" }
  | { mode: "before-heading"; headingIndex: number; headingTitle: string }
  | { mode: "end" };

/**
 * TOC leader block between the title and the page number. Every style fills
 * the same cells, so the page number sits in the same (last) cell for all of
 * them — 「なし」 fills with blank cells instead of dropping the block.
 */
export type TocLeaderStyle = "dots" | "dash" | "none";

/** Works saved before the leader setting existed keep the dotted leader they always had. */
export const DEFAULT_TOC_LEADER: TocLeaderStyle = "dots";

export const TOC_LEADER_OPTIONS: ReadonlyArray<{ value: TocLeaderStyle; label: string }> = [
  { value: "dots", label: "……" },
  { value: "dash", label: "―――" },
  { value: "none", label: "なし" },
];

export function normalizeTocLeader(raw: unknown): TocLeaderStyle {
  return raw === "dots" || raw === "dash" || raw === "none" ? raw : DEFAULT_TOC_LEADER;
}

export interface TocSettings {
  /** Whether the generated TOC is part of this work. */
  enabled: boolean;
  /** Last Human-confirmed detection result. Page numbers stay stable until 再検出. */
  items: TocSettingsItem[];
  /** Insertion point in the publication. Works saved before this field open as "start" (where the TOC used to go). */
  position: TocPosition;
  /** Leader block style (作品ごと). */
  leader: TocLeaderStyle;
  /** Informational only; null for works that have never created a TOC. */
  updatedAt: number | null;
}

export function createDefaultTocSettings(): TocSettings {
  return { enabled: false, items: [], position: { mode: "start" }, leader: DEFAULT_TOC_LEADER, updatedAt: null };
}

export function normalizeTocPosition(raw: unknown): TocPosition {
  if (!raw || typeof raw !== "object") return { mode: "start" };
  const value = raw as { mode?: unknown; headingIndex?: unknown; headingTitle?: unknown };
  if (value.mode === "end") return { mode: "end" };
  if (
    value.mode === "before-heading" &&
    typeof value.headingIndex === "number" &&
    Number.isFinite(value.headingIndex) &&
    typeof value.headingTitle === "string"
  ) {
    return {
      mode: "before-heading",
      headingIndex: Math.max(0, Math.trunc(value.headingIndex)),
      headingTitle: value.headingTitle,
    };
  }
  return { mode: "start" };
}

export function normalizeTocSettings(raw: unknown): TocSettings {
  const base = createDefaultTocSettings();
  if (!raw || typeof raw !== "object") return base;
  const value = raw as Partial<TocSettings>;
  const items = Array.isArray(value.items)
    ? value.items
        .filter((item): item is TocSettingsItem =>
          !!item &&
          typeof item === "object" &&
          typeof (item as TocSettingsItem).title === "string" &&
          Number.isFinite((item as TocSettingsItem).pageNumber)
        )
        .map((item) => ({
          title: item.title,
          pageNumber: Math.max(1, Math.trunc(item.pageNumber)),
        }))
    : [];
  return {
    enabled: value.enabled === true && items.length > 0,
    items,
    position: normalizeTocPosition(value.position),
    leader: normalizeTocLeader(value.leader),
    updatedAt: typeof value.updatedAt === "number" && Number.isFinite(value.updatedAt)
      ? value.updatedAt
      : null,
  };
}

/** UI label for a position (Editor TOC block, BookPartsModal). */
export function describeTocPosition(position: TocPosition): string {
  if (position.mode === "end") return "本文の後";
  if (position.mode === "before-heading") return `「${position.headingTitle}」の前`;
  return "本文の前";
}

export interface ResolvedTocAnchor {
  /** Raw UTF-16 offset in the Editor's body `content` where the TOC block is spliced in (composition only). */
  offset: number;
  /** The position actually used (a vanished heading falls back to "start"). */
  resolved: TocPosition;
}

/**
 * Resolves the stored anchor against the CURRENT manuscript. A heading anchor
 * matches by title first (the heading may have moved), then by index; when
 * the heading no longer exists the TOC falls back to 本文の前 rather than
 * disappearing (the Editor block shows the resolved position).
 */
export function resolveTocInsertion(content: string, position: TocPosition): ResolvedTocAnchor {
  if (position.mode === "end") return { offset: content.length, resolved: position };
  if (position.mode === "before-heading") {
    const headings = extractHeadingOffsets(content);
    const byTitle = headings.findIndex((heading) => heading.title === position.headingTitle);
    const index = byTitle >= 0
      ? byTitle
      : position.headingIndex < headings.length ? position.headingIndex : -1;
    if (index >= 0) {
      const lineStart = content.lastIndexOf("\n", headings[index].index - 1) + 1;
      return {
        offset: lineStart,
        resolved: { mode: "before-heading", headingIndex: index, headingTitle: headings[index].title },
      };
    }
  }
  return { offset: 0, resolved: { mode: "start" } };
}

/* ------------------------------------------------------------------ *
 *  TOC page layout (manuscript text Core composes like any body text)
 * ------------------------------------------------------------------ */

const FULLWIDTH_SPACE = "　";
/** One cell of each leader style. 「なし」 = 全角スペース (blank cells, same width). */
const LEADER_CELL: Record<TocLeaderStyle, string> = { dots: "…", dash: "―", none: FULLWIDTH_SPACE };
const MAX_TCY_NUMBER_DIGITS = 8;

interface TitleSegment {
  raw: string;
  cells: number;
}

/**
 * Splits a heading title into segments whose CELL cost is exactly what V2
 * Core charges (core/compose/line.ts `advanceTickFor`): every TEXT code point
 * is one cell (grid typesetting), a ruby costs its base length, a 縦中横 one
 * cell. Text is split per code point so long titles can wrap at any cell;
 * ruby / 縦中横 stay atomic. Page breaks / images inside a title are dropped
 * (a TOC entry never breaks a page or shows a picture).
 */
function titleSegments(title: string): TitleSegment[] {
  const segments: TitleSegment[] = [];
  for (const { token, start, end } of tokenizeTategakiWithOffsets(title)) {
    if (token.type === "text") {
      // Decoration markers (《《》》) are not part of the token value; keep the
      // visible text only so cell counting and wrapping stay exact.
      for (const codePoint of token.value.replace(/\n/g, "")) segments.push({ raw: codePoint, cells: 1 });
    } else if (token.type === "ruby") {
      segments.push({ raw: title.slice(start, end), cells: Array.from(token.base).length });
    } else if (token.type === "tcy") {
      segments.push({ raw: title.slice(start, end), cells: 1 });
    }
  }
  return segments;
}

/** Page number as one 縦中横 cell, so every entry's number occupies the same single cell. */
function pageNumberCell(pageNumber: number): string {
  const digits = String(Math.max(1, Math.trunc(pageNumber)));
  return digits.length <= MAX_TCY_NUMBER_DIGITS ? `[tate]${digits}[/tate]` : digits;
}

/** Fixed leader block length (cells), the same for every leader style. */
export const TOC_LEADER_CELLS = 5;
/** Cells after the title area: 全角スペース 1 + leader block + 全角スペース 1 + page number (1 縦中横 cell). */
const TOC_TAIL_CELLS = 1 + TOC_LEADER_CELLS + 1 + 1;
const ENTRY_INDENT = 1;
const CONTINUATION_INDENT = 2;

/** Cells V2 Core charges for a title (TEXT 1 / ruby base / 縦中横 1). */
export function tocTitleCells(title: string): number {
  return titleSegments(title).reduce((sum, segment) => sum + segment.cells, 0);
}

/**
 * Width (cells) of the shared title area: the longest title, capped so
 * `indent + area + tail` still fits one line. Longer titles wrap inside it.
 */
export function tocTitleAreaCells(items: readonly TocSettingsItem[], cellsPerLine: number): number {
  const lineCells = Math.floor(cellsPerLine);
  const longest = items.reduce((max, item) => Math.max(max, tocTitleCells(item.title)), 0);
  const cap = Math.max(1, lineCells - ENTRY_INDENT - TOC_TAIL_CELLS);
  return Math.max(1, Math.min(longest, cap));
}

/**
 * One TOC entry as manuscript lines, each exactly one composed line:
 *
 *   [　][章タイトル + 全角スペース詰め → 共通タイトル領域][　][リーダー×5][　][ページ番号]
 *
 * - Every line starts with an explicit 全角スペース, which also exempts it from
 *   Core's automatic 一字下げ (AUTO_INDENT_CHAR), so indentation is fixed.
 * - The title area is as wide as the LONGEST title of the TOC (`titleAreaCells`),
 *   padded with 全角スペース, so the leader starts — and the page number sits — at
 *   the same cell on every entry. The leader block is always
 *   `TOC_LEADER_CELLS` cells: ……／―――／なし(blank cells) are the same width.
 * - A title longer than the area (only when the area is capped by the line
 *   length) wraps onto its own lines with a 2-cell hanging indent; only the
 *   final line carries the gap + leader + number.
 */
export function buildTocEntryLines(
  item: TocSettingsItem,
  cellsPerLine: number,
  leader: TocLeaderStyle = DEFAULT_TOC_LEADER,
  titleAreaCells: number = tocTitleAreaCells([item], cellsPerLine)
): string[] {
  const areaEnd = ENTRY_INDENT + Math.max(1, Math.floor(titleAreaCells)); // first cell after the title area
  const segments = titleSegments(item.title);
  const lines: string[] = [];
  let indent = ENTRY_INDENT;
  let index = 0;
  const remainingCells = () => segments.slice(index).reduce((sum, segment) => sum + segment.cells, 0);

  // Wrap while the rest of the title does not fit inside the title area.
  while (index < segments.length && indent + remainingCells() > areaEnd) {
    const budget = Math.max(1, areaEnd - indent);
    let used = 0;
    let raw = "";
    while (index < segments.length && (used + segments[index].cells <= budget || raw === "")) {
      used += segments[index].cells;
      raw += segments[index].raw;
      index += 1;
    }
    lines.push(FULLWIDTH_SPACE.repeat(indent) + raw);
    indent = CONTINUATION_INDENT;
    if (areaEnd - indent < 1) break; // degenerate grid: no room for a hanging indent
  }

  const restRaw = segments.slice(index).map((segment) => segment.raw).join("");
  const padCells = Math.max(0, areaEnd - indent - remainingCells());
  lines.push(
    FULLWIDTH_SPACE.repeat(indent) +
      restRaw +
      FULLWIDTH_SPACE.repeat(padCells) +
      FULLWIDTH_SPACE +
      LEADER_CELL[leader].repeat(TOC_LEADER_CELLS) +
      FULLWIDTH_SPACE +
      pageNumberCell(item.pageNumber)
  );
  return lines;
}

/** The TOC page heading line (2-cell indent, explicit so Core adds none). */
const TOC_HEADING_LINE = `${FULLWIDTH_SPACE}${FULLWIDTH_SPACE}目次`;

/** Heading + blank line + every entry: the TOC as manuscript lines (no page breaks). */
export function buildTocBlockLines(toc: TocSettings, cellsPerLine: number): string[] {
  const titleAreaCells = tocTitleAreaCells(toc.items, cellsPerLine);
  return [
    TOC_HEADING_LINE,
    "",
    ...toc.items.flatMap((item) => buildTocEntryLines(item, cellsPerLine, toc.leader, titleAreaCells)),
  ];
}

export interface TocCompositionInsertion {
  /** Raw offset in the Editor body `content` where `text` is spliced. */
  offset: number;
  /** The composition-only TOC text (page breaks / padding included). Never written to `content`. */
  text: string;
  resolved: TocPosition;
}

/**
 * Whether Core starts the first line at `offset` as a fresh paragraph
 * (auto 一字下げ). Core: document start → yes; after a plain line ending →
 * yes; after a page-break command (any MANUAL_FORCED cut) → no
 * (core/compose/column.ts).
 */
function paragraphStartsAt(content: string, offset: number): boolean {
  if (offset === 0) return true;
  if (content[offset - 1] !== "\n") return false;
  const lineStart = content.lastIndexOf("\n", offset - 2) + 1;
  const previousLine = content.slice(lineStart, offset - 1).replace(/[\p{Cf}\p{Variation_Selector}\s]+$/gu, "");
  return !previousLine.endsWith(PAGE_BREAK_MARKER);
}

/** The text before the splice already ends with a page-break command (only whitespace/invisibles after it). */
function endsWithPageBreakCommand(before: string): boolean {
  return before.replace(/[\p{Cf}\p{Variation_Selector}\s]+$/gu, "").endsWith(PAGE_BREAK_MARKER);
}

/** True when the line at `offset` would receive Core's automatic 一字下げ when it starts a paragraph. */
function lineIsAutoIndentable(content: string, offset: number): boolean {
  const first = Array.from(content.slice(offset, offset + 2))[0];
  return first !== undefined && first !== "\n" && !"「『（〈《【〔［｛“‘　".includes(first);
}

export interface TocCompositionGrid {
  cellsPerLine: number;
  linesPerColumn: number;
  columnsPerPage: number;
}

/**
 * Builds the composition-only TOC splice for `content`.
 *
 * Page boundaries are expressed with the same `【改ページ】` commands the
 * Editor itself writes, so Core starts the TOC on a fresh page and the body
 * resumes on a fresh page after it. The body text right after the TOC keeps
 * the paragraph state it had without a TOC:
 *  - it was NOT a paragraph start (it followed a page break): the TOC closes
 *    with a page-break command (Core: next line is not a paragraph start);
 *  - it WAS a paragraph start (document start / after a plain line): the TOC
 *    is padded with empty lines to fill its last page exactly, so the body
 *    resumes by capacity right after a line ending — exactly Core's
 *    paragraph-start condition. `padToPageEnd: false` (the composer's
 *    fallback when a page grid could not be filled exactly) uses the
 *    page-break close instead.
 */
export function buildTocCompositionInsertion(
  content: string,
  toc: TocSettings | undefined,
  grid: TocCompositionGrid,
  options: { padToPageEnd?: boolean } = {}
): TocCompositionInsertion | null {
  if (!toc?.enabled || toc.items.length === 0) return null;
  const { offset, resolved } = resolveTocInsertion(content, toc.position);
  const lines = buildTocBlockLines(toc, grid.cellsPerLine);
  const before = content.slice(0, offset);
  const atEnd = offset >= content.length;

  // Leading: the TOC must open its own page.
  let leading = "";
  if (offset > 0 && !endsWithPageBreakCommand(before)) {
    leading = (before.endsWith("\n") ? "" : "\n") + PAGE_BREAK_MARKER + "\n";
  }

  if (atEnd) return { offset, text: leading + lines.join("\n"), resolved };

  const wantsParagraphStart =
    paragraphStartsAt(content, offset) && lineIsAutoIndentable(content, offset) && options.padToPageEnd !== false;
  if (wantsParagraphStart) {
    const pageLines = Math.max(1, Math.floor(grid.linesPerColumn + 1e-9)) * Math.max(1, Math.floor(grid.columnsPerPage));
    const pad = (pageLines - (lines.length % pageLines)) % pageLines;
    return { offset, text: leading + [...lines, ...Array.from({ length: pad }, () => "")].join("\n") + "\n", resolved };
  }
  return { offset, text: leading + lines.join("\n") + PAGE_BREAK_MARKER + "\n", resolved };
}
