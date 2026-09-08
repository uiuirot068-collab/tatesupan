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
 */
import { tokenizeTategakiWithOffsets } from "../tategaki";
import { mmToTicks } from "../../../typesetting-v2/core/geometry/tick";
import type { LogicalUnit } from "../../../typesetting-v2/core/units";

const IMAGE_MARKER_CHAR = String.fromCharCode(1);

function pushPlainText(blockId: string, text: string, state: { cursor: number; flow: string; units: LogicalUnit[] }): void {
  const parts = text.split("\n");
  parts.forEach((part, i) => {
    if (part.length > 0) {
      const start = state.cursor;
      state.cursor += Array.from(part).length;
      state.flow += part;
      state.units.push({ kind: "TEXT", span: { blockId, start, end: state.cursor }, text: part });
    }
    if (i < parts.length - 1) {
      const start = state.cursor;
      state.cursor += 1;
      state.flow += "\n";
      state.units.push({ kind: "PARAGRAPH_BREAK", span: { blockId, start, end: state.cursor } });
    }
  });
}

export interface ManuscriptComposition {
  units: LogicalUnit[];
  source: string;
}

/**
 * `blockId` identifies this manuscript's own SourceBlock (Contract §1) --
 * pass a stable id for the body block (e.g. `"body"`).
 */
export function buildV2UnitsFromManuscript(blockId: string, content: string): ManuscriptComposition {
  const tokens = tokenizeTategakiWithOffsets(content).map((t) => t.token);
  const state = { cursor: 0, flow: "", units: [] as LogicalUnit[] };
  const readingQueue: Array<{ text: string; unitIndex: number }> = [];

  for (const token of tokens) {
    if (token.type === "text") {
      pushPlainText(blockId, token.value, state);
    } else if (token.type === "ruby") {
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
      });
      readingQueue.push({ text: token.rt, unitIndex });
    } else if (token.type === "tcy") {
      const start = state.cursor;
      state.cursor += Array.from(token.value).length;
      state.flow += token.value;
      // logicalCells: 1 -- matches Core's own real convention (verified
      // against `core/tcy/index.test.ts`: a TCY run consumes exactly one
      // logical cell regardless of digit count, e.g. "1999" also uses 1).
      state.units.push({ kind: "TCY", span: { blockId, start, end: state.cursor }, displayText: token.value, logicalCells: 1 });
    } else if (token.type === "image") {
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

  return { units: state.units, source };
}
