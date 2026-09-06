import { describe, expect, it } from "vitest";
import { assertGraphemeSafeSpan, codePointSlice, GraphemeSafetyError } from "../source/graphemeSafety";
import type { SourceSpan } from "../source/span";
import type {
  ImageUnit,
  LogicalUnit,
  ManualBreakUnit,
  ParagraphBreakUnit,
  RubyUnit,
  SemanticRunUnit,
  TCYUnit,
  TextUnit,
} from "./index";

// Exhaustive switch: if a LogicalUnit kind is ever added or removed without
// updating this function, TypeScript fails to compile (the `never` branch),
// which is the type-check proof that all seven kinds discriminate correctly.
function describeUnit(unit: LogicalUnit): string {
  switch (unit.kind) {
    case "TEXT":
      return `TEXT:${unit.text}`;
    case "RUBY":
      return `RUBY:${unit.rubyKind}`;
    case "TCY":
      return `TCY:${unit.displayText}`;
    case "SEMANTIC_RUN":
      return `SEMANTIC_RUN:${unit.runKind}`;
    case "MANUAL_BREAK":
      return "MANUAL_BREAK";
    case "IMAGE":
      return `IMAGE:${unit.refId}`;
    case "PARAGRAPH_BREAK":
      return "PARAGRAPH_BREAK";
    default: {
      const exhaustive: never = unit;
      throw new Error(`Unreachable — unhandled LogicalUnit kind: ${JSON.stringify(exhaustive)}`);
    }
  }
}

describe("LogicalUnit discriminated union", () => {
  it("discriminates all seven kinds by `kind`", () => {
    const span: SourceSpan = { blockId: "body-1", start: 0, end: 2 };

    const text: TextUnit = { kind: "TEXT", span, text: "東京" };
    const ruby: RubyUnit = {
      kind: "RUBY",
      span,
      rubyKind: "ATOMIC",
      baseSpan: span,
      readingSpan: span,
    };
    const tcy: TCYUnit = { kind: "TCY", span, displayText: "12", logicalCells: 1 };
    const semanticRun: SemanticRunUnit = { kind: "SEMANTIC_RUN", span, runKind: "DASH", length: 2 };
    const manualBreak: ManualBreakUnit = { kind: "MANUAL_BREAK", span };
    const image: ImageUnit = {
      kind: "IMAGE",
      span,
      refId: "cover-sketch",
      intrinsicWidth: 800000,
      intrinsicHeight: 600000,
      placement: "CENTER",
    };
    const paragraphBreak: ParagraphBreakUnit = { kind: "PARAGRAPH_BREAK", span };

    const units: LogicalUnit[] = [text, ruby, tcy, semanticRun, manualBreak, image, paragraphBreak];
    expect(units.map(describeUnit)).toEqual([
      "TEXT:東京",
      "RUBY:ATOMIC",
      "TCY:12",
      "SEMANTIC_RUN:DASH",
      "MANUAL_BREAK",
      "IMAGE:cover-sketch",
      "PARAGRAPH_BREAK",
    ]);
  });

  it("supports a JUKUGO RubyUnit with explicit segments, never fabricating a split", () => {
    const baseSpan: SourceSpan = { blockId: "body-1", start: 0, end: 4 };
    const readingSpan: SourceSpan = { blockId: "body-1", start: 10, end: 15 };
    const jukugo: RubyUnit = {
      kind: "RUBY",
      span: { blockId: "body-1", start: 0, end: 4 },
      rubyKind: "JUKUGO",
      baseSpan,
      readingSpan,
      segments: [
        { baseSpan: { blockId: "body-1", start: 0, end: 2 }, readingSpan: { blockId: "body-1", start: 10, end: 12 } },
        { baseSpan: { blockId: "body-1", start: 2, end: 4 }, readingSpan: { blockId: "body-1", start: 12, end: 15 } },
      ],
    };
    expect(jukugo.segments).toHaveLength(2);

    // A JUKUGO unit with no segments is a valid, type-checking shape too —
    // the Core (P3-L11) treats it as ATOMIC by default rather than guessing;
    // this Loop only proves the type permits the absent case, no logic.
    const unsegmented: RubyUnit = {
      kind: "RUBY",
      span: baseSpan,
      rubyKind: "JUKUGO",
      baseSpan,
      readingSpan,
    };
    expect(unsegmented.segments).toBeUndefined();
  });
});

describe("LogicalUnit source mapping (INV-001) and grapheme safety (INV-011)", () => {
  const sourceBlockText = "東京は日本の首都です。";

  it("preserves a TextUnit's SourceSpan and recovers the original substring exactly", () => {
    const span: SourceSpan = { blockId: "body-1", start: 0, end: 2 };
    const unit: TextUnit = { kind: "TEXT", span, text: codePointSlice(sourceBlockText, span.start, span.end) };

    expect(unit.span).toEqual(span); // span survives unmodified through construction
    expect(unit.text).toBe("東京");
    expect(codePointSlice(sourceBlockText, unit.span.start, unit.span.end)).toBe(unit.text);
  });

  it("accepts a TextUnit whose span lands on grapheme-safe boundaries", () => {
    const mixedText = "A\u{20000}東"; // 'A' + non-BMP ideograph + '東', 3 code points
    const span: SourceSpan = { blockId: "body-1", start: 1, end: 2 };
    const unit: TextUnit = { kind: "TEXT", span, text: codePointSlice(mixedText, span.start, span.end) };

    expect(() => assertGraphemeSafeSpan(mixedText, unit.span)).not.toThrow();
    expect(unit.text).toBe("\u{20000}");
  });

  it("rejects (via graphemeSafety, not silently) a span that would fracture a grapheme cluster", () => {
    const combiningText = "é"; // "é" as base + combining mark, one grapheme, two code points
    const fracturedSpan: SourceSpan = { blockId: "body-1", start: 0, end: 1 };

    expect(() => assertGraphemeSafeSpan(combiningText, fracturedSpan)).toThrow(GraphemeSafetyError);
  });
});
