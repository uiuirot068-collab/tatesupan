import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  countMovableWorks,
  createDocument,
  db,
  deleteDocument,
  ensureSampleProject,
  exportBookshelf,
  importBookshelf,
  listDocuments,
  listTrash,
  markCloudSynced,
  saveDocument,
  saveImage,
} from "./db";
import { DEFAULT_PAGE_SETTINGS } from "./pageLayout";
import { readCloudLink, writeCloudLink } from "./cloudLink";
import { readDeviceCopyId } from "./cloudDeviceCopy";
import { canonicalUrl, isEmptyWork, isOldAddress, moveFilename, readMovePayload, type BookshelfMovePayload } from "./bookshelfMove";

/**
 * TSP-SAFE-006: moving the bookshelf from tatespun.pages.dev to spuntales.net.
 * Both addresses are the same IndexedDB here, so a test exports, clears this
 * "browser", and imports into it as the other address.
 */

const settings = DEFAULT_PAGE_SETTINGS;
const img = (id: string) => `【IMG:${id}:50:30:top】`;
const PNG = "data:image/png;base64,iVBORw0KGgo=";

const local = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => local.get(key) ?? null,
    setItem: (key: string, value: string) => void local.set(key, value),
    removeItem: (key: string) => void local.delete(key),
  },
};

async function clearBrowser() {
  local.clear();
  await db.documents.clear();
  await db.bookshelfMetadata.clear();
  await db.images.clear();
  await db.trash.clear();
}

/** Export here, then start over as the other address. Goes through JSON like the file route. */
async function carry(): Promise<BookshelfMovePayload> {
  const payload = readMovePayload(JSON.parse(JSON.stringify(await exportBookshelf())));
  await clearBrowser();
  return payload!;
}

beforeEach(clearBrowser);

describe("addresses", () => {
  it("only tatespun.pages.dev is the old address; the same page opens on spuntales.net", () => {
    expect(isOldAddress("tatespun.pages.dev")).toBe(true);
    expect(isOldAddress("spuntales.net")).toBe(false);
    expect(isOldAddress("abc.tatespun.pages.dev")).toBe(false);
    expect(canonicalUrl({ pathname: "/tatespun/editor/", search: "?id=12", hash: "#p" })).toBe(
      "https://spuntales.net/tatespun/editor/?id=12#p"
    );
    expect(moveFilename(new Date(2026, 9, 9))).toBe("tatespun-bookshelf-20261009.json");
  });

  it("a work with no title, text or note is empty", () => {
    expect(isEmptyWork({ title: "", content: "  ", plotNote: "" })).toBe(true);
    expect(isEmptyWork({ title: "", content: "", plotNote: "メモ" })).toBe(false);
  });
});

describe("readMovePayload", () => {
  it("refuses anything that is not a moved bookshelf", () => {
    expect(readMovePayload(null)).toBeNull();
    expect(readMovePayload({ format: "other", version: 1, documents: [], trash: [], images: [] })).toBeNull();
    expect(readMovePayload({ format: "tatespun-bookshelf", version: 2, documents: [], trash: [], images: [] })).toBeNull();
  });

  it("skips damaged entries and images that are not data", () => {
    const payload = readMovePayload({
      format: "tatespun-bookshelf",
      version: 1,
      documents: [{ id: 1, title: 5 }, { title: "no id" }, "x"],
      trash: [{ trashedAt: 3, document: { id: 2, content: "本文" } }, { document: { id: 3 } }],
      images: [
        { id: "a", dataUrl: PNG },
        { id: "b", dataUrl: "https://example.com/x.png" },
        { id: 4, dataUrl: PNG },
      ],
    });
    expect(payload?.documents).toHaveLength(1);
    expect(payload?.documents[0].title).toBe("");
    expect(payload?.trash).toHaveLength(1);
    expect(payload?.images.map((image) => image.id)).toEqual(["a"]);
  });
});

describe("moving the bookshelf", () => {
  it("counts works worth moving: not the sample, not empty works", async () => {
    await ensureSampleProject();
    await createDocument();
    expect(await countMovableWorks()).toMatchObject({ works: 0, trash: 0 });
    const id = await createDocument();
    await saveDocument(id, "長編", "本文", settings, "");
    const gone = await createDocument();
    await saveDocument(gone, "没", "没の本文", settings, "");
    await deleteDocument(gone, 1234);
    const count = await countMovableWorks();
    expect(count).toMatchObject({ works: 1, trash: 1 });
    expect(count.latest).toBeGreaterThan(1234);
  });

  it("moves works, the trash and their illustrations, keeping the last-edited time", async () => {
    const a = await createDocument();
    await saveDocument(a, "長編", `はじめ${img("i1")}`, settings, "メモ");
    await saveImage({ id: "i1", dataUrl: PNG, createdAt: 1 });
    await saveImage({ id: "unused", dataUrl: PNG, createdAt: 1 });
    const b = await createDocument();
    await saveDocument(b, "没", `没${img("i2")}`, settings, "");
    await saveImage({ id: "i2", dataUrl: PNG, createdAt: 2 });
    await deleteDocument(b, 5000);
    const updatedAt = (await db.documents.get(a))!.updatedAt;

    const payload = await carry();
    expect(payload.images.map((image) => image.id).sort()).toEqual(["i1", "i2"]);
    const result = await importBookshelf(payload, 60);

    expect(result).toEqual({ works: 1, trash: 1, skipped: 0 });
    const [moved] = await listDocuments();
    expect(moved).toMatchObject({ title: "長編", plotNote: "メモ", updatedAt });
    expect(await db.bookshelfMetadata.get(moved.id)).toBeDefined();
    const [trashed] = await listTrash();
    expect(trashed).toMatchObject({ trashedAt: 5000 });
    expect(trashed.document.title).toBe("没");
    expect(trashed.document.id).toBe(trashed.id);
    expect((await db.images.toArray()).map((image) => image.id).sort()).toEqual(["i1", "i2"]);
  });

  it("moving twice does not make copies", async () => {
    const a = await createDocument();
    await saveDocument(a, "長編", "本文", settings, "");
    const payload = await exportBookshelf();
    expect(await importBookshelf(payload, 60)).toEqual({ works: 0, trash: 0, skipped: 1 });
    expect(await listDocuments()).toHaveLength(1);
  });

  it("works already here keep theirs: new ids, nothing overwritten", async () => {
    const a = await createDocument();
    await saveDocument(a, "向こうの作品", "向こう", settings, "");
    const payload = await carry();
    const here = await createDocument();
    await saveDocument(here, "こちらの作品", "こちら", settings, "");
    // Same id on both sides (ids are times).
    await db.documents.update(here, { id: here });
    const result = await importBookshelf({ ...payload, documents: payload.documents.map((doc) => ({ ...doc, id: here })) }, 60);
    expect(result).toEqual({ works: 1, trash: 0, skipped: 0 });
    const titles = (await listDocuments()).map((doc) => doc.title).sort();
    expect(titles).toEqual(["こちらの作品", "向こうの作品"]);
    expect((await db.documents.get(here))!.title).toBe("こちらの作品");
  });

  it("past the bookshelf's limit nothing is moved", async () => {
    for (const title of ["一", "二"]) {
      const id = await createDocument();
      await saveDocument(id, title, "本文", settings, "");
    }
    const payload = await carry();
    const here = await createDocument();
    await saveDocument(here, "こちら", "本文", settings, "");
    expect(await importBookshelf(payload, 2)).toBe("full");
    expect(await listDocuments()).toHaveLength(1);
    expect(await importBookshelf(payload, 3)).toMatchObject({ works: 2 });
  });

  it("a 短編集 keeps pointing at its works under their new ids", async () => {
    const a = await createDocument();
    await saveDocument(a, "一話", "本文一", settings, "");
    const c = await createDocument();
    await saveDocument(c, "短編集", "本文一", settings, "", { isCollection: true, includedDocumentIds: [a] });
    const payload = await carry();
    await importBookshelf(payload, 60);
    const docs = await listDocuments();
    const first = docs.find((doc) => doc.title === "一話")!;
    const collection = docs.find((doc) => doc.title === "短編集")!;
    expect(collection.isCollection).toBe(true);
    expect(collection.includedDocumentIds).toEqual([first.id]);
  });

  it("a cloud work's copy stays its copy (link and device copy), unless it already has one here", async () => {
    const a = await createDocument();
    await saveDocument(a, "雲", "本文", settings, "");
    await markCloudSynced(a, { projectId: "p1", updatedAt: "2026-10-01", title: "雲", content: "本文" });
    writeCloudLink(a, "p1");
    const plain = await createDocument();
    await saveDocument(plain, "保存先だけ", "本文2", settings, "");
    writeCloudLink(plain, "p2");
    const payload = await carry();

    await importBookshelf(payload, 60);
    const docs = await listDocuments();
    const copy = docs.find((doc) => doc.title === "雲")!;
    const linked = docs.find((doc) => doc.title === "保存先だけ")!;
    expect(copy.cloudSync?.projectId).toBe("p1");
    expect(readCloudLink(copy.id)).toBe("p1");
    expect(readDeviceCopyId("p1")).toBe(copy.id);
    expect(linked.cloudSync).toBeUndefined();
    expect(readCloudLink(linked.id)).toBe("p2");

    // The other address had opened p1 too (another copy, other text).
    await clearBrowser();
    const here = await createDocument();
    await saveDocument(here, "雲", "こちらの本文", settings, "");
    await markCloudSynced(here, { projectId: "p1", updatedAt: "2026-10-02", title: "雲", content: "こちらの本文" });
    await importBookshelf(payload, 60);
    const moved = (await listDocuments()).find((doc) => doc.title === "雲" && doc.id !== here)!;
    expect(moved.cloudSync).toBeUndefined();
    expect(readCloudLink(moved.id)).toBeNull();
  });
});
