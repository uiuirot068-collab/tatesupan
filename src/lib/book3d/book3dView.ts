/**
 * Shared 3D book camera contract.
 * CST-PORT-012: copied from COLUMNSTAND `src/lib/book3dView.ts` unchanged.
 * Pure values only — presentation, never print geometry.
 */
export type Book3DView = { yaw: number; pitch: number };

export const BOOK3D_FRONT_VIEW: Book3DView = { yaw: 0, pitch: 0 };
export const BOOK3D_PITCH_LIMIT = 24;
export const BOOK3D_ZOOM_MIN = 0.5;
export const BOOK3D_ZOOM_MAX = 2;

export function clampPitch(value: number): number {
  return Math.max(-BOOK3D_PITCH_LIMIT, Math.min(BOOK3D_PITCH_LIMIT, value));
}

/** Normalises yaw to (-180, 180]. */
export function normalizeYaw(value: number): number {
  const wrapped = ((((value + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

/** A 3/4 view that shows the spine side of this particular book. */
export function initialBook3DView(spineEdge: "left" | "right"): Book3DView {
  return { yaw: spineEdge === "right" ? -32 : 32, pitch: -8 };
}

/** Camera yaw that looks straight at the spine. */
export function spineViewYaw(spineEdge: "left" | "right"): number {
  return spineEdge === "right" ? -90 : 90;
}
