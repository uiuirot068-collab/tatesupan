/**
 * Phase 12 画像管理センター — the pure model behind the image management
 * dialog (no React, no IndexedDB, no Supabase).
 *
 * It only READS the states the editor already owns and never keeps its own:
 *  - manuscript markers (`imageMarkerSpans`, the tokenizer's own pattern),
 *  - images loaded in this browser (`images`: IndexedDB original or restored
 *    cloud copy),
 *  - the technical cloud state (`CloudImageResolution`: tombstoned / expired →
 *    `missing`, never synced and not on this device → `unmanifested`),
 *  - IndexedDB presence of each original (queried when the dialog opens),
 *  - the canonical page list's image ownership (`pageIndicesById`),
 *  - the image-break warning lifecycle's pending entries (footer / 通知解除).
 * so the footer, the export block and this dialog can never disagree.
 *
 * Edits are marker-range splices only (`removeImageMarkers`): the rest of the
 * manuscript — newlines, ruby, 【改ページ】, TOC headings — is never
 * re-tokenized or re-serialized.
 */
import { imageMarkerSpans, type ImagePosition } from "./tategaki";
import type { CloudImageResolution } from "./cloudImageSync";

/**
 * 正常: shown and exportable in this browser.
 * cloud期限切れ: the cloud copy's 72h ended (or was purged) and this browser has no copy loaded.
 * missing: neither this browser nor the cloud has the image.
 */
export type ImageCenterStatus = "ok" | "cloud-expired" | "missing";

export interface ImageCenterEntry {
  id: string;
  /** 1-based order of first appearance in the manuscript. */
  order: number;
  /** How many markers reference this id (one image placed on several pages). */
  markerCount: number;
  /** Canonical 0-based body page indices owning a marker (sorted). Empty until the page list is canonical. */
  pageIndices: number[];
  widthMm: number;
  heightMm: number;
  position: ImagePosition;
  /** data URL to preview, when this browser has the image. */
  thumbnail: string | null;
  status: ImageCenterStatus;
  /** IndexedDB holds this image's original: true / false / null (not checked yet). */
  localOriginal: boolean | null;
  /**
   * A broken image whose original is still in this browser's IndexedDB: 再同期
   * restores it (and, for a cloud work, re-uploads it and extends the 72h).
   */
  repairable: boolean;
  /** Stored front/back rank (`ImageRecord.layerOrder`), undefined = 標準. */
  layerOrder: number | undefined;
  /** The footer warning lists this image (pending until 通知解除). */
  warningPending: boolean;
}

export interface ImageCenterInventoryInput {
  content: string;
  images: Readonly<Record<string, string>>;
  unresolved: CloudImageResolution | null;
  /** Ids whose original IndexedDB holds; null while not yet checked. */
  localOriginalIds: ReadonlySet<string> | null;
  /** Canonical page ownership; pass an empty map while the page list is provisional. */
  pageIndicesById: ReadonlyMap<string, readonly number[]>;
  imageLayerOrder: Readonly<Record<string, number>>;
  /** Pending image-break warnings (`ImageWarningState.pending`). */
  pendingWarnings: Readonly<Record<string, readonly number[]>>;
}

export function imageCenterStatus(id: string, images: Readonly<Record<string, string>>, unresolved: CloudImageResolution | null): ImageCenterStatus {
  if (images[id]) return "ok";
  if (unresolved?.missing.includes(id)) return "cloud-expired";
  return "missing";
}

export function buildImageCenterInventory(input: ImageCenterInventoryInput): ImageCenterEntry[] {
  const byId = new Map<string, ImageCenterEntry>();
  for (const span of imageMarkerSpans(input.content)) {
    const existing = byId.get(span.id);
    if (existing) {
      existing.markerCount += 1;
      continue;
    }
    const status = imageCenterStatus(span.id, input.images, input.unresolved);
    const localOriginal = input.localOriginalIds ? input.localOriginalIds.has(span.id) : null;
    byId.set(span.id, {
      id: span.id,
      order: byId.size + 1,
      markerCount: 1,
      pageIndices: [...(input.pageIndicesById.get(span.id) ?? [])].sort((a, b) => a - b),
      widthMm: span.widthMm,
      heightMm: span.heightMm,
      position: span.position,
      thumbnail: input.images[span.id] ?? null,
      status,
      localOriginal,
      repairable: status !== "ok" && localOriginal === true,
      layerOrder: input.imageLayerOrder[span.id],
      warningPending: span.id in input.pendingWarnings,
    });
  }
  return [...byId.values()];
}

export interface ImageCenterSummary {
  total: number;
  ok: number;
  broken: number;
  repairable: number;
}

export function summarizeImageCenter(entries: readonly ImageCenterEntry[]): ImageCenterSummary {
  return {
    total: entries.length,
    ok: entries.filter((entry) => entry.status === "ok").length,
    broken: entries.filter((entry) => entry.status !== "ok").length,
    repairable: entries.filter((entry) => entry.repairable).length,
  };
}

/** Label shown for each status (TateSpun wording: 再配置 / 期限切れ). */
export function imageCenterStatusLabel(status: ImageCenterStatus): string {
  switch (status) {
    case "ok":
      return "正常";
    case "cloud-expired":
      return "クラウド保存期限切れ";
    case "missing":
      return "画像が見つかりません";
  }
}

/**
 * Removes every marker of `imageId` from `source` by splicing only the
 * markers' own ranges (back to front, so earlier offsets stay valid). Returns
 * `source` itself when the id has no marker.
 */
export function removeImageMarkers(source: string, imageId: string): string {
  const spans = imageMarkerSpans(source).filter((span) => span.id === imageId);
  if (spans.length === 0) return source;
  let next = source;
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    next = next.slice(0, spans[i].start) + next.slice(spans[i].end);
  }
  return next;
}

/**
 * Whether another local work places `imageId` (the IndexedDB image pool is
 * shared by every work in this browser).
 */
export function imageUsedByOtherWorks(imageId: string, otherWorkContents: Iterable<string>): boolean {
  return !imageOriginalDeletable(imageId, otherWorkContents);
}

/**
 * Whether deleting `imageId` may also remove its IndexedDB original: only
 * when no OTHER local work references it (the image pool is shared by every
 * work in this browser; deleting from one work must never break another).
 */
export function imageOriginalDeletable(imageId: string, otherWorkContents: Iterable<string>): boolean {
  for (const content of otherWorkContents) {
    if (!content.includes(imageId)) continue;
    if (imageMarkerSpans(content).some((span) => span.id === imageId)) return false;
  }
  return true;
}
