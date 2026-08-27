// TSP-LOOP-003 automated grid regression.
//
// Verifies that every FixedSlot render path in PageCard places its base
// character cells on ONE canonical grid:
//   glyph Y   = columnStart + slotIndex * canonicalSlotExtent
//   column X  = textAreaOrigin + columnIndex * canonicalLinePitch
// for A5 / 1段組, where canonicalSlotExtent must equal the font size (solid
// 1em grid — PAPER_SIZE_TEMPLATES.A5.cols1.gridMode === "solid").
//
// This one needs the app running (unlike verify-page-break-marker.mjs, which
// is pure logic). Start `npm run dev` first, then:
//   node scripts/verify-grid-alignment.mjs [--url http://localhost:3000]
//
// It drives headless Edge/Chrome via the DevTools Protocol (Node's built-in
// global WebSocket + fetch, no new dependency), seeds an A5 document straight
// into IndexedDB, opens the editor, and measures the real rendered DOM.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("--url", process.env.GRID_QA_URL || "http://localhost:3000");
const PORT = 9411;
const UDD = path.join(os.tmpdir(), "tsp-grid-qa-udd");

const EDGE_CANDIDATES = [
  process.env.GRID_QA_BROWSER,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);
const BROWSER = EDGE_CANDIDATES.find((p) => {
  try { return fs.existsSync(p); } catch { return false; }
});

// A5 / 1段組 — must match applyPaperTemplate(A5, 1) + DEFAULT master page.
const A5_SETTINGS = {
  paperSize: "A5", marginTop: 18, marginBottom: 18, marginGutter: 20, marginOuter: 14,
  fontSizePt: 9.0, lineHeightRatio: 1.7, columnCount: 1, columnGapMm: 0,
  fontFamily: "'Shippori Mincho', serif", charsPerLine: 53, linesPerColumn: 22,
  layoutMode: "capacity",
  masterPage: {
    nombrePosition: "center", hideNombreOnFirstPage: false, nombreStart: 1,
    nombreBottomMargin: 8, showHiddenNombre: false, hashiraOdd: "", hashiraEven: "",
    hashiraPosition: "top", headerFontSize: 8, nombreFontSize: 8,
  },
  pageOverrides: {},
};

// One paragraph per case. Case A wraps into several full 53-cell lines.
const CASES = {
  fullLine: "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。何でも薄暗いじめじめした所でニャーニャー泣いていた事だけは記憶している。吾輩はここで始めて人間というものを見た。",
  shortLine: "みじかい行。",
  dialogue: "「こんにちは」と彼女は言った。",
  ruby: "むかし｜漢字《かんじ》の里に蜃気楼《しんきろう》が見えた。",
  tcy: "昭和12年3月25日、45丁目の交差点。",
  dash: "遠くで汽笛が鳴った――そして静寂が訪れた――もう戻れない。",
  ellipsis: "彼は黙った……何も言えなかった……ただ立ち尽くした。",
  punctuation: "「待って！」と、叫んだ。だが、声は、届かなかった。",
  paragraphEnd: "これで終わり。",
};
const FIXTURE = Object.values(CASES).join("\n");

// ---- CDP plumbing (raw WebSocket) ----
let msgId = 0;
const pending = new Map();
function cdp(ws, method, params = {}, sessionId) {
  const id = ++msgId;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((res, rej) => {
    const timer = setTimeout(() => { pending.delete(id); rej(new Error(`CDP timeout: ${method}`)); }, 30000);
    pending.set(id, { res: (v) => { clearTimeout(timer); res(v); }, rej: (e) => { clearTimeout(timer); rej(e); } });
  });
}

const stats = (a) => {
  a = a.filter((x) => x != null);
  if (!a.length) return { n: 0, mean: 0, sd: 0, spread: 0 };
  const mean = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((x, y) => x + (y - mean) ** 2, 0) / a.length);
  return { n: a.length, mean, sd, spread: Math.max(...a) - Math.min(...a) };
};

let failures = 0;
const check = (name, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${detail ? `  (${detail})` : ""}`);
  if (!cond) failures += 1;
};

async function main() {
  if (!BROWSER) {
    console.error("SKIP: no Chrome/Edge binary found. Set GRID_QA_BROWSER=<path>.");
    process.exit(0);
  }
  // reachability
  try {
    const r = await fetch(`${BASE}/editor`, { method: "HEAD" });
    if (!r.ok && r.status !== 405) throw new Error(`status ${r.status}`);
  } catch (e) {
    console.error(`SKIP: dev server not reachable at ${BASE} (${e.message}). Run \`npm run dev\` first.`);
    process.exit(0);
  }

  fs.rmSync(UDD, { recursive: true, force: true });
  const proc = spawn(BROWSER, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${PORT}`, `--user-data-dir=${UDD}`,
    "--window-size=1400,2000", "--hide-scrollbars", "--force-device-scale-factor=1", "about:blank",
  ], { stdio: "ignore" });

  let wsUrl;
  try {
    for (let i = 0; i < 60 && !wsUrl; i++) {
      try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl; } catch {}
      if (!wsUrl) await sleep(500);
    }
    if (!wsUrl) throw new Error("CDP endpoint never came up");

    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && pending.has(m.id)) {
        const { res, rej } = pending.get(m.id);
        pending.delete(m.id);
        if (m.error) rej(new Error(JSON.stringify(m.error)));
        else res(m.result);
      }
    };

    const { targetId } = await cdp(ws, "Target.createTarget", { url: "about:blank" });
    const { sessionId: S } = await cdp(ws, "Target.attachToTarget", { targetId, flatten: true });
    await cdp(ws, "Page.enable", {}, S);
    await cdp(ws, "Runtime.enable", {}, S);

    await cdp(ws, "Page.navigate", { url: `${BASE}/` }, S);
    await sleep(2500);
    const seed = `
      (async () => {
        const rec = { id: 9931, title: 'GRID-QA', content: ${JSON.stringify(FIXTURE)},
          settings: ${JSON.stringify(A5_SETTINGS)}, plotNote: '', updatedAt: Date.now(),
          isCollection: false, includedDocumentIds: [], isSample: false };
        const open = indexedDB.open('tategaki-editor-db');
        return await new Promise((resolve) => {
          open.onsuccess = () => {
            const dbh = open.result;
            try { const tx = dbh.transaction('documents', 'readwrite');
              tx.objectStore('documents').put(rec);
              tx.oncomplete = () => resolve('ok'); tx.onerror = () => resolve('tx-err');
            } catch (e) { resolve('err ' + e.message); }
          };
          open.onerror = () => resolve('open-err');
        });
      })()`;
    const seedRes = await cdp(ws, "Runtime.evaluate", { expression: seed, awaitPromise: true, returnByValue: true }, S);
    if (seedRes.result.value !== "ok") throw new Error("IndexedDB seed failed: " + seedRes.result.value);

    await cdp(ws, "Page.navigate", { url: `${BASE}/editor?id=9931` }, S);
    await sleep(8000);

    const measure = `
    (() => {
      const card = document.querySelector('.page-card, [class*="page-card"]');
      if (!card) return { error: 'no page-card' };
      const R = (el) => { const r = el.getBoundingClientRect();
        return { x:+r.x.toFixed(3), y:+r.y.toFixed(3), w:+r.width.toFixed(3), h:+r.height.toFixed(3) }; };
      const fontPx = parseFloat(getComputedStyle(document.querySelector('.tategaki-line')).fontSize);
      const lines = [...card.querySelectorAll('.tategaki-line')].map((ln) => {
        const kids = [...ln.children].map((k) => {
          const cs = getComputedStyle(k);
          const inner = k.querySelector(':scope > span');
          const ics = inner ? getComputedStyle(inner) : null;
          let kind = 'base';
          if (inner && ics && ics.textCombineUpright === 'all') kind = 'tcy';
          else if ((parseFloat(cs.left) || 0) > 1) kind = 'rt';
          return { kind, text: k.textContent, rect: R(k) };
        });
        return { rect: R(ln), kids };
      });
      return { fontPx, cardRect: R(card), lines };
    })()`;
    const res = await cdp(ws, "Runtime.evaluate", { expression: measure, returnByValue: true }, S);
    const data = res.result.value;
    ws.close();
    proc.kill();

    if (data.error) throw new Error("measurement: " + data.error);

    // preview render scale (card is drawn at PX_PER_MM then CSS-scaled to fit)
    const scale = data.cardRect.h / ((210 + 6) * 2.2);
    const fontPxScaled = data.fontPx * scale;
    const TOL = 0.5; // px, coordinate deviation tolerance (preview-space; sub-pixel)
    const ADV_TOL = 0.02; // mean advance may differ from fontSize by <= 2%

    console.log(`\nA5 grid regression — scale ${scale.toFixed(4)}, fontPx ${data.fontPx} (scaled ${fontPxScaled.toFixed(3)}), tolerance ${TOL}px\n`);

    // 1. column X advance is one constant pitch
    const colXs = data.lines.map((l) => l.rect.x);
    const colAdv = colXs.slice(1).map((x, i) => Math.abs(colXs[i] - x));
    const colStat = stats(colAdv);
    check("canonical column X — single constant pitch", colStat.sd <= TOL,
      `advance mean=${colStat.mean.toFixed(3)} sd=${colStat.sd.toFixed(4)} spread=${colStat.spread.toFixed(3)}`);

    // 2. per-case base-glyph Y advance == canonical solid slot extent (fontPx)
    const caseNames = Object.keys(CASES);
    // map columns -> cases by reading text; the fixture columns are in fixture order,
    // but paragraph A wraps, so match by first meaningful glyph.
    const wanted = {
      fullLine: "吾輩", shortLine: "みじ", dialogue: "「こんにちは", ruby: "むかし",
      tcy: "昭和", dash: "遠くで", ellipsis: "彼は黙", punctuation: "「待って", paragraphEnd: "これで",
    };
    // base text of a column, minus the render-time auto-indent (full-width space)
    const colText = (l) =>
      l.kids.filter((k) => k.kind === "base").map((k) => k.text).join("").replace(/^[\s　]+/, "");
    const poolBaseAdv = [];
    for (const name of caseNames) {
      const needle = wanted[name];
      const col = data.lines.find((l) => colText(l).startsWith(needle));
      if (!col) { check(`${name} — column located`, false); continue; }
      const base = col.kids.filter((k) => k.kind === "base");
      const ys = base.map((b) => b.rect.y);
      const adv = ys.slice(1).map((y, i) => y - ys[i]);
      const xs = base.map((b) => b.rect.x);
      const xdev = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
      const rt = col.kids.filter((k) => k.kind === "rt");
      const tcy = col.kids.filter((k) => k.kind === "tcy");

      if (name === "tcy") {
        // base advance straddles the tcy cell -> just require every gap is a
        // whole multiple of the canonical extent, and the tcy cell height ~1 slot.
        const multiples = adv.map((d) => d / fontPxScaled);
        const allWhole = multiples.every((m) => Math.abs(m - Math.round(m)) < 0.06 && Math.round(m) >= 1);
        check("tcy — base advance is whole multiples of canonical slot", allWhole,
          `multiples ${multiples.map((m) => m.toFixed(2)).join(",")}`);
        check("tcy — cell occupies exactly one canonical slot",
          tcy.length > 0 && tcy.every((c) => Math.abs(c.rect.h - fontPxScaled) <= TOL),
          `tcy h ${tcy.map((c) => c.rect.h.toFixed(2)).join(",")} vs ${fontPxScaled.toFixed(2)}`);
        continue;
      }

      const s = stats(adv);
      poolBaseAdv.push(...adv);
      check(`${name} — base glyph Y advance uniform`, s.sd <= TOL && s.spread <= TOL,
        `sd=${s.sd.toFixed(4)} spread=${s.spread.toFixed(3)}`);
      check(`${name} — advance == canonical solid slot (1em)`,
        Math.abs(s.mean - fontPxScaled) <= fontPxScaled * ADV_TOL,
        `mean=${s.mean.toFixed(4)} vs fontPx=${fontPxScaled.toFixed(4)} (${((s.mean / fontPxScaled - 1) * 100).toFixed(2)}%)`);
      check(`${name} — glyphs share one column X`, xdev <= TOL, `x spread=${xdev.toFixed(3)}`);

      if (name === "ruby") {
        check("ruby — parent glyphs stay on the canonical grid", stats(adv).sd <= TOL);
        check("ruby — rt lives in a separate offset lane (parent unmoved)",
          rt.length > 0 && (rt[0].rect.x - base[0].rect.x) > 1,
          `rt count=${rt.length}, xOffset=${rt.length ? (rt[0].rect.x - base[0].rect.x).toFixed(2) : "n/a"}`);
      }
      if (name === "dash" || name === "ellipsis") {
        check(`${name} — run occupies canonical slots (base advance == 1 slot each)`,
          Math.abs(stats(adv).mean - fontPxScaled) <= fontPxScaled * ADV_TOL);
      }
    }

    // 3. short line pitch == full line pitch
    const full = data.lines.find((l) => colText(l).startsWith("吾輩"));
    const short = data.lines.find((l) => colText(l).startsWith("みじ"));
    if (full && short) {
      const fa = stats((full.kids.filter((k) => k.kind === "base").map((k) => k.rect.y)).map((y, i, a) => i ? y - a[i - 1] : null).slice(1));
      const sa = stats((short.kids.filter((k) => k.kind === "base").map((k) => k.rect.y)).map((y, i, a) => i ? y - a[i - 1] : null).slice(1));
      check("short line pitch == full line pitch", Math.abs(fa.mean - sa.mean) <= TOL,
        `full=${fa.mean.toFixed(4)} short=${sa.mean.toFixed(4)}`);
    }

    const pooled = stats(poolBaseAdv);
    console.log(`\nPOOLED base glyph Y advance: mean=${pooled.mean.toFixed(4)} sd=${pooled.sd.toFixed(4)} (n=${pooled.n})`);
    console.log(`  -> ${(pooled.mean / fontPxScaled).toFixed(4)} em  (canonical solid grid target = 1.0000 em)`);
    check("POOLED — canonical grid is solid 1em", Math.abs(pooled.mean / fontPxScaled - 1) <= ADV_TOL);
    check("POOLED — max deviation within tolerance", pooled.sd <= TOL && pooled.spread <= TOL,
      `sd=${pooled.sd.toFixed(4)} spread=${pooled.spread.toFixed(3)}`);
  } finally {
    try { proc.kill(); } catch {}
    await sleep(1500); // let the browser release its user-data-dir lock
    try { fs.rmSync(UDD, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
  }

  if (failures > 0) {
    console.error(`\n${failures} grid check(s) failed.`);
    process.exit(1);
  }
  console.log("\nAll grid checks passed.");
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
