/**
 * R5-control-char -- stray control-character detection (Phase 2,
 * 文章チェックβ v2 category 3: 縦書き文字 / vertical-writing character
 * issues -- general document-hygiene, listed explicitly as a candidate
 * in the Phase 2 task's own rule list).
 *
 * Flags real C0 control characters that have NO legitimate purpose in
 * manuscript prose -- excludes `\t` (U+0009), `\n` (U+000A), and `\r`
 * (U+000D), which ARE legitimate (tab/newline/CRLF are handled by other
 * rules and the tokenizer itself). Every other C0 control code
 * (U+0000-U+0008, U+000B, U+000C, U+000E-U+001F) and DEL (U+007F) is
 * essentially always a paste/encoding artifact, never intentional
 * authorial content -- genuinely SAFE_AUTO_FIX: removing a stray
 * control character can never destroy meaningful text.
 */
import type { WritingDiagnostic } from "../types";

const CONTROL_CHAR_RUN = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]+/g;

export function checkControlChars(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(CONTROL_CHAR_RUN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    issues.push({
      id: `R5-control-char:${start}:${end}`,
      start,
      end,
      ruleId: "R5-control-char",
      category: "character",
      severity: "HIGH_CONFIDENCE",
      fixClass: "SAFE_AUTO_FIX",
      suggestedReplacement: { text: "", mechanicallyCertain: true },
      message: "制御文字が含まれています（貼り付け時の混入の可能性があります）",
    });
  }
  return issues;
}
