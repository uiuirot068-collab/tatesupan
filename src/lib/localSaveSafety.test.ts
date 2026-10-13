import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  createDocument,
  db,
  deleteDocument,
  listDocuments,
  loadDocument,
  markCloudSynced,
  openCloudDeviceCopy,
  renameDocument,
  revisionOf,
  saveDocument,
  saveDocumentIfUnchanged,
  createDocumentCopy,
} from "./db";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "./pageLayout";
import { LocalSaveQueue } from "./localSaveQueue";
import { cloudCompareLocalCopyTitle, isCloudVersionChanged } from "./cloudVersionCompare";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * TSP-SAFE-001: the scenes of TSP-REVIEW-001 3の1・3の3・3の7, reproduced
 * against the real IndexedDB code (lib/db.ts, in fake-indexeddb). Each of
 * these lost or resurrected text before this loop.
 */

const settings: PageSettings = DEFAULT_PAGE_SETTINGS;

/** One editor tab: its own queue over the same database. */
function openTab() {
  return new LocalSaveQueue<PageSettings>(
    {
      write: (job, expected) => saveDocumentIfUnchanged(job, expected),
      createCopy: (job, title) => createDocumentCopy(job, title),
    },
    { setTimer: () => null, clearTimer: () => undefined }
  );
}

async function openInTab(queue: LocalSaveQueue<PageSettings>, id: number) {
  const doc = await loadDocument(id);
  queue.setBase(id, revisionOf(doc));
  return doc;
}

const edit = (docId: number, content: string, title = "長編") => ({ docId, title, content, settings, plotNote: "" });

const cloudProject = (over: Partial<{ id: string; title: string; content: string; updated_at: string }> = {}) => ({
  id: "cloud-1",
  title: "長編",
  content: "クラウドの本文",
  settings,
  updated_at: "2026-10-13T00:00:00.000Z",
  ...over,
});

beforeEach(async () => {
  await db.documents.clear();
  await db.bookshelfMetadata.clear();
});

describe("two tabs on the same work (3の3)", () => {
  it("before: the second tab's autosave silently replaced the first tab's text", async () => {
    const id = await createDocument();
    await saveDocument(id, "長編", "はじめ", settings, "");
    // The old editor wrote with saveDocument (an unconditional put).
    await saveDocument(id, "長編", "はじめ＋Aで書いた分", settings, "");
    await saveDocument(id, "長編", "はじめ＋Bで書いた分", settings, "");
    const all = await listDocuments();
    expect(all.map((doc) => doc.content)).toEqual(["はじめ＋Bで書いた分"]); // A's text is gone
  });

  it("now: both tabs' text survive, as the work and a separate copy", async () => {
    const id = await createDocument();
    await saveDocument(id, "長編", "はじめ", settings, "");
    const tabA = openTab();
    const tabB = openTab();
    await openInTab(tabA, id);
    await openInTab(tabB, id);

    await tabA.submit(edit(id, "はじめ＋Aで書いた分"));
    await tabB.submit(edit(id, "はじめ＋Bで書いた分"));
    await tabB.submit(edit(id, "はじめ＋Bで書いた分＋続き"));

    const all = await listDocuments();
    expect((await loadDocument(id))?.content).toBe("はじめ＋Aで書いた分");
    const copy = all.find((doc) => doc.id !== id);
    expect(copy?.title).toBe("長編（書きかけの控え）");
    expect(copy?.content).toBe("はじめ＋Bで書いた分＋続き");
    expect(all).toHaveLength(2);
  });

  it("a work deleted in one tab does not come back from the other tab's autosave", async () => {
    const id = await createDocument();
    await saveDocument(id, "長編", "はじめ", settings, "");
    const tabB = openTab();
    await openInTab(tabB, id);

    await deleteDocument(id); // 本棚 in tab A
    await tabB.submit(edit(id, "はじめ＋Bで書いた分"));

    expect(await loadDocument(id)).toBeUndefined();
    expect(await listDocuments()).toHaveLength(0);
  });

  it("a write never drops the 短編集 marks it does not carry", async () => {
    const id = await createDocument();
    await db.documents.update(id, { isCollection: true, includedDocumentIds: [1, 2] });
    const tab = openTab();
    await openInTab(tab, id);
    await tab.submit(edit(id, "一文字"));
    const doc = await loadDocument(id);
    expect(doc?.isCollection).toBe(true);
    expect(doc?.includedDocumentIds).toEqual([1, 2]);
  });
});

describe("a failed write is retried (3の7)", () => {
  it("keeps the text through a failure and writes it on the retry", async () => {
    const id = await createDocument();
    let failures = 1;
    let retry: (() => void) | null = null;
    const tab = new LocalSaveQueue<PageSettings>(
      {
        write: async (job, expected) => {
          if (failures-- > 0) throw new DOMException("quota", "QuotaExceededError");
          return saveDocumentIfUnchanged(job, expected);
        },
        createCopy: (job, title) => createDocumentCopy(job, title),
      },
      { setTimer: (callback) => (retry = callback), clearTimer: () => undefined }
    );
    await openInTab(tab, id);
    await tab.submit(edit(id, "失敗した時に書いていた分"));
    expect((await loadDocument(id))?.content).toBe("");
    expect(tab.hasUnsaved).toBe(true);

    retry!();
    await tab.whenIdle();
    expect((await loadDocument(id))?.content).toBe("失敗した時に書いていた分");
    expect(tab.hasUnsaved).toBe(false);
  });
});

describe("a cloud work is kept in this browser as one device copy (3の1)", () => {
  it("opening it makes a copy here, and opening it again reuses the same copy", async () => {
    const first = await openCloudDeviceCopy(cloudProject(), cloudCompareLocalCopyTitle);
    expect(first.decision).toBe("create");
    expect((await loadDocument(first.docId))?.content).toBe("クラウドの本文");

    const again = await openCloudDeviceCopy(cloudProject(), cloudCompareLocalCopyTitle);
    expect(again.docId).toBe(first.docId);
    expect(await listDocuments()).toHaveLength(1);
  });

  it("text written after opening is autosaved into the copy and is there after a reload", async () => {
    const opened = await openCloudDeviceCopy(cloudProject(), cloudCompareLocalCopyTitle);
    const tab = openTab();
    tab.setBase(opened.docId, opened.revision);
    await tab.submit(edit(opened.docId, "クラウドの本文＋この端末で書いた分"));

    // Reload: the cloud has not changed, so the copy's unsent text is what opens.
    const reopened = await openCloudDeviceCopy(cloudProject(), cloudCompareLocalCopyTitle);
    expect(reopened.decision).toBe("keep-local");
    expect(reopened.content).toBe("クラウドの本文＋この端末で書いた分");
    expect(await listDocuments()).toHaveLength(1);
  });

  it("unsent text in the copy is never overwritten silently when the cloud changed too", async () => {
    const opened = await openCloudDeviceCopy(cloudProject(), cloudCompareLocalCopyTitle);
    const tab = openTab();
    tab.setBase(opened.docId, opened.revision);
    await tab.submit(edit(opened.docId, "この端末だけの書きかけ"));

    const newer = cloudProject({ content: "別の端末で書いた本文", updated_at: "2026-10-13T05:00:00.000Z" });
    const reopened = await openCloudDeviceCopy(newer, cloudCompareLocalCopyTitle);

    expect(reopened.decision).toBe("rescue-then-replace");
    expect(reopened.docId).toBe(opened.docId);
    expect(reopened.content).toBe("別の端末で書いた本文");
    const rescued = await loadDocument(reopened.rescued!.id);
    expect(rescued?.title).toBe("長編（この端末の控え）");
    expect(rescued?.content).toBe("この端末だけの書きかけ");
  });

  it("a copy with nothing unsent simply follows the newer cloud version", async () => {
    const opened = await openCloudDeviceCopy(cloudProject(), cloudCompareLocalCopyTitle);
    const newer = cloudProject({ content: "別の端末で書いた本文", updated_at: "2026-10-13T05:00:00.000Z" });
    const reopened = await openCloudDeviceCopy(newer, cloudCompareLocalCopyTitle);
    expect(reopened).toMatchObject({ docId: opened.docId, decision: "replace", rescued: null });
    expect(await listDocuments()).toHaveLength(1);
  });

  it("after クラウドに保存, the copy counts as matching that cloud version", async () => {
    const opened = await openCloudDeviceCopy(cloudProject(), cloudCompareLocalCopyTitle);
    const tab = openTab();
    tab.setBase(opened.docId, opened.revision);
    await tab.submit(edit(opened.docId, "送った本文"));
    await markCloudSynced(opened.docId, { projectId: "cloud-1", updatedAt: "2026-10-13T06:00:00.000Z", title: "長編", content: "送った本文" });

    const reopened = await openCloudDeviceCopy(
      cloudProject({ content: "送った本文", updated_at: "2026-10-13T06:00:00.000Z" }),
      cloudCompareLocalCopyTitle
    );
    expect(reopened.decision).toBe("replace");
    expect(reopened.rescued).toBeNull();
  });

  it("a tab that had the copy open before it was replaced keeps its text separately", async () => {
    const opened = await openCloudDeviceCopy(cloudProject(), cloudCompareLocalCopyTitle);
    const tabA = openTab();
    tabA.setBase(opened.docId, opened.revision);
    // Tab B opens the newer cloud version, which replaces the copy.
    await openCloudDeviceCopy(cloudProject({ content: "新しい", updated_at: "2026-10-13T05:00:00.000Z" }), cloudCompareLocalCopyTitle);
    await tabA.submit(edit(opened.docId, "Aで書いた分"));

    expect((await loadDocument(opened.docId))?.content).toBe("新しい");
    const all = await listDocuments();
    expect(all.find((doc) => doc.id !== opened.docId)?.content).toBe("Aで書いた分");
  });
});

describe("renaming on the bookshelf while the work is open in another tab", () => {
  it("before: the open tab's next autosave put the old title back", async () => {
    const id = await createDocument();
    await saveDocument(id, "旧題", "本文", settings, "");
    await db.documents.update(id, { title: "新題" }); // the old bookshelf rename
    await saveDocument(id, "旧題", "本文＋続き", settings, ""); // the open tab's autosave
    expect((await loadDocument(id))?.title).toBe("旧題");
  });

  it("now: the open tab keeps writing its text, the new title stays, and the tab learns it", async () => {
    const id = await createDocument();
    await saveDocument(id, "旧題", "本文", settings, "");
    const tab = openTab();
    const events: unknown[] = [];
    tab.subscribe((event) => events.push(event));
    await openInTab(tab, id);

    await renameDocument(id, "新題");
    await renameDocument(id, "新題2");
    await tab.submit(edit(id, "本文＋続き", "旧題"));
    await tab.submit(edit(id, "本文＋続き＋さらに", "旧題")); // typed before the screen showed the new title

    const doc = await loadDocument(id);
    expect(doc?.title).toBe("新題2");
    expect(doc?.content).toBe("本文＋続き＋さらに");
    expect(await listDocuments()).toHaveLength(1); // not split
    expect(events).toContainEqual({ type: "saved", docId: id, renamedTitle: "新題2" });
  });

  it("a rename after another tab's text change still splits a stale screen (both texts kept)", async () => {
    const id = await createDocument();
    const stale = openTab();
    await openInTab(stale, id);
    const other = openTab();
    await openInTab(other, id);
    await other.submit(edit(id, "別のタブの本文"));
    await renameDocument(id, "新題");
    await stale.submit(edit(id, "古い画面の本文"));
    expect((await loadDocument(id))?.content).toBe("別のタブの本文");
    expect((await listDocuments()).some((doc) => doc.content === "古い画面の本文")).toBe(true);
  });
});

describe("no false 「クラウド版の方が新しい」 on a work reopened from this browser (3の2)", () => {
  it("compares with the cloud version the work last matched, not with the screen", async () => {
    const id = await createDocument();
    await saveDocument(id, "長編", "送った本文", settings, "");
    await markCloudSynced(id, { projectId: "cloud-1", updatedAt: "2026-10-13T06:00:00.000Z", title: "長編", content: "送った本文" });
    const sync = (await loadDocument(id))!.cloudSync!;
    const cloudNow = { updated_at: "2026-10-13T06:00:00.000Z", title: "長編", content: "送った本文" };
    const screen = { title: "長編", content: "送った本文＋この端末で書き足した分" };

    // Before: no remembered base → the screen itself was the base → always "changed".
    expect(isCloudVersionChanged(cloudNow, { updatedAt: null, ...screen })).toBe(true);
    // Now: the remembered version → unchanged, so クラウドに保存 just saves.
    expect(isCloudVersionChanged(cloudNow, { updatedAt: sync.updatedAt, title: "", content: "", hash: sync.hash })).toBe(false);
    // Saved from another device since → still asks.
    const newer = { updated_at: "2026-10-13T07:00:00.000Z", title: "長編", content: "別の端末" };
    expect(isCloudVersionChanged(newer, { updatedAt: sync.updatedAt, title: "", content: "", hash: sync.hash })).toBe(true);
  });
});

describe("the 60-work limit of this browser's bookshelf", () => {
  it("does not count works that are also in the cloud", () => {
    const home = readFileSync(resolve("src/app/home-v2/HomeV2Client.tsx"), "utf8");
    expect(home).toContain("db.documents.filter((doc) => !doc.isSample && !doc.cloudSync).count()");
  });
});
