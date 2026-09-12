import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));

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

async function waitForJson(url, timeoutMs = 60_000) {
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
    const response = await this.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "Browser evaluation failed");
    return response.result.value;
  }
  async waitFor(expression, timeoutMs = 45_000) {
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
const profile = mkdtempSync(join(tmpdir(), "tatespun-image-placement-"));

try {
  const appPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const nextBin = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url));
  nextProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(appPort)], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  nextProcess.stdout.on("data", (chunk) => { nextOutput += chunk; });
  nextProcess.stderr.on("data", (chunk) => { nextOutput += chunk; });
  const pageDeadline = Date.now() + 60_000;
  while (Date.now() < pageDeadline) {
    if (nextProcess.exitCode !== null) throw new Error(`Next dev exited.\n${nextOutput}`);
    try { if ((await fetch(baseUrl)).ok) break; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  const debugPort = await freePort();
  browserProcess = spawn(browserPath(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--window-size=1440,1200",
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const target = await (await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(baseUrl)}`, { method: "PUT" })).json();
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  await cdp.waitFor("document.readyState === 'complete' && Boolean(document.querySelector('[data-bookshelf-page]'))");
  await cdp.waitFor("Boolean(document.querySelector('[data-home-onboarding-actions] button, [data-home-returning-actions] button'))");
  await cdp.evaluate("document.querySelector('[data-home-onboarding-actions] button, [data-home-returning-actions] button').click(); true");
  await cdp.waitFor("location.pathname.endsWith('/editor') && Boolean(document.querySelector('[data-editor-shell]'))");
  await cdp.waitFor("Boolean(document.querySelector('button[aria-label$=\"ページの操作メニュー\"]'))");

  await cdp.evaluate(`(() => {
    document.querySelector('button[aria-label$="ページの操作メニュー"]').click();
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c82828';
    ctx.fillRect(0, 0, 600, 900);
    return new Promise((resolve) => canvas.toBlob((blob) => {
      const input = document.querySelector('input[type="file"][accept*="image"]');
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'qa-portrait.png', { type: 'image/png' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      resolve(true);
    }, 'image/png'));
  })()`);
  await cdp.waitFor("document.querySelector('textarea')?.value.includes('【IMG:') && Boolean(document.querySelector('[data-page-card=true] img'))");

  const insertedToken = await cdp.evaluate("document.querySelector('textarea').value.match(/【IMG:[^】]+】/)[0]");
  assert.match(insertedToken, /:center】$/);
  const dimensions = insertedToken.match(/:([0-9.]+):([0-9.]+):center】$/);
  assert(dimensions);
  assert(Number(dimensions[1]) > 40 && Number(dimensions[2]) > 60);

  await cdp.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '地側（下部）').click(); true`);
  await cdp.waitFor("document.querySelector('textarea')?.value.includes(':bottom】')");
  const bottom = await cdp.evaluate(`(() => {
    const imageElement = document.querySelector('[data-page-card=true] img');
    const pageRect = imageElement.closest('[data-page-card=true]').getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();
    const page = { left: pageRect.left, top: pageRect.top, right: pageRect.right, bottom: pageRect.bottom, width: pageRect.width, height: pageRect.height };
    const image = { left: imageRect.left, top: imageRect.top, right: imageRect.right, bottom: imageRect.bottom, width: imageRect.width, height: imageRect.height };
    return { token: document.querySelector('textarea').value.match(/【IMG:[^】]+】/)[0], page, image, gap: page.bottom - image.bottom };
  })()`);
  assert.match(bottom.token, /:bottom】$/);
  assert(bottom.image.width > bottom.page.width * 0.35);
  assert(Math.abs(bottom.gap) < 3);

  await cdp.evaluate(`[...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '全面（ページを覆う）').click(); true`);
  await cdp.waitFor("document.querySelector('textarea')?.value.includes(':full】') && document.querySelector('[data-page-card=true] img')?.style.objectFit === 'cover'");
  const full = await cdp.evaluate(`(() => {
    const imageElement = document.querySelector('[data-page-card=true] img');
    const pageRect = imageElement.closest('[data-page-card=true]').getBoundingClientRect();
    const imageRect = imageElement.getBoundingClientRect();
    const page = { left: pageRect.left, top: pageRect.top, right: pageRect.right, bottom: pageRect.bottom, width: pageRect.width, height: pageRect.height };
    const image = { left: imageRect.left, top: imageRect.top, right: imageRect.right, bottom: imageRect.bottom, width: imageRect.width, height: imageRect.height };
    return { token: document.querySelector('textarea').value.match(/【IMG:[^】]+】/)[0], page, image };
  })()`);
  assert.match(full.token, /:full】$/);
  assert(Math.abs(full.image.width - full.page.width) < 3);
  assert(Math.abs(full.image.height - full.page.height) < 3);
  assert(Math.abs(full.image.left - full.page.left) < 3);
  assert(Math.abs(full.image.top - full.page.top) < 3);

  console.log(JSON.stringify({ insertedToken, bottom, full }, null, 2));
  console.log("PASS actual editor image insertion, placement serialization, bottom anchoring, and full-page cover");
} finally {
  try { await cdp?.send("Browser.close"); } catch {}
  if (browserProcess?.exitCode === null) browserProcess.kill();
  if (nextProcess?.exitCode === null) nextProcess.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
