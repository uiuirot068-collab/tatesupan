/**
 * R3-tcy -- TateSpun 縦中横 (TCY) explicit-notation corruption. Ported
 * verbatim from pre-2.0 `src/lib/writingCheck.ts`. Reuses the SAME
 * canonical pattern `src/lib/tategaki.ts`'s own `TCY_PATTERN` defines
 * (`[tate]` + 1-8 chars that are not `[`, `]`, or newline + `[/tate]`)
 * -- never a second TCY grammar. Only flags a genuinely UNMATCHED
 * `[tate]`/`[/tate]` marker; a well-formed pair is never touched.
 */
import type { WritingDiagnostic } from "../types";

const TCY_CANONICAL = /\[tate\][^[\]\n]{1,8}\[\/tate\]/g;
const TCY_MARKER = /\[tate\]|\[\/tate\]/g;

export function checkTcyNotation(text: string): WritingDiagnostic[] {
  const covered: Array<[number, number]> = [];
  for (const match of text.matchAll(TCY_CANONICAL)) {
    const start = match.index ?? 0;
    covered.push([start, start + match[0].length]);
  }
  const isCovered = (start: number, end: number) => covered.some(([cs, ce]) => start >= cs && end <= ce);

  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(TCY_MARKER)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (isCovered(start, end)) continue;
    issues.push({
      id: `R3-tcy:${start}:${end}`,
      start,
      end,
      ruleId: "R3-tcy",
      category: "notation",
      severity: "HIGH_CONFIDENCE",
      // No single unambiguous fix: an unmatched marker could mean "add the
      // missing partner" OR "this was never meant to be TCY at all" --
      // NOTICE_ONLY, same reasoning as R1-bracket.
      fixClass: "NOTICE_ONLY",
      message: match[0] === "[tate]" ? "縦中横の記法が崩れています（[tate]◯◯[/tate] の形で、中は1〜8文字にしてください）" : "縦中横の記法が崩れています（対応する [tate] が見つかりません）",
    });
  }
  return issues;
}
