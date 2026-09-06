import { describe, expect, it } from "vitest";
import { DEFAULT_CLASS } from "./characterClass";
import { DEFAULT_RULE_SET_V2 } from "./defaultRuleSet";

describe("DEFAULT_RULE_SET_V2 — character-class lookup (test group A)", () => {
  it("classifies cl-01 opening brackets as line-end prohibited", () => {
    const cls = DEFAULT_RULE_SET_V2.characterClassFor("「");
    expect(cls.id).toBe("cl-01");
    expect(cls.mayEndLine).toBe(false);
    expect(cls.mayStartLine).toBe(true);
  });

  it("classifies cl-02 closing brackets as line-start prohibited", () => {
    const cls = DEFAULT_RULE_SET_V2.characterClassFor("」");
    expect(cls.id).toBe("cl-02");
    expect(cls.mayStartLine).toBe(false);
    expect(cls.mayEndLine).toBe(true);
  });

  it("classifies cl-06/cl-07 full stops and commas as line-start prohibited", () => {
    expect(DEFAULT_RULE_SET_V2.characterClassFor("。").mayStartLine).toBe(false);
    expect(DEFAULT_RULE_SET_V2.characterClassFor("、").mayStartLine).toBe(false);
  });
});

describe("DEFAULT_RULE_SET_V2 — unknown/default character behavior (test group B)", () => {
  it("falls back to DEFAULT_CLASS (breakable both sides) for ordinary kanji/hiragana/Latin", () => {
    expect(DEFAULT_RULE_SET_V2.characterClassFor("東")).toEqual(DEFAULT_CLASS);
    expect(DEFAULT_RULE_SET_V2.characterClassFor("あ")).toEqual(DEFAULT_CLASS);
    expect(DEFAULT_RULE_SET_V2.characterClassFor("A")).toEqual(DEFAULT_CLASS);
  });

  it("never crashes or invents a strict class for an arbitrary unclassified character", () => {
    expect(() => DEFAULT_RULE_SET_V2.characterClassFor("🍣")).not.toThrow();
    expect(DEFAULT_RULE_SET_V2.characterClassFor("🍣")).toEqual(DEFAULT_CLASS);
  });
});

describe("HG-1 — cl-05 (middle dots) strict line-start prohibition (F04, test group E)", () => {
  it.each(["・", "：", "；"])("prohibits %s at line start under the v2 default RuleSet", (char) => {
    const cls = DEFAULT_RULE_SET_V2.characterClassFor(char);
    expect(cls.id).toBe("cl-05");
    expect(cls.mayStartLine).toBe(false);
  });
});

describe("HG-2 — cl-12/cl-13 (pre/postfixed abbreviations) strict line-start prohibition (F05, test group F)", () => {
  it.each(["￥", "＄", "￡", "＃"])("prohibits %s (cl-12) at line start under the v2 default RuleSet", (char) => {
    const cls = DEFAULT_RULE_SET_V2.characterClassFor(char);
    expect(cls.id).toBe("cl-12");
    expect(cls.mayStartLine).toBe(false);
  });

  it.each(["°", "′", "″", "℃", "￠", "％", "‰"])(
    "prohibits %s (cl-13) at line start under the v2 default RuleSet",
    (char) => {
      const cls = DEFAULT_RULE_SET_V2.characterClassFor(char);
      expect(cls.id).toBe("cl-13");
      expect(cls.mayStartLine).toBe(false);
    }
  );
});

describe("cl-08 pair rule (dash/ellipsis identity, not class, keying)", () => {
  it("treats same-kind pairs as INSEPARABLE", () => {
    expect(DEFAULT_RULE_SET_V2.cl08PairRule("DASH", "DASH")).toBe("INSEPARABLE");
    expect(DEFAULT_RULE_SET_V2.cl08PairRule("ELLIPSIS", "ELLIPSIS")).toBe("INSEPARABLE");
    expect(DEFAULT_RULE_SET_V2.cl08PairRule("TWO_DOT_LEADER", "TWO_DOT_LEADER")).toBe("INSEPARABLE");
  });

  it("treats different-kind pairs as SEPARABLE, even though both are cl-08", () => {
    expect(DEFAULT_RULE_SET_V2.cl08PairRule("DASH", "ELLIPSIS")).toBe("SEPARABLE");
  });
});

describe("hanging-punctuation scope and ruby-overhang residual", () => {
  it("scopes hanging punctuation to cl-06/cl-07 only, per jlreq", () => {
    expect(DEFAULT_RULE_SET_V2.hangingPunctuationScope).toEqual(["cl-06", "cl-07"]);
  });

  it("ships an empty ruby-overhang table rather than fabricating values (HG-4 row 22b, still OPEN)", () => {
    expect(DEFAULT_RULE_SET_V2.rubyOverhangAllowance.size).toBe(0);
  });
});

describe("determinism (test group P / INV-005 foundation)", () => {
  it("returns the identical class for repeated lookups of the same character", () => {
    const results = Array.from({ length: 5 }, () => DEFAULT_RULE_SET_V2.characterClassFor("、"));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
  });
});
