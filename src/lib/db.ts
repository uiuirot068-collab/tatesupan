import Dexie, { type Table } from "dexie";
import {
  DEFAULT_MASTER_PAGE_SETTINGS,
  DEFAULT_PAGE_SETTINGS,
  type PageSettings,
} from "./pageLayout";
import { SAMPLE_PROJECT } from "@/constants/sampleData";

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
}

class TategakiDatabase extends Dexie {
  documents!: Table<DocumentRecord, number>;
  images!: Table<ImageRecord, string>;

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
  }
}

export const db = new TategakiDatabase();

function withDefaults(doc: DocumentRecord): DocumentRecord {
  // Merge defaults so records saved before `settings` (or before
  // `masterPage` was added to it) still load with valid values.
  return {
    ...doc,
    settings: {
      ...DEFAULT_PAGE_SETTINGS,
      ...doc.settings,
      masterPage: {
        ...DEFAULT_MASTER_PAGE_SETTINGS,
        ...doc.settings?.masterPage,
      },
      pageOverrides: doc.settings?.pageOverrides ?? {},
    },
    plotNote: doc.plotNote ?? "",
    isCollection: doc.isCollection ?? false,
    includedDocumentIds: doc.includedDocumentIds ?? [],
    isSample: doc.isSample ?? false,
  };
}

function sampleDocument(updatedAt: number): DocumentRecord {
  return {
    id: SAMPLE_PROJECT.id,
    title: SAMPLE_PROJECT.title,
    content: SAMPLE_PROJECT.content,
    isSample: true,
    settings: DEFAULT_PAGE_SETTINGS,
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
    settings: DEFAULT_PAGE_SETTINGS,
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

export async function loadDocument(id: number): Promise<DocumentRecord | undefined> {
  const doc = await db.documents.get(id);
  if (!doc) return undefined;
  if (id === SAMPLE_PROJECT.id) return sampleDocument(doc.updatedAt);
  return withDefaults(doc);
}

/** Creates a new empty document and returns its id. */
export async function createDocument(): Promise<number> {
  const id = Date.now();
  await db.documents.put({
    id,
    title: "",
    content: "",
    settings: DEFAULT_PAGE_SETTINGS,
    plotNote: "",
    updatedAt: Date.now(),
  });
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
  if (id === SAMPLE_PROJECT.id) return;
  await db.documents.put({
    id,
    title,
    content,
    settings,
    plotNote,
    updatedAt: Date.now(),
    isCollection: collection?.isCollection,
    includedDocumentIds: collection?.includedDocumentIds,
  });
}

export async function deleteDocument(id: number): Promise<void> {
  if (id === SAMPLE_PROJECT.id) return;
  await db.documents.delete(id);
}

export async function saveImage(record: ImageRecord): Promise<void> {
  await db.images.put(record);
}

export async function loadAllImages(): Promise<ImageRecord[]> {
  return db.images.toArray();
}

export async function deleteImage(id: string): Promise<void> {
  await db.images.delete(id);
}
