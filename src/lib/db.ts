import { normalizeSettingsFonts } from "../constants/fonts";
import Dexie, { type Table } from "dexie";
import {
  DEFAULT_MASTER_PAGE_SETTINGS,
  DEFAULT_PAGE_SETTINGS,
  type PageSettings,
} from "./pageLayout";
import { createGuideColophonSettings, normalizeColophonSettings } from "./colophon";
import { normalizeTocSettings } from "./tocSettings";
import { normalizeSettingsCover } from "./cover/coverSettingsSync";
import { SAMPLE_PROJECT } from "@/constants/sampleData";
import { isEphemeralDocId } from "@/constants/demoData";
import { initializeWorkSessionScope } from "./editorSessionActivity";
import { bookshelfMetadataFromDocument, type BookshelfMetadataRecord } from "./bookshelfMetadata";

export interface DocumentRecord {
  id: number;
  title: string;
  content: string;
  settings: PageSettings;
  plotNote?: string;
  updatedAt: number;
  /** 短編集・再録本フラグ: 複数作品を結合して生成されたドキュメントか */
  isCollection?: boolean;
  /** 結合元となった作品（DocumentRecord.id）のリスト。isCollection のときのみ有効 */
  includedDocumentIds?: number[];
  /** 削除不可の初期サンプル作品フラグ */
  isSample?: boolean;
}

/** A 挿絵 (illustration) uploaded by the user. Referenced from `content` by id. */
export interface ImageRecord {
  id: string;
  dataUrl: string;
  createdAt: number;
  /**
   * Front/back stacking rank among images sharing the same page + 天/中央/地
   * position, independent of the IMG marker's position in `content` (which
   * must stay untouched by layering so pagination/tokenLength are never
   * affected). Undefined for images inserted before this field existed, or
   * never explicitly reordered — callers fall back to document/token order
   * in that case. Lower sorts further back; not required to be contiguous.
   */
  layerOrder?: number;
}

class TategakiDatabase extends Dexie {
  documents!: Table<DocumentRecord, number>;
  images!: Table<ImageRecord, string>;
  bookshelfMetadata!: Table<BookshelfMetadataRecord, number>;

  constructor() {
    super("tategaki-editor-db");
    this.version(1).stores({
      documents: "id, updatedAt",
    });
    this.version(2).stores({
      documents: "id, updatedAt",
      images: "id, createdAt",
    });
    this.version(3).stores({
      documents: "id, updatedAt, isCollection",
      images: "id, createdAt",
    });
    this.version(4)
      .stores({
        documents: "id, updatedAt, isCollection",
        images: "id, createdAt",
        bookshelfMetadata: "id, updatedAt, isCollection",
      })
      .upgrade(async (tx) => {
        const documents = await tx.table<DocumentRecord, number>("documents").toArray();
        const metadata = documents
          .map((document) => bookshelfMetadataFromDocument(document))
          .filter((record): record is BookshelfMetadataRecord => record !== null);

        if (metadata.length > 0) {
          await tx.table<BookshelfMetadataRecord, number>("bookshelfMetadata").bulkPut(metadata);
        }
      });
  }
}

export const db = new TategakiDatabase();

function withDefaults(doc: DocumentRecord): DocumentRecord {
  // Merge defaults so records saved before `settings` (or before
  // `masterPage` was added to it) still load with valid values.
  return {
    ...doc,
    settings: normalizeSettingsFonts(normalizeSettingsCover({
      ...DEFAULT_PAGE_SETTINGS,
      ...doc.settings,
      masterPage: {
        ...DEFAULT_MASTER_PAGE_SETTINGS,
        ...doc.settings?.masterPage,
      },
      pageOverrides: doc.settings?.pageOverrides ?? {},
      // 旧レコード（colophon 未保存）は既定の奥付設定（enabled=false）で開く。
      colophon: normalizeColophonSettings(doc.settings?.colophon, doc.title),
      toc: normalizeTocSettings(doc.settings?.toc),
    })),
    plotNote: doc.plotNote ?? "",
    isCollection: doc.isCollection ?? false,
    includedDocumentIds: doc.includedDocumentIds ?? [],
    isSample: doc.isSample ?? false,
  };
}

// ガイドだけ横書き奥付を実例として1ページ有効化する（通常の新規 document の
// 既定は colophon OFF のまま——createGuideColophonSettings の doc 参照）。
function guideSettings(): PageSettings {
  return { ...DEFAULT_PAGE_SETTINGS, colophon: createGuideColophonSettings() };
}

function sampleDocument(updatedAt: number): DocumentRecord {
  return {
    id: SAMPLE_PROJECT.id,
    title: SAMPLE_PROJECT.title,
    content: SAMPLE_PROJECT.content,
    isSample: true,
    settings: guideSettings(),
    plotNote: "",
    updatedAt,
    isCollection: false,
    includedDocumentIds: [],
  };
}

/** サンプル作品が未登録の場合、削除不可の初期サンプルとして IndexedDB に登録する。 */
export async function ensureSampleProject(): Promise<void> {
  const existing = await db.documents.get(SAMPLE_PROJECT.id);
  if (existing) return;
  await db.documents.put({
    id: SAMPLE_PROJECT.id,
    title: SAMPLE_PROJECT.title,
    content: SAMPLE_PROJECT.content,
    isSample: true,
    settings: guideSettings(),
    plotNote: "",
    updatedAt: Date.now(),
  });
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const docs = await db.documents.orderBy("updatedAt").reverse().toArray();
  return docs.map((doc) =>
    doc.id === SAMPLE_PROJECT.id ? sampleDocument(doc.updatedAt) : withDefaults(doc)
  );
}

export async function listBookshelfMetadata(): Promise<BookshelfMetadataRecord[]> {
  return db.bookshelfMetadata.orderBy("updatedAt").reverse().toArray();
}

export async function rebuildBookshelfMetadata(): Promise<void> {
  await db.transaction("rw", db.documents, db.bookshelfMetadata, async () => {
    const documents = await db.documents.toArray();
    const metadata = documents
      .map((document) => bookshelfMetadataFromDocument(document))
      .filter((record): record is BookshelfMetadataRecord => record !== null);

    await db.bookshelfMetadata.clear();
    if (metadata.length > 0) {
      await db.bookshelfMetadata.bulkPut(metadata);
    }
  });
}

export async function loadDocument(id: number): Promise<DocumentRecord | undefined> {
  const doc = await db.documents.get(id);
  if (!doc) return undefined;
  if (id === SAMPLE_PROJECT.id) return sampleDocument(doc.updatedAt);
  return withDefaults(doc);
}

/** Creates a new empty document and returns its id. */
export async function createDocument(settings: PageSettings = DEFAULT_PAGE_SETTINGS): Promise<number> {
  const id = Date.now();
  const document: DocumentRecord = {
    id,
    title: "",
    content: "",
    settings,
    plotNote: "",
    updatedAt: Date.now(),
  };
  const metadata = bookshelfMetadataFromDocument(document);
  await db.transaction("rw", db.documents, db.bookshelfMetadata, async () => {
    await db.documents.put(document);
    if (metadata) await db.bookshelfMetadata.put(metadata);
  });
  // A deleted document's scoped history intentionally survives in localStorage.
  // If a timestamp id is ever reused (for example after a clock rollback), the
  // new document must claim a clean namespace without erasing any other work.
  initializeWorkSessionScope(`local:${id}`);
  return id;
}

export async function saveDocument(
  id: number,
  title: string,
  content: string,
  settings: PageSettings,
  plotNote: string,
  collection?: { isCollection?: boolean; includedDocumentIds?: number[] }
): Promise<void> {
  // The 使い方ガイド (-1) and the TSP-024 おためしデモ (-2) are in-memory only —
  // never write a row for them.
  if (isEphemeralDocId(id)) return;
  const document: DocumentRecord = {
    id,
    title,
    content,
    settings,
    plotNote,
    updatedAt: Date.now(),
    isCollection: collection?.isCollection,
    includedDocumentIds: collection?.includedDocumentIds,
  };
  const metadata = bookshelfMetadataFromDocument(document);
  await db.transaction("rw", db.documents, db.bookshelfMetadata, async () => {
    await db.documents.put(document);
    if (metadata) {
      await db.bookshelfMetadata.put(metadata);
    } else {
      await db.bookshelfMetadata.delete(id);
    }
  });
}

export async function deleteDocument(id: number): Promise<void> {
  if (isEphemeralDocId(id)) return;
  await db.transaction("rw", db.documents, db.bookshelfMetadata, async () => {
    await db.documents.delete(id);
    await db.bookshelfMetadata.delete(id);
  });
}

export async function saveImage(record: ImageRecord): Promise<void> {
  await db.images.put(record);
}

export async function loadAllImages(): Promise<ImageRecord[]> {
  return db.images.toArray();
}

/**
 * Phase 7: reads only the given image ids (primary-key lookups, no schema
 * change). Opening a local document loads the images its manuscript
 * references instead of every document's images (`loadAllImages`). Ids with
 * no stored record are simply absent from the result.
 */
export async function loadImagesByIds(ids: readonly string[]): Promise<ImageRecord[]> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];
  const records = await db.images.bulkGet(unique);
  return records.filter((record): record is ImageRecord => record !== undefined);
}

/**
 * Phase 12: which of `ids` have an original in IndexedDB — primary keys only,
 * so the image center can show 「IndexedDB原本あり/なし」 without reading
 * every image's data.
 */
export async function listStoredImageIds(ids: readonly string[]): Promise<Set<string>> {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return new Set();
  const keys = await db.images.where("id").anyOf(unique).primaryKeys();
  return new Set(keys.map(String));
}

export async function deleteImage(id: string): Promise<void> {
  await db.images.delete(id);
}

/** Persists a single image's front/back stacking rank without touching its dataUrl/createdAt. */
export async function updateImageLayerOrder(id: string, layerOrder: number): Promise<void> {
  await db.images.update(id, { layerOrder });
}
