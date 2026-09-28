import { describe, expect, it } from "vitest";
import type { WritingDiagnostic } from "../types";
import { checkBrackets } from "./brackets";

// Main-thread Preview performance: checkBrackets now rejects non-bracket code
// units by number before touching `text[i]`. This pins it to the original
// per-character implementation (copied verbatim below) on generated text.

const OPEN_TO_CLOSE: Record<string, string> = { "「": "」", "『": "』", "（": "）", "［": "］", "【": "】" };
const CLOSE_TO_OPEN: Record<string, string> = Object.fromEntries(Object.entries(OPEN_TO_CLOSE).map(([o, c]) => [c, o]));

function originalCheckBrackets(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  const stack: Array<{ char: string; expect: string; index: number }> = [];
  const issue = (start: number, originalText: string, message: string): WritingDiagnostic => ({
    id: `R1-bracket:${start}:${start + 1}`,
    start,
    end: start + 1,
    ruleId: "R1-bracket",
    category: "structure",
    severity: "HIGH_CONFIDENCE",
    fixClass: "NOTICE_ONLY",
    originalText,
    message,
  });
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const close = OPEN_TO_CLOSE[ch];
    if (close !== undefined) {
      stack.push({ char: ch, expect: close, index: i });
      continue;
    }
    if (CLOSE_TO_OPEN[ch] === undefined) continue;
    if (stack.length === 0) {
      issues.push(issue(i, ch, `閉じ括弧「${ch}」に対応する開き括弧「${CLOSE_TO_OPEN[ch]}」が見つかりません`));
      continue;
    }
    const top = stack[stack.length - 1];
    stack.pop();
    if (top.expect !== ch) issues.push(issue(i, ch, `括弧の対応が取れていません（「${top.char}」に対応する閉じ括弧は「${top.expect}」です）`));
  }
  for (const open of stack) issues.push(issue(open.index, open.char, `開き括弧「${open.char}」に対応する閉じ括弧「${open.expect}」が見つかりません`));
  return issues;
}

const ALPHABET = ["「", "」", "『", "』", "（", "）", "［", "］", "【", "】", "(", ")", "[", "]", "〈", "〉", "《", "》", "あ", "漢", "。", "\n", "a", "𠮷", "\ud83d", "〔", "〕", "｢", "｣"];

function generated(seed: number, length: number): string {
  let state = seed;
  let text = "";
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    text += ALPHABET[state % ALPHABET.length];
  }
  return text;
}

describe("checkBrackets fast path", () => {
  it("returns exactly the original diagnostics on generated text", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const text = generated(seed, 1 + (seed % 97));
      expect(checkBrackets(text)).toEqual(originalCheckBrackets(text));
    }
  });

  it("flags only the five full-width pairs (every code unit in U+0000–U+FFFF checked against the original)", () => {
    const text = Array.from({ length: 0x10000 }, (_, code) => String.fromCharCode(code)).join("");
    expect(checkBrackets(text)).toEqual(originalCheckBrackets(text));
    expect(new Set(checkBrackets(text).map((d) => d.originalText))).toEqual(new Set(["」", "』", "）", "］", "】", "「", "『", "（", "［", "【"].filter((ch) => originalCheckBrackets(text).some((d) => d.originalText === ch))));
  });

  it("matches on a 300k-character manuscript with scattered unbalanced brackets", () => {
    const line = "　「もう一度だけ、あの坂を上ってみようか」と彼は言った。（注）『本』【見出し】［補足］";
    let text = Array.from({ length: 300_000 / line.length }, () => line).join("\n");
    text = "」" + text.slice(0, 1000) + "『" + text.slice(1000) + "「";
    expect(checkBrackets(text)).toEqual(originalCheckBrackets(text));
  });
});
