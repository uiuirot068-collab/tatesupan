/**
 * R4-halfwidth-kana -- 半角カタカナ (half-width katakana) detection +
 * conversion (Phase 2 detection, Phase 3 real replacement).
 *
 * Half-width katakana (U+FF61-U+FF9F) is a legacy single-byte-encoding
 * artifact (old feature-phone input, IME/paste mishaps) -- professional
 * Japanese typesetting always uses full-width katakana. This range is
 * completely disjoint from Latin letters/digits, TCY notation
 * (`[tate]`/`[/tate]`), and ruby notation (`｜《》`), so this rule has
 * zero false-positive overlap with any of those -- a genuinely
 * mechanical, style-independent check, not a stylistic preference.
 *
 * Phase 3: now provides a real `suggestedReplacement`, computed by the
 * standard JIS X 0201<->X 0208 table (`halfwidthKanaTable.ts`, including
 * dakuten/handakuten combining) -- promoted to SAFE_AUTO_FIX now that the
 * conversion is real and deterministic, not merely conceptual.
 */
import type { WritingDiagnostic } from "../types";
import { convertHalfwidthKanaRun } from "../halfwidthKanaTable";

const HALFWIDTH_KANA_RUN = /[｡-ﾟ]+/g;

export function checkHalfwidthKana(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(HALFWIDTH_KANA_RUN)) {
    const run = match[0];
    const start = match.index ?? 0;
    const end = start + run.length;
    issues.push({
      id: `R4-halfwidth-kana:${start}:${end}`,
      start,
      end,
      ruleId: "R4-halfwidth-kana",
      category: "character",
      severity: "HIGH_CONFIDENCE",
      fixClass: "SAFE_AUTO_FIX",
      suggestedReplacement: { text: convertHalfwidthKanaRun(run), mechanicallyCertain: true },
      originalText: run,
      message: "半角カタカナが使われています（全角カタカナへの変更を検討してください）",
    });
  }
  return issues;
}
