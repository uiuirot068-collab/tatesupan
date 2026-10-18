import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createDocument,
  createDocumentCopy,
  db,
  deleteDocument,
  listDocuments,
  listTrash,
  loadDocument,
  purgeExpiredTrash,
  purgeFromTrash,
  removeOrphanImages,
  restoreFromTrash,
  revisionOf,
  saveDocument,
  saveDocumentIfUnchanged,
  saveImage,
} from "./db";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "./pageLayout";
import { LocalSaveQueue } from "./localSaveQueue";
import { ORPHAN_IMAGE_MIN_AGE_MS, TRASH_KEEP_DAYS, trashDaysLeft, unreferencedImageIds } from "./trash";

/**
 * TSP-SAFE-004 (TSP-REVIEW-001 3の8・3の9): the ゴミ箱 and tidying images,
 * against the real IndexedDB code (lib/db.ts, in fake-indexeddb).
 */

const settings: PageSettings = DEFAULT_PAGE_SETTINGS;
const DAY = 24 * 60 * 60 * 1000;
const img = (id: string) => `【IMG:${id}:50:30:top】`;
const OLD = Date.now() - ORPHAN_IMAGE_MIN_AGE_MS - DAY;

// localStorage stand-in (this suite runs without a DOM).
const local = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => void local.set(key, value),
    removeItem: (key: string) => void local.delete(key),
  },
};

beforeEach(async () => {
  local.clear();
  await db.documents.clear();
  await db.bookshelfMetadata.clear();
  await db.images.clear();
  await db.trash.clear();
});

describe("ゴミ箱", () => {
  it("削除 moves the work to the trash, whole; 元に戻す brings back the same work", async () => {
    const id = await createDocument();
    await saveDocument(id, "長編", `はじめ${img("a1")}`, settings, "メモ");
    await deleteDocument(id);

    expect(await loadDocument(id)).toBeUndefined();
    expect(await listDocuments()).toHaveLength(0);
    const trash = await listTrash();
    expect(trash.map((item) => item.document.title)).toEqual(["長編"]);

    expect(await restoreFromTrash(id)).toBe(id);
    const back = await loadDocument(id);
    expect(back?.content).toBe(`はじめ${img("a1")}`);
    expect(back?.plotNote).toBe("メモ");
    expect(await db.bookshelfMetadata.get(id)).toBeDefined();
    expect(await listTrash()).toHaveLength(0);
  });

  it("a tab still open on the deleted work does not overwrite the restored one", async () => {
    const id = await createDocument();
    await saveDocument(id, "長編", "はじめ", settings, "");
    const doc = await loadDocument(id);
    const tab = new LocalSaveQueue<PageSettings>(
      { write: (job, expected) => saveDocumentIfUnchanged(job, expected), createCopy: (job, title) => createDocumentCopy(job, title) },
      { setTimer: () => null, clearTimer: () => undefined }
    );
    tab.setBase(id, revisionOf(doc));
    await deleteDocument(id);
    await restoreFromTrash(id);
    await tab.submit({ docId: id, title: "長編", content: "はじめ＋古い画面", settings, plotNote: "" });

    expect((await loadDocument(id))?.content).toBe("はじめ");
    const all = await listDocuments();
    expect(all.some((d) => d.content === "はじめ＋古い画面")).toBe(true);
  });

  it("removed for good after the keep period, with the images only it used", async () => {
    const keep = await createDocument();
    await saveDocument(keep, "残す", img("shared"), settings, "");
    const gone = await createDocument();
    await saveDocument(gone, "消す", `${img("shared")}${img("only")}`, settings, "");
    await saveImage({ id: "shared", dataUrl: "data:x", createdAt: Date.now() });
    await saveImage({ id: "only", dataUrl: "data:y", createdAt: Date.now() });

    const now = Date.now();
    await deleteDocument(gone, now - (TRASH_KEEP_DAYS + 1) * DAY);
    expect(await purgeExpiredTrash(now)).toBe(1);

    expect(await listTrash()).toHaveLength(0);
    expect(await db.images.get("only")).toBeUndefined();
    expect(await db.images.get("shared")).toBeDefined();
  });

  it("a work trashed recently stays", async () => {
    const id = await createDocument();
    await saveDocument(id, "消す", "本文", settings, "");
    await deleteDocument(id, Date.now() - 2 * DAY);
    expect(await purgeExpiredTrash()).toBe(0);
    expect(await listTrash()).toHaveLength(1);
  });

  it("完全に削除 keeps images another work (or another trashed work) still uses", async () => {
    const a = await createDocument();
    await saveDocument(a, "A", img("both"), settings, "");
    const b = await createDocument();
    await saveDocument(b, "B", img("both"), settings, "");
    await saveImage({ id: "both", dataUrl: "data:x", createdAt: OLD });
    await deleteDocument(a);
    await deleteDocument(b);
    await purgeFromTrash(a);
    expect(await db.images.get("both")).toBeDefined();
    await purgeFromTrash(b);
    expect(await db.images.get("both")).toBeUndefined();
  });

  it("QA: 完全に削除 of a work saved to the cloud keeps its images, also from the daily tidy", async () => {
    const id = await createDocument();
    await saveDocument(id, "クラウド", img("cloudimg"), settings, "");
    await db.documents.update(id, { cloudSync: { projectId: "p1", updatedAt: "2026-10-18T00:00:00Z", hash: "h" } });
    await saveImage({ id: "cloudimg", dataUrl: "data:x", createdAt: OLD });
    await deleteDocument(id);
    await purgeFromTrash(id);
    expect(await listTrash()).toHaveLength(0);
    expect(await db.images.get("cloudimg")).toBeDefined();
    expect(await removeOrphanImages()).toBe(0);
    expect(await db.images.get("cloudimg")).toBeDefined();
  });

  it("the 使い方ガイド sample is never moved to the trash", async () => {
    await db.documents.put({ id: 999, title: "見本", content: "", settings, updatedAt: 0, isSample: true });
    await deleteDocument(999);
    expect(await db.documents.get(999)).toBeDefined();
    expect(await listTrash()).toHaveLength(0);
  });
});

describe("images no work uses", () => {
  it("old images no work mentions are removed; used, cover and fresh ones stay", async () => {
    const id = await createDocument();
    await saveDocument(id, "本", img("in-text"), { ...settings, cover: { ...settings.cover, front: { ...settings.cover?.front, assetId: "on-cover" } } } as PageSettings, "");
    const trashed = await createDocument();
    await saveDocument(trashed, "ゴミ箱", img("in-trash"), settings, "");
    await deleteDocument(trashed);
    for (const imageId of ["in-text", "on-cover", "in-trash", "orphan"]) {
      await saveImage({ id: imageId, dataUrl: "data:x", createdAt: OLD });
    }
    await saveImage({ id: "just-added", dataUrl: "data:x", createdAt: Date.now() });

    expect(await removeOrphanImages()).toBe(1);
    const left = (await db.images.toCollection().primaryKeys()).map(String).sort();
    expect(left).toEqual(["in-text", "in-trash", "just-added", "on-cover"]);
  });
});

describe("trash rules", () => {
  it("days left count down to 0", () => {
    const t = 1_000_000;
    expect(trashDaysLeft(t, t)).toBe(TRASH_KEEP_DAYS);
    expect(trashDaysLeft(t, t + (TRASH_KEEP_DAYS - 0.5) * DAY)).toBe(1);
    expect(trashDaysLeft(t, t + (TRASH_KEEP_DAYS + 3) * DAY)).toBe(0);
  });

  it("an image is unused only if no work mentions it anywhere", () => {
    const [a, b, c] = ["3f1c0a52-aaaa", "3f1c0a52-bbbb", "3f1c0a52-cccc"];
    expect(unreferencedImageIds([a, b, c], [{ content: img(a) }, { settings: { cover: { front: { assetId: b } } } }])).toEqual([c]);
    // a text search errs on the side of keeping: a short id found inside other words stays
    expect(unreferencedImageIds(["con"], [{ content: "本文" }])).toEqual([]);
  });
});
