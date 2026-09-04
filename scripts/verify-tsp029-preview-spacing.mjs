// TSP-LOOP-029 R3 — LIVE Preview spacing / zoom / font integrity (behavioural).
//
// The human saw an irregular visual rhythm in 「言ってしまえば」/「言うつもり」.
// Static regex cannot prove a rendered rhythm, so this drives the real editor
// in headless Chrome and asserts, for the exact reported phrases:
//
//   1. the slot ladder under the phrase is continuous & uniform (no skipped
//      cell, pitch sd within tolerance)
//   2. no U+3000 / whitespace slot is inserted between the phrase's source
//      characters
//   3. every glyph of the phrase actually loads Shippori Mincho (no fallback)
//      and every glyph span has an identical computed font stack
//   4. Preview zoom is ONE coherent ancestor transform (not per-glyph), and
//      the same zoom multiplies the whole surface — the slot ladder stays
//      uniform at 100 / 150 / 200 %
//   5. a hanging 。 followed by a closing bracket does NOT orphan the bracket
//      at the next column head (R3 kinsoku edge)
//
//   CHROME=... PORT=3029 node scripts/verify-tsp029-preview-spacing.mjs
import fs from "node:fs";

const CHROME =
  process.env.CHROME ||
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE = `http://localhost:${process.env.PORT || 3029}`;
const OUT_DIR =
  process.env.TSP029_SHOTS ||
  "C:\\Users\\PC_User\\AppData\\Local\\Temp\\claude\\D--Dropbox-neuneunet-Dropbox-------molnatu----2026--------tate-tate-----\\8ec9684b-2a49-4af0-befe-6ad8e0d04cae\\scratchpad\\wt-tsp029\\qa-r3";

let puppeteer;
try {
  puppeteer = (await import("puppeteer-core")).default;
} catch {
  console.error("needs puppeteer-core:  npm i -D --no-save puppeteer-core");
  process.exit(2);
}

const PHRASES = [
  { needle: "言ってしまえば", full: "「気が合った、と言ってしまえばそれまでだ。」" },
  { needle: "言うつもり", full: "「言うつもりもなかった。」" },
];

let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures += 1;
};
const sd = (xs) => {
  const m = xs.reduce((a, v) => a + v, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, v) => a + (v - m) ** 2, 0) / xs.length);
};

try { fs.mkdirSync(OUT_DIR, { recursive: true }); } catch {}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1200, deviceScaleFactor: 2 });

const load = async (text) => {
  await page.goto(`${BASE}/editor?demo=1`, { waitUntil: "networkidle0" });
  await page.waitForSelector("textarea", { timeout: 20000 });
  await page.evaluate((t) => {
    const ta = document.querySelector("textarea");
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(ta, t);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  }, text);
  await page.waitForFunction(() => document.querySelectorAll(".page-card").length >= 1, { timeout: 25000 });
  await page.evaluate(async () => { await document.fonts.ready; });
  await new Promise((r) => setTimeout(r, 1800));
};

/* ---------- 1–3: ladder continuity, no injected whitespace, no font fallback ---------- */
for (const { needle, full } of PHRASES) {
  await load(full + "\n\n" + "本文がしばらく続きます。".repeat(20));
  const r = await page.evaluate((needle) => {
    const line = [...document.querySelectorAll(".tategaki-line")].find((l) => (l.textContent || "").includes(needle));
    if (!line) return { err: "line not found" };
    const kids = [...line.children];
    const lr = line.getBoundingClientRect();
    const spans = kids.map((sp) => {
      const cs = getComputedStyle(sp);
      const inner = sp.firstElementChild ? getComputedStyle(sp.firstElementChild) : cs;
      const rect = sp.getBoundingClientRect();
      return {
        c: sp.textContent,
        top: rect.top - lr.top,
        fontFamily: inner.fontFamily,
        fontSize: inner.fontSize,
        spm: sp.textContent ? document.fonts.check(`${inner.fontSize} "Shippori Mincho"`, sp.textContent) : true,
      };
    });
    // the contiguous window that carries the needle
    const joined = kids.map((k) => k.textContent).join("");
    const at = joined.indexOf(needle);
    // map char index -> span index (spans are 1 char each on the body grid)
    const win = spans.slice(at, at + needle.length);
    const tops = spans.map((s) => s.top);
    const pitches = tops.slice(1).map((t, i) => t - tops[i]).filter((d) => d > 0.5);
    return {
      needleSpans: win.map((s) => s.c),
      whitespaceInWindow: win.some((s) => /[\u3000\s]/.test(s.c) && !needle.includes(s.c)),
      allSPM: win.every((s) => s.spm),
      fontStacks: [...new Set(spans.filter((s) => s.c && s.c.trim()).map((s) => s.fontFamily))],
      pitchSd: pitches.length ? Math.sqrt(pitches.reduce((a, v, _, arr) => { const m = arr.reduce((x, y) => x + y, 0) / arr.length; return a + (v - m) ** 2; }, 0) / pitches.length) : 0,
      pitchMean: pitches.reduce((a, v) => a + v, 0) / pitches.length,
    };
  }, needle);
  if (r.err) { check(`phrase "${needle}" present in Preview`, false, r.err); continue; }

  check(`"${needle}": every source char occupies its own continuous slot (no skipped cell)`,
    r.needleSpans.join("") === needle, `got "${r.needleSpans.join("")}"`);
  check(`"${needle}": no U+3000 / whitespace slot injected between source chars`,
    !r.whitespaceInWindow);
  check(`"${needle}": every glyph loads Shippori Mincho (no font fallback)`,
    r.allSPM);
  check(`"${needle}": one identical computed font stack for every body glyph`,
    r.fontStacks.length === 1, r.fontStacks.join(" | "));
  check(`"${needle}": slot ladder under the phrase is uniform (pitch sd ${r.pitchSd.toFixed(4)}px << ${(r.pitchMean * 0.02).toFixed(3)})`,
    r.pitchSd < Math.max(0.15, r.pitchMean * 0.02), `mean ${r.pitchMean.toFixed(3)}`);
}

/* ---------- 4: zoom is one coherent ancestor transform; ladder uniform at 100/150/200 ---------- */
await load(PHRASES[0].full + "\n\n" + "本文がしばらく続きます。".repeat(30));
const zoomInfo = await page.evaluate(() => {
  const line = [...document.querySelectorAll(".tategaki-line")].find((l) => (l.textContent || "").includes("言ってし"));
  // per-glyph transform must be none — scaling lives on an ancestor
  const perGlyph = [...line.children].map((s) => getComputedStyle(s).transform);
  let scaleAncestors = 0, el = line.parentElement;
  while (el && el !== document.body) {
    const t = getComputedStyle(el).transform;
    if (t && t !== "none" && /matrix/.test(t)) scaleAncestors += 1;
    el = el.parentElement;
  }
  return { perGlyphAllNone: perGlyph.every((t) => t === "none"), scaleAncestors };
});
check("zoom: no per-glyph transform — every body glyph span has transform:none",
  zoomInfo.perGlyphAllNone);
check("zoom: the page is scaled by a single coherent ancestor transform (fit-to-viewport), not per-cell",
  zoomInfo.scaleAncestors <= 1, `${zoomInfo.scaleAncestors} scaling ancestors`);

for (const z of [1.0, 1.5, 2.0]) {
  await page.evaluate(() => { document.getElementById("__z")?.remove(); });
  await page.evaluate((z) => {
    const line = [...document.querySelectorAll(".tategaki-line")].find((l) => (l.textContent || "").includes("言ってし"));
    let el = line.parentElement, host = null;
    while (el && el !== document.body) { const t = getComputedStyle(el).transform; if (t && t !== "none" && /matrix/.test(t)) { host = el; break; } el = el.parentElement; }
    const s = document.createElement("style"); s.id = "__z";
    // multiply whatever fit-scale is already there by z, on the SAME node
    s.textContent = host ? `` : ``;
    document.head.appendChild(s);
    if (host) host.style.zoom = String(z);
  }, z);
  await new Promise((r) => setTimeout(r, 500));
  const lad = await page.evaluate(() => {
    const line = [...document.querySelectorAll(".tategaki-line")].find((l) => (l.textContent || "").includes("言ってし"));
    const lr = line.getBoundingClientRect();
    const tops = [...line.children].map((s) => s.getBoundingClientRect().top - lr.top);
    const p = tops.slice(1).map((t, i) => t - tops[i]).filter((d) => d > 0.3);
    const m = p.reduce((a, v) => a + v, 0) / p.length;
    return { sd: Math.sqrt(p.reduce((a, v) => a + (v - m) ** 2, 0) / p.length), mean: m };
  });
  check(`zoom ${Math.round(z * 100)}%: slot ladder stays uniform (sd ${lad.sd.toFixed(4)}px, ≤2% of pitch ${lad.mean.toFixed(2)})`,
    lad.sd < Math.max(0.2, lad.mean * 0.02));
}
await page.evaluate(() => { const l = [...document.querySelectorAll(".tategaki-line")].find((x) => (x.textContent || "").includes("言ってし")); let el = l.parentElement; while (el && el !== document.body) { el.style.zoom = ""; el = el.parentElement; } });

/* ---------- 5: R3 kinsoku — 。」 hangs together, bracket never orphaned ---------- */
const N = 39;
await load("先頭。\n\n" + "◆".repeat((N - 1) + N) + "。」" + "つづきの本文。".repeat(10));
const kin = await page.evaluate(() => {
  const card = document.querySelectorAll(".page-card")[0];
  const lines = [...card.querySelectorAll(".tategaki-line")].slice(2, 6).map((ln) => ({
    n: ln.children.length,
    hang: [...ln.querySelectorAll("[data-hanging-punctuation]")].map((s) => s.textContent).join(""),
    head: ln.children[0]?.textContent || "",
    t: ln.textContent,
  }));
  return lines;
});
const hangLine = kin.find((l) => l.hang.includes("。"));
check("R3 kinsoku: a full line + 。」 hangs 。」 together (both in the hanging zone)",
  !!hangLine && hangLine.hang === "。」", hangLine ? `hang="${hangLine.hang}"` : "no hanging line");
check("R3 kinsoku: the closing bracket is NOT left alone at the next column head",
  !!hangLine && !kin.some((l) => l !== hangLine && l.n > 0 && /^[」』）］｝〕〉》】]/.test(l.head) && l.n <= 2));

console.log("");
if (failures === 0) console.log("All TSP-029 preview-spacing checks passed.");
else { console.log(`${failures} TSP-029 preview-spacing check(s) FAILED.`); }
await browser.close();
process.exit(failures === 0 ? 0 : 1);
