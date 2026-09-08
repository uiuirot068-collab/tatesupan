/**
 * R1 -- 括弧対応 (bracket correspondence). Ported verbatim from the
 * pre-2.0 `src/lib/writingCheck.ts` (same regex-free scan, same
 * messages, same deliberate half-width-bracket exclusion) -- only the
 * diagnostic's own id/category/severity fields are new.
 */
import type { WritingDiagnostic } from "../types";

// Only the five full-width pairs named in the spec. Half-width ()[] are left
// alone on purpose: they are routinely unbalanced in ordinary Japanese prose
// (around ASCII, emoticons, URLs) and would be a false-positive factory.
const BRACKET_OPEN_TO_CLOSE: Record<string, string> = {
  "「": "」",
  "『": "』",
  "（": "）",
  "［": "］",
  "【": "】",
};
const BRACKET_CLOSE_TO_OPEN: Record<string, string> = Object.fromEntries(
  Object.entries(BRACKET_OPEN_TO_CLOSE).map(([open, close]) => [close, open])
);

export function checkBrackets(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  const stack: Array<{ char: string; expect: string; index: number }> = [];

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const close = BRACKET_OPEN_TO_CLOSE[ch];
    if (close !== undefined) {
      stack.push({ char: ch, expect: close, index: i });
      continue;
    }
    if (BRACKET_CLOSE_TO_OPEN[ch] === undefined) continue;

    if (stack.length === 0) {
      issues.push({
        id: `R1-bracket:${i}:${i + 1}`,
        start: i,
        end: i + 1,
        ruleId: "R1-bracket",
        category: "structure",
        severity: "HIGH_CONFIDENCE",
        fixClass: "NOTICE_ONLY",
        originalText: ch,
        message: `閉じ括弧「${ch}」に対応する開き括弧「${BRACKET_CLOSE_TO_OPEN[ch]}」が見つかりません`,
      });
      continue;
    }

    const top = stack[stack.length - 1];
    if (top.expect === ch) {
      stack.pop();
    } else {
      // Best-effort recovery: report once at the mismatching closer and pop,
      // so one crossed pair doesn't cascade into a flag on every later bracket.
      stack.pop();
      issues.push({
        id: `R1-bracket:${i}:${i + 1}`,
        start: i,
        end: i + 1,
        ruleId: "R1-bracket",
        category: "structure",
        severity: "HIGH_CONFIDENCE",
        fixClass: "NOTICE_ONLY",
        originalText: ch,
        message: `括弧の対応が取れていません（「${top.char}」に対応する閉じ括弧は「${top.expect}」です）`,
      });
    }
  }

  for (const open of stack) {
    issues.push({
      id: `R1-bracket:${open.index}:${open.index + 1}`,
      start: open.index,
      end: open.index + 1,
      ruleId: "R1-bracket",
      category: "structure",
      severity: "HIGH_CONFIDENCE",
      fixClass: "NOTICE_ONLY",
      originalText: open.char,
      message: `開き括弧「${open.char}」に対応する閉じ括弧「${open.expect}」が見つかりません`,
    });
  }

  return issues;
}
