/**
 * TSP-B5 — manuscript-level driver for the 描写語・修飾表現チェックβ analyzer.
 *
 *  - notation-aware: ruby (`｜漢字《かん》`), 縦中横, 改ページ and 挿絵 markers are stripped from
 *    the text that is analysed, and every candidate is mapped back to RAW manuscript offsets
 *    (a mark on a ruby base covers the whole `｜…《…》` so it lines up with the editor text);
 *  - per-paragraph cache: analysis is keyed by the paragraph's own text, so typing only
 *    re-analyses the paragraph being edited (long manuscripts stay responsive);
 *  - time-sliced async runner that yields to the browser between paragraphs and can be cancelled;
 *  - pure and local: no network, no worker, no dependency.
 */
import { tokenizeTategakiWithOffsets } from "./tategaki";
import { analyzeDescriptionParagraph, type DescriptionCandidate } from "./descriptionCheck";

/** A candidate positioned in the RAW manuscript. */
export interface DescriptionMark extends DescriptionCandidate {
  /** The raw manuscript text the mark covers. */
  text: string;
}

/** Paragraph-relative candidates (raw offsets relative to the paragraph start). */
type LocalCandidates = readonly DescriptionCandidate[];

export interface DescriptionCache {
  get(paragraph: string): LocalCandidates | undefined;
  set(paragraph: string, candidates: LocalCandidates): void;
  readonly size: number;
}

/** Small LRU (Map insertion order) so a long editing session cannot grow without bound. */
export function createDescriptionCache(limit = 6000): DescriptionCache {
  const map = new Map<string, LocalCandidates>();
  return {
    get(paragraph) {
      const hit = map.get(paragraph);
      if (hit !== undefined) {
        map.delete(paragraph);
        map.set(paragraph, hit);
      }
      return hit;
    },
    set(paragraph, candidates) {
      map.set(paragraph, candidates);
      if (map.size > limit) map.delete(map.keys().next().value as string);
    },
    get size() {
      return map.size;
    },
  };
}

const HAS_NOTATION = /[《｜|【]|\[tate\]/;

interface CleanParagraph {
  clean: string;
  rawStart: number[];
  rawEnd: number[];
}

/** Paragraph without notation, with a per-character map back to raw offsets. */
function cleanParagraph(raw: string): CleanParagraph {
  let clean = "";
  const rawStart: number[] = [];
  const rawEnd: number[] = [];
  const push = (char: string, from: number, to: number) => {
    clean += char;
    rawStart.push(from);
    rawEnd.push(to);
  };
  for (const { token, start, end } of tokenizeTategakiWithOffsets(raw)) {
    switch (token.type) {
      case "text":
        for (let i = 0; i < token.value.length; i += 1) push(token.value[i], start + i, start + i + 1);
        break;
      case "ruby": {
        // `｜漢字《かん》`: the base characters are analysed; the mark spans the whole notation.
        const baseOffset = start + (/^[｜|]/.test(raw.slice(start, start + 1)) ? 1 : 0);
        for (let i = 0; i < token.base.length; i += 1) {
          push(
            token.base[i],
            i === 0 ? start : baseOffset + i,
            i === token.base.length - 1 ? end : baseOffset + i + 1,
          );
        }
        break;
      }
      case "tcy":
        for (const char of token.value) push(char, start, end);
        break;
      case "pageBreak":
      case "image":
        push("\n", start, end);
        break;
    }
  }
  return { clean, rawStart, rawEnd };
}

function analyzeParagraphRaw(raw: string): LocalCandidates {
  if (raw.length === 0) return [];
  if (!HAS_NOTATION.test(raw)) return analyzeDescriptionParagraph(raw);
  const { clean, rawStart, rawEnd } = cleanParagraph(raw);
  return analyzeDescriptionParagraph(clean).map((candidate) => ({
    ...candidate,
    start: rawStart[candidate.start],
    end: rawEnd[candidate.end - 1],
  }));
}

function analyzeParagraphCached(paragraph: string, cache: DescriptionCache | undefined): LocalCandidates {
  const cached = cache?.get(paragraph);
  if (cached) return cached;
  const result = analyzeParagraphRaw(paragraph);
  cache?.set(paragraph, result);
  return result;
}

function toMarks(source: string, offset: number, local: LocalCandidates): DescriptionMark[] {
  return local.map((candidate) => ({
    ...candidate,
    start: candidate.start + offset,
    end: candidate.end + offset,
    text: source.slice(candidate.start + offset, candidate.end + offset),
  }));
}

/** Synchronous full analysis (tests, short manuscripts). All categories, sorted by position. */
export function analyzeDescriptionSource(source: string, cache?: DescriptionCache): DescriptionMark[] {
  const marks: DescriptionMark[] = [];
  let offset = 0;
  for (const paragraph of source.split("\n")) {
    marks.push(...toMarks(source, offset, analyzeParagraphCached(paragraph, cache)));
    offset += paragraph.length + 1;
  }
  return marks;
}

export interface DescriptionAsyncOptions {
  cache?: DescriptionCache;
  /** Work slice length before yielding to the browser. */
  budgetMs?: number;
  /** Return true to abandon the run (a newer edit superseded it). */
  isCancelled?: () => boolean;
  now?: () => number;
  yieldToBrowser?: () => Promise<void>;
}

const defaultYield = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Time-sliced analysis: never runs longer than `budgetMs` without yielding, so typing and
 * painting stay responsive on a long manuscript. Resolves `null` when cancelled.
 */
export async function analyzeDescriptionSourceAsync(
  source: string,
  options: DescriptionAsyncOptions = {},
): Promise<DescriptionMark[] | null> {
  const { cache, budgetMs = 8, isCancelled, now = () => performance.now(), yieldToBrowser = defaultYield } = options;
  const marks: DescriptionMark[] = [];
  let offset = 0;
  let sliceStart = now();
  for (const paragraph of source.split("\n")) {
    marks.push(...toMarks(source, offset, analyzeParagraphCached(paragraph, cache)));
    offset += paragraph.length + 1;
    if (now() - sliceStart >= budgetMs) {
      await yieldToBrowser();
      if (isCancelled?.()) return null;
      sliceStart = now();
    }
  }
  return isCancelled?.() ? null : marks;
}

/** The mark that contains `index` (a caret position), if any. `marks` must be sorted by start. */
export function findMarkAt<T extends { start: number; end: number }>(marks: readonly T[], index: number): T | null {
  let lo = 0;
  let hi = marks.length - 1;
  let candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (marks[mid].start <= index) {
      candidate = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  // Earlier marks can still cover `index` when marks overlap (A inside B): scan back a little.
  for (let i = candidate; i >= 0 && i >= candidate - 4; i -= 1) {
    if (marks[i].start <= index && index < marks[i].end) return marks[i];
  }
  return null;
}
