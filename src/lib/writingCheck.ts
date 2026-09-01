/**
 * TSP-LOOP-004 「文章チェック β」 — pure, local, deterministic writing-check
 * rules.
 *
 * NO network, NO external API, NO AI, NO auto-fix. Given the raw editor text
 * this returns a list of 「確認候補」 (things worth a human look), never
 * 「エラー」 and never a rewrite. The caller renders a red wavy underline on
 * an editor-only overlay and a reason list; the document text is never
 * touched.
 *
 * Offsets are UTF-16 code-unit indices into the same string
 * `textarea.selectionStart` indexes, so a `[start, end)` range maps straight
 * onto the editor selection. Emoji / surrogate pairs keep their width because
 * every scan works on raw string indices (regex `.index`, `for` loops) and
 * never iterates code points.
 *
 * R3 only READS the canonical TateSpun notation forms documented in
 * `src/lib/tategaki.ts` (ruby `｜漢字《かんじ》`, TCY `[tate]A5[/tate]` with a
 * 1–8 char inner). It never changes parser behaviour.
 */

export type WritingRuleId = "R1-bracket" | "R2-punct" | "R3-tcy" | "R3-ruby";

export type WritingIssue = {
  /** UTF-16 code-unit index into the source string (inclusive). */
  start: number;
  /** UTF-16 code-unit index into the source string (exclusive). */
  end: number;
  ruleId: WritingRuleId;
  /** User-facing Japanese explanation, phrased as a 確認候補 — never a verdict. */
  message: string;
};

/* ------------------------------------------------------------------ *
 * R1 — 括弧対応 (bracket correspondence)
 * ------------------------------------------------------------------ */

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

function checkBrackets(text: string): WritingIssue[] {
  const issues: WritingIssue[] = [];
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
        start: i,
        end: i + 1,
        ruleId: "R1-bracket",
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
        start: i,
        end: i + 1,
        ruleId: "R1-bracket",
        message: `括弧の対応が取れていません（「${top.char}」に対応する閉じ括弧は「${top.expect}」です）`,
      });
    }
  }

  for (const open of stack) {
    issues.push({
      start: open.index,
      end: open.index + 1,
      ruleId: "R1-bracket",
      message: `開き括弧「${open.char}」に対応する閉じ括弧「${open.expect}」が見つかりません`,
    });
  }

  return issues;
}

/* ------------------------------------------------------------------ *
 * R2 — 明らかな句読点重複 (obvious duplicated 。 / 、)
 * ------------------------------------------------------------------ */

// Deliberately only 。 and 、. ！！ ／ ！？ ／ ？！ ／ …… ／ ―― are frequently
// intentional in fiction and are NOT flagged in the beta.
const PUNCT_RUN = /。{2,}|、{2,}/g;

function checkPunctuation(text: string): WritingIssue[] {
  const issues: WritingIssue[] = [];
  for (const match of text.matchAll(PUNCT_RUN)) {
    const run = match[0];
    const start = match.index ?? 0;
    issues.push({
      start,
      end: start + run.length,
      ruleId: "R2-punct",
      message: run[0] === "。" ? "句点（。）が連続しています" : "読点（、）が連続しています",
    });
  }
  return issues;
}

/* ------------------------------------------------------------------ *
 * R3 — TateSpun 明示記法の破損 (broken explicit notation)
 * ------------------------------------------------------------------ */

// Canonical TCY (see tategaki.ts TCY_PATTERN): `[tate]` + 1–8 chars that are
// not `[`, `]` or newline + `[/tate]`.
const TCY_CANONICAL = /\[tate\][^[\]\n]{1,8}\[\/tate\]/g;
const TCY_MARKER = /\[tate\]|\[\/tate\]/g;

function checkTcyNotation(text: string): WritingIssue[] {
  const covered: Array<[number, number]> = [];
  for (const match of text.matchAll(TCY_CANONICAL)) {
    const start = match.index ?? 0;
    covered.push([start, start + match[0].length]);
  }
  const isCovered = (start: number, end: number) =>
    covered.some(([cs, ce]) => start >= cs && end <= ce);

  const issues: WritingIssue[] = [];
  for (const match of text.matchAll(TCY_MARKER)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (isCovered(start, end)) continue;
    issues.push({
      start,
      end,
      ruleId: "R3-tcy",
      message:
        match[0] === "[tate]"
          ? "縦中横の記法が崩れています（[tate]◯◯[/tate] の形で、中は1〜8文字にしてください）"
          : "縦中横の記法が崩れています（対応する [tate] が見つかりません）",
    });
  }
  return issues;
}

// Canonical explicit ruby (see tategaki.ts RUBY_PATTERN, first alternative):
// a `｜` or `|` marker, a base run with no `｜ | 《 》` or newline, `《`, a
// reading run with no `《 》` or newline, `》`.
//
// Only an explicit `｜`/`|` marker immediately leading into a `《` is
// considered a ruby *attempt*. A bare `《…》` with no marker (ordinary prose,
// guillemet-style quoting, the sample guide's own `《》を使うと…`) is never
// touched, and a lone `｜`/`|` with no following `《` (table / separator use,
// e.g. the sample guide's `▶①ページ設定｜▶②…`) is never touched either.
const RUBY_ATTEMPT = /[｜|]([^｜|《》\n]*)《([^《》\n]*)(》?)/g;

function checkRubyNotation(text: string): WritingIssue[] {
  const issues: WritingIssue[] = [];
  for (const match of text.matchAll(RUBY_ATTEMPT)) {
    const [full, base, reading, close] = match;
    const start = match.index ?? 0;
    if (close === "》" && base.length > 0 && reading.length > 0) continue; // valid ruby

    let message: string;
    if (close !== "》") message = "ルビの《》が閉じられていません";
    else if (base.length === 0) message = "ルビを付ける文字が《》の前にありません";
    else message = "ルビの読み（《》の中）が入力されていません";

    issues.push({ start, end: start + full.length, ruleId: "R3-ruby", message });
  }
  return issues;
}

/* ------------------------------------------------------------------ *
 * Public API
 * ------------------------------------------------------------------ */

/**
 * Runs every beta rule over `text` and returns the 確認候補 sorted by
 * position. Pure and side-effect-free; O(n) in practice (the per-rule scans
 * are linear and the bracket/TCY bookkeeping is bounded by the small number
 * of brackets / markers actually present).
 */
export function analyzeWriting(text: string): WritingIssue[] {
  if (!text) return [];
  const issues = [
    ...checkBrackets(text),
    ...checkPunctuation(text),
    ...checkTcyNotation(text),
    ...checkRubyNotation(text),
  ];
  issues.sort((a, b) => a.start - b.start || a.end - b.end);
  return issues;
}

/**
 * Collapses overlapping / touching issue ranges into the minimal set of
 * display ranges for the wavy underline. The reason list keeps the original
 * issues — this is only for drawing.
 */
export function mergeIssueRanges(
  issues: WritingIssue[]
): Array<{ start: number; end: number }> {
  const sorted = [...issues].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Array<{ start: number; end: number }> = [];
  for (const { start, end } of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last.end) {
      last.end = Math.max(last.end, end);
    } else {
      merged.push({ start, end });
    }
  }
  return merged;
}

export type WritingSegment = { text: string; flagged: boolean };

/**
 * Splits `text` into consecutive segments, each either plain or `flagged`
 * (inside a merged issue range). `segments.map((s) => s.text).join("")`
 * always reconstructs `text` exactly, so the overlay mirror can never gain
 * or lose a character relative to the textarea. Ranges are clamped to
 * `[0, text.length]` defensively.
 */
export function buildWritingSegments(
  text: string,
  ranges: Array<{ start: number; end: number }>
): WritingSegment[] {
  if (ranges.length === 0) return text ? [{ text, flagged: false }] : [];

  const segments: WritingSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    const start = Math.max(cursor, Math.min(range.start, text.length));
    const end = Math.max(start, Math.min(range.end, text.length));
    if (start > cursor) segments.push({ text: text.slice(cursor, start), flagged: false });
    if (end > start) segments.push({ text: text.slice(start, end), flagged: true });
    cursor = end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), flagged: false });
  return segments;
}

/**
 * The text immediately around an issue, for the reason list. Newlines are
 * shown as `↵` so a snippet stays on one line.
 */
export function issueContext(
  text: string,
  issue: WritingIssue,
  pad = 14
): { before: string; target: string; after: string } {
  const clean = (value: string) => value.replace(/\r?\n/g, "↵");
  return {
    before: clean(text.slice(Math.max(0, issue.start - pad), issue.start)),
    target: clean(text.slice(issue.start, issue.end)),
    after: clean(text.slice(issue.end, Math.min(text.length, issue.end + pad))),
  };
}
