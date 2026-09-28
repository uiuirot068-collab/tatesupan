// Long-paragraph composition must stay linear and exactly equal to the
// original line-by-line algorithm (docs/TATESPUN_CORE_LONG_PARAGRAPH_PERFORMANCE.md).
// No wall-clock assertions: the regression signals are operation counts
// (code points materialized by Array.from(string)) and output equality
// against a verbatim copy of the pre-optimization column/page driver.

import { describe, expect, it } from "vitest";
import { createFakeMeasurementProvider } from "../measurement/fakeProvider";
import { DEFAULT_RULE_SET_V2 } from "../rules/defaultRuleSet";
import { codePointLength, codePointSlice, codePointSuffix } from "../source/graphemeSafety";
import type { SourceSpan } from "../source/span";
import type { LogicalUnit, TextUnit } from "../units";
import type { CanonicalPage } from "../layout/schema";
import { composeLine, prepareLineComposition, type PreparedLineComposition } from "./line";
import { composePages, type PageCompositionSettings } from "./page";

const BLOCK = "body-1";
const measurement = createFakeMeasurementProvider();
const CELL = measurement.naturalAdvanceTick("body", 10, "");
const settings: PageCompositionSettings = {
  bodyFontRef: "body",
  bodyFontSizePt: 10,
  lineExtentTicks: CELL * 37,
  linePitchTicks: CELL,
  columnExtentTicks: CELL * 16,
  columnsPerPage: 1,
};

function span(start: number, end: number): SourceSpan {
  return { blockId: BLOCK, start, end };
}
function text(t: string, start: number): TextUnit {
  return { kind: "TEXT", span: span(start, start + codePointLength(t)), text: t };
}
const PROSE = "春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。「もう一度だけ、あの坂を上ってみようか」と彼は言った。𠮷野家の👨‍👩‍👧と🇯🇵、é。";
function prose(length: number): string {
  const codePoints: string[] = [];
  while (codePoints.length < length) codePoints.push(...Array.from(PROSE));
  // Never end mid-grapheme: trim back to a cluster boundary of the source text.
  let out = codePoints.slice(0, length).join("");
  while (out.endsWith("‍") || /[\u{1F3FB}-\u{1F3FF}́\u{1F1E6}-\u{1F1FF}]$/u.test(out)) out = Array.from(out).slice(0, -1).join("");
  return out;
}

function countMaterializedCodePoints(fn: () => void): number {
  const original = Array.from;
  let codePoints = 0;
  (Array as { from: unknown }).from = function patched(this: unknown, ...args: unknown[]) {
    const result = (original as (...a: unknown[]) => unknown[]).apply(this, args);
    if (typeof args[0] === "string") codePoints += result.length;
    return result;
  };
  try {
    fn();
  } finally {
    (Array as { from: unknown }).from = original;
  }
  return codePoints;
}

// ---- verbatim pre-optimization driver (column.ts/page.ts at d485cc6) ----
function referenceSliceUnitsFrom(units: LogicalUnit[], offset: number): LogicalUnit[] {
  const result: LogicalUnit[] = [];
  const manualBreakAtOffset = units.some((unit) => unit.kind === "MANUAL_BREAK" && unit.span.start === offset);
  for (const unit of units) {
    if (unit.span.end <= offset) continue;
    if (manualBreakAtOffset && unit.kind === "PARAGRAPH_BREAK" && unit.span.start === offset) continue;
    if (unit.span.start >= offset) {
      result.push(unit);
      continue;
    }
    if (unit.kind === "TEXT") {
      const relativeStart = offset - unit.span.start;
      const remainingText = codePointSlice(unit.text, relativeStart, Array.from(unit.text).length);
      result.push({
        kind: "TEXT",
        span: { blockId: unit.span.blockId, start: offset, end: unit.span.end },
        text: remainingText,
        ...(unit.decoration ? { decoration: unit.decoration } : {}),
      });
    } else {
      result.push(unit);
    }
  }
  return result;
}

function referenceComposePages(units: LogicalUnit[]): { pages: CanonicalPage[]; hold?: unknown } {
  const prepared: PreparedLineComposition = prepareLineComposition(units, DEFAULT_RULE_SET_V2, measurement, settings);
  const pages: CanonicalPage[] = [];
  let remaining = units;
  let isParagraphStart = true;
  let hold: unknown;
  for (let order = 0; remaining.length > 0 && !hold; order++) {
    const beforeOffset = remaining[0]?.span.start;
    const columns: CanonicalPage["columns"] = [];
    for (let c = 0; c < settings.columnsPerPage && remaining.length > 0; c++) {
      const lines: CanonicalPage["columns"][number]["lines"] = [];
      let used = 0;
      let forcedBreak = false;
      while (remaining.length > 0 && used + settings.linePitchTicks <= settings.columnExtentTicks) {
        const lineResult = composeLine(remaining, DEFAULT_RULE_SET_V2, measurement, settings, settings.lineExtentTicks, isParagraphStart, undefined, prepared);
        if (lineResult.hold) {
          hold = lineResult.hold;
          break;
        }
        if (lineResult.line.placedUnits.length === 0) break;
        lines.push({ ...lineResult.line, order: lines.length });
        used += settings.linePitchTicks;
        remaining = referenceSliceUnitsFrom(remaining, lineResult.consumedThroughOffset);
        isParagraphStart = lineResult.endedAtParagraphBreak;
        if (lineResult.forcedBreak) {
          forcedBreak = true;
          break;
        }
      }
      columns.push({ id: `column-${c}`, order: c, lines, residualSpaceTick: settings.columnExtentTicks - used });
      if (hold || forcedBreak) break;
    }
    pages.push({ id: `page-${order}`, order, columns });
    if (!hold && remaining.length > 0 && remaining[0].span.start === beforeOffset) hold = { reason: "NO_PROGRESS_COMPOSING_PAGE" };
  }
  return { pages, ...(hold ? { hold } : {}) };
}

function paragraphs(lengths: number[], separators: ("newline" | "manual")[] = []): LogicalUnit[] {
  const units: LogicalUnit[] = [];
  let offset = 0;
  lengths.forEach((length, i) => {
    const unit = text(prose(length), offset);
    units.push(unit);
    offset = unit.span.end;
    if (i === lengths.length - 1) return;
    if (separators[i] === "manual") {
      units.push({ kind: "MANUAL_BREAK", span: span(offset, offset) });
    }
    units.push({ kind: "PARAGRAPH_BREAK", span: span(offset, offset + 1) });
    offset += 1;
  });
  return units;
}

describe("long paragraph composition stays linear", () => {
  it("materializes a bounded number of code points per character, independent of paragraph length", () => {
    const perChar = (length: number) => {
      const units = [text(prose(length), 0)];
      return countMaterializedCodePoints(() => composePages(units, DEFAULT_RULE_SET_V2, measurement, settings)) / length;
    };
    const small = perChar(2_000);
    const large = perChar(16_000);
    // The pre-optimization Core re-expanded the remaining paragraph per
    // boundary/atom/line: ~length/4 code points per character (≈4,000 at
    // 16k). Linear composition stays a small constant at any length.
    expect(large).toBeLessThan(20);
    expect(large).toBeLessThan(small * 1.5);
  });

  it("composes a 60,000-character single paragraph completely", () => {
    const units = [text(prose(60_000), 0)];
    const result = composePages(units, DEFAULT_RULE_SET_V2, measurement, settings);
    expect(result.hold).toBeUndefined();
    const lastLine = result.pages.at(-1)!.columns.at(-1)!.lines.at(-1)!;
    expect(lastLine.placedUnits.at(-1)!.sourceSpan.end).toBe(units[0].span.end);
  });
});

describe("column/page slicing equals the original line-by-line driver", () => {
  const cases: Record<string, LogicalUnit[]> = {
    "single long paragraph": [text(prose(9_000), 0)],
    "many paragraphs": paragraphs(Array.from({ length: 80 }, (_, i) => 1 + ((i * 37) % 140))),
    "paragraph ends on line and page capacity": paragraphs([37, 36, 38, 74, 37 * 16, 37 * 16 - 1, 37 * 16 + 1, 1, 2, 37 * 15]),
    "manual page breaks followed by separator newlines": paragraphs([50, 700, 10, 37 * 16, 3], ["manual", "newline", "manual", "manual"]),
    "blank lines": paragraphs([40, 0, 0, 60, 0, 900]).filter((unit) => unit.kind !== "TEXT" || unit.text.length > 0),
  };
  // Not start-ordered (a later unit starts before an earlier one): must take
  // the unchanged full-scan path and still match.
  const shuffled = paragraphs([300, 200, 400]);
  cases["not start-ordered (full-scan path)"] = [shuffled[2], shuffled[0], shuffled[1], shuffled[3], shuffled[4]];

  for (const [name, units] of Object.entries(cases)) {
    it(name, () => {
      const actual = composePages(units, DEFAULT_RULE_SET_V2, measurement, settings);
      const expected = referenceComposePages(units);
      expect(JSON.stringify(actual.pages)).toBe(JSON.stringify(expected.pages));
      expect(Boolean(actual.hold)).toBe(Boolean(expected.hold));
    });
  }
});

describe("codePointSuffix equals the whole-string code-point slice", () => {
  const samples = ["", "a", "あいう", "𠮷野家", "👨‍👩‍👧x", "🇯🇵🇯🇵", "éf", "\ud800lone", "lone\udc00x", "a\ud800", "ＡＢＣ"];
  for (const sample of samples) {
    it(JSON.stringify(sample), () => {
      const length = codePointLength(sample);
      for (let start = -2; start <= length + 2; start++) {
        expect(codePointSuffix(sample, start)).toBe(codePointSlice(sample, start, length));
      }
    });
  }
});
