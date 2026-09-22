// Explicit-run real-browser E2E for the Review UI responsive architecture (Human-QA revision 3):
// desktop Review Rail / compact mini bar + Bottom Sheet / Review Hub readability.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3117 npm run test:e2e:review-layout
//   (optional) TATESPUN_E2E_SHOTS=<dir>       screenshots
//   (optional) TATESPUN_E2E_EVIDENCE=<file>   measured geometry (JSON)
//   TATESPUN_E2E_VIEWPORTS=390x844,1280x720   run only some viewports (comma-separated names below)
//
// What it proves, for 0 / single-tool / both-B4-B5 / B4-or-B5-plus-文章チェック / B4-or-B5-plus-文字数
// pin combinations, at 390 (phone), 770 and 900x800/1024x800 ("tablet"/split-screen desktop),
// 1180/1280/1440 (wide desktop) -- WINDOWED editor:
//  * <1100px measured <main> width -> the COMPACT surface: no permanently-mounted card, a one-line
//    mini control per pinned dock tool in the footer status row, the manuscript keeps its viewport;
//  * >=1100px measured <main> width -> the RAIL surface: pinned tools become cards in a dedicated
//    sidebar beside the manuscript; the manuscript's HEIGHT is unaffected by how many tools are
//    pinned (only its WIDTH narrows, and only on the rail surface);
//  * on the compact surface the Review Hub (見直し) is a real Bottom Sheet: fixed to the viewport,
//    a backdrop, <=75vh, rounded top, a real close button, scrollable content, no horizontal scroll;
//  * an actively-playing 音読β stays controllable via the mini bar even when UNPINNED and even after
//    the Bottom Sheet is closed;
//  * B5 candidate navigation still works from both the Rail card and from inside the Bottom Sheet;
//  * B4's held-selection state survives opening/closing the Hub, switching Rail/Bottom Sheet, and
//    Rail vs compact transitions (same derived-validity model as Revision 2 -- unaffected by this UI change);
//  * max-2 pin regression holds on both surfaces; no horizontal overflow anywhere.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { sleep } from "./helpers/cdp.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";

const NAME = "review layout E2E";
const target = resolveE2eTarget(process.env, NAME);
const SHOTS = process.env.TATESPUN_E2E_SHOTS || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const EVIDENCE = process.env.TATESPUN_E2E_EVIDENCE || "";

const ALL_VIEWPORTS = [
  { name: "390x844", width: 390, height: 844, surface: "compact" },
  { name: "770x900", width: 770, height: 900, surface: "compact" },
  { name: "1024x800", width: 1024, height: 800, surface: "compact" },
  { name: "1180x800", width: 1180, height: 800, surface: "rail" },
  { name: "1280x720", width: 1280, height: 720, surface: "rail" },
  { name: "1440x800", width: 1440, height: 800, surface: "rail" },
];
const ONLY = (process.env.TATESPUN_E2E_VIEWPORTS || "").split(",").filter(Boolean);
const VIEWPORTS = ONLY.length ? ALL_VIEWPORTS.filter((v) => ONLY.includes(v.name)) : ALL_VIEWPORTS;

const PINS_KEY = "tatespun.reviewHub.footerTools.v1";
const PANEL = "[data-review-hub-panel]";
const COMBOS = [
  [],
  ["read-aloud"],
  ["description-check"],
  ["read-aloud", "description-check"],
  ["read-aloud", "writing-check"],
  ["description-check", "character-count"],
];
const TEXT = ["朝の光が窓に差していた。彼女は美しく微笑んだ。", "「行こう」と彼は言った。静かな夜だった。", "まるで夢のような景色を、泣いている少女が見ていた。"].join("\n");

const session = await launchEditorSession("tatespun-review-layout-");
const { cdp } = session;
const pageErrors = [];
cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception"));
const measurements = [];

// fake speech engine (silent, deterministic) so the "active playback survives sheet close" scenario needs no audio
await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const V = (u, n, l, ls) => ({ voiceURI: u, name: n, lang: l, localService: ls, default: false });
    const voices = [V('ja-local', 'Haruka', 'ja-JP', true)];
    const S = { spoken: [], current: null, queue: [] };
    window.__ra = S;
    function pump() { if (S.current || !S.queue.length) return; const u = S.queue.shift(); S.current = { u, timer: setTimeout(() => { S.current = null; u.onend && u.onend({}); pump(); }, 4000) }; }
    const synth = {
      speak(u) { S.spoken.push(u.text); S.queue.push(u); pump(); },
      cancel() { S.queue = []; if (S.current) { clearTimeout(S.current.timer); const c = S.current; S.current = null; setTimeout(() => c.u.onerror && c.u.onerror({ error: 'canceled' }), 0); } },
      pause() { if (S.current) clearTimeout(S.current.timer); },
      resume() { if (S.current) S.current.timer = setTimeout(() => { const c = S.current; S.current = null; c.u.onend && c.u.onend({}); pump(); }, 4000); },
      getVoices: () => voices,
      addEventListener(t, fn) { if (t === 'voiceschanged') setTimeout(fn, 30); },
      removeEventListener() {},
    };
    // window.speechSynthesis is a native getter-only accessor in real Chrome: a plain assignment is a silent
    // no-op there, so the real (non-deterministic, possibly-online) device voices would leak through. Must
    // override via defineProperty, exactly like the B4 E2E's own fake engine does.
    Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
    window.SpeechSynthesisUtterance = function (text) { this.text = text; this.lang = ''; this.rate = 1; this.voice = null; this.onend = null; this.onerror = null; };
  })()`,
});

const rect = (selector) =>
  cdp.evaluate(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r = e.getBoundingClientRect();
    return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, shown: e.getClientRects().length > 0, vw: innerWidth, vh: innerHeight }; })()`);
async function navigate() {
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(`document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved' && !!document.querySelector('[data-demo-target="editor"]')`, { timeoutMs: 30_000, label: "editor ready" });
  await sleep(400);
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
async function realClickAt(x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function realClick(selector, { scroll = true } = {}) {
  if (scroll) await cdp.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0); e?.scrollIntoView({ block: 'nearest' }); return true; })()`);
  const c = await cdp.evaluate(`(() => { const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0 && !x.disabled);
    if (!e) return null; const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const top = document.elementFromPoint(x, y);
    return { x, y, hit: e === top || e.contains(top) || top?.tagName === 'NEXTJS-PORTAL', top: top?.outerHTML.slice(0, 100) ?? null }; })()`);
  assert.ok(c, `${selector}: not found`);
  assert.ok(c.hit, `${selector}: covered -- not tappable (${c.top})`);
  await realClickAt(c.x, c.y);
}
async function shot(name) {
  if (!SHOTS) return;
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, "base64"));
}
const noOverflow = (tag) =>
  cdp.evaluate(`({ doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, vw: innerWidth })`).then((m) =>
    assert.ok(m.doc <= m.vw + 1 && m.body <= m.vw + 1, `${tag}: horizontal scroll ${JSON.stringify(m)}`));
/** The surface takes up to ~2s to settle after a fresh load in dev mode (see harness note in the QA doc) -- poll, don't assume it's instant.
 *  Reads <main data-review-surface> directly (set from the SAME useReviewSurface value TategakiEditor renders with) rather than inferring it
 *  from whether the rail is mounted, since the rail additionally requires a pinned dock tool and would never appear with zero pins. */
const waitSurface = (tag, want) =>
  cdp.waitFor(`document.querySelector('main')?.dataset.reviewSurface === ${JSON.stringify(want)}`, { timeoutMs: 6_000, label: `${tag}: surface settles to ${want}` });

// ---------------------------------------------------------------------------------------------
async function comboCheck(v, pins) {
  const tag = `${v.name} [${pins.join("+") || "none"}]`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(pins) }, v.width, v.height);
  await setText(TEXT);
  const dockTools = pins.filter((id) => id === "read-aloud" || id === "description-check");
  await waitSurface(tag, v.surface); // the surface itself (rail vs compact) is pin-independent; only WHETHER the rail mounts depends on pins
  await noOverflow(tag);
  const ta = await rect("[data-demo-target=editor]");
  const rail = await rect("[data-review-rail]");
  const m = { viewport: v.name, expectedSurface: v.surface, pins: pins.join("+") || "none", manuscriptH: Math.round(ta.h), manuscriptW: Math.round(ta.w) };

  if (v.surface === "compact") {
    assert.equal(rail, null, `${tag}: no rail on the compact surface`);
    assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-review-dock-card]').length`), 0, `${tag}: no permanent card on the compact surface`);
    if (dockTools.length > 0) {
      for (const id of dockTools) {
        const sel = id === "read-aloud" ? "[data-read-aloud-footer-start],[data-read-aloud-footer-pause],[data-read-aloud-footer-resume]" : "[data-description-check-footer]";
        assert.equal(await cdp.evaluate(`!!document.querySelector('${sel}')`), true, `${tag}: mini control for ${id}`);
      }
    }
  } else {
    if (dockTools.length === 0) {
      assert.equal(rail, null, `${tag}: no rail reserved when nothing dock-eligible is pinned`);
    } else {
      assert.ok(rail && rail.shown, `${tag}: rail present`);
      assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-review-rail] [data-review-dock-card]').length`), dockTools.length, `${tag}: one card per pinned dock tool, inside the rail`);
      assert.ok(rail.l >= -0.5 && rail.r <= rail.vw + 0.5, `${tag}: rail inside the viewport`);
      const inner = await cdp.evaluate(`(() => { const r = document.querySelector('[data-review-rail]'); const rr = r.getBoundingClientRect(); const bad = [];
        for (const el of r.querySelectorAll('button, input, select, [data-review-dock-card]')) { const b = el.getBoundingClientRect(); if (b.width === 0) continue;
          if (b.left < rr.left - 0.5 || b.right > rr.right + 0.5) bad.push(el.outerHTML.slice(0, 60)); }
        return bad; })()`);
      assert.deepEqual(inner, [], `${tag}: every rail control stays inside the rail horizontally`);
    }
  }
  m.railPresent = !!rail;
  measurements.push(m);
}

async function manuscriptHeightUnaffectedByRail(v) {
  const tag = `${v.name} height`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify([]) }, v.width, v.height);
  await waitSurface(tag, "rail");
  const hNone = (await rect("[data-demo-target=editor]")).h;
  await cdp.evaluate(`localStorage.setItem('${PINS_KEY}', JSON.stringify(['read-aloud','description-check']))`);
  await navigate();
  await waitSurface(tag, "rail");
  const hBoth = (await rect("[data-demo-target=editor]")).h;
  assert.ok(Math.abs(hBoth - hNone) < 2, `${tag}: pinning both B4+B5 does not change the manuscript's HEIGHT on the rail surface (0 pins ${hNone}px, 2 pins ${hBoth}px)`);
  log(`  ${tag}: manuscript height unaffected by pinning B4+B5 on the rail surface (0 pins ${Math.round(hNone)}px, 2 pins ${Math.round(hBoth)}px) OK`);
}

async function compactBottomSheet(v) {
  const tag = `${v.name} sheet`;
  await openWith({ tatespun_editor_footer_collapsed: "off" }, v.width, v.height);
  await setText(TEXT);
  await waitSurface(tag, "compact");
  assert.equal(await cdp.evaluate(`!!document.querySelector('${PANEL}')`), true);
  assert.equal(await cdp.evaluate(`document.querySelector('${PANEL}').hasAttribute('hidden')`), true, `${tag}: closed by default`);
  await realClick("[data-editor-review-hub-trigger]");
  await cdp.waitFor(`!document.querySelector('${PANEL}').hasAttribute('hidden')`, { label: `${tag}: sheet opens` });
  assert.equal(await cdp.evaluate(`document.querySelector('${PANEL}').hasAttribute('data-review-hub-sheet')`), true, `${tag}: is the sheet variant`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-review-hub-sheet-backdrop]')`), true, `${tag}: has a backdrop`);
  const panel = await rect(PANEL);
  assert.ok(panel.l <= 0.5 && panel.r >= panel.vw - 0.5, `${tag}: sheet spans the full viewport width (no horizontal scroll)`);
  assert.ok(panel.h <= panel.vh * 0.76, `${tag}: sheet height <= ~75vh (${Math.round(panel.h)}px of ${panel.vh}px)`);
  assert.ok(panel.b >= panel.vh - 0.5, `${tag}: sheet is anchored to the bottom of the viewport`);
  const closeBtn = await rect("[data-review-hub-close]");
  assert.ok(closeBtn.h >= 28 && closeBtn.w >= 28, `${tag}: close target is comfortably tappable (${Math.round(closeBtn.w)}x${Math.round(closeBtn.h)})`);
  await noOverflow(`${tag} (open)`);
  await shot(`sheet-open-${v.name}`);
  // backdrop click closes it
  await realClickAt(4, 4);
  await cdp.waitFor(`document.querySelector('${PANEL}').hasAttribute('hidden')`, { label: `${tag}: backdrop closes the sheet` });
  log(`  ${tag}: full-width, <=75vh, backdrop, comfortable close target, no overflow OK`);
}

async function activePlaybackSurvivesSheetClose(v) {
  const tag = `${v.name} playback-survives-close`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify([]) }, v.width, v.height); // 音読β UNPINNED
  await setText(TEXT);
  await waitSurface(tag, "compact");
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-read-aloud-footer-start],[data-read-aloud-footer-pause]')`), false, `${tag}: no mini control while idle and unpinned`);
  await realClick("[data-editor-review-hub-trigger]");
  await cdp.waitFor(`!document.querySelector('${PANEL}').hasAttribute('hidden')`);
  await realClick("[data-read-aloud-start=full]");
  await cdp.waitFor(`window.__ra.spoken.length >= 1`, { label: `${tag}: reading starts from inside the sheet` });
  await realClickAt(4, 4); // close via backdrop
  await cdp.waitFor(`document.querySelector('${PANEL}').hasAttribute('hidden')`);
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-footer-pause]')`, { label: `${tag}: mini control appears for the still-UNPINNED but actively-speaking tool` });
  insideViewport(await rect("[data-read-aloud-footer-pause]"), `${tag} mini pause`);
  await realClick("[data-read-aloud-footer-pause]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-read-aloud-footer-resume]')`, { label: `${tag}: pause from the mini control` });
  await realClick("[data-read-aloud-footer-stop]", { scroll: false });
  await cdp.waitFor(`!document.querySelector('[data-read-aloud-footer-pause],[data-read-aloud-footer-resume]')`, { label: `${tag}: stop from the mini control` });
  log(`  ${tag}: closing the sheet never strands an in-progress reading OK`);
}
function insideViewport(r, tag) {
  assert.ok(r && r.shown && r.l >= -0.5 && r.t >= -0.5 && r.r <= r.vw + 0.5 && r.b <= r.vh + 0.5, `${tag}: outside viewport ${JSON.stringify(r)}`);
}

async function railCandidateNavigation(v) {
  const tag = `${v.name} rail-nav`;
  await openWith(
    { tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["description-check"]), "tatespun.descriptionCheck.v1": JSON.stringify({ enabled: true, categories: { A: true, B: true, C: false } }) },
    v.width, v.height,
  );
  await setText(TEXT);
  await waitSurface(tag, "rail");
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length > 0`, { label: `${tag}: markers` });
  const CARD = "[data-review-rail] [data-review-dock-card=description-check]";
  assert.equal(await cdp.evaluate(`!!document.querySelector('${CARD}')`), true, `${tag}: card is inside the rail`);
  await realClick(`${CARD} [data-description-card-next]`, { scroll: false });
  await cdp.waitFor(`document.querySelector('${CARD} [data-description-card-position]').textContent.trim().startsWith('1 /')`, { label: `${tag}: 次へ reaches the first candidate`, timeoutMs: 8000 });
  log(`  ${tag}: B5 candidate navigation works from the Rail card OK`);
}

async function maxTwoOnBothSurfaces(v) {
  const tag = `${v.name} max-2`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["read-aloud", "description-check"]) }, v.width, v.height);
  await realClick("[data-editor-review-hub-trigger]");
  await cdp.waitFor(`!document.querySelector('${PANEL}').hasAttribute('hidden')`);
  const toggle = (id) => `[data-review-hub-tool="${id}"] [data-review-hub-footer-pin-toggle]`;
  const st = (id) => cdp.evaluate(`(() => { const b = document.querySelector('${toggle(id)}'); return { pressed: b.getAttribute('aria-pressed'), disabled: b.disabled }; })()`);
  assert.deepEqual(await st("writing-check"), { pressed: "false", disabled: true }, `${tag}: a third pin is prevented`);
  await realClick(toggle("read-aloud"));
  assert.deepEqual(await st("writing-check"), { pressed: "false", disabled: false }, `${tag}: unpinning frees a slot`);
  await realClick(toggle("writing-check"));
  assert.deepEqual(await cdp.evaluate(`JSON.parse(localStorage.getItem('${PINS_KEY}'))`), ["description-check", "writing-check"], `${tag}: persisted in order`);
  await navigate();
  assert.deepEqual(await cdp.evaluate(`JSON.parse(localStorage.getItem('${PINS_KEY}'))`), ["description-check", "writing-check"], `${tag}: survives reload`);
  log(`  ${tag}: max-2 / unpin frees / persistence OK`);
}

// ---------------------------------------------------------------------------------------------
const log = (line) => console.log(line);

try {
  for (const v of VIEWPORTS) {
    for (const pins of COMBOS) await comboCheck(v, pins);
    log(`  ${v.name} (${v.surface}): ${COMBOS.length} pin combinations OK`);
  }
  for (const v of VIEWPORTS.filter((x) => x.surface === "rail")) {
    await manuscriptHeightUnaffectedByRail(v);
    await railCandidateNavigation(v);
  }
  for (const v of VIEWPORTS.filter((x) => x.surface === "compact")) {
    await compactBottomSheet(v);
    await activePlaybackSurvivesSheetClose(v);
  }
  for (const v of [VIEWPORTS.find((x) => x.name === "390x844"), VIEWPORTS.find((x) => x.name === "1280x720")].filter(Boolean)) {
    await maxTwoOnBothSurfaces(v);
  }
  assert.deepEqual(pageErrors, [], `uncaught page error(s): ${JSON.stringify(pageErrors)}`);
  if (EVIDENCE) {
    mkdirSync(dirname(EVIDENCE), { recursive: true });
    writeFileSync(EVIDENCE, JSON.stringify({ measuredAt: new Date().toISOString(), measurements }, null, 2));
  }
  console.log(`${NAME}: PASS (${VIEWPORTS.map((v) => v.name).join(", ")})`);
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
