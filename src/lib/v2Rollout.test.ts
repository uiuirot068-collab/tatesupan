import { describe, expect, it } from "vitest";
import { resolveRendererRolloutMode } from "./v2Rollout";

describe("internal renderer rollout", () => {
  it("fails closed to legacy when unset or invalid", () => {
    expect(resolveRendererRolloutMode(undefined)).toBe("LEGACY");
    expect(resolveRendererRolloutMode("experimental")).toBe("LEGACY");
  });

  it("activates v2 only for the explicit internal build value", () => {
    expect(resolveRendererRolloutMode("V2_BETA")).toBe("V2_BETA");
    expect(resolveRendererRolloutMode("LEGACY")).toBe("LEGACY");
  });
});
