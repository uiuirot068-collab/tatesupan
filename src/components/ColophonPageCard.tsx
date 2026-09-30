"use client";

import ColophonPageSurface, { type ColophonPageSurfaceProps } from "./ColophonPageSurface";

export type ColophonPageCardProps = ColophonPageSurfaceProps;

/**
 * LEGACY/fallback entry point. Phase 11 keeps this wrapper available for
 * rollback while the canonical V2 path uses V2ColophonPageCard directly.
 */
export default function ColophonPageCard(props: ColophonPageCardProps) {
  return <ColophonPageSurface {...props} rendererSource="legacy" />;
}
