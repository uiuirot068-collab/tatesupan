import { afterEach, describe, expect, it, vi } from "vitest";
import { referencedImageSignature } from "./cloudImageSync";
import { db, loadImagesByIds, type ImageRecord } from "./db";
import { imageIdsToTopUp, imageStateFromRecords } from "./documentImages";
import { imageMarkerIds, tokenizeTategaki } from "./tategaki";

/**
 * Phase 7 performance contracts, as call counts / identities (never timings).
 * Browser measurements: docs/TATESPUN_LONG_MANUSCRIPT_PERFORMANCE.md.
 */

/** How many times an effect keyed on `key(content)` would run over a typing sequence. */
function effectRuns(contents: string[], key: (content: string) => string): number {
  let runs = 0;
  let previous: string | undefined;
  for (const content of contents) {
    const next = key(content);
    if (next !== previous) runs += 1;
    previous = next;
  }
  return runs;
}

describe("manifest check trigger: the referenced image set, not the text", () => {
  const base = "春の宵【IMG:a:40:30:center】窓辺";
  const typing = Array.from({ length: 50 }, (_, i) => base + "あ".repeat(i));

  it("50 ordinary keystrokes with unchanged image references → the check runs once (at open), not 50 times", () => {
    expect(effectRuns(typing, referencedImageSignature)).toBe(1);
    expect(effectRuns(typing, (content) => content)).toBe(50); // the pre-Phase-7 dependency
  });

  it("adding or removing a marker triggers a check; same ids in changed surrounding text do not", () => {
    const withB = base + "【IMG:b:10:10】";
    expect(referencedImageSignature(withB)).not.toBe(referencedImageSignature(base));
    expect(referencedImageSignature("前置き" + base + "後書き")).toBe(referencedImageSignature(base));
    expect(effectRuns([base, base + "x", withB, withB + "y", base], referencedImageSignature)).toBe(3);
  });

  it("is order- and duplicate-insensitive and empty without images", () => {
    expect(referencedImageSignature("【IMG:b:1:1】【IMG:a:1:1】【IMG:b:1:1】")).toBe(referencedImageSignature("【IMG:a:1:1】【IMG:b:1:1】"));
    expect(referencedImageSignature("本文のみ")).toBe("");
  });
});

describe("imageMarkerIds matches the tokenizer's image tokens", () => {
  it("returns exactly the ids tokenizeTategaki produces, in order", () => {
    const source = "｜漢字《かんじ》【IMG:a1:40:30:center】本文\n【改ページ】\n【IMG:b-2:10.5:8】《《傍点》》【IMG:a1:40:30:top】【IMG:bad】";
    const fromTokens = tokenizeTategaki(source).flatMap((token) => (token.type === "image" ? [token.id] : []));
    expect(imageMarkerIds(source)).toEqual(fromTokens);
    expect(fromTokens).toEqual(["a1", "b-2", "a1"]);
  });
});

describe("document-scoped image loading", () => {
  afterEach(() => vi.restoreAllMocks());

  it("database has 100 images, document A references 2 → only those 2 ids are read", async () => {
    const stored = new Map<string, ImageRecord>();
    for (let i = 0; i < 100; i++) stored.set(`img${i}`, { id: `img${i}`, dataUrl: `data:${i}`, createdAt: i, layerOrder: i % 3 === 0 ? i : undefined });
    const bulkGet = vi.spyOn(db.images, "bulkGet").mockImplementation((async (keys: string[]) => keys.map((key) => stored.get(key))) as never);
    const toArray = vi.spyOn(db.images, "toArray");
    const contentA = "本文【IMG:img3:40:30:center】本文【IMG:img7:40:30】【IMG:img3:40:30:top】";
    const records = await loadImagesByIds(imageMarkerIds(contentA));
    expect(bulkGet).toHaveBeenCalledTimes(1);
    expect(bulkGet.mock.calls[0][0]).toEqual(["img3", "img7"]);
    expect(toArray).not.toHaveBeenCalled();
    expect(imageStateFromRecords(records)).toEqual({ images: { img3: "data:3", img7: "data:7" }, imageLayerOrder: { img3: 3 } });
  });

  it("no referenced ids → no database read; unknown ids are simply absent", async () => {
    const bulkGet = vi.spyOn(db.images, "bulkGet").mockImplementation((async (keys: string[]) => keys.map(() => undefined)) as never);
    expect(await loadImagesByIds([])).toEqual([]);
    expect(bulkGet).not.toHaveBeenCalled();
    expect(await loadImagesByIds(["gone"])).toEqual([]);
  });

  it("top-up asks only for referenced ids missing from the pool and not yet attempted", () => {
    expect(imageIdsToTopUp(["a", "b", "c", ""], { a: "data:a" }, new Set(["c"]))).toEqual(["b"]);
    expect(imageIdsToTopUp(["constructor"], {}, new Set())).toEqual(["constructor"]);
    expect(imageIdsToTopUp([], {}, new Set())).toEqual([]);
  });
});
