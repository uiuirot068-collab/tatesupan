/**
 * TSP-SAFE-006: TateSpun's bookshelf lives at https://spuntales.net/tatespun/
 * (なつお, 10/19). The same site is also reachable at its Cloudflare Pages
 * address, tatespun.pages.dev, and a browser keeps a separate bookshelf per
 * address. Works written at the old address are moved over (never dropped):
 * an empty bookshelf there simply goes to spuntales.net; one with works offers
 * to move them, through a window opened on spuntales.net (postMessage) or a
 * file.
 */

// For trying this on one PC before it is published (development only): e.g.
// NEXT_PUBLIC_TATESPUN_OLD_ORIGIN=http://127.0.0.1:3001 and
// NEXT_PUBLIC_TATESPUN_HOME_ORIGIN=http://localhost:3001 make 127.0.0.1 act
// as the old address. A production build always uses the real addresses.
const devOverride = (value: string | undefined, fallback: string) =>
  process.env.NODE_ENV === "production" ? fallback : value?.trim().replace(/\/+$/, "") || fallback;

export const CANONICAL_ORIGIN = devOverride(process.env.NEXT_PUBLIC_TATESPUN_HOME_ORIGIN, "https://spuntales.net");
export const OLD_ORIGIN = devOverride(process.env.NEXT_PUBLIC_TATESPUN_OLD_ORIGIN, "https://tatespun.pages.dev");

export const MOVE_FORMAT = "tatespun-bookshelf";
export const MOVE_VERSION = 1;

/** Messages between the old address (sender) and spuntales.net (receiver). */
export const MOVE_READY = "tatespun-move-ready";
export const MOVE_WORKS = "tatespun-move-works";
export const MOVE_DONE = "tatespun-move-done";

export function isOldAddress(hostname: string): boolean {
  return hostname === new URL(OLD_ORIGIN).hostname;
}

/** The same page on spuntales.net (path and query kept). */
export function canonicalUrl(location: Pick<Location, "pathname" | "search" | "hash">): string {
  return `${CANONICAL_ORIGIN}${location.pathname}${location.search}${location.hash}`;
}

export interface MovedDocument {
  id: number;
  title: string;
  content: string;
  settings: unknown;
  plotNote?: string;
  updatedAt: number;
  isCollection?: boolean;
  includedDocumentIds?: number[];
  /** Set when the work is this browser's copy of a cloud work. */
  cloudSync?: { projectId: string; updatedAt: string | null; hash: string };
  /** The cloud work it was saved to (lib/cloudLink.ts), if any. */
  cloudLink?: string;
}

export interface MovedTrashItem {
  trashedAt: number;
  document: MovedDocument;
}

export interface MovedImage {
  id: string;
  dataUrl: string;
  createdAt: number;
  layerOrder?: number;
}

export interface BookshelfMovePayload {
  format: typeof MOVE_FORMAT;
  version: typeof MOVE_VERSION;
  exportedAt: number;
  documents: MovedDocument[];
  trash: MovedTrashItem[];
  images: MovedImage[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

function readCloudSync(value: unknown): MovedDocument["cloudSync"] {
  if (!isRecord(value) || typeof value.projectId !== "string" || !value.projectId || typeof value.hash !== "string") return undefined;
  return {
    projectId: value.projectId,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
    hash: value.hash,
  };
}

function readDocument(value: unknown): MovedDocument | null {
  if (!isRecord(value) || typeof value.id !== "number" || !Number.isFinite(value.id)) return null;
  const cloudSync = readCloudSync(value.cloudSync);
  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "",
    content: typeof value.content === "string" ? value.content : "",
    settings: isRecord(value.settings) ? value.settings : {},
    plotNote: typeof value.plotNote === "string" ? value.plotNote : "",
    updatedAt: typeof value.updatedAt === "number" ? value.updatedAt : Date.now(),
    isCollection: value.isCollection === true,
    includedDocumentIds: Array.isArray(value.includedDocumentIds)
      ? value.includedDocumentIds.filter((id): id is number => typeof id === "number")
      : [],
    ...(cloudSync ? { cloudSync } : {}),
    ...(typeof value.cloudLink === "string" && value.cloudLink ? { cloudLink: value.cloudLink } : {}),
  };
}

/** A work with no title, text or plot note is not worth moving (nor a reason to stay). */
export function isEmptyWork(doc: { title?: unknown; content?: unknown; plotNote?: unknown }): boolean {
  const blank = (value: unknown) => typeof value !== "string" || value.trim() === "";
  return blank(doc.title) && blank(doc.content) && blank(doc.plotNote);
}

/**
 * Reads a moved bookshelf (from a message or a file). Anything that is not
 * one is refused (null); damaged entries inside are skipped.
 */
export function readMovePayload(value: unknown): BookshelfMovePayload | null {
  if (!isRecord(value) || value.format !== MOVE_FORMAT || value.version !== MOVE_VERSION) return null;
  if (!Array.isArray(value.documents) || !Array.isArray(value.trash) || !Array.isArray(value.images)) return null;
  const documents = value.documents.map(readDocument).filter((doc): doc is MovedDocument => doc !== null);
  const trash = value.trash
    .map((item) => {
      if (!isRecord(item) || typeof item.trashedAt !== "number") return null;
      const document = readDocument(item.document);
      return document ? { trashedAt: item.trashedAt, document } : null;
    })
    .filter((item): item is MovedTrashItem => item !== null);
  const images = value.images
    .filter((image): image is Record<string, unknown> => isRecord(image))
    .filter((image) => typeof image.id === "string" && typeof image.dataUrl === "string" && image.dataUrl.startsWith("data:"))
    .map((image) => ({
      id: image.id as string,
      dataUrl: image.dataUrl as string,
      createdAt: typeof image.createdAt === "number" ? image.createdAt : Date.now(),
      ...(typeof image.layerOrder === "number" ? { layerOrder: image.layerOrder } : {}),
    }));
  return {
    format: MOVE_FORMAT,
    version: MOVE_VERSION,
    exportedAt: typeof value.exportedAt === "number" ? value.exportedAt : Date.now(),
    documents,
    trash,
    images,
  };
}

/** File name for the 「ファイルに書き出す」 copy (ASCII: some browsers drop a Japanese name and save "download"). */
export function moveFilename(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `tatespun-bookshelf-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.json`;
}
