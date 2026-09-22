// Explicit-run real-browser E2E for TSP-B5 -- 描写語・修飾表現チェックβ (Human-QA revision 2: independent A / B / C).
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3117 npm run test:e2e:description-check
//   (optional) TATESPUN_E2E_SHOTS=<dir>  screenshots      TATESPUN_E2E_EVIDENCE=<file.json>  long-manuscript measurements
//   TATESPUN_E2E_ONLY=long | core | dock   run one part
//
// Never starts a server, never defaults to a deployment (loopback only unless TATESPUN_E2E_ALLOW_PRODUCTION=1).
//
// What it proves (real DOM / real mouse + touch / 390, 770, 1280, WINDOWED editor):
//  * Review Hub tool #4, default OFF (no overlay, nothing stored); first enable = A only;
//  * A / B / C are INDEPENDENT: A, B, C, A+B, A+C, B+C, A+B+C and none each show exactly those categories (B only really is B only);
//  * category tints: A / B / C computed backgrounds are all the SAME yellow (250, 204, 21) with strictly decreasing alpha, and every
//    candidate view also writes the category as text;
//  * a single click (mouse) or tap (touch) on a coloured phrase shows category + reason + "keeping it may be right";
//  * zero categories: calm explanation, no markers, no count; prefs persist across reload (B only / A+C survive), and the first
//    B5 build's { mode } value is migrated (A / AB / ABC -> independent categories);
//  * pinned (desktop) = a status pill on the Desktop Review Bar (bottom of Preview) that opens a popover
//    card: ON/OFF, A/B/C quick toggles, count, 前へ / 次へ over the visible candidates, current phrase + tag,
//    理由を見る, navigation lands on the candidate in the WINDOWED editor;
//  * B5 markers coexist with 文章チェックβ underlines and with B4's held-selection ghost;
//  * a long manuscript stays responsive; no manuscript text leaves the device; no horizontal scroll at any width.
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
const ONLY = process.env.TATESPUN_E2E_ONLY || "";

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "770x900", width: 770, height: 900 },
  { name: "1280x720", width: 1280, height: 720 },
];
const STEP_TIMEOUT_MS = 30_000;
const PINS_KEY = "tatespun.reviewHub.footerTools.v1";
const PREFS_KEY = "tatespun.descriptionCheck.v1";
const PANEL = "[data-review-hub-panel]";
const SENTINEL = "ZZ秘密SENTINEL-b5-4d2";

const TEXT = ["静かな夜だった。", `まるで夢のような景色を、泣いている少女が見ていた。${SENTINEL}`, "昨日の夜、駅前の店で友達と会った。"].join("\n");
const CATS = (a, b, c) => ({ A: a, B: b, C: c });

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
async function openWith(prefs, width, height, { touch = false } = {}) {
  await session.setViewport(width, height);
  await cdp.send("Emulation.setTouchEmulationEnabled", touch ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await navigate();
  await cdp.evaluate(`(() => { localStorage.clear(); ${Object.entries(prefs).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(";")}; return true; })()`);
  await navigate();
}
async function realClickAt(x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function tapAt(x, y) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
const hitTest = (selector) =>
  cdp.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0 && !x.disabled);
    if (!e) return null;
    const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y);
    return { x, y, hit: e === top || e.contains(top), badge: top?.tagName === 'NEXTJS-PORTAL', top: top?.outerHTML.slice(0, 110) ?? null };
  })()`);
async function realClick(selector, { scroll = true } = {}) {
  if (scroll) await cdp.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0); e?.scrollIntoView({ block: 'nearest' }); return true; })()`);
  let c = await hitTest(selector);
  assert.ok(c, `${selector}: no visible, enabled element`);
  if (c.badge) {
    // dev-only Next.js dev-tools badge (<nextjs-portal>, fixed at a viewport corner): re-centring the
    // scroll is not reliably enough clearance at every viewport height, and the badge's own shadow DOM
    // resists an external pointer-events override. A production build never has this badge, so a real
    // user could always tap the target here -- dispatch the click directly on the element instead of at
    // a screen coordinate, which is the one part of this workaround that IS dev-mode-only, not a product
    // behaviour under test.
    await cdp.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0); e?.click(); return true; })()`);
    return;
  }
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
  await sleep(350); // the panel's height cap is measured one frame after it opens (ResizeObserver); tap only once it has settled
};
const closeHub = async () => {
  if (!(await panelShown())) return;
  await sleep(350);
  await realClick("[data-review-hub-close]");
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display === 'none'`, { label: "Hub closes" });
};
/** { A: [texts], B: [...], C: [...] } of the painted runs. */
const runsByCategory = () =>
  cdp.evaluate(`(() => { const out = { A: [], B: [], C: [] }; for (const e of document.querySelectorAll('[data-description-mark]')) out[e.dataset.descriptionMark].push(e.textContent); return out; })()`);
const shownCategories = async () => {
  const r = await runsByCategory();
  return ["A", "B", "C"].filter((c) => r[c].length > 0).join("");
};
const countText = () => cdp.evaluate(`document.querySelector('[data-description-check-status]')?.textContent.trim() ?? null`);
const count = async () => Number((await countText()).replace(/[^0-9]/g, ""));
const waitCurrent = (label) =>
  cdp.waitFor(`/^候補 [0-9,]+件$/.test(document.querySelector('[data-description-check-status]')?.textContent.trim() ?? '')`, { timeoutMs: 20_000, label });
const checkedBoxes = () => cdp.evaluate(`["A","B","C"].map((c) => document.querySelector('[data-description-category-toggle="' + c + '"]')?.checked ? c : '').join('')`);
/** Click the Hub checkboxes until exactly `want` (a set like "AC") is checked. */
async function setCategories(want) {
  for (const c of ["A", "B", "C"]) {
    const has = (await checkedBoxes()).includes(c);
    if (has !== want.includes(c)) await realClick(`[data-description-category-toggle=${c}]`);
  }
  await cdp.waitFor(`(() => { const s = ${JSON.stringify(want)}; return ["A","B","C"].every((c) => (document.querySelector('[data-description-category-toggle="' + c + '"]')?.checked ?? false) === s.includes(c)); })()`, { label: `checkboxes = ${want || "none"}` });
}
async function shot(name) {
  if (!SHOTS) return;
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
}
const storedPrefs = () => cdp.evaluate(`JSON.parse(localStorage.getItem('${PREFS_KEY}') ?? 'null')`);

// ------------------------------------------------------------------------------------------------
async function coreViewport(v) {
  const tag = v.name;
  await openWith({ tatespun_editor_footer_collapsed: "off" }, v.width, v.height);
  await setText(TEXT);
  const mark = requests.length;

  // ---- default OFF
  await sleep(900);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-description-mark]').length`), 0, `${tag}: no marker while OFF`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-description-mark-overlay]') === null`), true, `${tag}: no overlay is even mounted while OFF`);
  assert.equal(await storedPrefs(), null, `${tag}: nothing stored while OFF (default)`);
  await openHub(tag);
  assert.deepEqual(
    await cdp.evaluate(`[...document.querySelectorAll('${PANEL} [data-review-hub-tool]')].map((e) => e.dataset.reviewHubTool)`),
    ["writing-check", "character-count", "read-aloud", "description-check"],
    `${tag}: 描写語・修飾表現チェックβ is the fourth Hub tool`
  );
  assert.match(await cdp.evaluate(`document.querySelector('[data-review-hub-tool="description-check"]').textContent`), /OFFのあいだは何も解析しません/);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-description-check-toggle]').checked`), false, `${tag}: toggle is OFF by default`);
  assert.doesNotMatch(await cdp.evaluate(`document.querySelector('header')?.innerText ?? ''`), /描写|修飾/, `${tag}: no top-menu entry`);
  await noHorizontalScroll(`${tag} (Hub open)`);
  insideViewport(await rect(PANEL), `${tag} panel`);

  // ---- first enable = A only
  await realClick("[data-description-check-toggle]");
  await cdp.waitFor(`document.querySelector('[data-description-check-toggle]').checked === true`, { label: `${tag}: toggled ON` });
  assert.deepEqual(await storedPrefs(), { enabled: true, categories: CATS(true, false, false) }, `${tag}: first enable = A only`);
  assert.equal(await checkedBoxes(), "A", `${tag}: only A is checked`);
  await waitCurrent(`${tag}: analysis finishes`);
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length > 0`, { label: `${tag}: markers appear` });
  assert.equal(await shownCategories(), "A", `${tag}: only category A is painted`);
  assert.deepEqual((await runsByCategory()).A, ["静かな", "まるで"], `${tag}: A = direct 形容・様子`);
  const explain = await cdp.evaluate(`document.querySelector('[data-review-hub-tool="description-check"]').textContent`);
  assert.match(explain, /文章の良し悪しを判定する機能ではありません/, `${tag}: not a judgement`);
  assert.match(explain, /残してよい表現も含まれます/, `${tag}: keeping is fine`);
  assert.match(explain, /直接的な説明/);
  assert.match(explain, /描写的な/);
  assert.match(explain, /時間・場所・用途/);
  assert.match(explain, /クリック（タップ）/, `${tag}: says a coloured phrase can be clicked / tapped for the reason`);
  assert.doesNotMatch(explain, /A\+B|A＋B/, `${tag}: the staged A / A+B / A+B+C wording is gone`);

  // ---- independent categories: every combination shows exactly those categories
  const expectations = {
    A: { text: { A: ["静かな", "まるで"] } },
    // B alone owns the whole 「まるで夢のような」 phrase; with A on, A paints 「まるで」 on top (A over B where they overlap)
    B: { text: { B: ["まるで夢のような", "泣いている"] } },
    C: {},
    AB: { text: { A: ["静かな", "まるで"], B: ["夢のような", "泣いている"] } },
    AC: {},
    BC: {},
    ABC: {},
  };
  const seenCounts = {};
  for (const combo of ["B", "C", "A", "AB", "AC", "BC", "ABC"]) {
    await setCategories(combo);
    await cdp.waitFor(`(async () => true)() && ${JSON.stringify(combo)} === ["A","B","C"].filter((c) => document.querySelector('[data-description-mark="' + c + '"]')).join('')`, { label: `${tag}: painted categories = ${combo}` });
    assert.equal(await shownCategories(), combo, `${tag}: exactly ${combo} painted (independent, not staged)`);
    assert.deepEqual(await storedPrefs(), { enabled: true, categories: CATS(combo.includes("A"), combo.includes("B"), combo.includes("C")) }, `${tag}: stored as independent categories (${combo})`);
    await waitCurrent(`${tag}: count for ${combo}`);
    seenCounts[combo] = await count();
    const runs = await runsByCategory();
    const want = expectations[combo]?.text;
    if (want) for (const [c, texts] of Object.entries(want)) assert.deepEqual(runs[c], texts, `${tag}: ${combo}: category ${c} runs`);
  }
  assert.equal(seenCounts.ABC, seenCounts.A + seenCounts.B + seenCounts.C, `${tag}: A+B+C count == A + B + C (independent categories, no overlap of meaning): ${JSON.stringify(seenCounts)}`);
  assert.equal(seenCounts.AB, seenCounts.A + seenCounts.B);
  assert.equal(seenCounts.AC, seenCounts.A + seenCounts.C);
  assert.equal(seenCounts.BC, seenCounts.B + seenCounts.C);
  assert.ok(seenCounts.B > 0 && seenCounts.C > 0, `${tag}: B and C each have candidates on their own`);

  // ---- tints: same yellow family, alpha A > B > C
  const tints = await cdp.evaluate(`(() => { const o = {}; for (const e of document.querySelectorAll('[data-description-mark]')) o[e.dataset.descriptionMark] = getComputedStyle(e).backgroundColor; return o; })()`);
  assert.deepEqual(Object.keys(tints).sort(), ["A", "B", "C"], `${tag}: A, B and C all painted with A+B+C on`);
  const alpha = (c) => Number(c.match(/rgba\(250, 204, 21, ([0-9.]+)\)/)?.[1] ?? NaN);
  for (const c of ["A", "B", "C"]) assert.match(tints[c], /^rgba\(250, 204, 21, /, `${tag}: ${c} is the same yellow family (${tints[c]})`);
  assert.ok(alpha(tints.A) > alpha(tints.B) && alpha(tints.B) > alpha(tints.C) && alpha(tints.C) > 0.1, `${tag}: subtle tint order A > B > C (${JSON.stringify(tints)})`);

  // ---- category is also written as text (list rows)
  await cdp.evaluate(`document.querySelector('[data-description-list]').open = true`);
  const rows = await cdp.evaluate(`[...document.querySelectorAll('[data-description-item]')].map((e) => e.textContent.replace(/\\s+/g, ' ').trim())`);
  assert.equal(rows.length, seenCounts.ABC, `${tag}: one row per candidate`);
  for (const tagText of ["A｜直接的な説明", "B｜描写的な修飾", "C｜広い修飾"]) assert.ok(rows.some((r) => r.includes(tagText)), `${tag}: rows carry the text tag ${tagText}`);
  await noHorizontalScroll(`${tag} (list open)`);
  await shot(`b5-hub-abc-${tag}`);

  // ---- none selected: calm, no markers, no count
  await setCategories("");
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length === 0`, { label: `${tag}: no marker with nothing selected` });
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-description-none-selected]')`), true, `${tag}: explains that nothing is selected`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-description-check-status]')`), false, `${tag}: no count while nothing is selected`);
  assert.deepEqual(await storedPrefs(), { enabled: true, categories: CATS(false, false, false) }, `${tag}: none-selected is a valid stored state`);
  await navigate();
  await openHub(`${tag} (reload none)`);
  assert.equal(await checkedBoxes(), "", `${tag}: none-selected survives reload`);

  // ---- B only persists across reload and paints only B
  await setCategories("B");
  await waitCurrent(`${tag}: B only`);
  await navigate();
  assert.deepEqual(await storedPrefs(), { enabled: true, categories: CATS(false, true, false) }, `${tag}: B only persisted`);
  await setText(TEXT); // the local draft is not autosaved this fast; the preference is what must persist
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length > 0`, { label: `${tag}: B markers after reload` });
  assert.equal(await shownCategories(), "B", `${tag}: B only after reload`);

  // ---- single click on a coloured phrase shows category + reason (no double click)
  await closeHub();
  const posB = await cdp.evaluate(`(() => { const e = [...document.querySelectorAll('[data-description-mark="B"]')].find((x) => x.textContent === '泣いている'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await realClickAt(posB.x, posB.y);
  await cdp.waitFor(`!!document.querySelector('[data-description-mark-detail]')`, { label: `${tag}: detail after ONE click` });
  const detail = await cdp.evaluate(`document.querySelector('[data-description-mark-detail]').textContent.replace(/\\s+/g, ' ').trim()`);
  assert.match(detail, /B｜描写的な修飾/, `${tag}: category as text (${detail})`);
  assert.match(detail, /「泣いている」/);
  assert.match(detail, /動詞などで名詞を詳しく説明する修飾です/, `${tag}: reason`);
  assert.match(detail, /そのまま残してください/, `${tag}: keeping it can be right`);
  assert.doesNotMatch(detail, /削除|直して|悪い/, `${tag}: never tells the writer to delete/fix`);
  insideViewport(await rect("[data-description-mark-detail]"), `${tag} detail card`);
  await noHorizontalScroll(`${tag} (detail card)`);
  await shot(`b5-detail-${tag}`);
  await realClick("[data-description-detail-dismiss]", { scroll: false });
  await cdp.waitFor(`!document.querySelector('[data-description-mark-detail]')`, { label: `${tag}: card dismissed` });

  // ---- OFF removes every marker
  await openHub(`${tag} (off)`);
  await realClick("[data-description-check-toggle]");
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length === 0 && document.querySelector('[data-description-mark-overlay]') === null`, { label: `${tag}: OFF removes every marker` });
  assert.equal((await storedPrefs()).enabled, false);
  assert.deepEqual((await storedPrefs()).categories, CATS(false, true, false), `${tag}: turning the feature off keeps the chosen categories`);

  // ---- no manuscript transmission
  const leaks = requests.slice(mark).filter((r) => r.postData.includes(SENTINEL) || r.url.includes(encodeURIComponent(SENTINEL)) || (!isLoopback(r.url) && (r.method !== "GET" || r.hasPost)));
  assert.deepEqual(leaks, [], `${tag}: no manuscript request left the device: ${JSON.stringify(leaks).slice(0, 300)}`);
  await closeHub();
  log(`  ${tag}: default OFF / first enable = A / independent A B C combos (${Object.keys(seenCounts).join(",")}) / tints / text tags / none / persistence / single click OK`);
}

async function migrationAndTouch() {
  const tag = "390x844 migration+touch";
  // old staged values -> independent categories (read on load, replaced by the new shape on the next change)
  for (const [mode, want] of [["A", "A"], ["AB", "AB"], ["ABC", "ABC"]]) {
    await openWith({ [PREFS_KEY]: JSON.stringify({ enabled: true, mode }) }, 390, 844);
    await openHub(tag);
    assert.equal(await checkedBoxes(), want, `${tag}: old mode ${mode} -> ${want}`);
    await realClick(`[data-description-category-toggle=${want.includes("C") ? "A" : "C"}]`);
    const stored = await storedPrefs();
    assert.equal(Object.prototype.hasOwnProperty.call(stored, "mode"), false, `${tag}: the next change replaces the old { mode } value`);
    assert.ok(stored.categories && typeof stored.categories.A === "boolean", `${tag}: new shape written`);
  }
  // touch: a single tap on a coloured phrase opens the reason
  await openWith({ [PREFS_KEY]: JSON.stringify({ enabled: true, categories: CATS(true, true, false) }) }, 390, 844, { touch: true });
  await setText(TEXT);
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length > 0`, { label: `${tag}: markers` });
  const posA = await cdp.evaluate(`(() => { const e = [...document.querySelectorAll('[data-description-mark="A"]')].find((x) => x.textContent === '静かな'); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await tapAt(posA.x, posA.y);
  await cdp.waitFor(`/A｜直接的な説明/.test(document.querySelector('[data-description-mark-detail]')?.textContent ?? '')`, { label: `${tag}: one TAP opens the reason` });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  log(`  ${tag}: old A / AB / ABC migrate / a single tap opens the reason OK`);
}

async function dockViewport(v) {
  // TSP-Review-UI (Revision 4): this rich daily-control card only exists on the DESKTOP surface now,
  // as the content of a POPOVER opened from the Desktop Review Bar's count pill (bottom of Preview) --
  // not a permanently-mounted card beside the manuscript (Revision 3's Rail) or below it (Revision 2's
  // Review Dock). A press outside the bar/popover closes it, so any interaction that lands outside it
  // (opening the full Hub) must reopen the popover afterward if the test still needs the card. See
  // compactDockViewport for the compact surface's mini pill + Bottom Sheet coverage, and
  // reviewLayout.e2e.mjs for the surface-level mechanics (popover overlay, mutual exclusivity,
  // Escape/outside-press) shared with B4.
  const tag = `${v.name} desktop`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["writing-check", "description-check"]), [PREFS_KEY]: JSON.stringify({ enabled: false, categories: CATS(true, false, false) }) }, v.width, v.height);
  await setText(TEXT);
  const CARD = '[data-desktop-review-popover="description-check"] [data-review-dock-card=description-check]';
  const cardText = () => cdp.evaluate(`document.querySelector('${CARD}')?.textContent.replace(/\\s+/g, ' ').trim() ?? ''`);
  const openPopover = async () => {
    if (await cdp.evaluate(`!!document.querySelector('${CARD}')`)) return;
    await realClick("[data-description-check-footer]", { scroll: false });
    await cdp.waitFor(`!!document.querySelector('${CARD}')`, { label: `${tag}: popover opens` });
  };
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-description-check-footer]')`), true, `${tag}: pinned = a status pill (not a permanent card)`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('${CARD}')`), false, `${tag}: pinning alone does not open the popover`);
  await openPopover();
  insideViewport(await rect(CARD), `${tag} card`);
  // OFF card
  assert.match(await cardText(), /いまはオフです/, `${tag}: OFF card explains itself`);
  assert.equal(await cdp.evaluate(`document.querySelector('${CARD} [data-description-card-toggle]').getAttribute('aria-checked')`), "false");
  // ON from the footer (no Hub needed)
  await realClick(`${CARD} [data-description-card-toggle]`, { scroll: false });
  await cdp.waitFor(`document.querySelector('${CARD} [data-description-card-toggle]').getAttribute('aria-checked') === 'true'`, { label: `${tag}: ON from the card` });
  assert.deepEqual(await storedPrefs(), { enabled: true, categories: CATS(true, false, false) }, `${tag}: card toggle == feature toggle (A only on first use)`);
  await cdp.waitFor(`/候補 [0-9,]+件/.test(document.querySelector('${CARD} [data-description-card-count]').textContent)`, { label: `${tag}: card shows the count` });
  const pressed = () => cdp.evaluate(`["A","B","C"].map((c) => document.querySelector('${CARD} [data-description-card-category="' + c + '"]').getAttribute('aria-pressed') === 'true' ? c : '').join('')`);
  assert.equal(await pressed(), "A", `${tag}: A is pressed`);
  const cardCount = async () => Number((await cdp.evaluate(`document.querySelector('${CARD} [data-description-card-count]').textContent`)).replace(/[^0-9]/g, ""));
  const nA = await cardCount();
  // quick category toggles from the card
  await realClick(`${CARD} [data-description-card-category=B]`, { scroll: false });
  await cdp.waitFor(`document.querySelector('[data-description-mark="B"]') !== null`, { label: `${tag}: B quick toggle paints B` });
  assert.equal(await pressed(), "AB");
  await realClick(`${CARD} [data-description-card-category=A]`, { scroll: false });
  await cdp.waitFor(`document.querySelector('[data-description-mark="A"]') === null`);
  assert.equal(await shownCategories(), "B", `${tag}: B only from the card`);
  await cdp.waitFor(`/候補 [0-9,]+件/.test(document.querySelector('${CARD} [data-description-card-count]').textContent)`);
  const nB = await cardCount();
  assert.ok(nB > 0 && nA > 0);
  // navigation over the visible (B) candidates only
  const position = () => cdp.evaluate(`document.querySelector('${CARD} [data-description-card-position]').textContent.trim()`);
  assert.equal(await position(), `– / ${nB}`, `${tag}: no current candidate yet`);
  const editorSel = () => cdp.evaluate(`(() => { const t = document.querySelector('[data-demo-target="editor"]'); return t.value.slice(t.selectionStart, t.selectionEnd); })()`);
  const visited = [];
  for (let i = 0; i < nB; i += 1) {
    await realClick(`${CARD} [data-description-card-next]`, { scroll: false });
    await cdp.waitFor(`document.querySelector('${CARD} [data-description-card-position]').textContent.trim() === '${i + 1} / ${nB}'`, { label: `${tag}: position ${i + 1} / ${nB}` });
    const phrase = await cdp.evaluate(`document.querySelector('${CARD} [data-description-card-current] p').textContent.trim()`);
    visited.push(phrase);
    assert.match(await cdp.evaluate(`document.querySelector('${CARD} [data-description-card-current]').textContent`), /B｜描写的な修飾/, `${tag}: current candidate shows its A/B/C text tag`);
    if (v.width >= 768) assert.equal(`「${await editorSel()}」`, phrase, `${tag}: the manuscript selection landed on the candidate (WINDOWED editor)`);
  }
  assert.equal(new Set(visited).size, nB, `${tag}: next visited every B candidate once (${visited.join(" ")})`);
  await realClick(`${CARD} [data-description-card-next]`, { scroll: false });
  await cdp.waitFor(`document.querySelector('${CARD} [data-description-card-position]').textContent.trim() === '1 / ${nB}'`, { label: `${tag}: next wraps` });
  await realClick(`${CARD} [data-description-card-prev]`, { scroll: false });
  await cdp.waitFor(`document.querySelector('${CARD} [data-description-card-position]').textContent.trim() === '${nB} / ${nB}'`, { label: `${tag}: previous wraps` });
  // reason on demand
  assert.equal(await cdp.evaluate(`!!document.querySelector('${CARD} [data-description-card-reason]')`), false, `${tag}: reason starts collapsed`);
  await realClick(`${CARD} [data-description-card-reason-toggle]`, { scroll: false });
  await cdp.waitFor(`!!document.querySelector('${CARD} [data-description-card-reason]')`, { label: `${tag}: 理由を見る opens the reason` });
  assert.match(await cardText(), /そのまま残してください/, `${tag}: keep-it note in the card`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-description-mark-detail]')`), false, `${tag}: no second floating card while the tool is pinned`);
  // zero categories from the card
  await realClick(`${CARD} [data-description-card-category=B]`, { scroll: false });
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length === 0`);
  assert.match(await cardText(), /未選択/, `${tag}: 未選択`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('${CARD} [data-description-card-next]')`), false, `${tag}: no navigation with nothing selected`);
  await realClick(`${CARD} [data-description-card-category=C]`, { scroll: false });
  await cdp.waitFor(`document.querySelector('[data-description-mark="C"]') !== null`);
  assert.equal(await shownCategories(), "C", `${tag}: C only from the card`);
  // the Hub keeps the full list + explanation -- opening it closes the popover (mutual exclusivity),
  // so it must be reopened afterward to keep testing the card.
  await openHub(tag);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-description-list]')`), true, `${tag}: Hub still owns the full candidate list`);
  assert.equal(await checkedBoxes(), "C", `${tag}: Hub checkboxes follow the card`);
  await closeHub();
  await openPopover();
  await noHorizontalScroll(`${tag} (card)`);
  await shot(`b5-dock-card-${v.name}`);

  // ---- coexistence: 文章チェックβ underline + B5 markers + B4 held ghost on the same text
  await setCategoriesViaCard(CARD, "AB");
  await setText("「閉じ忘れの台詞です。静かな夜だった。まるで夢のような景色。");
  await cdp.waitFor(`document.querySelector('[data-description-mark]') !== null`, { label: `${tag}: markers on the coexistence text` });
  await cdp.waitFor(`document.querySelector('.tsp-writing-wavy, .tsp-writing-wavy-review') !== null`, { label: `${tag}: 文章チェックβ underline still drawn` });
  assert.ok((await cdp.evaluate(`document.querySelectorAll('[data-description-mark]').length`)) > 0);
  log(`  ${tag}: card ON/OFF / A B C quick toggles / count / 前へ 次へ over visible candidates + wrap / current phrase + tag / 理由を見る / navigation lands / none / Hub owns the list / coexists with 文章チェックβ OK`);
}
async function setCategoriesViaCard(card, want) {
  for (const c of ["A", "B", "C"]) {
    const on = await cdp.evaluate(`document.querySelector('${card} [data-description-card-category="${c}"]').getAttribute('aria-pressed') === 'true'`);
    if (on !== want.includes(c)) await realClick(`${card} [data-description-card-category=${c}]`, { scroll: false });
  }
}

async function compactDockViewport(v) {
  // TSP-Review-UI (Revision 4): below the desktop measured-width threshold, pinning 描写語・修飾表現チェックβ
  // never mounts a Desktop Review Bar / popover -- only a compact count pill in the footer status row
  // (a tap opens the Hub, now a Bottom Sheet here). The rich card lives only in the desktop popover
  // (dockViewport, 1280).
  const tag = `${v.name} compact`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["writing-check", "description-check"]), [PREFS_KEY]: JSON.stringify({ enabled: true, categories: CATS(true, false, false) }) }, v.width, v.height);
  await setText(TEXT);
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length > 0`, { label: `${tag}: markers` });
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-desktop-review-bar]')`), false, `${tag}: pinning never mounts the Desktop Review Bar below its threshold`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-review-dock-card=description-check]')`), false, `${tag}: no permanent card at all`);
  await cdp.waitFor(`!!document.querySelector('[data-description-check-footer]')`, { label: `${tag}: compact count pill appears in the footer` });
  assert.match(await cdp.evaluate(`document.querySelector('[data-description-check-footer]').textContent`), /描写・修飾 [0-9,]+件/, `${tag}: pill shows the count`);
  insideViewport(await rect("[data-description-check-footer]"), `${tag} pill`);
  // the pill opens the Hub -- now a Bottom Sheet -- which still owns the full list + A/B/C settings
  await realClick("[data-description-check-footer]", { scroll: false });
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`, { label: `${tag}: pill opens the Hub` });
  assert.equal(await cdp.evaluate(`document.querySelector('${PANEL}').hasAttribute('data-review-hub-sheet')`), true, `${tag}: the Hub is the sheet variant here`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-description-list]')`), true, `${tag}: full candidate list still reachable inside the sheet`);
  await closeHub();
  await noHorizontalScroll(`${tag}`);
  log(`  ${tag}: no permanent card / count pill opens the Hub / full list reachable from the Bottom Sheet OK`);
}

async function coexistWithHeldGhost() {
  // TSP-Review-UI (Revision 4): B4 and B5 popovers are now mutually exclusive (only one Desktop Review
  // Bar popover open at a time -- see reviewLayout.e2e.mjs's popoverMutualExclusivity), so this no
  // longer proves "both cards visible side by side" (Revision 3's Rail). What actually matters --
  // and still must hold -- is that the manuscript's own rendered LAYERS (B4's held-selection ghost, B5's
  // category tint) are independent of which popover's UI happens to be open, or whether either is open
  // at all: B4's popover is open here, B5's is not, and B5's tint is still there regardless.
  const tag = "1280x720 B4+B5";
  await openWith(
    { tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["read-aloud", "description-check"]), [PREFS_KEY]: JSON.stringify({ enabled: true, categories: CATS(true, true, false) }) },
    1280, 720
  );
  await setText(TEXT);
  await cdp.waitFor(`document.querySelector('[data-description-mark]') !== null`, { label: `${tag}: markers` });
  // B5's tint is already on the page before B4's popover is even opened -- an always-on manuscript
  // overlay, not something tied to B5's own popover being open.
  const phrase = "泣いている";
  const at = TEXT.indexOf(phrase);
  assert.ok((await runsByCategory()).B.includes(phrase), `${tag}: the B5 tint is present before B4's popover opens`);
  // open B4's popover, choose 選択範囲, select the SAME B5-marked phrase -> ghost + B5 tint + native
  // selection state all consistent, and B5's own popover is (correctly) NOT open at the same time.
  await realClick("[data-read-aloud-status-pill]", { scroll: false });
  const CARD = '[data-desktop-review-popover="read-aloud"] [data-review-dock-card=read-aloud]';
  await cdp.waitFor(`!!document.querySelector('${CARD}')`, { label: `${tag}: B4 popover opens` });
  await cdp.evaluate(`(() => { const t = document.querySelector('[data-demo-target="editor"]'); t.focus(); t.setSelectionRange(${at}, ${at + phrase.length}); })()`);
  await realClick(`${CARD} [data-read-aloud-target=selection]`, { scroll: false });
  await cdp.waitFor(`/選択範囲を保持中/.test(document.querySelector('${CARD}').textContent)`, { label: `${tag}: held` });
  assert.equal(await cdp.evaluate(`[...document.querySelectorAll('[data-held-selection]')].map((e) => e.textContent).join('')`), phrase, `${tag}: ghost paints the held phrase`);
  assert.ok((await runsByCategory()).B.includes(phrase), `${tag}: the B5 tint on the same phrase is still there (independent layers, independent of B5's OWN popover being closed)`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-desktop-review-popover="description-check"]')`), false, `${tag}: B5's popover is correctly not open at the same time as B4's (mutual exclusivity)`);
  await shot("b5-b4-coexist-1280x720");
  log(`  ${tag}: B4 held ghost + B5 tint coexist as independent manuscript layers, regardless of which popover (if any) is open OK`);
}

async function longManuscript() {
  const tag = "1280x720 long";
  await openWith({ tatespun_editor_footer_collapsed: "off" }, 1280, 720);
  const unit = "朝の光が窓に差していた。彼女は美しく微笑み、ゆっくりと歩いた。昨日の夜、駅前の店で泣いている少女に会った。まるで夢のような景色だった。\n";
  const long = unit.repeat(1500); // ~100k characters
  const result = { chars: long.length, paragraphs: 1500 };
  const typeAndMeasure = async () => {
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
  result.candidatesA = await count();
  result.longTasksDuringAnalysisMs = await cdp.evaluate(`window.__longTasks.slice()`);
  await closeHub();
  await cdp.evaluate(`window.__longTasks.length = 0`);
  result.keystrokeMsOn = await typeAndMeasure();
  await sleep(1500);
  result.longTasksWhileTypingMs = await cdp.evaluate(`window.__longTasks.slice()`);
  const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
  result.keystrokeMedianOff = median(result.keystrokeMsOff);
  result.keystrokeMedianOn = median(result.keystrokeMsOn);
  result.worstLongTaskOffMs = Math.max(0, ...result.longTasksWhileTypingOffMs);
  const worstTask = Math.max(0, ...result.longTasksDuringAnalysisMs, ...result.longTasksWhileTypingMs);
  result.worstLongTaskMs = worstTask;
  await openHub(tag);
  const t1 = Date.now();
  await setCategories("ABC");
  await cdp.waitFor(`/^候補 [0-9,]+件$/.test(document.querySelector('[data-description-check-status]')?.textContent.trim() ?? '')`, { timeoutMs: 30_000 });
  result.switchToABCMs = Date.now() - t1;
  result.candidatesABC = await count();
  await closeHub();
  await shot("b5-long-1280x720");
  log(`  ${tag}: ${JSON.stringify(result)}`);
  assert.ok(result.analysisWallMs < 15_000, `${tag}: analysis completed in the background within 15 s (${result.analysisWallMs} ms)`);
  assert.ok(result.keystrokeMedianOn <= Math.max(120, result.keystrokeMedianOff * 4 + 60), `${tag}: typing with the tool ON stays responsive (median ${result.keystrokeMedianOn} ms vs OFF ${result.keystrokeMedianOff} ms)`);
  assert.ok(worstTask < 500, `${tag}: no main-thread block >= 500 ms (worst ${worstTask} ms)`);
  if (EVIDENCE) {
    mkdirSync(dirname(EVIDENCE), { recursive: true });
    writeFileSync(EVIDENCE, JSON.stringify({ measuredAt: new Date().toISOString(), browser: "headless Chrome (CDP), WINDOWED editor, 1280x720", ...result }, null, 2));
  }
}

try {
  if (!ONLY || ONLY === "core") {
    for (const v of VIEWPORTS) await coreViewport(v);
    await migrationAndTouch();
  }
  if (!ONLY || ONLY === "dock") {
    for (const v of [VIEWPORTS[0], VIEWPORTS[1]]) await compactDockViewport(v); // 390 / 770: below the desktop threshold
    await dockViewport(VIEWPORTS[2]); // 1280: the desktop surface -- the only one with a popover-based daily-control card
    await coexistWithHeldGhost();
  }
  if (!ONLY || ONLY === "long") await longManuscript();
  assert.deepEqual(dialogs, [], `unexpected native dialog(s): ${JSON.stringify(dialogs)}`);
  assert.deepEqual(pageErrors, [], `uncaught page error(s): ${JSON.stringify(pageErrors)}`);
  const external = requests.filter((r) => !isLoopback(r.url) && (r.method !== "GET" || r.hasPost));
  assert.deepEqual(external, [], `no external non-GET request during the whole run: ${JSON.stringify(external).slice(0, 300)}`);
  console.log(`${NAME}: PASS (${VIEWPORTS.map((v) => v.name).join(", ")}${ONLY ? `; only ${ONLY}` : ""})`);
} catch (error) {
  process.exitCode = 1;
  console.error(`${NAME}: FAIL -- ${error instanceof Error ? error.message : error}`);
} finally {
  await session.close();
}
