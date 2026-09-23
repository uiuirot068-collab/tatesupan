import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const STORAGE_PREFIX = "tatespun:work-sessions:v1:";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      server.close((error) => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForPage(url, process, output, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (process && process.exitCode !== null) throw new Error(`Next dev exited.\n${output()}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}.\n${output()}`);
}

async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function browserPath() {
  const candidates = [
    process.env.TATESPUN_E2E_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  const browser = candidates.find(existsSync);
  if (!browser) throw new Error("No Chromium browser found");
  return browser;
}

class Cdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
    });
  }
  open() {
    return new Promise((resolve, reject) => {
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
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
    return result.result.value;
  }
  async waitFor(expression, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.evaluate(expression)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Timed out waiting for: ${expression}`);
  }
}

let nextProcess;
let browserProcess;
let cdp;
let nextOutput = "";
const profile = mkdtempSync(join(tmpdir(), "tatespun-session-isolation-"));

try {
  let baseUrl;
  const configuredBaseUrl = process.env.TATESPUN_E2E_BASE_URL?.trim();

  if (configuredBaseUrl) {
    const configured = new URL(configuredBaseUrl);
    const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);
    assert.ok(loopback.has(configured.hostname), `workSessionIsolation refuses non-loopback base URL: ${configured.host}`);
    const basePath = configured.pathname.replace(/\/+$/, "");
    baseUrl = `${configured.origin}${basePath}`;
    await waitForPage(baseUrl, null, () => "");
    console.log(`INFO workSessionIsolation: reusing explicit loopback server ${baseUrl}`);
  } else {
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
    await waitForPage(baseUrl, nextProcess, () => nextOutput);
    console.log(`INFO workSessionIsolation: started dedicated dev server ${baseUrl}`);
  }

  const debugPort = await freePort();
  browserProcess = spawn(browserPath(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run",
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const target = await (await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`,
    { method: "PUT" },
  )).json();
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  await cdp.waitFor("document.readyState === 'complete' && Boolean(document.querySelector('[data-bookshelf-page]'))");

  // The browser profile is new, but the test deliberately seeds persisted
  // work-session data below. Do not clear localStorage: old browser data is
  // the regression precondition that the former E2E omitted.
  await cdp.waitFor("Boolean(document.querySelector('[data-home-onboarding-actions]'))");
  await cdp.evaluate(`document.querySelector('[data-home-onboarding-actions] button').click(); true`);
  await cdp.waitFor("location.pathname.endsWith('/editor') && new URLSearchParams(location.search).has('id')");
  const oldDocument = await cdp.evaluate("new URLSearchParams(location.search).get('id')");
  const oldKey = `${STORAGE_PREFIX}${encodeURIComponent(`local:${oldDocument}`)}`;
  const oldState = {
    active: null,
    history: Array.from({ length: 4 }, (_, index) => ({
      id: `old-session-${index + 1}`,
      startedAt: 1_000 + index * 2_000,
      endedAt: 2_000 + index * 2_000,
      durationMs: 1_000,
      writtenCharacterCount: index + 1,
    })),
  };
  await cdp.evaluate(`(() => {
    localStorage.setItem(${JSON.stringify(oldKey)}, ${JSON.stringify(JSON.stringify(oldState))});
    localStorage.setItem('tatespun:work-sessions:v1', ${JSON.stringify(JSON.stringify(oldState))});
    location.reload();
    return true;
  })()`);
  await cdp.waitFor("document.querySelector('[data-work-session-action=\"history\"]')?.textContent.includes('4')");
  await cdp.evaluate("document.querySelector('[data-work-session-action=\"history\"]').click(); true");
  await cdp.waitFor("document.querySelectorAll('[data-work-session-history-record]').length === 4");

  await cdp.evaluate(`location.href = ${JSON.stringify(baseUrl)}; true`);
  await cdp.waitFor("document.readyState === 'complete' && Boolean(document.querySelector('[data-bookshelf-page]'))");
  await cdp.waitFor("Boolean(document.querySelector('[data-home-returning-actions] button'))");

  // Simulate browser data left by a previously deleted document whose
  // timestamp identity can be reused (for example after the device clock is
  // moved backwards). The real create button must claim a clean namespace.
  const newDocument = String(Number(oldDocument) + 10_000);
  const newKey = `${STORAGE_PREFIX}${encodeURIComponent(`local:${newDocument}`)}`;
  await cdp.evaluate(`(() => {
    localStorage.setItem(${JSON.stringify(newKey)}, ${JSON.stringify(JSON.stringify(oldState))});
    Date.now = () => ${JSON.stringify(Number(newDocument))};
    document.querySelector('[data-home-returning-actions] button').click();
    return true;
  })()`);
  await cdp.waitFor(`location.pathname.endsWith('/editor') && new URLSearchParams(location.search).get('id') === ${JSON.stringify(newDocument)}`);
  await cdp.waitFor("document.querySelector('[data-editor-shell]')?.getAttribute('data-editor-save-status') === 'saved'");
  const initialNew = await cdp.evaluate(`(() => {
    const state = JSON.parse(localStorage.getItem(${JSON.stringify(newKey)}));
    return {
      historyCount: state?.history?.length ?? 0,
      durationMs: (state?.history ?? []).reduce((sum, record) => sum + record.durationMs, 0),
      active: state?.active ?? null,
    };
  })()`);
  assert.deepEqual(initialNew, { historyCount: 0, durationMs: 0, active: null });

  // A full reload restores the native clock. NEW must persist only its own
  // first completed session.
  await cdp.evaluate("location.reload(); true");
  await cdp.waitFor("document.querySelector('[data-editor-shell]')?.getAttribute('data-editor-save-status') === 'saved'");
  await cdp.evaluate("document.querySelector('[data-work-session-action=\"start\"]').click(); true");
  await cdp.waitFor("Boolean(document.querySelector('[data-work-session-action=\"end\"]'))");
  await cdp.evaluate("document.querySelector('[data-work-session-action=\"end\"]').click(); true");
  await cdp.waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(newKey)})).history.length === 1`);
  await cdp.evaluate("location.reload(); true");
  await cdp.waitFor("document.querySelector('[data-work-session-action=\"history\"]')?.textContent.includes('1')");
  await cdp.evaluate("document.querySelector('[data-work-session-action=\"history\"]').click(); true");
  await cdp.waitFor("document.querySelectorAll('[data-work-session-history-record]').length === 1");

  // OLD remains intact while it exists.
  await cdp.evaluate(`location.href = ${JSON.stringify(`${baseUrl}/editor?id=`)} + ${JSON.stringify(oldDocument)}; true`);
  await cdp.waitFor("document.querySelector('[data-editor-shell]')?.getAttribute('data-editor-save-status') === 'saved' && document.querySelector('[data-work-session-action=\"history\"]')?.textContent.includes('4')");
  await cdp.evaluate("document.querySelector('[data-work-session-action=\"history\"]').click(); true");
  await cdp.waitFor("document.querySelectorAll('[data-work-session-history-record]').length === 4");
  const preservedOld = await cdp.evaluate(`JSON.parse(localStorage.getItem(${JSON.stringify(oldKey)})).history.length`);
  assert.equal(preservedOld, 4);

  // Delete OLD through the bookshelf UI, then deliberately reuse OLD's id.
  // The newly-created document must still start empty without erasing NEW.
  await cdp.evaluate(`location.href = ${JSON.stringify(baseUrl)}; true`);
  await cdp.waitFor("document.readyState === 'complete' && Boolean(document.querySelector('[data-home-returning-actions]'))");
  await cdp.waitFor("document.querySelectorAll('button[aria-haspopup=\"dialog\"]') .length >= 2");
  await cdp.evaluate(`(() => {
    const menus = [...document.querySelectorAll('button[aria-haspopup="dialog"]')]
      .filter((button) => button.title === '作品メニュー');
    menus.at(-1).click();
    return true;
  })()`);
  await cdp.waitFor("Boolean(document.querySelector('[role=\"dialog\"]'))");
  await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('[role="dialog"] button')]
      .find((candidate) => candidate.textContent.trim() === '削除');
    button.click(); return true;
  })()`);
  await cdp.waitFor("[...document.querySelectorAll('button')].some((button) => button.textContent.trim() === '削除する')");
  await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('button')]
      .find((candidate) => candidate.textContent.trim() === '削除する');
    button.click(); return true;
  })()`);
  await cdp.waitFor("Boolean(document.querySelector('[data-home-returning-actions] button'))");
  await cdp.evaluate(`(() => {
    Date.now = () => ${JSON.stringify(Number(oldDocument))};
    document.querySelector('[data-home-returning-actions] button').click();
    return true;
  })()`);
  await cdp.waitFor(`location.pathname.endsWith('/editor') && new URLSearchParams(location.search).get('id') === ${JSON.stringify(oldDocument)}`);
  await cdp.waitFor("document.querySelector('[data-editor-shell]')?.getAttribute('data-editor-save-status') === 'saved'");
  const recreated = await cdp.evaluate(`(() => {
    const old = JSON.parse(localStorage.getItem(${JSON.stringify(oldKey)}));
    const own = JSON.parse(localStorage.getItem(${JSON.stringify(newKey)}));
    return { oldHistory: old?.history?.length ?? 0, newHistory: own?.history?.length ?? 0 };
  })()`);
  assert.deepEqual(recreated, { oldHistory: 0, newHistory: 1 });
  console.log(`PASS persisted history isolation: OLD=${oldDocument}, NEW=${newDocument}`);
} finally {
  try { await cdp?.send("Browser.close"); } catch {}
  if (browserProcess?.exitCode === null) browserProcess.kill();
  if (nextProcess?.exitCode === null) nextProcess.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
