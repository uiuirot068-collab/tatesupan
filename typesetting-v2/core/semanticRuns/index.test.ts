import { describe, expect, it } from "vitest";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import { semanticRunPairRule } from "./index";

describe("semanticRunPairRule — cl-08 same-kind inseparability (Contract §11)", () => {
  it("forwards to the RuleSetVersion's own cl08PairRule, not a second competing decision", () => {
    expect(semanticRunPairRule(DEFAULT_RULE_SET_V2, "DASH", "DASH")).toBe(
      DEFAULT_RULE_SET_V2.cl08PairRule("DASH", "DASH")
    );
  });

  it("treats same-kind pairs as INSEPARABLE for all three cl-08 identities", () => {
    expect(semanticRunPairRule(DEFAULT_RULE_SET_V2, "DASH", "DASH")).toBe("INSEPARABLE");
    expect(semanticRunPairRule(DEFAULT_RULE_SET_V2, "ELLIPSIS", "ELLIPSIS")).toBe("INSEPARABLE");
    expect(semanticRunPairRule(DEFAULT_RULE_SET_V2, "TWO_DOT_LEADER", "TWO_DOT_LEADER")).toBe("INSEPARABLE");
  });

  it("treats a different-kind pair as SEPARABLE even though both are cl-08 members", () => {
    expect(semanticRunPairRule(DEFAULT_RULE_SET_V2, "DASH", "ELLIPSIS")).toBe("SEPARABLE");
  });
});
