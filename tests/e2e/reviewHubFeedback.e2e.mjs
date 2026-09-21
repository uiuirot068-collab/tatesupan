// Explicit-run real-browser E2E for TSP-B3 -- 見直し feedback on the β report modal.
//
//   # the dev server must be started with the beta report enabled and DUMMY backend env (nothing below ever
//   # reaches a real backend: the browser's fetch to the beta-feedback function is replaced by a recorder,
//   # and a CDP Fetch guard fails any request that still tried to leave for it):
//   NEXT_PUBLIC_BETA_FEEDBACK_ENABLED=true NEXT_PUBLIC_SUPABASE_URL=https://b3-e2e.invalid \
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=b3-e2e-dummy npx next dev -p 3000
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:review-hub-feedback
//
// It never starts a server and never defaults to any deployment (loopback only unless
// TATESPUN_E2E_ALLOW_PRODUCTION=1 -- do NOT point it at production: it "sends" reports).
//
// What it proves (real DOM, real mouse/keyboard input, 320 / 390 / 770 / 1280):
//  * the report modal is never shown by itself -- not on load, not while idle, not after using the Review Hub;
//  * the 報告 entry is unchanged and the modal opens on 気になる事 with the 見直し tab as a third tab;
//  * the 見直し tab: Q1 (4 choices) + Q2 (max 2 of the Hub's real tools) + optional note + the list of what travels;
//  * the counters follow real Hub use (opens / pin changes) and the pins are the browser-local B2 selection;
//  * sending produces ONE plain `feedback` request (same payload shape as 気になる事), whose text is exactly the
//    documented lines -- and neither the manuscript body nor the title (typed as unique sentinels) appear anywhere in it;
//  * sending writes no localStorage key; B2's pin key is untouched;
//  * the modal stays inside the viewport, the tabs stay on one line, nothing scrolls horizontally, and the send
//    button stays reachable;
//  * the existing 気になる事 and review submissions still work through the same transport;
//  * the Review Hub panel contains no survey element or wording (B1/B2 UI unchanged).
import assert from "node:assert/strict";
import { sleep } from "./helpers/cdp.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";

const NAME = "review hub feedback E2E";
const target = resolveE2eTarget(process.env, NAME);

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "390x844", width: 390, height: 844 },
  { name: "770x720", width: 770, height: 720 },
  { name: "1280x720", width: 1280, height: 720 },
];
const STEP_TIMEOUT_MS = 30_000;
const COLLAPSED_KEY = "tatespun_editor_footer_collapsed";
const PINS_KEY = "tatespun.reviewHub.footerTools.v1";
const DIALOG = `[role="dialog"][aria-label="β版フィードバック"]`;
const SENTINEL_BODY = "ZZ秘密の原稿本文SENTINEL-8f3a";
const SENTINEL_TITLE = "ZZ秘密の作品名SENTINEL-77c1";
const SUCCESS_TEXT = "ありがとうございます！届きました。";

const session = await launchEditorSession("tatespun-review-hub-feedback-");
const { cdp } = session;
const log = (line) => console.log(line);

const pageErrors = [];
cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception"));
const dialogs = [];
cdp.on("Page.javascriptDialogOpening", (p) => {
  dialogs.push(`${p.type}: ${p.message}`);
  cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
});

// --- safety net: nothing may leave for the beta-feedback function ------------------------------------------
const leaked = [];
await cdp.send("Fetch.enable", { patterns: [{ urlPattern: "*functions/v1/beta-feedback*" }] });
cdp.on("Fetch.requestPaused", (p) => {
  leaked.push(p.request.url);
  cdp.send("Fetch.failRequest", { requestId: p.requestId, errorReason: "BlockedByClient" }).catch(() => {});
});

// Installed before any page script on every navigation: a Turnstile that verifies itself, and a recorder for the
// beta-feedback request (answered with ok:true so the UI takes its real success path).
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    window.__b3 = { requests: [] };
    let cb = null; let n = 0;
    window.turnstile = {
      render(el, opts) { cb = opts.callback; setTimeout(() => cb('e2e-token-' + (++n)), 0); return 'e2e-widget'; },
      reset() { setTimeout(() => cb && cb('e2e-token-' + (++n)), 0); },
      remove() {},
    };
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : (input && input.url) || String(input);
      if (url.includes('/functions/v1/beta-feedback')) {
        const body = init && init.body;
        const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
        const payload = isForm ? JSON.parse(body.get('payload')) : JSON.parse(body);
        window.__b3.requests.push({ url, payload, formKeys: isForm ? [...body.keys()] : null, headers: (init && init.headers) || null });
        return new Response(JSON.stringify({ ok: true, reportId: 'e2e' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return realFetch(input, init);
    };
  })()`,
});

// --- helpers -------------------------------------------------------------------------------------------------
const storageKeys = () => cdp.evaluate(`Object.keys(localStorage).sort()`);
const dialogOpen = () => cdp.evaluate(`document.querySelector('${DIALOG}') !== null`);
const requests = () => cdp.evaluate(`window.__b3.requests`);

async function navigate(path = "/editor") {
  await cdp.send("Page.navigate", { url: target.url(path) });
  await cdp.waitFor(
    `document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved' && !!document.querySelector('[data-demo-target="editor"]')`,
    { timeoutMs: STEP_TIMEOUT_MS, label: `${path} ready` }
  );
  await sleep(500);
}
async function openFresh(width, height) {
  await session.setViewport(width, height);
  await navigate();
  await cdp.evaluate(`(() => { localStorage.setItem('${COLLAPSED_KEY}', 'off'); localStorage.removeItem('${PINS_KEY}'); return true; })()`);
  await navigate(); // reload: in-memory counters restart from 0
}
async function realClickAt(x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
/**
 * Real click on the n-th visible, enabled match; fails if something else covers its centre. Like a user, it first
 * scrolls the target into view (the modal's own scroll area is short on a 320x568 phone).
 */
async function realClickNth(selector, n = 0) {
  const c = await cdp.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((el) => el.getClientRects().length > 0 && !el.disabled)[${n}];
    if (!e) return null;
    e.scrollIntoView({ block: 'center', inline: 'nearest' });
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, hit: e === top || e.contains(top), top: top ? top.outerHTML.slice(0, 110) : null };
  })()`);
  assert.ok(c, `${selector}[${n}]: no visible, enabled element`);
  assert.ok(c.hit, `${selector}[${n}]: another element covers its centre (${c.top})`);
  await realClickAt(c.x, c.y);
}
async function clickDialogButton(text) {
  const c = await cdp.evaluate(`(() => {
    const d = document.querySelector('${DIALOG}');
    const b = d && [...d.querySelectorAll('button')].find((x) => x.textContent.trim() === ${JSON.stringify(text)} && x.getClientRects().length > 0 && !x.disabled);
    if (!b) return null;
    b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, hit: b === top || b.contains(top), top: top ? top.outerHTML.slice(0, 110) : null };
  })()`);
  assert.ok(c, `dialog button 「${text}」: not found / not enabled`);
  assert.ok(c.hit, `dialog button 「${text}」: covered by ${c.top}`);
  await realClickAt(c.x, c.y);
}
const press = async (key, code, vk) => {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk });
};
async function setNativeValue(selector, text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    return true;
  })()`);
}
/** Real typing into the (already visible) textarea inside the dialog. */
async function typeInto(selector, text) {
  await realClickNth(selector);
  await cdp.send("Input.insertText", { text });
}
const openReport = async (tag) => {
  await realClickNth('[data-editor-action="report"]');
  await cdp.waitFor(`document.querySelector('${DIALOG}') !== null`, { label: `${tag}: report modal opens` });
  await sleep(200);
};
const waitSendEnabled = (selector, tag) =>
  cdp.waitFor(`(() => { const b = document.querySelector(${JSON.stringify(selector)}); return !!b && !b.disabled; })()`, { label: `${tag}: send enabled (Turnstile verified)` });
const waitRequests = (count, tag) =>
  cdp.waitFor(`window.__b3.requests.length >= ${count}`, { timeoutMs: 10_000, label: `${tag}: ${count} recorded request(s)` });

async function assertBounded(tag) {
  const g = await cdp.evaluate(`(() => {
    const d = document.querySelector('${DIALOG}');
    const r = d.getBoundingClientRect();
    const tabs = [...d.querySelectorAll('button')].filter((b) => ['気になる事', 'review', '見直し'].includes(b.textContent.trim()));
    const row = tabs[0] && tabs[0].parentElement;
    const survey = d.querySelector('[data-review-hub-survey]');
    const scroller = survey && survey.closest('.overflow-y-auto');
    const send = d.querySelector('[data-review-hub-survey-send]');
    const sr = send && send.getBoundingClientRect();
    return {
      vw: innerWidth, vh: innerHeight, l: r.left, r: r.right, t: r.top, b: r.bottom,
      dialogHScroll: d.scrollWidth > d.clientWidth + 1,
      docHScroll: document.documentElement.scrollWidth > innerWidth + 1,
      tabs: tabs.map((b) => { const x = b.getBoundingClientRect(); return { text: b.textContent.trim(), l: x.left, r: x.right, t: x.top, b: x.bottom }; }),
      rowOverflow: row ? row.scrollWidth > row.clientWidth + 1 : null,
      scroller: scroller ? { sw: scroller.scrollWidth, cw: scroller.clientWidth } : null,
      send: sr ? { l: sr.left, r: sr.right, t: sr.top, b: sr.bottom, shown: send.getClientRects().length > 0 } : null,
    };
  })()`);
  assert.ok(g.l >= -0.5 && g.t >= -0.5 && g.r <= g.vw + 0.5 && g.b <= g.vh + 0.5, `${tag}: modal must stay inside the viewport ${JSON.stringify(g)}`);
  assert.equal(g.tabs.length, 3, `${tag}: exactly three tabs`);
  assert.deepEqual(g.tabs.map((x) => x.text), ["気になる事", "review", "見直し"], `${tag}: tab order`);
  assert.ok(g.tabs.every((x) => Math.abs(x.t - g.tabs[0].t) < 2 && x.r <= g.r + 0.5 && x.l >= g.l - 0.5), `${tag}: the three tabs stay on ONE line inside the modal ${JSON.stringify(g.tabs)}`);
  assert.equal(g.rowOverflow, false, `${tag}: tab row must not overflow`);
  assert.equal(g.dialogHScroll, false, `${tag}: modal must not scroll horizontally`);
  assert.equal(g.docHScroll, false, `${tag}: page must not gain horizontal scroll`);
  assert.ok(g.scroller && g.scroller.sw <= g.scroller.cw + 1, `${tag}: survey content must not overflow horizontally ${JSON.stringify(g.scroller)}`);
  assert.ok(g.send && g.send.shown && g.send.l >= -0.5 && g.send.r <= g.vw + 0.5 && g.send.t >= -0.5 && g.send.b <= g.vh + 0.5, `${tag}: send button must be visible inside the viewport ${JSON.stringify(g.send)}`);
}

// --- scenarios -------------------------------------------------------------------------------------------------
async function surveyPhase(v) {
  const tag = v.name;
  await openFresh(v.width, v.height);

  // (1) never shown by itself: not on load, not while idle, and the 報告 entry is the unchanged one.
  assert.equal(await dialogOpen(), false, `${tag}: the report modal must not be open on load`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-editor-action="report"]').length`), 1, `${tag}: exactly one 報告 entry`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-editor-action="report"]').textContent.trim()`), "報告", `${tag}: 報告 label unchanged`);
  await sleep(1500);
  assert.equal(await dialogOpen(), false, `${tag}: the report modal must not appear while idle`);

  // Unique sentinels in the manuscript + title: they must never travel.
  await setNativeValue('[data-demo-target="editor"]', SENTINEL_BODY);
  await setNativeValue('[data-demo-target="title"]', SENTINEL_TITLE);
  await sleep(300);

  // (2) real Hub use: open, unpin 文字数カウント (a pin change), close, open again, close.
  await realClickNth("[data-editor-review-hub-trigger]");
  await cdp.waitFor(`document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]') !== null`, { label: `${tag}: Hub opens` });
  const hubText = await cdp.evaluate(`document.querySelector('[data-review-hub-panel]').textContent`);
  assert.doesNotMatch(hubText, /報告|アンケート|足りている|もう1枠|フィードバック/, `${tag}: the Hub panel carries no survey wording`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-review-hub-panel] [data-review-hub-survey]') === null`), true, `${tag}: no survey element inside the Hub`);
  await realClickNth('[data-review-hub-footer-pin-control="character-count"] [data-review-hub-footer-pin-toggle]');
  await cdp.waitFor(`localStorage.getItem('${PINS_KEY}') === '["writing-check"]'`, { label: `${tag}: pin change persisted by B2` });
  await realClickNth("[data-review-hub-close]");
  await cdp.waitFor(`document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]') === null`, { label: `${tag}: Hub closes` });
  await realClickNth("[data-editor-review-hub-trigger]");
  await cdp.waitFor(`document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]') !== null`, { label: `${tag}: Hub opens again` });
  await realClickNth("[data-review-hub-close]");
  assert.equal(await dialogOpen(), false, `${tag}: using the Hub must not open the report modal`);

  // (3) the modal: default tab unchanged, 見直し is a third tab.
  const storageBefore = await storageKeys();
  await openReport(tag);
  assert.equal(await cdp.evaluate(`!!document.querySelector('${DIALOG} textarea[placeholder="ここに入力してください"]')`), true, `${tag}: opens on 気になる事`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('${DIALOG} [data-review-hub-survey]')`), false, `${tag}: survey is not the default tab`);
  await clickDialogButton("見直し");
  await cdp.waitFor(`!!document.querySelector('${DIALOG} [data-review-hub-survey]')`, { label: `${tag}: 見直し tab` });
  const shape = await cdp.evaluate(`(() => {
    const d = document.querySelector('${DIALOG}');
    return {
      radios: d.querySelectorAll('[data-review-hub-survey-slot] input[type=radio]').length,
      radioLabels: [...d.querySelectorAll('[data-review-hub-survey-slot] label')].map((l) => l.textContent.trim()),
      checks: [...d.querySelectorAll('[data-review-hub-survey-favorites] label')].map((l) => l.textContent.trim()),
      preselected: d.querySelectorAll('[data-review-hub-survey] input:checked').length,
      usage: [...d.querySelectorAll('[data-review-hub-survey-usage] dt')].map((dt) => dt.textContent.trim() + ' ' + dt.nextElementSibling.textContent.trim()),
      sendDisabled: d.querySelector('[data-review-hub-survey-send]').disabled,
      images: d.querySelectorAll('input[type=file]').length,
    };
  })()`);
  assert.deepEqual(shape.radioLabels, ["足りている", "もう1枠ほしい", "もっとほしい", "常時表示は不要"], `${tag}: Q1 choices`);
  assert.equal(shape.radios, 4);
  assert.deepEqual(shape.checks, ["文章チェックβ", "文字数カウント", "音読β", "描写語・修飾表現チェックβ"], `${tag}: Q2 offers only the Hub's real tools`);
  assert.equal(shape.preselected, 0, `${tag}: nothing preselected`);
  assert.equal(shape.sendDisabled, true, `${tag}: nothing to send yet`);
  assert.equal(shape.images, 0, `${tag}: no file input`);
  assert.deepEqual(
    shape.usage,
    ["フッターに表示中: 文章チェックβ（1/2）", "フッター表示を変えた回数: 1回（このページを開いてから）", "見直しを開いた回数: 2回（このページを開いてから）"],
    `${tag}: the list of what travels matches the real Hub use`
  );
  await assertBounded(`${tag} (見直し, empty)`);

  // (4) answer + note + send.
  const NOTE = "並び替えが分かりにくい&<b>x</b>";
  await realClickNth('input[name="review-hub-slot-answer"][value="one-more"]');
  await realClickNth("[data-review-hub-survey-favorites] input[type=checkbox]", 0);
  await realClickNth("[data-review-hub-survey-favorites] input[type=checkbox]", 1);
  await typeInto("[data-review-hub-survey-note]", NOTE);
  await sleep(200);
  await assertBounded(`${tag} (見直し, answered)`);
  await waitSendEnabled("[data-review-hub-survey-send]", tag);
  await realClickNth("[data-review-hub-survey-send]");
  await waitRequests(1, tag);
  await cdp.waitFor(`document.querySelector('${DIALOG}')?.textContent.includes(${JSON.stringify(SUCCESS_TEXT)})`, { label: `${tag}: success message` });

  const sent = await requests();
  assert.equal(sent.length, 1, `${tag}: exactly one request`);
  const [req] = sent;
  assert.equal(new URL(req.url).pathname, "/functions/v1/beta-feedback", `${tag}: the existing function path`);
  assert.equal(new URL(req.url).host, "b3-e2e.invalid", `${tag}: the dummy backend from the E2E env (never a real host)`);
  assert.deepEqual(Object.keys(req.payload).sort(), ["clientContext", "message", "turnstileToken", "type", "website"], `${tag}: same payload shape as 気になる事`);
  assert.equal(req.payload.type, "feedback");
  assert.deepEqual(req.formKeys, ["payload"], `${tag}: no image parts`);
  assert.deepEqual(Object.keys(req.headers), ["apikey"], `${tag}: same headers as the existing path`);
  const EXPECTED = [
    "【見直しアンケート】",
    "Q1 見直しのフッター表示は最大2枠で足りていますか？: もう1枠ほしい",
    "Q2 見直しでよく使うもの: 文章チェックβ、文字数カウント",
    "フッターに表示中: 文章チェックβ（1/2）",
    "フッター表示を変えた回数: 1回（このページを開いてから）",
    "見直しを開いた回数: 2回（このページを開いてから）",
    `自由記述: ${NOTE}`,
  ].join("\n");
  assert.equal(req.payload.message, EXPECTED, `${tag}: the message is exactly the documented lines`);
  const everything = JSON.stringify(req);
  assert.ok(!everything.includes(SENTINEL_BODY) && !everything.includes("SENTINEL-8f3a"), `${tag}: manuscript body must never be in the request`);
  assert.ok(!everything.includes(SENTINEL_TITLE) && !everything.includes("SENTINEL-77c1"), `${tag}: title must never be in the request`);
  assert.equal(req.payload.clientContext.path, "/editor", `${tag}: only the path (existing diagnostics) -- no query/hash/title`);

  // (5) sending stored nothing new; B2's own key is untouched; the answers were cleared.
  assert.deepEqual(await storageKeys(), storageBefore, `${tag}: sending must not create/remove any localStorage key`);
  assert.equal(await cdp.evaluate(`localStorage.getItem('${PINS_KEY}')`), '["writing-check"]', `${tag}: B2 pin selection untouched`);
  assert.equal(await cdp.evaluate(`document.querySelectorAll('${DIALOG} [data-review-hub-survey] input:checked').length`), 0, `${tag}: answers cleared after a successful send`);

  // (6) closes with Escape; the editor content is untouched.
  await press("Escape", "Escape", 27);
  await cdp.waitFor(`document.querySelector('${DIALOG}') === null`, { label: `${tag}: Escape closes` });
  assert.equal(await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`), SENTINEL_BODY, `${tag}: manuscript untouched`);
  log(`  ${tag}: never auto-shown / third tab / Q1+Q2+note / counters 2 opens, 1 pin change / one plain feedback request / no manuscript / bounded / Escape OK`);
}

async function existingPathsPhase(v) {
  const tag = `${v.name} existing paths`;
  await openFresh(v.width, v.height);
  await openReport(tag);

  // 気になる事 (unchanged)
  await typeInto(`${DIALOG} textarea[placeholder="ここに入力してください"]`, "既存の報告経路の確認");
  await waitSendEnabled(`${DIALOG} button.bg-amber-500`, tag);
  await clickDialogButton("匿名で送信する");
  await waitRequests(1, tag);
  let sent = await requests();
  assert.equal(sent[0].payload.type, "feedback");
  assert.equal(sent[0].payload.message, "既存の報告経路の確認", `${tag}: 気になる事 sends exactly what was typed`);
  assert.ok(!sent[0].payload.message.includes("【見直しアンケート】"), `${tag}: plain feedback carries no survey block`);

  // review (unchanged)
  await clickDialogButton("review");
  await cdp.waitFor(`[...document.querySelectorAll('${DIALOG} label')].some((l) => l.textContent.trim() === 'ルビ')`, { label: `${tag}: review checklist` });
  await cdp.evaluate(`(() => { const l = [...document.querySelectorAll('${DIALOG} label')].find((x) => x.textContent.trim() === 'ルビ'); l.scrollIntoView({ block: 'center' }); return true; })()`);
  const rubyBox = await cdp.evaluate(`(() => { const l = [...document.querySelectorAll('${DIALOG} label')].find((x) => x.textContent.trim() === 'ルビ'); const r = l.querySelector('input').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`);
  await realClickAt(rubyBox.x, rubyBox.y);
  await waitSendEnabled(`${DIALOG} button.bg-amber-500`, tag);
  await clickDialogButton("reviewを送信");
  await waitRequests(2, tag);
  sent = await requests();
  assert.equal(sent[1].payload.type, "review");
  assert.deepEqual(sent[1].payload.checkedItems, ["ルビ"], `${tag}: review checklist path unchanged`);
  await press("Escape", "Escape", 27);
  await cdp.waitFor(`document.querySelector('${DIALOG}') === null`, { label: `${tag}: closes` });
  log(`  ${tag}: 気になる事 + review still send through the same transport`);
}

// --- run ---------------------------------------------------------------------------------------------------------
try {
  log("phase 1: 見直し feedback, every viewport");
  for (const v of VIEWPORTS) await surveyPhase(v);

  log("phase 2: existing beta report paths");
  await existingPathsPhase(VIEWPORTS[3]);
  await existingPathsPhase(VIEWPORTS[1]);

  assert.deepEqual(leaked, [], `nothing may leave for the real beta-feedback function: ${JSON.stringify(leaked)}`);
  assert.deepEqual(dialogs, [], `unexpected native dialog(s): ${JSON.stringify(dialogs)}`);
  assert.deepEqual(pageErrors, [], `uncaught page error(s): ${JSON.stringify(pageErrors)}`);
  log(`${NAME}: PASS (${VIEWPORTS.map((v) => v.name).join(", ")}; existing paths 1280 + 390; 0 requests reached a real backend)`);
} catch (error) {
  process.exitCode = 1;
  console.error(`${NAME}: FAIL -- ${error instanceof Error ? error.message : error}`);
  try {
    console.error("state at failure:", JSON.stringify(await cdp.evaluate(`({ innerWidth, innerHeight, dialog: !!document.querySelector('${DIALOG}'), requests: window.__b3 ? window.__b3.requests.length : null, active: document.activeElement?.outerHTML.slice(0, 120) })`)));
    if (pageErrors.length) console.error("page errors:", JSON.stringify(pageErrors));
    if (leaked.length) console.error("blocked real-backend requests:", JSON.stringify(leaked));
  } catch {}
} finally {
  await session.close();
}
