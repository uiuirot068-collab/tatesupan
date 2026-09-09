import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const WORK_SESSION_STORAGE_KEY = "tatespun:work-sessions:v1";
const CURRENT_COUNT_TITLE = "現在の原稿文字数";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      const { port } = address;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function waitForPage(url, serverProcess, serverLog, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (serverProcess && serverProcess.exitCode !== null) {
      throw new Error(`Next dev exited before becoming ready.\n${serverLog()}`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}\n${serverLog()}`);
}

function findBrowser() {
  const configured = process.env.TATESPUN_E2E_BROWSER;
  const candidates = [
    configured,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const browser = candidates.find((candidate) => existsSync(candidate));
  if (!browser) {
    throw new Error("No Chromium browser found. Set TATESPUN_E2E_BROWSER to Chrome/Edge/Chromium.");
  }
  return browser;
}

class CdpPage {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.sequence = 0;
    this.pending = new Map();
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !this.pending.has(message.id)) return;
      const { resolve, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
    }
    return result.result.value;
  }

  async waitFor(expression, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for browser condition: ${expression}`);
  }

  close() {
    this.socket.close();
  }
}

function snapshotExpression() {
  return `(() => {
    const editor = document.querySelector('[data-demo-target="editor"]');
    const activity = document.querySelector('[data-work-session-written-count]');
    const result = document.querySelector('[data-work-session-result]');
    const resultModal = document.querySelector('[data-work-session-result-modal]');
    const history = document.querySelector('[data-work-session-history]');
    const historyModal = document.querySelector('[data-work-session-history-modal]');
    const historyBody = history?.querySelector('[data-viewport-modal-body]');
    const footerHelp = document.querySelector('[data-editor-footer-help]');
    const footerControls = document.querySelector('[data-editor-footer-controls]');
    const helpRect = footerHelp?.getBoundingClientRect();
    const controlsRect = footerControls?.getBoundingClientRect();
    const resultRect = result?.getBoundingClientRect();
    const resultModalRect = resultModal?.getBoundingClientRect();
    const historyRect = history?.getBoundingClientRect();
    const historyModalRect = historyModal?.getBoundingClientRect();
    const helpStyle = footerHelp ? getComputedStyle(footerHelp) : null;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const resultActions = result
      ? [...result.querySelectorAll('[data-work-session-result-action]')]
          .map((action) => action.getAttribute('data-work-session-result-action'))
      : [];
    const historyActions = history
      ? [...history.querySelectorAll('[data-work-session-history-action]')]
          .map((action) => action.getAttribute('data-work-session-history-action'))
      : [];
    const currentCount = document.querySelector('[title=${JSON.stringify(CURRENT_COUNT_TITLE)}]');
    return {
      editorValue: editor?.value,
      activityText: activity?.textContent.trim(),
      activityValue: activity?.getAttribute('data-work-session-written-count'),
      resultText: result?.textContent.replace(/\\s+/g, ' ').trim(),
      resultActions,
      resultRole: result?.getAttribute('role'),
      resultAriaModal: result?.getAttribute('aria-modal'),
      resultModalPosition: resultModal ? getComputedStyle(resultModal).position : undefined,
      resultPortalledToBody: resultModal?.parentElement === document.body,
      resultInViewport: Boolean(
        resultRect &&
        resultRect.left >= 0 &&
        resultRect.top >= 0 &&
        resultRect.right <= innerWidth &&
        resultRect.bottom <= innerHeight
      ),
      resultCenterDelta: resultRect
        ? {
            x: Math.abs((resultRect.left + resultRect.right) / 2 - ((resultModalRect?.left ?? 0) + (resultModalRect?.right ?? viewportWidth)) / 2),
            y: Math.abs((resultRect.top + resultRect.bottom) / 2 - ((resultModalRect?.top ?? 0) + (resultModalRect?.bottom ?? viewportHeight)) / 2),
          }
        : undefined,
      resultMargins: resultRect
        ? { left: resultRect.left, right: innerWidth - resultRect.right }
        : undefined,
      historyText: history?.textContent.replace(/\\s+/g, ' ').trim(),
      historyActions,
      historyModalPosition: historyModal ? getComputedStyle(historyModal).position : undefined,
      historyPortalledToBody: historyModal?.parentElement === document.body,
      historyInViewport: Boolean(
        historyRect && historyRect.left >= 0 && historyRect.top >= 0 &&
        historyRect.right <= innerWidth && historyRect.bottom <= innerHeight
      ),
      historyCenterDelta: historyRect
        ? {
            x: Math.abs((historyRect.left + historyRect.right) / 2 - ((historyModalRect?.left ?? 0) + (historyModalRect?.right ?? viewportWidth)) / 2),
            y: Math.abs((historyRect.top + historyRect.bottom) / 2 - ((historyModalRect?.top ?? 0) + (historyModalRect?.bottom ?? viewportHeight)) / 2),
          }
        : undefined,
      historyBodyOverflowY: historyBody ? getComputedStyle(historyBody).overflowY : undefined,
      hasStart: Boolean(document.querySelector('[data-work-session-action="start"]')),
      hasEnd: Boolean(document.querySelector('[data-work-session-action="end"]')),
      undoText: document.querySelector('[data-editor-history-action="undo"]')?.textContent.replace(/\\s+/g, ' ').trim(),
      redoText: document.querySelector('[data-editor-history-action="redo"]')?.textContent.replace(/\\s+/g, ' ').trim(),
      footerRowsSeparated: Boolean(helpRect && controlsRect && helpRect.bottom <= controlsRect.top + 1),
      footerHelpCompact: Boolean(
        footerHelp &&
        footerHelp.textContent.includes('ルビ：') &&
        footerHelp.textContent.includes('縦中横：') &&
        footerHelp.textContent.endsWith('…') &&
        helpStyle?.whiteSpace === 'nowrap' &&
        helpStyle?.textOverflow === 'ellipsis'
      ),
      footerHelpFullText: footerHelp?.getAttribute('title'),
      footerControlsWrap: footerControls ? getComputedStyle(footerControls).flexWrap : undefined,
      currentCountText: currentCount?.textContent.trim(),
      storage: localStorage.getItem(${JSON.stringify(WORK_SESSION_STORAGE_KEY)}),
    };
  })()`;
}

let nextProcess;
let browserProcess;
let cdp;
let nextOutput = "";
let browserOutput = "";
const profileDir = mkdtempSync(join(tmpdir(), "tatespun-11b-e2e-"));

try {
  let baseUrl = process.env.TATESPUN_E2E_BASE_URL;
  if (!baseUrl) {
    const appPort = await freePort();
    baseUrl = `http://127.0.0.1:${appPort}`;
    const nextBin = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url));
    nextProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(appPort)], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    nextProcess.stdout.on("data", (chunk) => { nextOutput += chunk; });
    nextProcess.stderr.on("data", (chunk) => { nextOutput += chunk; });
  }

  const editorUrl = `${baseUrl.replace(/\/$/, "")}/editor?demo=1`;
  await waitForPage(editorUrl, nextProcess, () => nextOutput);

  const debugPort = await freePort();
  browserProcess = spawn(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  browserProcess.stderr.on("data", (chunk) => { browserOutput += chunk; });

  const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  assert.match(version.Browser, /(Chrome|Chromium|Edg)\//);
  const targetResponse = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(editorUrl)}`,
    { method: "PUT" }
  );
  if (!targetResponse.ok) {
    throw new Error(`Could not open browser target: ${await targetResponse.text()}`);
  }
  const target = await targetResponse.json();
  cdp = new CdpPage(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  await cdp.waitFor(`document.readyState === 'complete' && Boolean(document.querySelector('[data-demo-target="editor"]'))`);
  await cdp.waitFor(`Object.getOwnPropertyNames(document.querySelector('[data-demo-target="editor"]')).some((key) => key.startsWith('__reactProps'))`);

  await cdp.evaluate(`localStorage.removeItem(${JSON.stringify(WORK_SESSION_STORAGE_KEY)}); location.reload(); true`);
  await cdp.waitFor(`document.readyState === 'complete' && Boolean(document.querySelector('[data-demo-target="editor"]'))`);
  await cdp.waitFor(`Object.getOwnPropertyNames(document.querySelector('[data-demo-target="editor"]')).some((key) => key.startsWith('__reactProps'))`);

  const idleBefore = await cdp.evaluate(snapshotExpression());
  assert.equal(idleBefore.hasStart, true);
  assert.equal(idleBefore.hasEnd, false);
  assert.equal(idleBefore.activityText, undefined);
  assert.equal(idleBefore.storage, null);
  assert.equal(idleBefore.undoText, "↶ 元に戻す");
  assert.equal(idleBefore.redoText, "↷ やり直す");
  assert.equal(idleBefore.footerRowsSeparated, true);
  assert.equal(idleBefore.footerHelpCompact, true);
  assert.match(idleBefore.footerHelpFullText, /\[tate\]A5\[\/tate\]/);
  assert.equal(idleBefore.footerControlsWrap, "wrap");
  assert.match(idleBefore.currentCountText, /^現在の原稿文字数 \d+文字$/);

  await cdp.evaluate(`(() => {
    const editor = document.querySelector('[data-demo-target="editor"]');
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    return true;
  })()`);
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "a",
    code: "KeyA",
    text: "a",
    unmodifiedText: "a",
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "a",
    code: "KeyA",
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  });
  const idleAfter = await cdp.evaluate(snapshotExpression());
  assert.equal(idleAfter.storage, null);
  assert.notEqual(idleAfter.currentCountText, idleBefore.currentCountText);
  assert.equal(idleAfter.editorValue, `${idleBefore.editorValue}a`);

  await cdp.evaluate(`document.querySelector('[data-work-session-action="start"]').click(); true`);
  await cdp.waitFor(`document.querySelector('[data-work-session-written-count]')?.getAttribute('data-work-session-written-count') === '0'`);
  const started = await cdp.evaluate(snapshotExpression());
  assert.equal(started.hasStart, false);
  assert.equal(started.hasEnd, true);
  assert.match(started.activityText, /今回書いた文字数 0文字/);
  assert.equal(JSON.parse(started.storage).active.writtenCharacterCount, 0);

  await cdp.evaluate(`(() => {
    const editor = document.querySelector('[data-demo-target="editor"]');
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    return true;
  })()`);
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "b",
    code: "KeyB",
    text: "b",
    unmodifiedText: "b",
    windowsVirtualKeyCode: 66,
    nativeVirtualKeyCode: 66,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "b",
    code: "KeyB",
    windowsVirtualKeyCode: 66,
    nativeVirtualKeyCode: 66,
  });
  await cdp.waitFor(`document.querySelector('[data-work-session-written-count]')?.getAttribute('data-work-session-written-count') === '1'`);
  const active = await cdp.evaluate(snapshotExpression());
  assert.match(active.activityText, /今回書いた文字数 1文字/);
  assert.equal(JSON.parse(active.storage).active.writtenCharacterCount, 1);

  await cdp.evaluate(`document.querySelector('[data-editor-history-action="undo"]').click(); true`);
  await cdp.waitFor(`document.querySelector('[data-demo-target="editor"]').value === ${JSON.stringify(active.editorValue.slice(0, -1))}`);
  const afterUndo = await cdp.evaluate(snapshotExpression());
  assert.equal(afterUndo.activityValue, "1");
  assert.equal(JSON.parse(afterUndo.storage).active.writtenCharacterCount, 1);

  await cdp.evaluate(`document.querySelector('[data-editor-history-action="redo"]').click(); true`);
  await cdp.waitFor(`document.querySelector('[data-demo-target="editor"]').value === ${JSON.stringify(active.editorValue)}`);
  const afterRedo = await cdp.evaluate(snapshotExpression());
  assert.equal(afterRedo.activityValue, "1");
  assert.equal(JSON.parse(afterRedo.storage).active.writtenCharacterCount, 1);

  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8,
    nativeVirtualKeyCode: 8,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Backspace",
    code: "Backspace",
    windowsVirtualKeyCode: 8,
    nativeVirtualKeyCode: 8,
  });
  await cdp.waitFor(`document.querySelector('[data-demo-target="editor"]').value === ${JSON.stringify(active.editorValue.slice(0, -1))}`);
  const afterDelete = await cdp.evaluate(snapshotExpression());
  assert.equal(afterDelete.activityValue, "1");
  assert.equal(JSON.parse(afterDelete.storage).active.writtenCharacterCount, 1);

  await cdp.evaluate(`(() => {
    const editor = document.querySelector('[data-demo-target="editor"]');
    editor.focus();
    editor.setSelectionRange(editor.value.length - 2, editor.value.length);
    return true;
  })()`);
  await cdp.send("Input.insertText", { text: "WXYZ" });
  await cdp.waitFor(`document.querySelector('[data-work-session-written-count]')?.getAttribute('data-work-session-written-count') === '5'`);
  const afterReplacement = await cdp.evaluate(snapshotExpression());
  assert.match(afterReplacement.activityText, /今回書いた文字数 5文字/);
  assert.equal(JSON.parse(afterReplacement.storage).active.writtenCharacterCount, 5);

  await cdp.evaluate(`document.querySelector('[data-work-session-action="end"]').click(); true`);
  await cdp.waitFor(`Boolean(document.querySelector('[data-work-session-result]'))`);
  const ended = await cdp.evaluate(snapshotExpression());
  const completedState = JSON.parse(ended.storage);
  assert.equal(ended.hasStart, true);
  assert.match(ended.resultText, /今回書いた文字数\s*5文字/);
  assert.match(ended.resultText, /作業時間/);
  assert.equal(ended.resultRole, "dialog");
  assert.equal(ended.resultAriaModal, "true");
  assert.equal(ended.resultModalPosition, "fixed");
  assert.equal(ended.resultPortalledToBody, true);
  assert.equal(ended.resultInViewport, true);
  assert.ok(
    ended.resultCenterDelta.x <= 1,
    "result modal is not horizontally centered: " + JSON.stringify(ended.resultCenterDelta)
  );
  assert.ok(
    ended.resultCenterDelta.y <= 1,
    "result modal is not vertically centered on desktop: " + JSON.stringify(ended.resultCenterDelta)
  );
  assert.deepEqual(
    ended.resultActions,
    ["close-icon", "close", "copy", "share-x"]
  );
  assert.equal(completedState.active, null);
  assert.equal(completedState.history.length, 1);
  assert.equal(completedState.history[0].writtenCharacterCount, 5);

  const copiedShareText = await cdp.evaluate("(async () => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__workSessionCopiedText = text; } } }); document.querySelector('[data-work-session-result-action=copy]').click(); await Promise.resolve(); return window.__workSessionCopiedText; })()");
  assert.equal(
    copiedShareText,
    "今日は5文字がんばりました！\n#TateSpun\nhttps://spuntales.net/tatespun/"
  );

  const xShareUrl = await cdp.evaluate("(() => { window.open = (url) => { window.__workSessionShareUrl = String(url); return null; }; document.querySelector('[data-work-session-result-action=share-x]').click(); return window.__workSessionShareUrl; })()");
  assert.equal(
    new URL(xShareUrl).searchParams.get("text"),
    "今日は5文字がんばりました！\n#TateSpun\nhttps://spuntales.net/tatespun/"
  );

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await cdp.evaluate("new Promise((resolve) => requestAnimationFrame(() => resolve(true)))");
  const narrowResult = await cdp.evaluate(snapshotExpression());
  assert.equal(narrowResult.resultInViewport, true);
  assert.ok(
    narrowResult.resultMargins.left >= 15,
    "missing narrow left margin: " + JSON.stringify(narrowResult.resultMargins)
  );
  assert.ok(
    narrowResult.resultMargins.right >= 15,
    "missing narrow right margin: " + JSON.stringify(narrowResult.resultMargins)
  );
  assert.ok(
    narrowResult.resultCenterDelta.y <= 1,
    "result modal is top-anchored on narrow viewport: " + JSON.stringify(narrowResult.resultCenterDelta)
  );

  await cdp.evaluate("document.querySelector('[data-work-session-result-action=close]').click(); true");
  await cdp.waitFor("!document.querySelector('[data-work-session-result]')");
  const afterResultClose = await cdp.evaluate(snapshotExpression());
  assert.equal(JSON.parse(afterResultClose.storage).history.length, 1);

  await cdp.evaluate("document.querySelector('[data-editor-footer-help]').click(); true");
  await cdp.waitFor("Boolean(document.querySelector('[data-editor-syntax-help-modal]'))");
  const syntaxHelp = await cdp.evaluate(`(() => {
    const overlay = document.querySelector('[data-editor-syntax-help-modal]');
    const dialog = document.querySelector('[data-editor-syntax-help-dialog]');
    return {
      portalledToBody: overlay?.parentElement === document.body,
      fullText: dialog?.querySelector('[data-editor-syntax-help-full]')?.textContent,
      role: dialog?.getAttribute('role'),
      ariaModal: dialog?.getAttribute('aria-modal'),
    };
  })()`);
  assert.equal(syntaxHelp.portalledToBody, true);
  assert.match(syntaxHelp.fullText, /改ページ：【改ページ】/);
  assert.equal(syntaxHelp.role, "dialog");
  assert.equal(syntaxHelp.ariaModal, "true");
  await cdp.evaluate("document.querySelector('[data-editor-syntax-help-modal]').click(); true");
  await cdp.waitFor("!document.querySelector('[data-editor-syntax-help-modal]')");

  await cdp.evaluate("document.querySelector('[data-work-session-action=history]').click(); true");
  await cdp.waitFor("Boolean(document.querySelector('[data-work-session-history-record]'))");
  const historyAfterClose = await cdp.evaluate(snapshotExpression());
  assert.match(historyAfterClose.historyText, /5文字/);
  assert.equal(historyAfterClose.historyModalPosition, "fixed");
  assert.equal(historyAfterClose.historyPortalledToBody, true);
  assert.equal(historyAfterClose.historyInViewport, true);
  assert.ok(historyAfterClose.historyCenterDelta.y <= 1);
  assert.equal(historyAfterClose.historyBodyOverflowY, "auto");
  assert.deepEqual(historyAfterClose.historyActions, ["close-icon", "share-x", "close"]);
  assert.equal(JSON.parse(historyAfterClose.storage).history[0].writtenCharacterCount, 5);

  await cdp.evaluate("location.reload(); true");
  await cdp.waitFor(`document.readyState === 'complete' && Boolean(document.querySelector('[data-demo-target="editor"]'))`);
  await cdp.waitFor(`Object.getOwnPropertyNames(document.querySelector('[data-demo-target="editor"]')).some((key) => key.startsWith('__reactProps'))`);
  await cdp.evaluate(`document.querySelector('[data-work-session-action="history"]').click(); true`);
  await cdp.waitFor(`Boolean(document.querySelector('[data-work-session-history-record]'))`);
  const reloaded = await cdp.evaluate(snapshotExpression());
  assert.equal(reloaded.hasStart, true);
  assert.match(reloaded.historyText, /作業記録/);
  assert.match(reloaded.historyText, /5文字/);
  assert.equal(JSON.parse(reloaded.storage).history[0].writtenCharacterCount, 5);

  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await cdp.waitFor("!document.querySelector('[data-work-session-history]')");
  await cdp.evaluate("document.querySelector('[data-work-session-action=start]').click(); true");
  await cdp.waitFor("document.querySelector('[data-work-session-written-count]')?.getAttribute('data-work-session-written-count') === '0'");
  await cdp.evaluate("document.querySelector('[data-work-session-action=end]').click(); true");
  await cdp.waitFor("Boolean(document.querySelector('[data-work-session-result]'))");
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
    nativeVirtualKeyCode: 27,
  });
  await cdp.waitFor("!document.querySelector('[data-work-session-result]')");
  const afterEscapeClose = await cdp.evaluate(snapshotExpression());
  assert.equal(JSON.parse(afterEscapeClose.storage).history.length, 2);
  assert.equal(JSON.parse(afterEscapeClose.storage).history[1].writtenCharacterCount, 0);

  console.log(`PASS real Editor UX + 11-B browser E2E: ${editorUrl} (single-line/touch syntax help; centered result/history modals desktop+narrow with copy/X and close/Escape; retained history; visible Undo/Redo at +0; type +1 -> delete +0 -> replace +4 -> End/history 5)`);
} catch (error) {
  if (browserOutput) console.error(browserOutput);
  throw error;
} finally {
  if (cdp) {
    try { await cdp.send("Browser.close"); } catch {}
    cdp.close();
  }
  if (browserProcess?.exitCode === null) browserProcess.kill();
  if (nextProcess?.exitCode === null) nextProcess.kill();
  // Chromium can keep profile files locked briefly after Browser.close on
  // Windows. Cleanup is best-effort and must never hide the E2E assertion.
  try {
    rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {}
}
