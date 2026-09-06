import { describe, expect, it } from "vitest";
import { createTraceRecorder } from "../trace";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import type { SourceSpan } from "../source/span";
import type {
  ImageUnit,
  LogicalUnit,
  ManualBreakUnit,
  RubyUnit,
  SemanticRunUnit,
  TCYUnit,
  TextUnit,
} from "../units";
import { deriveBreakOpportunities } from "./opportunity";

const BLOCK = "body-1";

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}

function text(t: string, start: number): TextUnit {
  return { kind: "TEXT", span: span(start, start + Array.from(t).length), text: t };
}

describe("F02 — line-start prohibited punctuation (test group C)", () => {
  it("prohibits a break immediately before a cl-07 comma", () => {
    const unit = text("abc、def", 0);
    const opportunities = deriveBreakOpportunities([unit], DEFAULT_RULE_SET_V2);
    const beforeComma = opportunities.find((o) => o.position.start === 3);
    expect(beforeComma?.reason).toBe("PROHIBITED_KINSOKU");
  });
});

describe("F03 — line-end prohibited opening bracket (test group D)", () => {
  it("prohibits a break immediately after a cl-01 opening bracket regardless of the following character", () => {
    const unit = text("abc「def", 0);
    const opportunities = deriveBreakOpportunities([unit], DEFAULT_RULE_SET_V2);
    const afterBracket = opportunities.find((o) => o.position.start === 4);
    expect(afterBracket?.reason).toBe("PROHIBITED_KINSOKU");
  });
});

describe("F11 — dash semantic run keep-together (test group G)", () => {
  it("prohibits the boundary between two adjacent same-kind DASH runs", () => {
    const dash1: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(0, 1), runKind: "DASH", length: 1 };
    const dash2: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(1, 2), runKind: "DASH", length: 1 };
    const opportunities = deriveBreakOpportunities([dash1, dash2], DEFAULT_RULE_SET_V2);
    expect(opportunities).toEqual([{ position: span(1, 1), reason: "PROHIBITED_GROUP" }]);
  });

  it("allows the boundary between a different-kind cl-08 pair (dash then ellipsis)", () => {
    const dash: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(0, 1), runKind: "DASH", length: 1 };
    const ellipsis: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(1, 2), runKind: "ELLIPSIS", length: 1 };
    const opportunities = deriveBreakOpportunities([dash, ellipsis], DEFAULT_RULE_SET_V2);
    expect(opportunities).toEqual([{ position: span(1, 1), reason: "ALLOWED" }]);
  });
});

describe("F12 — ellipsis semantic run keep-together (test group H)", () => {
  it("prohibits the boundary between two adjacent same-kind ELLIPSIS runs", () => {
    const e1: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(0, 1), runKind: "ELLIPSIS", length: 1 };
    const e2: SemanticRunUnit = { kind: "SEMANTIC_RUN", span: span(1, 2), runKind: "ELLIPSIS", length: 1 };
    const opportunities = deriveBreakOpportunities([e1, e2], DEFAULT_RULE_SET_V2);
    expect(opportunities).toEqual([{ position: span(1, 1), reason: "PROHIBITED_GROUP" }]);
  });
});

describe("F07 — atomic/group ruby never internally breaks (INV-007, test group I)", () => {
  it("generates zero internal opportunities for an ATOMIC RubyUnit", () => {
    const ruby: RubyUnit = {
      kind: "RUBY",
      span: span(0, 2),
      rubyKind: "ATOMIC",
      baseSpan: span(0, 2),
      readingSpan: span(10, 15),
    };
    expect(deriveBreakOpportunities([ruby], DEFAULT_RULE_SET_V2)).toEqual([]);
  });
});

describe("F08 — jukugo explicit legal internal boundary (test group J/K)", () => {
  it("generates exactly one RUBY_INTERNAL_ALLOWED opportunity at a declared 2-segment boundary", () => {
    const jukugo: RubyUnit = {
      kind: "RUBY",
      span: span(0, 4),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 4),
      readingSpan: span(10, 15),
      segments: [
        { baseSpan: span(0, 2), readingSpan: span(10, 12) },
        { baseSpan: span(2, 4), readingSpan: span(12, 15) },
      ],
    };
    const opportunities = deriveBreakOpportunities([jukugo], DEFAULT_RULE_SET_V2);
    expect(opportunities).toEqual([{ position: span(2, 2), reason: "RUBY_INTERNAL_ALLOWED" }]);
  });

  it("generates exactly N-1 opportunities for N declared segments, never more", () => {
    const jukugo: RubyUnit = {
      kind: "RUBY",
      span: span(0, 6),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 6),
      readingSpan: span(10, 18),
      segments: [
        { baseSpan: span(0, 2), readingSpan: span(10, 12) },
        { baseSpan: span(2, 4), readingSpan: span(12, 15) },
        { baseSpan: span(4, 6), readingSpan: span(15, 18) },
      ],
    };
    const opportunities = deriveBreakOpportunities([jukugo], DEFAULT_RULE_SET_V2);
    expect(opportunities).toHaveLength(2);
    expect(opportunities.map((o) => o.position.start)).toEqual([2, 4]);
    expect(opportunities.every((o) => o.reason === "RUBY_INTERNAL_ALLOWED")).toBe(true);
  });

  it("generates zero opportunities for an undeclared (segments-absent) JUKUGO — never guesses a split", () => {
    const unsegmented: RubyUnit = {
      kind: "RUBY",
      span: span(0, 4),
      rubyKind: "JUKUGO",
      baseSpan: span(0, 4),
      readingSpan: span(10, 15),
    };
    expect(deriveBreakOpportunities([unsegmented], DEFAULT_RULE_SET_V2)).toEqual([]);
  });
});

describe("F10 — explicit TCY unit is one atomic composition group (test group L)", () => {
  it("generates no internal opportunity inside a TCYUnit, and an ordinary boundary with neighbors", () => {
    const before: TextUnit = text("あ", 0);
    const tcy: TCYUnit = { kind: "TCY", span: span(1, 3), displayText: "12", logicalCells: 1 };
    const after: TextUnit = text("い", 3);
    const opportunities = deriveBreakOpportunities([before, tcy, after], DEFAULT_RULE_SET_V2);
    // Exactly two boundaries (before<->tcy, tcy<->after); none internal to the TCY unit itself.
    expect(opportunities).toHaveLength(2);
    expect(opportunities.map((o) => o.position.start)).toEqual([1, 3]);
    expect(opportunities.every((o) => o.reason === "ALLOWED")).toBe(true);
  });
});

describe("F13 — manual page break is always forced (INV-006, test group M)", () => {
  it("generates a MANUAL_FORCED opportunity at the ManualBreakUnit's own position", () => {
    const before: TextUnit = text("あ", 0);
    const manualBreak: ManualBreakUnit = { kind: "MANUAL_BREAK", span: span(1, 1) };
    const after: TextUnit = text("い", 1);
    const opportunities = deriveBreakOpportunities([before, manualBreak, after], DEFAULT_RULE_SET_V2);
    const forced = opportunities.filter((o) => o.reason === "MANUAL_FORCED");
    expect(forced).toEqual([{ position: span(1, 1), reason: "MANUAL_FORCED" }]);
  });
});

describe("Source mapping uses Unicode code-point offsets, never UTF-16 (INV-001, test group N)", () => {
  it("reports a candidate boundary offset in code points even when a non-BMP character precedes it", () => {
    // 'A' (1 code point) + non-BMP CJK Ext-B ideograph (1 code point, 1 UTF-16
    // surrogate pair) + '、' (1 code point) = 3 code points, source span [0,3).
    const unit = text("A\u{20000}、", 0);
    const opportunities = deriveBreakOpportunities([unit], DEFAULT_RULE_SET_V2);
    // Two code-point-indexed internal boundaries exist: offset 1 (between
    // 'A' and the non-BMP char, ALLOWED) and offset 2 (between the non-BMP
    // char and '、', PROHIBITED_KINSOKU) — at code-point offset 2, NOT the
    // UTF-16 offset 3 a naive .length-based implementation would report.
    expect(opportunities.map((o) => o.position.start)).toEqual([1, 2]);
    const beforeComma = opportunities.find((o) => o.position.start === 2);
    expect(beforeComma?.reason).toBe("PROHIBITED_KINSOKU");
  });
});

describe("Grapheme-interior boundaries are never generated as candidates (INV-011, test group O)", () => {
  it("never produces a candidate inside a base+combining-mark sequence", () => {
    const unit = text("éと", 0); // "e" + COMBINING ACUTE ACCENT (one grapheme) + "と"
    const opportunities = deriveBreakOpportunities([unit], DEFAULT_RULE_SET_V2);
    // Only one internal boundary exists: between the combining-mark grapheme
    // (code points 0-2) and "と" (code point 2-3) — never at offset 1, which
    // would fall inside the grapheme cluster.
    expect(opportunities.map((o) => o.position.start)).toEqual([2]);
  });
});

describe("Determinism (INV-005, test group P)", () => {
  it("produces identical output across repeated runs on the same input", () => {
    const units: LogicalUnit[] = [text("abc、def「ghi", 0)];
    const first = deriveBreakOpportunities(units, DEFAULT_RULE_SET_V2);
    const second = deriveBreakOpportunities(units, DEFAULT_RULE_SET_V2);
    expect(second).toEqual(first);
  });
});

describe("Trace is observational only (Contract §23)", () => {
  it("produces byte-identical BreakOpportunity output with or without a trace recorder", () => {
    const units: LogicalUnit[] = [text("abc、def「ghi", 0)];
    const withoutTrace = deriveBreakOpportunities(units, DEFAULT_RULE_SET_V2);
    const recorder = createTraceRecorder();
    const withTrace = deriveBreakOpportunities(units, DEFAULT_RULE_SET_V2, recorder);
    expect(withTrace).toEqual(withoutTrace);
    expect(recorder.trace.events.length).toBeGreaterThan(0);
  });

  it("records a stable rule/reason id in each trace event's outcome (test group Q)", () => {
    const units: LogicalUnit[] = [text("abc、def", 0)];
    const recorder = createTraceRecorder();
    deriveBreakOpportunities(units, DEFAULT_RULE_SET_V2, recorder);
    const kinsokuEvent = recorder.trace.events.find((e) => e.sourceSpan.start === 3);
    expect(kinsokuEvent?.outcome).toBe("PROHIBITED_KINSOKU");
    expect(kinsokuEvent?.ruleApplied).toContain("cl-07");
  });
});

describe("ImageUnit boundaries are class-neutral (no ordinary text edge to consult)", () => {
  it("treats an ImageUnit's outer edges as breakable by default", () => {
    const before: TextUnit = text("あ", 0);
    const image: ImageUnit = {
      kind: "IMAGE",
      span: span(1, 2),
      refId: "cover",
      intrinsicWidth: 800000,
      intrinsicHeight: 600000,
      placement: "CENTER",
    };
    const opportunities = deriveBreakOpportunities([before, image], DEFAULT_RULE_SET_V2);
    expect(opportunities).toEqual([{ position: span(1, 1), reason: "ALLOWED" }]);
  });
});
