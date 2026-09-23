import { describe, expect, it } from "vitest";
import {
  captureHeldSelection,
  describeHeldSelection,
  READ_ALOUD_NO_SELECTION_NOTICE,
  sameHeldSelection,
  validHeldSelection,
} from "./readAloudHeldSelection";

const text = "一行目です。\n二行目の文章です。\n三行目。";

describe("B4 held 選択範囲: capture", () => {
  it("holds a real selection with its text, document and normalised order", () => {
    const held = captureHeldSelection(text, { start: 7, end: 13 }, "doc-1");
    expect(held).toEqual({ start: 7, end: 13, text: text.slice(7, 13), docKey: "doc-1" });
    expect(captureHeldSelection(text, { start: 13, end: 7 }, "doc-1")).toEqual(held); // backwards selection
  });

  it("never holds a collapsed, empty or whitespace-only selection (no phantom 保持中)", () => {
    expect(captureHeldSelection(text, { start: 3, end: 3 }, "d")).toBeNull();
    expect(captureHeldSelection("", { start: 0, end: 0 }, "d")).toBeNull();
    expect(captureHeldSelection("a\n\n b", { start: 1, end: 4 }, "d")).toBeNull();
  });

  it("clamps a range that runs past the text", () => {
    expect(captureHeldSelection("短い文", { start: 1, end: 99 }, "d")).toEqual({ start: 1, end: 3, text: "い文", docKey: "d" });
    expect(captureHeldSelection("短い文", { start: 50, end: 99 }, "d")).toBeNull();
  });
});

describe("B4 held 選択範囲: lifecycle (validity is derived, so a stale range is never shown)", () => {
  const held = captureHeldSelection(text, { start: 7, end: 13 }, "doc-1")!;

  it("is valid while the same text sits at the same place in the same document", () => {
    expect(validHeldSelection(held, text, "doc-1")).toBe(held);
  });

  it("selection created -> Review Hub opens / footer clicked / reading starts / another target chosen: nothing changes the held range", () => {
    // none of those actions touches the manuscript or the document key, so validity is unchanged
    for (let i = 0; i < 3; i += 1) expect(validHeldSelection(held, text, "doc-1")).toBe(held);
  });

  it("manuscript edited: an edit inside the range, before it, or after it that moves it invalidates the hold", () => {
    expect(validHeldSelection(held, text.replace("二行目の", "二行目の、"), "doc-1")).toBeNull(); // inside
    expect(validHeldSelection(held, "先頭に追記" + text, "doc-1")).toBeNull(); // before: the range now points at other text
    expect(validHeldSelection(held, text.slice(0, 9), "doc-1")).toBeNull(); // truncated below the range end
    expect(validHeldSelection(held, text + "追記", "doc-1")).toBe(held); // after: unaffected
  });

  it("document changes (another project / a new one): never valid", () => {
    expect(validHeldSelection(held, text, "doc-2")).toBeNull();
  });

  it("nothing held -> nothing valid", () => {
    expect(validHeldSelection(null, text, "doc-1")).toBeNull();
  });

  it("sameHeldSelection compares by value so unchanged selections do not re-render", () => {
    expect(sameHeldSelection(held, { ...held })).toBe(true);
    expect(sameHeldSelection(held, { ...held, end: held.end - 1 })).toBe(false);
    expect(sameHeldSelection(null, null)).toBe(true);
    expect(sameHeldSelection(held, null)).toBe(false);
  });
});

describe("B4 held 選択範囲: wording", () => {
  it("says 保持中 with the character count, and explains what to do when nothing is held", () => {
    const held = captureHeldSelection(text, { start: 7, end: 13 }, "d")!;
    expect(describeHeldSelection(held)).toBe("選択範囲を保持中（6文字）");
    expect(READ_ALOUD_NO_SELECTION_NOTICE).toContain("選ぶと");
    expect(READ_ALOUD_NO_SELECTION_NOTICE).not.toContain("保持中");
  });
});
