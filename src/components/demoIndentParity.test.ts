import { describe, expect, it } from "vitest";
import { DEMO_SEED_CONTENT } from "../constants/demoData";
import { SAMPLE_PROJECT } from "../constants/sampleData";
import {
  AUTO_INDENT_CHAR,
  detokenizeTategaki,
  paragraphNeedsAutoIndent,
  tokenizeTategaki,
} from "../lib/tategaki";
import { buildLineSlots } from "./PageCard";

const CHARS_PER_LINE = 40;
const POLANO_HEADING = "■ 試し読み（宮沢賢治『ポラーノの広場』より）";

function renderedSlotTexts(source: string): string[] {
  return buildLineSlots(
    [{ type: "text", value: source }],
    0,
    [true],
    CHARS_PER_LINE,
  ).slots.map((slot) => slot.text);
}

function leadingIndentSlotCount(slots: string[]): number {
  return slots.findIndex((slot) => slot !== " " && slot !== AUTO_INDENT_CHAR);
}

function demoBodyParagraphs(): string[] {
  return DEMO_SEED_CONTENT.split("\n").filter(
    (line) => line.length > 0 && line !== "【改ページ】",
  );
}

function guidePolanoParagraphs(): string[] {
  const start = SAMPLE_PROJECT.content.indexOf(POLANO_HEADING);
  expect(start).toBeGreaterThanOrEqual(0);
  return SAMPLE_PROJECT.content
    .slice(start + POLANO_HEADING.length)
    .split("\n")
    .filter((line) => line.trim().length > 0 && !line.startsWith("----"));
}

describe("FQ-07 Demo ↔ New Project paragraph-indent parity", () => {
  it("keeps the canonical Demo seed free of hidden manual paragraph indentation", () => {
    const paragraphs = demoBodyParagraphs();
    expect(paragraphs.length).toBeGreaterThan(0);

    for (const paragraph of paragraphs) {
      expect(paragraph.startsWith(" ")).toBe(false);
      expect(paragraph.startsWith(AUTO_INDENT_CHAR)).toBe(false);
      expect(paragraph).toBe(paragraph.trimStart());
    }
  });

  it.each([
    ["no explicit leading space", "先頭", [AUTO_INDENT_CHAR, "先", "頭"]],
    ["ASCII half-width leading space", " 本文", [" ", "本", "文"]],
    ["U+3000 full-width leading space", `${AUTO_INDENT_CHAR}本文`, [AUTO_INDENT_CHAR, "本", "文"]],
    ["ASCII alphanumeric paragraph start", "ABC", [AUTO_INDENT_CHAR, "A", "B", "C"]],
    ["ordinary Japanese paragraph", "本文", [AUTO_INDENT_CHAR, "本", "文"]],
    ["opening corner bracket", "「本文", ["「", "本", "文"]],
    ["opening double corner bracket", "『本文", ["『", "本", "文"]],
  ])("uses the shared New Project contract for %s", (_label, source, expectedSlots) => {
    expect(renderedSlotTexts(source)).toEqual(expectedSlots);
  });

  it.each([
    ["no explicit leading space", "本文", 1],
    ["ASCII half-width leading space", " 本文", 1],
    ["U+3000 full-width leading space", `${AUTO_INDENT_CHAR}本文`, 1],
    ["ASCII alphanumeric paragraph start", "ABC本文", 1],
    ["ordinary Japanese paragraph", "これは本文", 1],
    ["opening corner bracket", "「本文", 0],
    ["opening double corner bracket", "『本文", 0],
  ])("places %s at the expected effective Preview indent", (_label, source, expectedCells) => {
    expect(leadingIndentSlotCount(renderedSlotTexts(source))).toBe(expectedCells);
  });

  it("does not destructively normalize user source while evaluating indent", () => {
    const cases = [
      "本文",
      " 本文",
      `${AUTO_INDENT_CHAR}本文`,
      "ABC",
      "「本文",
      "『本文",
      "｜漢字《かんじ》と12月25日",
    ];

    for (const source of cases) {
      expect(detokenizeTategaki(tokenizeTategaki(source))).toBe(source);
    }
  });

  it("documents the unchanged shared auto-indent decisions", () => {
    expect(paragraphNeedsAutoIndent("本")).toBe(true);
    expect(paragraphNeedsAutoIndent("A")).toBe(true);
    expect(paragraphNeedsAutoIndent(" ")).toBe(false);
    expect(paragraphNeedsAutoIndent(AUTO_INDENT_CHAR)).toBe(false);
    expect(paragraphNeedsAutoIndent("「")).toBe(false);
    expect(paragraphNeedsAutoIndent("『")).toBe(false);
  });

  it("keeps Guide FQ-05 at exactly one manual U+3000 slot with no automatic prefix", () => {
    const paragraphs = guidePolanoParagraphs();
    expect(paragraphs).toHaveLength(4);

    for (const paragraph of paragraphs) {
      expect(paragraph.startsWith(AUTO_INDENT_CHAR)).toBe(true);
      const slots = renderedSlotTexts(paragraph.slice(0, 2));
      expect(slots[0]).toBe(AUTO_INDENT_CHAR);
      expect(slots[1]).not.toBe(AUTO_INDENT_CHAR);
    }
  });
});
