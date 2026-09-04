// TSP-LOOP-029 — export typesetting diagnostic.
//
// Drives the real editor headlessly, renders a page, then compares the LIVE
// preview DOM against the html-to-image clone that every export rasterises:
//   - every slot present in both, at the same slot index
//   - clip headroom of slot 0 (top) and the last slot (bottom) in BOTH
//   - the effective slot pitch and whether it lands on integer CSS px
//
// This is the "did Preview and export diverge" probe from the loop brief.
// It needs a dev server (`npm run dev`) and puppeteer-core + a Chrome path.
//
//   CHROME=/path/to/chrome PORT=3000 node scripts/diag-tsp029-slot-geometry.mjs
//   # optional: MANUSCRIPT=/path/to/your.txt  to use the reporting manuscript
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

const text = process.env.MANUSCRIPT
  ? fs.readFileSync(process.env.MANUSCRIPT, "utf8")
  : Array.from(
      "春夏秋冬東西南北上下左右前後内外大小高低長短新古明暗遠近速遅強弱軽重厚薄広狭深浅太細山川海空森",
    )
      .join("")
      .repeat(20);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1200 });
await page.evaluateOnNewDocument(() => {
  window.__svgs = [];
  const pr = HTMLImageElement.prototype;
  const d = Object.getOwnPropertyDescriptor(pr, "src");
  Object.defineProperty(pr, "src", {
    configurable: true,
    get() {
      return d.get.call(this);
    },
    set(v) {
      if (typeof v === "string" && v.startsWith("data:image/svg+xml"))
        window.__svgs.push(v);
      return d.set.call(this, v);
    },
  });
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

// trigger a JPG export of page 1 so html-to-image builds the clone SVG
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => b.textContent.trim() === "全解除" && !b.disabled)
    ?.click(),
);
await sleep(150);
await page.evaluate(() => {
  const c = document.querySelectorAll(".page-card")[0];
  let r = c.parentElement;
  while (r && !r.querySelector('input[type="checkbox"]')) r = r.parentElement;
  const cb = r?.querySelector('input[type="checkbox"]');
  if (cb && !cb.checked) cb.click();
});
await sleep(250);
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => /書き出し/.test(b.textContent) && !b.disabled)
    ?.click(),
);
await sleep(250);
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => b.textContent.trim() === "JPG")
    ?.click(),
);
for (let i = 0; i < 60; i++) {
  await sleep(500);
  if (!(await page.evaluate(() => !!document.querySelector('[aria-busy="true"]'))))
    break;
}
await sleep(800);

const report = await page.evaluate(() => {
  const url = window.__svgs[window.__svgs.length - 1];
  if (!url) return { error: "no export clone captured" };
  const raw = decodeURIComponent(
    url.replace(/^data:image\/svg\+xml;charset=utf-8,/, ""),
  );
  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const cloneCard = doc.querySelector('[data-page-card="true"]');
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-99999px;top:0";
  host.innerHTML = new XMLSerializer().serializeToString(cloneCard);
  document.body.appendChild(host);

  const rows = (card) => {
    // scale-invariant: use a clientHeight ratio (border-box vs content-box
    // cancels because .page-card border is symmetric) — good enough to undo
    // the live preview zoom for reporting.
    const cr = card.getBoundingClientRect();
    const cont = card.querySelector(".tategaki-line")?.parentElement;
    const contR = cont.getBoundingClientRect();
    const line0 = card.querySelector(".tategaki-line");
    const s = line0 ? line0.offsetHeight / line0.getBoundingClientRect().height || 1 : 1;
    const clipMargin = parseFloat(getComputedStyle(cont).overflowClipMargin || "0") || 0;
    return {
      scale: +s.toFixed(4),
      clipMargin: +(clipMargin * s).toFixed(2),
      contTop: +((contR.top - cr.top) * s).toFixed(3),
      contBot: +((contR.bottom - cr.top) * s).toFixed(3),
      lines: [...card.querySelectorAll(".tategaki-line")].map((ln) => {
        const kids = [...ln.children].filter((k) => (k.textContent || "").trim());
        if (!kids.length) return { n: 0 };
        const box = (sp) => {
          const r = sp.getBoundingClientRect();
          let it = null,
            ib = null;
          try {
            const rg = document.createRange();
            rg.selectNodeContents(sp);
            const rr = rg.getBoundingClientRect();
            it = (rr.top - cr.top) * s;
            ib = (rr.bottom - cr.top) * s;
          } catch {}
          return {
            t: sp.textContent,
            top: +((r.top - cr.top) * s).toFixed(3),
            it: it == null ? null : +it.toFixed(3),
            ib: ib == null ? null : +ib.toFixed(3),
          };
        };
        return {
          n: kids.length,
          first: kids[0].textContent,
          last: kids[kids.length - 1].textContent,
          s0: box(kids[0]),
          s1: box(kids[1]),
          sN1: box(kids[kids.length - 1]),
        };
      }),
    };
  };

  const live = rows(document.querySelectorAll(".page-card")[0]);
  const clone = rows(host.firstElementChild);
  document.body.removeChild(host);
  return { live, clone };
});

if (report.error) {
  console.error("DIAG ERROR:", report.error);
  await browser.close();
  process.exit(1);
}

const { live, clone } = report;
console.log(`live/clone container top   : ${live.contTop} / ${clone.contTop}`);
console.log(`live/clone container bot   : ${live.contBot} / ${clone.contBot}`);
console.log(
  `overflow-clip-margin (L/C) : ${live.clipMargin}px / ${clone.clipMargin}px  ` +
    `(the effective clip is this far BEYOND the box edge — TSP-029 hardening)`,
);
console.log("");
console.log(
  "per line:  n(L/C)  first  last | slot0 ink-top vs BOX edge (px) | last slot ink-bot vs BOX edge   (safe while |value| < clip-margin)",
);
let flags = 0;
const N = Math.max(live.lines.length, clone.lines.length);
for (let i = 0; i < N; i++) {
  const L = live.lines[i],
    C = clone.lines[i];
  if (!L || !C || !L.n || !C.n) {
    console.log(`L${String(i).padStart(2)}  (short / non-grid line)`);
    continue;
  }
  const lTop = (L.s0.it - live.contTop).toFixed(2);
  const cTop = (C.s0.it - clone.contTop).toFixed(2);
  const lBot = (live.contBot - L.sN1.ib).toFixed(2);
  const cBot = (clone.contBot - C.sN1.ib).toFixed(2);
  const mismatch =
    L.n !== C.n || L.first !== C.first || L.last !== C.last;
  const margin = clone.clipMargin || 0.4;
  // ink overshoot beyond the BOX that also exceeds the clip margin = real risk
  const clipRisk = -+cTop > margin || -+cBot > margin;
  if (mismatch || clipRisk) flags++;
  console.log(
    `L${String(i).padStart(2)}  ${L.n}/${C.n}  "${L.first}" "${L.last}"  ` +
      `| top L/C ${lTop}/${cTop}  | bot L/C ${lBot}/${cBot}` +
      (mismatch ? "  <<< CLONE/LIVE MISMATCH" : "") +
      (clipRisk ? "  <<< INK OVERSHOOT EXCEEDS CLIP MARGIN" : ""),
  );
}

// pitch check
const pitchLive =
  live.lines.filter((l) => l.n).length > 1
    ? live.lines.find((l) => l.n).s1.top - live.lines.find((l) => l.n).s0.top
    : null;
console.log("");
console.log(
  `effective slot pitch (live): ${pitchLive == null ? "n/a" : pitchLive.toFixed(4)}px  ` +
    `(integer: ${pitchLive != null && Math.abs(pitchLive - Math.round(pitchLive)) < 0.05})`,
);
console.log(
  `\n${flags === 0 ? "OK — clone matches live and edge glyphs have clip slack" : `${flags} line(s) flagged — see above`}`,
);
await browser.close();
process.exit(flags === 0 ? 0 : 1);
