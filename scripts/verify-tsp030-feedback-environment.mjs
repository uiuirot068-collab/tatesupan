// TSP-LOOP-030 — automatic feedback environment metadata.
//
// Two parts:
//  A. deterministic unit matrix for `collectFeedbackEnvironment` (fixture
//     navigator/window/screen -> expected OS / browser / engine / device class,
//     incl. iPadOS-masquerading-as-Macintosh and partial navigator fields).
//  B. structural contracts: frontend-only (no Supabase / Edge / Turnstile /
//     schema change), the env block is appended to the SUBMITTED text via the
//     existing transport, the form shows a concise auto line and never asks for
//     device/OS/browser, missing metadata can't block submit, no high-entropy
//     UA hints / IP / geolocation / persistent id.
//
// Run:  node scripts/verify-tsp030-feedback-environment.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(root, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};
let failures = 0;
const check = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}${extra ? `  (${extra})` : ""}`);
  if (!cond) failures += 1;
};

/* ============================ A. unit matrix ============================ */

const { collectFeedbackEnvironment, feedbackEnvironmentSummary, feedbackEnvironmentDetail } =
  await import("../src/lib/feedbackEnvironment.ts");

const src = (o) => ({
  userAgent: "", platform: "", maxTouchPoints: 0,
  innerWidth: 1280, innerHeight: 800, screenWidth: 1280, screenHeight: 800,
  devicePixelRatio: 1, hasTouchEvent: false, uaData: null, ...o,
});

const CASES = [
  {
    label: "Windows + Chrome",
    s: src({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", platform: "Win32" }),
    want: { osFamily: "Windows", browserName: "Chrome", engine: "Blink", deviceClass: "desktop" },
  },
  {
    label: "Windows + Edge",
    s: src({ userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0", platform: "Win32" }),
    want: { osFamily: "Windows", browserName: "Edge", engine: "Blink", deviceClass: "desktop" },
  },
  {
    label: "macOS + Safari",
    s: src({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 0 }),
    want: { osFamily: "macOS", browserName: "Safari", browserVersion: "17.1", engine: "WebKit", deviceClass: "desktop" },
  },
  {
    label: "iPhone + Safari",
    s: src({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1", platform: "iPhone", maxTouchPoints: 5, hasTouchEvent: true }),
    want: { osFamily: "iOS", browserName: "Safari", engine: "WebKit", deviceClass: "mobile", touch: true },
  },
  {
    label: "iPadOS masquerading as Macintosh",
    s: src({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15", platform: "MacIntel", maxTouchPoints: 5, hasTouchEvent: true }),
    want: { osFamily: "iPadOS系", engine: "WebKit", deviceClass: "tablet", touch: true },
  },
  {
    label: "iPad Chrome (CriOS) still WebKit",
    s: src({ userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1", platform: "iPad", maxTouchPoints: 5, hasTouchEvent: true }),
    want: { osFamily: "iPadOS系", browserName: "Chrome", engine: "WebKit", deviceClass: "tablet" },
  },
  {
    label: "Android + Chrome (phone)",
    s: src({ userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5, hasTouchEvent: true }),
    want: { osFamily: "Android", browserName: "Chrome", engine: "Blink", deviceClass: "mobile" },
  },
  {
    label: "Android tablet (no 'Mobile')",
    s: src({ userAgent: "Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", platform: "Linux armv8l", maxTouchPoints: 5, hasTouchEvent: true }),
    want: { osFamily: "Android", browserName: "Chrome", engine: "Blink", deviceClass: "tablet" },
  },
  {
    label: "Firefox desktop (Linux)",
    s: src({ userAgent: "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0", platform: "Linux x86_64" }),
    want: { osFamily: "Linux", browserName: "Firefox", engine: "Gecko", deviceClass: "desktop" },
  },
  {
    label: "Chromium UA-CH (brands), Windows",
    s: src({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      platform: "Windows",
      uaData: { mobile: false, platform: "Windows", brands: [{ brand: "Not_A Brand", version: "8" }, { brand: "Chromium", version: "120" }, { brand: "Google Chrome", version: "120" }] },
    }),
    want: { osFamily: "Windows", browserName: "Chrome", browserVersion: "120", engine: "Blink", deviceClass: "desktop" },
  },
  {
    label: "partial / empty navigator (locked-down)",
    s: src({ userAgent: "", platform: "", innerWidth: 0, innerHeight: 0, screenWidth: 0, screenHeight: 0, devicePixelRatio: 0 }),
    want: { osFamily: "unknown", browserName: "unknown", engine: "unknown", deviceClass: "desktop", viewport: "unknown" },
  },
];

for (const c of CASES) {
  let env;
  try {
    env = collectFeedbackEnvironment(c.s);
  } catch (e) {
    check(`[matrix] ${c.label}: collector does not throw`, false, String(e));
    continue;
  }
  const miss = Object.entries(c.want).filter(([k, v]) => env[k] !== v);
  check(
    `[matrix] ${c.label}  →  ${feedbackEnvironmentSummary(env)}`,
    miss.length === 0,
    miss.map(([k, v]) => `${k}: expected ${JSON.stringify(v)}, got ${JSON.stringify(env[k])}`).join("; "),
  );
}

// summary line stays concise (no UA string, no version, ≤ ~40 chars) and detail
// block carries the full UA + engine.
{
  const env = collectFeedbackEnvironment(CASES[4].s); // iPadOS masquerade
  const sum = feedbackEnvironmentSummary(env);
  const det = feedbackEnvironmentDetail(env);
  check("summary line is concise & UA-free", !sum.includes("Mozilla") && sum.length <= 48, JSON.stringify(sum));
  check("detail block carries full UA + engine + screen/DPR", /UA: Mozilla/.test(det) && /エンジン: WebKit/.test(det) && /DPR/.test(det));
  check("detail block is header-labelled 使用環境（自動取得）", det.startsWith("【使用環境（自動取得）】"));
}

/* ====================== B. structural contracts ====================== */

const stripComments = (s) =>
  (s || "").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
const envLibRaw = read("src/lib/feedbackEnvironment.ts") || "";
const envLib = envLibRaw; // structural checks that want the doc text too
const envCode = stripComments(envLibRaw); // executable code only
const betaLib = read("src/lib/betaFeedback.ts") || "";
const client = read("src/lib/betaFeedbackClient.ts") || "";
const modal = read("src/components/BetaFeedbackModal.tsx") || "";
const edge = read("supabase/functions/beta-feedback/index.ts") || "";

check(
  "1. collector is pure/injectable (EnvSource param) and reads only sync navigator/window/screen",
  /export function collectFeedbackEnvironment\(src: EnvSource = browserEnvSource\(\)\)/.test(envLib) &&
    /export function browserEnvSource\(\): EnvSource/.test(envLib),
);
check(
  "2. NEVER requests high-entropy UA hints / geolocation / IP / persistent id (code, not doc mentions)",
  !/\.getHighEntropyValues\s*\(/.test(envCode) &&
    !/navigator\.geolocation|getCurrentPosition\s*\(/.test(envCode) &&
    !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(envCode) &&
    !/\bfetch\s*\(|XMLHttpRequest|\.sendBeacon\s*\(|new WebSocket/.test(envCode),
);
check(
  "3. iPadOS-as-Macintosh rule present (Mac-like UA + maxTouchPoints > 1 ⇒ iPadOS系 / tablet)",
  /Mac OS X\|Macintosh\|MacIntel/.test(envLib) && /maxTouchPoints > 1/.test(envLib) && /iPadOS系/.test(envLib),
);
check(
  "4. every iOS/iPadOS browser is reported as engine WebKit (branding kept separate)",
  /if \(isIOS \|\| isIPadOS \|\| \/iPhone\|iPad\|iPod\/i\.test\(ua\)\) return "WebKit"/.test(envLib),
);
check(
  "5. no exact device-model guess (no model tables / 'iPhone 1x' / 'Pixel' literals as output)",
  !/iPhone 1[0-9]|Galaxy S|Pixel [0-9]|iPad Pro|model:/i.test(envLib),
);

check(
  "6. betaFeedback exposes appendEnvironmentBlock + a reserve, appends ONCE to the text tail",
  /export function appendEnvironmentBlock\(text: string, detail: string\): string/.test(betaLib) &&
    /export const FEEDBACK_ENV_BLOCK_RESERVE = \d+/.test(betaLib) &&
    /if \(!detail\.trim\(\)\) return text;/.test(betaLib),
);
check(
  "7. the modal appends the env block to the SUBMITTED message AND note (not the textarea state)",
  /message: appendEnvironmentBlock\(message, envDetail\)/.test(modal) &&
    /note: appendEnvironmentBlock\(note, envDetail\)/.test(modal),
);
check(
  "8. the modal shows a concise auto line 「使用環境（自動取得）」 and asks for NO device/OS/browser field",
  /使用環境（自動取得）/.test(modal) &&
    /feedbackEnvironmentSummary\(environment\)/.test(modal) &&
    !/(端末|機種|デバイス|OS|ブラウザ)\s*(名)?\s*(を|：|:)\s*(入力|ご記入|教えて)/.test(modal),
);
check(
  "9. textareas reserve room so message+block always fits the server cap",
  /maxLength=\{messageMaxLen\}/.test(modal) &&
    /maxLength=\{noteMaxLen\}/.test(modal) &&
    /MAX_MESSAGE_LENGTH - FEEDBACK_ENV_BLOCK_RESERVE/.test(modal) &&
    /MAX_REVIEW_NOTE_LENGTH - FEEDBACK_ENV_BLOCK_RESERVE/.test(modal),
);
check(
  "10. environment is collected once via an SSR-safe lazy initializer (no setState-in-effect); a failed detection still submits (empty detail ⇒ no-op append)",
  /const \[environment\] = useState<FeedbackEnvironment>\(\(\) =>\s*collectFeedbackEnvironment\(\)\s*\)/.test(modal) &&
    /if \(!detail\.trim\(\)\) return text;/.test(betaLib),
);
check(
  "11. FRONTEND-ONLY — no Supabase / Edge / Turnstile / schema / migration touched by this loop",
  !/supabase\/functions|migration|\.sql\b|turnstile/i.test(envLib) &&
    // betaFeedbackClient still sends the SAME clientContext shape (appVersion/path/viewport)
    /return \{ appVersion: BETA_FEEDBACK_APP_VERSION, path, viewport \};/.test(client),
);
check(
  "12. the Edge Function is unchanged (still reads only appVersion/path/viewport from clientContext)",
  /clientContext: \{ appVersion\?: string; path\?: string; viewport\?: string \}/.test(edge) &&
    !/environment|osFamily|deviceClass|userAgentData/.test(edge),
);

console.log("");
if (failures === 0) console.log("All TSP-030 feedback-environment checks passed.");
else {
  console.log(`${failures} TSP-030 check(s) FAILED.`);
  process.exit(1);
}
