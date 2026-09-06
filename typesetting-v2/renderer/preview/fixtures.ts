// P3-O09 — Preview Renderer Foundation: controlled fixture corpus.
//
// "Migrate controlled fixtures to final Renderer path" (P3-O09 task
// instruction): the fixture DATA (F20, long non-repeating prose, paragraph/
// blank-line, manual page break, two-column, multi-page, ruby, TCY, dash/
// ellipsis, image, HOLD) is re-declared here as this foundation's own
// corpus, rather than importing `tools/preview-dev-adapter/fixtures.ts` —
// this keeps the final Renderer module free of any dependency on the
// disposable Stage D QA tool. The fixture BUILDER (`buildFixtureUnits`,
// pure offset arithmetic, no typesetting decision of its own) is reused
// from `tools/compare/fixtureBuilder.ts` — already shared by both Stage C
// and Stage D, an established Core-adjacent test-infrastructure dependency,
// not QA-tool-specific styling or output mechanism.

import type { LogicalUnit, PageCompositionSettings } from "../../core";
import { mmToTicks } from "../../core";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";

const BLOCK = "body";
const BODY_FONT_SIZE_PT = 10.5;

export interface FoundationCapacity {
  charsPerLine: number;
  linesPerColumn: number;
  columnCount: 1 | 2;
}

export function settingsFor(capacity: FoundationCapacity): PageCompositionSettings {
  const perCellAdvanceTick = mmToTicks((BODY_FONT_SIZE_PT * 25.4) / 72);
  return {
    bodyFontRef: "p3-o09-preview-font",
    bodyFontSizePt: BODY_FONT_SIZE_PT,
    lineExtentTicks: capacity.charsPerLine * perCellAdvanceTick,
    linePitchTicks: perCellAdvanceTick,
    columnExtentTicks: capacity.linesPerColumn * perCellAdvanceTick,
    columnsPerPage: capacity.columnCount,
  };
}

export interface FoundationFixture {
  id: string;
  label: string;
  bodyUnits: LogicalUnit[];
  source: string;
  capacity: FoundationCapacity;
}

function fixture(id: string, label: string, pieces: FixturePiece[], capacity: FoundationCapacity): FoundationFixture {
  const { units, source } = buildFixtureUnits(BLOCK, pieces);
  return { id, label, bodyUnits: units, source, capacity };
}

const CANONICAL_SENTENCE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

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

export const ALL_FIXTURES: FoundationFixture[] = [
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
    "Manual Page Break (no phantom line)",
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
    "Ruby (body + annotation geometry active; exact overhang/optical tuning pending — P3-O06)",
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
    "Dash / Ellipsis Runs (dash: painted-bar treatment active, P3-O04; ellipsis: optical alignment still provisional, P3-O05 OPEN)",
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

  fixture(
    "hold-example",
    "HOLD Example (structured hold, never an approved layout)",
    [{ kind: "TCY", text: "2026", logicalCells: 5 }],
    { charsPerLine: 2, linesPerColumn: 3, columnCount: 1 }
  ),
];
