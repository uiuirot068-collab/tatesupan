import { describe, expect, it } from "vitest";
import { findMatchOffsets, stepMatchIndex } from "./SearchReplaceModal";

// Phase 9: 置換 dialog 前へ / 次へ searches the whole canonical manuscript
// (the windowed editor mounts one 編集ページ, so browser find cannot).

describe("置換 dialog find", () => {
  it("finds every non-overlapping occurrence — the same matches 置換 counts and replaces", () => {
    const content = "瑠璃色の空、瑠璃色の海。ああああ";
    expect(findMatchOffsets(content, "瑠璃色")).toEqual([0, 6]);
    expect(findMatchOffsets(content, "瑠璃色").length).toBe(content.split("瑠璃色").length - 1);
    expect(findMatchOffsets(content, "ああ")).toEqual([12, 14]);
    expect(findMatchOffsets(content, "")).toEqual([]);
    expect(findMatchOffsets(content, "無い")).toEqual([]);
  });

  it("offsets are canonical UTF-16 offsets, also after astral characters", () => {
    const content = "𠮷野家の𠮷";
    expect(findMatchOffsets(content, "𠮷")).toEqual([0, 5]);
  });

  it("前へ / 次へ wrap around and start at the first / last match", () => {
    expect(stepMatchIndex(-1, 3, 1)).toBe(0);
    expect(stepMatchIndex(-1, 3, -1)).toBe(2);
    expect(stepMatchIndex(2, 3, 1)).toBe(0);
    expect(stepMatchIndex(0, 3, -1)).toBe(2);
    expect(stepMatchIndex(0, 0, 1)).toBe(-1);
  });
});
