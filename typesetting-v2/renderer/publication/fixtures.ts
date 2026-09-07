// P3-O08 — Publication Renderer Foundation: controlled fixture corpus.
//
// Re-declared here as this foundation's own corpus, same convention already
// established by Preview (`renderer/preview/fixtures.ts`'s own comment) —
// never imported from `renderer/preview/`, keeping Publication a sibling
// consumer of Core, not a dependent of Preview. `buildFixtureUnits` is the
// same already-shared, pure-offset-arithmetic Core-adjacent test
// infrastructure reused by Stage C, Stage D, and Preview.

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
    bodyFontRef: "p3-o08-publication-font",
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

export const ALL_FIXTURES: FoundationFixture[] = [
  fixture(
    "f20-canonical-sentence",
    "F20 — Canonical Regression Sentence",
    [{ kind: "TEXT", text: "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」" }],
    { charsPerLine: 14, linesPerColumn: 5, columnCount: 1 }
  ),

  fixture(
    "paragraph-manual-break",
    "Paragraph / Manual Page Break",
    [
      { kind: "TEXT", text: "第一章の始まり" },
      { kind: "PARAGRAPH_BREAK" },
      { kind: "TEXT", text: "続きの文章がここに入る" },
      { kind: "MANUAL_BREAK" },
      { kind: "TEXT", text: "次のページの内容" },
    ],
    { charsPerLine: 10, linesPerColumn: 2, columnCount: 1 }
  ),

  fixture("multi-column", "Multi-Column / Multi-Page", [{ kind: "TEXT", text: "あいうえおかきくけこさしすせそ" }], {
    charsPerLine: 5,
    linesPerColumn: 2,
    columnCount: 2,
  }),

  fixture(
    "atomic-ruby",
    "Ruby (canonical annotation geometry)",
    [
      { kind: "TEXT", text: "これは" },
      { kind: "RUBY", base: "東京", reading: "とうきょう" },
      { kind: "TEXT", text: "に行く用事があった" },
    ],
    { charsPerLine: 10, linesPerColumn: 3, columnCount: 1 }
  ),

  fixture("explicit-tcy", "TCY (explicit)", [{ kind: "TEXT", text: "西暦" }, { kind: "TCY", text: "2026" }, { kind: "TEXT", text: "年のことだった" }], {
    charsPerLine: 12,
    linesPerColumn: 2,
    columnCount: 1,
  }),

  fixture(
    "dash-ellipsis",
    "Dash / Ellipsis Runs",
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
    "Image (canonical occupancy, placeholder paint)",
    [
      { kind: "TEXT", text: "見てほしい" },
      { kind: "IMAGE", refId: "cover-sketch", intrinsicWidthTicks: mmToTicks(30), intrinsicHeightTicks: mmToTicks(30) },
      { kind: "TEXT", text: "この写真だ" },
    ],
    { charsPerLine: 8, linesPerColumn: 2, columnCount: 1 }
  ),
];

export const HOLD_FIXTURE_ID = "hold-empty-document";
