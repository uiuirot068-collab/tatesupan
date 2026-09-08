import { describe, expect, it } from "vitest";
import { applyFix } from "./applyFix";
import { checkTrailingWhitespace } from "./rules/trailingWhitespace";
import { checkEllipsis } from "./rules/ellipsis";

describe("applyFix", () => {
  it("applies a SAFE_AUTO_FIX diagnostic's suggested replacement", () => {
    const text = "行末に空白がある \n次の行";
    const diagnostic = checkTrailingWhitespace(text)[0];
    const result = applyFix(text, diagnostic);
    expect(result.applied).toBe(true);
    expect(result.text).toBe("行末に空白がある\n次の行");
  });

  it("applies a REVIEW_BEFORE_FIX diagnostic's suggested replacement identically (Fix UI decides which class to surface, not this function)", () => {
    const text = "彼は…黙っていた";
    const diagnostic = checkEllipsis(text)[0];
    const result = applyFix(text, diagnostic);
    expect(result.applied).toBe(true);
    expect(result.text).toBe("彼は……黙っていた");
  });

  it("refuses a NOTICE_ONLY diagnostic with no suggestedReplacement", () => {
    const text = "「未閉じ";
    const diagnostic = { ...checkTrailingWhitespace("x \n")[0], suggestedReplacement: undefined };
    const result = applyFix(text, diagnostic);
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("no-suggested-replacement");
    expect(result.text).toBe(text);
  });

  it("refuses (stale-range) when the current text no longer matches originalText at [start,end)", () => {
    const original = "行末に空白がある \n";
    const diagnostic = checkTrailingWhitespace(original)[0];
    // Simulate the manuscript having changed since the diagnostic was computed.
    const changedText = "行末に空白はもう無い\n";
    const result = applyFix(changedText, diagnostic);
    expect(result.applied).toBe(false);
    expect(result.reason).toBe("stale-range");
    expect(result.text).toBe(changedText); // unmutated
  });
});
