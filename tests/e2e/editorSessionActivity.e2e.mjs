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
    const activity = document.querySelector('[data-work-session-activity]');
    const result = document.querySelector('[data-work-session-result]');
    const history = document.querySelector('[data-work-session-history]');
    const currentCount = document.querySelector('[title=${JSON.stringify(CURRENT_COUNT_TITLE)}]');
    return {
      editorValue: editor?.value,
      activityText: activity?.textContent.trim(),
      activityValue: activity?.getAttribute('data-work-session-activity'),
      resultText: result?.textContent.replace(/\\s+/g, ' ').trim(),
      historyText: history?.textContent.replace(/\\s+/g, ' ').trim(),
      hasStart: Boolean(document.querySelector('[data-work-session-action="start"]')),
      hasEnd: Boolean(document.querySelector('[data-work-session-action="end"]')),
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
  assert.match(idleBefore.currentCountText, /^\d+ 文字$/);

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
  await cdp.waitFor(`document.querySelector('[data-work-session-activity]')?.getAttribute('data-work-session-activity') === '0'`);
  const started = await cdp.evaluate(snapshotExpression());
  assert.equal(started.hasStart, false);
  assert.equal(started.hasEnd, true);
  assert.match(started.activityText, /今回の編集量 0文字/);
  assert.equal(JSON.parse(started.storage).active.editingActivity, 0);

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
  await cdp.waitFor(`document.querySelector('[data-work-session-activity]')?.getAttribute('data-work-session-activity') === '1'`);
  const active = await cdp.evaluate(snapshotExpression());
  assert.match(active.activityText, /今回の編集量 1文字/);
  assert.equal(JSON.parse(active.storage).active.editingActivity, 1);

  await cdp.evaluate(`document.querySelector('[data-work-session-action="end"]').click(); true`);
  await cdp.waitFor(`Boolean(document.querySelector('[data-work-session-result]'))`);
  const ended = await cdp.evaluate(snapshotExpression());
  const completedState = JSON.parse(ended.storage);
  assert.equal(ended.hasStart, true);
  assert.match(ended.resultText, /今回の編集量\s*1文字/);
  assert.match(ended.resultText, /作業時間/);
  assert.equal(completedState.active, null);
  assert.equal(completedState.history.length, 1);
  assert.equal(completedState.history[0].editingActivity, 1);

  await cdp.evaluate("location.reload(); true");
  await cdp.waitFor(`document.readyState === 'complete' && Boolean(document.querySelector('[data-demo-target="editor"]'))`);
  await cdp.waitFor(`Object.getOwnPropertyNames(document.querySelector('[data-demo-target="editor"]')).some((key) => key.startsWith('__reactProps'))`);
  await cdp.evaluate(`document.querySelector('[data-work-session-action="history"]').click(); true`);
  await cdp.waitFor(`Boolean(document.querySelector('[data-work-session-history-record]'))`);
  const reloaded = await cdp.evaluate(snapshotExpression());
  assert.equal(reloaded.hasStart, true);
  assert.match(reloaded.historyText, /作業記録/);
  assert.match(reloaded.historyText, /1文字/);
  assert.equal(JSON.parse(reloaded.storage).history[0].editingActivity, 1);

  console.log(`PASS real Editor 11-B browser E2E: ${editorUrl} (idle -> Start 0 -> type 1 -> End -> reload history retained)`);
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
