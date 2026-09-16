import { describe, expect, it } from "vitest";
import {
  AUTO_INDENT_CHAR,
  detokenizeTategaki,
  paragraphNeedsAutoIndent,
  tokenizeTategaki,
} from "../lib/tategaki";
import { SAMPLE_PROJECT } from "./sampleData";

// FQ-05 / FQ-06 regression: the guide's Polano-no-Hiroba excerpt
// (`■ 試し読み（宮沢賢治『ポラーノの広場』より）`) previously (a) opened its
// paragraphs with a half-width space instead of the auto-indent-recognized
// U+3000, causing a doubled indent, and (b) had two ruby annotations
// flattened into plain text. Both were fixed by editing sampleData.ts only;
// these tests guard against regressing either fix, without touching the
// shared renderer.

const EXCERPT_HEADING = "■ 試し読み（宮沢賢治『ポラーノの広場』より）";

function polanoParagraphs(): string[] {
  const idx = SAMPLE_PROJECT.content.indexOf(EXCERPT_HEADING);
  expect(idx).toBeGreaterThanOrEqual(0);
  const excerpt = SAMPLE_PROJECT.content.slice(idx + EXCERPT_HEADING.length);
  return excerpt
    .split("\n")
    .map((line) => line)
    .filter((line) => line.trim().length > 0 && !line.startsWith("----"));
}

describe("SAMPLE_PROJECT Polano excerpt — FQ-06 (ruby restored, not flattened)", () => {
  it("俸給ほうきゅう is no longer flattened; ｜俸給《ほうきゅう》 is present", () => {
    expect(SAMPLE_PROJECT.content).not.toContain("俸給ほうきゅう");
    expect(SAMPLE_PROJECT.content).toContain("｜俸給《ほうきゅう》");
  });

  it("拵こしらえ is no longer flattened; ｜拵《こしら》え is present (え stays outside the ruby)", () => {
    expect(SAMPLE_PROJECT.content).not.toContain("拵こしらえ");
    expect(SAMPLE_PROJECT.content).toContain("｜拵《こしら》え");
  });

  it("tokenizeTategaki parses each restored ruby exactly once, with base text not duplicated", () => {
    const tokens = tokenizeTategaki(SAMPLE_PROJECT.content);
    const rubyTokens = tokens.filter((t): t is Extract<typeof t, { type: "ruby" }> => t.type === "ruby");

    const houkyuu = rubyTokens.filter((t) => t.base === "俸給");
    expect(houkyuu).toHaveLength(1);
    expect(houkyuu[0].rt).toBe("ほうきゅう");

    const koshira = rubyTokens.filter((t) => t.base === "拵");
    expect(koshira).toHaveLength(1);
    expect(koshira[0].rt).toBe("こしら");
  });

  it("round-trips through tokenizeTategaki/detokenizeTategaki without duplicating or dropping the ruby base text", () => {
    const roundTripped = detokenizeTategaki(tokenizeTategaki(SAMPLE_PROJECT.content));
    expect(roundTripped).toBe(SAMPLE_PROJECT.content);
  });
});

describe("SAMPLE_PROJECT Polano excerpt — FQ-05 (full-width auto-indent space)", () => {
  it("has exactly 4 quoted paragraphs", () => {
    expect(polanoParagraphs()).toHaveLength(4);
  });

  it("each paragraph starts with U+3000 (full-width space), not U+0020", () => {
    for (const paragraph of polanoParagraphs()) {
      expect(paragraph.codePointAt(0)).toBe(0x3000);
    }
  });

  it("paragraphNeedsAutoIndent treats the U+3000 lead as already-indented (no double indent), unlike a half-width space", () => {
    for (const paragraph of polanoParagraphs()) {
      expect(paragraph[0]).toBe(AUTO_INDENT_CHAR);
      expect(paragraphNeedsAutoIndent(paragraph[0])).toBe(false);
    }
    // Confirms the bug this guards against: a half-width space is NOT
    // recognized as already-indented, so the renderer would add its own
    // indent on top of it (the double-indent that FQ-05 fixed).
    expect(paragraphNeedsAutoIndent(" ")).toBe(true);
  });
});
