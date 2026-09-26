/**
 * Phase 7: document-scoped image loading (pure helpers).
 *
 * The editor's `images` pool used to hold EVERY stored image of EVERY local
 * document (`loadAllImages`), and all of it went to each V2 composition. A
 * local document now loads only the ids its manuscript references
 * (`db.loadImagesByIds`). The old pool also silently resolved a marker pasted
 * from another document; `imageIdsToTopUp` keeps that behaviour by fetching
 * such ids on demand, once per document.
 */
export interface StoredImage {
  id: string;
  dataUrl: string;
  layerOrder?: number;
}

/** `images` + `imageLayerOrder` state for a set of stored records. */
export function imageStateFromRecords(records: readonly StoredImage[]): {
  images: Record<string, string>;
  imageLayerOrder: Record<string, number>;
} {
  const images: Record<string, string> = {};
  const imageLayerOrder: Record<string, number> = {};
  for (const record of records) {
    images[record.id] = record.dataUrl;
    if (record.layerOrder !== undefined) imageLayerOrder[record.id] = record.layerOrder;
  }
  return { images, imageLayerOrder };
}

/**
 * Referenced ids that are not in the pool and have not been looked up yet in
 * this document. `attempted` is the caller's per-document memory of ids
 * already fetched (or deliberately left broken, e.g. by a TXT import).
 */
export function imageIdsToTopUp(
  referencedIds: readonly string[],
  images: Readonly<Record<string, string>>,
  attempted: ReadonlySet<string>
): string[] {
  return referencedIds.filter((id) => id !== "" && !Object.hasOwn(images, id) && !attempted.has(id));
}
