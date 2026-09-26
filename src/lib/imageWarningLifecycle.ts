/**
 * Broken-image warning lifecycle (Phase 4) — pure state machine.
 *
 * Two DIFFERENT states, deliberately kept apart:
 *
 * - TECHNICAL state ("can this image be rendered right now?") is owned by the
 *   Editor (`TategakiEditor.unresolvedCloudImages`: manifest missing/expired/
 *   unmanifested and not available in this browser). It clears the moment an
 *   image is repaired or its marker is deleted.
 * - ACKNOWLEDGMENT state ("has the user acknowledged a detected break?") lives
 *   here. A break the user has not acknowledged keeps its footer entry and
 *   keeps blocking export of the affected pages even after the technical
 *   failure is gone, until the user presses 通知解除. A repair is not proof
 *   the user checked the result (the replacement may be the wrong picture, or
 *   a mid-book deletion may have reflowed pages), so an export of those pages
 *   must follow an explicit acknowledgment.
 *
 * Page mapping: each pending warning keeps the LAST-KNOWN body pages of its
 * marker. While the marker exists the mapping follows it; after the marker is
 * deleted the last-known pages are retained so the footer can still say where
 * the break was and the block still covers those pages until acknowledged.
 * (Body page indices come from the Preview page list — LEGACY in V2 mode too,
 * see docs/TATESPUN_V2_CANONICALIZATION_AUDIT.md; not changed here.)
 */

export interface ImageWarningState {
  /** imageId → last-known 0-based BODY page indices of its marker. */
  readonly pending: Readonly<Record<string, readonly number[]>>;
  /** Ids whose "broken at document open" silence was already used (a later re-break announces). */
  readonly silenceUsed: ReadonlySet<string>;
}

export const EMPTY_IMAGE_WARNING_STATE: ImageWarningState = { pending: {}, silenceUsed: new Set() };

/** Acknowledgment state tagged with the document it belongs to (PreviewPane stores it this way). */
export interface ScopedImageWarningState {
  readonly scope: string;
  readonly state: ImageWarningState;
}

/**
 * The warnings of the OPEN document. A store written under another document's
 * scope reads as empty, so switching documents never shows (or blocks export
 * with) the previous document's warnings, and needs no reset effect.
 */
export function imageWarningsForScope(store: ScopedImageWarningState, scope: string): ImageWarningState {
  return store.scope === scope ? store.state : EMPTY_IMAGE_WARNING_STATE;
}

export interface ReconcileInput {
  /** Technically unresolved image ids (cannot be rendered in this browser). */
  unresolvedIds: ReadonlySet<string>;
  /** Current body page indices of every IMG marker in the manuscript. */
  pageIndicesById: ReadonlyMap<string, readonly number[]>;
  /** Ids that were already broken when the document was opened: footer yes, interruption modal no. */
  silentIds?: ReadonlySet<string>;
}

export interface ReconcileResult {
  state: ImageWarningState;
  /** Ids that became pending in this step and should be announced (modal). */
  newlyBrokenIds: string[];
}

const samePages = (a: readonly number[] | undefined, b: readonly number[]) =>
  !!a && a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * Adds every newly unresolved id as a pending warning and refreshes the page
 * mapping of pending ids whose marker still exists. Never removes a warning —
 * only `dismissImageWarnings` does. Returns the SAME state object when nothing
 * changed (safe to call from effects without render loops).
 */
export function reconcileImageWarnings(state: ImageWarningState, input: ReconcileInput): ReconcileResult {
  let pending: Record<string, readonly number[]> | null = null;
  let silenceUsed: Set<string> | null = null;
  const newlyBrokenIds: string[] = [];
  const write = (id: string, pages: readonly number[]) => {
    pending ??= { ...state.pending };
    pending[id] = pages;
  };

  for (const id of input.unresolvedIds) {
    if (id in state.pending) continue;
    // Record a break only once the Preview page list knows where its marker
    // is (it lags the manuscript by its debounce): the warning then always has
    // a page for the footer, the modal and the export block. Every technically
    // unresolved id comes from a manuscript marker, so the page arrives.
    const known = input.pageIndicesById.get(id);
    if (!known || known.length === 0) continue;
    const pages = [...known].sort((a, b) => a - b);
    write(id, pages);
    const silent = input.silentIds?.has(id) && !state.silenceUsed.has(id);
    if (silent) {
      silenceUsed ??= new Set(state.silenceUsed);
      silenceUsed.add(id);
    } else {
      newlyBrokenIds.push(id);
    }
  }
  for (const id of Object.keys(state.pending)) {
    const current = input.pageIndicesById.get(id);
    if (!current || current.length === 0) continue; // marker gone: keep last-known pages
    const sorted = [...current].sort((a, b) => a - b);
    if (!samePages(state.pending[id], sorted)) write(id, sorted);
  }

  if (!pending && !silenceUsed) return { state, newlyBrokenIds };
  return { state: { pending: pending ?? state.pending, silenceUsed: silenceUsed ?? state.silenceUsed }, newlyBrokenIds };
}

export interface DismissResult {
  state: ImageWarningState;
  /** Ids that are still technically broken; when non-empty nothing was dismissed. */
  refused: string[];
}

/**
 * 通知解除. Refused (all-or-nothing, like the footer's per-page button) while
 * any of `ids` is still technically broken; otherwise the warnings — and the
 * export block they carry — are cleared. A later break of the same id is a new
 * warning and is announced again.
 */
export function dismissImageWarnings(state: ImageWarningState, ids: readonly string[], isStillBroken: (id: string) => boolean): DismissResult {
  const refused = ids.filter((id) => id in state.pending && isStillBroken(id));
  if (refused.length > 0) return { state, refused };
  const pending = { ...state.pending };
  let changed = false;
  for (const id of ids) {
    if (id in pending) {
      delete pending[id];
      changed = true;
    }
  }
  if (!changed) return { state, refused: [] };
  const silenceUsed = new Set(state.silenceUsed);
  ids.forEach((id) => silenceUsed.add(id)); // a re-break after acknowledgment always announces
  return { state: { pending, silenceUsed }, refused: [] };
}

export type ImageWarningStatus = "broken" | "repaired" | "deleted";

export interface ImageWarningPage {
  pageIndex: number;
  pageNumber: number;
  imageIds: string[];
}

/** Footer entries, one per affected body page (a page with no known location is listed as page -1). */
export function imageWarningPages(state: ImageWarningState): ImageWarningPage[] {
  const byPage = new Map<number, string[]>();
  for (const [id, pages] of Object.entries(state.pending)) {
    for (const pageIndex of pages.length > 0 ? pages : [-1]) {
      const ids = byPage.get(pageIndex) ?? [];
      ids.push(id);
      byPage.set(pageIndex, ids);
    }
  }
  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([pageIndex, imageIds]) => ({ pageIndex, pageNumber: pageIndex + 1, imageIds: imageIds.sort() }));
}

/** Body page indices whose export is blocked by a pending (unacknowledged) warning. */
export function blockedExportPageIndices(state: ImageWarningState): Set<number> {
  const blocked = new Set<number>();
  Object.values(state.pending).forEach((pages) => pages.forEach((page) => blocked.add(page)));
  return blocked;
}

/** The 1-based body page numbers of `targetPageIndices` that are blocked (empty = export allowed). */
export function affectedExportPageNumbers(targetPageIndices: readonly number[], blocked: ReadonlySet<number>): number[] {
  return [...new Set(targetPageIndices.filter((index) => blocked.has(index)).map((index) => index + 1))].sort((a, b) => a - b);
}

/**
 * Footer status of one pending warning: still broken (replace it), repaired
 * (renders again, press 通知解除), or deleted (marker removed, press 通知解除).
 */
export function imageWarningStatus(input: { technicallyUnresolved: boolean; locallyAvailable: boolean; markerExists: boolean }): ImageWarningStatus {
  if (!input.markerExists) return "deleted";
  return input.technicallyUnresolved && !input.locallyAvailable ? "broken" : "repaired";
}
