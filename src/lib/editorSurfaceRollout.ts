export type EditorSurfaceRolloutMode = "FULL" | "WINDOWED";

/**
 * Single internal rollout choke point for which EDITOR SURFACE mounts the
 * manuscript textarea (TSP-WINDOWED-EDITOR-PRODUCTION-PARITY-008).
 * Deliberately a SEPARATE env var from `NEXT_PUBLIC_TATESPUN_RENDERER`
 * (see `v2Rollout.ts`) -- the renderer (how Preview/export paint pages) and
 * the editor surface (how the manuscript textarea is mounted) are
 * independent migrations with independent rollback needs; coupling them
 * would force an all-or-nothing rollout of two unrelated risks.
 *
 * Next inlines NEXT_PUBLIC variables at build time, so static hosting needs
 * no server or remote flag service. Unset/unknown values fail closed to
 * FULL (today's single-textarea editor) for immediate rollback.
 */
export function resolveEditorSurfaceRolloutMode(
  configured: string | undefined = process.env.NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE
): EditorSurfaceRolloutMode {
  return configured === "WINDOWED" ? "WINDOWED" : "FULL";
}

export function isWindowedEditorEnabled(configured?: string): boolean {
  return resolveEditorSurfaceRolloutMode(configured) === "WINDOWED";
}
