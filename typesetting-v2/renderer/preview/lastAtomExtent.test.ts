import { describe, expect, it } from "vitest";
import { lastAtomExtentTicks } from "../lastAtomExtent";
import type { LogicalUnit, PlacedUnit } from "../../core";

const CELL = 100;
const placed = (start: number, end: number, yTick: number): PlacedUnit => ({
  id: `p-${start}`,
  sourceSpan: { blockId: "b", start, end },
  xTick: 0,
  yTick,
});

describe("lastAtomExtentTicks — a line-final atom never borrows a wider neighbour's extent", () => {
  // A TOC entry ending the document: …… (5-cell leader run) then the page number.
  const run: LogicalUnit = { kind: "SEMANTIC_RUN", span: { blockId: "b", start: 3, end: 8 }, runKind: "ELLIPSIS", length: 5 };
  const runPlaced = placed(3, 8, 300);

  it("縦中横 page number after a 5-cell leader keeps its own single cell (Phase 11 Human QA 「4」)", () => {
    const tcy: LogicalUnit = { kind: "TCY", span: { blockId: "b", start: 8, end: 9 }, displayText: "4", logicalCells: 1 };
    expect(
      lastAtomExtentTicks({ owner: tcy, placed: placed(8, 9, 800), prev: runPlaced, cellTicks: CELL, remainingLineExtentTicks: 10_000 })
    ).toBe(CELL);
  });

  it("a 1-cell TEXT atom after a run is one cell, but keeps a compressed delta (。」)", () => {
    const text: LogicalUnit = { kind: "TEXT", span: { blockId: "b", start: 8, end: 9 }, text: "あ" };
    expect(
      lastAtomExtentTicks({ owner: text, placed: placed(8, 9, 800), prev: runPlaced, cellTicks: CELL, remainingLineExtentTicks: 10_000 })
    ).toBe(CELL);
    expect(
      lastAtomExtentTicks({ owner: text, placed: placed(8, 9, 850), prev: placed(7, 8, 800), cellTicks: CELL, remainingLineExtentTicks: 10_000 })
    ).toBe(50);
  });

  it("multi-cell atoms keep their own cell count, and every estimate is clamped to the line", () => {
    expect(lastAtomExtentTicks({ owner: run, placed: runPlaced, prev: undefined, cellTicks: CELL, remainingLineExtentTicks: 10_000 })).toBe(500);
    const tcy: LogicalUnit = { kind: "TCY", span: { blockId: "b", start: 8, end: 9 }, displayText: "4", logicalCells: 1 };
    expect(lastAtomExtentTicks({ owner: tcy, placed: placed(8, 9, 800), prev: runPlaced, cellTicks: CELL, remainingLineExtentTicks: 40 })).toBe(40);
  });
});
