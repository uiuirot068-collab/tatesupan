// Explicit-run real-browser E2E for TSP-B1 -- Review Hub / 見直し.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:review-hub
//
// It never starts a server and never defaults to any deployment: it needs
// TATESPUN_E2E_BASE_URL (loopback only unless TATESPUN_E2E_ALLOW_PRODUCTION=1).
// Only the normal local /editor is driven in a disposable profile (no cloud save, no login,
// no file written), in a throw-away Chrome profile.
//
// What it proves (decided from the real DOM, computed style and real input):
//  * the top toolbar is still exactly 設定・オプション・メモ・ヘルプ; the only
//    `▶ 見直し` control lives in the footer and is a real button;
//  * aria-expanded / aria-controls / heading contract; the panel opens UPWARD
//    from the footer, stays fully inside the viewport, never resizes the
//    textarea and never covers the title/action row (320/375/390/430/768/1280);
//  * opening never steals focus; Escape (focus in the panel) and an outside
//    press close it; typing after the outside press goes into the manuscript;
//  * 文字数カウント shows the same number as the footer pill, live;
//  * 文章チェックβ: the Hub toggle drives the very same checkbox/storage key,
//    「確認候補を見る」 opens the existing result list, 「設定」 opens the existing
//    settings dialog -- also from the mobile one-line (collapsed) footer;
//  * the mobile one-line footer does not overflow at 320-430px with the trigger;
//  * 集中モード hides the Hub with the footer and it does not pop back open;
//  * opening/closing writes nothing to localStorage (no B2 preference).
import assert from "node:assert/strict";
import { sleep } from "./helpers/cdp.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";

const NAME = "review hub E2E";
const target = resolveE2eTarget(process.env, NAME);

const PHONES = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
];
// Split-screen desktop widths where the Editor column is only ~335-400px wide. B1 FIX: at these widths the
// footer's 作業カウンター + 現在の原稿文字数 row has no spare width, so the trigger must not join it.
const NARROW_DESKTOPS = [
  { name: "770x720", width: 770, height: 720 },
  { name: "900x720", width: 900, height: 720 },
];
const DESKTOPS = [
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x720", width: 1280, height: 720 },
];
const STEP_TIMEOUT_MS = 30_000;
const COLLAPSED_KEY = "tatespun_editor_footer_collapsed";
const WRITING_CHECK_KEY = "tatespun_writing_check";
// An unclosed 「 is a high-confidence 文章チェックβ candidate.
const ISSUE_TEXT = "「閉じ忘れの台詞です。\n\n二段落目です。";

const session = await launchEditorSession("tatespun-review-hub-");
const { cdp } = session;
const log = (line) => console.log(line);

const pageErrors = [];
cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception"));
const dialogs = [];
cdp.on("Page.javascriptDialogOpening", (p) => {
  dialogs.push(`${p.type}: ${p.message}`);
  cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
});

// --- browser-side helpers ------------------------------------------------------
const RECT = (selector) => `(() => {
  const e = document.querySelector(${JSON.stringify(selector)});
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height,
    shown: e.getClientRects().length > 0, vw: innerWidth, vh: innerHeight };
})()`;
const rect = (selector) => cdp.evaluate(RECT(selector));
const insideViewport = (r) => r && r.shown && r.l >= -0.5 && r.t >= -0.5 && r.r <= r.vw + 0.5 && r.b <= r.vh + 0.5;

const TRIGGERS = `[...document.querySelectorAll('[data-editor-review-hub-trigger]')].filter((e) => e.getClientRects().length > 0)`;
const PANEL = "[data-review-hub-panel]";
const panelShown = () => cdp.evaluate(`getComputedStyle(document.querySelector('${PANEL}')).display !== 'none'`);
const triggerState = () =>
  cdp.evaluate(`(() => { const t = ${TRIGGERS}; return { count: t.length, text: t[0]?.textContent.replace(/\\s+/g, ' ').trim() ?? null,
    expanded: t[0]?.getAttribute('aria-expanded') ?? null, controls: t[0]?.getAttribute('aria-controls') ?? null,
    tag: t[0]?.tagName ?? null, type: t[0]?.getAttribute('type') ?? null }; })()`);
const activeInfo = () =>
  cdp.evaluate(`(() => { const a = document.activeElement; return { isTrigger: !!a?.hasAttribute('data-editor-review-hub-trigger'),
    inPanel: !!document.querySelector('${PANEL}')?.contains(a), isEditor: a?.getAttribute('data-demo-target') === 'editor', tag: a?.tagName }; })()`);
const storageKeys = () => cdp.evaluate(`Object.keys(localStorage).sort()`);
const digits = (s) => Number(String(s).replace(/[^0-9]/g, ""));

// The normal /editor (a fresh local document in the throw-away profile), NOT ?demo=1: the Demo route
// shows its own fixed STEP card (z-60) that can sit over the footer on a phone, which is the tour's
// existing overlay and not part of the Review Hub.
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
  await cdp.evaluate(`(() => { ${Object.entries(prefs).map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)})`).join(";")}; return true; })()`);
  await navigate();
}
async function realClickAt(x, y) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
}
async function realClick(selector) {
  const c = await cdp.evaluate(`(() => {
    const cands = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getClientRects().length > 0 && !e.disabled);
    const e = cands[0];
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    const p = document.querySelector('[data-review-hub-panel]');
    const pr = p?.getBoundingClientRect();
    return { x, y, hit: e === top || e.contains(top), top: top?.outerHTML.slice(0, 110) ?? null,
      panel: pr && p.getClientRects().length ? { t: Math.round(pr.top), b: Math.round(pr.bottom), sh: p.scrollHeight, ch: p.clientHeight } : null };
  })()`);
  assert.ok(c, `${selector}: no visible, enabled element`);
  assert.ok(c.hit, `${selector}: another element covers its centre -- a user could not tap it (at ${Math.round(c.x)},${Math.round(c.y)} found ${c.top}; panel ${JSON.stringify(c.panel)})`);
  await realClickAt(c.x, c.y);
}
const press = async (key, code, vk) => {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key, code, windowsVirtualKeyCode: vk });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key, code, windowsVirtualKeyCode: vk });
};
async function setText(text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  })()`);
}
const openHub = async (label) => {
  await realClick("[data-editor-review-hub-trigger]");
  await cdp.waitFor(`document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]') !== null`, { label: `${label}: opens` });
  assert.equal(await panelShown(), true, `${label}: panel must be displayed when aria-expanded=true`);
};
const closeHub = async (label) => {
  await cdp.waitFor(`document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]') === null`, { label: `${label}: closes` });
  assert.equal(await panelShown(), false, `${label}: panel must be hidden again`);
};
const SETTINGS_OPEN = `[...document.querySelectorAll('h2')].some((h) => h.textContent.trim() === '文章チェック設定')`;
const closeSettingsDialog = () =>
  cdp.evaluate(`(() => { const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.trim() === '文章チェック設定'); h?.closest('.fixed')?.click(); return true; })()`);
const RESULT_LIST_OPEN = `(() => { const ul = document.querySelector('[data-writing-check-surface] ul'); return !!ul && ul.getClientRects().length > 0 && ul.children.length > 0; })()`;

/**
 * Panel geometry contract, checked for the open panel:
 *  - fully inside the viewport and inside the Editor pane (never over the global header);
 *  - sits ABOVE the footer stack (grows upward from it);
 *  - shows all of its content without internal scrolling (no control pushed out of reach);
 *  - covers the title/undo-redo/設定 rows ONLY when its content is taller than the manuscript
 *    area (a very short screen with the expanded footer) -- never on an ordinary screen.
 */
async function assertPanelGeometry(tag, areaHeight) {
  const p = await rect(PANEL);
  const g = await cdp.evaluate(`(() => { const f = document.querySelector('[data-editor-footer]'); const el = document.querySelector('${PANEL}'); const pr = f.parentElement.getBoundingClientRect();
    return { footerTop: f.getBoundingClientRect().top, paneTop: pr.top, paneLeft: pr.left, paneRight: pr.right, natural: el.scrollHeight, client: el.clientHeight,
      actionRowBottom: document.querySelector('[data-editor-action-row]').getBoundingClientRect().bottom }; })()`);
  assert.ok(insideViewport(p), `${tag}: panel fully inside the viewport ${JSON.stringify(p)}`);
  // The pane clips its children (overflow-hidden): a panel wider than the pane would have its edge -- and controls -- cut off.
  assert.ok(p.l >= g.paneLeft - 0.5 && p.r <= g.paneRight + 0.5, `${tag}: panel must fit the Editor pane horizontally, not be clipped (panel ${Math.round(p.l)}-${Math.round(p.r)}, pane ${Math.round(g.paneLeft)}-${Math.round(g.paneRight)})`);
  assert.ok(p.b <= g.footerTop + 0.5, `${tag}: panel must sit ABOVE the footer stack (panel bottom ${p.b} <= footer top ${g.footerTop})`);
  assert.ok(p.t >= g.paneTop - 0.5, `${tag}: panel must stay inside the Editor pane, never over the global header (panel top ${p.t}, pane top ${g.paneTop})`);
  assert.ok(g.natural - g.client <= 1, `${tag}: every control in the panel must be reachable without scrolling (content ${g.natural}px, visible ${g.client}px)`);
  if (g.natural + 8 <= areaHeight) {
    assert.ok(p.t >= g.actionRowBottom - 0.5, `${tag}: on this screen the panel fits over the manuscript, so it must not cover the title/undo/redo rows (panel top ${p.t}, row bottom ${g.actionRowBottom})`);
  } else {
    log(`  ${tag}: short screen -- manuscript area ${Math.round(areaHeight)}px < panel ${g.natural}px, so the panel rises over the rows above only as far as needed (top ${Math.round(p.t)}px, pane top ${Math.round(g.paneTop)}px)`);
  }
  return p;
}

// --- one viewport, expanded footer ---------------------------------------------
async function expandedFooterPhase(v) {
  await openWith({ [COLLAPSED_KEY]: "off" }, v.width, v.height);
  const tag = v.name;

  // top toolbar unchanged, Hub only in the footer
  const nav = await cdp.evaluate(`({
    secondary: [...document.querySelectorAll('[data-editor-secondary]')].map((b) => b.dataset.editorSecondary),
    navMentions: /見直し/.test(document.querySelector('[data-editor-secondary-row]')?.textContent ?? ''),
    triggersOutsideFooter: [...document.querySelectorAll('[data-editor-review-hub-trigger]')].filter((e) => !e.closest('[data-editor-footer]')).length,
  })`);
  assert.deepEqual(nav.secondary, ["settings", "options", "memo", "help"], `${tag}: top toolbar must stay 設定・オプション・メモ・ヘルプ`);
  assert.equal(nav.navMentions, false, `${tag}: no Review Hub item in the top toolbar`);
  assert.equal(nav.triggersOutsideFooter, 0, `${tag}: the trigger must live only in the footer`);

  // trigger contract
  const t = await triggerState();
  assert.equal(t.count, 1, `${tag}: exactly one visible ▶ 見直し trigger`);
  assert.equal(t.text, "▶ 見直し", `${tag}: trigger label`);
  assert.equal(t.tag, "BUTTON", `${tag}: trigger must be a real button`);
  assert.equal(t.type, "button");
  assert.equal(t.expanded, "false", `${tag}: closed by default`);
  assert.equal(await cdp.evaluate(`document.getElementById(${JSON.stringify(t.controls)}) === document.querySelector('${PANEL}')`), true, `${tag}: aria-controls must resolve to the panel`);
  assert.equal(await panelShown(), false, `${tag}: panel hidden while closed`);
  const trig = await cdp.evaluate(`(() => { const e = ${TRIGGERS}[0]; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, shown: true, vw: innerWidth, vh: innerHeight }; })()`);
  assert.ok(insideViewport(trig), `${tag}: trigger fully on-screen ${JSON.stringify(trig)}`);
  const overflowX = await cdp.evaluate(`({ doc: document.documentElement.scrollWidth - innerWidth, footer: (() => { const f = document.querySelector('[data-editor-footer]'); return f.scrollWidth - f.clientWidth; })() })`);
  assert.ok(overflowX.doc <= 1 && overflowX.footer <= 1, `${tag}: no horizontal overflow with the trigger ${JSON.stringify(overflowX)}`);

  // B1 FIX (770px density): on desktop the footer controls row must stay ONE line -- the trigger sits on the
  // syntax-hint row above it -- so opening the Hub's footer never costs the manuscript a line of height.
  if (v.width >= 768) {
    const rows = await cdp.evaluate(`(() => { const c = document.querySelector('[data-editor-footer-controls]'); const t = ${TRIGGERS}[0];
      const cr = c.getBoundingClientRect(), tr = t.getBoundingClientRect(); return { controlsH: cr.height, controlsTop: cr.top, triggerBottom: tr.bottom, triggerH: tr.height,
        hintH: document.querySelector('[data-editor-footer-help]').getBoundingClientRect().height }; })()`);
    assert.ok(rows.controlsH <= 26, `${tag}: the footer controls row must stay on one line (height ${rows.controlsH}px; a wrapped row is ~45px)`);
    assert.ok(rows.triggerBottom <= rows.controlsTop + 0.5, `${tag}: the desktop trigger sits on the syntax-hint row, above the controls row`);
    assert.ok(rows.triggerH <= rows.hintH + 0.5, `${tag}: the trigger must not make the hint row taller (trigger ${rows.triggerH}px, hint ${rows.hintH}px)`);
  }

  const storageBefore = await storageKeys();
  const editorBefore = await rect('[data-demo-target="editor"]');

  // open
  await openHub(tag);
  assert.equal((await activeInfo()).inPanel, false, `${tag}: opening must not move focus into the panel`);
  const p = await assertPanelGeometry(tag, editorBefore.h);
  if (v.width >= 768) assert.ok(p.w <= 353, `${tag}: desktop panel is compact (${p.w}px)`);
  const editorOpen = await rect('[data-demo-target="editor"]');
  assert.ok(Math.abs(editorOpen.h - editorBefore.h) < 0.5 && Math.abs(editorOpen.t - editorBefore.t) < 0.5, `${tag}: panel must not resize/shift the manuscript textarea`);
  const content = await cdp.evaluate(`({
    heading: document.getElementById('editor-review-hub-heading')?.textContent.trim(),
    labelled: document.querySelector('${PANEL}').getAttribute('aria-labelledby'),
    tools: [...document.querySelectorAll('${PANEL} [data-review-hub-tool]')].map((e) => e.dataset.reviewHubTool),
    text: document.querySelector('${PANEL}').textContent,
  })`);
  assert.equal(content.heading, "見直し");
  assert.equal(content.labelled, "editor-review-hub-heading");
  assert.deepEqual(content.tools, ["writing-check", "character-count"], `${tag}: only the two implemented tools`);
  assert.doesNotMatch(content.text, /描写|修飾|音読|リズム|傍点|ピン/, `${tag}: no unreleased tool copy`);
  // B2 (roadmap B2 contract): the Hub carries one フッターに表示 control per tool, inline on the tool's title row, so the panel stays compact.
  const pinToggles = await cdp.evaluate(`[...document.querySelectorAll('${PANEL} [data-review-hub-tool] [data-review-hub-footer-pin-toggle]')].map((e) => e.closest('[data-review-hub-tool]').dataset.reviewHubTool)`);
  assert.deepEqual(pinToggles, ["writing-check", "character-count"], `${tag}: one フッターに表示 toggle per implemented tool`);

  // 文字数カウント == footer pill, live
  const pill = () => cdp.evaluate(`document.querySelector('[title="現在の原稿文字数"]')?.textContent ?? ''`);
  const hubCount = () => cdp.evaluate(`document.querySelector('[data-review-hub-character-count] strong')?.textContent ?? ''`);
  assert.equal(digits(await hubCount()), digits(await pill()), `${tag}: Hub count == footer count`);
  await setText("あ".repeat(1234) + "\n\n" + "い".repeat(56));
  // (both counters are debounced: wait for the NEW value, not for two equal stale ones)
  await cdp.waitFor(`(() => { const h = (document.querySelector('[data-review-hub-character-count] strong')?.textContent ?? '').replace(/[^0-9]/g, ''); return Number(h) >= 1290 && h === (document.querySelector('[title="現在の原稿文字数"]')?.textContent ?? '').replace(/[^0-9]/g, ''); })()`, { label: `${tag}: count follows typing` });
  assert.ok(digits(await hubCount()) >= 1290, `${tag}: count reflects the typed text (${await hubCount()})`);
  assert.match(await hubCount(), /,/, `${tag}: grouped digits`);

  // 文章チェックβ: same checkbox, same storage key
  const wcState = () => cdp.evaluate(`({ bar: document.querySelector('[data-writing-check-surface] input[type=checkbox]').checked,
    hub: document.querySelector('[data-review-hub-writing-check-toggle]').checked, stored: localStorage.getItem('${WRITING_CHECK_KEY}') })`);
  const before = await wcState();
  assert.equal(before.bar, before.hub, `${tag}: Hub toggle mirrors the footer checkbox`);
  await realClick("[data-review-hub-writing-check-toggle]");
  await cdp.waitFor(`document.querySelector('[data-writing-check-surface] input[type=checkbox]').checked === ${!before.bar}`, { label: `${tag}: Hub toggle drives the footer checkbox` });
  assert.equal((await wcState()).stored, before.bar ? "off" : "on", `${tag}: same localStorage key as the footer checkbox`);
  await realClick("[data-review-hub-writing-check-toggle]");
  await cdp.waitFor(`document.querySelector('[data-writing-check-surface] input[type=checkbox]').checked === ${before.bar}`, { label: `${tag}: toggled back` });
  assert.equal(await panelShown(), true, `${tag}: Hub stays open while its own toggle is used`);

  // candidates -> 確認候補を見る opens the EXISTING result list; 設定 opens the EXISTING dialog
  await setText(ISSUE_TEXT);
  await cdp.waitFor(`/件/.test(document.querySelector('[data-review-hub-writing-check-status]')?.textContent ?? '')`, { label: `${tag}: Hub shows candidate counts` });
  const status = await cdp.evaluate(`document.querySelector('[data-review-hub-writing-check-status]').textContent.trim()`);
  const barText = await cdp.evaluate(`document.querySelector('[data-writing-check-surface]').textContent.replace(/\\s+/g, '')`);
  for (const part of status.split("／").map((s) => s.trim().replace(/\s+/g, ""))) assert.ok(barText.includes(part), `${tag}: Hub wording "${part}" matches the footer bar`);
  await realClick("[data-review-hub-writing-check-results]");
  await closeHub(`${tag} (results)`);
  await cdp.waitFor(RESULT_LIST_OPEN, { label: `${tag}: existing result list opened` });
  await realClickAt(5, 5); // outside press closes the bar's own popover
  await openHub(`${tag} (settings)`);
  await realClick("[data-review-hub-writing-check-settings]");
  await closeHub(`${tag} (settings)`);
  await cdp.waitFor(SETTINGS_OPEN, { label: `${tag}: existing settings dialog opened` });
  await closeSettingsDialog();
  await cdp.waitFor(`!(${SETTINGS_OPEN})`, { label: `${tag}: settings closed` });

  // keyboard + outside press + focus
  await openHub(`${tag} (keys)`);
  await cdp.evaluate(`document.querySelector('[data-review-hub-writing-check-toggle]').focus()`);
  assert.equal((await activeInfo()).inPanel, true);
  await press("Escape", "Escape", 27);
  await closeHub(`${tag} (Escape in panel)`);
  assert.equal((await activeInfo()).isTrigger, true, `${tag}: Escape returns focus to the trigger`);
  await openHub(`${tag} (Escape on trigger)`);
  await press("Escape", "Escape", 27);
  await closeHub(`${tag} (Escape on trigger)`);
  assert.equal((await activeInfo()).isTrigger, true, `${tag}: focus stays on the trigger`);

  await openHub(`${tag} (outside)`);
  // Press somewhere the panel does not cover. On an ordinary screen that is the manuscript itself; on a very
  // short screen the raised panel covers the whole manuscript area, so the title field is the reachable target.
  const pick = await cdp.evaluate(`(() => {
    const ta = document.querySelector('[data-demo-target="editor"]');
    const r = ta.getBoundingClientRect();
    for (const [x, y] of [[r.left + 12, r.top + 12], [r.left + 12, r.top + r.height / 2], [r.right - 12, r.top + 12]]) {
      if (document.elementFromPoint(x, y) === ta) return { kind: 'editor', x, y };
    }
    const title = document.querySelector('[data-demo-target="title"]');
    const tr = title.getBoundingClientRect();
    return { kind: 'title', x: tr.left + 12, y: tr.top + tr.height / 2 };
  })()`);
  const fieldValueLength = (kind) => cdp.evaluate(`document.querySelector('[data-demo-target="${kind}"]').value.length`);
  const beforeLen = await fieldValueLength(pick.kind);
  await realClickAt(pick.x, pick.y);
  await closeHub(`${tag} (outside press on ${pick.kind})`);
  const focusedKind = await cdp.evaluate(`document.activeElement?.getAttribute('data-demo-target')`);
  assert.equal(focusedKind, pick.kind, `${tag}: an outside press must leave focus in the field that was pressed (${pick.kind})`);
  await cdp.send("Input.insertText", { text: "字" });
  assert.equal(await fieldValueLength(pick.kind), beforeLen + 1, `${tag}: typing right after closing goes into the ${pick.kind}, not into the Hub`);
  if (pick.kind === "title") log(`  ${tag}: manuscript fully covered by the raised panel on this short screen -- outside press verified on the title field`);

  // open/close writes nothing to storage (no B2 preference). The snapshot is taken right before the
  // open/close: the Hub toggle above legitimately writes the EXISTING 文章チェックβ key, same as the footer checkbox.
  const storageBeforeOpenClose = await storageKeys();
  await openHub(`${tag} (storage)`);
  await realClick("[data-review-hub-close]");
  await closeHub(`${tag} (✕)`);
  assert.deepEqual(await storageKeys(), storageBeforeOpenClose, `${tag}: opening/closing must not create any localStorage key`);
  const newKeys = (await storageKeys()).filter((k) => !storageBefore.includes(k));
  assert.deepEqual(newKeys.filter((k) => !/^tatespun_writing_check$|^tatespun:work-sessions:v1:/.test(k)), [], `${tag}: no unexpected new localStorage key in this whole scenario (${newKeys.join(", ")})`);
  await cdp.evaluate(`localStorage.setItem('${WRITING_CHECK_KEY}', '${before.stored ?? "on"}'); true`);
  log(`  ${tag}: trigger/aria/upward/in-viewport/no-resize/focus/Escape/outside/count/文章チェックβ/storage OK`);
}

// --- mobile one-line (collapsed) footer ----------------------------------------
async function collapsedFooterPhase(v) {
  await openWith({ [COLLAPSED_KEY]: "on" }, v.width, v.height);
  const tag = `${v.name} collapsed`;
  const row = await rect("[data-editor-footer-collapsed]");
  assert.ok(row && row.shown, `${tag}: one-line footer must be displayed`);
  const t = await triggerState();
  assert.equal(t.count, 1, `${tag}: exactly one visible trigger`);
  assert.equal(t.text, "▶ 見直し");
  const m = await cdp.evaluate(`(() => {
    const row = document.querySelector('[data-editor-footer-collapsed]');
    const rr = row.getBoundingClientRect();
    const box = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width }; };
    const trig = box(${TRIGGERS}[0]);
    const arrow = box(row.querySelector('[data-editor-footer-collapse-toggle="expand"]'));
    const count = [...row.querySelectorAll('span')].find((s) => /^現在/.test(s.textContent.trim()));
    return { rowL: rr.left, rowR: rr.right, rowOverflow: row.scrollWidth - row.clientWidth, trig, arrow,
      countW: count.getBoundingClientRect().width, countClipped: count.scrollWidth > count.clientWidth + 1, countText: count.textContent.trim(),
      docOverflow: document.documentElement.scrollWidth - innerWidth };
  })()`);
  assert.ok(m.rowOverflow <= 1 && m.docOverflow <= 1, `${tag}: one-line footer must not overflow ${JSON.stringify(m)}`);
  assert.ok(m.trig.l >= m.rowL - 0.5 && m.trig.r <= m.rowR + 0.5, `${tag}: trigger inside the row`);
  assert.ok(m.arrow.l >= m.rowL - 0.5 && m.arrow.r <= m.rowR + 0.5 && m.arrow.w >= 12, `${tag}: ▲ expand control still fully visible`);
  log(`  ${tag}: row ${Math.round(m.rowR - m.rowL)}px, trigger ${Math.round(m.trig.w)}px, count "${m.countText}" ${Math.round(m.countW)}px${m.countClipped ? " (truncated by the existing truncate)" : ""}`);

  // A realistic manuscript length: the trigger must not squeeze the EXISTING count in this row (it fit fully before B1).
  await setText("あ".repeat(12843));
  await cdp.waitFor(`/12,843/.test(document.querySelector('[data-editor-footer-collapsed]')?.textContent ?? '')`, { label: `${tag}: count shows 12,843` });
  const countFit = await cdp.evaluate(`(() => { const c = [...document.querySelector('[data-editor-footer-collapsed]').querySelectorAll('span')].find((s) => /^現在/.test(s.textContent.trim()));
    return { clippedBy: Math.max(0, Math.round(c.scrollWidth - c.clientWidth)), text: c.textContent.trim() }; })()`);
  if (v.width >= 360) assert.equal(countFit.clippedBy <= 1, true, `${tag}: the trigger must not truncate the existing count "${countFit.text}" (clipped by ${countFit.clippedBy}px)`);
  else log(`  ${tag}: at the 320px floor the existing count "${countFit.text}" is clipped by ${countFit.clippedBy}px by its own truncate (full value is in the Hub)`);
  const areaHeight = (await rect('[data-demo-target="editor"]')).h;
  await openHub(tag);
  await assertPanelGeometry(tag, areaHeight);
  assert.equal((await activeInfo()).inPanel, false, `${tag}: no focus steal`);

  // the one-line footer hides the result list + settings host: the Hub expands it first (its own ▲ action)
  await setText(ISSUE_TEXT);
  await cdp.waitFor(`/件/.test(document.querySelector('[data-review-hub-writing-check-status]')?.textContent ?? '')`, { label: `${tag}: candidates shown` });
  await realClick("[data-review-hub-writing-check-results]");
  await closeHub(`${tag} (results)`);
  await cdp.waitFor(`(() => { const r = document.querySelector('[data-editor-footer-collapsed]'); return !r || r.getClientRects().length === 0; })()`, { label: `${tag}: footer expanded` });
  await cdp.waitFor(RESULT_LIST_OPEN, { label: `${tag}: result list visible after expanding` });
  assert.equal(await cdp.evaluate(`localStorage.getItem('${COLLAPSED_KEY}')`), "off", `${tag}: same effect as the footer's own ▲ action`);

  await cdp.evaluate(`localStorage.setItem('${COLLAPSED_KEY}', 'on'); true`);
  await navigate();
  await openHub(`${tag} (settings)`);
  await realClick("[data-review-hub-writing-check-settings]");
  await cdp.waitFor(SETTINGS_OPEN, { label: `${tag}: settings dialog visible from the one-line footer` });
  const dlg = await cdp.evaluate(`(() => { const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.trim() === '文章チェック設定'); const r = h.closest('.fixed').getBoundingClientRect(); return r.width > 0 && r.height > 0; })()`);
  assert.equal(dlg, true, `${tag}: settings dialog is displayed`);
  await closeSettingsDialog();
  await cdp.evaluate(`localStorage.setItem('${COLLAPSED_KEY}', 'off'); true`);
}

// --- 集中モード ------------------------------------------------------------------
// md+: the header toggle enters, and (the header being hidden in 集中モード) the pane's own 通常に戻す exits.
// Phone: the sticky MobileEditorNav button does both.
async function focusModePhase(v, enterSelector, exitSelector = enterSelector) {
  await openWith({ [COLLAPSED_KEY]: "off" }, v.width, v.height);
  const tag = `${v.name} focus`;
  await openHub(tag);
  await realClick(enterSelector);
  await cdp.waitFor(`${TRIGGERS}.length === 0`, { label: `${tag}: trigger hidden with the footer in 集中モード` });
  await cdp.waitFor(`[...document.querySelectorAll(${JSON.stringify(exitSelector)})].some((e) => e.getClientRects().length > 0)`, { label: `${tag}: the exit control is shown` });
  await sleep(300);
  assert.equal(await panelShown(), false, `${tag}: panel hidden in 集中モード`);
  const anyFooter = await cdp.evaluate(`[...document.querySelectorAll('[data-editor-footer] > *')].some((e) => e.getClientRects().length > 0)`);
  assert.equal(anyFooter, false, `${tag}: no footer chrome at all in 集中モード (existing contract)`);
  await realClick(exitSelector);
  await cdp.waitFor(`${TRIGGERS}.length === 1`, { label: `${tag}: trigger returns with the footer` });
  assert.equal((await triggerState()).expanded, "false", `${tag}: the Hub must not pop back open after leaving 集中モード`);
  assert.equal(await panelShown(), false);
  log(`  ${tag}: Hub follows the footer's 集中モード rule and returns closed`);
}

// --- B2: フッターに表示 is real display state for 文章チェックβ, independent of its ON/OFF ---------------
// Human QA regression: with フッターに表示 OFF the old B1 footer checkbox used to stay, making the B2 setting meaningless.
const PINS_KEY = "tatespun.reviewHub.footerTools.v1";
const pinToggle = (id) => `[data-review-hub-tool="${id}"] [data-review-hub-footer-pin-toggle]`;
const footerSurface = () =>
  cdp.evaluate(`(() => { const s = document.querySelector('[data-writing-check-surface]'); const c = document.querySelector('[data-editor-footer-collapsed]');
    return { checkbox: !!s?.querySelector('input[type=checkbox]'), text: s?.textContent.replace(/\\s+/g, '') ?? '',
      top: s ? s.getBoundingClientRect().top : null, statusTop: document.querySelector('[data-editor-status-surfaces]')?.getBoundingClientRect().top ?? null,
      collapsedCheckbox: !!c?.querySelector('input[type=checkbox]'), collapsedShown: !!c && c.getClientRects().length > 0,
      countPill: !!document.querySelector('[title="現在の原稿文字数"]') }; })()`);
const wcStored = () => cdp.evaluate(`localStorage.getItem('${WRITING_CHECK_KEY}')`);
const pressedState = (id) => cdp.evaluate(`document.querySelector('${pinToggle(id)}')?.getAttribute('aria-pressed')`);

async function pinSemanticsPhase(v) {
  const tag = `${v.name} footer pins`;
  await openWith({ [COLLAPSED_KEY]: "off" }, v.width, v.height);

  // default = the footer exactly as before B2 (strip + count pill), both shown
  let f = await footerSurface();
  assert.equal(f.checkbox, true, `${tag}: default keeps the B1 文章チェックβ footer strip`);
  assert.equal(f.countPill, true, `${tag}: default keeps the count pill`);
  await openHub(tag);
  assert.equal(await pressedState("writing-check"), "true");
  assert.equal(await pressedState("character-count"), "true");

  // make sure 文章チェックβ is ON, then unpin it: the footer item goes away but ON stays ON
  if ((await wcStored()) !== "on") await realClick("[data-review-hub-writing-check-toggle]");
  await cdp.waitFor(`localStorage.getItem('${WRITING_CHECK_KEY}') === 'on'`, { label: `${tag}: 文章チェックβ ON` });
  await realClick(pinToggle("writing-check"));
  await cdp.waitFor(`!document.querySelector('[data-writing-check-surface] input[type=checkbox]')`, { label: `${tag}: unpinned -> footer strip gone` });
  f = await footerSurface();
  assert.doesNotMatch(f.text, /文章チェック|チェックβ|設定/, `${tag}: no 文章チェックβ control/text remains in the footer once unpinned (${f.text})`);
  assert.equal(await wcStored(), "on", `${tag}: unpinning must not switch 文章チェックβ off`);
  assert.equal(f.countPill, true, `${tag}: character-count behaviour unchanged`);
  assert.equal(await pressedState("writing-check"), "false");
  assert.equal(await panelShown(), true, `${tag}: Hub stays open`);

  // ...and it stays fully usable inside the Hub (ON/OFF + candidates + settings)
  const hubChecked = () => cdp.evaluate(`document.querySelector('[data-review-hub-writing-check-toggle]').checked`);
  assert.equal(await hubChecked(), true, `${tag}: Hub toggle reflects ON`);
  await realClick("[data-review-hub-writing-check-toggle]");
  await cdp.waitFor(`localStorage.getItem('${WRITING_CHECK_KEY}') === 'off'`, { label: `${tag}: Hub can switch it OFF while unpinned` });
  await realClick("[data-review-hub-writing-check-toggle]");
  await cdp.waitFor(`localStorage.getItem('${WRITING_CHECK_KEY}') === 'on'`, { label: `${tag}: Hub can switch it back ON` });
  assert.equal((await footerSurface()).checkbox, false, `${tag}: toggling ON/OFF never brings the unpinned strip back`);
  await setText(ISSUE_TEXT);
  await cdp.waitFor(`/件/.test(document.querySelector('[data-review-hub-writing-check-status]')?.textContent ?? '')`, { label: `${tag}: candidates counted while unpinned` });
  await realClick("[data-review-hub-writing-check-results]");
  await closeHub(`${tag} (results)`);
  await cdp.waitFor(RESULT_LIST_OPEN, { label: `${tag}: result list still opens from the Hub while unpinned` });
  await realClickAt(5, 5);

  // pinned again -> the strip returns, ON/OFF untouched
  await openHub(`${tag} (repin)`);
  await realClick(pinToggle("writing-check"));
  await cdp.waitFor(`!!document.querySelector('[data-writing-check-surface] input[type=checkbox]')`, { label: `${tag}: pinned -> footer strip back` });
  assert.equal(await wcStored(), "on", `${tag}: pinning must not change ON/OFF`);

  // two shown: pin order = top-to-bottom order. Re-pinning appends, so 文字数カウント is now first (its status row above the strip).
  f = await footerSurface();
  assert.equal(await cdp.evaluate(`localStorage.getItem('${PINS_KEY}')`), '["character-count","writing-check"]', `${tag}: re-pin appends`);
  assert.ok(f.top > f.statusTop, `${tag}: pin order character-count, writing-check -> status row above the strip`);
  await realClick(`[data-review-hub-tool="writing-check"] [data-review-hub-footer-pin-move]`);
  await cdp.waitFor(`document.querySelector('[data-writing-check-surface]').getBoundingClientRect().top < document.querySelector('[data-editor-status-surfaces]').getBoundingClientRect().top`, { label: `${tag}: reorder swaps` });
  assert.equal(await cdp.evaluate(`localStorage.getItem('${PINS_KEY}')`), '["writing-check","character-count"]', `${tag}: order persisted`);
  await navigate();
  f = await footerSurface();
  assert.ok(f.top < f.statusTop && f.checkbox, `${tag}: order + pin survive a reload (strip above the status row again)`);

  // 0 pins: neither footer item, Hub still lists both tools
  await openHub(`${tag} (zero)`);
  await realClick(pinToggle("writing-check"));
  await realClick(pinToggle("character-count"));
  await cdp.waitFor(`!document.querySelector('[data-writing-check-surface] input[type=checkbox]') && !document.querySelector('[title="現在の原稿文字数"]')`, { label: `${tag}: 0 pins` });
  assert.deepEqual(await cdp.evaluate(`[...document.querySelectorAll('${PANEL} [data-review-hub-tool]')].map((e) => e.dataset.reviewHubTool)`), ["writing-check", "character-count"], `${tag}: Hub still lists both tools`);
  assert.equal(await wcStored(), "on");

  // phone one-line footer: its チェックβ checkbox follows the pin too
  if (v.width < 768) {
    for (const [pins, expectCheckbox] of [['["character-count"]', false], ['["writing-check"]', true]]) {
      await openWith({ [COLLAPSED_KEY]: "on", [PINS_KEY]: pins }, v.width, v.height);
      f = await footerSurface();
      assert.equal(f.collapsedShown, true, `${tag}: one-line footer shown`);
      assert.equal(f.collapsedCheckbox, expectCheckbox, `${tag}: one-line footer チェックβ checkbox ${expectCheckbox ? "shown when pinned" : "absent when unpinned"} (pins ${pins})`);
      assert.equal((await triggerState()).count, 1, `${tag}: one-line footer keeps the ▶ 見直し trigger`);
    }
  }
  await cdp.evaluate(`localStorage.removeItem('${PINS_KEY}'); localStorage.setItem('${COLLAPSED_KEY}', 'off'); true`);
  log(`  ${tag}: default strip / unpin removes it / ON stays ON / Hub fully usable / repin / reorder / reload / 0 pins OK`);
}

// --- run ------------------------------------------------------------------------
try {
  log("phase 1: expanded footer, every viewport");
  for (const v of [...PHONES, ...NARROW_DESKTOPS, ...DESKTOPS]) await expandedFooterPhase(v);

  log("phase 2: mobile one-line footer");
  for (const v of PHONES) await collapsedFooterPhase(v);

  log("phase 3: 集中モード");
  await focusModePhase(DESKTOPS[1], "[data-focus-mode-toggle]:not([data-editor-action])", '[data-editor-action="exit-focus"]');
  await focusModePhase(PHONES[2], '[data-demo-target="focus-mode"]');

  log("phase 4: B2 footer pins (文章チェックβ display vs ON/OFF)");
  for (const v of [DESKTOPS[1], PHONES[2], PHONES[0]]) await pinSemanticsPhase(v);

  assert.deepEqual(dialogs, [], `unexpected native dialog(s): ${JSON.stringify(dialogs)}`);
  assert.deepEqual(pageErrors, [], `uncaught page error(s): ${JSON.stringify(pageErrors)}`);
  log(`${NAME}: PASS (${[...PHONES, ...NARROW_DESKTOPS, ...DESKTOPS].map((v) => v.name).join(", ")}; collapsed ${PHONES.map((v) => v.name).join(", ")}; focus mode 1280 + 390)`);
} catch (error) {
  process.exitCode = 1;
  console.error(`${NAME}: FAIL -- ${error instanceof Error ? error.message : error}`);
  try {
    console.error("state at failure:", JSON.stringify(await cdp.evaluate(`({ innerWidth, innerHeight, hubOpen: !!document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]'), triggers: ${TRIGGERS}.length, active: document.activeElement?.outerHTML.slice(0, 120) })`)));
    if (pageErrors.length) console.error("page errors:", JSON.stringify(pageErrors));
    if (dialogs.length) console.error("native dialogs:", JSON.stringify(dialogs));
  } catch {}
} finally {
  await session.close();
}
