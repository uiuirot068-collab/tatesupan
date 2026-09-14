import { describe, expect, it } from "vitest";
import {
  resolvePostFixCaretTarget,
  WRITING_CHECK_POST_FIX_NAVIGATION,
} from "./writingCheckPostFixNavigation";

describe("writing check post-fix navigation policy", () => {
  it("defaults to RETURN_TO_PREVIOUS (the current Human-QA-approved behavior)", () => {
    expect(WRITING_CHECK_POST_FIX_NAVIGATION).toBe("RETURN_TO_PREVIOUS");
  });

  it("RETURN_TO_PREVIOUS resolves to no explicit navigation", () => {
    expect(resolvePostFixCaretTarget("RETURN_TO_PREVIOUS", { start: 100, replacementLength: 3 })).toBeNull();
    expect(resolvePostFixCaretTarget("RETURN_TO_PREVIOUS", { start: 0, replacementLength: 0 })).toBeNull();
  });

  it("STAY_AT_FIXED_LOCATION resolves to the offset right after the replacement text", () => {
    expect(resolvePostFixCaretTarget("STAY_AT_FIXED_LOCATION", { start: 100, replacementLength: 3 })).toBe(103);
  });

  it("STAY_AT_FIXED_LOCATION handles a replacement that deletes text entirely (zero-length)", () => {
    expect(resolvePostFixCaretTarget("STAY_AT_FIXED_LOCATION", { start: 50, replacementLength: 0 })).toBe(50);
  });
});
