import { describe, expect, it } from "vitest";
import { composePages, type PageCompositionSettings } from "../compose/page";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { TextUnit } from "../units";
import { composeColophon } from "./index";

const measurement = createFakeMeasurementProvider();
const CELL = measurement.naturalAdvanceTick("body", 10, "");

const settings: PageCompositionSettings = {
  bodyFontRef: "body",
  bodyFontSizePt: 10,
  lineExtentTicks: CELL * 3,
  linePitchTicks: CELL,
  columnExtentTicks: CELL * 2,
  columnsPerPage: 1,
};

function text(blockId: string, t: string, start: number): TextUnit {
  const span: SourceSpan = { blockId, start, end: start + Array.from(t).length };
  return { kind: "TEXT", span, text: t };
}

describe("Colophon isolation from body pagination (Contract §15, structural separation)", () => {
  it("composes the colophon's pages entirely independently of the body document's pages", () => {
    const bodyUnit = text("body-1", "あいうえおかきくけこ", 0); // 10 cells
    const colophonUnit = text("colophon-1", "ちょしゃ：たなか", 0); // 8 cells

    const bodyResult = composePages([bodyUnit], DEFAULT_RULE_SET_V2, measurement, settings);
    const colophonPagesResult = composePages([colophonUnit], DEFAULT_RULE_SET_V2, measurement, settings);
    const colophonBlock = composeColophon("colophon-1", colophonPagesResult.pages);

    expect(bodyResult.hold).toBeUndefined();
    expect(colophonPagesResult.hold).toBeUndefined();

    // ColophonBlock.pages is populated independently of the body document's
    // own page array -- two entirely separate arrays, never merged.
    expect(colophonBlock.pages.length).toBeGreaterThan(0);
    expect(colophonBlock.sourceBlockId).toBe("colophon-1");

    // Structural separation: no placed unit anywhere in the BODY pages
    // carries a sourceSpan from the colophon's blockId, and vice versa.
    const bodyBlockIds = new Set<string>();
    for (const page of bodyResult.pages) {
      for (const column of page.columns) {
        for (const line of column.lines) {
          for (const placed of line.placedUnits) {
            bodyBlockIds.add(placed.sourceSpan.blockId);
          }
        }
      }
    }
    expect(bodyBlockIds.has("colophon-1")).toBe(false);
    expect(bodyBlockIds.has("body-1")).toBe(true);

    const colophonBlockIds = new Set<string>();
    for (const page of colophonBlock.pages) {
      for (const column of page.columns) {
        for (const line of column.lines) {
          for (const placed of line.placedUnits) {
            colophonBlockIds.add(placed.sourceSpan.blockId);
          }
        }
      }
    }
    expect(colophonBlockIds.has("body-1")).toBe(false);
    expect(colophonBlockIds.has("colophon-1")).toBe(true);
  });

  it("preserves source mapping through colophon composition (INV-001)", () => {
    const colophonUnit = text("colophon-1", "たなか", 0);
    const { pages } = composePages([colophonUnit], DEFAULT_RULE_SET_V2, measurement, settings);
    const colophonBlock = composeColophon("colophon-1", pages);
    const placed = colophonBlock.pages[0].columns[0].lines[0].placedUnits[0];
    expect(placed.sourceSpan).toEqual({ blockId: "colophon-1", start: 0, end: 1 });
  });
});
