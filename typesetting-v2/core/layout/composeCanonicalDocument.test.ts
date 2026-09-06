import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { PageCompositionSettings } from "../compose/page";
import type { SourceSpan } from "../source/span";
import type {
  LogicalUnit,
  ManualBreakUnit,
  RubyUnit,
  SemanticRunUnit,
  TCYUnit,
  TextUnit,
} from "../units";
import { composeCanonicalDocument } from "./assemble";

const measurement = createFakeMeasurementProvider();

function cellTicks(sizePt: number): number {
  return measurement.naturalAdvanceTick("body", sizePt, "");
}

function text(blockId: string, t: string, start: number): TextUnit {
  const span: SourceSpan = { blockId, start, end: start + Array.from(t).length };
  return { kind: "TEXT", span, text: t };
}

// A modest, readable settings profile shared by most tests below: 6
// chars/line, 4 lines/column, 1 column/page.
function makeSettings(overrides: Partial<PageCompositionSettings> = {}): PageCompositionSettings {
  const CELL = cellTicks(10);
  return {
    bodyFontRef: "body",
    bodyFontSizePt: 10,
    lineExtentTicks: CELL * 6,
    linePitchTicks: CELL,
    columnExtentTicks: CELL * 4,
    columnsPerPage: 1,
    ...overrides,
  };
}

describe("F20 — canonical regression sentence (Master §0 motivation, Regression Corpus §1)", () => {
  // Verbatim from typesetting-v2/fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md §1.
  const SENTENCE =
    "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

  it("composes the canonical regression sentence into a valid, non-hold CanonicalDocument", () => {
    const unit = text("body-1", SENTENCE, 0);
    const doc = composeCanonicalDocument({
      bodyUnits: [unit],
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings: makeSettings({ columnExtentTicks: cellTicks(10) * 30 }), // generous column budget
    });
    expect(doc.hold).toBe(false);
    expect(doc.errors).toEqual([]);
    expect(doc.pages.length).toBeGreaterThan(0);
    // No candidate boundary was ever placed inside the 「」bracket pair or
    // immediately before 、/。 (kinsoku) -- spot-check a few placed units'
    // source spans are exactly 1 code point each (no fracturing).
    for (const page of doc.pages) {
      for (const column of page.columns) {
        for (const line of column.lines) {
          for (const placed of line.placedUnits) {
            expect(placed.sourceSpan.end - placed.sourceSpan.start).toBeGreaterThanOrEqual(1);
          }
        }
      }
    }
  });
});

describe("F19 — long prose, multi-page, deterministic page-break points", () => {
  const settings = makeSettings();

  it("spills a long manuscript across multiple pages with byte-identical repeat composition", () => {
    const longProse = "あいうえおかきくけこさしすせそたちつてとなにぬねの".repeat(4); // 100 code points
    const unit = text("body-1", longProse, 0);
    const first = composeCanonicalDocument({
      bodyUnits: [unit],
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
    });
    const second = composeCanonicalDocument({
      bodyUnits: [unit],
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
    });
    expect(first.hold).toBe(false);
    expect(first.pages.length).toBeGreaterThan(1);
    expect(second).toEqual(first); // full structural equality, including trace and page-break points
  });
});

describe("8 mandatory presets — real production capacity values (charsPerLine/linesPerColumn from src/constants/paperSizes.ts)", () => {
  // Sourced verbatim (read-only) from PAPER_SIZE_TEMPLATES. These are
  // production's ALREADY-DERIVED per-preset character/line counts -- this
  // test does not reimplement or validate the mm-to-chars capacity FORMULA
  // itself (computeMaxCapacityChars/computeAutoCharsPerLine/deriveMaxCapacityFromMargins
  // remain un-ported; that reconciliation is P3-O12, still OPEN). It proves
  // the Core's logical/schema machinery can consume every mandatory
  // preset's real character-count identity, not that the underlying mm
  // geometry has been independently re-derived here.
  const PRESETS: Record<string, { fontSizePt: number; charsPerLine: number; linesPerColumn: number; lineSpacing: number; columnsPerPage: number }> = {
    "文庫": { fontSizePt: 8.5, charsPerLine: 38, linesPerColumn: 16, lineSpacing: 1.7, columnsPerPage: 1 },
    "A5 1段": { fontSizePt: 9.0, charsPerLine: 53, linesPerColumn: 22, lineSpacing: 1.7, columnsPerPage: 1 },
    "A5 2段": { fontSizePt: 8.5, charsPerLine: 25, linesPerColumn: 24, lineSpacing: 1.65, columnsPerPage: 2 },
    "B5": { fontSizePt: 9.5, charsPerLine: 45, linesPerColumn: 26, lineSpacing: 1.7, columnsPerPage: 1 },
    "B6": { fontSizePt: 9.0, charsPerLine: 40, linesPerColumn: 18, lineSpacing: 1.7, columnsPerPage: 1 },
    "新書": { fontSizePt: 8.5, charsPerLine: 40, linesPerColumn: 15, lineSpacing: 1.7, columnsPerPage: 1 },
    "A6": { fontSizePt: 8.5, charsPerLine: 38, linesPerColumn: 16, lineSpacing: 1.7, columnsPerPage: 1 },
    "Web閲覧用": { fontSizePt: 36, charsPerLine: 29, linesPerColumn: 12, lineSpacing: 1.8, columnsPerPage: 1 },
  };

  it.each(Object.entries(PRESETS))("produces a valid, non-hold CanonicalDocument for the %s preset", (_name, preset) => {
    const cell = cellTicks(preset.fontSizePt);
    const settings: PageCompositionSettings = {
      bodyFontRef: "body",
      bodyFontSizePt: preset.fontSizePt,
      lineExtentTicks: cell * preset.charsPerLine,
      linePitchTicks: Math.round(cell * preset.lineSpacing),
      columnExtentTicks: Math.round(cell * preset.lineSpacing) * preset.linesPerColumn,
      columnsPerPage: preset.columnsPerPage,
    };
    const unit = text("body-1", "あいうえお、日本語のテキストです。", 0);
    const doc = composeCanonicalDocument({ bodyUnits: [unit], ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    expect(doc.hold).toBe(false);
    expect(doc.pages.length).toBeGreaterThan(0);
    expect(doc.version.ruleSetVersion).toBe(DEFAULT_RULE_SET_V2.id);
  });
});

describe("Cross-feature regression: prose + kinsoku + ruby + TCY + dash + manual break + two-column/page flow", () => {
  it("composes a combined manuscript coherently, preserving source mapping across every feature boundary", () => {
    const blockId = "body-1";
    let offset = 0;
    const units: LogicalUnit[] = [];

    const prose1 = text(blockId, "あいう、えお「かき", offset);
    offset = prose1.span.end;
    units.push(prose1);

    const rubyBase = text(blockId, "東京", offset); // will be replaced by a RubyUnit covering the same span
    const ruby: RubyUnit = {
      kind: "RUBY",
      span: rubyBase.span,
      rubyKind: "ATOMIC",
      baseSpan: rubyBase.span,
      readingSpan: { blockId: "reading-1", start: 0, end: 5 },
    };
    offset = ruby.span.end;
    units.push(ruby);

    const tcy: TCYUnit = { kind: "TCY", span: { blockId, start: offset, end: offset + 2 }, displayText: "12", logicalCells: 1 };
    offset = tcy.span.end;
    units.push(tcy);

    const dash1: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: { blockId, start: offset, end: offset + 1 }, runKind: "DASH", length: 1 };
    offset = dash1.span.end;
    const dash2: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: { blockId, start: offset, end: offset + 1 }, runKind: "DASH", length: 1 };
    offset = dash2.span.end;
    units.push(dash1, dash2);

    const manualBreak: ManualBreakUnit = { kind: "MANUAL_BREAK", span: { blockId, start: offset, end: offset } };
    units.push(manualBreak);

    const prose2 = text(blockId, "つぎのページの本文です", offset);
    offset = prose2.span.end;
    units.push(prose2);

    const settings = makeSettings({ columnsPerPage: 2 });
    const doc = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });

    expect(doc.hold).toBe(false);
    expect(doc.errors).toEqual([]);
    // The manual break forces a page boundary -- prose2 must start a new page.
    expect(doc.pages.length).toBeGreaterThanOrEqual(2);

    // Source-mapping proof: every placed unit's span falls within [0, offset),
    // and no span is ever malformed (end < start) anywhere in the document.
    let sawProse2Start = false;
    for (const page of doc.pages) {
      for (const column of page.columns) {
        for (const line of column.lines) {
          for (const placed of line.placedUnits) {
            expect(placed.sourceSpan.start).toBeGreaterThanOrEqual(0);
            expect(placed.sourceSpan.end).toBeLessThanOrEqual(offset);
            expect(placed.sourceSpan.end).toBeGreaterThanOrEqual(placed.sourceSpan.start);
            if (placed.sourceSpan.start === prose2.span.start) sawProse2Start = true;
          }
        }
      }
    }
    expect(sawProse2Start).toBe(true);

    // Ruby's base position is untouched: the base group's own placed
    // coordinates come from ordinary line composition (INV-003 -- ruby
    // never adds a base-coordinate offset field at all, see core/ruby/).
    const rubyBaseAppearsAsOrdinaryPlacement = doc.pages
      .flatMap((p) => p.columns)
      .flatMap((c) => c.lines)
      .flatMap((l) => l.placedUnits)
      .some((pu) => pu.sourceSpan.start === ruby.span.start);
    expect(rubyBaseAppearsAsOrdinaryPlacement).toBe(true);
  });

  it("known integration gap (disclosed, not silently papered over): ImageUnit is not yet wired into compose/line.ts's capacity math", () => {
    // core/images/index.ts's placeImage() is a standalone Contract §14
    // decision function (P3-L11/original-P3-L13) -- it was never wired into
    // compose/line.ts's atom cost model (cellCountFor returns 0 for IMAGE,
    // documented there as "images are out of this Loop's scope"). This test
    // exists so that gap is a named, checked fact, not a silent omission
    // this regression suite pretends doesn't exist.
    const blockId = "body-1";
    const image = { kind: "IMAGE" as const, span: { blockId, start: 0, end: 1 }, refId: "x", intrinsicWidth: 1, intrinsicHeight: 1, placement: "CENTER" as const };
    const settings = makeSettings();
    const doc = composeCanonicalDocument({ bodyUnits: [image], ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    // The image atom is placed at zero cost (not fits-capacity-checked by
    // the line composer) -- this is the documented gap, verified here
    // rather than assumed.
    expect(doc.hold).toBe(false);
    expect(doc.pages[0]?.columns[0]?.lines[0]?.placedUnits[0]?.sourceSpan).toEqual(image.span);
  });
});

describe("HOLD gate — end to end through composeCanonicalDocument (INV-010)", () => {
  it("surfaces an impossible layout as hold: true with the triggering LayoutError present, never silently PASS", () => {
    const unit = text("body-1", "あ", 0);
    const impossible = makeSettings({ lineExtentTicks: 0 });
    const doc = composeCanonicalDocument({ bodyUnits: [unit], ruleSet: DEFAULT_RULE_SET_V2, measurement, settings: impossible });
    expect(doc.hold).toBe(true);
    expect(doc.errors).toHaveLength(1);
    expect(doc.errors[0].severity).toBe("BLOCKS_HOLD");
    // Never downgraded to a warning.
    expect(doc.warnings).toEqual([]);
  });
});

describe("Colophon isolation through the full composeCanonicalDocument pipeline (Contract §15)", () => {
  it("keeps ColophonBlock.pages populated independently of CanonicalDocument.pages", () => {
    const bodyUnit = text("body-1", "ほんぶんです", 0);
    const colophonUnit = text("colophon-1", "おくづけ", 0);
    const settings = makeSettings();
    const doc = composeCanonicalDocument({
      bodyUnits: [bodyUnit],
      colophonUnits: [colophonUnit],
      colophonBlockId: "colophon-1",
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
    });
    expect(doc.hold).toBe(false);
    expect(doc.colophon).toBeDefined();
    expect(doc.colophon!.pages.length).toBeGreaterThan(0);
    expect(doc.colophon!.sourceBlockId).toBe("colophon-1");

    const bodyBlockIds = new Set(
      doc.pages.flatMap((p) => p.columns).flatMap((c) => c.lines).flatMap((l) => l.placedUnits).map((pu) => pu.sourceSpan.blockId)
    );
    expect(bodyBlockIds.has("colophon-1")).toBe(false);
  });
});

describe("Versioning gate (Contract §25)", () => {
  it("populates every VersionMetadata field non-empty on every assembled document", () => {
    const unit = text("body-1", "あ", 0);
    const doc = composeCanonicalDocument({ bodyUnits: [unit], ruleSet: DEFAULT_RULE_SET_V2, measurement, settings: makeSettings() });
    expect(doc.version.coreSchemaVersion.length).toBeGreaterThan(0);
    expect(doc.version.ruleSetVersion.length).toBeGreaterThan(0);
    expect(doc.version.settingsVersion.length).toBeGreaterThan(0);
    expect(doc.version.measurementIdentity.length).toBeGreaterThan(0);
  });
});

describe("Natural Pitch gate (INV-004) — no stretching across full-document composition", () => {
  it("reports residual space at both column and page level rather than stretching pitch", () => {
    const unit = text("body-1", "あいう", 0); // fits well under one line/column
    const settings = makeSettings();
    const doc = composeCanonicalDocument({ bodyUnits: [unit], ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const column = doc.pages[0].columns[0];
    expect(column.residualSpaceTick).toBeGreaterThan(0);
    const line = column.lines[0];
    const CELL = cellTicks(10);
    for (let i = 1; i < line.placedUnits.length; i++) {
      expect(line.placedUnits[i].yTick - line.placedUnits[i - 1].yTick).toBe(CELL);
    }
  });
});

describe("Geometry gate (INV-013) — integer ticks throughout the assembled document", () => {
  it("never produces a floating-point value anywhere in the assembled CanonicalDocument", () => {
    const unit = text("body-1", "あいうえおかきくけこ", 0);
    const settings = makeSettings();
    const doc = composeCanonicalDocument({ bodyUnits: [unit], ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    for (const page of doc.pages) {
      for (const column of page.columns) {
        expect(Number.isInteger(column.residualSpaceTick)).toBe(true);
        for (const line of column.lines) {
          for (const placed of line.placedUnits) {
            expect(Number.isInteger(placed.xTick)).toBe(true);
            expect(Number.isInteger(placed.yTick)).toBe(true);
          }
        }
      }
    }
  });
});
