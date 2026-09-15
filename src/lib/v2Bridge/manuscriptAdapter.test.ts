import { describe, expect, it } from "vitest";
import { buildV2UnitsFromManuscript } from "./manuscriptAdapter";

describe("manuscriptAdapter -- real tategaki.ts notation -> v2 LogicalUnit[]", () => {
  it("maps plain body text to a single TEXT unit with a real, code-point-correct span", () => {
    const { units, source } = buildV2UnitsFromManuscript("body", "本文の一文である。");
    expect(units).toHaveLength(1);
    expect(units[0]).toMatchObject({ kind: "TEXT", text: "本文の一文である。" });
    if (units[0].kind === "TEXT") {
      expect(units[0].span).toEqual({ blockId: "body", start: 0, end: 9 });
    }
    expect(source.startsWith("本文の一文である。")).toBe(true);
  });

  it("maps explicit ruby notation (｜base《reading》) to a RUBY unit with real base/reading spans", () => {
    const { units, source } = buildV2UnitsFromManuscript("body", "｜東京《とうきょう》駅");
    const ruby = units.find((u) => u.kind === "RUBY");
    expect(ruby).toBeDefined();
    if (ruby?.kind === "RUBY") {
      expect(ruby.rubyKind).toBe("ATOMIC");
      expect(source.slice(ruby.baseSpan.start, ruby.baseSpan.end)).toBe("東京");
      expect(source.slice(ruby.readingSpan.start, ruby.readingSpan.end)).toBe("とうきょう");
    }
  });

  it("maps bare-kanji ruby shorthand (漢字《かんじ》, no pipe) the same way", () => {
    const { units } = buildV2UnitsFromManuscript("body", "漢字《かんじ》");
    const ruby = units.find((u) => u.kind === "RUBY");
    expect(ruby).toBeDefined();
  });

  it("maps a bare 2-digit TCY run to a TCY unit with logicalCells=1 (matches Core's own real convention)", () => {
    const { units } = buildV2UnitsFromManuscript("body", "西暦20年");
    const tcy = units.find((u) => u.kind === "TCY");
    expect(tcy).toBeDefined();
    if (tcy?.kind === "TCY") {
      expect(tcy.displayText).toBe("20");
      expect(tcy.logicalCells).toBe(1);
    }
  });

  it("keeps full/half-width colons as ordinary text and makes explicit 12:30 one TCY unit", () => {
    const { units } = buildV2UnitsFromManuscript(
      "body",
      "全角：半角:時刻[tate]12:30[/tate]",
    );
    const ordinaryText = units
      .filter((unit) => unit.kind === "TEXT")
      .map((unit) => unit.text)
      .join("");
    const explicitTime = units.find(
      (unit) => unit.kind === "TCY" && unit.displayText === "12:30",
    );

    expect(ordinaryText).toContain("全角：半角:時刻");
    expect(explicitTime).toMatchObject({ kind: "TCY", logicalCells: 1 });
  });

  it("maps an image marker to a real IMAGE unit with mm->tick converted intrinsic size and uppercased placement", () => {
    const { units } = buildV2UnitsFromManuscript("body", "前【IMG:photo1:50:30:top】後");
    const image = units.find((u) => u.kind === "IMAGE");
    expect(image).toBeDefined();
    if (image?.kind === "IMAGE") {
      expect(image.refId).toBe("photo1");
      expect(image.placement).toBe("TOP");
      expect(image.intrinsicWidth).toBeGreaterThan(0);
      expect(image.intrinsicHeight).toBeGreaterThan(0);
    }
  });

  it("maps an explicit page-break marker (alone on its own line) to a MANUAL_BREAK unit", () => {
    const { units } = buildV2UnitsFromManuscript("body", "一ページ目\n【改ページ】\n二ページ目");
    expect(units.some((u) => u.kind === "MANUAL_BREAK")).toBe(true);
  });

  it("treats every embedded newline as a real PARAGRAPH_BREAK unit spanning that character (disclosed adapter policy)", () => {
    const { units, source } = buildV2UnitsFromManuscript("body", "一段落目\n二段落目");
    const breakUnit = units.find((u) => u.kind === "PARAGRAPH_BREAK");
    expect(breakUnit).toBeDefined();
    if (breakUnit) {
      expect(source.slice(breakUnit.span.start, breakUnit.span.end)).toBe("\n");
    }
  });

  it("every unit's span refers to a real, correctly-offset substring of the returned source (no boundary-derivation gaps)", () => {
    const { units, source } = buildV2UnitsFromManuscript("body", "前置き｜東京《とうきょう》20続き\n次の段落");
    // Every unit's OWN flow-position span (baseSpan for RUBY, span for
    // everything else) must own a real, contiguous range with no gaps --
    // the exact boundary-ownership rule Core's own compose/line.ts
    // enforces (a real bug this adapter must not trigger).
    let expectedCursor = 0;
    for (const unit of units) {
      const span = unit.kind === "RUBY" ? unit.baseSpan : unit.span;
      expect(span.start).toBe(expectedCursor);
      expectedCursor = span.end;
    }
    expect(source.slice(0, expectedCursor).length).toBeGreaterThan(0);
  });
});
