// TateSpun canonical Supabase project guard.
//
// TateSpun's backend (Auth + projects + user_plans + manuscript_cloud_images,
// Storage, and Edge Functions) belongs to the project named `tatespun`.
//
//   CANONICAL (TateSpun): rgvqquuthovqjqfogfra
//
// This gate checks NEXT_PUBLIC_SUPABASE_URL (from the environment, else
// .env.local) points at that exact project. Anything else (including the
// unrelated project previously documented as canonical) FAILS.
//
// Run:  node scripts/verify-supabase-project.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CANONICAL_REF = "rgvqquuthovqjqfogfra"; // project name: tatespun

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
};

function readEnvLocalVar(name) {
  const p = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(p)) return null;
  const re = new RegExp(`^\\s*${name}\\s*=`);
  const line = fs.readFileSync(p, "utf8").split(/\r?\n/).find((l) => re.test(l));
  return line ? line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") : null;
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || readEnvLocalVar("NEXT_PUBLIC_SUPABASE_URL") || "").trim();
const ref = (url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/i) || [])[1] || null;

console.log(`source URL: ${url || "(none found — set NEXT_PUBLIC_SUPABASE_URL or .env.local)"}`);
console.log(`project ref: ${ref ?? "(unrecognised)"}`);
console.log("");

check(
  "1. NEXT_PUBLIC_SUPABASE_URL is a well-formed https://<ref>.supabase.co",
  ref !== null,
);
check(
  "2. project ref is the canonical TateSpun project",
  ref === CANONICAL_REF,
);
check(
  "3. no unrelated/placeholder project ref",
  ref === CANONICAL_REF,
);

// The app must not hard-code a project ref anywhere in src/ — it is env-only.
const srcHits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      const t = fs.readFileSync(fp, "utf8");
      if (/https:\/\/[a-z0-9]{20}\.supabase\.co/i.test(t)) {
        srcHits.push(path.relative(repoRoot, fp));
      }
    }
  }
};
walk(path.join(repoRoot, "src"));
check(
  "4. no Supabase project ref hard-coded in src/ (must stay NEXT_PUBLIC_SUPABASE_URL-only)",
  srcHits.length === 0 || (console.log(`   hard-coded in: ${srcHits.join(", ")}`), false),
);

// TSP-LOOP-019 — β feedback は Turnstile 必須。フラグを true にしたビルドで
// NEXT_PUBLIC_TURNSTILE_SITE_KEY が無いと、デプロイ後のフィードバックモーダルが
// トークンを作れず、サーバ検証が全リクエストを拒否してしまう。site key は
// 公開値なのでここで存在チェックのみ（値はハードコードしない）。
const feedbackEnabled =
  (process.env.NEXT_PUBLIC_BETA_FEEDBACK_ENABLED ??
    readEnvLocalVar("NEXT_PUBLIC_BETA_FEEDBACK_ENABLED") ??
    "").trim() === "true";
const turnstileSiteKey = (
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ??
  readEnvLocalVar("NEXT_PUBLIC_TURNSTILE_SITE_KEY") ??
  ""
).trim();
const placeholderKey = turnstileSiteKey === "" || turnstileSiteKey === "your-turnstile-site-key";
check(
  feedbackEnabled
    ? "5. β feedback ENABLED ⇒ NEXT_PUBLIC_TURNSTILE_SITE_KEY is set (Turnstile protection)"
    : "5. β feedback disabled — Turnstile site key not required for this build",
  !feedbackEnabled || !placeholderKey,
);
const anonKey = (
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  readEnvLocalVar("NEXT_PUBLIC_SUPABASE_ANON_KEY") ??
  ""
).trim();
const placeholderAnonKey = anonKey === "" || anonKey.startsWith("your-");
check(
  feedbackEnabled
    ? "6. β feedback ENABLED → NEXT_PUBLIC_SUPABASE_ANON_KEY is a real production public key"
    : "6. β feedback disabled — production anon key not required for this build",
  !feedbackEnabled || !placeholderAnonKey,
);

console.log("");
if (failures === 0) {
  console.log("canonical TateSpun Supabase project OK (rgv…).");
} else {
  console.log(`${failures} supabase-project check(s) FAILED.`);
  process.exit(1);
}
