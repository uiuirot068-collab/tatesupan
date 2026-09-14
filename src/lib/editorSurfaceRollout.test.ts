import { describe, expect, it } from "vitest";
import { isWindowedEditorEnabled, resolveEditorSurfaceRolloutMode } from "./editorSurfaceRollout";

describe("internal editor-surface rollout", () => {
  it("fails closed to the full-document editor when unset or invalid", () => {
    expect(resolveEditorSurfaceRolloutMode(undefined)).toBe("FULL");
    expect(resolveEditorSurfaceRolloutMode("experimental")).toBe("FULL");
    expect(isWindowedEditorEnabled(undefined)).toBe(false);
  });

  it("activates the windowed editor only for the explicit internal build value", () => {
    expect(resolveEditorSurfaceRolloutMode("WINDOWED")).toBe("WINDOWED");
    expect(isWindowedEditorEnabled("WINDOWED")).toBe(true);
    expect(resolveEditorSurfaceRolloutMode("FULL")).toBe("FULL");
  });

  it("is independent of the renderer rollout variable/value", () => {
    // Must never read NEXT_PUBLIC_TATESPUN_RENDERER, and vice versa (see v2Rollout.ts).
    expect(resolveEditorSurfaceRolloutMode("V2_BETA")).toBe("FULL");
  });
});
