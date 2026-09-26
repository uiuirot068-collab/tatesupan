import { describe, expect, it } from "vitest";
import { buildV2UnitsFromManuscript } from "./manuscriptAdapter";

/**
 * Phase 7: ruby reading spans are tracked incrementally instead of re-counting
 * the whole source per reading. This locks the result to the original
 * definition — code-point offsets into `source`, readings appended after the
 * flow in manuscript order — including astral (surrogate-pair) characters in
 * bases, readings and surrounding text, dashes, images and page breaks.
 */
function referenceReadingSpans(source: string, readings: string[], flowCodePoints: number): Array<{ start: number; end: number }> {
  // The pre-Phase-7 definition: start = code points before the reading, end = after it.
  let text = Array.from(source).slice(0, flowCodePoints).join("");
  return readings.map((reading) => {
    const start = Array.from(text).length;
    text += reading;
    return { start, end: Array.from(text).length };
  });
}

describe("manuscriptAdapter: incremental ruby reading spans", () => {
  const manuscript = [
    "　𠮷野家の｜𠮷野《よしの》で――｜東京《とうきょう》を見た……",
    "漢字《かんじ》と《《傍点》》、｜𩸽《ほっけ》。",
    "【IMG:img1:40:30:center】",
    "【改ページ】",
    "｜月《つき》｜花《はな》｜雪《ゆき》𠀋",
  ].join("\n").repeat(40);

  it("equals the original re-counting definition for every RUBY unit", () => {
    const { units, source } = buildV2UnitsFromManuscript("body", manuscript, { maxSemanticRunCells: 38, decorations: true });
    const rubies = units.filter((unit) => unit.kind === "RUBY");
    expect(rubies.length).toBeGreaterThan(100);
    const readingsTotal = rubies.reduce((sum, unit) => sum + (unit.kind === "RUBY" ? Array.from(unit.readingText).length : 0), 0);
    const flowCodePoints = Array.from(source).length - readingsTotal;
    const expected = referenceReadingSpans(source, rubies.map((unit) => (unit.kind === "RUBY" ? unit.readingText : "")), flowCodePoints);
    rubies.forEach((unit, index) => {
      if (unit.kind !== "RUBY") return;
      expect(unit.readingSpan).toEqual({ blockId: "body", ...expected[index] });
      expect(Array.from(source).slice(unit.readingSpan.start, unit.readingSpan.end).join("")).toBe(unit.readingText);
      expect(Array.from(source).slice(unit.baseSpan.start, unit.baseSpan.end).join("")).not.toBe("");
    });
    expect(source.endsWith(rubies.map((unit) => (unit.kind === "RUBY" ? unit.readingText : "")).join(""))).toBe(true);
  });

  it("a manuscript without ruby keeps source === flow", () => {
    const { source, units } = buildV2UnitsFromManuscript("body", "本文――だけ……。\n次の段落");
    expect(units.some((unit) => unit.kind === "RUBY")).toBe(false);
    expect(source).toBe("本文――だけ……。\n次の段落");
  });
});
