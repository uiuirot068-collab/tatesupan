// Stage D — fixture corpus. Reuses Stage C's own fixture builder
// (`typesetting-v2/tools/compare/fixtureBuilder.ts`) since it already
// supports every LogicalUnit kind this adapter needs to demonstrate —
// avoids re-authoring the same hand-construction logic a second time.

import type { LogicalUnit, PageCompositionSettings } from "../../core";
import { mmToTicks } from "../../core";
import { buildFixtureUnits, type FixturePiece } from "../compare/fixtureBuilder";

const BLOCK = "body";
const BODY_FONT_SIZE_PT = 10.5;

export interface AdapterCapacity {
  charsPerLine: number;
  linesPerColumn: number;
  columnCount: 1 | 2;
}

export function settingsFor(capacity: AdapterCapacity): PageCompositionSettings {
  const perCellAdvanceTick = mmToTicks((BODY_FONT_SIZE_PT * 25.4) / 72);
  return {
    bodyFontRef: "stage-d-preview-font",
    bodyFontSizePt: BODY_FONT_SIZE_PT,
    lineExtentTicks: capacity.charsPerLine * perCellAdvanceTick,
    linePitchTicks: perCellAdvanceTick,
    columnExtentTicks: capacity.linesPerColumn * perCellAdvanceTick,
    columnsPerPage: capacity.columnCount,
  };
}

export interface AdapterFixture {
  id: string;
  label: string;
  bodyUnits: LogicalUnit[];
  source: string;
  capacity: AdapterCapacity;
}

function fixture(id: string, label: string, pieces: FixturePiece[], capacity: AdapterCapacity): AdapterFixture {
  const { units, source } = buildFixtureUnits(BLOCK, pieces);
  return { id, label, bodyUnits: units, source, capacity };
}

// F20 — mandatory canonical regression sentence.
const CANONICAL_SENTENCE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

// Approved long non-repeating Human QA prose — copied from
// prototypes/ui-comparison/shared/content.js MANUSCRIPT_TEXT, per
// PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md §0 Decision 4 — extended with
// explicit PARAGRAPH_BREAK units (Human Product Decision B) instead of an
// inert literal "\n" (mirrors the fix already applied to Stage C's own
// long-non-repeating-prose fixture).
const LONG_PROSE_PIECES: FixturePiece[] = [
  { kind: "TEXT", text: "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」" },
  { kind: "PARAGRAPH_BREAK" },
  { kind: "PARAGRAPH_BREAK" },
  {
    kind: "TEXT",
    text:
      "窓の外では雨が降り続いていた。傘を持たずに出てきたことを、今更ながら少し悔やんだ。それでも歩調を緩める気にはならなかった。" +
      "駅までの道のりは、いつもよりずっと長く感じられた。",
  },
  { kind: "PARAGRAPH_BREAK" },
  { kind: "PARAGRAPH_BREAK" },
  { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
  { kind: "TEXT", text: "それでも、まだ引き返す理由にはならない。" },
];

export const ALL_FIXTURES: AdapterFixture[] = [
  fixture("f20-canonical-sentence", "F20 — Canonical Regression Sentence", [{ kind: "TEXT", text: CANONICAL_SENTENCE }], {
    charsPerLine: 14,
    linesPerColumn: 5,
    columnCount: 1,
  }),

  fixture("long-prose", "Long Non-Repeating Prose (Human QA fixture)", LONG_PROSE_PIECES, {
    charsPerLine: 16,
    linesPerColumn: 5,
    columnCount: 1,
  }),

  fixture(
    "paragraph-blank-line",
    "Paragraph Breaks + Blank Line (Human Product Decisions A/B)",
    [
      { kind: "TEXT", text: "第一段落です。" },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "TEXT", text: "第二段落です。" },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "TEXT", text: "空行の後の段落です。" },
    ],
    { charsPerLine: 20, linesPerColumn: 6, columnCount: 1 }
  ),

  fixture(
    "manual-page-break",
    "Manual Page Break (no phantom line — Root Cause C not ported)",
    [{ kind: "TEXT", text: "第一章" }, { kind: "MANUAL_BREAK" }, { kind: "TEXT", text: "第二章の本文です" }],
    { charsPerLine: 10, linesPerColumn: 5, columnCount: 1 }
  ),

  fixture(
    "two-column-flow",
    "Two-Column Flow",
    [{ kind: "TEXT", text: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわ" }],
    { charsPerLine: 6, linesPerColumn: 3, columnCount: 2 }
  ),

  fixture(
    "multi-page",
    "Multi-Page Flow",
    [{ kind: "TEXT", text: "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんABCDEFGHIJ" }],
    { charsPerLine: 4, linesPerColumn: 3, columnCount: 1 }
  ),

  fixture(
    "atomic-ruby",
    "Ruby (logical placement final; annotation painting provisional)",
    [
      { kind: "TEXT", text: "これは" },
      { kind: "RUBY", base: "東京", reading: "とうきょう", rubyKind: "ATOMIC" },
      { kind: "TEXT", text: "に行く用事があった" },
    ],
    { charsPerLine: 10, linesPerColumn: 5, columnCount: 1 }
  ),

  fixture(
    "explicit-tcy",
    "Explicit TCY (logical grouping final; shaping provisional, P3-O03)",
    [{ kind: "TEXT", text: "その日は西暦" }, { kind: "TCY", text: "2026", logicalCells: 1 }, { kind: "TEXT", text: "年だった" }],
    { charsPerLine: 8, linesPerColumn: 5, columnCount: 1 }
  ),

  fixture(
    "dash-ellipsis",
    "Dash / Ellipsis Runs (optical alignment provisional, P3-O04/O05)",
    [
      { kind: "TEXT", text: "彼は" },
      { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
      { kind: "TEXT", text: "そうだ" },
      { kind: "SEMANTIC_RUN", text: "……", runKind: "ELLIPSIS" },
      { kind: "TEXT", text: "と静かに言った" },
    ],
    { charsPerLine: 6, linesPerColumn: 5, columnCount: 1 }
  ),

  fixture(
    "image-placeholder",
    "Image (placeholder rectangle; real decode not required for logical gate)",
    [
      { kind: "TEXT", text: "本文の前" },
      { kind: "IMAGE", refId: "cover-sketch", intrinsicWidthTicks: 40000, intrinsicHeightTicks: 30000, placement: "CENTER" },
      { kind: "TEXT", text: "本文の後" },
    ],
    { charsPerLine: 9, linesPerColumn: 1, columnCount: 1 }
  ),

  // HOLD example: a single TCY atom whose logical-cell cost exceeds a
  // deliberately too-small line extent — SINGLE_ATOM_EXCEEDS_LINE_EXTENT,
  // never a guessed fit (Contract §26).
  fixture(
    "hold-example",
    "HOLD Example (structured hold, never an approved layout)",
    [{ kind: "TCY", text: "2026", logicalCells: 5 }],
    { charsPerLine: 2, linesPerColumn: 3, columnCount: 1 }
  ),
];
