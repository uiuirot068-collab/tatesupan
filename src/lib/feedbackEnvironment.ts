import {
  BETA_FEEDBACK_APP_VERSION,
  BETA_FEEDBACK_ENABLED,
  BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED,
} from "./betaFeedback";
import { resolveRendererRolloutMode } from "./v2Rollout";

/**
 * Permission-free diagnostics shown before and sent with β feedback.
 * Creative content, storage contents, auth/session data, cookies, and hidden
 * fingerprinting signals are deliberately outside this schema.
 */
export interface FeedbackEnvironment {
  osFamily: string;
  osVersion: string;
  platform: string;
  deviceClass: "mobile" | "tablet" | "desktop";
  browserName: string;
  browserVersion: string;
  engine: string;
  userAgent: string;
  uaBrands: string;
  uaPlatform: string;
  uaMobile: boolean;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  availScreenWidth: number;
  availScreenHeight: number;
  devicePixelRatio: number;
  colorDepth: number;
  pixelDepth: number;
  orientation: string;
  touch: boolean;
  maxTouchPoints: number;
  pointerCapability: string;
  hoverCapability: string;
  hardwareConcurrency: number;
  deviceMemoryGb: number | null;
  language: string;
  languages: string;
  timezone: string;
  timezoneOffsetMinutes: number;
  online: boolean;
  cookieEnabled: boolean;
  connectionEffectiveType: string;
  connectionDownlinkMbps: number | null;
  connectionRttMs: number | null;
  connectionSaveData: boolean | null;
  colorScheme: string;
  reducedMotion: boolean;
  appVersion: string;
  path: string;
  rendererMode: string;
  rolloutMode: string;
  responsiveMode: string;
  featureFlags: string;
}

export interface EnvSource {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  innerWidth: number;
  innerHeight: number;
  screenWidth: number;
  screenHeight: number;
  availScreenWidth?: number;
  availScreenHeight?: number;
  devicePixelRatio: number;
  colorDepth?: number;
  pixelDepth?: number;
  orientation?: string;
  hasTouchEvent: boolean;
  pointerCapability?: string;
  hoverCapability?: string;
  hardwareConcurrency?: number;
  deviceMemoryGb?: number | null;
  language?: string;
  languages?: string[];
  timezone?: string;
  timezoneOffsetMinutes?: number;
  online?: boolean;
  cookieEnabled?: boolean;
  connectionEffectiveType?: string;
  connectionDownlinkMbps?: number | null;
  connectionRttMs?: number | null;
  connectionSaveData?: boolean | null;
  colorScheme?: string;
  reducedMotion?: boolean;
  path?: string;
  uaData: {
    brands?: Array<{ brand: string; version: string }>;
    mobile?: boolean;
    platform?: string;
  } | null;
}

const UNKNOWN = "unknown";

function safely<T>(read: () => T, fallback: T): T {
  try {
    return read() ?? fallback;
  } catch {
    return fallback;
  }
}

export function browserEnvSource(): EnvSource {
  const nav = typeof navigator === "undefined" ? null : navigator;
  const win = typeof window === "undefined" ? null : window;
  const scr = typeof screen === "undefined" ? null : screen;
  const navExtended = nav as (Navigator & {
    userAgentData?: EnvSource["uaData"];
    deviceMemory?: number;
    connection?: {
      effectiveType?: string;
      downlink?: number;
      rtt?: number;
      saveData?: boolean;
    };
  }) | null;
  const media = (query: string) => Boolean(safely(() => win?.matchMedia(query).matches, false));
  const pointerCapability = media("(pointer: fine)")
    ? "fine"
    : media("(pointer: coarse)")
      ? "coarse"
      : "none/unknown";
  const hoverCapability = media("(hover: hover)") ? "hover" : "none";
  const colorScheme = media("(prefers-color-scheme: dark)") ? "dark" : "light";
  const connection = navExtended?.connection;

  return {
    userAgent: safely(() => nav?.userAgent ?? "", ""),
    platform: safely(() => nav?.platform ?? "", ""),
    maxTouchPoints: safely(() => nav?.maxTouchPoints ?? 0, 0),
    innerWidth: safely(() => win?.innerWidth ?? 0, 0),
    innerHeight: safely(() => win?.innerHeight ?? 0, 0),
    screenWidth: safely(() => scr?.width ?? 0, 0),
    screenHeight: safely(() => scr?.height ?? 0, 0),
    availScreenWidth: safely(() => scr?.availWidth ?? 0, 0),
    availScreenHeight: safely(() => scr?.availHeight ?? 0, 0),
    devicePixelRatio: safely(() => win?.devicePixelRatio ?? 1, 1),
    colorDepth: safely(() => scr?.colorDepth ?? 0, 0),
    pixelDepth: safely(() => scr?.pixelDepth ?? 0, 0),
    orientation: safely(() => scr?.orientation?.type ?? "", ""),
    hasTouchEvent: Boolean(win && "ontouchstart" in win),
    pointerCapability,
    hoverCapability,
    hardwareConcurrency: safely(() => nav?.hardwareConcurrency ?? 0, 0),
    deviceMemoryGb: safely(() => navExtended?.deviceMemory ?? null, null),
    language: safely(() => nav?.language ?? "", ""),
    languages: safely(() => [...(nav?.languages ?? [])], []),
    timezone: safely(() => Intl.DateTimeFormat().resolvedOptions().timeZone ?? "", ""),
    timezoneOffsetMinutes: safely(() => new Date().getTimezoneOffset(), 0),
    online: safely(() => nav?.onLine ?? false, false),
    cookieEnabled: safely(() => nav?.cookieEnabled ?? false, false),
    connectionEffectiveType: safely(() => connection?.effectiveType ?? "", ""),
    connectionDownlinkMbps: safely(() => connection?.downlink ?? null, null),
    connectionRttMs: safely(() => connection?.rtt ?? null, null),
    connectionSaveData: safely(() => connection?.saveData ?? null, null),
    colorScheme,
    reducedMotion: media("(prefers-reduced-motion: reduce)"),
    path: safely(() => win?.location.pathname ?? "", ""),
    uaData: safely(() => {
      const data = navExtended?.userAgentData;
      return data
        ? { brands: data.brands, mobile: data.mobile, platform: data.platform }
        : null;
    }, null),
  };
}

function pickBrand(brands?: Array<{ brand: string; version: string }>) {
  if (!brands?.length) return null;
  const real = brands.filter((b) => !/not.?a.?brand/i.test(b.brand) && !/^chromium$/i.test(b.brand));
  return real.find((b) => /edge/i.test(b.brand))
    ?? real.find((b) => /opera|opr/i.test(b.brand))
    ?? real.find((b) => /samsung/i.test(b.brand))
    ?? real.find((b) => /google chrome|chrome/i.test(b.brand))
    ?? real[0]
    ?? brands.find((b) => /^chromium$/i.test(b.brand))
    ?? null;
}

function normalizeBrand(brand: string): string {
  if (/edge/i.test(brand)) return "Edge";
  if (/opera|opr/i.test(brand)) return "Opera";
  if (/samsung/i.test(brand)) return "Samsung Internet";
  if (/chrome|chromium/i.test(brand)) return "Chrome";
  return brand;
}

function detectOs(ua: string, platform: string, maxTouchPoints: number) {
  const macLike = /Mac OS X|Macintosh|MacIntel/i.test(`${ua} ${platform}`);
  const iPadMasquerade = macLike && maxTouchPoints > 1 && !/iPhone|iPod/i.test(ua);
  if (/iPad/i.test(ua) || iPadMasquerade) {
    const match = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
    return { family: "iPadOS系", version: match ? match.slice(1).filter(Boolean).join(".") : "", appleMobile: true };
  }
  if (/iPhone|iPod/i.test(ua)) {
    const match = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/);
    return { family: "iOS", version: match ? match.slice(1).filter(Boolean).join(".") : "", appleMobile: true };
  }
  if (/Android/i.test(ua)) return { family: "Android", version: ua.match(/Android (\d+(?:\.\d+)*)/)?.[1] ?? "", appleMobile: false };
  if (/CrOS/i.test(ua)) return { family: "ChromeOS", version: "", appleMobile: false };
  if (/Windows NT/i.test(ua)) {
    const raw = ua.match(/Windows NT (\d+\.\d+)/)?.[1] ?? "";
    const versions: Record<string, string> = { "10.0": "10 / 11", "6.3": "8.1", "6.2": "8", "6.1": "7" };
    return { family: "Windows", version: versions[raw] ?? raw, appleMobile: false };
  }
  if (macLike) return { family: "macOS", version: ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/)?.[1]?.replace(/_/g, ".") ?? "", appleMobile: false };
  if (/Linux/i.test(ua)) return { family: "Linux", version: "", appleMobile: false };
  return { family: UNKNOWN, version: "", appleMobile: false };
}

function detectBrowser(ua: string, uaData: EnvSource["uaData"]) {
  const brand = pickBrand(uaData?.brands);
  if (brand) return { name: normalizeBrand(brand.brand), version: brand.version };
  const patterns: Array<[RegExp, string]> = [
    [/EdgiOS\/([\d.]+)/, "Edge"], [/EdgA\/([\d.]+)/, "Edge"], [/Edg(?:e)?\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"], [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/CriOS\/([\d.]+)/, "Chrome"], [/FxiOS\/([\d.]+)/, "Firefox"],
    [/Firefox\/([\d.]+)/, "Firefox"], [/Chrome\/([\d.]+)/, "Chrome"],
  ];
  for (const [pattern, name] of patterns) {
    const match = ua.match(pattern);
    if (match) return { name, version: match[1] };
  }
  if (/Safari\//.test(ua)) return { name: "Safari", version: ua.match(/Version\/([\d.]+)/)?.[1] ?? "" };
  return { name: UNKNOWN, version: "" };
}

function detectDeviceClass(ua: string, uaMobile: boolean, maxTouchPoints: number): FeedbackEnvironment["deviceClass"] {
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return "tablet";
  if (/iPhone|iPod|Windows Phone|Mobile/i.test(ua) || uaMobile) return "mobile";
  if (/MacIntel/i.test(ua) && maxTouchPoints > 1) return "tablet";
  return "desktop";
}

export function collectFeedbackEnvironment(src: EnvSource = browserEnvSource()): FeedbackEnvironment {
  const ua = src.userAgent || "";
  const os = detectOs(ua, src.platform || "", src.maxTouchPoints || 0);
  const browser = detectBrowser(ua, src.uaData);
  const engine = os.appleMobile || browser.name === "Safari"
    ? "WebKit"
    : browser.name === "Firefox"
      ? "Gecko"
      : /Chrome|Edge|Opera|Samsung Internet/.test(browser.name)
        ? "Blink"
        : UNKNOWN;
  const rolloutMode = resolveRendererRolloutMode();
  const width = src.innerWidth || 0;
  return {
    osFamily: os.family,
    osVersion: os.version,
    platform: src.platform || src.uaData?.platform || UNKNOWN,
    deviceClass: detectDeviceClass(ua, Boolean(src.uaData?.mobile), src.maxTouchPoints || 0),
    browserName: browser.name,
    browserVersion: browser.version,
    engine,
    userAgent: ua || UNKNOWN,
    uaBrands: (src.uaData?.brands ?? []).filter((b) => !/not.?a.?brand/i.test(b.brand)).map((b) => `${b.brand} ${b.version}`).join(", ") || UNKNOWN,
    uaPlatform: src.uaData?.platform || UNKNOWN,
    uaMobile: Boolean(src.uaData?.mobile),
    viewportWidth: width,
    viewportHeight: src.innerHeight || 0,
    screenWidth: src.screenWidth || 0,
    screenHeight: src.screenHeight || 0,
    availScreenWidth: src.availScreenWidth || 0,
    availScreenHeight: src.availScreenHeight || 0,
    devicePixelRatio: Number((src.devicePixelRatio || 1).toFixed(2)),
    colorDepth: src.colorDepth || 0,
    pixelDepth: src.pixelDepth || 0,
    orientation: src.orientation || UNKNOWN,
    touch: src.hasTouchEvent || (src.maxTouchPoints || 0) > 0,
    maxTouchPoints: src.maxTouchPoints || 0,
    pointerCapability: src.pointerCapability || UNKNOWN,
    hoverCapability: src.hoverCapability || UNKNOWN,
    hardwareConcurrency: src.hardwareConcurrency || 0,
    deviceMemoryGb: src.deviceMemoryGb ?? null,
    language: src.language || UNKNOWN,
    languages: src.languages?.join(", ") || UNKNOWN,
    timezone: src.timezone || UNKNOWN,
    timezoneOffsetMinutes: src.timezoneOffsetMinutes ?? 0,
    online: src.online ?? false,
    cookieEnabled: src.cookieEnabled ?? false,
    connectionEffectiveType: src.connectionEffectiveType || UNKNOWN,
    connectionDownlinkMbps: src.connectionDownlinkMbps ?? null,
    connectionRttMs: src.connectionRttMs ?? null,
    connectionSaveData: src.connectionSaveData ?? null,
    colorScheme: src.colorScheme || UNKNOWN,
    reducedMotion: src.reducedMotion ?? false,
    appVersion: BETA_FEEDBACK_APP_VERSION,
    path: src.path || UNKNOWN,
    rendererMode: rolloutMode === "V2_BETA" ? "V2 canonical" : "Legacy",
    rolloutMode,
    responsiveMode: width > 0 && width < 768 ? "narrow/mobile" : "desktop/tablet",
    featureFlags: `feedback:${BETA_FEEDBACK_ENABLED ? "on" : "off"}, imageAttachments:${BETA_FEEDBACK_IMAGE_ATTACHMENTS_ENABLED ? "on" : "off"}`,
  };
}

function value(value: string | number | boolean | null): string {
  if (value === null || value === "") return UNKNOWN;
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

export function feedbackEnvironmentRows(env: FeedbackEnvironment): Array<[string, string]> {
  return [
    ["OS", `${env.osFamily}${env.osVersion ? ` ${env.osVersion}` : ""}`],
    ["Browser", `${env.browserName}${env.browserVersion ? ` ${env.browserVersion}` : ""}`],
    ["Engine / Platform", `${env.engine} / ${env.platform}`],
    ["Device / Input", `${env.deviceClass} / touch ${value(env.touch)} (${env.maxTouchPoints}) / pointer ${env.pointerCapability} / hover ${env.hoverCapability}`],
    ["Viewport", `${env.viewportWidth}×${env.viewportHeight}`],
    ["Screen", `${env.screenWidth}×${env.screenHeight} (available ${env.availScreenWidth}×${env.availScreenHeight})`],
    ["Display", `DPR ${env.devicePixelRatio} / color ${env.colorDepth}bit / pixel ${env.pixelDepth}bit / ${env.orientation}`],
    ["Hardware", `CPU ${env.hardwareConcurrency || UNKNOWN} / memory ${env.deviceMemoryGb ?? UNKNOWN}GB`],
    ["Language", `${env.language} / ${env.languages}`],
    ["Timezone", `${env.timezone} / offset ${env.timezoneOffsetMinutes}min`],
    ["Network", `${env.online ? "online" : "offline"} / ${env.connectionEffectiveType} / ${value(env.connectionDownlinkMbps)}Mbps / RTT ${value(env.connectionRttMs)}ms / saveData ${value(env.connectionSaveData)}`],
    ["Preferences", `color ${env.colorScheme} / reduced motion ${value(env.reducedMotion)} / cookies enabled ${value(env.cookieEnabled)}`],
    ["Renderer", `${env.rendererMode} / rollout ${env.rolloutMode} / ${env.responsiveMode}`],
    ["App / Path", `${env.appVersion} / ${env.path}`],
    ["Feature flags", env.featureFlags],
    ["UA-CH", `${env.uaBrands} / platform ${env.uaPlatform} / mobile ${value(env.uaMobile)}`],
    ["User agent", env.userAgent],
  ];
}

export function feedbackEnvironmentSummary(env: FeedbackEnvironment): string {
  return `${env.browserName} / ${env.osFamily} / ${env.viewportWidth}×${env.viewportHeight}`;
}

/** Short human device label for the user-visible summary (e.g. "Windows PC", "iPhone"). */
export function feedbackDeviceSummary(env: FeedbackEnvironment): string {
  if (env.osFamily === "iPadOS系") return "iPad";
  if (env.osFamily === "iOS") return "iPhone";
  if (env.deviceClass === "tablet") return `${env.osFamily} タブレット`;
  if (env.deviceClass === "mobile") return `${env.osFamily} スマートフォン`;
  return `${env.osFamily} PC`;
}

/**
 * The 3-line simple summary shown to the user before sending, per the beta
 * feedback environment contract: browser, device, and viewport only — never
 * the full diagnostics dump (that goes only to Discord for debugging).
 */
export function feedbackUserVisibleRows(env: FeedbackEnvironment): Array<[string, string]> {
  return [
    ["ブラウザ", `${env.browserName}${env.browserVersion ? ` ${env.browserVersion}` : ""}`],
    ["端末", feedbackDeviceSummary(env)],
    ["ブラウザサイズ", `${env.viewportWidth} × ${env.viewportHeight}`],
  ];
}

export function feedbackEnvironmentDetail(env: FeedbackEnvironment): string {
  return ["【使用環境】", ...feedbackEnvironmentRows(env).map(([label, detail]) => `${label}: ${detail}`)].join("\n");
}
