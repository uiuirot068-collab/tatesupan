// TSP-LOOP-001 sub-issue regression check: `【改ページ】` must only act as a
// forced page break when it is the sole content of its line; any other
// occurrence must render as literal text. Run with:
//   node scripts/verify-page-break-marker.mjs
// No test framework is configured in this project (no node_modules/lockfile
// at all) — this uses only Node's built-in TS type-stripping (Node >=23.6)
// and node:assert so it needs no new dependency.
import assert from "node:assert/strict";
import {
  tokenizeTategaki,
  insertPageBreakMarker,
  PAGE_BREAK_MARKER,
} from "../src/lib/tategaki.ts";

const hasPageBreak = (tokens) => tokens.some((t) => t.type === "pageBreak");

const rebuildText = (tokens) =>
  tokens
    .map((t) => {
      if (t.type === "text") return t.value;
      if (t.type === "ruby") return t.base;
      if (t.type === "tcy") return t.value;
      return ""; // pageBreak / image contribute no literal text
    })
    .join("");

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    console.log(`FAIL: ${name}`);
    failures += 1;
  }
}

// 1. Standalone marker alone on its line -> real forced break.
check("standalone marker breaks", hasPageBreak(tokenizeTategaki(PAGE_BREAK_MARKER)));
check(
  "standalone marker mid-document breaks",
  hasPageBreak(tokenizeTategaki("abc\n【改ページ】\ndef"))
);
check(
  "standalone marker padded with whitespace on its line still breaks",
  hasPageBreak(tokenizeTategaki("abc\n　【改ページ】　\ndef"))
);

// 2. Inline occurrence (not alone on its line) -> literal text, no break.
{
  const text = "これは【改ページ】の使い方です。";
  const tokens = tokenizeTategaki(text);
  check("inline marker does not break", !hasPageBreak(tokens));
  check("inline marker text preserved exactly", rebuildText(tokens) === text);
}
{
  const text = "【改ページ】です";
  const tokens = tokenizeTategaki(text);
  check("marker with trailing text does not break", !hasPageBreak(tokens));
  check("marker with trailing text preserved exactly", rebuildText(tokens) === text);
}

// 3. The shipped built-in sample-guide sentence must not lose text / split.
{
  const text = "【改ページ】と入力すると、任意の場所で強制的に改ページが挿入されます。";
  const tokens = tokenizeTategaki(text);
  check("built-in sample guide sentence does not break", !hasPageBreak(tokens));
  check("built-in sample guide sentence text fully preserved", rebuildText(tokens) === text);
}

// 4. The exact QA fixture sentence that originally exposed the bug.
{
  const text = "・重要：改ページ＝【改ページ】、＃改ページ、は使わない。";
  const tokens = tokenizeTategaki(text);
  check("QA fixture sentence does not break", !hasPageBreak(tokens));
  check("QA fixture sentence text fully preserved", rebuildText(tokens) === text);
}

// 5. insertPageBreakMarker: mid-line insertion (editor button / reorder
// splice) must still land on its own line and function as a real break.
{
  const before = "これはテスト用の会話文です";
  const after = "と彼女は言った。";
  const marker = insertPageBreakMarker(before, after);
  const spliced = before + marker + after;
  const tokens = tokenizeTategaki(spliced);
  check("mid-line insertion still breaks", hasPageBreak(tokens));
  check(
    "mid-line insertion preserves surrounding text (plus the 2 newlines it must add)",
    rebuildText(tokens) === before + "\n\n" + after
  );
}
check(
  "insertion at document start still breaks",
  hasPageBreak(tokenizeTategaki(insertPageBreakMarker("", "rest") + "rest"))
);
check(
  "insertion at document end still breaks",
  hasPageBreak(tokenizeTategaki("start" + insertPageBreakMarker("start", "")))
);
check(
  "insertion already at a line boundary adds no redundant blank line",
  insertPageBreakMarker("line one\n", "\nline two") === PAGE_BREAK_MARKER
);

// 6. Regression: ruby / TCY / ――(dash) / ……(ellipsis) unaffected.
{
  const text = "｜漢字《かんじ》のテストと12月25日、それに――ダッシュと……リーダー。";
  const tokens = tokenizeTategaki(text);
  check(
    "ruby token unaffected",
    tokens.some((t) => t.type === "ruby" && t.base === "漢字" && t.rt === "かんじ")
  );
  check("tcy tokens unaffected", tokens.filter((t) => t.type === "tcy").length === 2);
  check(
    "dash run preserved as literal text",
    tokens.some((t) => t.type === "text" && t.value.includes("――"))
  );
  check(
    "ellipsis run preserved as literal text",
    tokens.some((t) => t.type === "text" && t.value.includes("……"))
  );
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
