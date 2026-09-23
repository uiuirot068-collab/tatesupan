// Explicit-run real-browser E2E for TSP-B4 -- 音読β / リズム確認.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3117 npm run test:e2e:read-aloud
//   (optional) TATESPUN_E2E_SHOTS=<dir>  writes 390 / 770 / 1280 screenshots there
//
// Never starts a server, never defaults to a deployment (loopback only unless TATESPUN_E2E_ALLOW_PRODUCTION=1).
// The browser's speech engine is REPLACED by a deterministic in-page fake (installed before any page script), so
// the run is silent and repeatable and can assert exactly what text / voice / speed reached the speech API.
//
// What it proves (real DOM, real mouse input, 390 / 770 / 1280):
//  * 音読β is the third Review Hub tool (no new top menu); nothing is ever spoken by itself;
//  * 選択範囲 / 現在の段落 / 全文 read exactly the right text (ruby read as its reading, notation never spoken);
//  * pause keeps the sentence, resume continues, stop cancels; speed changes reach the next utterance;
//  * two quick starts never overlap (at most one utterance is active);
//  * default voice is on-device Japanese; an online voice is used only when explicitly chosen (and warns);
//  * unsupported browser / no on-device Japanese voice show guidance and never speak;
//  * reloading (pagehide) cancels speech;
//  * footer pin, desktop surface (1280, Revision 4 -- was a dedicated third-column Review Rail in
//    Revision 3, rejected by Human QA for feeling too far from the editor and eating into Preview's
//    width): 音読β becomes a status pill on the Desktop Review Bar (bottom of Preview) that opens a
//    popover with a 音読範囲 radiogroup (選択範囲 / 現在の段落 / 全文), a visible 「選択範囲を保持中」 state +
//    ghost highlight while the editor is unfocused, stale-hold cleanup (edit / collapse / target
//    switch), play / pause / resume / stop from the card; max-2 (a third pin is disabled, unpin frees
//    a slot), order/persistence survive reload, and an unpinned 音読β stays fully usable from the Hub;
//  * footer pin, compact surface (390 / 770, Revision 3, unchanged): no permanent card at all -- a
//    one-line mini control in the footer status row that itself reads/pauses/resumes/stops, with full
//    controls (target choice, speed, voice) still reachable from the Review Hub, now a Bottom Sheet there;
//  * no external manuscript transmission: no request carries the manuscript sentinel, no non-loopback POST/beacon;
//  * layout: nothing overflows horizontally, panel + footer controls stay inside the viewport;
//  * pronunciation dictionary (Revision 3): registering a reading from a held selection reaches what B4
//    actually speaks; ruby still wins over a registered dictionary reading for the same word; the manuscript
//    itself is never mutated; edit / delete / browser-local (localStorage) persistence across reload.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sleep } from "./helpers/cdp.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";

const NAME = "read-aloud E2E";
const target = resolveE2eTarget(process.env, NAME);
const SHOTS = process.env.TATESPUN_E2E_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  { name: "390x844", width: 390, height: 844 },
  { name: "770x720", width: 770, height: 720 },
  { name: "1280x720", width: 1280, height: 720 },
];
const STEP_TIMEOUT_MS = 30_000;
const PINS_KEY = "tatespun.reviewHub.footerTools.v1";
const RA_PREFS_KEY = "tatespun.readAloud.v1";
const MODE_KEY = "__e2e_ra_mode";
const PANEL = "[data-review-hub-panel]";
const SENTINEL = "ZZ秘密SENTINEL-b4-91c";

const P1 = "朝の光が窓に差していた。彼女は｜宇宙《そら》を見上げた。";
const P2 = `「行こう」と彼は言った。静かな夜だった。${SENTINEL}`;
const P3 = "終わりの段落です。";
const TEXT = [P1, P2, P3].join("\n");
const P1_SPOKEN = ["朝の光が窓に差していた。", "彼女はそらを見上げた。"];
const P2_SPOKEN = ["「行こう」と彼は言った。", "静かな夜だった。", SENTINEL];
const P3_SPOKEN = ["終わりの段落です。"];

const session = await launchEditorSession("tatespun-read-aloud-");
const { cdp } = session;
const log = (line) => console.log(line);

const pageErrors = [];
cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception"));
const dialogs = [];
cdp.on("Page.javascriptDialogOpening", (p) => {
  dialogs.push(`${p.type}: ${p.message}`);
  cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
});

// --- network guard: the manuscript must never leave the device ------------------------------------
await cdp.send("Network.enable");
const requests = [];
cdp.on("Network.requestWillBeSent", (p) => {
  requests.push({ url: p.request.url, method: p.request.method, postData: p.request.postData ?? "", hasPost: !!p.request.hasPostData });
});
const isLoopback = (url) => /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/.test(url) || url.startsWith("data:") || url.startsWith("blob:");

// --- in-page fake speech engine (installed before any page script) --------------------------------
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const mode = (() => { try { return localStorage.getItem(${JSON.stringify(MODE_KEY)}) || 'normal'; } catch { return 'normal'; } })();
    if (mode === 'unsupported') {
      try { delete window.speechSynthesis; } catch {}
      Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
      try { delete window.SpeechSynthesisUtterance; } catch {}
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true });
      return;
    }
    const V = (voiceURI, name, lang, localService) => ({ voiceURI, name, lang, localService, default: false });
    const voices = mode === 'no-ja' ? [V('en-local', 'Zira', 'en-US', true), V('ja-online', 'Nanami Online', 'ja-JP', false)]
      : [V('en-local', 'Zira', 'en-US', true), V('ja-local-1', 'Haruka', 'ja-JP', true), V('ja-local-2', 'Ichiro', 'ja-JP', true), V('ja-online', 'Nanami Online', 'ja-JP', false)];
    const S = { spoken: [], log: [], active: 0, maxActive: 0, paused: false, current: null, queue: [] };
    window.__ra = S;
    const persist = (entry) => { try { const a = JSON.parse(sessionStorage.getItem('__ra_log') || '[]'); a.push(entry); sessionStorage.setItem('__ra_log', JSON.stringify(a)); } catch {} };
    function pump() {
      if (S.current || S.paused || !S.queue.length) return;
      const u = S.queue.shift();
      S.active += 1; S.maxActive = Math.max(S.maxActive, S.active);
      const dur = Math.max(250, (u.text.length * 45) / (u.rate || 1));
      S.current = { u, remaining: dur, startedAt: performance.now(), timer: null };
      const arm = () => { S.current.startedAt = performance.now(); S.current.timer = setTimeout(() => { const c = S.current; S.current = null; S.active -= 1; c.u.onend && c.u.onend({}); pump(); }, S.current.remaining); };
      S.current.arm = arm; arm();
    }
    const synth = {
      get speaking() { return !!S.current || S.queue.length > 0; },
      get paused() { return S.paused; },
      speak(u) { S.log.push('speak'); S.spoken.push({ text: u.text, rate: u.rate, lang: u.lang, voiceURI: u.voice && u.voice.voiceURI, local: u.voice && u.voice.localService }); S.queue.push(u); pump(); },
      cancel() {
        S.log.push('cancel'); persist({ type: 'cancel', at: Date.now(), from: new Error().stack.includes('pagehide') ? 'pagehide' : 'other' });
        S.queue = []; const c = S.current;
        if (c) { clearTimeout(c.timer); S.current = null; S.active -= 1; setTimeout(() => c.u.onerror && c.u.onerror({ error: 'canceled' }), 0); }
      },
      pause() { S.log.push('pause'); S.paused = true; const c = S.current; if (c) { clearTimeout(c.timer); c.remaining -= performance.now() - c.startedAt; } },
      resume() { S.log.push('resume'); if (!S.paused) return; S.paused = false; if (S.current) S.current.arm(); else pump(); },
      getVoices() { return voices; },
      addEventListener(type, fn) { if (type === 'voiceschanged') setTimeout(fn, 50); },
      removeEventListener() {},
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; this.onend = null; this.onerror = null; };
    window.addEventListener('pagehide', () => persist({ type: 'pagehide', at: Date.now(), cancelCountAtHide: S.log.filter((x) => x === 'cancel').length }));
  })()`,
});

// --- browser-side helpers ------------------------------------------------------------------------
const rect = (selector) =>
  cdp.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, shown: e.getClientRects().length > 0, vw: innerWidth, vh: innerHeight }; })()`);
const panelShown = () => cdp.evaluate(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`);
const spoken = () => cdp.evaluate(`window.__ra ? window.__ra.spoken : null`);
const spokenTexts = async () => (await spoken()).map((s) => s.text);
const raLog = () => cdp.evaluate(`window.__ra.log`);
const maxActive = () => cdp.evaluate(`window.__ra.maxActive`);
const synthState = () => cdp.evaluate(`({ paused: window.__ra.paused, current: window.__ra.current ? window.__ra.current.u.text : null, queue: window.__ra.queue.length })`);

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
  await cdp.evaluate(`(() => { localStorage.clear(); sessionStorage.removeItem('__ra_log'); ${Object.entries(prefs).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(";")}; return true; })()`);
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
    return { x, y, hit: e === top || e.contains(top), devBadge: top?.tagName === 'NEXTJS-PORTAL', top: top?.outerHTML.slice(0, 110) ?? null };
  })()`);
  assert.ok(c, `${selector}: no visible, enabled element`);
  if (c.devBadge) {
    await cdp.evaluate(`(() => {
      const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0 && !x.disabled);
      e?.click();
      return true;
    })()`);
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
const select = (start, end) =>
  cdp.evaluate(`(() => { const el = document.querySelector('[data-demo-target="editor"]'); el.focus(); el.setSelectionRange(${start}, ${end}); return el.value.slice(${start}, ${end}); })()`);
const openHub = async (label) => {
  if (await panelShown()) return;
  await realClick("[data-editor-review-hub-trigger]", { scroll: false });
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`, { label: `${label}: Hub opens` });
  await sleep(350); // the panel's height cap is measured one frame after it opens (ResizeObserver); tap only once it has settled
};
const closeHub = async () => {
  if (!(await panelShown())) return;
  await sleep(350); // a pin toggle just changed the footer height: let the panel cap re-measure before tapping ✕
  await realClick("[data-review-hub-close]");
  await cdp.waitFor(`getComputedStyle(document.querySelector('${PANEL}')).display === 'none'`, { label: "Hub closes" });
};
const waitIdle = (label) => cdp.waitFor(`!document.querySelector('[data-read-aloud-playback]') && !document.querySelector('[data-read-aloud-footer-pause],[data-read-aloud-footer-resume]')`, { timeoutMs: 20_000, label });
const setRange = (value) =>
  cdp.evaluate(`(() => { const el = document.querySelector('[data-read-aloud-rate]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return el.value; })()`);
const noHorizontalScroll = (tag) =>
  cdp.evaluate(`({ doc: document.documentElement.scrollWidth, vw: innerWidth, body: document.body.scrollWidth })`).then((m) => {
    assert.ok(m.doc <= m.vw + 1 && m.body <= m.vw + 1, `${tag}: page scrolls horizontally (${JSON.stringify(m)})`);
  });
async function shot(name) {
  if (!SHOTS) return;
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
}
const insideViewport = (r, tag) => assert.ok(r && r.shown && r.l >= -0.5 && r.t >= -0.5 && r.r <= r.vw + 0.5 && r.b <= r.vh + 0.5, `${tag}: outside viewport ${JSON.stringify(r)}`);

// ------------------------------------------------------------------------------------------------
async function coreViewport(v) {
  const tag = v.name;
  await openWith({ tatespun_editor_footer_collapsed: "off" }, v.width, v.height);
  await setText(TEXT);
  const mark = requests.length;

  // nothing speaks by itself; the Hub lists the third tool and no fifth top menu appeared
  await sleep(700);
  assert.deepEqual(await spokenTexts(), [], `${tag}: nothing may be spoken on load / while idle`);
  await openHub(tag);
  assert.deepEqual(
    await cdp.evaluate(`[...document.querySelectorAll('${PANEL} [data-review-hub-tool]')].map((e) => e.dataset.reviewHubTool)`),
    ["writing-check", "character-count", "read-aloud", "description-check"],
    `${tag}: 音読β is the third Hub tool`
  );
  const topMenu = await cdp.evaluate(`document.querySelector('header')?.innerText ?? ''`);
  assert.doesNotMatch(topMenu, /音読/, `${tag}: no top-menu entry for 音読β`);
  assert.deepEqual(await spokenTexts(), [], `${tag}: opening the Hub does not speak`);
  const panelText = await cdp.evaluate(`document.querySelector('[data-review-hub-read-aloud]').textContent`);
  assert.match(panelText, /この端末の音声で読みます。原稿を外部へ送りません。/, `${tag}: privacy line shown`);
  assert.match(panelText, /選択範囲を読む/);
  assert.match(panelText, /現在の段落を読む/);
  assert.match(panelText, /全文を読む/);
  await noHorizontalScroll(`${tag} (Hub open)`);
  insideViewport(await rect(PANEL), `${tag} panel`);

  // --- selection
  const selStart = TEXT.indexOf("静かな夜だった。");
  const picked = await select(selStart, selStart + "静かな夜だった。".length);
  assert.equal(picked, "静かな夜だった。");
  await realClick("[data-read-aloud-start=selection]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`, { label: `${tag}: selection speaks` });
  assert.equal((await spokenTexts())[0], "静かな夜だった。", `${tag}: only the selection is read`);
  assert.equal((await spoken())[0].lang, "ja-JP");
  assert.equal((await spoken())[0].local, true, `${tag}: default voice is on-device`);
  await waitIdle(`${tag}: selection reading ends`);
  assert.equal((await spokenTexts()).length, 1);

  // empty selection -> guidance, nothing spoken
  await select(3, 3);
  await realClick("[data-read-aloud-start=selection]");
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-notice]')`, { label: `${tag}: empty-selection guidance` });
  assert.equal((await spokenTexts()).length, 1, `${tag}: an empty selection speaks nothing`);

  // --- paragraph (caret in paragraph 2, no selection)
  await cdp.evaluate(`window.__ra.spoken.length = 0`);
  await select(TEXT.indexOf("静かな夜") + 1, TEXT.indexOf("静かな夜") + 1);
  await realClick("[data-read-aloud-start=paragraph]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`, { label: `${tag}: paragraph speaks` });
  await waitIdle(`${tag}: paragraph reading ends`);
  assert.deepEqual(await spokenTexts(), P2_SPOKEN, `${tag}: the caret's paragraph is read sentence by sentence (ruby/notation not applicable here)`);

  // paragraph 1 has ruby: read as the reading, notation never spoken
  await cdp.evaluate(`window.__ra.spoken.length = 0`);
  await select(2, 2);
  await realClick("[data-read-aloud-start=paragraph]");
  await waitIdle(`${tag}: paragraph 1 ends`);
  assert.deepEqual(await spokenTexts(), P1_SPOKEN, `${tag}: ruby is read as its reading`);
  assert.doesNotMatch((await spokenTexts()).join(""), /[｜《》]/, `${tag}: notation is never spoken`);

  // --- full manuscript: play / pause / resume / stop
  await cdp.evaluate(`window.__ra.spoken.length = 0; window.__ra.log.length = 0`);
  await select(0, 0);
  await realClick("[data-read-aloud-start=full]");
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-pause]')`, { label: `${tag}: pause control while speaking` });
  const progress = await cdp.evaluate(`document.querySelector('[data-read-aloud-progress]').textContent.replace(/\\s+/g, ' ').trim()`);
  assert.equal(progress, `1 / ${P1_SPOKEN.length + P2_SPOKEN.length + P3_SPOKEN.length} 文`, `${tag}: progress shows sentence x / N (${progress})`);
  await realClick("[data-read-aloud-pause]");
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-resume]')`, { label: `${tag}: resume control while paused` });
  assert.equal((await synthState()).paused, true, `${tag}: engine is paused`);
  const beforePause = (await spokenTexts()).length;
  await sleep(900);
  assert.equal((await spokenTexts()).length, beforePause, `${tag}: nothing advances while paused`);
  assert.match(await cdp.evaluate(`document.querySelector('[data-read-aloud-progress]').textContent`), /一時停止中/);
  await realClick("[data-read-aloud-resume]");
  await cdp.waitFor(`window.__ra.spoken.length > ${beforePause}`, { label: `${tag}: resume continues to the next sentence` });
  assert.equal((await synthState()).paused, false);
  await realClick("[data-read-aloud-stop]");
  await cdp.waitFor(`!document.querySelector('[data-read-aloud-playback]')`, { label: `${tag}: stop returns to idle` });
  const afterStop = (await spokenTexts()).length;
  await sleep(900);
  assert.equal((await spokenTexts()).length, afterStop, `${tag}: nothing more is spoken after stop`);
  assert.deepEqual((await synthState()), { paused: false, current: null, queue: 0 }, `${tag}: synth is clean after stop`);
  const heard = await spokenTexts();
  assert.deepEqual(heard, [...P1_SPOKEN, ...P2_SPOKEN, ...P3_SPOKEN].slice(0, heard.length), `${tag}: full reading goes in manuscript order`);

  // complete full read
  await cdp.evaluate(`window.__ra.spoken.length = 0`);
  await realClick("[data-read-aloud-start=full]");
  await waitIdle(`${tag}: full reading completes`);
  assert.deepEqual(await spokenTexts(), [...P1_SPOKEN, ...P2_SPOKEN, ...P3_SPOKEN], `${tag}: whole manuscript, in order, notation-free`);

  // --- speed
  await cdp.evaluate(`window.__ra.spoken.length = 0`);
  assert.equal(await setRange(1.5), "1.5");
  await cdp.waitFor(`document.querySelector('[data-read-aloud-rate-label]').textContent === '×1.5'`, { label: `${tag}: speed label` });
  await realClick("[data-read-aloud-start=full]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`);
  assert.equal((await spoken())[0].rate, 1.5, `${tag}: speed reaches the utterance`);
  await setRange(0.8); // while speaking: current sentence restarts at the new speed
  await cdp.waitFor(`window.__ra.spoken.some((s) => s.rate === 0.8)`, { label: `${tag}: speed change applies mid-reading` });
  await realClick("[data-read-aloud-stop]");
  assert.equal(JSON.parse(await cdp.evaluate(`localStorage.getItem('${RA_PREFS_KEY}')`)).rate, 0.8, `${tag}: speed is remembered in this browser`);

  // --- no duplicate overlap: hammer start
  await cdp.evaluate(`window.__ra.maxActive = 0; window.__ra.spoken.length = 0`);
  for (let i = 0; i < 4; i += 1) await realClick("[data-read-aloud-start=full]");
  await sleep(500);
  assert.ok((await maxActive()) <= 1, `${tag}: at most one utterance active at a time (saw ${await maxActive()})`);
  await realClick("[data-read-aloud-stop]");
  await cdp.waitFor(`!document.querySelector('[data-read-aloud-playback]')`);

  // --- voice selector (2 on-device + 1 online voices)
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-read-aloud-voice] optgroup')`), true, `${tag}: online voices grouped and labelled`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-read-aloud-online-warning]')`), false, `${tag}: no online warning by default`);
  await cdp.evaluate(`(() => { const s = document.querySelector('[data-read-aloud-voice]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'ja-online'); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-online-warning]')`, { label: `${tag}: explicit online voice shows the warning` });
  await cdp.evaluate(`window.__ra.spoken.length = 0`);
  await realClick("[data-read-aloud-start=paragraph]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`);
  assert.equal((await spoken())[0].voiceURI, "ja-online", `${tag}: explicit choice is honoured`);
  await realClick("[data-read-aloud-stop]");
  await cdp.evaluate(`(() => { const s = document.querySelector('[data-read-aloud-voice]'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, ''); s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await cdp.waitFor(`!document.querySelector('[data-read-aloud-online-warning]')`);
  await cdp.evaluate(`window.__ra.spoken.length = 0`);
  await realClick("[data-read-aloud-start=paragraph]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`);
  assert.equal((await spoken())[0].local, true, `${tag}: back to automatic = on-device voice`);
  await realClick("[data-read-aloud-stop]");

  // --- no external transmission of the manuscript
  const after = requests.slice(mark);
  const leaks = after.filter((r) => r.postData.includes(SENTINEL) || r.url.includes(encodeURIComponent(SENTINEL)) || (!isLoopback(r.url) && (r.method !== "GET" || r.hasPost)));
  assert.deepEqual(leaks, [], `${tag}: no manuscript request left the device: ${JSON.stringify(leaks).slice(0, 300)}`);

  // --- pages layout / evidence
  await select(0, 0);
  await realClick("[data-read-aloud-start=full]");
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-pause]')`);
  await noHorizontalScroll(`${tag} (reading)`);
  insideViewport(await rect(PANEL), `${tag} panel (reading)`);
  await shot(`b4-hub-reading-${tag}`);
  await realClick("[data-read-aloud-stop]");
  await closeHub();
  log(`  ${tag}: idle silence / selection / paragraph / full / pause-resume-stop / speed / no-overlap / voices / no-transmission OK`);
}


async function pinViewport(v) {
  const tag = `${v.name} desktop`;
  await openWith({ tatespun_editor_footer_collapsed: "off" }, v.width, v.height);
  await setText(TEXT);
  await openHub(tag);

  const toggle = (id) => `[data-review-hub-tool="${id}"] [data-review-hub-footer-pin-toggle]`;
  const state = (id) => cdp.evaluate(`(() => { const b = document.querySelector('${toggle(id)}'); return { pressed: b.getAttribute('aria-pressed'), disabled: b.disabled }; })()`);
  const pins = () => cdp.evaluate(`JSON.parse(localStorage.getItem('${PINS_KEY}') ?? 'null')`);
  const ghost = () => cdp.evaluate(`[...document.querySelectorAll('[data-held-selection]')].map((e) => e.textContent).join('')`);
  const checkedTarget = () => cdp.evaluate(`document.querySelector('[data-read-aloud-inline-target][aria-checked="true"]')?.dataset.readAloudInlineTarget ?? null`);

  assert.deepEqual(await cdp.evaluate(`JSON.parse(localStorage.getItem('${PINS_KEY}') ?? 'null')`), null, `${tag}: default is unstored`);
  assert.deepEqual(await state("read-aloud"), { pressed: "false", disabled: true }, `${tag}: max-2 prevents a third pin`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-read-aloud-inline-bar]')`), false, `${tag}: idle unpinned B4 is absent from the bar`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-desktop-review-bar]')`), true, `${tag}: Desktop Review Bar is present`);

  // Unpinned != disabled: full B4 remains usable inside 見直し.
  await select(0, 0);
  await realClick("[data-read-aloud-start=paragraph]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`, { label: `${tag}: unpinned tool works from Hub` });
  await realClick("[data-read-aloud-stop]");

  // Free one default slot and pin B4.
  await realClick(toggle("character-count"));
  await realClick(toggle("read-aloud"));
  await closeHub();
  assert.deepEqual(await pins(), ["writing-check", "read-aloud"], `${tag}: pin order persisted`);
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-inline-bar]')`, { label: `${tag}: desktop inline B4 appears` });
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-read-aloud-footer]')`), false, `${tag}: compact control is absent on desktop`);
  insideViewport(await rect("[data-read-aloud-inline-bar]"), `${tag} inline B4`);
  await noHorizontalScroll(`${tag} inline`);

  assert.equal(await checkedTarget(), "paragraph", `${tag}: default target is 現在の段落`);
  for (const target of ["full", "selection", "paragraph"]) {
    await realClick(`[data-read-aloud-inline-target=${target}]`, { scroll: false });
    await cdp.waitFor(`document.querySelector('[data-read-aloud-inline-target=${target}]').getAttribute('aria-checked') === 'true'`, { label: `${tag}: target ${target}` });
    assert.equal(await checkedTarget(), target, `${tag}: exactly one inline target selected`);
  }

  // No held selection -> selection play disabled.
  await select(3, 3);
  await realClick("[data-read-aloud-inline-target=selection]", { scroll: false });
  assert.equal(await cdp.evaluate(`document.querySelector('[data-read-aloud-inline-play]').disabled`), true, `${tag}: selection play disabled without held text`);
  assert.equal(await ghost(), "", `${tag}: no phantom held highlight`);

  // Real selection -> React portal pointerdown captures it; ghost remains visible after editor loses focus.
  const sentence = "静かな夜だった。";
  const at = TEXT.indexOf(sentence);
  assert.equal(await select(at, at + sentence.length), sentence);
  await realClick("[data-read-aloud-inline-target=selection]", { scroll: false });
  await cdp.waitFor(`[...document.querySelectorAll('[data-held-selection]')].map((e) => e.textContent).join('') === ${JSON.stringify(sentence)}`, { label: `${tag}: held selection ghost` });
  assert.equal(await ghost(), sentence, `${tag}: held highlight matches the selection`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-read-aloud-inline-play]').disabled`), false, `${tag}: selection can now be read`);

  await cdp.evaluate(`window.__ra.spoken.length = 0`);
  await realClick("[data-read-aloud-inline-play]", { scroll: false });
  await cdp.waitFor(`window.__ra.spoken.length >= 1 && !!document.querySelector('[data-read-aloud-inline-pause]')`, { label: `${tag}: inline reading starts` });
  assert.equal((await spokenTexts())[0], sentence, `${tag}: inline selection reads only the held sentence`);
  await realClick("[data-read-aloud-inline-pause]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-inline-resume]')`, { label: `${tag}: inline pause` });
  await realClick("[data-read-aloud-inline-resume]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-inline-pause]')`, { label: `${tag}: inline resume` });
  await realClick("[data-read-aloud-inline-stop]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-inline-play]')`, { label: `${tag}: inline stop returns idle` });

  // Hub still owns detailed controls such as speed / voice / pronunciation, and held state survives.
  await openHub(tag);
  assert.match(await cdp.evaluate(`document.querySelector('[data-review-hub-read-aloud]').textContent`), /選択範囲を保持中/, `${tag}: held selection survives opening Hub`);
  assert.equal(await ghost(), sentence);
  await closeHub();

  // Unpinning hides only the display, not the feature.
  await openHub(tag);
  await realClick(toggle("read-aloud"));
  await closeHub();
  await cdp.waitFor(`!document.querySelector('[data-read-aloud-inline-bar]')`, { label: `${tag}: unpin hides idle inline display` });
  log(`  ${tag}: final desktop B4 inline target/play/pause/resume/stop + held state + pin separation OK`);
}

async function compactPinViewport(v) {
  const tag = `${v.name} compact`;
  await openWith({ tatespun_editor_footer_collapsed: "off" }, v.width, v.height);
  await setText(TEXT);
  await openHub(tag);
  const toggle = (id) => `[data-review-hub-tool="${id}"] [data-review-hub-footer-pin-toggle]`;
  await realClick(toggle("character-count"));
  await realClick(toggle("read-aloud"));
  await closeHub();

  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-desktop-review-bar]')`), false, `${tag}: no Desktop Review Bar on true mobile`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-review-dock-card=read-aloud]')`), false, `${tag}: no permanent B4 card`);
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-status-pill]')`, { label: `${tag}: pinned idle B4 status pill appears` });
  insideViewport(await rect("[data-read-aloud-status-pill]"), `${tag} status pill`);

  // Pinned idle tap opens the targeted Bottom Sheet; playback then becomes directly controllable in footer.
  await select(TEXT.indexOf("静かな夜") + 1, TEXT.indexOf("静かな夜") + 1);
  await realClick("[data-read-aloud-status-pill]", { scroll: false });
  await cdp.waitFor(`!document.querySelector('${PANEL}').hasAttribute('hidden')`, { label: `${tag}: targeted sheet opens` });
  assert.equal(await cdp.evaluate(`document.querySelector('${PANEL}').hasAttribute('data-review-hub-sheet')`), true, `${tag}: Hub is Bottom Sheet`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-review-hub-read-aloud]')`), true, `${tag}: B4 detail reachable`);

  await cdp.evaluate(`window.__ra.spoken.length = 0`);
  await realClick("[data-read-aloud-start=paragraph]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`, { label: `${tag}: sheet starts reading` });
  await realClickAt(4, 4);
  await cdp.waitFor(`document.querySelector('${PANEL}').hasAttribute('hidden')`);
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-footer-pause]')`, { label: `${tag}: active direct pause appears in footer` });
  await realClick("[data-read-aloud-footer-pause]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-footer-resume]')`, { label: `${tag}: footer pause` });
  await realClick("[data-read-aloud-footer-resume]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-footer-pause]')`, { label: `${tag}: footer resume` });
  await realClick("[data-read-aloud-footer-stop]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-status-pill]') && !document.querySelector('[data-read-aloud-footer-pause],[data-read-aloud-footer-resume]')`, { label: `${tag}: stop returns to pinned idle status pill` });

  await noHorizontalScroll(tag);
  log(`  ${tag}: pinned idle status pill -> targeted Bottom Sheet -> active direct controls OK`);
}
async function stateViewport(v) {
  const tag = `${v.name} states`;
  // unsupported browser
  await openWith({ [MODE_KEY]: "unsupported" }, v.width, v.height);
  await openHub(tag);
  let text = await cdp.evaluate(`document.querySelector('[data-review-hub-read-aloud]').textContent`);
  assert.match(text, /このブラウザでは音読機能を使えません/, `${tag}: unsupported message`);
  assert.equal(await cdp.evaluate(`[...document.querySelectorAll('[data-read-aloud-start]')].every((b) => b.disabled)`), true, `${tag}: unsupported -> reading disabled`);
  assert.equal(await cdp.evaluate(`typeof window.__ra`), "undefined");
  await noHorizontalScroll(`${tag} unsupported`);
  await shot(`b4-unsupported-${v.name}`);
  // no on-device Japanese voice: never falls back to the online one
  await openWith({ [MODE_KEY]: "no-ja" }, v.width, v.height);
  await openHub(tag);
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-unavailable]') && !/確認しています/.test(document.querySelector('[data-read-aloud-unavailable]').textContent)`, { label: `${tag}: no-voice message` });
  text = await cdp.evaluate(`document.querySelector('[data-review-hub-read-aloud]').textContent`);
  assert.match(text, /日本語の音声が見つかりません/, `${tag}: no on-device Japanese voice message`);
  assert.equal(await cdp.evaluate(`[...document.querySelectorAll('[data-read-aloud-start]')].every((b) => b.disabled)`), true, `${tag}: reading disabled without an on-device voice`);
  assert.deepEqual(await spokenTexts(), [], `${tag}: nothing spoken`);
  await cdp.evaluate(`localStorage.removeItem('${MODE_KEY}')`);
  log(`  ${tag}: unsupported browser / no on-device Japanese voice OK`);
}

async function pronunciationViewport(v) {
  // TSP-Review-UI (Revision 3) 音読の読み辞書: register a corrected reading from a manuscript selection,
  // confirm it actually reaches what B4 speaks, confirm ruby still wins over the dictionary (the exact
  // 人気《にんき》 example from the spec), confirm the manuscript itself is never touched, and exercise
  // edit / delete / reload persistence -- all browser-local (no Supabase/cloud round trip exists to check).
  const tag = `${v.name} pronunciation`;
  const DICT_KEY = "tatespun.readAloudPronunciation.v1";
  const P_TEXT = "大分は美しい県です。｜人気《にんき》があります。";
  const dictEntries = () => cdp.evaluate(`(() => { try { return JSON.parse(localStorage.getItem('${DICT_KEY}') || '[]'); } catch { return []; } })()`);
  const setDictInput = (selector, value) =>
    cdp.evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  const readFullNow = async () => {
    await cdp.evaluate(`window.__ra.spoken.length = 0`);
    await realClick("[data-read-aloud-start=full]");
    await waitIdle(`${tag}: full reading completes`);
    return spokenTexts();
  };
  // A fresh select() makes the NEXT pointerdown inside the Hub the one that first captures `held` --
  // which visibly grows the read-aloud section by a line (the held-selection state it now reflects) an
  // instant into that same click. A coordinate-based click computed just before mousedown can therefore
  // land on stale coordinates by the time mouseup actually resolves. Priming on a stable, non-interactive
  // line first lets that one-time reflow happen and settle, so the real click below lands correctly.
  const primeHeldSelection = async () => {
    await realClick("[data-read-aloud-pronunciation] p");
    await sleep(400);
  };

  await openWith({}, v.width, v.height);
  await setText(P_TEXT);
  await openHub(tag);

  // register 大分 -> おおいた from a plain (non-ruby) selection
  const at1 = P_TEXT.indexOf("大分");
  assert.equal(await select(at1, at1 + 2), "大分");
  await primeHeldSelection();
  await realClick("[data-read-aloud-pronunciation-register-open]");
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-pronunciation-form]')`, { label: `${tag}: register form opens from a held selection` });
  assert.equal(await cdp.evaluate(`document.querySelector('[data-read-aloud-pronunciation-surface]').textContent`), "大分", `${tag}: 表記 is pre-filled from the selection`);
  await setDictInput("[data-read-aloud-pronunciation-reading]", "おおいた");
  await realClick("[data-read-aloud-pronunciation-save]");
  await cdp.waitFor(`!document.querySelector('[data-read-aloud-pronunciation-form]')`, { label: `${tag}: form closes after saving` });
  assert.deepEqual((await dictEntries()).map((e) => [e.surface, e.reading]), [["大分", "おおいた"]], `${tag}: saved browser-locally`);

  // register 人気 -> ひとけ -- 人気 ALSO carries a ruby reading (にんき) in the manuscript; the ruby must
  // still win when actually reading (priority: ruby > dictionary > browser default).
  const at2 = P_TEXT.indexOf("人気");
  assert.equal(await select(at2, at2 + 2), "人気");
  await primeHeldSelection();
  await realClick("[data-read-aloud-pronunciation-register-open]");
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-pronunciation-form]')`);
  assert.equal(await cdp.evaluate(`document.querySelector('[data-read-aloud-pronunciation-surface]').textContent`), "人気");
  await setDictInput("[data-read-aloud-pronunciation-reading]", "ひとけ");
  await realClick("[data-read-aloud-pronunciation-save]");
  await cdp.waitFor(`!document.querySelector('[data-read-aloud-pronunciation-form]')`);

  assert.equal(await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`), P_TEXT, `${tag}: registering readings never mutates the manuscript`);

  await select(0, 0);
  assert.deepEqual(
    await readFullNow(),
    ["おおいたは美しい県です。", "にんきがあります。"],
    `${tag}: dictionary reading used for 大分, ruby reading (not the dictionary) used for 人気`
  );

  // edit: 大分's reading
  const idOf = async (surface) => ((await dictEntries()).find((e) => e.surface === surface) ?? {}).id ?? null;
  const id1 = await idOf("大分");
  assert.ok(id1, `${tag}: 大分 entry has an id`);
  await cdp.evaluate(`document.querySelector('[data-read-aloud-pronunciation-list]')?.setAttribute('open', '')`);
  await realClick(`[data-read-aloud-pronunciation-item="${id1}"] [data-read-aloud-pronunciation-edit]`);
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-pronunciation-item="${id1}"] [data-read-aloud-pronunciation-edit-input]')`, { label: `${tag}: edit row opens` });
  await setDictInput(`[data-read-aloud-pronunciation-item="${id1}"] [data-read-aloud-pronunciation-edit-input]`, "おおいたけん");
  await realClick(`[data-read-aloud-pronunciation-item="${id1}"] [data-read-aloud-pronunciation-edit-save]`);
  await cdp.waitFor(`JSON.parse(localStorage.getItem('${DICT_KEY}') || '[]').find((e) => e.surface === '大分')?.reading === 'おおいたけん'`, { label: `${tag}: edit persists` });

  // delete: 人気's dictionary entry (ruby already wins for it, so reading is unaffected either way)
  const id2 = await idOf("人気");
  assert.ok(id2, `${tag}: 人気 entry has an id`);
  await realClick(`[data-read-aloud-pronunciation-item="${id2}"] [data-read-aloud-pronunciation-remove]`);
  await cdp.waitFor(`JSON.parse(localStorage.getItem('${DICT_KEY}') || '[]').length === 1`, { label: `${tag}: delete removes the entry` });

  assert.deepEqual(
    await readFullNow(),
    ["おおいたけんは美しい県です。", "にんきがあります。"],
    `${tag}: edited reading applied; deleting 人気's entry changes nothing (ruby already won)`
  );

  // reload: the dictionary is browser-local (localStorage) and survives independently of B4's held selection
  await navigate();
  assert.deepEqual((await dictEntries()).map((e) => [e.surface, e.reading]), [["大分", "おおいたけん"]], `${tag}: dictionary survives reload`);
  await setText(P_TEXT);
  await openHub(tag);
  assert.deepEqual(
    await readFullNow(),
    ["おおいたけんは美しい県です。", "にんきがあります。"],
    `${tag}: reading after reload still uses the persisted dictionary`
  );
  await closeHub();
  log(`  ${tag}: register from selection / ruby beats dictionary / manuscript untouched / edit / delete / reload persistence OK`);
}

async function lifecycle(v) {
  const tag = `${v.name} lifecycle`;
  await openWith({}, v.width, v.height);
  await setText(TEXT);
  await openHub(tag);
  await select(0, 0);
  await realClick("[data-read-aloud-start=full]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`);
  const before = await cdp.evaluate(`JSON.parse(sessionStorage.getItem('__ra_log') || '[]').filter((e) => e.type === 'cancel').length`);
  await navigate(); // reload while reading -> pagehide handler must cancel
  const entries = await cdp.evaluate(`JSON.parse(sessionStorage.getItem('__ra_log') || '[]')`);
  const hideIdx = entries.findIndex((e) => e.type === 'pagehide');
  assert.ok(hideIdx >= 0, `${tag}: pagehide fired`);
  assert.ok(entries.slice(hideIdx + 1).some((e) => e.type === 'cancel') && entries.filter((e) => e.type === 'cancel').length > before, `${tag}: the page-hide handler cancelled the speech queue (the browser keeps speaking otherwise)`);
  assert.deepEqual(await spokenTexts(), [], `${tag}: the reloaded page does not resume/auto-read`);
  log(`  ${tag}: reload cancels speech / nothing auto-reads OK`);
}

try {
  for (const v of VIEWPORTS) await coreViewport(v);
  await compactPinViewport(VIEWPORTS[0]); // 390: true mobile (<768)
  for (const v of [VIEWPORTS[1], VIEWPORTS[2]]) await pinViewport(v); // 770 / 1280: Desktop Review Bar
  for (const v of [VIEWPORTS[0], VIEWPORTS[2]]) await stateViewport(v);
  await lifecycle(VIEWPORTS[2]);
  await pronunciationViewport(VIEWPORTS[2]);
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
