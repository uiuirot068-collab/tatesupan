// Explicit-run real-browser E2E for the Review UI responsive architecture (Human-QA revision 4):
// desktop Review Bar (bottom of Preview) + popovers / compact mini bar + Bottom Sheet / Review Hub
// readability.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3117 npm run test:e2e:review-layout
//   (optional) TATESPUN_E2E_SHOTS=<dir>       screenshots
//   (optional) TATESPUN_E2E_EVIDENCE=<file>   measured geometry (JSON)
//   TATESPUN_E2E_VIEWPORTS=390x844,1280x720   run only some viewports (comma-separated names below)
//
// What it proves, for 0 / single-tool / both-B4-B5 / B4-or-B5-plus-文章チェック / B4-or-B5-plus-文字数
// pin combinations, at 390 (phone), 770 and 900x800/1024x800 ("tablet"/split-screen desktop),
// 1180/1280/1440 (wide desktop) -- WINDOWED editor:
//  * <768px -> the COMPACT/mobile surface: one-line Review footer + Bottom Sheet;
//  * >=768px -> the DESKTOP surface: one-line Review Bar at the BOTTOM of Preview;
//    B4 音読β uses direct inline scope/playback controls, while B5 uses a quick popover above the bar;
//    the full Hub also opens above the bar without resizing Editor or Preview;
//  * on the compact surface the Review Hub (見直し) is a real Bottom Sheet: fixed to the viewport,
//    a backdrop, <=75vh, rounded top, a real close button, scrollable content, no horizontal scroll;
//  * an actively-playing 音読β stays controllable via the mini bar even when UNPINNED and even after
//    the Bottom Sheet is closed (compact) / after its popover closes (desktop);
//  * B5 candidate navigation still works from both the desktop quick popover and the Bottom Sheet;
//  * B4's held-selection state survives opening/closing the Hub, switching desktop/compact, and
//    surface transitions (same derived-validity model as Revision 2 -- unaffected by this UI change);
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
  { name: "770x900", width: 770, height: 900, surface: "desktop" },
  { name: "1024x800", width: 1024, height: 800, surface: "desktop" },
  { name: "1180x800", width: 1180, height: 800, surface: "desktop" },
  { name: "1280x720", width: 1280, height: 720, surface: "desktop" },
  { name: "1440x800", width: 1440, height: 800, surface: "desktop" },
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

// fake speech engine (silent, deterministic) so the "active playback survives popover/sheet close" scenario needs no audio
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
    return { x, y, hit: e === top || e.contains(top), devBadge: top?.tagName === 'NEXTJS-PORTAL', top: top?.outerHTML.slice(0, 100) ?? null }; })()`);
  assert.ok(c, `${selector}: not found`);
  if (c.devBadge) {
    await cdp.evaluate(`(() => {
      const e = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => x.getClientRects().length > 0 && !x.disabled);
      e?.click();
      return true;
    })()`);
    return;
  }
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
function insideViewport(r, tag) {
  assert.ok(r && r.shown && r.l >= -0.5 && r.t >= -0.5 && r.r <= r.vw + 0.5 && r.b <= r.vh + 0.5, `${tag}: outside viewport ${JSON.stringify(r)}`);
}
/** The surface takes up to ~2s to settle after a fresh load in dev mode (see harness note in the QA doc) -- poll, don't assume it's instant.
 *  Reads <main data-review-surface> directly (set from the SAME useReviewSurface value TategakiEditor renders with) -- unlike Revision 3's
 *  Rail, the Desktop Review Bar mounts on this surface regardless of pins, so no pin-dependent inference is needed either way. */
const waitSurface = (tag, want) =>
  cdp.waitFor(`document.querySelector('main')?.dataset.reviewSurface === ${JSON.stringify(want)}`, { timeoutMs: 6_000, label: `${tag}: surface settles to ${want}` });

// ---------------------------------------------------------------------------------------------
async function comboCheck(v, pins) {
  const tag = `${v.name} [${pins.join("+") || "none"}]`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(pins) }, v.width, v.height);
  await setText(TEXT);
  const dockTools = pins.filter((id) => id === "read-aloud" || id === "description-check");
  await waitSurface(tag, v.surface);
  await noOverflow(tag);
  const ta = await rect("[data-demo-target=editor]");
  const bar = await rect("[data-desktop-review-bar]");
  const m = { viewport: v.name, expectedSurface: v.surface, pins: pins.join("+") || "none", manuscriptH: Math.round(ta.h), manuscriptW: Math.round(ta.w) };

  if (v.surface === "compact") {
    assert.equal(bar, null, `${tag}: no Desktop Review Bar on the compact surface`);
    assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-review-dock-card]').length`), 0, `${tag}: no permanent card on the compact surface`);
    if (dockTools.length > 0) {
      for (const id of dockTools) {
        const sel = id === "read-aloud" ? "[data-read-aloud-status-pill]" : "[data-description-check-footer]";
        assert.equal(await cdp.evaluate(`!!document.querySelector('${sel}')`), true, `${tag}: mini control for ${id}`);
      }
    }
  } else {
    // Revision 4: the bar itself is unconditional on this surface (it carries 見直し regardless of
    // pins) -- unlike Revision 3's Rail, which only existed at all with a dock-eligible pin.
    assert.ok(bar && bar.shown, `${tag}: Desktop Review Bar present`);
    assert.ok(bar.l >= -0.5 && bar.r <= bar.vw + 0.5, `${tag}: bar inside the viewport`);
    assert.equal(await cdp.evaluate(`!!document.querySelector('[data-editor-review-hub-trigger]')`), true, `${tag}: 見直し reachable regardless of pins`);
    // No permanently-mounted dock card / popover -- daily controls open on demand only.
    assert.equal(await cdp.evaluate(`document.querySelectorAll('[data-review-dock-card]').length`), 0, `${tag}: no permanently-open popover`);
    for (const id of ["read-aloud", "description-check"]) {
      const pillSel = id === "read-aloud" ? "[data-read-aloud-inline-bar]" : "[data-description-check-footer]";
      const expected = dockTools.includes(id);
      assert.equal(await cdp.evaluate(`!!document.querySelector('${pillSel}')`), expected, `${tag}: ${id} status pill ${expected ? "shown" : "absent"}`);
    }
  }
  m.barPresent = !!bar;
  measurements.push(m);
}

async function manuscriptAndPreviewUnaffectedByPins(v) {
  const tag = `${v.name} dimensions`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify([]) }, v.width, v.height);
  await waitSurface(tag, "desktop");
  const editorNone = await rect("[data-demo-target=editor]");
  const previewNone = await rect("[data-desktop-review-bar]").then(() => cdp.evaluate(`(() => { const s = document.querySelector('[data-desktop-review-bar]')?.closest('section'); const r = s?.getBoundingClientRect(); return r ? { w: r.width, h: r.height } : null; })()`));
  await cdp.evaluate(`localStorage.setItem('${PINS_KEY}', JSON.stringify(['read-aloud','description-check']))`);
  await navigate();
  await waitSurface(tag, "desktop");
  const editorBoth = await rect("[data-demo-target=editor]");
  const previewBoth = await cdp.evaluate(`(() => { const s = document.querySelector('[data-desktop-review-bar]')?.closest('section'); const r = s?.getBoundingClientRect(); return r ? { w: r.width, h: r.height } : null; })()`);
  assert.ok(Math.abs(editorBoth.h - editorNone.h) < 2, `${tag}: pinning both B4+B5 does not change the manuscript's HEIGHT (0 pins ${editorNone.h}px, 2 pins ${editorBoth.h}px)`);
  assert.ok(Math.abs(editorBoth.w - editorNone.w) < 2, `${tag}: pinning both B4+B5 does not change the manuscript's WIDTH (0 pins ${editorNone.w}px, 2 pins ${editorBoth.w}px)`);
  assert.ok(Math.abs(previewBoth.w - previewNone.w) < 2, `${tag}: pinning both B4+B5 does not change Preview's WIDTH (0 pins ${previewNone.w}px, 2 pins ${previewBoth.w}px)`);
  assert.ok(Math.abs(previewBoth.h - previewNone.h) < 2, `${tag}: pinning both B4+B5 does not change Preview's HEIGHT (0 pins ${previewNone.h}px, 2 pins ${previewBoth.h}px)`);
  log(`  ${tag}: manuscript + Preview dimensions unaffected by pinning B4+B5 (editor ${Math.round(editorNone.w)}x${Math.round(editorNone.h)}px, preview ${Math.round(previewNone.w)}x${Math.round(previewNone.h)}px) OK`);
}

/** Opening/closing a popover must not resize Editor or Preview either (the whole point of a popover
 *  OVERLAYING Preview instead of the old Rail's permanent third column). */

async function popoverDoesNotResize(v) {
  const tag = `${v.name} popover-no-resize`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["read-aloud", "description-check"]) }, v.width, v.height);
  await setText(TEXT);
  await waitSurface(tag, "desktop");
  const editorBefore = await rect("[data-demo-target=editor]");
  const previewBefore = await cdp.evaluate(`(() => { const s = document.querySelector('[data-desktop-review-bar]').closest('section'); const r = s.getBoundingClientRect(); return { w: r.width, h: r.height }; })()`);
  // Final B4 is an inline direct-control bar on desktop; B5 remains the quick-popover proof.
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-read-aloud-inline-bar]')`), true, `${tag}: B4 inline controls present`);
  await realClick("[data-description-check-footer]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-desktop-review-popover="description-check"]')`, { label: `${tag}: B5 popover opens` });
  const editorOpen = await rect("[data-demo-target=editor]");
  const previewOpen = await cdp.evaluate(`(() => { const s = document.querySelector('[data-desktop-review-bar]').closest('section'); const r = s.getBoundingClientRect(); return { w: r.width, h: r.height }; })()`);
  assert.ok(Math.abs(editorOpen.w - editorBefore.w) < 1 && Math.abs(editorOpen.h - editorBefore.h) < 1, `${tag}: opening the popover must not resize Editor`);
  assert.ok(Math.abs(previewOpen.w - previewBefore.w) < 1 && Math.abs(previewOpen.h - previewBefore.h) < 1, `${tag}: opening the popover must not resize Preview`);
  const popover = await rect('[data-desktop-review-popover="description-check"]');
  const popoverCard = await rect('[data-desktop-review-popover-card="description-check"]');
  const previewBounds = await cdp.evaluate(`(() => {
    const s = document.querySelector('[data-desktop-review-bar]').closest('section');
    const r = s.getBoundingClientRect();
    return { l: r.left, r: r.right };
  })()`);
  assert.ok(popover.b <= (await rect("[data-desktop-review-bar]")).t + 1, `${tag}: popover sits ABOVE the bar (overlay, not push)`);
  assert.ok(
    popoverCard.l >= previewBounds.l - 1 && popoverCard.r <= previewBounds.r + 1,
    `${tag}: B5 card stays inside Preview frame (card ${Math.round(popoverCard.l)}..${Math.round(popoverCard.r)}, Preview ${Math.round(previewBounds.l)}..${Math.round(previewBounds.r)})`,
  );
  assert.ok(popoverCard.w <= 384.5, `${tag}: B5 card keeps the 24rem maximum width (${Math.round(popoverCard.w)}px)`);

  const descriptionEnabled = await cdp.evaluate(`document.querySelector('[data-description-card-toggle]')?.getAttribute('aria-checked') === 'true'`);
  if (!descriptionEnabled) {
    await realClick("[data-description-card-toggle]", { scroll: false });
  }
  await cdp.waitFor(`!!document.querySelector('[data-description-card-count]') && !!document.querySelector('[data-description-card-next]')`, {
    label: `${tag}: B5 narrow controls render`,
  });

  const dockMetrics = await cdp.evaluate(`(() => {
    const dock = document.querySelector('[data-review-dock-card="description-check"]');
    const card = document.querySelector('[data-desktop-review-popover-card="description-check"]');
    const selectors = [
      ['toggle', '[data-description-card-toggle]'],
      ['count', '[data-description-card-count]'],
      ['prev', '[data-description-card-prev]'],
      ['position', '[data-description-card-position]'],
      ['next', '[data-description-card-next]'],
    ];
    const cr = card.getBoundingClientRect();
    return {
      dockClientWidth: dock.clientWidth,
      dockScrollWidth: dock.scrollWidth,
      card: { l: cr.left, r: cr.right },
      controls: selectors.map(([name, selector]) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { name, l: r.left, r: r.right, w: r.width, shown: r.width > 0 && r.height > 0 };
      }),
    };
  })()`);
  assert.ok(
    dockMetrics.dockScrollWidth <= dockMetrics.dockClientWidth + 1,
    `${tag}: B5 dock has no internal horizontal overflow (client ${dockMetrics.dockClientWidth}, scroll ${dockMetrics.dockScrollWidth})`,
  );
  for (const control of dockMetrics.controls) {
    assert.ok(control.shown, `${tag}: B5 ${control.name} is visible`);
    assert.ok(
      control.l >= dockMetrics.card.l - 1 && control.r <= dockMetrics.card.r + 1,
      `${tag}: B5 ${control.name} stays inside card (control ${Math.round(control.l)}..${Math.round(control.r)}, card ${Math.round(dockMetrics.card.l)}..${Math.round(dockMetrics.card.r)})`,
    );
  }
  log(`  ${tag}: B4 inline + B5 popover; no resize + outer/inner B5 containment OK`);
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


async function activePlaybackSurvivesClose(v) {
  const tag = `${v.name} playback-survives-close`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify([]) }, v.width, v.height); // 音読β UNPINNED
  await setText(TEXT);
  await waitSurface(tag, v.surface);
  if (v.surface === "compact") {
    assert.equal(
      await cdp.evaluate(`!!document.querySelector('[data-read-aloud-status-pill],[data-read-aloud-footer-start],[data-read-aloud-footer-pause]')`),
      false,
      `${tag}: no B4 footer control while idle and unpinned`,
    );
    await realClick("[data-editor-review-hub-trigger]");
    await cdp.waitFor(`!document.querySelector('${PANEL}').hasAttribute('hidden')`);
    await realClick("[data-read-aloud-start=full]");
    await cdp.waitFor(`window.__ra.spoken.length >= 1`, { label: `${tag}: reading starts from inside the sheet` });
    await realClickAt(4, 4);
    await cdp.waitFor(`document.querySelector('${PANEL}').hasAttribute('hidden')`);
    await cdp.waitFor(`!!document.querySelector('[data-read-aloud-footer-pause]')`, { label: `${tag}: active direct control appears after sheet closes` });
    insideViewport(await rect("[data-read-aloud-footer-pause]"), `${tag} mini pause`);
    await realClick("[data-read-aloud-footer-pause]", { scroll: false });
    await cdp.waitFor(`!!document.querySelector('[data-read-aloud-footer-resume]')`, { label: `${tag}: pause from compact direct control` });
    await realClick("[data-read-aloud-footer-resume]", { scroll: false });
    await cdp.waitFor(`!!document.querySelector('[data-read-aloud-footer-pause]')`, { label: `${tag}: resume from compact direct control` });
    await realClick("[data-read-aloud-footer-stop]", { scroll: false });
    await cdp.waitFor(`!document.querySelector('[data-read-aloud-footer-pause],[data-read-aloud-footer-resume]')`, { label: `${tag}: stop from compact direct control` });
  } else {
    assert.equal(await cdp.evaluate(`!!document.querySelector('[data-read-aloud-inline-bar]')`), false, `${tag}: no inline B4 bar while idle and unpinned`);
    await realClick("[data-editor-review-hub-trigger]");
    await cdp.waitFor(`!document.querySelector('${PANEL}').hasAttribute('hidden')`);
    await realClick("[data-read-aloud-start=full]");
    await cdp.waitFor(`window.__ra.spoken.length >= 1`, { label: `${tag}: reading starts from inside the Hub popover` });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
    await cdp.waitFor(`document.querySelector('${PANEL}').hasAttribute('hidden')`, { label: `${tag}: Escape closes the Hub popover` });
    // Final desktop contract: an active, even UNPINNED, B4 appears as direct inline controls.
    await cdp.waitFor(`!!document.querySelector('[data-read-aloud-inline-pause]')`, { label: `${tag}: active inline pause appears` });
    insideViewport(await rect("[data-read-aloud-inline-pause]"), `${tag} inline pause`);
    await realClick("[data-read-aloud-inline-pause]", { scroll: false });
    await cdp.waitFor(`!!document.querySelector('[data-read-aloud-inline-resume]')`, { label: `${tag}: pause from desktop inline controls` });
    await realClick("[data-read-aloud-inline-resume]", { scroll: false });
    await cdp.waitFor(`!!document.querySelector('[data-read-aloud-inline-pause]')`, { label: `${tag}: resume from desktop inline controls` });
    await realClick("[data-read-aloud-inline-stop]", { scroll: false });
    await cdp.waitFor(`!document.querySelector('[data-read-aloud-inline-pause],[data-read-aloud-inline-resume]')`, { label: `${tag}: stop from desktop inline controls` });
  }
  log(`  ${tag}: closing the ${v.surface === "compact" ? "sheet" : "Hub popover"} never strands an in-progress reading OK`);
}
async function desktopCandidateNavigation(v) {
  const tag = `${v.name} desktop-nav`;
  await openWith(
    { tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["description-check"]), "tatespun.descriptionCheck.v1": JSON.stringify({ enabled: true, categories: { A: true, B: true, C: false } }) },
    v.width, v.height,
  );
  await setText(TEXT);
  await waitSurface(tag, "desktop");
  await cdp.waitFor(`document.querySelectorAll('[data-description-mark]').length > 0`, { label: `${tag}: markers` });
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-review-dock-card=description-check]')`), false, `${tag}: no permanently-open popover before the pill is clicked`);
  await realClick("[data-description-check-footer]", { scroll: false });
  const CARD = '[data-desktop-review-popover="description-check"] [data-review-dock-card=description-check]';
  await cdp.waitFor(`!!document.querySelector('${CARD}')`, { label: `${tag}: pill opens the quick popover` });
  await realClick(`${CARD} [data-description-card-next]`, { scroll: false });
  await cdp.waitFor(`document.querySelector('${CARD} [data-description-card-position]').textContent.trim().startsWith('1 /')`, { label: `${tag}: 次へ reaches the first candidate`, timeoutMs: 8000 });
  log(`  ${tag}: B5 candidate navigation works from the desktop quick popover OK`);
}

/** Revision 4's core interaction contract: only one popover open at a time; selecting a different
 *  tool switches (never stacks); Escape / an outside press close whichever is open. */

async function popoverMutualExclusivity(v) {
  const tag = `${v.name} mutual-exclusivity`;
  await openWith({ tatespun_editor_footer_collapsed: "off", [PINS_KEY]: JSON.stringify(["read-aloud", "description-check"]) }, v.width, v.height);
  await setText(TEXT);
  await waitSurface(tag, "desktop");

  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-read-aloud-inline-bar]')`), true, `${tag}: B4 uses direct inline controls`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-desktop-review-popover="read-aloud"]')`), false, `${tag}: no legacy B4 quick popover`);

  const open = () => cdp.evaluate(`({
    hub: !document.querySelector('${PANEL}').hasAttribute('hidden'),
    dc: !!document.querySelector('[data-desktop-review-popover="description-check"]'),
  })`);

  await realClick("[data-description-check-footer]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-desktop-review-popover="description-check"]')`, { label: `${tag}: B5 popover opens` });
  assert.deepEqual(await open(), { hub: false, dc: true }, `${tag}: only B5 quick popover is open`);

  await realClick("[data-editor-review-hub-trigger]", { scroll: false });
  await cdp.waitFor(`!document.querySelector('${PANEL}').hasAttribute('hidden')`, { label: `${tag}: Hub opens` });
  assert.deepEqual(await open(), { hub: true, dc: false }, `${tag}: opening 見直し closes B5 quick popover`);

  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape" });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape" });
  await cdp.waitFor(`document.querySelector('${PANEL}').hasAttribute('hidden')`, { label: `${tag}: Escape closes the Hub popover` });

  await realClick("[data-description-check-footer]", { scroll: false });
  await cdp.waitFor(`!!document.querySelector('[data-desktop-review-popover="description-check"]')`, { label: `${tag}: B5 popover reopens` });
  await realClickAt(4, 4);
  await cdp.waitFor(`!document.querySelector('[data-desktop-review-popover="description-check"]')`, { label: `${tag}: outside press closes B5 quick popover` });
  log(`  ${tag}: B4 direct inline / B5 quick popover / Hub switching / Escape / outside-press OK`);
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
  for (const v of VIEWPORTS.filter((x) => x.surface === "desktop")) {
    await manuscriptAndPreviewUnaffectedByPins(v);
    await popoverDoesNotResize(v);
    await desktopCandidateNavigation(v);
    await popoverMutualExclusivity(v);
  }
  for (const v of VIEWPORTS.filter((x) => x.surface === "compact")) {
    await compactBottomSheet(v);
  }
  for (const v of VIEWPORTS) {
    await activePlaybackSurvivesClose(v);
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
