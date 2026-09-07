import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { ManualBreakUnit, TextUnit } from "../units";
import { composePage, composePages, type PageCompositionSettings } from "./page";

const BLOCK = "body-1";
const measurement = createFakeMeasurementProvider();
const CELL = measurement.naturalAdvanceTick("body", 10, "");

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}

function text(t: string, start: number): TextUnit {
  return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
}

// 3 chars/line, 2 lines/column -> 6 chars/column.
const baseSettings: PageCompositionSettings = {
  bodyFontRef: "body",
  bodyFontSizePt: 10,
  lineExtentTicks: CELL * 3,
  linePitchTicks: CELL,
  columnExtentTicks: CELL * 2,
  columnsPerPage: 1,
};

describe("Single-page composition (test group A/B)", () => {
  it("fits everything on one page with one column when content is within one column's capacity", () => {
    // Starts with an auto-indent-exempt opening bracket (「) so this
    // capacity-mechanics test isn't perturbed by Human Product Decision A's
    // paragraph-first-line indent (see compose/line.ts's needsAutoIndent) —
    // this group tests page/column capacity, not indent.
    const unit = text("「いうえおか", 0); // 6 cells -> exactly one column (2 lines x 3)
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, baseSettings);
    expect(result.hold).toBeUndefined();
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].columns).toHaveLength(1);
  });

  it("fits everything on one page across two columns when columnsPerPage=2", () => {
    const twoColumn: PageCompositionSettings = { ...baseSettings, columnsPerPage: 2 };
    const unit = text("「いうえおかきくけこさし", 0); // 12 cells -> exactly two columns (indent-exempt opener, see note above)
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, twoColumn);
    expect(result.hold).toBeUndefined();
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].columns).toHaveLength(2);
    expect(result.pages[0].columns[1].lines[0].placedUnits[0].sourceSpan.start).toBe(6);
  });
});

describe("Multi-page composition (test group C/D)", () => {
  it("spills into a second page when content exceeds one column and columnsPerPage=1", () => {
    const unit = text("あいうえおかきくけこ", 0); // 10 cells > 6-cell single column
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, baseSettings);
    expect(result.hold).toBeUndefined();
    expect(result.pages.length).toBeGreaterThanOrEqual(2);
    expect(result.pages[0].order).toBe(0);
    expect(result.pages[1].order).toBe(1);
  });

  it("spills into a second page when content exceeds a full two-column page", () => {
    const twoColumn: PageCompositionSettings = { ...baseSettings, columnsPerPage: 2 };
    const unit = text("あいうえおかきくけこさしすせそたちつてと", 0); // 20 cells > 12-cell page
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, twoColumn);
    expect(result.hold).toBeUndefined();
    expect(result.pages.length).toBeGreaterThanOrEqual(2);
    expect(result.pages[0].columns).toHaveLength(2);
  });
});

describe("Manual page break (test group E, INV-006)", () => {
  it("closes the current page immediately on a manual break, even under column/page capacity", () => {
    const before = text("あ", 0);
    const manualBreak: ManualBreakUnit = { kind: "MANUAL_BREAK", span: span(1, 1) };
    const after = text("いうえ", 1);
    const result = composePages([before, manualBreak, after], DEFAULT_RULE_SET_V2, measurement, baseSettings);
    expect(result.hold).toBeUndefined();
    // Page 1 forced closed after just one line (one cell), well under its
    // 6-cell column capacity; page 2 carries the remaining content.
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0].columns[0].lines).toHaveLength(1);
    expect(result.pages[0].columns[0].lines[0].placedUnits).toHaveLength(1);
    expect(result.pages[1].columns[0].lines[0].placedUnits[0].sourceSpan.start).toBe(1);
  });
});

describe("Source mapping survives page/column transitions (test group F, INV-001)", () => {
  it("covers the entire source range exactly once across every page/column/line", () => {
    const unit = text("あいうえおかきくけこさし", 0); // 12 cells
    const twoColumn: PageCompositionSettings = { ...baseSettings, columnsPerPage: 2 };
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, twoColumn);
    const spans: SourceSpan[] = [];
    for (const page of result.pages) {
      for (const column of page.columns) {
        for (const line of column.lines) {
          for (const placed of line.placedUnits) {
            spans.push(placed.sourceSpan);
          }
        }
      }
    }
    spans.sort((a, b) => a.start - b.start);
    expect(spans[0].start).toBe(0);
    expect(spans[spans.length - 1].end).toBe(12);
    for (let i = 1; i < spans.length; i++) {
      expect(spans[i].start).toBe(spans[i - 1].end); // contiguous, no gap or overlap
    }
  });
});

describe("Residual space and Natural Pitch (test group G/H, INV-004)", () => {
  it("reports column residual space without altering per-character pitch", () => {
    const unit = text("「いう", 0); // 3 cells in a 6-cell column (indent-exempt opener, see note above)
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, baseSettings);
    const column = result.pages[0].columns[0];
    expect(column.residualSpaceTick).toBe(CELL * 1); // one line placed, one line's worth of pitch left
    const line = column.lines[0];
    // Human Visual QA HOLD round 11 (yakumono half-body canonical model):
    // 「 (cl-01, opening bracket) now has an INTRINSIC half-em canonical
    // body — always, not only when paired with another yakumono
    // character — superseding round 8's now-retired "full-em body +
    // negative pair adjustment" model, under which this same fixture's
    // own pitch was a full CELL (この行 predates round 8 entirely; this
    // is Natural Pitch's own pre-existing test group G/H, unrelated to
    // punctuation-pair spacing specifically, exercising 「 only
    // incidentally as ordinary fixture text). い here is ordinary, not
    // in the half-body scope, so no side space applies to 「's own
    // advance either — its pitch is body-only, HALF_CELL.
    expect(line.placedUnits[1].yTick - line.placedUnits[0].yTick).toBe(CELL / 2);
  });
});

describe("8 mandatory presets instantiate logically (test group I)", () => {
  // Placeholder geometry per preset (P3-O12: real capacity-formula
  // reconciliation against production presets is a carried-forward, non-
  // blocking open item — this Loop proves the logical machinery accepts all
  // 8 preset identities, not their exact production dimensions).
  const presetNames = ["文庫", "A5 1段", "A5 2段", "B5", "B6", "新書", "A6", "Web閲覧用"];
  const presetSettings: Record<string, PageCompositionSettings> = Object.fromEntries(
    presetNames.map((name, i) => [
      name,
      {
        bodyFontRef: "body",
        bodyFontSizePt: 10,
        lineExtentTicks: CELL * (10 + i),
        linePitchTicks: CELL,
        columnExtentTicks: CELL * (5 + i),
        columnsPerPage: name.includes("2段") ? 2 : 1,
      },
    ])
  );

  it.each(presetNames)("produces a valid, non-hold page set for the %s preset", (name) => {
    const unit = text("あいうえお", 0);
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, presetSettings[name]);
    expect(result.hold).toBeUndefined();
    expect(result.pages.length).toBeGreaterThan(0);
  });
});

describe("Web preset keeps logical pages, never one infinite page (test group J, HD-001)", () => {
  it("still paginates long content under the Web preset rather than special-casing a single page", () => {
    const webSettings: PageCompositionSettings = { ...baseSettings, columnsPerPage: 1 };
    const unit = text("あいうえおかきくけこさしすせそ", 0); // 15 cells > one 6-cell column
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, webSettings);
    expect(result.pages.length).toBeGreaterThan(1);
  });
});

describe("Determinism (test group K, INV-005)", () => {
  it("produces identical page composition across repeated runs on the same input", () => {
    const unit = text("あいうえおかきくけこ", 0);
    const twoColumn: PageCompositionSettings = { ...baseSettings, columnsPerPage: 2 };
    const first = composePages([unit], DEFAULT_RULE_SET_V2, measurement, twoColumn);
    const second = composePages([unit], DEFAULT_RULE_SET_V2, measurement, twoColumn);
    expect(second).toEqual(first);
  });
});

describe("HOLD propagation (test group L)", () => {
  it("surfaces a page-level hold rather than silently discarding it", () => {
    const impossible: PageCompositionSettings = { ...baseSettings, lineExtentTicks: 0 };
    const unit = text("あ", 0);
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, impossible);
    expect(result.hold).toBeDefined();
  });

  it("composePage alone also surfaces the same hold", () => {
    const impossible: PageCompositionSettings = { ...baseSettings, lineExtentTicks: 0 };
    const unit = text("あ", 0);
    const result = composePage([unit], 0, DEFAULT_RULE_SET_V2, measurement, impossible, false);
    expect(result.hold).toBeDefined();
  });
});

describe("All canonical geometry is integer ticks (test group M, INV-013)", () => {
  it("never produces a floating-point value anywhere in the page/column/line hierarchy", () => {
    const unit = text("あいうえおかきくけこさし", 0);
    const twoColumn: PageCompositionSettings = { ...baseSettings, columnsPerPage: 2 };
    const result = composePages([unit], DEFAULT_RULE_SET_V2, measurement, twoColumn);
    for (const page of result.pages) {
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
