// Explicit-run real-browser E2E for the Review Dock (B4/B5 Human-QA revision 2).
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3117 npm run test:e2e:review-dock
//   (optional) TATESPUN_E2E_SHOTS=<dir>       screenshots per viewport / combination
//   (optional) TATESPUN_E2E_EVIDENCE=<file>   measured geometry (JSON)
//
// What it proves, for 0 pinned / each single tool / the B4+B5, B4+文章チェック, B5+文章チェック, B4+文字数, B5+文字数 pairs
// at 390 / ~770 / 1280 (WINDOWED editor):
//  * the Review Dock exists exactly when 音読β or 描写・修飾チェックβ is pinned, and is a separate region BELOW the manuscript
//    (a visible gap + separator) and ABOVE the editor's own footer rows;
//  * two cards sit side by side when the column is wide and STACK when it is not (never squeezed onto one line);
//  * no horizontal overflow anywhere, every dock control is inside the viewport and inside its card, the dock does not scroll
//    internally for ordinary controls;
//  * the manuscript keeps a usable height;
//  * max-2 still holds with four tools (a third pin is disabled, unpin frees a slot), pins persist across reload.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sleep } from "./helpers/cdp.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";

const NAME = "review dock E2E";
const target = resolveE2eTarget(process.env, NAME);
const SHOTS = process.env.TATESPUN_E2E_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const EVIDENCE = process.env.TATESPUN_E2E_EVIDENCE || "";

const ALL_VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "770x900", width: 770, height: 900 },
  { name: "770x720", width: 770, height: 720 },
  { name: "1280x720", width: 1280, height: 720 },
];
const ONLY = (process.env.TATESPUN_E2E_VIEWPORTS || "").split(",").filter(Boolean);
const VIEWPORTS = ONLY.length ? ALL_VIEWPORTS.filter((v) => ONLY.includes(v.name)) : ALL_VIEWPORTS;
const PINS_KEY = "tatespun.reviewHub.footerTools.v1";
const PANEL = "[data-review-hub-panel]";
const TOOLS = ["writing-check", "character-count", "read-aloud", "description-check"];
const COMBOS = [
  [],
  ["writing-check"],
  ["character-count"],
  ["read-aloud"],
  ["description-check"],
  ["read-aloud", "description-check"],
  ["read-aloud", "writing-check"],
  ["description-check", "writing-check"],
  ["read-aloud", "character-count"],
  ["description-check", "character-count"],
];
const TEXT = ["朝の光が窓に差していた。彼女は美しく微笑んだ。", "「行こう」と彼は言った。静かな夜だった。", "まるで夢のような景色を、泣いている少女が見ていた。"].join("\n");
const MIN_MANUSCRIPT_PX = { "390x844": 90, "770x900": 90, "770x720": 50, "1280x720": 110 };

const session = await launchEditorSession("tatespun-review-dock-");
const { cdp } = session;
const pageErrors = [];
cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception"));
const measurements = [];

const rect = (selector) =>
  cdp.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, shown: e.getClientRects().length > 0, vw: innerWidth, vh: innerHeight }; })()`);
async function navigate() {
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved' && !!document.querySelector('[data-demo-target="editor"]')`, { timeoutMs: 30_000, label: "editor ready" });
  await sleep(500);
}
async function openWith(prefs, width, height) {
  await session.setViewport(width, height);
  await navigate();
  await cdp.evaluate(`(() => { localStorage.clear(); ${Object.entries(prefs).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(";")}; return true; })()`);
  await navigate();
}
async function setText(text) {
  await cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' })); })()`);
  await sleep(300);
}
async function realClick(selector) {
  await cdp.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0); e?.scrollIntoView({ block: 'nearest' }); return true; })()`);
  const c = await cdp.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0 && !x.disabled);
    if (!e) return null; const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y);
    return { x, y, hit: e === top || e.contains(top) || top?.tagName === 'NEXTJS-PORTAL' }; })()`);
  assert.ok(c && c.hit, `${selector}: not tappable`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y, button: "left", clickCount: 1 });
}
async function shot(name) {
  if (!SHOTS) return;
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
}

async function comboCheck(v, pins) {
  const tag = `${v.name} [${pins.join("+") || "none"}]`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(pins) }, v.width, v.height);
  await setText(TEXT);
  const dockTools = pins.filter((id) => id === "read-aloud" || id === "description-check");
  const overflow = await cdp.evaluate(`({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, vw: innerWidth })`);
  assert.ok(overflow.doc <= overflow.vw + 1 && overflow.body <= overflow.vw + 1, `${tag}: horizontal scroll ${JSON.stringify(overflow)}`);
  const ta = await rect("[data-demo-target=editor]");
  const dock = await rect("[data-review-dock]");
  const m = { viewport: v.name, pins: pins.join("+") || "none", manuscriptH: Math.round(ta.h) };
  if (dockTools.length === 0) {
    assert.equal(dock, null, `${tag}: no dock unless 音読β / 描写・修飾チェックβ is pinned`);
    measurements.push(m);
    return;
  }
  assert.ok(dock && dock.shown, `${tag}: dock present`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-review-dock] [data-review-dock-card]').length`), dockTools.length, `${tag}: one card per dock tool`);
  // separation: a visible gap between the manuscript and the dock, and the dock above the editor's own footer rows
  const gap = dock.t - ta.b;
  assert.ok(gap >= 3, `${tag}: manuscript and dock are separated (gap ${gap.toFixed(1)}px)`);
  const borderTop = await cdp.evaluate(`getComputedStyle(document.querySelector('[data-review-dock]')).borderTopWidth`);
  assert.notEqual(borderTop, "0px", `${tag}: dock has a top separator`);
  const status = await rect("[data-editor-status-surfaces]");
  assert.ok(status.t >= dock.b - 0.5, `${tag}: the editor's own footer rows sit below the dock (status ${status.t} >= dock bottom ${dock.b})`);
  const wc = await rect("[data-writing-check-surface]");
  if (wc && wc.shown) assert.ok(wc.t >= dock.b - 0.5, `${tag}: the 文章チェックβ strip sits below the dock`);
  // width + overflow inside the dock
  assert.ok(dock.l >= -0.5 && dock.r <= dock.vw + 0.5, `${tag}: dock inside the viewport`);
  const inner = await cdp.evaluate(`(() => { const d = document.querySelector('[data-review-dock]'); const dr = d.getBoundingClientRect(); const bad = [];
    for (const el of d.querySelectorAll('button, input, select, [data-review-dock-card]')) { const r = el.getBoundingClientRect(); if (r.width === 0) continue;
      if (r.left < dr.left - 0.5 || r.right > dr.right + 0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) bad.push(el.outerHTML.slice(0, 80)); }
    return { bad, scrollH: d.scrollHeight, clientH: d.clientHeight, scrollW: d.scrollWidth, clientW: d.clientWidth }; })()`);
  assert.deepEqual(inner.bad, [], `${tag}: every dock control inside the dock and the viewport`);
  assert.ok(inner.scrollH - inner.clientH <= 1, `${tag}: no internal vertical scrolling for ordinary controls (${inner.scrollH} > ${inner.clientH})`);
  assert.ok(inner.scrollW - inner.clientW <= 1, `${tag}: no horizontal scrolling inside the dock`);
  // two cards: side by side when wide, stacked when narrow
  const cards = await cdp.evaluate(`[...document.querySelectorAll('[data-review-dock-card]')].map((c) => { const r = c.getBoundingClientRect(); return { t: r.top, l: r.left, w: r.width, h: r.height }; })`);
  m.dockH = Math.round(dock.h);
  m.cards = cards.length;
  if (cards.length === 2) {
    const sideBySide = Math.abs(cards[0].t - cards[1].t) < 2;
    m.layout = sideBySide ? "side-by-side" : "stacked";
    if (v.width >= 1200) assert.ok(sideBySide, `${tag}: two cards sit side by side when the column is wide (${JSON.stringify(cards)})`);
    if (v.width <= 800) assert.ok(!sideBySide && Math.abs(cards[0].l - cards[1].l) < 2, `${tag}: two cards stack intentionally in a narrow column (${JSON.stringify(cards)})`);
    for (const c of cards) assert.ok(c.w >= 200, `${tag}: no card is squeezed (${Math.round(c.w)}px)`);
  }
  assert.ok(ta.h >= MIN_MANUSCRIPT_PX[v.name], `${tag}: the manuscript keeps a usable height (${Math.round(ta.h)}px >= ${MIN_MANUSCRIPT_PX[v.name]}px)`);
  measurements.push(m);
  if (["read-aloud+description-check", "read-aloud", "description-check"].includes(pins.join("+"))) await shot(`dock-${v.name}-${pins.join("+")}`);
}

async function maxTwoCheck(v) {
  const tag = `${v.name} max-2`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["read-aloud", "description-check"]) }, v.width, v.height);
  await realClick("[data-editor-review-hub-trigger]");
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`);
  const toggle = (id) => `[data-review-hub-tool="${id}"] [data-review-hub-footer-pin-toggle]`;
  const st = (id) => cdp.evaluate(`(() => { const b = document.querySelector('${toggle(id)}'); return { pressed: b.getAttribute('aria-pressed'), disabled: b.disabled }; })()`);
  assert.deepEqual(await st("writing-check"), { pressed: "false", disabled: true }, `${tag}: a third pin is prevented`);
  assert.deepEqual(await st("character-count"), { pressed: "false", disabled: true });
  assert.deepEqual(await st("read-aloud"), { pressed: "true", disabled: false });
  await realClick(toggle("read-aloud"));
  assert.deepEqual(await st("writing-check"), { pressed: "false", disabled: false }, `${tag}: unpinning frees a slot`);
  await realClick(toggle("writing-check"));
  assert.deepEqual(await cdp.evaluate(`JSON.parse(localStorage.getItem('${PINS_KEY}'))`), ["description-check", "writing-check"], `${tag}: persisted in order`);
  await navigate();
  assert.deepEqual(await cdp.evaluate(`JSON.parse(localStorage.getItem('${PINS_KEY}'))`), ["description-check", "writing-check"], `${tag}: survives reload`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-review-dock-card]').length`), 1, `${tag}: only 描写・修飾 is a dock card now (文章チェックβ keeps its own strip)`);
  // reorder contract (B2): with two pins each tool has one swap arrow
  await realClick("[data-editor-review-hub-trigger]");
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`);
  await realClick(`[data-review-hub-tool="description-check"] [data-review-hub-footer-pin-move]`);
  assert.deepEqual(await cdp.evaluate(`JSON.parse(localStorage.getItem('${PINS_KEY}'))`), ["writing-check", "description-check"], `${tag}: reorder still works`);
  for (const id of TOOLS) assert.equal(await cdp.evaluate(`!!document.querySelector('[data-review-hub-tool="${id}"]')`), true, `${tag}: Hub still lists ${id}`);
}

try {
  for (const v of VIEWPORTS) {
    for (const pins of COMBOS) await comboCheck(v, pins);
    console.log(`  ${v.name}: ${COMBOS.length} pin combinations OK`);
  }
  if (!process.env.TATESPUN_E2E_SKIP_MAX2) for (const v of VIEWPORTS.filter((x) => ["390x844", "770x900", "1280x720"].includes(x.name))) await maxTwoCheck(v);
  console.log("  max-2 / unpin frees / order + reload persistence / Hub still lists every tool OK");
  assert.deepEqual(pageErrors, [], `uncaught page error(s): ${JSON.stringify(pageErrors)}`);
  if (EVIDENCE) {
    mkdirSync(dirname(EVIDENCE), { recursive: true });
    writeFileSync(EVIDENCE, JSON.stringify({ measuredAt: new Date().toISOString(), note: "px measured in headless Chrome (WINDOWED editor); manuscriptH = textarea height", measurements }, null, 2));
  }
  console.log(`${NAME}: PASS`);
} catch (error) {
  process.exitCode = 1;
  console.error(`${NAME}: FAIL -- ${error instanceof Error ? error.message : error}`);
  if (EVIDENCE) {
    mkdirSync(dirname(EVIDENCE), { recursive: true });
    writeFileSync(EVIDENCE, JSON.stringify({ failed: String(error), measurements }, null, 2));
  }
} finally {
  await session.close();
}
