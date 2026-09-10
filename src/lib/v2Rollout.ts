export type RendererRolloutMode = "LEGACY" | "V2_BETA";

/**
 * Single internal rollout choke point. Next inlines NEXT_PUBLIC variables at
 * build time, so static hosting needs no server or remote flag service.
 * Unset/unknown values fail closed to LEGACY for immediate rollback.
 */
export function resolveRendererRolloutMode(
  configured: string | undefined = process.env.NEXT_PUBLIC_TATESPUN_RENDERER
): RendererRolloutMode {
  return configured === "V2_BETA" ? "V2_BETA" : "LEGACY";
}

export function isV2BetaRendererEnabled(configured?: string): boolean {
  return resolveRendererRolloutMode(configured) === "V2_BETA";
}
