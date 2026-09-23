import { describe, expect, it } from "vitest";
import { buildCategorySegments } from "./descriptionMarkSegments";
import { formatCandidatePosition, stepDescriptionCandidate } from "./descriptionCandidateNav";

const marks = [
  { start: 2, end: 5 },
  { start: 10, end: 14 },
  { start: 20, end: 22 },
];

describe("B5 footer card: previous / next over the visible candidates", () => {
  it("with a current candidate it moves to the neighbour and wraps at both ends", () => {
    expect(stepDescriptionCandidate(marks, marks[0], 3, 1)).toEqual({ mark: marks[1], index: 1 });
    expect(stepDescriptionCandidate(marks, marks[1], 11, -1)).toEqual({ mark: marks[0], index: 0 });
    expect(stepDescriptionCandidate(marks, marks[2], 21, 1)).toEqual({ mark: marks[0], index: 0 });
    expect(stepDescriptionCandidate(marks, marks[0], 3, -1)).toEqual({ mark: marks[2], index: 2 });
  });

  it("with no current candidate it starts from the caret: next = first one after it, previous = last one before it (wrapping)", () => {
    expect(stepDescriptionCandidate(marks, null, 6, 1)).toEqual({ mark: marks[1], index: 1 });
    expect(stepDescriptionCandidate(marks, null, 6, -1)).toEqual({ mark: marks[0], index: 0 });
    expect(stepDescriptionCandidate(marks, null, 99, 1)).toEqual({ mark: marks[0], index: 0 }); // past the end -> wrap
    expect(stepDescriptionCandidate(marks, null, 0, -1)).toEqual({ mark: marks[2], index: 2 }); // before the start -> wrap
    expect(stepDescriptionCandidate(marks, null, -1, 1)).toEqual({ mark: marks[0], index: 0 }); // no caret yet
  });

  it("does nothing when there are no visible candidates", () => {
    expect(stepDescriptionCandidate([], null, 0, 1)).toBeNull();
  });

  it("a single candidate steps onto itself", () => {
    const one = [{ start: 4, end: 8 }];
    expect(stepDescriptionCandidate(one, one[0], 5, 1)?.mark).toBe(one[0]);
    expect(stepDescriptionCandidate(one, one[0], 5, -1)?.mark).toBe(one[0]);
  });

  it("formats the position as n / total, and – while no candidate is current", () => {
    expect(formatCandidatePosition(marks, marks[1])).toBe("2 / 3");
    expect(formatCandidatePosition(marks, null)).toBe("– / 3");
    expect(formatCandidatePosition([], null)).toBe("– / 0");
  });
});

describe("B5 category-tinted painting: one tint per category, overlaps resolved A > B > C", () => {
  it("colours each run by its category and leaves other text unmarked", () => {
    const segments = buildCategorySegments("0123456789", [
      { start: 1, end: 3, category: "B" },
      { start: 6, end: 8, category: "C" },
    ]);
    expect(segments).toEqual([
      { text: "0", category: undefined },
      { text: "12", category: "B" },
      { text: "345", category: undefined },
      { text: "67", category: "C" },
      { text: "89", category: undefined },
    ]);
    expect(segments.map((s) => s.text).join("")).toBe("0123456789");
  });

  it("where categories overlap the more specific one paints (A over B over C), and neighbouring same-category runs merge", () => {
    const segments = buildCategorySegments("abcdefgh", [
      { start: 0, end: 6, category: "C" },
      { start: 1, end: 5, category: "B" },
      { start: 2, end: 4, category: "A" },
    ]);
    expect(segments).toEqual([
      { text: "a", category: "C" },
      { text: "b", category: "B" },
      { text: "cd", category: "A" },
      { text: "e", category: "B" },
      { text: "f", category: "C" },
      { text: "gh", category: undefined },
    ]);
  });

  it("clips to the text, and handles empty input", () => {
    expect(buildCategorySegments("abc", [{ start: -5, end: 99, category: "A" }])).toEqual([{ text: "abc", category: "A" }]);
    expect(buildCategorySegments("", [{ start: 0, end: 3, category: "A" }])).toEqual([]);
    expect(buildCategorySegments("abc", [])).toEqual([{ text: "abc" }]);
  });
});
