// Page-break marker regression check. `【改ページ】` is a forced break when
// NOTHING VISIBLE follows it on its line — three canonical user-facing cases:
//   CASE 1  `【改ページ】`            alone on the line          -> break, marker hidden
//   CASE 2  `章タイトル【改ページ】`   at the end of a text line   -> render text, then break
//   CASE 3  `これは【改ページ】と…`    visible text after it       -> literal, no break
// `＃改ページ` is obsolete and always literal. Run with:
//   node scripts/verify-page-break-marker.mjs
// No test framework is configured in this project (no node_modules/lockfile
// at all) — this uses only Node's built-in TS type-stripping (Node >=23.6)
// and node:assert so it needs no new dependency.
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  tokenizeTategaki,
  detokenizeTategaki,
  insertImageMarker,
  insertPageBreakMarker,
  PAGE_BREAK_MARKER,
} from "../src/lib/tategaki.ts";
import { SAMPLE_PROJECT } from "../src/constants/sampleData.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

// 2c. TSP-LOOP-003 — the three canonical cases, end to end.
{
  const noLiteral = (tokens) => !rebuildText(tokens).includes(PAGE_BREAK_MARKER);
  // CASE 1 — standalone
  for (const [label, src] of [
    ["bare", PAGE_BREAK_MARKER],
    ["mid-doc", "第一章。\n【改ページ】\n第二章。"],
    ["whitespace-padded", "第一章。\n　【改ページ】　\n第二章。"],
    ["first line", "【改ページ】\n冒頭。"],
    ["last line", "末尾。\n【改ページ】"],
  ]) {
    const t = tokenizeTategaki(src);
    check(`CASE 1 (${label}): breaks and marker hidden`, hasPageBreak(t) && noLiteral(t));
  }
  // CASE 2 — end-of-line command: visible text before is kept, marker consumed, break follows
  for (const [label, before, next] of [
    ["heading", "■特等席ああああ", "次の本文。"],
    ["short title", "章タイトル", "次章の本文。"],
    ["trailing spaces", "本文の続き", "次。"],
    ["trailing ZWSP", "本文の続き", "次。"],
    ["trailing Cf+VS", "本文の続き", "次。"],
    ["filename (Latin run)", "report_final.pdf", "次。"],
    ["punctuation before", "終わりだ。", "次。"],
  ]) {
    const trailer = label === "trailing spaces" ? "   " : label === "trailing ZWSP" ? "​" : label === "trailing Cf+VS" ? "⁠︎" : "";
    const src = `${before}【改ページ】${trailer}\n${next}`;
    const t = tokenizeTategaki(src);
    const txt = rebuildText(t);
    check(
      `CASE 2 (${label}): breaks, marker hidden, leading text kept`,
      hasPageBreak(t) && noLiteral(t) && txt.includes(before) && txt.includes(next)
    );
    check(
      `CASE 2 (${label}): no stray character before the next page's text`,
      t.slice(t.findIndex((x) => x.type === "pageBreak") + 1)
        .map((x) => (x.type === "text" ? x.value : ""))
        .join("") === "\n" + next
    );
  }
  // CASE 2 — ruby / TCY immediately before the marker must survive as tokens
  {
    const t = tokenizeTategaki("｜漢字《かんじ》【改ページ】\n次。");
    check(
      "CASE 2 (ruby before): ruby token preserved and break emitted",
      hasPageBreak(t) && t.some((x) => x.type === "ruby" && x.base === "漢字" && x.rt === "かんじ")
    );
  }
  {
    const t = tokenizeTategaki("昭和12年【改ページ】\n次。");
    check(
      "CASE 2 (TCY before): tcy token preserved and break emitted",
      hasPageBreak(t) && t.some((x) => x.type === "tcy" && x.value === "12")
    );
  }
  // CASE 3 — visible text after the marker on the same line -> literal, no break
  for (const [label, src] of [
    ["mid-sentence", "これは【改ページ】という文字です"],
    ["trailing word", "【改ページ】です"],
    ["marker then text", "章タイトル【改ページ】ここも同じ行"],
    ["quoted in prose", "『【改ページ】』と入力します。"],
  ]) {
    const t = tokenizeTategaki(src);
    check(`CASE 3 (${label}): literal, no break`, !hasPageBreak(t) && rebuildText(t) === src);
  }
  // consecutive standalone markers (blank page between)
  {
    const t = tokenizeTategaki("A。\n【改ページ】\n【改ページ】\nB。");
    check("consecutive standalone markers break twice, no literal", hasPageBreak(t) && noLiteral(t) &&
      t.filter((x) => x.type === "pageBreak").length === 2);
  }
  // image-adjacent CASE 2 (marker ends a line that a following image is on its own line)
  {
    const t = tokenizeTategaki("扉ページ【改ページ】\n【IMG:x:60:80:center】\n本文。");
    check("CASE 2 + following image line: break + image both survive",
      hasPageBreak(t) && t.some((x) => x.type === "image") && noLiteral(t));
  }
}

// 2b. TSP-LOOP-003 real-manuscript regression: a marker-only line that also
// carries an invisible zero-width / format character (ZWSP U+200B, word
// joiner U+2060, soft hyphen U+00AD, ZWNJ/ZWJ, variation selector) — the
// kind real manuscripts pasted from web pages / word processors routinely
// pick up — must still be recognised as a standalone forced break, and the
// marker itself must still be consumed (not rendered as literal text).
{
  const invisibles = {
    "ZWSP trailing": "​",
    "ZWSP leading": "",
    "word joiner trailing": "⁠",
    "soft hyphen trailing": "­",
    "ZWNJ trailing": "‌",
    "variation selector trailing": "︎",
    "bidi LRM trailing": "‎",
  };
  for (const [label, ch] of Object.entries(invisibles)) {
    const lead = label.includes("leading") ? ch : "";
    const trail = label.includes("leading") ? "" : ch;
    const src = `第一章の本文。\n${lead}${PAGE_BREAK_MARKER}${trail}\n第二章の本文。`;
    const tokens = tokenizeTategaki(src);
    check(`marker line with ${label} still breaks`, hasPageBreak(tokens));
    check(`marker line with ${label} does not leak literal text`, !rebuildText(tokens).includes(PAGE_BREAK_MARKER));
    check(
      `marker line with ${label} preserves surrounding text`,
      rebuildText(tokens).includes("第一章の本文。") && rebuildText(tokens).includes("第二章の本文。")
    );
    // The invisible character that shared the marker's line must be consumed
    // with the marker, not leak onto the next page as a stray blank line.
    const pbIdx = tokens.findIndex((t) => t.type === "pageBreak");
    const afterText = tokens.slice(pbIdx + 1).map((t) => (t.type === "text" ? t.value : "")).join("");
    check(
      `marker line with ${label} leaves no stray character before the next page's text`,
      afterText === "\n第二章の本文。"
    );
  }
  // Also with manual indentation on the following line (the case that made a
  // leaked char visible as a double-indented blank line).
  {
    const src = `本文A。\n${PAGE_BREAK_MARKER}​\n　　　第二章。`;
    const tokens = tokenizeTategaki(src);
    const pbIdx = tokens.findIndex((t) => t.type === "pageBreak");
    const afterText = tokens.slice(pbIdx + 1).map((t) => (t.type === "text" ? t.value : "")).join("");
    check("ZWSP marker + manual indent: next page text is exactly the indented line", afterText === "\n　　　第二章。");
  }
}
// A genuinely inline marker that also has an invisible char must STILL stay
// literal (the fix must not widen "standalone" to "has the marker somewhere").
{
  const text = "本文に​【改ページ】​と書く。次の文。";
  const tokens = tokenizeTategaki(text);
  check("inline marker with zero-width chars stays literal", !hasPageBreak(tokens));
  check("inline marker with zero-width chars keeps its text", rebuildText(tokens) === text);
}

// 3. The shipped built-in sample document ("使い方ガイド") explains the 3
// cases in prose — every 【改ページ】 mention in it must be a CASE-3 inline
// literal (visible text after it on its line), so the sample never loses text
// or gains a spurious page split from its own documentation.
{
  const tokens = tokenizeTategaki(SAMPLE_PROJECT.content);
  const markerBreaks = tokens.filter((t) => t.type === "pageBreak").length;
  check("built-in sample doc: its 改ページ prose creates no page break", markerBreaks === 0);
  check(
    "built-in sample doc: every 【改ページ】 mention renders as literal text",
    (SAMPLE_PROJECT.content.match(/【改ページ】/g) || []).length ===
      (rebuildText(tokens).match(/【改ページ】/g) || []).length
  );
  // Round-trips exactly through detokenize (which restores 【改ページ】, ｜ruby《》,
  // and [tate]…[/tate] to their marker form) — the sample loses nothing.
  check("built-in sample doc: round-trips through tokenize/detokenize",
    detokenizeTategaki(tokens) === SAMPLE_PROJECT.content);
  check(
    "built-in sample doc: recommends 【改ページ】, not ＃改ページ, as the syntax",
    SAMPLE_PROJECT.content.includes("改ページの記法は【改ページ】") &&
      SAMPLE_PROJECT.content.includes("＃改ページは使いません")
  );
  check("built-in sample doc: 縦中横 section shows the [tate]…[/tate] notation",
    SAMPLE_PROJECT.content.includes("[tate]") && SAMPLE_PROJECT.content.includes("[/tate]"));
}

// 3b. The in-app Help (public/docs/help.md, shown in HelpModal) must document
// the same 3 cases and must not still instruct the obsolete ＃改ページ.
{
  const help = fs.readFileSync(path.join(repoRoot, "public/docs/help.md"), "utf8");
  const kaipageSection = help.slice(help.indexOf("## 改ページ"), help.indexOf("## 印刷設定"));
  check("help.md: 改ページ section documents CASE 1 (改ページだけを書く)", /改ページだけを書く/.test(kaipageSection));
  check("help.md: 改ページ section documents CASE 2 (行の最後につける)", /行の最後につける/.test(kaipageSection));
  check("help.md: 改ページ section documents CASE 3 (文章の途中に書く)", /文章の途中に書く/.test(kaipageSection));
  check("help.md: 改ページ section states the syntax is 【改ページ】", /記法は\s*`?【改ページ】/.test(kaipageSection));
  check(
    "help.md: 改ページ section no longer instructs ＃改ページ as the syntax",
    !/^```\s*\n?＃改ページ/m.test(kaipageSection) && /＃改ページ.*(使いません|使わない)/.test(kaipageSection)
  );
  check(
    "help.md: 改ページ section drops the old 'その行に記号だけを書いてください' standalone-only wording",
    !/記号だけを書いてください/.test(kaipageSection)
  );
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

// 6. Image insertion must not turn an adjacent standalone page-break marker
// into inline literal text.
{
  const before = "第二章本文\n";
  const after = PAGE_BREAK_MARKER + "\n第三章本文";
  const image = "【IMG:test:10:20:center】";
  const spliced = before + insertImageMarker(before, image, after) + after;
  const tokens = tokenizeTategaki(spliced);
  check("image inserted on its own line before page break", spliced === before + image + "\n" + after);
  check("image insertion preserves standalone page break", hasPageBreak(tokens));
  check("image insertion preserves page-break count", tokens.filter((t) => t.type === "pageBreak").length === 1);
  const rebuilt = rebuildText(tokens);
  check(
    "image insertion preserves surrounding text",
    rebuilt.includes("第二章本文") &&
      rebuilt.includes("第三章本文") &&
      rebuilt.match(/第二章本文/g)?.length === 1 &&
      rebuilt.match(/第三章本文/g)?.length === 1
  );
}
{
  const before = "段落の途中";
  const after = "です。ここで【改ページ】と書いた。";
  const image = "【IMG:test:10:20:center】";
  const spliced = before + insertImageMarker(before, image, after) + after;
  const tokens = tokenizeTategaki(spliced);
  check("mid-text image insertion adds only required newlines", spliced === before + "\n" + image + "\n" + after);
  check("inline literal marker remains literal after image insertion", !hasPageBreak(tokens));
  check("inline literal marker text remains present", rebuildText(tokens) === before + "\n\n" + after);
}
check(
  "image insertion at existing line boundaries adds no redundant newline",
  insertImageMarker("line one\n", "【IMG:test:10:20:center】", "\nline two") ===
    "【IMG:test:10:20:center】"
);

// 7. Regression: ruby / TCY / ――(dash) / ……(ellipsis) unaffected.
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
