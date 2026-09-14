import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { decode } from "fast-png";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const EXPECTED_RUBY_LANE_CENTER_EM = 0.69;
const CENTERING_SAMPLES = [
  { baseText: "親文字", readingText: "よみ", line: "あああ｜親文字《よみ》いいいいいい", policy: "CENTER" },
  { baseText: "残響", readingText: "ざんきょうきょう", line: "あああ｜残響《ざんきょうきょう》いいいいいい", policy: "CENTER" },
  { baseText: "曇天", readingText: "どんてんてん", line: "あああ｜曇天《どんてんてん》いいいいいい", policy: "CENTER" },
];
const DISTANCE_SAMPLES = [
  { baseText: "髑髏", readingText: "もぐらもち", policy: "CENTER" },
  { baseText: "聯想", readingText: "れんそう", policy: "CENTER" },
];
const DISTANCE_FIXTURE = [
  "「モオル——Mole……」",
  "モオルは｜髑髏《もぐらもち》と云ふ英語だった。",
  "この｜聯想《れんそう》も僕には愉快ではなかった。",
  "が、僕は三三秒の後、[tate]Mole[/tate]を la mort に綴り直した。",
].join("\n");
const EDGE_SAMPLES = [
  { baseText: "光", readingText: "ひかりかがやく", line: "あああ｜光《ひかりかがやく》いいいいいい", policy: "CENTER" },
  { baseText: "東西", readingText: "とう", line: "あああ｜東西《とう》いいいいいい", policy: "CENTER" },
  { baseText: "雨音", readingText: "あまおとおと", line: "あああ。｜雨音《あまおとおと》、いいいいいい", policy: "CENTER" },
  { baseText: "境", readingText: "きょうかいせん", line: "｜境《きょうかいせん》いいいいいい", policy: "START" },
  // The paragraph's automatic one-cell indent plus 35 body cells puts 涯 in
  // the 37th (last) A5 slot.
  { baseText: "涯", readingText: "はてのはて", line: `${"あ".repeat(35)}｜涯《はてのはて》`, policy: "END" },
];
const distanceQa = process.env.TATESPUN_RUBY_DISTANCE === "1";
const SAMPLES = distanceQa
  ? DISTANCE_SAMPLES
  : process.env.TATESPUN_RUBY_EDGE_CASES === "1"
    ? EDGE_SAMPLES
    : CENTERING_SAMPLES;
const CENTERED_BASES = SAMPLES.filter((sample) => sample.policy === "CENTER").map((sample) => sample.baseText);
const SCREENSHOT_BASES = distanceQa
  ? DISTANCE_SAMPLES.map((sample) => sample.baseText)
  : CENTERING_SAMPLES.map((sample) => sample.baseText);
const FIXTURE = distanceQa ? DISTANCE_FIXTURE : SAMPLES.map((sample) => sample.line).join("\n");

function visibleInkRect(image, cssRect, pixelScaleX, pixelScaleY) {
  const channels = image.channels ?? 4;
  const x0 = Math.max(0, Math.floor(cssRect.left * pixelScaleX));
  const x1 = Math.min(image.width - 1, Math.ceil(cssRect.right * pixelScaleX));
  const y0 = Math.max(0, Math.floor(cssRect.top * pixelScaleY));
  const y1 = Math.min(image.height - 1, Math.ceil(cssRect.bottom * pixelScaleY));
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  let pixels = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const offset = (y * image.width + x) * channels;
      const alpha = channels === 4 ? image.data[offset + 3] : 255;
      const luminance = (image.data[offset] + image.data[offset + 1] + image.data[offset + 2]) / 3;
      if (alpha > 32 && luminance < 210) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
        pixels += 1;
      }
    }
  }
  if (pixels === 0) return null;
  return {
    left: left / pixelScaleX,
    right: right / pixelScaleX,
    top: top / pixelScaleY,
    bottom: bottom / pixelScaleY,
    width: (right - left) / pixelScaleX,
    height: (bottom - top) / pixelScaleY,
    center: (top + bottom) / (2 * pixelScaleY),
    pixels,
  };
}

function freePort() {
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
  if (!browser) throw new Error("No Chromium browser found. Set TATESPUN_E2E_BROWSER.");
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
      throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
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

const measurementExpression = `(() => {
  const round = (value) => Number(value.toFixed(4));
  const rect = (value) => ({
    top: round(value.top),
    bottom: round(value.bottom),
    height: round(value.height),
    center: round((value.top + value.bottom) / 2),
    left: round(value.left),
    right: round(value.right),
    width: round(value.width),
    centerX: round((value.left + value.right) / 2),
  });
  const rangeRect = (node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return rect(range.getBoundingClientRect());
  };
  const rubies = [...document.querySelectorAll('[data-v2-preview-root] .unit.kind-RUBY')]
    .filter((unit) => unit.getBoundingClientRect().height > 0);
  return rubies.map((base) => {
    const ink = base.querySelector(':scope > .unit-ink');
    const annotation = base.querySelector(':scope > .ruby-annotation');
    const baseText = [...ink.childNodes]
      .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && node.classList.contains('provisional-badge')))
      .map((node) => node.textContent)
      .join('');
    const baseStyle = getComputedStyle(base);
    const annotationStyle = getComputedStyle(annotation);
    const line = base.closest('.line');
    const page = base.closest('.page');
    const scale = base.getBoundingClientRect().height / parseFloat(base.style.height);
    const canonicalBaseStart = parseFloat(base.style.top);
    const canonicalBaseEnd = canonicalBaseStart + parseFloat(base.style.height);
    const canonicalRubyStart = canonicalBaseStart + parseFloat(annotation.style.top);
    const canonicalRubyEnd = canonicalRubyStart + parseFloat(annotation.style.height);
    return {
      baseText,
      readingText: annotation.textContent,
      canonical: {
        base: { start: round(canonicalBaseStart), end: round(canonicalBaseEnd), center: round((canonicalBaseStart + canonicalBaseEnd) / 2) },
        ruby: { start: round(canonicalRubyStart), end: round(canonicalRubyEnd), center: round((canonicalRubyStart + canonicalRubyEnd) / 2) },
      },
      dom: {
        scale: round(scale),
        line: rect(line.getBoundingClientRect()),
        page: rect(page.getBoundingClientRect()),
        base: rect(base.getBoundingClientRect()),
        baseTextRun: rangeRect(ink),
        rubyContainer: rect(annotation.getBoundingClientRect()),
        rubyTextRun: rangeRect(annotation),
      },
      computed: {
        base: {
          writingMode: baseStyle.writingMode,
          textOrientation: baseStyle.textOrientation,
          fontFamily: baseStyle.fontFamily,
          fontSize: baseStyle.fontSize,
          lineHeight: baseStyle.lineHeight,
          letterSpacing: baseStyle.letterSpacing,
          textAlign: baseStyle.textAlign,
          overflow: baseStyle.overflow,
          transform: baseStyle.transform,
        },
        ruby: {
          writingMode: annotationStyle.writingMode,
          textOrientation: annotationStyle.textOrientation,
          fontFamily: annotationStyle.fontFamily,
          fontSize: annotationStyle.fontSize,
          lineHeight: annotationStyle.lineHeight,
          letterSpacing: annotationStyle.letterSpacing,
          textAlign: annotationStyle.textAlign,
          top: annotationStyle.top,
          left: annotationStyle.left,
          width: annotationStyle.width,
          height: annotationStyle.height,
          overflow: annotationStyle.overflow,
          transform: annotationStyle.transform,
        },
      },
      fontLoaded: document.fonts.check(annotationStyle.fontSize + ' ' + annotationStyle.fontFamily, annotation.textContent),
    };
  });
})()`;

const legacyMeasurementExpression = `(() => {
  const samples = ${JSON.stringify(SAMPLES.map(({ baseText, readingText }) => ({ baseText, readingText })))};
  const round = (value) => Number(value.toFixed(4));
  const rect = (value) => ({
    top: round(value.top), bottom: round(value.bottom), height: round(value.height),
    center: round((value.top + value.bottom) / 2), left: round(value.left),
    right: round(value.right), width: round(value.width),
  });
  const unionRect = (elements) => {
    const boxes = elements.map((element) => element.getBoundingClientRect());
    const top = Math.min(...boxes.map((box) => box.top));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const left = Math.min(...boxes.map((box) => box.left));
    const right = Math.max(...boxes.map((box) => box.right));
    return rect({ top, bottom, left, right, height: bottom - top, width: right - left });
  };
  const findSequence = (elements, text) => {
    const chars = Array.from(text);
    for (let start = 0; start <= elements.length - chars.length; start += 1) {
      if (chars.every((char, index) => elements[start + index].textContent === char)) {
        return elements.slice(start, start + chars.length);
      }
    }
    return [];
  };
  const styleSnapshot = (element) => {
    const style = getComputedStyle(element);
    return {
      writingMode: style.writingMode, textOrientation: style.textOrientation,
      position: style.position, top: style.top, left: style.left,
      width: style.width, height: style.height, transform: style.transform,
      transformOrigin: style.transformOrigin, scale: style.scale, zoom: style.zoom,
      fontFamily: style.fontFamily, fontSize: style.fontSize,
      lineHeight: style.lineHeight, letterSpacing: style.letterSpacing,
      overflow: style.overflow,
    };
  };
  const ancestors = (element) => {
    const result = [];
    let current = element;
    while (current && current !== document.documentElement) {
      result.push({
        tag: current.tagName.toLowerCase(), id: current.id,
        className: typeof current.className === 'string' ? current.className : '',
        pageCard: current.getAttribute('data-page-card'),
        rect: rect(current.getBoundingClientRect()),
        computed: styleSnapshot(current),
      });
      current = current.parentElement;
    }
    return result;
  };
  const lines = [...document.querySelectorAll('[data-page-card="true"] .tategaki-line')];
  return samples.map((sample) => {
    let match;
    for (const line of lines) {
      const children = [...line.children].filter((child) => child.tagName === 'SPAN');
      const rubyCandidates = children.filter((child) => child.style.position === 'absolute' && child.style.fontSize && parseFloat(child.style.left) > 0);
      const rubyGlyphs = findSequence(rubyCandidates, sample.readingText);
      if (rubyGlyphs.length === Array.from(sample.readingText).length) {
        const baseCandidates = children.filter((child) => child.style.position === 'absolute' && !child.style.fontSize && parseFloat(child.style.left || '0') === 0);
        const baseGlyphs = findSequence(baseCandidates, sample.baseText);
        if (baseGlyphs.length === Array.from(sample.baseText).length) {
          match = { line, baseGlyphs, rubyGlyphs };
          break;
        }
      }
    }
    if (!match) throw new Error('Could not resolve legacy Ruby DOM for ' + sample.baseText);
    const { line, baseGlyphs, rubyGlyphs } = match;
    const baseStart = parseFloat(baseGlyphs[0].style.top);
    const baseEnd = parseFloat(baseGlyphs.at(-1).style.top) + parseFloat(baseGlyphs.at(-1).style.height);
    const rubyStart = parseFloat(rubyGlyphs[0].style.top);
    const rubyEnd = parseFloat(rubyGlyphs.at(-1).style.top) + parseFloat(rubyGlyphs.at(-1).style.height);
    const baseBox = unionRect(baseGlyphs);
    const rubyBox = unionRect(rubyGlyphs);
    const rubyStyle = getComputedStyle(rubyGlyphs[0]);
    return {
      baseText: sample.baseText,
      readingText: sample.readingText,
      renderer: 'LEGACY_FIXED_SLOT',
      canonical: {
        base: { start: round(baseStart), end: round(baseEnd), center: round((baseStart + baseEnd) / 2) },
        ruby: { start: round(rubyStart), end: round(rubyEnd), center: round((rubyStart + rubyEnd) / 2) },
      },
      raw: {
        baseGlyphs: baseGlyphs.map((glyph) => ({ text: glyph.textContent, top: glyph.style.top, left: glyph.style.left, width: glyph.style.width, height: glyph.style.height })),
        rubyGlyphs: rubyGlyphs.map((glyph) => ({ text: glyph.textContent, top: glyph.style.top, left: glyph.style.left, width: glyph.style.width, height: glyph.style.height })),
      },
      dom: {
        scale: round(baseBox.height / (baseEnd - baseStart)),
        line: rect(line.getBoundingClientRect()),
        page: rect(line.closest('[data-page-card="true"]').getBoundingClientRect()),
        base: baseBox, baseTextRun: baseBox, rubyContainer: rubyBox, rubyTextRun: rubyBox,
        baseGlyphs: baseGlyphs.map((glyph) => ({ text: glyph.textContent, ...rect(glyph.getBoundingClientRect()) })),
        rubyGlyphs: rubyGlyphs.map((glyph) => ({ text: glyph.textContent, ...rect(glyph.getBoundingClientRect()) })),
      },
      computed: { base: styleSnapshot(baseGlyphs[0]), ruby: styleSnapshot(rubyGlyphs[0]) },
      ancestors: ancestors(line),
      fontLoaded: document.fonts.check(rubyStyle.fontSize + ' ' + rubyStyle.fontFamily, sample.readingText),
    };
  });
})()`;

let nextProcess;
let browserProcess;
let cdp;
let nextOutput = "";
let browserOutput = "";
const profileDir = mkdtempSync(join(tmpdir(), "tatespun-ruby-e2e-"));

try {
  const externalBaseUrl = process.env.TATESPUN_E2E_BASE_URL?.replace(/\/$/, "");
  let baseUrl = externalBaseUrl;
  if (!baseUrl) {
    const appPort = await freePort();
    baseUrl = `http://127.0.0.1:${appPort}`;
    const nextBin = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
    nextProcess = spawn(process.execPath, [nextBin, "dev", "-p", String(appPort)], {
      cwd: ROOT,
      env: { ...process.env, NEXT_PUBLIC_TATESPUN_RENDERER: "V2_BETA" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    nextProcess.stdout.on("data", (chunk) => { nextOutput += chunk; });
    nextProcess.stderr.on("data", (chunk) => { nextOutput += chunk; });
  }

  const editorUrl = `${baseUrl}/editor?demo=1`;
  await waitForPage(editorUrl, nextProcess, () => nextOutput);

  const debugPort = await freePort();
  browserProcess = spawn(findBrowser(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--window-size=1600,1200",
    `--force-device-scale-factor=${process.env.TATESPUN_RUBY_DSF || "4"}`,
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
  // Keep requestAnimationFrame-based settle checks live in headless Chrome.
  // A second about:blank target exists at startup and can otherwise leave the
  // Editor target background-throttled between the 150% and 250% checks.
  await cdp.send("Page.bringToFront");
  await cdp.send("Runtime.enable");
  await cdp.waitFor(`document.readyState === 'complete' && Boolean(document.querySelector('[data-demo-target="editor"]'))`);
  await cdp.waitFor(`Object.getOwnPropertyNames(document.querySelector('[data-demo-target="editor"]')).some((key) => key.startsWith('__reactProps'))`);

  await cdp.evaluate(`(() => {
    const editor = document.querySelector('[data-demo-target="editor"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(editor, ${JSON.stringify(FIXTURE)});
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await cdp.waitFor(`document.querySelector('[data-demo-target="editor"]').value === ${JSON.stringify(FIXTURE)}`);
  try {
    await cdp.waitFor(`
      [...document.querySelectorAll('[data-v2-preview-root] .unit.kind-RUBY')]
        .filter((unit) => unit.getBoundingClientRect().height > 0).length >= ${SAMPLES.length} ||
      [...document.querySelectorAll('[data-page-card="true"] .tategaki-line > span')]
        .filter((span) => span.style.position === 'absolute' && span.style.fontSize && parseFloat(span.style.left) > 0).length >= ${SAMPLES.reduce((sum, sample) => sum + Array.from(sample.readingText).length, 0)}
    `, 40_000);
  } catch (error) {
    const diagnostics = await cdp.evaluate(`(() => ({
      editorValue: document.querySelector('[data-demo-target="editor"]')?.value,
      v2Roots: document.querySelectorAll('[data-v2-preview-root]').length,
      rubyUnits: document.querySelectorAll('.unit.kind-RUBY').length,
      previewText: document.querySelector('[data-v2-preview-root]')?.textContent?.slice(0, 300),
      alerts: [...document.querySelectorAll('[role="alert"]')].map((node) => node.textContent),
    }))()`);
    throw new Error(`${error.message}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
  await cdp.evaluate(`(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return true;
  })()`);

  if (distanceQa) {
    await cdp.evaluate(`(async () => {
      const reset = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '100%');
      const plus = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '＋');
      reset?.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      plus?.click();
      await new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 200));
      return true;
    })()`);
    const zoom150 = await cdp.evaluate(measurementExpression);
    assert.deepEqual(zoom150.map((entry) => entry.baseText), SAMPLES.map((sample) => sample.baseText));
    assert.ok(zoom150.every((entry) => entry.dom.scale > 0), "150% Ruby scale was not measurable");
    assert.ok(
      zoom150.every((entry) => {
        const laneDelta = entry.dom.rubyTextRun.centerX - entry.dom.baseTextRun.centerX;
        const expected = parseFloat(entry.computed.base.fontSize) * entry.dom.scale * EXPECTED_RUBY_LANE_CENTER_EM;
        return Math.abs(laneDelta - expected) <= 0.15;
      }),
      "150% Ruby lane did not preserve the default 0.69em center distance",
    );
    console.log(JSON.stringify({ zoom: "150%", measurements: zoom150 }, null, 2));
    if (process.env.TATESPUN_RUBY_SCREENSHOT_150) {
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
      writeFileSync(process.env.TATESPUN_RUBY_SCREENSHOT_150, Buffer.from(shot.data, "base64"));
    }
    await cdp.evaluate(`(async () => {
      const plus = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '＋');
      plus?.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      plus?.click();
      await new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 200));
      return true;
    })()`);
  }

  if (process.env.TATESPUN_RUBY_ZOOM === "100" || process.env.TATESPUN_RUBY_ZOOM === "400") {
    await cdp.evaluate(`(async () => {
      if (${JSON.stringify(process.env.TATESPUN_RUBY_ZOOM)} === '100') {
        const reset = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '100%');
        reset?.click();
      } else {
        const plus = [...document.querySelectorAll('button')].find((button) => button.textContent.trim() === '＋');
        for (let index = 0; index < 7; index += 1) {
          plus?.click();
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      }
      const ruby = [...document.querySelectorAll('[data-v2-preview-root] .unit.kind-RUBY')]
        .find((unit) => unit.getBoundingClientRect().height > 0) || document.querySelector('[data-page-card="true"] .tategaki-line');
      ruby?.scrollIntoView({ block: 'center', inline: 'center' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return true;
    })()`);
  }

  // PreviewPane animates presentation-scale changes for 100ms. Measuring a
  // rect during that transition and taking the screenshot after it finishes
  // puts the bitmap in a different coordinate space from the recorded rect.
  await cdp.evaluate(`new Promise((resolve) => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(resolve)), 200))`);

  const renderer = await cdp.evaluate(`document.querySelectorAll('[data-v2-preview-root]').length > 0 ? 'V2_BETA' : 'LEGACY_FIXED_SLOT'`);
  const measurements = await cdp.evaluate(renderer === "V2_BETA" ? measurementExpression : legacyMeasurementExpression);
  assert.deepEqual(measurements.map((entry) => entry.baseText), SAMPLES.map((sample) => sample.baseText));
  const viewport = await cdp.evaluate(`({ width: innerWidth, height: innerHeight, devicePixelRatio })`);
  const screenshotPadding = 8;
  const screenshotClip = {
    x: Math.max(0, Math.min(...measurements.flatMap((entry) => [entry.dom.base.left, entry.dom.rubyTextRun.left])) - screenshotPadding),
    y: Math.max(0, Math.min(...measurements.flatMap((entry) => [entry.dom.base.top, entry.dom.rubyTextRun.top])) - screenshotPadding),
    width: 0,
    height: 0,
    scale: 1,
  };
  const clipRight = Math.min(
    viewport.width,
    Math.max(...measurements.flatMap((entry) => [entry.dom.base.right, entry.dom.rubyTextRun.right])) + screenshotPadding
  );
  const clipBottom = Math.min(
    viewport.height,
    Math.max(...measurements.flatMap((entry) => [entry.dom.base.bottom, entry.dom.rubyTextRun.bottom])) + screenshotPadding
  );
  screenshotClip.width = clipRight - screenshotClip.x;
  screenshotClip.height = clipBottom - screenshotClip.y;
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
    clip: screenshotClip,
  });
  const screenshotBytes = Buffer.from(screenshot.data, "base64");
  if (process.env.TATESPUN_RUBY_SCREENSHOT) {
    writeFileSync(process.env.TATESPUN_RUBY_SCREENSHOT, screenshotBytes);
  }
  const screenshotImage = decode(screenshotBytes);
  const screenshotScaleX = screenshotImage.width / screenshotClip.width;
  const screenshotScaleY = screenshotImage.height / screenshotClip.height;
  const relativeToScreenshot = (rect) => ({
    left: rect.left - screenshotClip.x,
    right: rect.right - screenshotClip.x,
    top: rect.top - screenshotClip.y,
    bottom: rect.bottom - screenshotClip.y,
  });
  const results = measurements.map((entry) => {
    const baseInk = visibleInkRect(screenshotImage, relativeToScreenshot(entry.dom.base), screenshotScaleX, screenshotScaleY);
    const rubyInk = visibleInkRect(screenshotImage, relativeToScreenshot(entry.dom.rubyTextRun), screenshotScaleX, screenshotScaleY);
    const canonicalDelta = Math.abs(entry.canonical.base.center - entry.canonical.ruby.center);
    const containerDelta = Math.abs(entry.dom.base.center - entry.dom.rubyContainer.center);
    const runDelta = Math.abs(entry.dom.baseTextRun.center - entry.dom.rubyTextRun.center);
    const horizontalLaneDelta = entry.dom.rubyTextRun.centerX - entry.dom.baseTextRun.centerX;
    const visibleInkCenterDelta = baseInk && rubyInk ? rubyInk.center - baseInk.center : null;
    // Ink bounds are not advance bounds: asymmetric first/last glyph contours
    // and antialiasing can move the bitmap box while the text run stays exactly
    // centered. Keep the DOM/run check strict, and allow the ink box half of
    // the transformed ruby em plus one screenshot pixel for raster quantization.
    const visibleInkTolerance = Math.max(
      1.5,
      parseFloat(entry.computed.ruby.fontSize) * entry.dom.scale / 2 + 1 / screenshotScaleY
    );
    console.log(JSON.stringify({
      sample: `${entry.baseText}《${entry.readingText}》`,
      canonicalCenterDeltaPx: canonicalDelta,
      domContainerCenterDeltaPx: containerDelta,
      renderedTextRunCenterDeltaPx: runDelta,
      horizontalLaneDeltaPx: horizontalLaneDelta,
      visibleInkCenterDeltaPx: visibleInkCenterDelta,
      visibleInkTolerancePx: visibleInkTolerance,
      visibleInk: { base: baseInk, ruby: rubyInk },
      ...entry,
    }, null, 2));
    return { entry, baseInk, rubyInk, canonicalDelta, containerDelta, runDelta, horizontalLaneDelta, visibleInkCenterDelta, visibleInkTolerance };
  });

  assert.equal(measurements.every((entry) => entry.fontLoaded), true, "the actual Preview font did not load for every ruby sample");
  assert.ok(
    results.filter(({ entry }) => CENTERED_BASES.includes(entry.baseText)).every(({ canonicalDelta }) => canonicalDelta <= 0.01),
    "canonical base/ruby centers diverged"
  );
  if (distanceQa) {
    assert.ok(
      results.every(({ entry, horizontalLaneDelta }) => {
        const expected = parseFloat(entry.computed.base.fontSize) * entry.dom.scale * EXPECTED_RUBY_LANE_CENTER_EM;
        return Math.abs(horizontalLaneDelta - expected) <= 0.15;
      }),
      "rendered Ruby lane did not preserve the default 0.69em center distance",
    );
  }
  assert.ok(
    results.filter(({ entry }) => CENTERED_BASES.includes(entry.baseText)).every(({ containerDelta, runDelta }) => containerDelta <= 0.05 && runDelta <= 0.05),
    "rendered ruby container/text-run center diverged from its base"
  );
  assert.ok(
    results.filter(({ entry }) => SCREENSHOT_BASES.includes(entry.baseText)).every(({ baseInk, rubyInk, visibleInkCenterDelta, visibleInkTolerance }) =>
      baseInk && rubyInk && Math.abs(visibleInkCenterDelta) <= visibleInkTolerance
    ),
    "visible ruby ink diverged by more than half a ruby em plus one raster pixel"
  );

  const head = results.find(({ entry }) => entry.baseText === "境");
  if (head) {
    assert.ok(Math.abs(head.entry.canonical.ruby.start) <= 0.01, "line-head ruby was not start-clamped");
    assert.ok(Math.abs(head.entry.dom.rubyContainer.top - head.entry.dom.line.top) <= 0.05, "line-head Ruby escaped its transformed line start");
  }
  const tail = results.find(({ entry }) => entry.baseText === "涯");
  if (tail) {
    assert.ok(Math.abs(tail.entry.dom.rubyContainer.bottom - tail.entry.dom.line.bottom) <= 0.05, "line-end Ruby was not end-clamped");
  }

  console.log(`\nAll ${renderer} real Editor/Preview ruby centering checks passed.`);
} catch (error) {
  console.error(error);
  if (nextOutput) console.error(`\nNext output:\n${nextOutput}`);
  if (browserOutput) console.error(`\nBrowser output:\n${browserOutput}`);
  process.exitCode = 1;
} finally {
  cdp?.close();
  nextProcess?.kill();
  browserProcess?.kill();
  await new Promise((resolve) => setTimeout(resolve, 500));
  rmSync(profileDir, { recursive: true, force: true });
}
