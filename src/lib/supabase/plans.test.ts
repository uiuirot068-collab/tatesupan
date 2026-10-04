import { describe, expect, it } from "vitest";
import { CLOUD_PROJECT_LIMITS, cloudPlanFromPortalTier } from "./plans";

// SPN-UNIFY-001: TateSpun's cloud limit follows the SpunTales portal plan.
describe("cloudPlanFromPortalTier", () => {
  it("maps the portal's paid plans to the same TateSpun plans", () => {
    expect(cloudPlanFromPortalTier("light")).toBe("light");
    expect(cloudPlanFromPortalTier("unlimited")).toBe("unlimited");
  });

  it("treats free, a missing profile and anything unknown as the free (resident) limit", () => {
    expect(cloudPlanFromPortalTier("free")).toBe("resident");
    expect(cloudPlanFromPortalTier(undefined)).toBe("resident");
    expect(cloudPlanFromPortalTier(null)).toBe("resident");
    expect(cloudPlanFromPortalTier("gold")).toBe("resident");
    expect(CLOUD_PROJECT_LIMITS[cloudPlanFromPortalTier("free")]).toBe(15);
  });
});
