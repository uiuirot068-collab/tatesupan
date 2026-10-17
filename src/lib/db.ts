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
import type { LocalWriteResult } from "./localSaveQueue";
import {
  contentHash,
  decideDeviceCopy,
  readDeviceCopyId,
  writeDeviceCopyId,
  type CloudSyncRecord,
  type DeviceCopyDecision,
} from "./cloudDeviceCopy";
import { writeCloudLink } from "./cloudLink";

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
  /**
   * TSP-SAFE-001: bumped by every write of the work. A screen writes only if
   * the work is still at the revision it read (lib/localSaveQueue.ts), so two
   * tabs never silently overwrite each other. Missing on older records (= 0).
   */
  revision?: number;
  /** TSP-SAFE-001: set when this work is the device copy of a cloud work (lib/cloudDeviceCopy.ts). */
  cloudSync?: CloudSyncRecord;
  /**
   * TSP-SAFE-001: set by a bookshelf rename (renameDocument). While the latest
   * revisions are renames only, a screen that read `renamedFrom` may still
   * write its text — it keeps the new title instead of splitting the work.
   */
  rename?: { atRevision: number; renamedFrom: number };
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
  await db.transaction("rw", db.documents, db.bookshelfMetadata, async () => {
    const current = await db.documents.get(id);
    await writeDocumentRecord(current, { id, title, content, settings, plotNote }, collection);
  });
}

/**
 * TSP-SAFE-001: the editor's write. Writes only while the stored work is
 * still at `expectedRevision` (undefined skips that check) and never
 * re-creates a work that was deleted (see lib/localSaveQueue.ts).
 */
export async function saveDocumentIfUnchanged(
  job: { docId: number; title: string; content: string; settings: PageSettings; plotNote: string },
  expectedRevision: number | undefined
): Promise<LocalWriteResult> {
  if (isEphemeralDocId(job.docId)) return { kind: "saved", revision: 0 };
  return db.transaction("rw", db.documents, db.bookshelfMetadata, async (): Promise<LocalWriteResult> => {
    const current = await db.documents.get(job.docId);
    if (!current) return { kind: "deleted" };
    const stored = revisionOf(current);
    const renamedOnly = isRenamedOnlySince(current, expectedRevision);
    if (expectedRevision !== undefined && stored !== expectedRevision && !renamedOnly) return { kind: "changed" };
    const revision = await writeDocumentRecord(current, {
      id: job.docId,
      title: renamedOnly ? current.title : job.title,
      content: job.content,
      settings: job.settings,
      plotNote: job.plotNote,
    });
    return renamedOnly ? { kind: "saved", revision, renamedTitle: current.title } : { kind: "saved", revision };
  });
}

/** TSP-SAFE-001: keeps a screen's text as a NEW work (rescue copy); returns its id and revision. */
export async function createDocumentCopy(
  source: { title: string; content: string; settings: PageSettings; plotNote: string },
  title: string
): Promise<{ id: number; revision: number }> {
  return db.transaction("rw", db.documents, db.bookshelfMetadata, async () => {
    const id = await unusedDocumentId();
    const revision = await writeDocumentRecord(undefined, {
      id,
      title,
      content: source.content,
      settings: source.settings,
      plotNote: source.plotNote,
    });
    return { id, revision };
  });
}

async function unusedDocumentId(): Promise<number> {
  let id = Date.now();
  while (await db.documents.get(id)) id += 1;
  return id;
}

/**
 * Writes one work's fields, keeping what the editor does not hold (短編集 marks,
 * the device-copy record) and bumping its revision. Must run inside a
 * documents + bookshelfMetadata transaction.
 */
async function writeDocumentRecord(
  current: DocumentRecord | undefined,
  fields: { id: number; title: string; content: string; settings: PageSettings; plotNote: string },
  collection?: { isCollection?: boolean; includedDocumentIds?: number[] },
  cloudSync: CloudSyncRecord | undefined = current?.cloudSync
): Promise<number> {
  const revision = (current?.revision ?? 0) + 1;
  const document: DocumentRecord = {
    ...fields,
    updatedAt: Date.now(),
    isCollection: collection?.isCollection ?? current?.isCollection,
    includedDocumentIds: collection?.includedDocumentIds ?? current?.includedDocumentIds,
    revision,
  };
  if (current?.isSample) document.isSample = true;
  if (cloudSync) document.cloudSync = cloudSync;
  const metadata = bookshelfMetadataFromDocument(document);
  await db.documents.put(document);
  if (metadata) {
    await db.bookshelfMetadata.put(metadata);
  } else {
    await db.bookshelfMetadata.delete(fields.id);
  }
  return revision;
}

/** True when every change since `expectedRevision` was a bookshelf rename. */
function isRenamedOnlySince(current: DocumentRecord, expectedRevision: number | undefined): boolean {
  if (expectedRevision === undefined || !current.rename) return false;
  return current.rename.atRevision === revisionOf(current) && current.rename.renamedFrom === expectedRevision && expectedRevision !== revisionOf(current);
}

/**
 * TSP-SAFE-001: the bookshelf's 題名を変える. Counts as a change of the work
 * (another tab learns the new title on its next save) but never splits a
 * screen that only lacks the new title.
 */
export async function renameDocument(id: number, title: string): Promise<void> {
  if (isEphemeralDocId(id)) return;
  await db.transaction("rw", db.documents, db.bookshelfMetadata, async () => {
    const current = await db.documents.get(id);
    if (!current) return;
    const stored = revisionOf(current);
    const renamedFrom = current.rename && current.rename.atRevision === stored ? current.rename.renamedFrom : stored;
    const revision = stored + 1;
    await db.documents.update(id, { title, revision, rename: { atRevision: revision, renamedFrom } });
    const metadata = await db.bookshelfMetadata.get(id);
    if (metadata) await db.bookshelfMetadata.put({ ...metadata, title });
  });
}

/** Reads a work's current revision (0 for records older than TSP-SAFE-001). */
export function revisionOf(doc: Pick<DocumentRecord, "revision"> | undefined): number {
  return doc?.revision ?? 0;
}

export interface OpenedDeviceCopy {
  docId: number;
  revision: number;
  decision: DeviceCopyDecision;
  /** The text the editor shows (the cloud version, or the copy's newer unsent text). */
  title: string;
  content: string;
  settings: PageSettings;
  plotNote: string;
  /** Set when the copy's unsent text was kept as a separate work before being replaced. */
  rescued: { id: number; title: string } | null;
}

/**
 * TSP-SAFE-001: opens cloud work `project` through its ONE device copy in this
 * browser (created on first open). See lib/cloudDeviceCopy.ts for the rules.
 */
export async function openCloudDeviceCopy(
  project: { id: string; title: string; content: string; settings: PageSettings; updated_at?: string | null },
  rescueTitle: (title: string) => string
): Promise<OpenedDeviceCopy> {
  const cloudHash = contentHash(project.title, project.content);
  const cloudSync: CloudSyncRecord = { projectId: project.id, updatedAt: project.updated_at ?? null, hash: cloudHash };

  const opened = await db.transaction("rw", db.documents, db.bookshelfMetadata, async (): Promise<OpenedDeviceCopy> => {
    const local = await findDeviceCopy(project.id);
    const decision = decideDeviceCopy(
      local ? { hash: contentHash(local.title, local.content), sync: local.cloudSync ?? null } : null,
      { updatedAt: cloudSync.updatedAt, hash: cloudHash }
    );

    if (local && decision === "keep-local") {
      const doc = withDefaults(local);
      return {
        docId: doc.id,
        revision: revisionOf(doc),
        decision,
        title: doc.title,
        content: doc.content,
        settings: doc.settings,
        plotNote: doc.plotNote ?? "",
        rescued: null,
      };
    }

    let rescued: OpenedDeviceCopy["rescued"] = null;
    if (local && decision === "rescue-then-replace") {
      const kept = withDefaults(local);
      const title = rescueTitle(kept.title);
      const id = await unusedDocumentId();
      await writeDocumentRecord(undefined, {
        id,
        title,
        content: kept.content,
        settings: kept.settings,
        plotNote: kept.plotNote ?? "",
      });
      rescued = { id, title };
    }

    const id = local ? local.id : await unusedDocumentId();
    const plotNote = local?.plotNote ?? "";
    const revision = await writeDocumentRecord(
      local,
      { id, title: project.title, content: project.content, settings: project.settings, plotNote },
      undefined,
      cloudSync
    );
    return {
      docId: id,
      revision,
      decision,
      title: project.title,
      content: project.content,
      settings: project.settings,
      plotNote,
      rescued,
    };
  });

  writeDeviceCopyId(project.id, opened.docId);
  writeCloudLink(opened.docId, project.id);
  return opened;
}

async function findDeviceCopy(projectId: string): Promise<DocumentRecord | undefined> {
  const remembered = readDeviceCopyId(projectId);
  if (remembered !== null) {
    const doc = await db.documents.get(remembered);
    if (doc?.cloudSync?.projectId === projectId) return doc;
  }
  // The remembered id is missing (site data partly cleared): look the copy up
  // by its own record. Newest first if there are several.
  const copies = await db.documents.filter((doc) => doc.cloudSync?.projectId === projectId).toArray();
  return copies.sort((a, b) => b.updatedAt - a.updatedAt)[0];
}

/**
 * TSP-SAFE-001: after クラウドに保存, work `docId` is the device copy of that
 * cloud version. Does not change the work's text or revision.
 */
export async function markCloudSynced(
  docId: number,
  saved: { projectId: string; updatedAt: string | null; title: string; content: string }
): Promise<void> {
  if (isEphemeralDocId(docId)) return;
  const cloudSync: CloudSyncRecord = {
    projectId: saved.projectId,
    updatedAt: saved.updatedAt,
    hash: contentHash(saved.title, saved.content),
  };
  const updated = await db.documents.update(docId, { cloudSync });
  if (updated) writeDeviceCopyId(saved.projectId, docId);
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
