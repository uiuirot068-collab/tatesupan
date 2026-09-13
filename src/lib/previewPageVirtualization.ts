/**
 * Keep short documents eager: the setup cost of windowing is only worthwhile
 * once the preview extends well beyond a normal viewport.
 *
 * TSP-LEGACY-PREVIEW-VIRTUALIZATION-001: this windowing mechanism (the
 * `PreviewSpread` placeholder/mount pattern, the IntersectionObserver-driven
 * visible set, the zoom-anchor math below) was already fully renderer-
 * agnostic -- it operates on spread layout, not on what a mounted spread's
 * *content* happens to be. It was conservatively gated to V2-only for its
 * initial rollout; that gate is removed here so a large LEGACY manuscript
 * (real documents up to ~700 pages / ~300k DOM elements were measured
 * producing 20-30s main-thread long tasks from full-tree mount/reconcile
 * alone) gets the same bounded, windowed DOM. LEGACY's own raster export
 * (JPG/PDF, real DOM capture) separately force-mounts exactly the pages it
 * needs for the duration of the export -- see `ensureExportMount` in
 * PreviewPane.tsx -- and reverts to windowed view immediately after.
 */
export const PREVIEW_VIRTUALIZATION_MIN_SPREADS = 6;

/** Number of spreads painted before IntersectionObserver reports visibility. */
export const PREVIEW_INITIAL_SPREAD_COUNT = 3;

/** Prepaint roughly one desktop viewport on either side of the scrollport. */
export const PREVIEW_VIRTUALIZATION_OVERSCAN_PX = 1_200;

export function shouldVirtualizePreview(spreadCount: number): boolean {
  return spreadCount > PREVIEW_VIRTUALIZATION_MIN_SPREADS;
}

export function initialPreviewSpreadIndices(spreadCount: number): Set<number> {
  return new Set(
    Array.from(
      { length: Math.min(spreadCount, PREVIEW_INITIAL_SPREAD_COUNT) },
      (_, index) => index
    )
  );
}

export function findPreviewSpreadIndex(
  spreadGroups: readonly (readonly number[])[],
  presentationIndex: number
): number | null {
  if (presentationIndex < 0) return null;
  const spreadIndex = spreadGroups.findIndex((group) => group.includes(presentationIndex));
  return spreadIndex >= 0 ? spreadIndex : null;
}

export interface PreviewSpreadLayout {
  spreadIndex: number;
  top: number;
  height: number;
}

export interface PreviewZoomAnchor {
  spreadIndex: number;
  offsetRatio: number;
}

/**
 * Resolve a viewport point against untransformed spread layout. Points in the
 * flex gap between spreads attach to the nearest spread edge.
 */
export function findPreviewZoomAnchor(
  spreads: readonly PreviewSpreadLayout[],
  logicalViewportY: number
): PreviewZoomAnchor | null {
  let nearest: PreviewSpreadLayout | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const spread of spreads) {
    if (spread.height <= 0) continue;
    const bottom = spread.top + spread.height;
    if (spread.top <= logicalViewportY && logicalViewportY <= bottom) {
      return {
        spreadIndex: spread.spreadIndex,
        offsetRatio: (logicalViewportY - spread.top) / spread.height,
      };
    }

    const distance = logicalViewportY < spread.top
      ? spread.top - logicalViewportY
      : logicalViewportY - bottom;
    if (distance < nearestDistance) {
      nearest = spread;
      nearestDistance = distance;
    }
  }

  if (!nearest) return null;
  return {
    spreadIndex: nearest.spreadIndex,
    offsetRatio: logicalViewportY < nearest.top ? 0 : 1,
  };
}

/** Convert an untransformed spread anchor to the scroll container's CSS-pixel space. */
export function previewZoomScrollTop(
  anchor: PreviewZoomAnchor,
  spread: PreviewSpreadLayout,
  wrapperLayoutTop: number,
  presentationScale: number,
  clientHeight: number
): number {
  const logicalAnchorY = spread.top + spread.height * anchor.offsetRatio;
  return wrapperLayoutTop + logicalAnchorY * presentationScale - clientHeight / 2;
}
