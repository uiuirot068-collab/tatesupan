import { describe, expect, it } from "vitest";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type { RubyUnit } from "../units";
import { deriveBreakOpportunities } from "../breaks/opportunity";
import { deriveRubyBreakOpportunities, placeRuby, resolveOverhangAllowance } from "./index";

const BLOCK = "body-1";

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}

describe("F07 — atomic/group ruby is fully unbroken (INV-007)", () => {
  it("generates zero break opportunities for an ATOMIC RubyUnit", () => {
    const ruby: RubyUnit = {
      kind: "RUBY",
      span: span(0, 2),
      rubyKind: "ATOMIC",
      baseSpan: span(0, 2),
      readingSpan: span(10, 15),
      readingText: "よみかた",
    };
    expect(deriveRubyBreakOpportunities(ruby)).toEqual([]);
    // Exercised through the full pipeline too, not just the ruby module in isolation.
    expect(deriveBreakOpportunities([ruby], DEFAULT_RULE_SET_V2)).toEqual([]);
  });
});

describe("F08 — jukugo with explicit segments breaks only at declared boundaries (INV-008)", () => {
  it("generates exactly one RUBY_INTERNAL_ALLOWED opportunity per declared segment boundary", () => {
    const jukugo: RubyUnit = {
      kind: "RUBY",
      span: span(0, 4),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 4),
      readingSpan: span(10, 15),
      readingText: "よみかた",
      segments: [
        { baseSpan: span(0, 2), readingSpan: span(10, 12), readingText: "よみ" },
        { baseSpan: span(2, 4), readingSpan: span(12, 15), readingText: "かた" },
      ],
    };
    expect(deriveRubyBreakOpportunities(jukugo)).toEqual([{ position: span(2, 2), reason: "RUBY_INTERNAL_ALLOWED" }]);
  });

  it("never generates an opportunity at an undeclared (intra-segment) position", () => {
    const jukugo: RubyUnit = {
      kind: "RUBY",
      span: span(0, 6),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 6),
      readingSpan: span(10, 18),
      readingText: "よみかたがな",
      segments: [
        { baseSpan: span(0, 3), readingSpan: span(10, 13), readingText: "よみか" },
        { baseSpan: span(3, 6), readingSpan: span(13, 18), readingText: "たがな" },
      ],
    };
    const opportunities = deriveRubyBreakOpportunities(jukugo);
    // Only the declared boundary at offset 3 -- never offsets 1, 2, 4, or 5.
    expect(opportunities.map((o) => o.position.start)).toEqual([3]);
  });
});

describe("Missing-segments fallback: never a guessed split (P3-O14)", () => {
  it("treats a JUKUGO ruby with no segments array as ATOMIC — zero opportunities", () => {
    const unsegmented: RubyUnit = {
      kind: "RUBY",
      span: span(0, 4),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 4),
      readingSpan: span(10, 15),
      readingText: "よみかた",
    };
    expect(deriveRubyBreakOpportunities(unsegmented)).toEqual([]);
  });

  it("treats a JUKUGO ruby with a single-element segments array as ATOMIC too (no boundary possible)", () => {
    const oneSegment: RubyUnit = {
      kind: "RUBY",
      span: span(0, 2),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 2),
      readingSpan: span(10, 12),
      readingText: "よみ",
      segments: [{ baseSpan: span(0, 2), readingSpan: span(10, 12), readingText: "よみ" }],
    };
    expect(deriveRubyBreakOpportunities(oneSegment)).toEqual([]);
  });
});

describe("F09 — overlong ruby engages the geometry clamp (Contract §9.1)", () => {
  it("centers the reading when it fits within the base extent", () => {
    const result = placeRuby({
      baseExtentTick: 10000,
      readingExtentTick: 6000,
      overhangAllowanceBeforeTick: 0,
      overhangAllowanceAfterTick: 0,
    });
    expect(result.policy).toBe("CENTER");
    expect(result.readingOffsetTick).toBe(2000); // (10000-6000)/2, centered
  });

  it("engages OVERFLOW_OPEN when the reading overflows and the shipped overhang table is all-zero (HG-4 residual, P3-O06 OPEN)", () => {
    // DEFAULT_RULE_SET_V2 ships an empty overhang table -- confirm that
    // resolving any adjacent class from it yields 0, never a fabricated value.
    expect(resolveOverhangAllowance(DEFAULT_RULE_SET_V2, "cl-19")).toBe(0);

    const result = placeRuby({
      baseExtentTick: 2000,
      readingExtentTick: 5000,
      overhangAllowanceBeforeTick: resolveOverhangAllowance(DEFAULT_RULE_SET_V2, "cl-19"),
      overhangAllowanceAfterTick: resolveOverhangAllowance(DEFAULT_RULE_SET_V2, "cl-19"),
    });
    expect(result.policy).toBe("OVERFLOW_OPEN");
  });

  it("engages START_CLAMP when only the preceding side has enough allowance to absorb the overflow", () => {
    const result = placeRuby({
      baseExtentTick: 2000,
      readingExtentTick: 3000, // 1000 overflow
      overhangAllowanceBeforeTick: 1000, // fully absorbs it
      overhangAllowanceAfterTick: 0,
    });
    expect(result.policy).toBe("START_CLAMP");
    expect(result.readingOffsetTick).toBe(-1000);
  });

  it("engages END_CLAMP when only the following side has enough allowance to absorb the overflow", () => {
    const result = placeRuby({
      baseExtentTick: 2000,
      readingExtentTick: 3000,
      overhangAllowanceBeforeTick: 0,
      overhangAllowanceAfterTick: 1000,
    });
    expect(result.policy).toBe("END_CLAMP");
  });

  it("never moves the base — placeRuby has no base-coordinate output at all (INV-003)", () => {
    const result = placeRuby({
      baseExtentTick: 2000,
      readingExtentTick: 5000,
      overhangAllowanceBeforeTick: 0,
      overhangAllowanceAfterTick: 0,
    });
    expect(Object.keys(result)).toEqual(["policy", "readingOffsetTick"]);
  });
});

describe("Determinism (INV-005 foundation)", () => {
  it("produces identical placement decisions across repeated calls", () => {
    const input = { baseExtentTick: 2000, readingExtentTick: 5000, overhangAllowanceBeforeTick: 0, overhangAllowanceAfterTick: 0 };
    expect(placeRuby(input)).toEqual(placeRuby(input));
  });
});
