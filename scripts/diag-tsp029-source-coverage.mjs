// TSP-LOOP-029 — Preview source-coverage diagnostic.
//
// Pastes a manuscript into the real editor, reads back every rendered
// `.tategaki-line`, and proves the LIVE Preview renders every source
// character, in order, with no drop and no duplicate — the bug HUMAN QA found
// (「いる」→「い」, 「斧を」→「斧」: a paragraph-first line filled to charsPerLine
// silently lost its last content cell to the auto one-cell 一字下げ).
//
// Whitespace note: U+3000 (full-width space) is stripped from BOTH sides
// before comparison — the renderer legitimately adds one U+3000 cell of
// 一字下げ that has no source character, and this diagnostic targets CONTENT
// loss, not whitespace.
//
//   CHROME=... PORT=3000 node scripts/diag-tsp029-source-coverage.mjs
//   # optional: MANUSCRIPT=/path/to/your.txt
import fs from "node:fs";

const CHROME =
  process.env.CHROME ||
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = `http://localhost:${process.env.PORT || 3000}`;

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  console.error("needs puppeteer-core:  npm i -D --no-save puppeteer-core");
  process.exit(2);
}

// Default fixture: the two HUMAN-reported paragraphs verbatim + width-boundary
// paragraphs (38/39/40 content chars) so a paragraph-first line lands exactly
// on the cap.
const DEFAULT = [
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」",
  "いつもはひょうきんなくせに、斧を手にすれば驚くほど凛々しい顔をすることも。",
  "あ".repeat(38),
  "い".repeat(39),
  "う".repeat(40),
  "え".repeat(78),
  "お".repeat(120),
  "普通の文章がしばらく続きます。".repeat(40),
].join("\n\n");

const text = process.env.MANUSCRIPT
  ? fs.readFileSync(process.env.MANUSCRIPT, "utf8")
  : DEFAULT;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1100 });
const gridErrors = [];
page.on("console", (m) => {
  if (m.text().includes("[TSP-029]")) gridErrors.push(m.text());
});
await page.goto(`${BASE}/editor?demo=1`, { waitUntil: "networkidle0" });
await page.waitForSelector("textarea", { timeout: 20000 });
await page.evaluate((t) => {
  const ta = document.querySelector("textarea");
  Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    "value",
  ).set.call(ta, t);
  ta.dispatchEvent(new Event("input", { bubbles: true }));
}, text);
await page.waitForFunction(
  () => document.querySelectorAll(".page-card").length >= 1,
  { timeout: 25000 },
);
await page.evaluate(async (s) => {
  for (const w of ["400", "700"]) {
    try {
      await document.fonts.load(`${w} 12px "Shippori Mincho"`, s);
    } catch {}
  }
  await document.fonts.ready;
}, text.slice(0, 300));
await sleep(2500);

// Force every page into the DOM: scroll the preview scroller to the bottom in
// steps so any virtualised page mounts, then read all lines in DOM order.
await page.evaluate(async () => {
  const sc =
    document.querySelector(".page-card")?.closest("[data-export-scale-root]")
      ?.parentElement ||
    document.querySelector('[class*="overflow"]');
  for (let k = 0; k < 30; k++) {
    (sc || document.scrollingElement).scrollBy(0, 4000);
    await new Promise((r) => setTimeout(r, 120));
  }
});
await sleep(600);
const rendered = await page.evaluate(() => {
  // page-cards can be laid out as 見開き spreads (right page before left in
  // reading order but not always in DOM order) — order them by their nombre.
  const cards = [...document.querySelectorAll(".page-card")].map((card, domIdx) => {
    const nombre = card.querySelector("[data-nombre]")?.textContent?.trim();
    const n = nombre && /^\d+$/.test(nombre) ? +nombre : domIdx + 1;
    let text = "";
    card.querySelectorAll(".tategaki-line").forEach((ln) => {
      [...ln.children].forEach((sp) => {
        text += sp.textContent || "";
      });
    });
    return { n, domIdx, text };
  });
  cards.sort((a, b) => a.n - b.n || a.domIdx - b.domIdx);
  return cards.map((c) => c.text).join("");
});
const pageCount = await page.evaluate(
  () => document.querySelectorAll(".page-card").length,
);
await browser.close();

const stripW = (s) => [...s.replace(/[\u3000\n]/g, "")];
const S = stripW(text);
const R = stripW(rendered);

let i = 0;
while (i < S.length && i < R.length && S[i] === R[i]) i++;
const lossless = i === S.length && i === R.length;

console.log(`pages: ${pageCount}`);
  console.log(`source content chars   : ${S.length}`);
console.log(`rendered content chars : ${R.length}`);
if (gridErrors.length) {
  console.log(`\ndev grid-mismatch errors (${gridErrors.length}):`);
  gridErrors.forEach((e) => console.log("  " + e));
}

// explicit HUMAN cases
const cases = [
  ["二人でいること", "「い」 between 二人で | ること"],
  ["斧を手にすれば", "「斧」 between 、くせに | を手にすれば"],
];
console.log("");
for (const [needle, label] of cases) {
  const ok = R.join("").includes(needle);
  console.log(`${ok ? "PASS" : "FAIL"}: ${label}  ("${needle}" in Preview)`);
}

console.log("");
if (lossless) {
  console.log("PASS: Preview source coverage is LOSSLESS — every content character rendered, in order, no drop, no duplicate.");
  process.exit(0);
} else {
  console.log(`FAIL: DIVERGENCE at content index ${i}`);
  console.log(`  source  …${S.slice(Math.max(0, i - 14), i + 14).join("")}…`);
  console.log(`  Preview …${R.slice(Math.max(0, i - 14), i + 14).join("")}…`);
  console.log(`  source[${i}]="${S[i] ?? "<end>"}"  Preview[${i}]="${R[i] ?? "<end>"}"`);
  process.exit(1);
}
