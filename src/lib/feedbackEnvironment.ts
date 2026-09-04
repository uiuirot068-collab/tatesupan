/**
 * TSP-LOOP-030 — one central "what browser is this" collector for β feedback.
 *
 * The β「気になる事」/ review forms used to leave the user to type their device
 * / OS / browser by hand. Everything here is read straight from the browser
 * with no prompt, no permission, no network call, and appended (frontend-only)
 * to the message text the existing feedback transport already carries.
 *
 * Privacy — this deliberately does NOT:
 *  - request high-entropy UA Client Hints (`getHighEntropyValues`)
 *  - read IP or geolocation (never touched — client-side can't see the IP and
 *    we never call the Geolocation API)
 *  - create or read any persistent per-device identifier
 *  - guess an exact device model
 * It only reads values already present synchronously on `navigator` / `window`
 * / `screen`, plus low-entropy `navigator.userAgentData` when the browser
 * exposes it without a prompt.
 *
 * Every field degrades to `"unknown"` (or is omitted from the visible line)
 * rather than throwing — environment detection must never block a submission.
 */

export interface FeedbackEnvironment {
  /** "Windows" | "macOS" | "iOS" | "iPadOS系" | "Android" | "ChromeOS" | "Linux" | "unknown" */
  osFamily: string;
  /** Best-effort OS version string, or "" when not reliably knowable. */
  osVersion: string;
  /** "Chrome" | "Edge" | "Safari" | "Firefox" | "Opera" | "Samsung Internet" | "unknown" */
  browserName: string;
  /** Best-effort browser version, or "". */
  browserVersion: string;
  /** Web engine: "Blink" | "WebKit" | "Gecko" | "unknown". On iOS/iPadOS every
   *  browser (including Chrome / Edge / Firefox branding) runs on WebKit. */
  engine: string;
  deviceClass: "mobile" | "tablet" | "desktop";
  /** CSS pixels, "834×1194". */
  viewport: string;
  /** Physical screen, "1024×1366". */
  screen: string;
  /** devicePixelRatio, e.g. "2". */
  dpr: string;
  touch: boolean;
  maxTouchPoints: number;
  /** Full navigator.userAgent (already sent to every server the app talks to). */
  userAgent: string;
  /** Low-entropy UA-CH brand list ("Chromium 120, Google Chrome 120"), or "". */
  uaBrands: string;
}

/** Raw values the collector needs — injectable so the logic is unit-testable. */
export interface EnvSource {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
  devicePixelRatio: number;
  hasTouchEvent: boolean;
  /** navigator.userAgentData (low-entropy fields only) or null. */
  uaData: {
    brands?: Array<{ brand: string; version: string }>;
    mobile?: boolean;
    platform?: string;
  } | null;
}

const UNKNOWN = "unknown";

/** Read the live browser environment. SSR / locked-down contexts → safe blanks. */
export function browserEnvSource(): EnvSource {
  const g = (fn: () => unknown, fallback: unknown) => {
    try {
      const v = fn();
      return v ?? fallback;
    } catch {
      return fallback;
    }
  };
  const nav: Navigator | Record<string, never> =
    typeof navigator === "undefined" ? ({} as Record<string, never>) : navigator;
  const win = typeof window === "undefined" ? undefined : window;
  const scr = typeof screen === "undefined" ? undefined : screen;
  return {
    userAgent: String(g(() => (nav as Navigator).userAgent, "")),
    platform: String(g(() => (nav as Navigator).platform, "")),
    maxTouchPoints: Number(g(() => (nav as Navigator).maxTouchPoints, 0)) || 0,
    innerWidth: Number(g(() => win?.innerWidth, 0)) || 0,
    innerHeight: Number(g(() => win?.innerHeight, 0)) || 0,
    screenWidth: Number(g(() => scr?.width, 0)) || 0,
    screenHeight: Number(g(() => scr?.height, 0)) || 0,
    devicePixelRatio: Number(g(() => win?.devicePixelRatio, 1)) || 1,
    hasTouchEvent: Boolean(g(() => win && "ontouchstart" in win, false)),
    uaData: (g(() => {
      const d = (nav as Navigator & { userAgentData?: EnvSource["uaData"] }).userAgentData;
      if (!d) return null;
      // low-entropy only — never call getHighEntropyValues()
      return { brands: d.brands, mobile: d.mobile, platform: d.platform };
    }, null) as EnvSource["uaData"]),
  };
}

function pickBrand(brands?: Array<{ brand: string; version: string }>): { brand: string; version: string } | null {
  if (!brands || brands.length === 0) return null;
  const real = brands.filter((b) => !/not.?a.?brand/i.test(b.brand) && !/^chromium$/i.test(b.brand));
  const preferred =
    real.find((b) => /edge/i.test(b.brand)) ||
    real.find((b) => /opera|opr/i.test(b.brand)) ||
    real.find((b) => /samsung/i.test(b.brand)) ||
    real.find((b) => /google chrome|chrome/i.test(b.brand)) ||
    real[0] ||
    brands.find((b) => /^chromium$/i.test(b.brand)) ||
    null;
  return preferred ? { brand: preferred.brand, version: preferred.version } : null;
}

function normBrandName(brand: string): string {
  if (/edge/i.test(brand)) return "Edge";
  if (/opera|opr/i.test(brand)) return "Opera";
  if (/samsung/i.test(brand)) return "Samsung Internet";
  if (/google chrome|(^|[^a-z])chrome/i.test(brand)) return "Chrome";
  if (/chromium/i.test(brand)) return "Chrome";
  if (/firefox/i.test(brand)) return "Firefox";
  return brand;
}

function detectOs(ua: string, platform: string, maxTouchPoints: number): { family: string; version: string; isIOS: boolean; isIPadOS: boolean } {
  const macLike = /Mac OS X|Macintosh|MacIntel/i.test(ua + " " + platform);
  const iPadMasquerade = macLike && maxTouchPoints > 1 && !/iPhone|iPod/i.test(ua);

  if (/iPad/i.test(ua) || iPadMasquerade) {
    const m = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
    return { family: "iPadOS系", version: m ? m.slice(1).filter(Boolean).join(".") : "", isIOS: false, isIPadOS: true };
  }
  if (/iPhone|iPod/i.test(ua)) {
    const m = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
    return { family: "iOS", version: m ? m.slice(1).filter(Boolean).join(".") : "", isIOS: true, isIPadOS: false };
  }
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android (\d+(?:\.\d+)*)/);
    return { family: "Android", version: m ? m[1] : "", isIOS: false, isIPadOS: false };
  }
  if (/CrOS/i.test(ua)) return { family: "ChromeOS", version: "", isIOS: false, isIPadOS: false };
  if (/Windows NT/i.test(ua)) {
    const m = ua.match(/Windows NT (\d+\.\d+)/);
    const map: Record<string, string> = { "10.0": "10 / 11", "6.3": "8.1", "6.2": "8", "6.1": "7" };
    return { family: "Windows", version: m ? map[m[1]] ?? m[1] : "", isIOS: false, isIPadOS: false };
  }
  if (macLike) {
    const m = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/);
    return { family: "macOS", version: m ? m[1].replace(/_/g, ".") : "", isIOS: false, isIPadOS: false };
  }
  if (/Linux/i.test(ua)) return { family: "Linux", version: "", isIOS: false, isIPadOS: false };
  return { family: UNKNOWN, version: "", isIOS: false, isIPadOS: false };
}

function detectBrowser(ua: string, uaData: EnvSource["uaData"]): { name: string; version: string } {
  const picked = pickBrand(uaData?.brands);
  if (picked) return { name: normBrandName(picked.brand), version: picked.version };

  const pats: Array<[RegExp, string]> = [
    [/EdgiOS\/([\d.]+)/, "Edge"],
    [/EdgA\/([\d.]+)/, "Edge"],
    [/Edg(?:e)?\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/CriOS\/([\d.]+)/, "Chrome"],
    [/FxiOS\/([\d.]+)/, "Firefox"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Chrome\/([\d.]+)/, "Chrome"],
  ];
  for (const [re, name] of pats) {
    const m = ua.match(re);
    if (m) return { name, version: m[1] };
  }
  // Safari: version lives in the Version/ token, not Safari/
  if (/Safari\//.test(ua)) {
    const m = ua.match(/Version\/([\d.]+)/);
    return { name: "Safari", version: m ? m[1] : "" };
  }
  return { name: UNKNOWN, version: "" };
}

function detectEngine(ua: string, browserName: string, isIOS: boolean, isIPadOS: boolean): string {
  if (isIOS || isIPadOS || /iPhone|iPad|iPod/i.test(ua)) return "WebKit"; // every iOS/iPadOS browser
  if (browserName === "Firefox" || /Firefox|FxiOS/i.test(ua)) return "Gecko";
  if (/Edg(?:e|A|iOS)?\/|Chrome\/|CriOS\/|OPR\/|SamsungBrowser\/|Chromium/i.test(ua)) return "Blink";
  if (browserName === "Safari" || /Safari\//.test(ua)) return "WebKit";
  return UNKNOWN;
}

function detectDeviceClass(
  ua: string,
  uaData: EnvSource["uaData"],
  isIPadOS: boolean,
  touch: boolean,
): FeedbackEnvironment["deviceClass"] {
  if (isIPadOS || /iPad/i.test(ua)) return "tablet";
  if (/iPhone|iPod/i.test(ua)) return "mobile";
  if (/Android/i.test(ua)) return /Mobile/i.test(ua) ? "mobile" : "tablet";
  if (uaData?.mobile === true) return "mobile";
  if (/Windows Phone|Mobile/i.test(ua)) return "mobile";
  if (/Tablet|PlayBook|Silk/i.test(ua)) return "tablet";
  // A touch-only Mac-like device that wasn't caught as iPadOS above is almost
  // certainly a tablet; a desktop with a touchscreen still reports "desktop"
  // because it also has a Windows/mac UA and we only reach here for those.
  if (touch && /MacIntel|Macintosh/i.test(ua) === false && /Windows|Linux|Mac/i.test(ua) === false) return "tablet";
  return "desktop";
}

export function collectFeedbackEnvironment(src: EnvSource = browserEnvSource()): FeedbackEnvironment {
  const ua = src.userAgent || "";
  const os = detectOs(ua, src.platform || "", src.maxTouchPoints || 0);
  const browser = detectBrowser(ua, src.uaData);
  const engine = detectEngine(ua, browser.name, os.isIOS, os.isIPadOS);
  const touch = src.hasTouchEvent || (src.maxTouchPoints || 0) > 0;
  const deviceClass = detectDeviceClass(ua, src.uaData, os.isIPadOS, touch);
  const dim = (w: number, h: number) => (w > 0 && h > 0 ? `${w}×${h}` : UNKNOWN);
  const uaBrands = (src.uaData?.brands || [])
    .filter((b) => !/not.?a.?brand/i.test(b.brand))
    .map((b) => `${b.brand} ${b.version}`)
    .join(", ");

  return {
    osFamily: os.family || UNKNOWN,
    osVersion: os.version || "",
    browserName: browser.name || UNKNOWN,
    browserVersion: browser.version || "",
    engine: engine || UNKNOWN,
    deviceClass,
    viewport: dim(src.innerWidth, src.innerHeight),
    screen: dim(src.screenWidth, src.screenHeight),
    dpr: src.devicePixelRatio ? String(Number(src.devicePixelRatio.toFixed(2))) : UNKNOWN,
    touch,
    maxTouchPoints: src.maxTouchPoints || 0,
    userAgent: ua || UNKNOWN,
    uaBrands,
  };
}

/** Concise one-line summary for the form (no UA string, no versions). */
export function feedbackEnvironmentSummary(env: FeedbackEnvironment): string {
  return [env.browserName, env.osFamily, env.viewport]
    .filter((s) => s && s !== UNKNOWN)
    .join(" / ") || UNKNOWN;
}

/** Full block appended to the submitted message / note (Discord + spreadsheet). */
export function feedbackEnvironmentDetail(env: FeedbackEnvironment): string {
  const os = env.osVersion ? `${env.osFamily} ${env.osVersion}` : env.osFamily;
  const br = env.browserVersion ? `${env.browserName} ${env.browserVersion}` : env.browserName;
  const lines = [
    "【使用環境（自動取得）】",
    `OS: ${os}`,
    `ブラウザ: ${br}（エンジン: ${env.engine}）`,
    `種別: ${env.deviceClass} / タッチ: ${env.touch ? `あり (maxTouchPoints ${env.maxTouchPoints})` : "なし"}`,
    `画面: 表示 ${env.viewport} / 実機 ${env.screen} / DPR ${env.dpr}`,
  ];
  if (env.uaBrands) lines.push(`UA-CH: ${env.uaBrands}`);
  lines.push(`UA: ${env.userAgent}`);
  return lines.join("\n");
}
