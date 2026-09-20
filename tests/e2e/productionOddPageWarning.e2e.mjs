// Explicit-run smoke test for the UX v3 Loop 2 odd-page export warning.
//
//   TATESPUN_E2E_BASE_URL=https://spuntales.net/tatespun \
//   TATESPUN_E2E_ALLOW_PRODUCTION=1 \
//   npm run test:e2e:production-odd-page
//
// Design rules (see roadmap §38):
// - NEVER runs implicitly: it is not part of `npm test`/build, and it refuses
//   to start without TATESPUN_E2E_BASE_URL. It does not start a dev server and
//   does not default to production.
// - A non-loopback host additionally requires TATESPUN_E2E_ALLOW_PRODUCTION=1.
// - Only the disposable, in-memory Demo route (`/editor?demo=1`) is used: no
//   project is created and no DB/Auth/Supabase write can happen. The browser
//   profile and download directory are disposable temp dirs.
// - The viewport is forced to >= 1280px. Headless Chrome's default
//   innerWidth is 764px (< Tailwind `md` 768px): the Editor then renders the
//   PHONE layout where Preview is `display:none`, so Preview text never
//   appears in `document.body.innerText`. The test asserts the viewport and
//   that the Preview header is actually visible before it does anything else.
// - Everything is decided from the real DOM and real operations; no bundle /
//   source string search.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CdpPage, findBrowser, freePort, sleep, waitForJson } from "./helpers/cdp.mjs";

const VIEWPORT = { width: 1280, height: 900 };
const MIN_DESKTOP_WIDTH = 1280; // must stay above Tailwind `md` (768px) with margin
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const STEP_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 60_000;
const SETTLE_MS = 1_500; // window in which a spurious 2nd export/download would show up

const ODD_TEXT = "短い文です。"; // 1 body page
const EVEN_TEXT = "一頁目。\n\n【改ページ】\n\n二頁目。"; // 2 body pages

function usageError(message) {
  console.error(`production odd-page E2E: NOT RUN -- ${message}`);
  console.error(
    "Usage: TATESPUN_E2E_BASE_URL=<origin+basePath> [TATESPUN_E2E_ALLOW_PRODUCTION=1] npm run test:e2e:production-odd-page\n" +
      "  e.g. https://spuntales.net/tatespun (needs TATESPUN_E2E_ALLOW_PRODUCTION=1) or http://127.0.0.1:3000"
  );
  process.exit(2);
}

function resolveTarget(env) {
  const configured = env.TATESPUN_E2E_BASE_URL?.trim();
  if (!configured) usageError("TATESPUN_E2E_BASE_URL is not set (this test never defaults to production).");
  let url;
  try {
    url = new URL(configured);
  } catch {
    usageError(`TATESPUN_E2E_BASE_URL is not a valid URL: ${configured}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") usageError("TATESPUN_E2E_BASE_URL must be http(s).");
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);
  if (!isLoopback && env.TATESPUN_E2E_ALLOW_PRODUCTION !== "1") {
    usageError(`${url.host} is not a loopback host; set TATESPUN_E2E_ALLOW_PRODUCTION=1 to allow a remote/production run.`);
  }
  const basePath = url.pathname.replace(/\/+$/, "");
  return { editorUrl: `${url.origin}${basePath}/editor?demo=1`, isLoopback };
}

const target = resolveTarget(process.env);

const profileDir = mkdtempSync(join(tmpdir(), "tatespun-prod-odd-page-"));
const downloadDir = join(profileDir, "downloads");
mkdirSync(downloadDir);
let browserProcess;
let cdp;
let browserSession; // browser-level CDP session: download behavior + events

// --- browser-side expressions -------------------------------------------------

/** Visible Preview header count ("... / 全 N ページ"); null if absent OR not rendered (display:none). */
const PREVIEW_PAGE_COUNT = `(() => {
  const header = [...document.querySelectorAll('div')].find(
    (d) => d.children.length === 0 && /\\/ 全 \\d+ ページ/.test(d.textContent)
  );
  if (!header || header.getClientRects().length === 0) return null;
  const m = header.innerText.match(/\\/ 全 (\\d+) ページ/);
  return m ? { count: Number(m[1]), colophon: header.innerText.includes('奥付') } : null;
})()`;

const STATE_DUMP = `(() => ({
  innerWidth,
  editorPresent: !!document.querySelector('[data-demo-target="editor"]'),
  save: document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus ?? null,
  previewHeaderInDom: [...document.querySelectorAll('div')].some((d) => d.children.length === 0 && /\\/ 全 \\d+ ページ/.test(d.textContent)),
  setupModal: !!document.querySelector('[data-pdf-export-setup-modal]'),
  checklistGate: !!document.querySelector('[data-pdf-checklist-gate]'),
  oddWarning: !!document.querySelector('[data-pdf-odd-page-warning]'),
  confirmCalls: window.__tspConfirmCalls ?? null,
}))()`;

const state = () => cdp.evaluate(STATE_DUMP);
const exists = (selector) => cdp.evaluate(`!!document.querySelector(${JSON.stringify(selector)})`);

async function clickButton(selector, text) {
  const clicked = await cdp.evaluate(`(() => {
    const wanted = ${JSON.stringify(text)};
    const b = [...document.querySelectorAll(${JSON.stringify(selector)})].find(
      (x) => wanted === null || x.textContent.trim() === wanted
    );
    if (!b || b.disabled) return false;
    b.click();
    return true;
  })()`);
  assert.equal(clicked, true, `could not click ${selector}${text ? ` "${text}"` : ""}`);
}

/** Same technique as editorInputIntegrity.e2e.mjs: native setter + InputEvent so React's onChange fires. */
async function setManuscript(text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  })()`);
}

async function expectPreviewPages(expected) {
  const shown = await cdp.waitFor(
    `(() => { const p = ${PREVIEW_PAGE_COUNT}; return p && p.count === ${expected} ? p : null; })()`,
    { timeoutMs: STEP_TIMEOUT_MS, label: `visible Preview header "全 ${expected} ページ"` }
  );
  assert.equal(shown.colophon, false, "the disposable Demo unexpectedly has 奥付 ON; odd/even totals would differ");
}

// Downloads are counted from Chrome's own download events (browser-level
// CDP session), NOT from files on disk: a second export reuses the default
// filename and Chrome overwrites it in place, so a file count cannot tell
// "one export" from "two exports".
const downloads = []; // { guid, name, state, filePath }

function trackDownloads(browserCdp) {
  browserCdp.on("Browser.downloadWillBegin", (p) => {
    downloads.push({ guid: p.guid, name: p.suggestedFilename, state: "inProgress", filePath: null });
  });
  browserCdp.on("Browser.downloadProgress", (p) => {
    const entry = downloads.find((d) => d.guid === p.guid);
    if (!entry) return;
    entry.state = p.state;
    if (p.filePath) entry.filePath = p.filePath;
  });
}

const describeDownloads = () => JSON.stringify(downloads.map(({ name, state }) => ({ name, state })));

async function waitForCompletedDownloads(count) {
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (downloads.filter((d) => d.state === "completed").length >= count) return;
    if (downloads.some((d) => d.state === "canceled")) throw new Error(`a download was canceled: ${describeDownloads()}`);
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${count} completed download(s): ${describeDownloads()}; dir=${JSON.stringify(readdirSync(downloadDir))}`);
}

/** Asserts the latest download is a finished, real PDF (magic bytes read from the saved file). */
function assertLatestDownloadIsPdf() {
  const latest = downloads[downloads.length - 1];
  assert.ok(latest, "no download recorded");
  assert.equal(latest.state, "completed", `latest download not completed: ${describeDownloads()}`);
  assert.match(latest.name, /.pdf$/i, `unexpected download name ${latest.name}`);
  const head = readFileSync(latest.filePath).subarray(0, 5).toString("latin1");
  assert.equal(head, "%PDF-", `${latest.name} is not a PDF`);
}

async function openPdfSetupAndDownload() {
  await clickButton('[data-demo-target="export"]', null);
  await cdp.waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'PDF')`, {
    label: "export menu PDF item",
  });
  await clickButton("button", "PDF");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-export-setup-modal]')`, { label: "PDF setup modal" });
  await clickButton("[data-pdf-export-setup-modal] button", "ダウンロード");
}

async function assertNoChecklistGate() {
  assert.equal(
    await exists("[data-pdf-checklist-gate]"),
    false,
    "the 完成前マイチェックリスト gate appeared; a disposable profile should not have one"
  );
}

// --- scenarios ---------------------------------------------------------------

async function oddPageScenario() {
  await setManuscript(ODD_TEXT);
  await expectPreviewPages(1);
  console.log("  odd: Preview shows 全 1 ページ");

  await openPdfSetupAndDownload();
  await cdp.waitFor(`!!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "odd-page warning after ダウンロード" });
  await assertNoChecklistGate();
  const title = await cdp.evaluate(`document.querySelector('#pdf-odd-page-warning-title')?.textContent ?? ''`);
  assert.match(title, /奇数ページ.*全 1 ページ/, `unexpected warning title: ${title}`);
  const actions = await cdp.evaluate(
    `Object.fromEntries([...document.querySelectorAll('[data-pdf-odd-page-warning-action]')].map((b) => [b.dataset.pdfOddPageWarningAction, b.textContent.trim()]))`
  );
  assert.deepEqual(actions, { return: "戻って確認する", continue: "このままPDFを書き出す" });
  assert.equal(downloads.length, 0, "a PDF was generated before the user chose");
  console.log("  odd: warning shown, PDF not yet generated");

  await clickButton('[data-pdf-odd-page-warning-action="return"]', null);
  await cdp.waitFor(`!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "warning closes on 戻って確認する" });
  assert.equal(await exists("[data-pdf-export-setup-modal]"), true, "PDF setup modal must remain after 戻って確認する");
  await sleep(SETTLE_MS);
  assert.equal(downloads.length, 0, `戻って確認する must not export anything: ${describeDownloads()}`);
  console.log("  odd: 戻って確認する closed only the warning; PDF setup stayed open; nothing exported");

  await clickButton("[data-pdf-export-setup-modal] button", "ダウンロード");
  await cdp.waitFor(`!!document.querySelector('[data-pdf-odd-page-warning]')`, { label: "warning again on retry" });
  await clickButton('[data-pdf-odd-page-warning-action="continue"]', null);
  await waitForCompletedDownloads(1);
  await sleep(SETTLE_MS); // a spurious second export would begin within this window
  assert.equal(downloads.length, 1, `このままPDFを書き出す must generate exactly one PDF: ${describeDownloads()}`);
  assertLatestDownloadIsPdf();
  const s = await state();
  assert.equal(s.oddWarning, false, "warning must be closed after continuing");
  assert.equal(s.setupModal, false, "PDF setup modal must be closed after continuing");
  console.log("  odd: 再実行 → このままPDFを書き出す generated exactly one valid PDF");
}

async function evenPageScenario() {
  await setManuscript(EVEN_TEXT);
  await expectPreviewPages(2);
  console.log("  even: Preview shows 全 2 ページ");

  const before = downloads.length;
  await openPdfSetupAndDownload();
  const deadline = Date.now() + DOWNLOAD_TIMEOUT_MS;
  while (Date.now() < deadline) {
    assert.equal(await exists("[data-pdf-odd-page-warning]"), false, "the odd-page warning appeared for an even total");
    await assertNoChecklistGate();
    if (downloads.length > before) break;
    await sleep(200);
  }
  assert.equal(downloads.length, before + 1, `even-page export did not start exactly one download: ${describeDownloads()}`);
  await waitForCompletedDownloads(before + 1);
  await sleep(SETTLE_MS);
  assert.equal(downloads.length, before + 1, `even-page export started more than one download: ${describeDownloads()}`);
  assert.equal(await exists("[data-pdf-odd-page-warning]"), false, "the odd-page warning appeared for an even total");
  assertLatestDownloadIsPdf();
  console.log("  even: no warning; PDF exported directly");
}

// --- main -------------------------------------------------------------------

async function main() {
  const debugPort = await freePort();
  browserProcess = spawn(
    findBrowser(),
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${join(profileDir, "profile")}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true }
  );
  const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  assert.match(version.Browser, /(Chrome|Chromium|Edg)\//);
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Could not open browser target: ${await targetResponse.text()}`);
  cdp = new CdpPage((await targetResponse.json()).webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");
  // Browser-level session: download behavior + download events.
  browserSession = new CdpPage(version.webSocketDebuggerUrl);
  await browserSession.open();
  trackDownloads(browserSession);
  await browserSession.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir, eventsEnabled: true });
  // Explicit desktop viewport: never rely on headless Chrome's 764px default.
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log(`target: ${target.editorUrl}${target.isLoopback ? "" : "  (remote/production, explicitly allowed)"}`);
  await cdp.send("Page.navigate", { url: target.editorUrl });
  await cdp.waitFor(
    `document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved' && (document.querySelector('[data-demo-target="editor"]')?.value?.length ?? 0) > 0`,
    { timeoutMs: STEP_TIMEOUT_MS, label: "Demo editor mounted with seeded manuscript" }
  );

  const width = await cdp.evaluate("innerWidth");
  assert.ok(
    width >= MIN_DESKTOP_WIDTH,
    `viewport is ${width}px; must be >= ${MIN_DESKTOP_WIDTH}px (< 768px renders the phone layout and hides Preview)`
  );
  await cdp.waitFor(PREVIEW_PAGE_COUNT, {
    timeoutMs: STEP_TIMEOUT_MS,
    label: "Preview header visible (if this fails the layout is probably the hidden phone layout)",
  });
  await cdp.evaluate(`window.__tspConfirmCalls = 0; const c = window.confirm; window.confirm = (...a) => { window.__tspConfirmCalls++; return c.apply(window, a); }; true`);
  console.log(`viewport ${width}px OK; Preview visible; demo seeded`);

  console.log("scenario: odd total (1 page)");
  await oddPageScenario();
  console.log("scenario: even total (2 pages)");
  await evenPageScenario();

  assert.equal((await state()).confirmCalls, 0, "window.confirm was used in the export flow");
  console.log(`production odd-page E2E: PASS (${target.isLoopback ? "local" : "remote"}; 1-page warning / return / continue = exactly 1 PDF / 2-page no warning)`);
}

try {
  await main();
} catch (error) {
  process.exitCode = 1;
  console.error(`production odd-page E2E: FAIL -- ${error instanceof Error ? error.message : error}`);
  try {
    if (cdp) console.error("state at failure:", JSON.stringify(await state()));
  } catch {}
} finally {
  cdp?.close();
  browserSession?.close();
  if (browserProcess?.pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(browserProcess.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      browserProcess.kill();
    }
  }
  await sleep(300); // let the browser release profile/download files before deletion
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
}
