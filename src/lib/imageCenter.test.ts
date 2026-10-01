import { describe, expect, it } from "vitest";
import {
  buildImageCenterInventory,
  imageCenterStatus,
  imageOriginalDeletable,
  removeImageMarkers,
  summarizeImageCenter,
  type ImageCenterInventoryInput,
} from "./imageCenter";
import { imageMarkerSpans, tokenizeTategaki, tokenizeTategakiWithOffsets } from "./tategaki";
import { technicallyUnresolvedImages, withoutUnresolvedImageIds } from "./cloudImageSync";
import { reconcileImageWarnings, EMPTY_IMAGE_WARNING_STATE, imageWarningStatus } from "./imageWarningLifecycle";

// Phase 12 画像管理センター — pure model.

const marker = (id: string, position = "center", w = 40, h = 30) => `【IMG:${id}:${w}:${h}:${position}】`;
const DATA = "data:image/png;base64,AAAA";

function input(extra: Partial<ImageCenterInventoryInput>): ImageCenterInventoryInput {
  return {
    content: "",
    images: {},
    unresolved: null,
    localOriginalIds: null,
    pageIndicesById: new Map(),
    imageLayerOrder: {},
    pendingWarnings: {},
    ...extra,
  };
}

describe("imageMarkerSpans matches the tokenizer exactly", () => {
  it("same ids, spans and metadata as tokenizeTategakiWithOffsets' image tokens", () => {
    const content = `前文｜東京《とうきょう》\n${marker("a", "top")}\n【改ページ】\n本文${marker("b", "full", 10, 20)}後文\n${marker("a")}`;
    const fromTokenizer = tokenizeTategakiWithOffsets(content)
      .filter((entry) => entry.token.type === "image")
      .map((entry) => {
        const token = entry.token as Extract<typeof entry.token, { type: "image" }>;
        return { id: token.id, start: entry.start, end: entry.end, widthMm: token.widthMm, heightMm: token.heightMm, position: token.position };
      });
    expect(imageMarkerSpans(content)).toEqual(fromTokenizer);
  });

  it("a legacy marker without position defaults to center", () => {
    expect(imageMarkerSpans("【IMG:old:12:34】")[0]).toMatchObject({ id: "old", position: "center", widthMm: 12, heightMm: 34 });
  });
});

describe("buildImageCenterInventory", () => {
  it("0 images: empty", () => {
    expect(buildImageCenterInventory(input({ content: "本文のみ" }))).toEqual([]);
    expect(summarizeImageCenter([])).toEqual({ total: 0, ok: 0, broken: 0, repairable: 0 });
  });

  it("1 image, valid: 正常, thumbnail, pages, layer order", () => {
    const [entry] = buildImageCenterInventory(
      input({
        content: `本文${marker("a", "top")}`,
        images: { a: DATA },
        localOriginalIds: new Set(["a"]),
        pageIndicesById: new Map([["a", [2]]]),
        imageLayerOrder: { a: 3 },
      })
    );
    expect(entry).toMatchObject({ id: "a", order: 1, markerCount: 1, pageIndices: [2], position: "top", thumbnail: DATA, status: "ok", localOriginal: true, repairable: false, layerOrder: 3, warningPending: false });
  });

  it("many images in manuscript order; one id placed on several pages is ONE entry with every page", () => {
    const content = `${marker("b")}\n${marker("a")}\n【改ページ】\n${marker("b")}`;
    const entries = buildImageCenterInventory(input({ content, images: { a: DATA, b: DATA }, pageIndicesById: new Map([["b", [3, 0]], ["a", [0]]]) }));
    expect(entries.map((e) => [e.id, e.order, e.markerCount, e.pageIndices])).toEqual([
      ["b", 1, 2, [0, 3]],
      ["a", 2, 1, [0]],
    ]);
  });

  it("statuses: cloud valid (loaded) / cloud expired / missing; local original decides 修復可能", () => {
    const content = [marker("valid"), marker("expired"), marker("expiredNoOrig"), marker("gone")].join("\n");
    const unresolved = { missing: ["expired", "expiredNoOrig"], unmanifested: ["gone"] };
    const entries = buildImageCenterInventory(
      input({ content, images: { valid: DATA }, unresolved, localOriginalIds: new Set(["valid", "expired"]) })
    );
    const byId = Object.fromEntries(entries.map((e) => [e.id, e]));
    expect(byId.valid).toMatchObject({ status: "ok", repairable: false, localOriginal: true });
    expect(byId.expired).toMatchObject({ status: "cloud-expired", repairable: true, localOriginal: true, thumbnail: null });
    expect(byId.expiredNoOrig).toMatchObject({ status: "cloud-expired", repairable: false, localOriginal: false });
    expect(byId.gone).toMatchObject({ status: "missing", repairable: false, localOriginal: false });
    expect(summarizeImageCenter(entries)).toEqual({ total: 4, ok: 1, broken: 3, repairable: 1 });
  });

  it("IndexedDB presence not yet checked: unknown, never claimed repairable", () => {
    const [entry] = buildImageCenterInventory(input({ content: marker("x"), unresolved: { missing: ["x"], unmanifested: [] } }));
    expect(entry).toMatchObject({ localOriginal: null, repairable: false });
  });

  it("the TTL is cloud-only: an expired cloud copy whose original is loaded locally is 正常 (same rule as the export block)", () => {
    const unresolved = { missing: ["a"], unmanifested: [] };
    expect(imageCenterStatus("a", { a: DATA }, unresolved)).toBe("ok");
    expect(technicallyUnresolvedImages(unresolved, { a: DATA })).toBeNull();
  });

  it("warning lifecycle is read, not copied: pending warnings surface on the entry", () => {
    const content = marker("a");
    const reconciled = reconcileImageWarnings(EMPTY_IMAGE_WARNING_STATE, { unresolvedIds: new Set(["a"]), pageIndicesById: new Map([["a", [1]]]) });
    const [entry] = buildImageCenterInventory(input({ content, pendingWarnings: reconciled.state.pending, pageIndicesById: new Map([["a", [1]]]) }));
    expect(entry.warningPending).toBe(true);
    // After 再同期 (image loaded again), the footer and the center agree: repaired → 通知解除 available.
    expect(imageWarningStatus({ technicallyUnresolved: false, locallyAvailable: true, markerExists: true })).toBe("repaired");
    const [repaired] = buildImageCenterInventory(input({ content, images: { a: DATA }, pendingWarnings: reconciled.state.pending }));
    expect(repaired).toMatchObject({ status: "ok", warningPending: true });
  });

  it("provisional page list (before the first V2 layout): no pages listed", () => {
    const [entry] = buildImageCenterInventory(input({ content: marker("a"), images: { a: DATA } }));
    expect(entry.pageIndices).toEqual([]);
  });

  it("resync clears exactly the restored ids from the technical state", () => {
    const state = { missing: ["a", "b"], unmanifested: ["c"] };
    expect(withoutUnresolvedImageIds(state, new Set(["a"]))).toEqual({ missing: ["b"], unmanifested: ["c"] });
    expect(withoutUnresolvedImageIds({ missing: ["a"], unmanifested: [] }, new Set(["a"]))).toBeNull();
  });
});

describe("removeImageMarkers — marker-range splices only", () => {
  it("removes every marker of the id and nothing else (newlines, ruby, 改ページ, TOC heading untouched)", () => {
    const content = `# 第一章\n｜東京《とうきょう》に${marker("a")}行く。\n【改ページ】\n${marker("b")}\n本文${marker("a", "bottom")}`;
    const next = removeImageMarkers(content, "a");
    expect(next).toBe(`# 第一章\n｜東京《とうきょう》に行く。\n【改ページ】\n${marker("b")}\n本文`);
    // Everything else reads identically (text, ruby, page breaks, other images).
    const reading = (text: string) =>
      tokenizeTategaki(text)
        .map((token) =>
          token.type === "image" ? (token.id === "a" ? "" : `[${token.id}]`) : token.type === "ruby" ? `${token.base}(${token.rt})` : token.type === "pageBreak" ? "<BR>" : token.value
        )
        .join("");
    expect(reading(next)).toBe(reading(content));
    expect(tokenizeTategaki(next).filter((token) => token.type === "ruby")).toEqual(tokenizeTategaki(content).filter((token) => token.type === "ruby"));
  });

  it("unknown id: the same string (no rewrite)", () => {
    const content = `本文${marker("a")}`;
    expect(removeImageMarkers(content, "zzz")).toBe(content);
  });

  it("does not touch another image whose id merely contains this id", () => {
    const content = `${marker("a")}${marker("a2")}`;
    expect(removeImageMarkers(content, "a")).toBe(marker("a2"));
  });
});

describe("imageOriginalDeletable — never breaks another work", () => {
  it("deletable when no other work references the id", () => {
    expect(imageOriginalDeletable("a", ["本文", marker("b")])).toBe(true);
  });

  it("kept when another work still places it", () => {
    expect(imageOriginalDeletable("a", ["本文", `別作品${marker("a")}`])).toBe(false);
  });

  it("an id that only appears as text (not a marker) does not block", () => {
    expect(imageOriginalDeletable("a", ["aaa IMG a"])).toBe(true);
  });
});

describe("large manuscript", () => {
  it("inventory of a 30万字 manuscript with 200 images stays cheap", () => {
    const paragraph = "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。";
    const chunks: string[] = [];
    for (let i = 0; i < 9000; i += 1) chunks.push(i % 45 === 0 ? `${paragraph}${marker(`img${i / 45}`)}` : paragraph);
    const content = chunks.join("\n");
    expect(content.length).toBeGreaterThan(300_000);
    const started = performance.now();
    const entries = buildImageCenterInventory(input({ content }));
    const removed = removeImageMarkers(content, "img7");
    const elapsed = performance.now() - started;
    expect(entries).toHaveLength(200);
    expect(removed.length).toBe(content.length - marker("img7").length);
    expect(elapsed).toBeLessThan(2000);
  });
});
