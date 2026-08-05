import Dexie, { type Table } from "dexie";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "./pageLayout";

export interface DocumentRecord {
  id: number;
  title: string;
  content: string;
  settings: PageSettings;
  updatedAt: number;
}

class TategakiDatabase extends Dexie {
  documents!: Table<DocumentRecord, number>;

  constructor() {
    super("tategaki-editor-db");
    this.version(1).stores({
      documents: "id, updatedAt",
    });
  }
}

export const db = new TategakiDatabase();

// Single-document prototype: everything is stored under this fixed id.
export const CURRENT_DOCUMENT_ID = 1;

export async function loadDocument(): Promise<DocumentRecord | undefined> {
  const doc = await db.documents.get(CURRENT_DOCUMENT_ID);
  if (!doc) return undefined;
  // Merge defaults so records saved before `settings` existed still load.
  return { ...doc, settings: { ...DEFAULT_PAGE_SETTINGS, ...doc.settings } };
}

export async function saveDocument(
  title: string,
  content: string,
  settings: PageSettings
): Promise<void> {
  await db.documents.put({
    id: CURRENT_DOCUMENT_ID,
    title,
    content,
    settings,
    updatedAt: Date.now(),
  });
}
