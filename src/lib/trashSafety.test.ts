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
  openCloudDeviceCopy,
  purgeExpiredTrash,
  purgeFromTrash,
  restoreFromTrash,
  revisionOf,
  saveDocument,
  saveDocumentIfUnchanged,
  saveImage,
} from "./db";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "./pageLayout";
import { LocalSaveQueue } from "./localSaveQueue";
import { releaseCloudWorkImages, TRASH_KEEP_DAYS, trashDaysLeft, unreferencedImageIds } from "./trash";

/**
 * TSP-SAFE-004 (TSP-REVIEW-001 3の8・3の9): the ゴミ箱 and tidying images,
 * against the real IndexedDB code (lib/db.ts, in fake-indexeddb).
 */

const settings: PageSettings = DEFAULT_PAGE_SETTINGS;
const DAY = 24 * 60 * 60 * 1000;
const img = (id: string) => `【IMG:${id}:50:30:top】`;
const OLD = Date.now() - 10 * DAY;

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

  it("QA: 完全に削除 of a work saved to the cloud keeps its images", async () => {
    const id = await createDocument();
    await saveDocument(id, "クラウド", img("cloudimg"), settings, "");
    await db.documents.update(id, { cloudSync: { projectId: "p1", updatedAt: "2026-10-18T00:00:00Z", hash: "h" } });
    await saveImage({ id: "cloudimg", dataUrl: "data:x", createdAt: OLD });
    await deleteDocument(id);
    await purgeFromTrash(id);
    expect(await listTrash()).toHaveLength(0);
    expect(await db.images.get("cloudimg")).toBeDefined();
    // QA2: once that cloud work is deleted, another work's purge may take the image.
    const other = await createDocument();
    await saveDocument(other, "同じ挿絵", img("cloudimg"), settings, "");
    await deleteDocument(other);
    await purgeFromTrash(other);
    expect(await db.images.get("cloudimg")).toBeDefined();
    releaseCloudWorkImages("p1");
    const again = await createDocument();
    await saveDocument(again, "同じ挿絵", img("cloudimg"), settings, "");
    await deleteDocument(again);
    await purgeFromTrash(again);
    expect(await db.images.get("cloudimg")).toBeUndefined();
  });

  it("the 使い方ガイド sample is never moved to the trash", async () => {
    await db.documents.put({ id: 999, title: "見本", content: "", settings, updatedAt: 0, isSample: true });
    await deleteDocument(999);
    expect(await db.documents.get(999)).toBeDefined();
    expect(await listTrash()).toHaveLength(0);
  });
});

describe("PC QA: one cloud work never gets two device copies", () => {
  const project = { id: "cloud-1", title: "クラウド作品", content: "本文", settings, updated_at: "2026-10-18T00:00:00.000Z" };
  const rescue = (title: string) => `${title}（控え）`;

  it("opening the cloud work again brings its trashed copy back instead of making a new one", async () => {
    const first = await openCloudDeviceCopy(project, rescue);
    await deleteDocument(first.docId);
    const again = await openCloudDeviceCopy(project, rescue);
    expect(again.docId).toBe(first.docId);
    expect(await listTrash()).toHaveLength(0);
    expect(await listDocuments()).toHaveLength(1);
  });

  it("restoring an old copy while another copy stands for the cloud work brings it back unlinked", async () => {
    const first = await openCloudDeviceCopy(project, rescue);
    await deleteDocument(first.docId);
    // made outside this flow (e.g. before the update): a second copy
    const second = await createDocument();
    await saveDocument(second, "クラウド作品", "本文", settings, "");
    await db.documents.update(second, { cloudSync: { projectId: "cloud-1", updatedAt: null, hash: "h" } });

    const restored = await restoreFromTrash(first.docId);
    const docs = await listDocuments();
    expect(docs.filter((d) => d.cloudSync?.projectId === "cloud-1").map((d) => d.id)).toEqual([second]);
    expect(docs.find((d) => d.id === restored)?.cloudSync).toBeUndefined();
  });

  it("a restored work whose id was taken gets an id free on the bookshelf and in the trash", async () => {
    const a = await createDocument();
    await saveDocument(a, "A", "a", settings, "");
    await deleteDocument(a);
    await db.documents.put({ id: a, title: "別", content: "", settings, updatedAt: 0 });
    const restored = await restoreFromTrash(a);
    expect(restored).not.toBe(a);
    expect(await db.trash.get(restored!)).toBeUndefined();
  });
});

describe("images no work uses", () => {
  it("PC QA: images no work mentions are NOT swept (a cut image or a cloud work's image may come back)", async () => {
    const id = await createDocument();
    await saveDocument(id, "本", "挿絵は切り取った", settings, "");
    await saveImage({ id: "cut", dataUrl: "data:x", createdAt: OLD });
    await purgeExpiredTrash();
    expect(await db.images.get("cut")).toBeDefined();
  });
});

describe("trash rules", () => {
  it("days left count down to 0", () => {
    const t = 1_000_000;
    expect(trashDaysLeft(t, t)).toBe(TRASH_KEEP_DAYS);
    expect(trashDaysLeft(t, t + (TRASH_KEEP_DAYS - 0.5) * DAY)).toBe(1);
    expect(trashDaysLeft(t, t + (TRASH_KEEP_DAYS + 3) * DAY)).toBe(0);
    // PC QA: a clock behind the time of deletion never shows 31
    expect(trashDaysLeft(t, t - 2 * DAY)).toBe(TRASH_KEEP_DAYS);
  });

  it("an image is unused only if no work mentions it anywhere", () => {
    const [a, b, c] = ["3f1c0a52-aaaa", "3f1c0a52-bbbb", "3f1c0a52-cccc"];
    expect(unreferencedImageIds([a, b, c], [{ content: img(a) }, { settings: { cover: { front: { assetId: b } } } }])).toEqual([c]);
    // a text search errs on the side of keeping: a short id found inside other words stays
    expect(unreferencedImageIds(["con"], [{ content: "本文" }])).toEqual([]);
  });
});
