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
    if (process.exitCode !== null) throw new Error(`Next dev exited.\n${output()}`);
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
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const nextBin = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url));
  nextProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(appPort)], {
    cwd: ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  nextProcess.stdout.on("data", (chunk) => { nextOutput += chunk; });
  nextProcess.stderr.on("data", (chunk) => { nextOutput += chunk; });
  await waitForPage(baseUrl, nextProcess, () => nextOutput);

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

  await cdp.evaluate(`new Promise((resolve) => {
    localStorage.clear();
    const request = indexedDB.deleteDatabase('tategaki-editor-db');
    request.onsuccess = request.onerror = request.onblocked = () => resolve(true);
  }).then(() => { location.reload(); return true; })`);
  await cdp.waitFor("document.readyState === 'complete' && Boolean(document.querySelector('[data-home-onboarding-actions]'))");
  await cdp.evaluate(`document.querySelector('[data-home-onboarding-actions] button').click(); true`);
  await cdp.waitFor("location.pathname.endsWith('/editor') && new URLSearchParams(location.search).has('id')");
  const documentA = await cdp.evaluate("new URLSearchParams(location.search).get('id')");
  const keyA = `${STORAGE_PREFIX}${encodeURIComponent(`local:${documentA}`)}`;

  await cdp.waitFor("Boolean(document.querySelector('[data-work-session-action=\"start\"]'))");
  await cdp.evaluate("document.querySelector('[data-work-session-action=\"start\"]').click(); true");
  await cdp.waitFor("Boolean(document.querySelector('[data-work-session-action=\"end\"]'))");
  await cdp.evaluate(`(() => {
    const editor = document.querySelector('[data-demo-target="editor"]');
    editor.focus();
    editor.setSelectionRange(editor.value.length, editor.value.length);
    return true;
  })()`);
  await cdp.send("Input.insertText", { text: "甲" });
  await cdp.waitFor("document.querySelector('[data-work-session-written-count]')?.getAttribute('data-work-session-written-count') === '1'");
  await cdp.evaluate("document.querySelector('[data-work-session-action=\"end\"]').click(); true");
  await cdp.waitFor(`JSON.parse(localStorage.getItem(${JSON.stringify(keyA)})).history.length === 1`);

  await cdp.evaluate(`location.href = ${JSON.stringify(baseUrl)}; true`);
  await cdp.waitFor("document.readyState === 'complete' && Boolean(document.querySelector('[data-bookshelf-page]'))");
  await cdp.waitFor("[...document.querySelectorAll('button[aria-label$=\"の作品メニュー\"]')].some((button) => !button.getAttribute('aria-label').includes('使い方ガイド'))");
  await cdp.evaluate(`(() => {
    const button = [...document.querySelectorAll('button[aria-label$="の作品メニュー"]')]
      .find((candidate) => !candidate.getAttribute('aria-label').includes('使い方ガイド'));
    button.click(); return true;
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
  await cdp.waitFor("![...document.querySelectorAll('button[aria-label$=\"の作品メニュー\"]')].some((button) => !button.getAttribute('aria-label').includes('使い方ガイド'))");
  await cdp.waitFor("Boolean(document.querySelector('[data-home-onboarding-actions]'))");
  await cdp.evaluate("document.querySelector('[data-home-onboarding-actions] button').click(); true");
  await cdp.waitFor(`location.pathname.endsWith('/editor') && new URLSearchParams(location.search).get('id') !== ${JSON.stringify(documentA)}`);

  const result = await cdp.evaluate(`(() => {
    const documentB = new URLSearchParams(location.search).get('id');
    const keyB = ${JSON.stringify(STORAGE_PREFIX)} + encodeURIComponent('local:' + documentB);
    return {
      documentB,
      keyAExists: localStorage.getItem(${JSON.stringify(keyA)}) !== null,
      keyBValue: localStorage.getItem(keyB),
      canStart: Boolean(document.querySelector('[data-work-session-action="start"]')),
      hasActive: Boolean(document.querySelector('[data-work-session-action="end"]')),
      elapsed: document.querySelector('[data-work-session-elapsed]')?.textContent.trim(),
    };
  })()`);
  assert.notEqual(result.documentB, documentA);
  assert.equal(result.keyAExists, true); // deletion does not clear unrelated/global data
  assert.equal(result.keyBValue, null);
  assert.equal(result.canStart, true);
  assert.equal(result.hasActive, false);
  assert.equal(result.elapsed, undefined);
  console.log(`PASS document delete -> new document work-session isolation: A=${documentA}, B=${result.documentB}`);
} finally {
  try { await cdp?.send("Browser.close"); } catch {}
  if (browserProcess?.exitCode === null) browserProcess.kill();
  if (nextProcess?.exitCode === null) nextProcess.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
