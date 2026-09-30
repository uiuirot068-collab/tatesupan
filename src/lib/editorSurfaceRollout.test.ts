import { describe, expect, it } from "vitest";
import { isWindowedEditorEnabled, resolveEditorSurfaceRolloutMode } from "./editorSurfaceRollout";

describe("internal editor-surface rollout", () => {
  it("uses WINDOWED as the product default when unset or blank", () => {
    expect(resolveEditorSurfaceRolloutMode(undefined)).toBe("WINDOWED");
    expect(resolveEditorSurfaceRolloutMode("")).toBe("WINDOWED");
    expect(resolveEditorSurfaceRolloutMode("   ")).toBe("WINDOWED");
    expect(isWindowedEditorEnabled(undefined)).toBe(true);
  });

  it("keeps explicit FULL as the emergency rollback and fails closed on invalid values", () => {
    expect(resolveEditorSurfaceRolloutMode("WINDOWED")).toBe("WINDOWED");
    expect(isWindowedEditorEnabled("WINDOWED")).toBe(true);
    expect(resolveEditorSurfaceRolloutMode("FULL")).toBe("FULL");
    expect(isWindowedEditorEnabled("FULL")).toBe(false);
    expect(resolveEditorSurfaceRolloutMode("experimental")).toBe("FULL");
  });

  it("is independent of the renderer rollout variable/value", () => {
    // Must never read NEXT_PUBLIC_TATESPUN_RENDERER, and vice versa (see v2Rollout.ts).
    expect(resolveEditorSurfaceRolloutMode("V2_BETA")).toBe("FULL");
  });
});
