/**
 * TateSpun Live Editor -> v2 Publication Bridge: manuscript adapter.
 *
 * Converts a real Editor manuscript string (`TategakiEditor`'s own
 * `content` state) into v2 Core `LogicalUnit[]` + a `source` string, using
 * the REAL, authoritative legacy tokenizer (`tokenizeTategakiWithOffsets`)
 * -- never a second manuscript parser. This module only re-shapes already
 * -tokenized data; it makes no notation/parsing decisions of its own.
 *
 * DISCLOSED SIMPLIFICATION: `tokenizeTategakiWithOffsets`'s own
 * `start`/`end` fields are UTF-16 code-unit offsets (plain JS string
 * indexing); v2's `SourceSpan` is documented as code-point offsets
 * (`core/source/span.ts`). This adapter does not reuse those numeric
 * offsets at all -- it rebuilds every span itself via `Array.from(...).length`
 * cursor arithmetic (the same technique `tools/compare/fixtureBuilder.ts`
 * uses), which is code-point-correct by construction. For ordinary
 * Japanese manuscript text (BMP characters) this distinction never
 * matters in practice; it only matters for astral-plane characters
 * (rare emoji, some rare kanji), which are now handled correctly too.
 *
 * DISCLOSED, ADAPTER-OWNED POLICY (flagged by the pre-implementation
 * audit as a real gap, not a mechanical port): legacy has no dedicated
 * "paragraph break" token -- paragraph starts are detected later, at
 * pagination time, directly from embedded "\n" characters inside `text`
 * tokens. This adapter treats every literal "\n" as a real v2
 * `PARAGRAPH_BREAK` unit spanning that one character -- consistent with
 * v2's own existing `PARAGRAPH_BREAK` span-ownership contract (see
 * `tools/compare/fixtureBuilder.ts`'s own "text defaults to \n" handling),
 * not an invented new concept.
 *
 * Post-beta typography Phase 1 (body block only, see
 * `ManuscriptAdapterOptions`):
 *  - 傍点: a token's `decoration` (from `《《…》》`) is carried onto its unit
 *    as Core's paint-only `InlineDecoration`. Spans/advances are unchanged.
 *  - Continuous dash: a run of 2+ `―`/`—` inside plain text becomes ONE
 *    `SEMANTIC_RUN` DASH unit -- Core's existing cl-08 unit, whose run is
 *    inseparable (no line/page break inside it) and which Preview paints as
 *    one native vertical shaping run. The legacy paginator already refuses
 *    to split `――` (`adjustSplitForNowrapRun`); before this, V2 composed each
 *    dash as an independent TEXT atom that could break between the pair and
 *    painted each glyph as its own text node.
 *  - Continuous ellipsis (Phase 1.1): a run of 2+ `…` becomes ONE
 *    `SEMANTIC_RUN` ELLIPSIS unit on the same terms (cl-08 inseparable; the
 *    legacy paginator already refuses to split `……`). `‥` (TWO_DOT_LEADER)
 *    is left as TEXT: Publication has no paint branch for that run kind.
 */
import { tokenizeTategakiWithOffsets, type InlineDecoration as TokenDecoration, type TategakiToken } from "../tategaki";
import { mmToTicks } from "../../../typesetting-v2/core/geometry/tick";
import type { InlineDecoration, LogicalUnit } from "../../../typesetting-v2/core/units";

const IMAGE_MARKER_CHAR = String.fromCharCode(1);

export interface ManuscriptAdapterOptions {
  /**
   * Longest `――` / `……` run (in cells) composed as one inseparable
   * DASH / ELLIPSIS SEMANTIC_RUN. A longer run stays plain TEXT (breakable anywhere, the
   * prior behavior), because an atom wider than a line has no legal break
   * and Core would HOLD the whole document. Callers pass `charsPerLine - 1`
   * so a run always fits even on a paragraph-first (一字下げ) line. Omitted
   * or < 2: no run grouping at all.
   */
  maxSemanticRunCells?: number;
  /** Carry 傍点 decoration onto units. Omitted: decoration is dropped. */
  decorations?: boolean;
}

interface AdapterState {
  cursor: number;
  flow: string;
  units: LogicalUnit[];
  /** Raw manuscript [start, end) (UTF-16) of every flow code point — see ManuscriptSourceMap. */
  rawStart: number[];
  rawEnd: number[];
}

/**
 * Where each composed (flow) code point came from in the RAW manuscript
 * (UTF-16 offsets into the Editor's `content`). Plain text maps 1:1; a
 * ruby / 縦中横 / image maps every one of its flow code points to the WHOLE
 * notation span (`｜漢字《かんじ》`, `[tate]A5[/tate]`, `【IMG:…】`); a paragraph
 * break maps to its newline. Notation that produces no flow text (`《《`/`》》`,
 * a consumed 【改ページ】) is simply not covered. Lets the Preview derive page
 * source ranges, caret→page and image insertion points from the V2 layout
 * instead of re-running the LEGACY paginator (Phase 5).
 */
export interface ManuscriptSourceMap {
  rawStart: Int32Array;
  rawEnd: Int32Array;
}

function recordRaw(state: AdapterState, text: string, rawBase: number): void {
  let offset = 0;
  for (const codePoint of text) {
    state.rawStart.push(rawBase + offset);
    offset += codePoint.length;
    state.rawEnd.push(rawBase + offset);
  }
}

function recordRawWhole(state: AdapterState, text: string, rawStart: number, rawEnd: number): void {
  for (const _codePoint of text) {
    void _codePoint;
    state.rawStart.push(rawStart);
    state.rawEnd.push(rawEnd);
  }
}

// Dash: the same family legacy pagination/PageCard treat as one ―― run
// (`[―—]`). Ellipsis: `…` only (see the module doc for `‥`).
const SEMANTIC_RUN_PATTERN = /[―—]{2,}|…{2,}/g;
const HAS_SEMANTIC_RUN = /[―—]{2}|……/;

function coreDecoration(decoration: TokenDecoration | undefined, options: ManuscriptAdapterOptions): { decoration: InlineDecoration } | Record<string, never> {
  if (!options.decorations || decoration?.emphasis !== "dot") return {};
  return { decoration: { emphasis: "DOT" } };
}

function pushTextUnit(blockId: string, text: string, state: AdapterState, decoration: { decoration?: InlineDecoration }, rawBase: number): void {
  recordRaw(state, text, rawBase);
  const start = state.cursor;
  state.cursor += Array.from(text).length;
  state.flow += text;
  state.units.push({ kind: "TEXT", span: { blockId, start, end: state.cursor }, text, ...decoration });
}

function pushLineText(
  blockId: string,
  text: string,
  state: AdapterState,
  options: ManuscriptAdapterOptions,
  decoration: { decoration?: InlineDecoration },
  rawBase: number
): void {
  const maxCells = options.maxSemanticRunCells ?? 0;
  if (maxCells < 2 || !HAS_SEMANTIC_RUN.test(text)) {
    pushTextUnit(blockId, text, state, decoration, rawBase);
    return;
  }
  let last = 0;
  for (const match of text.matchAll(SEMANTIC_RUN_PATTERN)) {
    const length = Array.from(match[0]).length;
    if (length > maxCells) continue; // stays inside the surrounding TEXT unit
    const index = match.index ?? 0;
    if (index > last) pushTextUnit(blockId, text.slice(last, index), state, decoration, rawBase + last);
    recordRaw(state, match[0], rawBase + index);
    const start = state.cursor;
    state.cursor += length;
    state.flow += match[0];
    state.units.push({ kind: "SEMANTIC_RUN", span: { blockId, start, end: state.cursor }, runKind: match[0][0] === "…" ? "ELLIPSIS" : "DASH", length, ...decoration });
    last = index + match[0].length;
  }
  if (last < text.length) pushTextUnit(blockId, text.slice(last), state, decoration, rawBase + last);
}

function pushPlainText(
  blockId: string,
  text: string,
  state: AdapterState,
  options: ManuscriptAdapterOptions,
  decoration: { decoration?: InlineDecoration },
  rawBase: number
): void {
  const parts = text.split("\n");
  let offset = 0;
  parts.forEach((part, i) => {
    if (part.length > 0) {
      pushLineText(blockId, part, state, options, decoration, rawBase + offset);
    }
    offset += part.length;
    if (i < parts.length - 1) {
      recordRaw(state, "\n", rawBase + offset);
      offset += 1;
      const start = state.cursor;
      state.cursor += 1;
      state.flow += "\n";
      state.units.push({ kind: "PARAGRAPH_BREAK", span: { blockId, start, end: state.cursor } });
    }
  });
}

type RubyToken = Extract<TategakiToken, { type: "ruby" }>;
type ReadingQueue = Array<{ text: string; unitIndex: number }>;

/**
 * The ONE place an Editor ruby token becomes a Core `RubyUnit` (ruby
 * foundation, post-beta Phase 1). Today every Editor ruby is a basic group
 * ruby over its whole base — `rubyKind: "ATOMIC"`, one reading, never split
 * across lines — exactly as before. Core already supports `JUKUGO` with
 * per-segment readings (`RubyUnit.segments`, `core/ruby`), and
 * `InlineDecoration` already carries base-character metadata (傍点); future
 * mono / 熟語 / long-reading ruby only has to decide `rubyKind` +
 * `segments` here from new token fields — the tokenizer, pagination and
 * both paint models need no second ruby path. The reading text is appended
 * to the unit's source after the body flow (`readingQueue`), unchanged.
 */
function pushRubyUnit(
  blockId: string,
  token: RubyToken,
  state: AdapterState,
  readingQueue: ReadingQueue,
  decoration: { decoration?: InlineDecoration },
  raw: { start: number; end: number }
): void {
  recordRawWhole(state, token.base, raw.start, raw.end);
  const start = state.cursor;
  state.cursor += Array.from(token.base).length;
  state.flow += token.base;
  const baseSpan = { blockId, start, end: state.cursor };
  const unitIndex = state.units.length;
  state.units.push({
    kind: "RUBY",
    span: baseSpan,
    rubyKind: "ATOMIC",
    baseSpan,
    readingSpan: { blockId, start: -1, end: -1 },
    readingText: token.rt,
    ...decoration,
  });
  readingQueue.push({ text: token.rt, unitIndex });
}

export interface ManuscriptComposition {
  units: LogicalUnit[];
  source: string;
  /** Flow code point → raw manuscript offsets (covers `source`'s flow part only, not appended ruby readings). */
  sourceMap: ManuscriptSourceMap;
}

/**
 * `blockId` identifies this manuscript's own SourceBlock (Contract §1) --
 * pass a stable id for the body block (e.g. `"body"`).
 */
export function buildV2UnitsFromManuscript(
  blockId: string,
  content: string,
  options: ManuscriptAdapterOptions = {}
): ManuscriptComposition {
  const entries = tokenizeTategakiWithOffsets(content);
  const state: AdapterState = { cursor: 0, flow: "", units: [], rawStart: [], rawEnd: [] };
  const readingQueue: ReadingQueue = [];

  for (const entry of entries) {
    const token = entry.token;
    if (token.type === "text") {
      pushPlainText(blockId, token.value, state, options, coreDecoration(token.decoration, options), entry.start);
    } else if (token.type === "ruby") {
      pushRubyUnit(blockId, token, state, readingQueue, coreDecoration(token.decoration, options), entry);
    } else if (token.type === "tcy") {
      recordRawWhole(state, token.value, entry.start, entry.end);
      const start = state.cursor;
      state.cursor += Array.from(token.value).length;
      state.flow += token.value;
      // logicalCells: 1 -- matches Core's own real convention (verified
      // against `core/tcy/index.test.ts`: a TCY run consumes exactly one
      // logical cell regardless of digit count, e.g. "1999" also uses 1).
      state.units.push({
        kind: "TCY",
        span: { blockId, start, end: state.cursor },
        displayText: token.value,
        logicalCells: 1,
        ...coreDecoration(token.decoration, options),
      });
    } else if (token.type === "image") {
      recordRawWhole(state, IMAGE_MARKER_CHAR, entry.start, entry.end);
      const start = state.cursor;
      state.cursor += 1;
      state.flow += IMAGE_MARKER_CHAR;
      state.units.push({
        kind: "IMAGE",
        span: { blockId, start, end: state.cursor },
        refId: token.id,
        intrinsicWidth: mmToTicks(token.widthMm),
        intrinsicHeight: mmToTicks(token.heightMm),
        placement: token.position.toUpperCase() as "TOP" | "CENTER" | "BOTTOM" | "FULL",
      });
    } else if (token.type === "pageBreak") {
      state.units.push({ kind: "MANUAL_BREAK", span: { blockId, start: state.cursor, end: state.cursor } });
    }
  }

  let source = state.flow;
  for (const entry of readingQueue) {
    const start = Array.from(source).length;
    source += entry.text;
    const end = Array.from(source).length;
    const unit = state.units[entry.unitIndex];
    if (unit.kind === "RUBY") unit.readingSpan = { blockId, start, end };
  }

  return { units: state.units, source, sourceMap: { rawStart: Int32Array.from(state.rawStart), rawEnd: Int32Array.from(state.rawEnd) } };
}
