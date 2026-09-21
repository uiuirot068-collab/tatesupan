// Explicit-run real-browser E2E for TSP-B5 -- 描写語・修飾表現チェックβ.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3117 npm run test:e2e:description-check
//   (optional) TATESPUN_E2E_SHOTS=<dir>  writes 390 / 770 / 1280 screenshots
//   (optional) TATESPUN_E2E_EVIDENCE=<file.json>  writes the long-manuscript measurements
//
// Never starts a server, never defaults to a deployment (loopback only unless TATESPUN_E2E_ALLOW_PRODUCTION=1).
//
// What it proves (real DOM / real mouse / 390 / 770 / 1280, WINDOWED editor surface):
//  * the tool is Review Hub tool #4, default OFF: no marker, no stored preference, nothing analysed;
//  * ON -> mode A only; A / A+B / A+B+C widen the set (A ⊂ A+B ⊂ A+B+C) and the Hub count follows;
//  * ONE yellow family: every marker has the identical computed background; categories are only in the detail;
//  * clicking a marked phrase shows its category + reason + "keeping it may be right" (detail card);
//  * the ON state and the breadth persist across reload; OFF removes every marker;
//  * footer pin `描写・修飾 N件` / `OFF` under the B2 max-2 rule with FOUR tools (order, persistence, unpinned still usable);
//  * a long manuscript stays responsive: analysis completes in the background, keystroke->paint latency with the tool ON
//    stays close to OFF, and no long task blocks the main thread for long;
//  * no manuscript text leaves the device (sentinel never appears in any request; no non-loopback non-GET request);
//  * layout: no horizontal scroll, panel / card / pill inside the viewport.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sleep } from "./helpers/cdp.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";

const NAME = "description-check E2E";
const target = resolveE2eTarget(process.env, NAME);
const SHOTS = process.env.TATESPUN_E2E_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const EVIDENCE = process.env.TATESPUN_E2E_EVIDENCE || "";

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "770x720", width: 770, height: 720 },
  { name: "1280x720", width: 1280, height: 720 },
];
const STEP_TIMEOUT_MS = 30_000;
const PINS_KEY = "tatespun.reviewHub.footerTools.v1";
const PREFS_KEY = "tatespun.descriptionCheck.v1";
const PANEL = "[data-review-hub-panel]";
const SENTINEL = "ZZ秘密SENTINEL-b5-4d2";

const TEXT = ["静かな夜だった。", `まるで夢のような景色を、泣いている少女が見ていた。${SENTINEL}`, "昨日の夜、駅前の店で友達と会った。"].join("\n");
const A_RUNS = ["静かな", "まるで"];
const AB_RUNS = ["静かな", "まるで夢のような", "泣いている"];

const session = await launchEditorSession("tatespun-description-check-");
const { cdp } = session;
const log = (line) => console.log(line);

const pageErrors = [];
cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception"));
const dialogs = [];
cdp.on("Page.javascriptDialogOpening", (p) => {
  dialogs.push(`${p.type}: ${p.message}`);
  cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
});

await cdp.send("Network.enable");
const requests = [];
cdp.on("Network.requestWillBeSent", (p) => requests.push({ url: p.request.url, method: p.request.method, postData: p.request.postData ?? "", hasPost: !!p.request.hasPostData }));
const isLoopback = (url) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url) || url.startsWith("data:") || url.startsWith("blob:");

// long-task recorder (main-thread blocking), installed on every document
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => { window.__longTasks = []; try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longTasks.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); } catch {} })()`,
});

const rect = (selector) =>
  cdp.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, shown: e.getClientRects().length > 0, vw: innerWidth, vh: innerHeight }; })()`);
const insideViewport = (r, tag) => assert.ok(r && r.shown && r.l >= -0.5 && r.t >= -0.5 && r.r <= r.vw + 0.5 && r.b <= r.vh + 0.5, `${tag}: outside viewport ${JSON.stringify(r)}`);
const panelShown = () => cdp.evaluate(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`);
const noHorizontalScroll = (tag) =>
  cdp.evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, body: document.body.scrollWidth })`).then((m) => {
    assert.ok(m.doc <= m.vw + 1 && m.body <= m.vw + 1, `${tag}: page scrolls horizontally (${JSON.stringify(m)})`);
  });

async function navigate(path = "/editor") {
  await cdp.send("Page.navigate", { url: target.url(path) });
  await cdp.waitFor(
    `document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved' && !!document.querySelector('[data-demo-target="editor"]')`,
    { timeoutMs: STEP_TIMEOUT_MS, label: `${path} ready` }
  );
  await sleep(500);
}
async function openWith(prefs, width, height) {
  await session.setViewport(width, height);
  await navigate();
  await cdp.evaluate(`(() => { localStorage.clear(); ${Object.entries(prefs).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(";")}; return true; })()`);
  await navigate();
}
async function realClickAt(x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function realClick(selector, { scroll = true } = {}) {
  if (scroll) await cdp.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0); e?.scrollIntoView({ block: 'nearest' }); return true; })()`);
  const c = await cdp.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0 && !x.disabled);
    if (!e) return null;
    const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y);
    return { x, y, hit: e === top || e.contains(top), top: top?.outerHTML.slice(0, 110) ?? null };
  })()`);
  assert.ok(c, `${selector}: no visible, enabled element`);
  assert.ok(c.hit, `${selector}: covered -- a user could not tap it (${c.top})`);
  await realClickAt(c.x, c.y);
}
async function setText(text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  })()`);
  await sleep(300);
}
const openHub = async (label) => {
  if (await panelShown()) return;
  await realClick("[data-editor-review-hub-trigger]", { scroll: false });
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`, { label: `${label}: Hub opens` });
};
const closeHub = async () => {
  if (!(await panelShown())) return;
  await realClick("[data-review-hub-close]");
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display === 'none'`, { label: "Hub closes" });
};
const runs = () => cdp.evaluate(`[...document.querySelectorAll('[data-description-mark]')].map((e) => e.textContent)`);
const countText = () => cdp.evaluate(`document.querySelector('[data-description-check-status]')?.textContent.trim() ?? null`);
const count = async () => Number((await countText()).replace(/[^0-9]/g, ""));
const waitCurrent = (label) =>
  cdp.waitFor(`/^候補 [0-9,]+件$/.test(document.querySelector('[data-description-check-status]')?.textContent.trim() ?? '')`, { timeoutMs: 20_000, label });
async function shot(name) {
  if (!SHOTS) return;
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
}

// ------------------------------------------------------------------------------------------------
async function coreViewport(v) {
  const tag = v.name;
  await openWith({ tatespun_editor_footer_collapsed: "off" }, v.width, v.height);
  await setText(TEXT);
  const mark = requests.length;

  // ---- default OFF
  await sleep(900);
  assert.deepEqual(await runs(), [], `${tag}: no marker while OFF`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-description-mark-overlay]') === null`), true, `${tag}: no overlay is even mounted while OFF`);
  assert.equal(await cdp.evaluate(`localStorage.getItem('${PREFS_KEY}')`), null, `${tag}: nothing stored while OFF (default)`);
  await openHub(tag);
  assert.deepEqual(
    await cdp.evaluate(`[...document.querySelectorAll('${PANEL} [data-review-hub-tool]')].map((e) => e.dataset.reviewHubTool)`),
    ["writing-check", "character-count", "read-aloud", "description-check"],
    `${tag}: 描写語・修飾表現チェックβ is the fourth Hub tool`
  );
  assert.match(await cdp.evaluate(`document.querySelector('[data-review-hub-tool="description-check"]').textContent`), /OFFのあいだは何も解析しません/, `${tag}: OFF note`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-description-check-toggle]').checked`), false, `${tag}: toggle is OFF by default`);
  assert.doesNotMatch(await cdp.evaluate(`document.querySelector('header')?.innerText ?? ''`, ), /描写|修飾/, `${tag}: no top-menu entry`);
  await noHorizontalScroll(`${tag} (Hub open)`);
  insideViewport(await rect(PANEL), `${tag} panel`);

  // ---- enable -> mode A only
  await realClick("[data-description-check-toggle]");
  await cdp.waitFor(`document.querySelector('[data-description-check-toggle]').checked === true`, { label: `${tag}: toggled ON` });
  assert.deepEqual(JSON.parse(await cdp.evaluate(`localStorage.getItem('${PREFS_KEY}')`)), { enabled: true, mode: "A" }, `${tag}: ON persists with mode A (default)`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-description-mode][aria-checked="true"]').dataset.descriptionMode`), "A", `${tag}: default mode is A`);
  await waitCurrent(`${tag}: analysis finishes`);
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length > 0`, { label: `${tag}: markers appear` });
  assert.deepEqual(await runs(), A_RUNS, `${tag}: mode A marks only the direct 形容・様子 phrases`);
  const aCount = await count();
  assert.equal(aCount, 2, `${tag}: count follows mode A`);
  const explain = await cdp.evaluate(`document.querySelector('[data-review-hub-tool="description-check"]').textContent`);
  assert.match(explain, /良し悪しではなく/, `${tag}: says A/B/C are breadth, not quality`);
  assert.match(explain, /残してよい表現もあります/, `${tag}: says keeping is fine`);

  // ---- one yellow family
  const bgs = await cdp.evaluate(`[...new Set([...document.querySelectorAll('[data-description-mark]')].map((e) => getComputedStyle(e).backgroundColor))]`);
  assert.equal(bgs.length, 1, `${tag}: one background colour for every marker (${bgs.join(" | ")})`);
  assert.match(bgs[0], /^rgba?\(250, 204, 21/, `${tag}: yellow family (${bgs[0]})`);

  // ---- A+B
  await realClick("[data-description-mode=AB]");
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length === ${AB_RUNS.length}`, { label: `${tag}: A+B markers` });
  assert.deepEqual(await runs(), AB_RUNS, `${tag}: A+B adds the 連体・連用 modifiers (overlapping phrases merge into one yellow run)`);
  const abCount = await count();
  assert.ok(abCount > aCount, `${tag}: A+B count (${abCount}) > A count (${aCount})`);
  assert.equal(JSON.parse(await cdp.evaluate(`localStorage.getItem('${PREFS_KEY}')`)).mode, "AB");
  const bgsAb = await cdp.evaluate(`[...new Set([...document.querySelectorAll('[data-description-mark]')].map((e) => getComputedStyle(e).backgroundColor))]`);
  assert.deepEqual(bgsAb, bgs, `${tag}: still ONE colour with two categories present`);

  // ---- A+B+C
  await realClick("[data-description-mode=ABC]");
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length > ${AB_RUNS.length}`, { label: `${tag}: A+B+C markers` });
  const abcRuns = await runs();
  for (const phrase of [...AB_RUNS, "昨日の", "駅前の"]) assert.ok(abcRuns.some((r) => r.includes(phrase)), `${tag}: A+B+C includes ${phrase} (${abcRuns.join("|")})`);
  const abcCount = await count();
  assert.ok(abcCount > abCount, `${tag}: A+B+C count (${abcCount}) > A+B count (${abCount})`);
  assert.equal(await cdp.evaluate(`[...new Set([...document.querySelectorAll('[data-description-mark]')].map((e) => getComputedStyle(e).backgroundColor))].length`), 1);

  // ---- list rows carry category + reason
  await cdp.evaluate(`document.querySelector('[data-description-list]').open = true`);
  const rows = await cdp.evaluate(`[...document.querySelectorAll('[data-description-item]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  assert.equal(rows.length, abcCount, `${tag}: one row per candidate`);
  assert.ok(rows.some((r) => /A｜形容表現候補/.test(r)) && rows.some((r) => /B｜連体修飾候補/.test(r)) && rows.some((r) => /C｜連体修飾候補（時間）/.test(r)), `${tag}: rows show A / B / C tags`);
  await noHorizontalScroll(`${tag} (list open)`);
  await shot(`b5-hub-abc-${tag}`);

  // ---- back to A+B, then click a marker in the manuscript -> detail card
  await realClick("[data-description-mode=AB]");
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length === ${AB_RUNS.length}`);
  await closeHub();
  const pos = await cdp.evaluate(`(() => { const e = [...document.querySelectorAll('[data-description-mark]')].find((x) => x.textContent === '泣いている'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await realClickAt(pos.x, pos.y);
  await cdp.waitFor(`!!document.querySelector('[data-description-mark-detail]')`, { label: `${tag}: detail card after clicking the marker` });
  const detail = await cdp.evaluate(`document.querySelector('[data-description-mark-detail]').textContent.replace(/\\s+/g, ' ').trim()`);
  assert.match(detail, /B｜連体修飾候補/, `${tag}: category shown (${detail})`);
  assert.match(detail, /「泣いている」/, `${tag}: the phrase is named`);
  assert.match(detail, /動詞などで名詞を詳しく説明する修飾です/, `${tag}: reason shown`);
  assert.match(detail, /そのまま残してください/, `${tag}: says keeping it can be right`);
  assert.doesNotMatch(detail, /削除|直して|悪い/, `${tag}: never tells the writer to delete/fix`);
  insideViewport(await rect("[data-description-mark-detail]"), `${tag} detail card`);
  await noHorizontalScroll(`${tag} (detail card)`);
  await shot(`b5-detail-${tag}`);
  await realClick("[data-description-detail-dismiss]", { scroll: false });
  await cdp.waitFor(`!document.querySelector('[data-description-mark-detail]')`, { label: `${tag}: card dismissed` });
  // caret on an A phrase: category A
  const posA = await cdp.evaluate(`(() => { const e = [...document.querySelectorAll('[data-description-mark]')].find((x) => x.textContent === '静かな'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await realClickAt(posA.x, posA.y);
  await cdp.waitFor(`/A｜形容表現候補/.test(document.querySelector('[data-description-mark-detail]')?.textContent ?? '')`, { label: `${tag}: A candidate detail` });

  // ---- persistence across reload + OFF removes markers
  await navigate();
  assert.deepEqual(JSON.parse(await cdp.evaluate(`localStorage.getItem('${PREFS_KEY}')`)), { enabled: true, mode: "AB" }, `${tag}: ON + breadth persisted`);
  await openHub(`${tag} (reload)`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-description-mode][aria-checked="true"]').dataset.descriptionMode`), "AB", `${tag}: breadth restored`);
  await realClick("[data-description-check-toggle]");
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length === 0 && document.querySelector('[data-description-mark-overlay]') === null`, { label: `${tag}: OFF removes every marker` });
  assert.equal(JSON.parse(await cdp.evaluate(`localStorage.getItem('${PREFS_KEY}')`)).enabled, false);

  // ---- no manuscript transmission
  const leaks = requests.slice(mark).filter((r) => r.postData.includes(SENTINEL) || r.url.includes(encodeURIComponent(SENTINEL)) || (!isLoopback(r.url) && (r.method !== "GET" || r.hasPost)));
  assert.deepEqual(leaks, [], `${tag}: no manuscript request left the device: ${JSON.stringify(leaks).slice(0, 300)}`);
  await closeHub();
  log(`  ${tag}: default OFF / enable→A / A→A+B→A+B+C / one yellow / category+reason / persist / OFF / no-transmission OK`);
}

async function pinViewport(v) {
  const tag = `${v.name} pins`;
  await openWith({ tatespun_editor_footer_collapsed: "off" }, v.width, v.height);
  await setText(TEXT);
  await openHub(tag);
  const toggle = (id) => `[data-review-hub-tool="${id}"] [data-review-hub-footer-pin-toggle]`;
  const state = (id) => cdp.evaluate(`(() => { const b = document.querySelector('${toggle(id)}'); return { pressed: b.getAttribute('aria-pressed'), disabled: b.disabled }; })()`);
  const pins = () => cdp.evaluate(`JSON.parse(localStorage.getItem('${PINS_KEY}') ?? 'null')`);
  // four tools, two pinned by default -> the other two are disabled
  assert.deepEqual(await state("read-aloud"), { pressed: "false", disabled: true });
  assert.deepEqual(await state("description-check"), { pressed: "false", disabled: true }, `${tag}: max-2 -- a 3rd pin is disabled with four tools`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-description-check-footer]')`), false, `${tag}: no footer pill while unpinned`);
  // unpinned tool works from the Hub
  await realClick("[data-description-check-toggle]");
  await waitCurrent(`${tag}: works while unpinned`);
  assert.equal(await count(), 2, `${tag}: unpinned tool fully usable from the Hub (pinned != enabled)`);
  await realClick("[data-description-check-toggle]"); // back OFF
  // unpin 文字数カウント, pin 描写・修飾
  await realClick(toggle("character-count"));
  assert.deepEqual(await state("description-check"), { pressed: "false", disabled: false }, `${tag}: unpinning frees a slot`);
  await realClick(toggle("description-check"));
  await cdp.waitFor(`!!document.querySelector('[data-review-hub-footer-tool="description-check"] [data-description-check-footer]')`, { label: `${tag}: footer pill appears` });
  assert.deepEqual(await pins(), ["writing-check", "description-check"], `${tag}: persisted in pin order`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-description-check-footer]').textContent.trim()`), "描写・修飾 OFF", `${tag}: pill shows OFF while the tool is OFF (display != enable)`);
  assert.deepEqual(await state("read-aloud"), { pressed: "false", disabled: true }, `${tag}: full again`);
  assert.deepEqual(await state("character-count"), { pressed: "false", disabled: true });
  // turn ON -> pill shows the count
  await realClick("[data-description-check-toggle]");
  await waitCurrent(`${tag}: ON`);
  await cdp.waitFor(`/^描写・修飾 [0-9,]+件$/.test(document.querySelector('[data-description-check-footer]')?.textContent.trim() ?? '')`, { label: `${tag}: pill shows the count` });
  assert.equal(await cdp.evaluate(`document.querySelector('[data-description-check-footer]').textContent.trim()`), `描写・修飾 ${await count()}件`, `${tag}: pill == Hub count`);
  await closeHub();
  insideViewport(await rect("[data-description-check-footer]"), `${tag} footer pill`);
  await noHorizontalScroll(`${tag} (pill)`);
  await shot(`b5-footer-pill-${v.name}`);
  // tap the pill -> opens the Hub
  await realClick("[data-description-check-footer]", { scroll: false });
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`, { label: `${tag}: pill opens the Hub` });
  // reorder + persistence
  await realClick(`[data-review-hub-tool="description-check"] [data-review-hub-footer-pin-move]`);
  assert.deepEqual(await pins(), ["description-check", "writing-check"], `${tag}: reorder`);
  await navigate();
  assert.deepEqual(await pins(), ["description-check", "writing-check"], `${tag}: pins survive reload`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-description-check-footer]')`), true, `${tag}: pill survives reload`);
  // swap 音読 in for 描写: free a slot, pin 音読β -> 4-tool churn keeps the invariant
  await openHub(tag);
  await realClick(toggle("description-check"));
  await realClick(toggle("read-aloud"));
  assert.deepEqual(await pins(), ["writing-check", "read-aloud"], `${tag}: any 2 of 4 can be shown`);
  assert.deepEqual(await state("description-check"), { pressed: "false", disabled: true });
  assert.ok((await pins()).length <= 2);
  // zero pins
  await realClick(toggle("writing-check"));
  await realClick(toggle("read-aloud"));
  assert.deepEqual(await pins(), []);
  for (const id of ["writing-check", "character-count", "read-aloud", "description-check"]) assert.equal(await cdp.evaluate(`!!document.querySelector('[data-review-hub-tool="${id}"]')`), true, `${tag}: Hub still lists ${id} with zero pins`);
  await closeHub();
  log(`  ${tag}: 4 tools + max-2 / unpinned usable / pill OFF→N件 / pin order + reload / any 2 of 4 / zero pins OK`);
}

async function longManuscript() {
  const tag = "1280x720 long";
  await openWith({ tatespun_editor_footer_collapsed: "off" }, 1280, 720);
  const unit = "朝の光が窓に差していた。彼女は美しく微笑み、ゆっくりと歩いた。昨日の夜、駅前の店で泣いている少女に会った。まるで夢のような景色だった。\n";
  const long = unit.repeat(1500); // ~100k characters
  const result = { chars: long.length, paragraphs: 1500 };
  const typeAndMeasure = async () => {
    // keystroke -> next paint, 6 samples
    const samples = [];
    for (let i = 0; i < 6; i += 1) {
      samples.push(
        await cdp.evaluate(`new Promise((resolve) => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); el.setSelectionRange(0, 0);
          const t0 = performance.now(); document.execCommand('insertText', false, 'あ'); requestAnimationFrame(() => requestAnimationFrame(() => resolve(Math.round(performance.now() - t0)))); })`)
      );
      await sleep(120);
    }
    return samples;
  };
  await setText(long);
  await sleep(1200);
  await cdp.evaluate(`window.__longTasks.length = 0`);
  result.keystrokeMsOff = await typeAndMeasure();
  await sleep(1000);
  result.longTasksWhileTypingOffMs = await cdp.evaluate(`window.__longTasks.slice()`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-description-mark]').length`), 0);

  await openHub(tag);
  await cdp.evaluate(`window.__longTasks.length = 0`);
  const t0 = Date.now();
  await realClick("[data-description-check-toggle]");
  await cdp.waitFor(`/^候補 [0-9,]+件$/.test(document.querySelector('[data-description-check-status]')?.textContent.trim() ?? '')`, { timeoutMs: 30_000, label: `${tag}: analysis completes` });
  result.analysisWallMs = Date.now() - t0;
  result.candidatesModeA = await count();
  result.longTasksDuringAnalysisMs = await cdp.evaluate(`window.__longTasks.slice()`);
  await closeHub();
  await cdp.evaluate(`window.__longTasks.length = 0`);
  result.keystrokeMsOn = await typeAndMeasure();
  await cdp.waitFor(`/^候補 [0-9,]+件$/.test(document.querySelector('[data-description-check-status]')?.textContent?.trim() ?? '') || true`, { label: "settle" });
  await sleep(1500);
  result.longTasksWhileTypingMs = await cdp.evaluate(`window.__longTasks.slice()`);
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  result.keystrokeMedianOff = median(result.keystrokeMsOff);
  result.keystrokeMedianOn = median(result.keystrokeMsOn);
  const worstTask = Math.max(0, ...result.longTasksDuringAnalysisMs, ...result.longTasksWhileTypingMs);
  result.worstLongTaskOffMs = Math.max(0, ...result.longTasksWhileTypingOffMs);
  result.worstLongTaskMs = worstTask;
  // ABC widest on the long text
  await openHub(tag);
  await realClick("[data-description-mode=ABC]");
  await cdp.waitFor(`/^候補 [0-9,]+件$/.test(document.querySelector('[data-description-check-status]')?.textContent.trim() ?? '')`, { timeoutMs: 30_000 });
  result.candidatesModeABC = await count();
  await closeHub();
  await shot("b5-long-1280x720");
  log(`  ${tag}: ${JSON.stringify(result)}`);
  assert.ok(result.analysisWallMs < 15_000, `${tag}: analysis completed in the background within 15 s (${result.analysisWallMs} ms)`);
  assert.ok(result.keystrokeMedianOn <= Math.max(120, result.keystrokeMedianOff * 4 + 60), `${tag}: typing with the tool ON stays responsive (median ${result.keystrokeMedianOn} ms vs OFF ${result.keystrokeMedianOff} ms)`);
  assert.ok(worstTask < 400, `${tag}: no main-thread block >= 400 ms (worst ${worstTask} ms)`);
  if (EVIDENCE) {
    mkdirSync(dirname(EVIDENCE), { recursive: true });
    writeFileSync(EVIDENCE, JSON.stringify({ measuredAt: new Date().toISOString(), browser: "headless Chrome (CDP), WINDOWED editor, 1280x720", ...result }, null, 2));
  }
}

try {
  const only = process.env.TATESPUN_E2E_ONLY;
  if (only !== "long") for (const v of VIEWPORTS) await coreViewport(v);
  if (only !== "long") for (const v of VIEWPORTS) await pinViewport(v);
  await longManuscript();
  assert.deepEqual(dialogs, [], `unexpected native dialog(s): ${JSON.stringify(dialogs)}`);
  assert.deepEqual(pageErrors, [], `uncaught page error(s): ${JSON.stringify(pageErrors)}`);
  const external = requests.filter((r) => !isLoopback(r.url) && (r.method !== "GET" || r.hasPost));
  assert.deepEqual(external, [], `no external non-GET request during the whole run: ${JSON.stringify(external).slice(0, 300)}`);
  console.log(`${NAME}: PASS (${VIEWPORTS.map((v) => v.name).join(", ")})`);
} catch (error) {
  process.exitCode = 1;
  console.error(`${NAME}: FAIL -- ${error instanceof Error ? error.message : error}`);
} finally {
  await session.close();
}
