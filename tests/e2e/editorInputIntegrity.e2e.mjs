import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const FIXTURE = "今日は、ゴブリン族の宴に呼ばれて、珍しい酒を振舞ってもらった。";
const EDITOR_SURFACE = process.env.TATESPUN_E2E_EDITOR_SURFACE === "FULL" ? "FULL" : "WINDOWED";

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
    if (process.exitCode !== null) throw new Error(`Next dev exited early.\n${output()}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
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
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function findBrowser() {
  const candidates = [
    process.env.TATESPUN_E2E_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean);
  const browser = candidates.find((candidate) => existsSync(candidate));
  if (!browser) throw new Error("No Chromium browser found");
  return browser;
}

class CdpPage {
  constructor(webSocketUrl) {
    this.socket = new WebSocket(webSocketUrl);
    this.sequence = 0;
    this.pending = new Map();
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
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

  close() {
    this.socket.close();
  }
}

function editorSnapshotExpression() {
  return `(() => { const el = document.querySelector('[data-demo-target="editor"]'); return { value: el?.value, start: el?.selectionStart, end: el?.selectionEnd, surface: el?.dataset.editorSurface ?? 'full' }; })()`;
}

async function setFixture(cdp, start = FIXTURE.length, end = start) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(el, ${JSON.stringify(FIXTURE)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    el.focus();
    el.setSelectionRange(${start}, ${end});
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 80));
}

async function press(cdp, key, code, virtualKeyCode, modifiers = 0, autoRepeat = false) {
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown", key, code, windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode, modifiers, autoRepeat,
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp", key, code, windowsVirtualKeyCode: virtualKeyCode, modifiers,
  });
  await new Promise((resolve) => setTimeout(resolve, 30));
}

async function assertOneDeletion(cdp, key, code, virtualKeyCode, start, expected) {
  await setFixture(cdp, start);
  await press(cdp, key, code, virtualKeyCode);
  const snapshot = await cdp.evaluate(editorSnapshotExpression());
  assert.equal(snapshot.value, expected);
  assert.equal(snapshot.start, key === "Backspace" ? start - 1 : start);
  assert.equal(snapshot.end, snapshot.start);
}

const profileDir = mkdtempSync(join(tmpdir(), "tatespun-input-integrity-"));
let nextProcess;
let browserProcess;
let cdp;
let nextOutput = "";
let browserOutput = "";

try {
  const appPort = await freePort();
  const debugPort = await freePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const nextBin = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url));
  nextProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(appPort)], {
    cwd: ROOT,
    env: { ...process.env, NEXT_PUBLIC_TATESPUN_EDITOR_SURFACE: EDITOR_SURFACE },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  nextProcess.stdout.on("data", (chunk) => { nextOutput += chunk; });
  nextProcess.stderr.on("data", (chunk) => { nextOutput += chunk; });
  await waitForPage(`${baseUrl}/editor?demo=1`, nextProcess, () => nextOutput);

  browserProcess = spawn(findBrowser(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run",
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`, "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  browserProcess.stderr.on("data", (chunk) => { browserOutput += chunk; });
  const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  assert.match(version.Browser, /(Chrome|Chromium|Edg)\//);
  const targetResponse = await fetch(
    `http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`${baseUrl}/editor?demo=1`)}`,
    { method: "PUT" }
  );
  if (!targetResponse.ok) throw new Error(`Could not open browser target: ${await targetResponse.text()}`);
  const target = await targetResponse.json();
  cdp = new CdpPage(target.webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");

  async function navigate(path) {
    await cdp.send("Page.navigate", { url: `${baseUrl}${path}` });
    await cdp.waitFor(`document.querySelector('[data-demo-target="editor"]')?.value !== undefined`);
    await cdp.waitFor(
      EDITOR_SURFACE === "WINDOWED"
        ? `document.querySelector('[data-demo-target="editor"]')?.dataset.editorSurface === 'paged'`
        : `Boolean(document.querySelector('[data-demo-target="editor"]')) && !document.querySelector('[data-demo-target="editor"]')?.dataset.editorSurface`
    );
    await cdp.waitFor(`document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved'`);
  }

  await navigate("/editor?demo=1");

  // 1–5: end/middle Backspace, middle Delete, and exact selected ranges.
  await assertOneDeletion(cdp, "Backspace", "Backspace", 8, FIXTURE.length, FIXTURE.slice(0, -1));
  await assertOneDeletion(cdp, "Backspace", "Backspace", 8, 10, FIXTURE.slice(0, 9) + FIXTURE.slice(10));
  await assertOneDeletion(cdp, "Delete", "Delete", 46, 10, FIXTURE.slice(0, 10) + FIXTURE.slice(11));
  for (const [start, end] of [[4, 5], [4, 12]]) {
    await setFixture(cdp, start, end);
    await press(cdp, "Backspace", "Backspace", 8);
    const snapshot = await cdp.evaluate(editorSnapshotExpression());
    assert.equal(snapshot.value, FIXTURE.slice(0, start) + FIXTURE.slice(end));
  }

  // Exact reported corruption: one collapsed delete event must not promote a
  // 28-character DOM collapse into canonical source.
  await setFixture(cdp);
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    el.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward' }));
    setter.call(el, ${JSON.stringify(FIXTURE.slice(0, 3))});
    el.setSelectionRange(3, 3);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  let snapshot = await cdp.evaluate(editorSnapshotExpression());
  assert.equal(snapshot.value, FIXTURE.slice(0, -1));
  assert.equal(snapshot.start, FIXTURE.length - 1);

  // 6–7: composition owns its intermediate edits; after commit, Backspace is
  // still one transaction and the source remains usable.
  await setFixture(cdp);
  await cdp.send("Input.imeSetComposition", {
    text: "あ", selectionStart: 1, selectionEnd: 1,
    replacementStart: FIXTURE.length, replacementEnd: FIXTURE.length,
  });
  await cdp.send("Input.insertText", { text: "あ" });
  await new Promise((resolve) => setTimeout(resolve, 100));
  snapshot = await cdp.evaluate(editorSnapshotExpression());
  assert.equal(snapshot.value.length, FIXTURE.length + 1);
  await press(cdp, "Backspace", "Backspace", 8);
  snapshot = await cdp.evaluate(editorSnapshotExpression());
  assert.equal(snapshot.value, FIXTURE);

  // 8: every legitimate repeat event deletes exactly its own next character.
  await setFixture(cdp);
  for (let index = 0; index < 5; index += 1) {
    await press(cdp, "Backspace", "Backspace", 8, 0, index > 0);
  }
  snapshot = await cdp.evaluate(editorSnapshotExpression());
  assert.equal(snapshot.value, FIXTURE.slice(0, -5));

  // 9: application-level paged Undo/Redo remains intact after deletion.
  await setFixture(cdp);
  await press(cdp, "Backspace", "Backspace", 8);
  await press(cdp, "z", "KeyZ", 90, 2);
  assert.equal((await cdp.evaluate(editorSnapshotExpression())).value, FIXTURE);
  await press(cdp, "y", "KeyY", 89, 2);
  assert.equal((await cdp.evaluate(editorSnapshotExpression())).value, FIXTURE.slice(0, -1));

  // 10: Preview open/closed does not alter the input contract.
  await cdp.evaluate(`document.querySelector('[data-preview-collapse-toggle]')?.click()`);
  await cdp.waitFor(`Boolean(document.querySelector('[data-preview-collapsed-toggle]'))`);
  await assertOneDeletion(cdp, "Backspace", "Backspace", 8, FIXTURE.length, FIXTURE.slice(0, -1));
  await cdp.evaluate(`document.querySelector('[data-preview-collapsed-toggle]')?.click()`);

  // The same real Editor component is used by Demo, Guide, and normal local
  // projects. Exercise the corruption transaction on all three routes.
  for (const route of ["/editor?demo=1", "/editor?id=-1", "/editor"]) {
    await navigate(route);
    await assertOneDeletion(cdp, "Backspace", "Backspace", 8, FIXTURE.length, FIXTURE.slice(0, -1));
  }

  console.log(`editor input integrity E2E: PASS (${EDITOR_SURFACE}; 10-case matrix + Demo/Guide/normal parity)`);
} finally {
  cdp?.close();
  browserProcess?.kill();
  if (nextProcess?.pid) {
    if (process.platform === "win32") {
      spawnSync("taskkill", ["/pid", String(nextProcess.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } else {
      nextProcess.kill();
    }
  }
  try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
  if (nextProcess?.exitCode && nextProcess.exitCode !== 0) console.error(nextOutput);
  if (browserProcess?.exitCode && browserProcess.exitCode !== 0) console.error(browserOutput);
}
