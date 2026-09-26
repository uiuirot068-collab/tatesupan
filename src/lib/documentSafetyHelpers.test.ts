import { describe, expect, it } from "vitest";
import { lockUserSelect } from "./bodyUserSelect";
import { openedCloudProjectImageState } from "./cloudImageSync";
import { pruneSelectedPages } from "./pageOrder";

/** Phase 6.1 pure helpers: selection pruning, userSelect lock, cloud-project image state. */

describe("pruneSelectedPages: selected ∩ existing pages", () => {
  it("10 pages with {2,8,10} selected → manuscript shrinks to 6 pages → {2}", () => {
    // 1-based page numbers 2, 8, 10 are body indices 1, 7, 9.
    expect([...pruneSelectedPages(new Set([1, 7, 9]), 6)]).toEqual([1]);
  });

  it("keeps the same set when every selection still exists (no state update, no loop)", () => {
    const selected = new Set([0, 3, 5]);
    expect(pruneSelectedPages(selected, 6)).toBe(selected);
    const empty = new Set<number>();
    expect(pruneSelectedPages(empty, 0)).toBe(empty);
  });

  it("removes only invalid indices and never mutates the input", () => {
    const selected = new Set([5, 0, 6, -1]);
    const pruned = pruneSelectedPages(selected, 6);
    expect([...pruned].sort((a, b) => a - b)).toEqual([0, 5]);
    expect([...selected]).toEqual([5, 0, 6, -1]);
  });

  it("a manuscript with no pages clears the selection", () => {
    expect(pruneSelectedPages(new Set([0, 1]), 0).size).toBe(0);
  });
});

describe("lockUserSelect: restores the value it replaced", () => {
  it("locks, then restores the previous value (including a non-empty one)", () => {
    const style = { userSelect: "text" };
    const release = lockUserSelect(style);
    expect(style.userSelect).toBe("none");
    release();
    expect(style.userSelect).toBe("text");
  });

  it("release is idempotent: mouseup and the unmount cleanup may both run", () => {
    const style = { userSelect: "" };
    const release = lockUserSelect(style);
    release();
    style.userSelect = "auto"; // changed by someone else afterwards
    release();
    expect(style.userSelect).toBe("auto");
  });

  it("an unmount mid-drag (no mouseup) is repaired by the cleanup's release", () => {
    const style = { userSelect: "" };
    const releaseOnCleanup = lockUserSelect(style);
    // ...component unmounts before mouseup...
    releaseOnCleanup();
    expect(style.userSelect).toBe("");
  });
});

describe("openedCloudProjectImageState: one project's images, nothing else", () => {
  const img = (id: string) => `【IMG:${id}:10:10:0:0】`;
  const nothingBroken = { missing: [], unmanifested: [] };
  const localRecords = [
    { id: "a1", dataUrl: "data:a1", layerOrder: 2 },
    { id: "a2", dataUrl: "data:a2" },
    { id: "b1", dataUrl: "data:b1-local", layerOrder: 5 },
  ];

  it("A has images, B has none: B gets no images and no layer order", () => {
    const b = openedCloudProjectImageState("本文だけ", { images: {}, ...nothingBroken }, localRecords);
    expect(b).toEqual({ images: {}, imageLayerOrder: {}, unresolved: null, baselineIds: new Set() });
  });

  it("A has none, B has images: B's cloud images and its persisted layer order", () => {
    const b = openedCloudProjectImageState(`x${img("b1")}`, { images: { b1: "data:b1-cloud" }, ...nothingBroken }, localRecords);
    expect(b.images).toEqual({ b1: "data:b1-cloud" });
    expect(b.imageLayerOrder).toEqual({ b1: 5 });
    expect(b.unresolved).toBeNull();
  });

  it("different ids: no image or layer order of another document leaks in", () => {
    const b = openedCloudProjectImageState(img("b1"), { images: { b1: "data:b1-cloud" }, ...nothingBroken }, localRecords);
    expect(Object.keys(b.images)).toEqual(["b1"]);
    expect(Object.keys(b.imageLayerOrder)).toEqual(["b1"]);
  });

  it("expired cloud copy falls back to the local original; otherwise it is a silent baseline break", () => {
    const a = openedCloudProjectImageState(
      `${img("a1")}${img("gone")}`,
      { images: {}, missing: ["a1", "gone"], unmanifested: [] },
      localRecords
    );
    expect(a.images).toEqual({ a1: "data:a1" });
    expect(a.unresolved).toEqual({ missing: ["gone"], unmanifested: [] });
    expect([...a.baselineIds]).toEqual(["gone"]);
  });

  it("switch A → B → A yields exactly each project's own state every time", () => {
    const openA = () => openedCloudProjectImageState(`${img("a1")}${img("a2")}`, { images: { a1: "data:a1", a2: "data:a2" }, ...nothingBroken }, localRecords);
    const openB = () => openedCloudProjectImageState(img("b1"), { images: { b1: "data:b1-cloud" }, ...nothingBroken }, localRecords);
    const first = openA();
    const b = openB();
    const again = openA();
    expect(again).toEqual(first);
    expect(Object.keys(b.images)).toEqual(["b1"]);
    expect(Object.keys(again.images).sort()).toEqual(["a1", "a2"]);
    expect(again.imageLayerOrder).toEqual({ a1: 2 });
  });
});
