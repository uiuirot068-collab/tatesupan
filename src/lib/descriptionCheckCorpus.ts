/**
 * TSP-B5 — reader/evaluator for the human-readable spec corpus
 * (`typesetting-v2/qa/b5-description-check/B5_SPEC_REGRESSION_CORPUS.md`).
 * The markdown table IS the data: a Human adds or edits rows, the regression test follows.
 * Pure (no fs): callers pass the markdown text in.
 */
import { analyzeDescriptionParagraph, type DescriptionCandidate, type DescriptionCategory } from "./descriptionCheck";

export type CorpusKind = DescriptionCategory | "対象外" | "迷う";
export type CorpusState = "期待" | "既知の取りこぼし";

export interface CorpusRow {
  id: string;
  kind: CorpusKind;
  sentence: string;
  mark: string;
  state: CorpusState;
  note: string;
}

export interface CorpusOutcome {
  row: CorpusRow;
  /** null for 迷う rows (never judged). */
  passed: boolean | null;
  found: string[];
}

const KINDS = new Set(["A", "B", "C", "対象外", "迷う"]);

export function parseCorpus(markdown: string): CorpusRow[] {
  const rows: CorpusRow[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    if (!/^\|\s*[DUV]-\d+\s*\|/.test(line)) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5) throw new Error(`corpus row has too few columns: ${line}`);
    const [id, kind, sentence, mark, state, note = ""] = cells;
    if (!KINDS.has(kind)) throw new Error(`${id}: unknown 区分 ${kind}`);
    if (state !== "期待" && state !== "既知の取りこぼし") throw new Error(`${id}: unknown 状態 ${state}`);
    if (!sentence.includes(mark)) throw new Error(`${id}: 印の箇所「${mark}」が文の中にありません`);
    rows.push({ id, kind: kind as CorpusKind, sentence, mark, state, note });
  }
  return rows;
}

const describe = (sentence: string, c: DescriptionCandidate) => `${c.category}:${sentence.slice(c.start, c.end)}`;

export function evaluateRow(row: CorpusRow): CorpusOutcome {
  const candidates = analyzeDescriptionParagraph(row.sentence);
  const found = candidates.map((c) => describe(row.sentence, c));
  const at = row.sentence.indexOf(row.mark);
  const end = at + row.mark.length;
  if (row.kind === "迷う") return { row, passed: null, found };
  if (row.kind === "対象外") {
    return { row, passed: !candidates.some((c) => c.start < end && c.end > at), found };
  }
  const hit = candidates.some((c) => c.category === row.kind && c.start <= at && c.end >= end);
  return { row, passed: hit, found };
}

export function evaluateCorpus(rows: readonly CorpusRow[]): CorpusOutcome[] {
  return rows.map(evaluateRow);
}
