export type RendererRolloutMode = "LEGACY" | "V2_BETA";

/**
 * Single renderer rollout choke point.
 *
 * 2026-09-24 public RC: V2_BETA is now the default when the build variable is
 * unset. An explicit LEGACY value remains the emergency rollback switch.
 * Unknown non-empty values still fail closed to LEGACY rather than silently
 * enabling an unintended renderer.
 */
export function resolveRendererRolloutMode(
  configured: string | undefined = process.env.NEXT_PUBLIC_TATESPUN_RENDERER
): RendererRolloutMode {
  const normalized = configured?.trim();
  if (!normalized) return "V2_BETA";
  return normalized === "V2_BETA" ? "V2_BETA" : "LEGACY";
}

export function isV2BetaRendererEnabled(configured?: string): boolean {
  return resolveRendererRolloutMode(configured) === "V2_BETA";
}
