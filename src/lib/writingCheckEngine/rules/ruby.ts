/**
 * R3-ruby -- TateSpun ルビ記法 (explicit ruby notation) corruption.
 * Ported verbatim from pre-2.0 `src/lib/writingCheck.ts`. Reuses the
 * SAME canonical pattern `src/lib/tategaki.ts`'s own `RUBY_PATTERN`
 * defines (a `｜`/`|` marker, a base run, `《`, a reading run, `》`) --
 * never a second ruby grammar.
 *
 * Only an explicit `｜`/`|` marker immediately leading into a `《` is
 * considered a ruby ATTEMPT -- a bare `《…》` with no marker (ordinary
 * prose, guillemet-style quoting) is never touched, and a lone `｜`/`|`
 * with no following `《` (table/separator use) is never touched either.
 * This deliberately does NOT attempt to validate the tokenizer's OTHER
 * supported form -- bare-kanji-run shorthand (漢字《かんじ》, no pipe
 * required) -- since a "malformed" bare-shorthand attempt is
 * indistinguishable from ordinary prose containing a guillemet quote
 * without a strong false-positive risk; left out of Phase 1 rather than
 * guessed at (Phase 6.B: "do not reject valid tokenizer-supported ruby
 * variants").
 */
import type { WritingDiagnostic } from "../types";

const RUBY_ATTEMPT = /[｜|]([^｜|《》\n]*)《([^《》\n]*)(》?)/g;

export function checkRubyNotation(text: string): WritingDiagnostic[] {
  const issues: WritingDiagnostic[] = [];
  for (const match of text.matchAll(RUBY_ATTEMPT)) {
    const [full, base, reading, close] = match;
    const start = match.index ?? 0;
    if (close === "》" && base.length > 0 && reading.length > 0) continue; // valid ruby

    let message: string;
    if (close !== "》") message = "ルビの《》が閉じられていません";
    else if (base.length === 0) message = "ルビを付ける文字が《》の前にありません";
    else message = "ルビの読み（《》の中）が入力されていません";

    const end = start + full.length;
    // No single unambiguous fix (add a closing 》? remove the marker
    // entirely? insert a placeholder base/reading?) -- NOTICE_ONLY.
    issues.push({ id: `R3-ruby:${start}:${end}`, start, end, ruleId: "R3-ruby", category: "notation", severity: "HIGH_CONFIDENCE", fixClass: "NOTICE_ONLY", message });
  }
  return issues;
}
