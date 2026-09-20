// Small shared Chrome/Edge DevTools-Protocol helpers for explicit-run E2Es.
// Extracted from the pattern duplicated in editorInputIntegrity.e2e.mjs /
// editorSessionActivity.e2e.mjs; only the production smoke test imports it
// today (the existing E2Es are intentionally left untouched).
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer } from "node:net";

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object");
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

export function findBrowser() {
  const candidates = [
    process.env.TATESPUN_E2E_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);
  const browser = candidates.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error("No Chromium browser found. Set TATESPUN_E2E_BROWSER to Chrome/Edge/Chromium.");
  return browser;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForJson(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {}
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

export class CdpPage {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.sequence = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.method) {
        for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
        return;
      }
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
  }

  async open() {
    if (this.socket.readyState === WebSocket.OPEN) return;
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
  }

  /** Subscribes to a CDP event (e.g. "Browser.downloadWillBegin"). */
  on(method, listener) {
    const list = this.listeners.get(method) ?? [];
    list.push(listener);
    this.listeners.set(method, list);
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
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Browser evaluation failed: ${detail}`);
    }
    return result.result.value;
  }

  /** Polls a browser-side expression until truthy; returns its value, or throws with `label`. */
  async waitFor(expression, { timeoutMs = 30_000, label = expression } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = await this.evaluate(expression);
      if (value) return value;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for: ${label}`);
  }

  close() {
    this.socket.close();
  }
}
