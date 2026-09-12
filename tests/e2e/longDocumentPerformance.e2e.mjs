import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { makeLongDocumentFixture } from "../performance/longDocumentFixtures.ts";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const QUIET_MS = 600;

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

async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}`);
}

async function waitForPage(url, process, log, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    if (process && process.exitCode !== null) throw new Error(`Next dev exited early.\n${log()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${String(lastError)}\n${log()}`);
}

function findBrowser() {
  const candidates = [
    process.env.TATESPUN_E2E_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean);
  const browser = candidates.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error("No Chrome/Edge browser found.");
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
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }

  async waitFor(expression, timeoutMs = 60_000) {
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

function updateExpression(content, expectedPages, minimumWaitMs) {
  return `(() => {
    const content = ${JSON.stringify(content)};
    const editor = document.querySelector('[data-demo-target="editor"]');
    const root = document.querySelector('[data-export-scale-root="true"]');
    if (!(editor instanceof HTMLTextAreaElement) || !root) throw new Error('Editor/preview unavailable');
    const longTasks = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    try { observer.observe({ type: 'longtask' }); } catch {}
    let lastMutation = performance.now();
    const mutations = new MutationObserver(() => { lastMutation = performance.now(); });
    mutations.observe(root, { childList: true, subtree: true, characterData: true });
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    const reactPropsKey = Object.getOwnPropertyNames(editor).find((key) => key.startsWith('__reactProps'));
    const onChange = reactPropsKey ? editor[reactPropsKey]?.onChange : undefined;
    if (typeof onChange !== 'function') throw new Error('React textarea onChange unavailable');
    const started = performance.now();
    setter.call(editor, content);
    onChange({ target: editor, currentTarget: editor });
    const dispatchMs = performance.now() - started;
    return new Promise((resolve, reject) => {
      const deadline = performance.now() + 120000;
      const poll = () => {
        const cards = root.querySelectorAll('[data-page-card="true"]').length;
        const v2Pages = root.querySelectorAll('[data-v2-preview-root] .page').length;
        const now = performance.now();
        if (cards === ${expectedPages} && cards === v2Pages && now - started >= ${minimumWaitMs} && now - lastMutation >= ${QUIET_MS}) {
          mutations.disconnect();
          observer.disconnect();
          resolve({
            totalMs: now - started,
            dispatchMs,
            pages: cards,
            v2Pages,
            previewElements: root.querySelectorAll('*').length,
            longTaskCount: longTasks.length,
            longTaskTotalMs: longTasks.reduce((sum, value) => sum + value, 0),
            maxLongTaskMs: Math.max(0, ...longTasks),
          });
          return;
        }
        if (now >= deadline) {
          mutations.disconnect();
          observer.disconnect();
          reject(new Error('Preview did not settle within 120s (cards=' + cards + ', v2Pages=' + v2Pages + ', expected=${expectedPages}, editorLength=' + editor.value.length + ')'));
          return;
        }
        setTimeout(poll, 50);
      };
      poll();
    });
  })()`;
}

function zoomExpression() {
  return `(() => {
    const buttons = [...document.querySelectorAll('button')];
    const reset = buttons.find((button) => button.textContent.trim() === '100%');
    const plus = buttons.find((button) => button.textContent.trim() === '＋');
    if (!reset || !plus) throw new Error('Zoom controls unavailable');
    const started = performance.now();
    reset.click();
    plus.click();
    plus.click();
    plus.click();
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - started))));
  })()`;
}

let nextProcess;
let browserProcess;
let cdp;
let nextOutput = "";
let browserOutput = "";
const profileDir = mkdtempSync(join(tmpdir(), "tatespun-longdoc-e2e-"));

try {
  let baseUrl = process.env.TATESPUN_E2E_BASE_URL;
  if (!baseUrl) {
    const appPort = await freePort();
    baseUrl = `http://127.0.0.1:${appPort}`;
    const nextBin = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url));
    nextProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(appPort)], {
      cwd: ROOT,
      env: { ...process.env, NEXT_PUBLIC_TATESPUN_RENDERER: "V2_BETA" },
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
  if (!targetResponse.ok) throw new Error(`Could not open browser target: ${await targetResponse.text()}`);
  const target = await targetResponse.json();
  cdp = new CdpPage(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  await cdp.send("Performance.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp.waitFor(`document.readyState === 'complete' && Boolean(document.querySelector('[data-demo-target="editor"]'))`);
  await cdp.waitFor(`Object.getOwnPropertyNames(document.querySelector('[data-demo-target="editor"]')).some((key) => key.startsWith('__reactProps'))`);
  await cdp.waitFor(`Boolean(document.querySelector('[data-export-scale-root="true"]'))`);

  const results = [];
  const expectedPageCounts = new Map([[10_000, 18], [30_000, 54], [50_000, 90], [100_000, 179]]);
  const requestedSizes = (process.env.TATESPUN_PERF_SIZES ?? "10000,30000,50000,100000")
    .split(",")
    .map(Number);
  for (const size of requestedSizes) {
    const expectedPages = expectedPageCounts.get(size);
    const load = await cdp.evaluate(updateExpression(makeLongDocumentFixture(size), expectedPages, 1_000));
    const zoomMs = await cdp.evaluate(zoomExpression());
    const edit = await cdp.evaluate(updateExpression(`${makeLongDocumentFixture(size)}追`, expectedPages, 3_500));
    const metrics = await cdp.send("Performance.getMetrics");
    const heap = metrics.metrics.find((metric) => metric.name === "JSHeapUsedSize")?.value;
    results.push({ size, load, edit, zoomMs, jsHeapUsedMb: heap ? heap / 1024 / 1024 : undefined });
    console.log(`TATESPUN_BROWSER_PERF ${JSON.stringify(results.at(-1))}`);
  }
} catch (error) {
  console.error(error);
  if (nextOutput) console.error(`NEXT LOG\n${nextOutput.slice(-4000)}`);
  if (browserOutput) console.error(`BROWSER LOG\n${browserOutput.slice(-2000)}`);
  process.exitCode = 1;
} finally {
  cdp?.close();
  const processes = [browserProcess, nextProcess].filter((process) => process && process.exitCode === null);
  for (const process of processes) process.kill();
  await Promise.all(processes.map((process) => new Promise((resolve) => {
    process.once("exit", resolve);
    setTimeout(resolve, 5_000);
  })));
  rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
