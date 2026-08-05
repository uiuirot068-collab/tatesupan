import Dexie, { type Table } from "dexie";
import {
  DEFAULT_MASTER_PAGE_SETTINGS,
  DEFAULT_PAGE_SETTINGS,
  type PageSettings,
} from "./pageLayout";

export interface DocumentRecord {
  id: number;
  title: string;
  content: string;
  settings: PageSettings;
  plotNote?: string;
  updatedAt: number;
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
  }
}

export const db = new TategakiDatabase();

// Single-document prototype: everything is stored under this fixed id.
export const CURRENT_DOCUMENT_ID = 1;

export async function loadDocument(): Promise<DocumentRecord | undefined> {
  const doc = await db.documents.get(CURRENT_DOCUMENT_ID);
  if (!doc) return undefined;
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
  };
}

export async function saveDocument(
  title: string,
  content: string,
  settings: PageSettings,
  plotNote: string
): Promise<void> {
  await db.documents.put({
    id: CURRENT_DOCUMENT_ID,
    title,
    content,
    settings,
    plotNote,
    updatedAt: Date.now(),
  });
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
