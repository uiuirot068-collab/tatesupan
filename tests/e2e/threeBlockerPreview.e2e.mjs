import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createServer } from "node:net";

const ARTIFACT_DIR = process.env.TATESPUN_THREE_BLOCKER_ARTIFACT_DIR
  ?? "C:\\tmp\\tatespun-three-blocker-qa";
const HTML_PATH = resolve(ARTIFACT_DIR, "tatespun-three-blocker-preview.html");
const OUTPUT_PATH = resolve(ARTIFACT_DIR, "tatespun-three-blocker-preview.png");
assert.ok(existsSync(HTML_PATH), `Missing Preview artifact: ${HTML_PATH}`);

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      server.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function browserPath() {
  const browser = [
    process.env.TATESPUN_E2E_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean).find(existsSync);
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
    return new Promise((resolveOpen, reject) => {
      this.socket.addEventListener("open", resolveOpen, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }
  send(method, params = {}) {
    return new Promise((resolveSend, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, { resolve: resolveSend, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", { expression, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
    return result.result.value;
  }
}

let browserProcess;
let cdp;
const profile = mkdtempSync(join(tmpdir(), "tatespun-preview-artifact-"));
try {
  const debugPort = await freePort();
  browserProcess = spawn(browserPath(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files",
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const target = await (await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(pathToFileURL(HTML_PATH).href)}`,
    { method: "PUT" },
  )).json();
  cdp = new Cdp(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  const geometry = await cdp.evaluate(`(() => {
    const rect = (element) => { const value = element.getBoundingClientRect(); return { left: value.left, right: value.right, top: value.top, bottom: value.bottom, width: value.width, height: value.height }; };
    const rubyBaseText = (unit) => [...unit.querySelector('.unit-ink').childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent)
      .join('');
    const rubies = [...document.querySelectorAll('.unit.kind-RUBY')].map((unit) => ({ base: rubyBaseText(unit), reading: unit.querySelector('.ruby-annotation')?.textContent, unit: rect(unit), annotation: rect(unit.querySelector('.ruby-annotation')) }));
    const latin = [...document.querySelectorAll('.unit.kind-TEXT')].filter((unit) => /^[A-Za-z ]$/.test(unit.querySelector('.unit-ink')?.textContent ?? '')).map((unit) => ({ text: unit.querySelector('.unit-ink').textContent, orientation: getComputedStyle(unit).textOrientation }));
    const explicitTcy = [...document.querySelectorAll('.unit.kind-TCY')].map((unit) => unit.textContent.trim());
    return { rubies, latin, explicitTcy };
  })()`);
  assert.deepEqual(geometry.rubies.map((ruby) => ruby.base), ["髑髏", "聯想"]);
  assert.deepEqual(geometry.rubies.map((ruby) => ruby.reading), ["もぐらもち", "れんそう"]);
  for (const ruby of geometry.rubies) {
    assert.ok(ruby.annotation.left > ruby.unit.left + ruby.unit.width / 2);
    assert.ok(ruby.annotation.left < ruby.unit.right);
  }
  const latinText = geometry.latin.map((entry) => entry.text).join("");
  assert.ok(latinText.includes("Mole"));
  assert.ok(latinText.includes(" la mort "));
  assert.ok(geometry.latin.every((entry) => entry.orientation === "upright"));
  assert.ok(geometry.explicitTcy.some((text) => text.includes("Mole")));
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(OUTPUT_PATH, Buffer.from(screenshot.data, "base64"));
  console.log(JSON.stringify({ html: HTML_PATH, screenshot: OUTPUT_PATH, geometry }, null, 2));
} finally {
  try { await cdp?.send("Browser.close"); } catch {}
  if (browserProcess?.exitCode === null) browserProcess.kill();
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
