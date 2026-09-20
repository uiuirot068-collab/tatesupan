// Shared plumbing for explicit-run Editor E2Es: target guard, disposable
// Chrome/Edge session over CDP, and Chrome-event based download tracking.
// (productionOddPageWarning.e2e.mjs predates this and keeps its own copy.)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CdpPage, findBrowser, freePort, sleep, waitForJson } from "./cdp.mjs";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** Refuses to run without an explicit base URL; non-loopback hosts also need ALLOW_PRODUCTION=1. */
export function resolveE2eTarget(env, testName) {
  const fail = (message) => {
    console.error(`${testName}: NOT RUN -- ${message}`);
    console.error("Usage: TATESPUN_E2E_BASE_URL=<origin+basePath> [TATESPUN_E2E_ALLOW_PRODUCTION=1] npm run <script>");
    process.exit(2);
  };
  const configured = env.TATESPUN_E2E_BASE_URL?.trim();
  if (!configured) fail("TATESPUN_E2E_BASE_URL is not set (this test never defaults to any deployment).");
  let url;
  try {
    url = new URL(configured);
  } catch {
    fail(`TATESPUN_E2E_BASE_URL is not a valid URL: ${configured}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") fail("TATESPUN_E2E_BASE_URL must be http(s).");
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);
  if (!isLoopback && env.TATESPUN_E2E_ALLOW_PRODUCTION !== "1") {
    fail(`${url.host} is not a loopback host; set TATESPUN_E2E_ALLOW_PRODUCTION=1 to allow a remote/production run.`);
  }
  const basePath = url.pathname.replace(/\/+$/, "");
  return { origin: url.origin, basePath, isLoopback, url: (path) => `${url.origin}${basePath}${path}` };
}

/** Launches a disposable browser; `downloads` is filled from Chrome's own download events. */
export async function launchEditorSession(prefix) {
  const profileDir = mkdtempSync(join(tmpdir(), prefix));
  const downloadDir = join(profileDir, "downloads");
  mkdirSync(downloadDir);
  const debugPort = await freePort();
  const browser = spawn(
    findBrowser(),
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${join(profileDir, "profile")}`,
      "about:blank",
    ],
    { stdio: "ignore", windowsHide: true }
  );
  const downloads = []; // { guid, name, state, filePath }
  const version = await waitForJson(`http://127.0.0.1:${debugPort}/json/version`);
  const browserSession = new CdpPage(version.webSocketDebuggerUrl);
  await browserSession.open();
  browserSession.on("Browser.downloadWillBegin", (p) => {
    downloads.push({ guid: p.guid, name: p.suggestedFilename, state: "inProgress", filePath: null });
  });
  browserSession.on("Browser.downloadProgress", (p) => {
    const entry = downloads.find((d) => d.guid === p.guid);
    if (!entry) return;
    entry.state = p.state;
    if (p.filePath) entry.filePath = p.filePath;
  });
  await browserSession.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir, eventsEnabled: true });

  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Could not open browser target: ${await targetResponse.text()}`);
  const cdp = new CdpPage((await targetResponse.json()).webSocketDebuggerUrl);
  await cdp.open();
  await cdp.send("Runtime.enable");
  await cdp.send("Page.enable");

  return {
    cdp,
    downloads,
    downloadDir,
    /** Explicit viewport (never the headless 764px default). `mobile` follows the Tailwind md breakpoint. */
    async setViewport(width, height) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 768 });
    },
    async close() {
      cdp.close();
      browserSession.close();
      if (browser.pid) {
        if (process.platform === "win32") {
          spawnSync("taskkill", ["/pid", String(browser.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
        } else {
          browser.kill();
        }
      }
      await sleep(300);
      try {
        rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {}
    },
  };
}
