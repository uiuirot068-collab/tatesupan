/**
 * Keep short documents eager: the setup cost of windowing is only worthwhile
 * once the preview extends well beyond a normal viewport.
 */
export const PREVIEW_VIRTUALIZATION_MIN_SPREADS = 6;

/** Number of spreads painted before IntersectionObserver reports visibility. */
export const PREVIEW_INITIAL_SPREAD_COUNT = 3;

/** Prepaint roughly one desktop viewport on either side of the scrollport. */
export const PREVIEW_VIRTUALIZATION_OVERSCAN_PX = 1_200;

export function shouldVirtualizePreview(
  spreadCount: number,
  v2PreviewEnabled: boolean
): boolean {
  return v2PreviewEnabled && spreadCount > PREVIEW_VIRTUALIZATION_MIN_SPREADS;
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
