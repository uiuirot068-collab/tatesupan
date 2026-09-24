import { describe, expect, it } from "vitest";
import { resolveRendererRolloutMode } from "./v2Rollout";

describe("renderer rollout", () => {
  it("defaults to V2_BETA for the 2026-09-24 public RC when unset", () => {
    expect(resolveRendererRolloutMode(undefined)).toBe("V2_BETA");
    expect(resolveRendererRolloutMode("")).toBe("V2_BETA");
    expect(resolveRendererRolloutMode("   ")).toBe("V2_BETA");
  });

  it("keeps an explicit LEGACY value as the emergency rollback switch", () => {
    expect(resolveRendererRolloutMode("LEGACY")).toBe("LEGACY");
  });

  it("accepts the explicit V2_BETA value and fails closed on unknown non-empty values", () => {
    expect(resolveRendererRolloutMode("V2_BETA")).toBe("V2_BETA");
    expect(resolveRendererRolloutMode("experimental")).toBe("LEGACY");
  });
});
