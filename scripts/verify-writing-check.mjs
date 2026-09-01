// TSP-LOOP-004 「文章チェック β」 regression gate.
//
// The checker is pure, local and deterministic — NO network, NO external API,
// NO AI, NO auto-fix. This verifies the beta rules (R1 括弧対応 / R2 句読点
// 重複 / R3 TateSpun 明示記法の破損) against the spec's fixture set, plus
// multiline / emoji / CRLF / overlapping / offset-accuracy edge cases, and
// that the built-in 使い方ガイド stays free of false positives.
//
// Run:  node scripts/verify-writing-check.mjs
// Uses only Node's built-in TS type-stripping + node:assert — no new dep.
import assert from "node:assert/strict";
import {
  analyzeWriting,
  mergeIssueRanges,
  buildWritingSegments,
  issueContext,
} from "../src/lib/writingCheck.ts";
import { SAMPLE_PROJECT } from "../src/constants/sampleData.ts";

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    console.log(`FAIL: ${name}`);
    failures += 1;
  }
}

// -------------------------------------------------------------------------
// NO ISSUE — must stay completely silent (false-positive minimisation).
// -------------------------------------------------------------------------
const CLEAN = [
  "今日はいい天気だった。",
  "「今日はいい天気だ」",
  "『これは小説です』",
  "！？",
  "！！",
  "？！",
  "……",
  "――",
  "【改ページ】",
  "章タイトル【改ページ】",
  "これは【改ページ】という文字です",
  "[tate]A5[/tate]",
  "｜漢字《かんじ》",
  // extra realistic clean cases
  "「彼は『おはよう』と言った」",
  "用紙は[tate]A5[/tate]、西暦[tate]2026[/tate]年。",
  "▶①ページ設定｜▶②ノンブル・柱｜▶③メモ｜④？",
  "《》を使うと文字にルビを振れます。",
  "多段の「引用が\n改行をまたいでも」問題ありません。",
];
for (const src of CLEAN) {
  check(`no issue: ${JSON.stringify(src)}`, analyzeWriting(src).length === 0);
}

// -------------------------------------------------------------------------
// ISSUE — must flag, with the expected rule.
// -------------------------------------------------------------------------
const DIRTY = [
  ["今日は晴れ。。", "R2-punct", "。。"],
  ["これは、、文章です", "R2-punct", "、、"],
  ["「閉じていない文章", "R1-bracket", "「"],
  ["『テスト」", "R1-bracket", "」"],
  ["用紙は[tate]です", "R3-tcy", "[tate]"], // no closing [/tate]
  ["西暦[tate]ABCDEFGHIJ[/tate]年", "R3-tcy", "[tate]"], // inner > 8 chars
  ["ここで[tate]改\nされた", "R3-tcy", "[tate]"], // newline inside
  ["｜漢字《かんじ", "R3-ruby", "｜漢字《かんじ"], // unclosed 》
  ["｜《かんじ》", "R3-ruby", "｜《かんじ》"], // empty base
  ["｜漢字《》です", "R3-ruby", "｜漢字《》"], // empty reading
];
for (const [src, ruleId, slice] of DIRTY) {
  const issues = analyzeWriting(src);
  const hit = issues.find((i) => i.ruleId === ruleId);
  check(`issue: ${JSON.stringify(src)} -> ${ruleId}`, Boolean(hit));
  if (hit) {
    check(
      `issue slice exact: ${JSON.stringify(src)}`,
      src.slice(hit.start, hit.end) === slice
    );
  }
}

// -------------------------------------------------------------------------
// "A broken implementation goes RED" — a load-bearing minimal assertion.
// -------------------------------------------------------------------------
{
  const issues = analyzeWriting("「");
  check(
    "RED guard: a lone 「 is exactly one R1 issue covering the 「",
    issues.length === 1 &&
      issues[0].ruleId === "R1-bracket" &&
      issues[0].start === 0 &&
      issues[0].end === 1
  );
}

// -------------------------------------------------------------------------
// multiline
// -------------------------------------------------------------------------
{
  const src = "一行目「未完\n二行目です";
  const issues = analyzeWriting(src);
  check(
    "multiline: unmatched opening reported at the 「 on line 1",
    issues.length === 1 && src.slice(issues[0].start, issues[0].end) === "「"
  );
}
{
  // A properly closed quote spanning a newline is fine.
  check(
    "multiline: bracket closed on a later line is not flagged",
    analyzeWriting("「一行目\n二行目」").length === 0
  );
}

// -------------------------------------------------------------------------
// emoji / surrogate pairs — offsets are UTF-16 code units
// -------------------------------------------------------------------------
{
  const src = "😀😀「とじない"; // "😀😀" = 4 UTF-16 units, 「 at index 4
  const issues = analyzeWriting(src);
  check(
    "emoji: 「 offset is the UTF-16 code-unit index (4)",
    issues.some((i) => i.start === 4 && src.slice(i.start, i.end) === "「")
  );
}
{
  const src = "宝物《たからもの😀》"; // emoji inside a no-marker ruby reading — not an explicit attempt, no crash
  check("emoji inside 《》 without marker: no issue, no throw", analyzeWriting(src).length === 0);
}

// -------------------------------------------------------------------------
// CRLF vs LF — offsets unaffected because the source is scanned as-is
// -------------------------------------------------------------------------
{
  const crlf = "行1。。\r\n行2、、";
  const lf = "行1。。\n行2、、";
  const ci = analyzeWriting(crlf);
  const li = analyzeWriting(lf);
  check("CRLF: two punct runs flagged", ci.length === 2);
  check(
    "CRLF: slices are exact",
    crlf.slice(ci[0].start, ci[0].end) === "。。" &&
      crlf.slice(ci[1].start, ci[1].end) === "、、"
  );
  check(
    "CRLF vs LF: second run offset shifts by exactly the extra \\r",
    ci[1].start - li[1].start === 1
  );
}

// -------------------------------------------------------------------------
// overlapping / touching issues — merge for display, keep every reason
// -------------------------------------------------------------------------
{
  const src = "「。。"; // unmatched 「 at 0, 。。 run at 1..3 — touching
  const issues = analyzeWriting(src);
  const merged = mergeIssueRanges(issues);
  check("overlap: 2 distinct issues kept for the reason list", issues.length === 2);
  check("overlap: touching ranges merge to 1 display range", merged.length === 1);
  check(
    "overlap: merged range covers both",
    merged[0].start === 0 && merged[0].end === 3
  );
  const segments = buildWritingSegments(src, merged);
  check(
    "overlap: segments still reconstruct the source exactly",
    segments.map((s) => s.text).join("") === src
  );
}

// -------------------------------------------------------------------------
// buildWritingSegments always round-trips the source (overlay can't drift)
// -------------------------------------------------------------------------
for (const src of [
  ...CLEAN,
  ...DIRTY.map((row) => row[0]),
  "普通の文。「あ」\n😀『い』。。ここまで",
  "",
]) {
  const segments = buildWritingSegments(src, mergeIssueRanges(analyzeWriting(src)));
  check(
    `segments round-trip: ${JSON.stringify(src)}`,
    segments.map((s) => s.text).join("") === src
  );
}

// -------------------------------------------------------------------------
// offset accuracy — every issue range is inside the string and non-empty
// -------------------------------------------------------------------------
{
  const src = "前置き、、あと『未完のまま[tate]XYZ 終端\n次の行「";
  for (const issue of analyzeWriting(src)) {
    check(
      `offset sane for ${issue.ruleId} ${JSON.stringify(src.slice(issue.start, issue.end))}`,
      issue.start >= 0 &&
        issue.end <= src.length &&
        issue.start < issue.end &&
        typeof issue.message === "string" &&
        issue.message.length > 0
    );
  }
  // issueContext never throws and target matches the slice
  for (const issue of analyzeWriting(src)) {
    const ctx = issueContext(src, issue);
    check(
      `issueContext target matches slice for ${issue.ruleId}`,
      ctx.target === src.slice(issue.start, issue.end).replace(/\r?\n/g, "↵")
    );
  }
}

// -------------------------------------------------------------------------
// R2 restraint — β does not flag intentional-looking marks
// -------------------------------------------------------------------------
for (const src of ["すごい！！", "本当に？！", "まさか！？", "そして……", "彼は――"]) {
  check(`R2 restraint: ${JSON.stringify(src)} not flagged`, analyzeWriting(src).length === 0);
}

// -------------------------------------------------------------------------
// The shipped 使い方ガイド must stay silent (no false positives in our own doc).
// -------------------------------------------------------------------------
{
  const issues = analyzeWriting(SAMPLE_PROJECT.content);
  check(
    `built-in 使い方ガイド produces no 確認候補 (got ${issues.length})`,
    issues.length === 0
  );
}

// -------------------------------------------------------------------------
// sanity: analyzeWriting is stable / sorted / pure
// -------------------------------------------------------------------------
{
  const src = "後ろ『ダメ そして「ここ。。";
  const a = analyzeWriting(src);
  const b = analyzeWriting(src);
  check("pure: same input -> same output", JSON.stringify(a) === JSON.stringify(b));
  check(
    "sorted: issues are in ascending start order",
    a.every((issue, i) => i === 0 || a[i - 1].start <= issue.start)
  );
}

assert.ok(true); // node:assert is imported for parity with sibling gates

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
