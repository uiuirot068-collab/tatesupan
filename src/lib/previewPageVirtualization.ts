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
