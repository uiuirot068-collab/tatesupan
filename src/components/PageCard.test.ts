import { describe, expect, it } from "vitest";
import { buildLineSlots } from "./PageCard";

/**
 * TSP-RC-LATIN-CELL-PARITY-002 regression guard.
 *
 * Verifies the SLOT MODEL `buildLineSlots` produces for ordinary Latin text,
 * not a pixel/DOM snapshot: every ordinary character -- Latin or Japanese --
 * gets exactly one canonical slot, one slotIndex apart, matching
 * Publication's `verticalGraphemeCommands` (one grapheme per cell, no run
 * grouping). This is the model Human visual QA asked for after rejecting an
 * earlier attempt (`fc3f6e3`) that grouped 2+ Latin characters into one
 * shaped/kerned run occupying `ceil(measuredAdvanceEm)` canonical slots and
 * centered the leftover slack inside that reservation -- which merely
 * redistributed the false gap instead of removing it. That model, and its
 * `latinRuns`/`LatinRun`/`data-latin-run` machinery, must not silently
 * return: this test fails if `buildLineSlots`'s return shape ever grows a
 * `latinRuns` field again, or if any ordinary multi-character Latin run
 * stops landing on consecutive, unbroken slotIndex values.
 */
function textLine(value: string) {
  return [{ type: "text" as const, value }];
}

const CHARS_PER_LINE = 40;

describe("buildLineSlots — ordinary Latin cell parity (TSP-RC-LATIN-CELL-PARITY-002)", () => {
  it.each([
    ["PCの", ["P", "C", "の"]],
    ["IDの", ["I", "D", "の"]],
    ["SNSの", ["S", "N", "S", "の"]],
  ])("gives %s one canonical slot per character, no run grouping", (value, expectedChars) => {
    const result = buildLineSlots(textLine(value), 0, [false], CHARS_PER_LINE);

    expect(result.slots.map((slot) => slot.text)).toEqual(expectedChars);
    // One slot per character, immediately consecutive -- no reserved-but-
    // unfilled slot (the exact defect both the original run-shaping and the
    // rejected centering fix left behind) can exist between any two chars.
    expect(result.slots.map((slot) => slot.slotIndex)).toEqual(
      expectedChars.map((_, i) => i)
    );
  });

  it("keeps natural spacing on both boundaries of a Japanese-Latin-Japanese run", () => {
    const value = "日本語PC日本語";
    const result = buildLineSlots(textLine(value), 0, [false], CHARS_PER_LINE);
    const chars = Array.from(value);

    expect(result.slots.map((slot) => slot.text)).toEqual(chars);
    expect(result.slots.map((slot) => slot.slotIndex)).toEqual(chars.map((_, i) => i));
  });

  it("stays on the canonical grid for a longer ordinary Latin run", () => {
    const value = "ABCDEFGHIJの";
    const result = buildLineSlots(textLine(value), 0, [false], CHARS_PER_LINE);
    const chars = Array.from(value);

    expect(result.slots).toHaveLength(chars.length);
    expect(result.slots.map((slot) => slot.slotIndex)).toEqual(chars.map((_, i) => i));
  });

  it("never reintroduces a latinRuns field on the return shape", () => {
    const result = buildLineSlots(textLine("PCの"), 0, [false], CHARS_PER_LINE);
    expect(Object.prototype.hasOwnProperty.call(result, "latinRuns")).toBe(false);
  });

  it("leaves the dash protected-run and auto-TCY paths untouched", () => {
    const dashResult = buildLineSlots(textLine("――です"), 0, [false], CHARS_PER_LINE);
    expect(dashResult.protectedRuns).toEqual([
      expect.objectContaining({ kind: "dash", text: "――", startSlot: 0, slotCount: 2 }),
    ]);
    // The dash run's own two slots are consumed from slotCursor -- です starts right after.
    expect(dashResult.slots.map((slot) => slot.text)).toEqual(["で", "す"]);
    expect(dashResult.slots.map((slot) => slot.slotIndex)).toEqual([2, 3]);

    const tcyLine = [
      { type: "text" as const, value: "甲" },
      { type: "tcy" as const, value: "12" },
      { type: "text" as const, value: "乙" },
    ];
    const tcyResult = buildLineSlots(tcyLine, 0, [false, false, false], CHARS_PER_LINE);
    expect(tcyResult.tcyCells).toEqual([
      expect.objectContaining({ slotIndex: 1, value: "12" }),
    ]);
  });
});
