// Explicit-run real-browser E2E for UX v3 Loop 3 -- Mobile Shared Export.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:mobile-shared-export
//
// It never starts a server and never defaults to any deployment: it needs
// TATESPUN_E2E_BASE_URL (loopback only unless TATESPUN_E2E_ALLOW_PRODUCTION=1).
// Only the disposable in-memory Demo route is driven for exports; a normal
// (local, disposable-profile) `/editor` document is opened only to measure the
// phone nav's widest layout (Cloud-save + export + focus buttons).
//
// What it proves (all decided from the real DOM + Chrome download events):
//  * at 320/375/390/430 the export entry is reachable from the phone Editor
//    view with the Preview still display:none -- no Preview visit needed;
//  * the entry, its sheet and every option fit inside the viewport;
//  * the phone sheet and the desktop dropdown are the same list, and both reach
//    the same handlers (PDF setup -> odd-page warning -> return/continue ->
//    exactly one PDF; JPG/ZIP/JPG一括 produce valid, correctly-sized files --
//    a 2x2px JPEG is the failure this loop exists to prevent);
//  * FQ-04 keyboard-compact chrome and 集中モード are unchanged;
//  * 768/1280 keep the desktop Preview 書き出し ▾ and render no phone entry.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sleep } from "./helpers/cdp.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";

const NAME = "mobile shared export E2E";
const target = resolveE2eTarget(process.env, NAME);

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "1280x720", width: 1280, height: 720 },
];
const isPhone = (v) => v.width < 768; // Tailwind `md`

const STEP_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 90_000;
const SETTLE_MS = 1_500;
const PREVIEW_SETTLE_MS = 1_500; // > both 180ms content debounces + the V2 plan build
const ODD_TEXT = "短い文です。";
const EVEN_TEXT = "一頁目。\n\n【改ページ】\n\n二頁目。";
const FOUR_PAGES = "一\n\n【改ページ】\n\n二\n\n【改ページ】\n\n三\n\n【改ページ】\n\n四";

const session = await launchEditorSession("tatespun-mobile-export-");
const { cdp, downloads } = session;
const log = (line) => console.log(line);

// Native alert()/confirm() dialogs would silently stall a headless run. Record and dismiss them: an export failure
// is reported through alert() in this app, and window.confirm must never appear in the export flow at all.
const dialogs = [];
cdp.on("Page.javascriptDialogOpening", (p) => {
  dialogs.push(`${p.type}: ${p.message}`);
  cdp.send("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
});

// --- browser-side helpers --------------------------------------------------------

const RECT = (selector) => `(() => {
  const e = document.querySelector(${JSON.stringify(selector)});
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height,
    shown: e.getClientRects().length > 0, vw: innerWidth, vh: innerHeight };
})()`;
const inViewport = (r) => r && r.shown && r.l >= -0.5 && r.t >= -0.5 && r.r <= r.vw + 0.5 && r.b <= r.vh + 0.5;
const rect = (selector) => cdp.evaluate(RECT(selector));
const exists = (selector) => cdp.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);

/** Sticky phone nav height with the export entry vs. with it hidden: Loop 3 must not cost any vertical space (FQ-04). */
const NAV_HEIGHT_DELTA = `(() => {
  const nav = document.querySelector('[data-mobile-export-trigger]').closest('div.sticky');
  const withEntry = nav.getBoundingClientRect().height;
  const style = document.createElement('style');
  style.textContent = '[data-mobile-export-trigger]{display:none !important}';
  document.head.appendChild(style);
  const withoutEntry = nav.getBoundingClientRect().height;
  style.remove();
  return { withEntry, withoutEntry };
})()`;

const PREVIEW_SECTION = `document.querySelector('[data-demo-target="export"]').closest('section')`;
// Page count read from textContent: this test asserts STATE, and the Preview is
// deliberately display:none on phones (innerText would not see it).
const PAGE_COUNT_FROM_DOM = `(() => {
  const h = [...document.querySelectorAll('div')].find((d) => d.children.length === 0 && /\\/ 全 \\d+ ページ/.test(d.textContent));
  const m = h?.textContent.match(/\\/ 全 (\\d+) ページ/);
  return m ? Number(m[1]) : null;
})()`;

async function navigate(path, { seeded }) {
  await cdp.send("Page.navigate", { url: target.url(path) });
  await cdp.waitFor(
    `document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved' && ` +
      (seeded
        ? `(document.querySelector('[data-demo-target="editor"]')?.value?.length ?? 0) > 0`
        : `!!document.querySelector('[data-demo-target="editor"]')`),
    { timeoutMs: STEP_TIMEOUT_MS, label: `${path} ready` }
  );
  await sleep(500);
  // window.confirm must never come back into the export flow.
  await cdp.evaluate(`window.__tspConfirmCalls = 0; const c = window.confirm; window.confirm = (...a) => { window.__tspConfirmCalls++; return c.apply(window, a); }; true`);
}
const openDemo = () => navigate("/editor?demo=1", { seeded: true });

async function click(selector, text = null) {
  const ok = await cdp.evaluate(`(() => {
    const wanted = ${JSON.stringify(text)};
    const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find((x) => wanted === null || x.textContent.trim() === wanted);
    if (!b || b.disabled) return false;
    b.click();
    return true;
  })()`);
  assert.equal(ok, true, `could not click ${selector}${text ? ` "${text}"` : ""}`);
}

/**
 * A real pointer click at the element's centre: unlike element.click() it
 * hit-tests (fails if anything covers the target), focuses the element like a
 * real tap does, and exercises the same path a user's finger/mouse takes.
 */
async function realClick(selector) {
  const c = await cdp.evaluate(`(() => {
    const e = document.querySelector(${JSON.stringify(selector)});
    if (!e || e.disabled) return null;
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, hit: e === top || e.contains(top) };
  })()`);
  assert.ok(c, `${selector}: missing or disabled`);
  assert.ok(c.hit, `${selector}: another element covers its centre, a user could not tap it`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: c.x, y: c.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: c.x, y: c.y, button: "left", clickCount: 1 });
}

/** Same technique as editorInputIntegrity.e2e.mjs: native setter + InputEvent so React's onChange fires. */
async function setManuscript(text, expectedPages) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  })()`);
  await cdp.waitFor(`(${PAGE_COUNT_FROM_DOM}) === ${expectedPages}`, {
    timeoutMs: STEP_TIMEOUT_MS,
    label: `Preview state reports 全 ${expectedPages} ページ`,
  });
  // The V2 renderer builds its page plan asynchronously after the debounced content update; exporting in the
  // same instant as typing would race that plan (a property of typing-then-exporting, not of the entry point).
  await sleep(PREVIEW_SETTLE_MS);
}

const completed = () => downloads.filter((d) => d.state === "completed");
const describeDownloads = () => JSON.stringify(downloads.map(({ name, state }) => ({ name, state })));
async function waitForCompleted(count) {
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (completed().length >= count) return;
    if (downloads.some((d) => d.state === "canceled")) throw new Error(`a download was canceled: ${describeDownloads()}`);
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${count} completed download(s): ${describeDownloads()}`);
}
function jpegSize(buffer) {
  let i = 2;
  while (i < buffer.length) {
    if (buffer[i] !== 0xff) { i++; continue; }
    const marker = buffer[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buffer.readUInt16BE(i + 5), width: buffer.readUInt16BE(i + 7) };
    i += 2 + buffer.readUInt16BE(i + 2);
  }
  return null;
}
function assertValidJpeg(download) {
  assert.match(download.name, /\.jpe?g$/i, `not a JPEG name: ${download.name}`);
  const buffer = readFileSync(download.filePath);
  const size = jpegSize(buffer);
  // The pre-Loop-3 defect exported a 2x2px, ~759-byte JPEG from a display:none Preview.
  assert.ok(size && size.width >= 800 && size.height >= 1000, `${download.name} is ${JSON.stringify(size)} (${buffer.length} bytes); expected a full page image`);
}
function assertValidPdf(download) {
  assert.match(download.name, /\.pdf$/i, `not a PDF name: ${download.name}`);
  assert.equal(readFileSync(download.filePath).subarray(0, 5).toString("latin1"), "%PDF-");
}

const SHEET = "[data-editor-export-sheet]";
async function openSheet() {
  await realClick("[data-mobile-export-trigger]");
  await cdp.waitFor(`!!document.querySelector('${SHEET}')`, { label: "export sheet opens" });
}
const sheetEntries = () =>
  cdp.evaluate(`[...document.querySelectorAll('[data-export-sheet-entry]')].map((b) => ({ id: b.dataset.exportSheetEntry, label: b.textContent.trim(), disabled: b.disabled }))`);
async function chooseSheetEntry(id) {
  await realClick(`[data-export-sheet-entry="${id}"]`);
  await cdp.waitFor(`!document.querySelector('${SHEET}')`, { label: "sheet closes after choosing" });
}
async function assertStillEditorView(label) {
  const pressed = await cdp.evaluate(
    `[...document.querySelectorAll('[role="group"][aria-label="表示する画面"] button')].map((b) => b.textContent.trim() + ':' + b.getAttribute('aria-pressed'))`
  );
  assert.deepEqual(pressed, ["本文:true", "プレビュー:false"], `${label}: the Preview must never have been visited (${pressed})`);
  assert.equal(await cdp.evaluate(`getComputedStyle(${PREVIEW_SECTION}).display`), "none", `${label}: Preview section must be display:none again`);
}

// --- phase 1: viewport matrix ---------------------------------------------------

let phoneOddPdfBytes = null; // same manuscript exported from the phone Editor view and from the desktop Preview
let phoneEntries = null; // ids+labels seen in the phone sheet, compared with the desktop dropdown

async function layoutPhase(v) {
  await session.setViewport(v.width, v.height);
  await openDemo();
  const innerWidth = await cdp.evaluate("innerWidth");
  assert.equal(innerWidth, v.width, `${v.name}: viewport not applied (${innerWidth})`);

  if (isPhone(v)) {
    assert.equal(await cdp.evaluate(`getComputedStyle(${PREVIEW_SECTION}).display`), "none", `${v.name}: Preview must be hidden in phone Editor view`);
    const trigger = await rect("[data-mobile-export-trigger]");
    assert.ok(inViewport(trigger), `${v.name}: export entry not fully inside the viewport ${JSON.stringify(trigger)}`);
    assert.ok(trigger.h >= 24, `${v.name}: export entry too small to tap (${trigger.h}px)`);
    const overflow = await cdp.evaluate(`(() => {
      const nav = document.querySelector('[data-mobile-export-trigger]').closest('div.sticky');
      const kids = [...nav.querySelectorAll('a, button')].map((e) => e.getBoundingClientRect());
      return { pageScroll: document.documentElement.scrollWidth - innerWidth, navScroll: nav.scrollWidth - nav.clientWidth,
        navBottom: nav.getBoundingClientRect().bottom, kidsOutside: kids.filter((r) => r.right > innerWidth + 0.5 || r.left < -0.5).length };
    })()`);
    assert.ok(overflow.pageScroll <= 1 && overflow.navScroll <= 1 && overflow.kidsOutside === 0, `${v.name}: nav overflows ${JSON.stringify(overflow)}`);
    const navHeights = await cdp.evaluate(NAV_HEIGHT_DELTA);
    assert.ok(navHeights.withEntry <= navHeights.withoutEntry + 0.5, `${v.name}: the export entry made the sticky nav taller (${navHeights.withoutEntry} -> ${navHeights.withEntry}px)`);
    const textarea = await rect('[data-demo-target="editor"]');
    assert.ok(textarea.shown, `${v.name}: manuscript area missing`);

    await openSheet();
    const dialog = await rect(`${SHEET} [role="dialog"]`);
    assert.ok(inViewport(dialog), `${v.name}: sheet not inside viewport ${JSON.stringify(dialog)}`);
    const entries = await sheetEntries();
    assert.deepEqual(entries.map((e) => e.id), ["jpg", "jpg-batch", "jpg-zip", "pdf"]);
    for (const e of entries) {
      const r = await rect(`[data-export-sheet-entry="${e.id}"]`);
      assert.ok(inViewport(r) && r.h >= 40, `${v.name}: sheet option ${e.id} not visible/tappable ${JSON.stringify(r)}`);
      assert.equal(e.disabled, false, `${v.name}: ${e.id} unexpectedly disabled`);
    }
    if (v.name === "390x844") phoneEntries = entries.map(({ id, label }) => ({ id, label }));
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await cdp.waitFor(`!document.querySelector('${SHEET}')`, { label: "Escape closes the sheet" });
    assert.equal(
      await cdp.evaluate(`document.activeElement?.hasAttribute('data-mobile-export-trigger')`),
      true,
      `${v.name}: focus must return to the export entry after closing the sheet`
    );
    await assertStillEditorView(v.name);
    log(`  ${v.name}: entry in view (${Math.round(trigger.w)}x${Math.round(trigger.h)}), nav height unchanged (${Math.round(navHeights.withEntry)}px), sheet fits, Preview untouched`);
  } else {
    assert.equal(await exists("[data-mobile-export-trigger]") && (await rect("[data-mobile-export-trigger]")).shown, false, `${v.name}: phone export entry must not render on the desktop layout`);
    const desktopButton = await rect('[data-demo-target="export"]');
    assert.ok(inViewport(desktopButton), `${v.name}: desktop Preview 書き出し ▾ not visible ${JSON.stringify(desktopButton)}`);
    await click('[data-demo-target="export"]');
    await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry]')`, { label: "desktop dropdown opens" });
    const dropdown = await cdp.evaluate(`[...document.querySelectorAll('[data-export-menu-entry]')].map((b) => ({ id: b.dataset.exportMenuEntry, label: b.textContent.trim() }))`);
    if (phoneEntries) assert.deepEqual(dropdown, phoneEntries, `${v.name}: desktop dropdown and phone sheet must be the same list`);
    assert.equal(await exists(SHEET), false);
    log(`  ${v.name}: desktop 書き出し ▾ intact; dropdown = phone sheet (${dropdown.map((e) => e.label).join(" / ")})`);
  }
}

// --- phase 2: phone flows (390x844) ----------------------------------------------

async function nonDemoNavAt320() {
  await session.setViewport(320, 568);
  await navigate("/editor", { seeded: false });
  const m = await cdp.evaluate(`(() => {
    const trig = document.querySelector('[data-mobile-export-trigger]');
    const nav = trig.closest('div.sticky');
    const kids = [...nav.querySelectorAll('a, button')].map((e) => e.getBoundingClientRect());
    const ta = document.querySelector('[data-demo-target="editor"]').getBoundingClientRect();
    return { hasCloudSave: [...nav.querySelectorAll('button')].some((b) => b.textContent.includes('クラウド保存')),
      pageScroll: document.documentElement.scrollWidth - innerWidth, kidsOutside: kids.filter((r) => r.right > innerWidth + 0.5 || r.left < -0.5).length,
      navHeight: nav.getBoundingClientRect().height, textareaH: ta.height };
  })()`);
  const navHeights = await cdp.evaluate(NAV_HEIGHT_DELTA);
  assert.ok(navHeights.withEntry <= navHeights.withoutEntry + 0.5, `320px normal document: the export entry made the nav taller (${navHeights.withoutEntry} -> ${navHeights.withEntry}px)`);
  assert.equal(m.hasCloudSave, true, "normal document should show the Cloud-save button (widest nav)");
  assert.ok(m.pageScroll <= 1 && m.kidsOutside === 0, `320px normal-document nav overflows ${JSON.stringify(m)}`);
  log(`  320x568 normal document (Cloud-save + export + focus): no overflow, nav ${Math.round(navHeights.withEntry)}px (unchanged by the export entry)`);
}

async function phonePdfFlow(v) {
  await session.setViewport(v.width, v.height);
  await openDemo();
  await assertStillEditorView(`${v.name} start`);
  const before = downloads.length;

  // 1 page -> warning; Return; Continue -> exactly one PDF.
  await setManuscript(ODD_TEXT, 1);
  await openSheet();
  await chooseSheetEntry("pdf");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup modal" });
  assert.ok(inViewport(await rect('[data-pdf-export-setup-modal] [role="dialog"]')), `${v.name}: PDF setup modal not inside the viewport`);
  await click("[data-pdf-export-setup-modal] button", "ダウンロード");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "odd-page warning" });
  assert.equal(await exists("[data-pdf-checklist-gate]"), false, "unexpected checklist gate");
  assert.match(await cdp.evaluate(`document.querySelector('#pdf-odd-page-warning-title')?.textContent ?? ''`), /奇数ページ.*全 1 ページ/);
  const warnDialog = await rect('[data-pdf-odd-page-warning] [role="dialog"]');
  assert.ok(inViewport(warnDialog), `${v.name}: odd-page warning not inside the viewport ${JSON.stringify(warnDialog)}`);
  for (const action of ["return", "continue"]) {
    const r = await rect(`[data-pdf-odd-page-warning-action="${action}"]`);
    assert.ok(inViewport(r), `${v.name}: warning action ${action} not visible`);
  }
  assert.equal(downloads.length, before, "PDF generated before the user chose");
  await click('[data-pdf-odd-page-warning-action="return"]');
  await cdp.waitFor(`!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "warning closes on return" });
  assert.equal(await exists("[data-pdf-export-setup-modal]"), true, "PDF setup must remain after 戻って確認する");
  await sleep(SETTLE_MS);
  assert.equal(downloads.length, before, "戻って確認する must not export");
  await click("[data-pdf-export-setup-modal] button", "ダウンロード");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "warning again" });
  await click('[data-pdf-odd-page-warning-action="continue"]');
  await waitForCompleted(before + 1);
  await sleep(SETTLE_MS);
  assert.equal(downloads.length, before + 1, `このままPDFを書き出す must generate exactly one PDF: ${describeDownloads()}`);
  assertValidPdf(downloads[downloads.length - 1]);
  phoneOddPdfBytes = readFileSync(downloads[downloads.length - 1].filePath).length;
  await assertStillEditorView(`${v.name} after odd PDF`);
  log(`  ${v.name}: Editor view -> 書き出し ▾ -> PDF -> 全1ページ warning -> return -> continue = exactly 1 PDF; Preview never shown`);

  // 2 pages -> no warning.
  const beforeEven = downloads.length;
  await setManuscript(EVEN_TEXT, 2);
  await openSheet();
  await chooseSheetEntry("pdf");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup modal (even)" });
  await click("[data-pdf-export-setup-modal] button", "ダウンロード");
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
  while (Date.now() < deadline && downloads.length === beforeEven) {
    assert.equal(await exists("[data-pdf-odd-page-warning]"), false, "warning shown for an even total");
    await sleep(150);
  }
  await waitForCompleted(beforeEven + 1);
  await sleep(SETTLE_MS);
  assert.equal(downloads.length, beforeEven + 1, `even PDF must be exactly one export: ${describeDownloads()}`);
  assertValidPdf(downloads[downloads.length - 1]);
  assert.equal(await cdp.evaluate(`window.__tspConfirmCalls ?? -1`), 0, "window.confirm was used in the phone export flow");
  log(`  ${v.name}: 2 pages -> PDF exported with no warning; window.confirm never used`);
}

async function phoneImageFlows(v) {
  await session.setViewport(v.width, v.height);
  await openDemo();
  await setManuscript(EVEN_TEXT, 2);

  let before = downloads.length;
  await openSheet();
  await chooseSheetEntry("jpg");
  await waitForCompleted(before + 1);
  assertValidJpeg(downloads[downloads.length - 1]);
  const size = jpegSize(readFileSync(downloads[downloads.length - 1].filePath));
  await assertStillEditorView(`${v.name} after JPG`);
  log(`  ${v.name}: JPG from Editor view = ${size.width}x${size.height} (a hidden-Preview capture would be 2x2)`);

  before = downloads.length;
  await openSheet();
  await chooseSheetEntry("jpg-batch");
  await waitForCompleted(before + 2);
  await sleep(SETTLE_MS);
  assert.equal(downloads.length, before + 2, `JPG一括 of 2 pages must download 2 files: ${describeDownloads()}`);
  downloads.slice(before).forEach(assertValidJpeg);
  log(`  ${v.name}: JPG一括 = 2 valid JPEGs`);

  before = downloads.length;
  await openSheet();
  await chooseSheetEntry("jpg-zip");
  await waitForCompleted(before + 1);
  await sleep(SETTLE_MS);
  assert.equal(downloads.length, before + 1);
  const zip = downloads[downloads.length - 1];
  assert.match(zip.name, /\.zip$/i);
  assert.equal(readFileSync(zip.filePath).subarray(0, 2).toString("latin1"), "PK");
  log(`  ${v.name}: JPG ZIP = valid zip`);
  await assertStillEditorView(`${v.name} after ZIP`);
}

async function phoneProgressVisible(v) {
  await session.setViewport(v.width, v.height);
  await openDemo();
  await setManuscript(FOUR_PAGES, 4);
  const before = downloads.length;
  await openSheet();
  await chooseSheetEntry("pdf");
  await click("[data-pdf-export-setup-modal] button", "ダウンロード");
  let seen = null;
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
  while (Date.now() < deadline && downloads.length === before) {
    const r = await rect('[role="alertdialog"][aria-busy="true"]');
    if (r && inViewport(r)) { seen = r; break; }
    await sleep(25);
  }
  assert.ok(seen, `${v.name}: the export progress overlay was never visible in the phone Editor view`);
  await waitForCompleted(before + 1);
  assertValidPdf(downloads[downloads.length - 1]);
  await assertStillEditorView(`${v.name} after progress`);
  log(`  ${v.name}: export progress overlay visible on screen during a 4-page PDF (Preview hidden)`);
}

async function phonePreviewViewAndGuardrails(v) {
  await session.setViewport(v.width, v.height);
  await openDemo();

  // FQ-04: the keyboard-compact rule hides header/secondary/title but must keep the nav + export entry.
  const compact = await cdp.evaluate(`(() => {
    const shell = document.querySelector('[data-editor-shell]');
    shell.setAttribute('data-keyboard-active', '');
    const header = getComputedStyle(document.querySelector('[data-editor-header-slot]')).display;
    const t = document.querySelector('[data-mobile-export-trigger]');
    const r = t.getBoundingClientRect();
    const out = { header, shown: t.getClientRects().length > 0, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
    shell.removeAttribute('data-keyboard-active');
    return out;
  })()`);
  assert.equal(compact.header, "none", "keyboard-compact CSS did not engage in this test (attribute not applied)");
  assert.ok(compact.shown && compact.inView, `export entry lost while the keyboard-compact layout is active ${JSON.stringify(compact)}`);
  log(`  ${v.name}: keyboard-compact layout active -> export entry still reachable (FQ-04 chrome untouched)`);

  // 集中モード: the phone chrome stays exactly as before (no export entry), and restores on exit.
  // Scoped to the phone nav: the desktop Header carries a same-named data-demo-target.
  const NAV_FOCUS = 'div.sticky [data-demo-target="focus-mode"]';
  await click(NAV_FOCUS);
  await cdp.waitFor(`!document.querySelector('[data-mobile-export-trigger]')`, { label: "export entry hidden in focus mode" });
  assert.match(await cdp.evaluate(`document.querySelector('${NAV_FOCUS}').textContent`), /通常表示に戻す/);
  await click(NAV_FOCUS);
  await cdp.waitFor(`!!document.querySelector('[data-mobile-export-trigger]')`, { label: "export entry back after focus mode" });
  log(`  ${v.name}: 集中モード unchanged (no export entry inside it; restored on exit)`);

  // Preview view keeps its own 書き出し ▾, the nav entry still works, and JPG from a VISIBLE Preview is valid too.
  await click('[role="group"][aria-label="表示する画面"] button', "プレビュー");
  await cdp.waitFor(`getComputedStyle(${PREVIEW_SECTION}).display !== 'none'`, { label: "Preview shown" });
  // A person cannot tap 書き出し within ~100ms of the workspace switch; the V2 renderer re-builds its page plan
  // when the Preview becomes displayed, so give it the time a real interaction always has.
  await sleep(PREVIEW_SETTLE_MS);
  const previewButton = await rect('[data-demo-target="export"]');
  assert.ok(inViewport(previewButton), `${v.name}: Preview's own 書き出し ▾ not visible in Preview view`);
  assert.equal((await rect("[data-mobile-export-trigger]")).shown, true, "nav export entry should also exist in Preview view");
  await openSheet();
  assert.equal((await sheetEntries()).length, 4);
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.waitFor(`!document.querySelector('${SHEET}')`, { label: "sheet closes in Preview view" });
  const before = downloads.length;
  await click('[data-demo-target="export"]');
  await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="jpg"]')`, { label: "Preview dropdown" });
  await click('[data-export-menu-entry="jpg"]');
  await waitForCompleted(before + 1);
  assertValidJpeg(downloads[downloads.length - 1]);
  assert.equal(
    await cdp.evaluate(`getComputedStyle(${PREVIEW_SECTION}).display !== 'none'`),
    true,
    "Preview must remain the displayed workspace after exporting from it"
  );
  log(`  ${v.name}: Preview view keeps its own 書き出し ▾ (valid JPG), and the nav entry opens the same sheet`);
}

// --- phase 3: desktop regression -------------------------------------------------

async function desktopFlow(v) {
  await session.setViewport(v.width, v.height);
  await openDemo();
  await setManuscript(ODD_TEXT, 1);
  const before = downloads.length;
  await click('[data-demo-target="export"]');
  await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="pdf"]')`, { label: "desktop dropdown" });
  await click('[data-export-menu-entry="pdf"]');
  await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup modal" });
  await click("[data-pdf-export-setup-modal] button", "ダウンロード");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "odd-page warning (desktop)" });
  await click('[data-pdf-odd-page-warning-action="return"]');
  await cdp.waitFor(`!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "warning closes" });
  assert.equal(downloads.length, before, "return must not export");
  await click("[data-pdf-export-setup-modal] button", "ダウンロード");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "warning again" });
  await click('[data-pdf-odd-page-warning-action="continue"]');
  await waitForCompleted(before + 1);
  await sleep(SETTLE_MS);
  assert.equal(downloads.length, before + 1, `desktop continue must export exactly one PDF: ${describeDownloads()}`);
  assertValidPdf(downloads[downloads.length - 1]);
  const desktopBytes = readFileSync(downloads[downloads.length - 1].filePath).length;
  // Same manuscript, same settings: a phone Editor-view PDF must be the same document as the desktop one
  // (a capture from a display:none Preview would come out blank/different).
  assert.ok(
    phoneOddPdfBytes && Math.abs(phoneOddPdfBytes - desktopBytes) / desktopBytes < 0.02,
    `phone Editor-view PDF (${phoneOddPdfBytes} bytes) differs from the desktop PDF (${desktopBytes} bytes) for the same manuscript`
  );
  assert.equal(await cdp.evaluate(`window.__tspConfirmCalls ?? -1`), 0, "window.confirm was used in the desktop export flow");
  log(`  ${v.name}: desktop Preview 書き出し ▾ -> PDF -> warning -> return -> continue = exactly 1 PDF (${desktopBytes} bytes; phone Editor-view PDF of the same text = ${phoneOddPdfBytes} bytes)`);
}

// --- main -------------------------------------------------------------------------

try {
  log(`target: ${target.url("/editor?demo=1")}${target.isLoopback ? "" : "  (remote, explicitly allowed)"}`);
  log("phase 1: viewport matrix (phone widths first so the desktop dropdown can be compared to the phone sheet)");
  for (const v of VIEWPORTS) await layoutPhase(v);
  await nonDemoNavAt320();

  const phone = VIEWPORTS.find((v) => v.name === "390x844");
  log("phase 2: phone flows at 390x844 (Editor view; Preview never shown)");
  await phonePdfFlow(phone);
  await phoneImageFlows(phone);
  await phoneProgressVisible(phone);
  await phonePreviewViewAndGuardrails(phone);

  log("phase 2b: 320x568 modal usability");
  const small = VIEWPORTS[0];
  await session.setViewport(small.width, small.height);
  await openDemo();
  await setManuscript(ODD_TEXT, 1);
  await openSheet();
  await chooseSheetEntry("pdf");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup modal @320" });
  assert.ok(inViewport(await rect('[data-pdf-export-setup-modal] [role="dialog"]')), "320px: PDF setup modal not inside the viewport");
  const dialogInfo = await cdp.evaluate(`(() => { const d = document.querySelector('[data-pdf-export-setup-modal] [role="dialog"]'); const body = d.querySelector('[data-viewport-modal-body]'); const btns = [...d.querySelectorAll('button')].map((b) => b.getBoundingClientRect()); return { scrollable: body.scrollHeight >= body.clientHeight, footerVisible: btns.some((r) => r.bottom <= innerHeight && r.top >= 0) }; })()`);
  assert.equal(dialogInfo.footerVisible, true, "320px: PDF setup footer buttons must stay on screen");
  await click("[data-pdf-export-setup-modal] button", "ダウンロード");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "warning @320" });
  const w = await rect('[data-pdf-odd-page-warning] [role="dialog"]');
  assert.ok(inViewport(w), `320px: warning not inside viewport ${JSON.stringify(w)}`);
  for (const action of ["return", "continue"]) {
    const r = await rect(`[data-pdf-odd-page-warning-action="${action}"]`);
    assert.ok(inViewport(r) && r.h >= 24, `320px: warning action ${action} not usable`);
  }
  const hit = await cdp.evaluate(`(() => { const b = document.querySelector('[data-pdf-odd-page-warning-action="return"]'); const r = b.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return b === top || b.contains(top); })()`);
  assert.equal(hit, true, "320px: the return action is covered by another element");
  await click('[data-pdf-odd-page-warning-action="return"]');
  await click("[data-pdf-export-setup-modal] button", "キャンセル");
  log("  320x568: sheet -> PDF setup -> odd-page warning are all on-screen and operable");

  log("phase 3: desktop regression");
  await desktopFlow(VIEWPORTS[5]);

  assert.deepEqual(dialogs, [], `unexpected native dialog(s) during the run: ${JSON.stringify(dialogs)}`);
  log(`${NAME}: PASS (${VIEWPORTS.map((v) => v.name).join(", ")}; ${downloads.length} downloads verified)`);
} catch (error) {
  process.exitCode = 1;
  console.error(`${NAME}: FAIL -- ${error instanceof Error ? error.message : error}`);
  try {
    console.error("state at failure:", JSON.stringify(await cdp.evaluate(`({ innerWidth, innerHeight, sheet: !!document.querySelector('${SHEET}'), setup: !!document.querySelector('[data-pdf-export-setup-modal]'), warn: !!document.querySelector('[data-pdf-odd-page-warning]'), trigger: !!document.querySelector('[data-mobile-export-trigger]') })`)));
    console.error("downloads:", describeDownloads());
    if (dialogs.length) console.error("native dialogs:", JSON.stringify(dialogs));
  } catch {}
} finally {
  await session.close();
}
