/**
 * R4-halfwidth-kana -- 半角カタカナ (half-width katakana) detection
 * (Phase 2, 文章チェックβ v2 category 3: 縦書き文字 / vertical-writing
 * character issues).
 *
 * Half-width katakana (U+FF61-U+FF9F) is a legacy single-byte-encoding
 * artifact (old feature-phone input, IME/paste mishaps) -- professional
 * Japanese typesetting always uses full-width katakana. This range is
 * completely disjoint from Latin letters/digits, TCY notation
 * (`[tate]`/`[/tate]`), and ruby notation (`｜《》`), so this rule has
 * zero false-positive overlap with any of those -- a genuinely
 * mechanical, style-independent check, not a stylistic preference.
 *
 * No `suggestedReplacement` yet: a correct full-width conversion needs a
 * real half-width-to-full-width mapping table (including dakuten/
 * handakuten combining forms, e.g. ｶﾞ -> ガ), which is real, deterministic
 * work deferred to whenever the Fix UI itself is built (Phase 3) --
 * Phase 2 defines detection + fix-class contract only.
 */
import type { WritingDiagnostic } from "../types";

// The full "Halfwidth Katakana and Punctuation" Unicode block
// (code point range U+FF61-U+FF9F: "｡" through "ﾟ"), same literal-character
// regex convention every sibling rule file already uses (ruby.ts's
// ｜《》, brackets.ts's 「」『』 etc.) -- verified directly by test against
// real half-width katakana input, not just visual inspection of the range.
const HALFWIDTH_KANA_RUN = /[｡-ﾟ]+/g;

export function checkHalfwidthKana(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(HALFWIDTH_KANA_RUN)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    issues.push({
      id: `R4-halfwidth-kana:${start}:${end}`,
      start,
      end,
      ruleId: "R4-halfwidth-kana",
      category: "character",
      severity: "HIGH_CONFIDENCE",
      // A full-width conversion is conceptually always correct, but this
      // rule does not yet compute it (see module doc) -- REVIEW_BEFORE_FIX,
      // not SAFE_AUTO_FIX, until a real conversion table exists.
      fixClass: "REVIEW_BEFORE_FIX",
      message: "半角カタカナが使われています（全角カタカナへの変更を検討してください）",
    });
  }
  return issues;
}
