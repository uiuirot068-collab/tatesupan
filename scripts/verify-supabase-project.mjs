// TSP-LOOP-017 — canonical Supabase project guard.
//
// TateSpun's backend (Auth + projects + user_plans + manuscript_cloud_images +
// Storage + Edge Functions) is migrating onto the canonical SpunTales project
// so a SpunTales account works in TateSpun with no second sign-up.
//
//   CANONICAL (SpunTales) : vjgxrqgnbgnewfvissgd
//   ROLLBACK  (old TateSpun): rgvqquuthovqjqfogfra
//
// This gate checks NEXT_PUBLIC_SUPABASE_URL (from the environment, else
// .env.local) points at the canonical project — or, until the flip is done,
// at the documented rollback project. Anything else (typo, placeholder, a
// third project) FAILS.
//
// After the production flip to vjg…, set TATESPUN_LOCK_CANONICAL=1 (in CI /
// the shell) to make the rollback project a hard failure too.
//
// Run:  node scripts/verify-supabase-project.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CANONICAL_REF = "vjgxrqgnbgnewfvissgd"; // SpunTales — canonical
const ROLLBACK_REF = "rgvqquuthovqjqfogfra"; // old separate TateSpun
const LOCKED = process.env.TATESPUN_LOCK_CANONICAL === "1";

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
};

function readEnvLocalUrl() {
  const p = path.join(repoRoot, ".env.local");
  if (!fs.existsSync(p)) return null;
  const line = fs
    .readFileSync(p, "utf8")
    .split(/\r?\n/)
    .find((l) => /^\s*NEXT_PUBLIC_SUPABASE_URL\s*=/.test(l));
  return line ? line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "") : null;
}

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || readEnvLocalUrl() || "").trim();
const ref = (url.match(/^https:\/\/([a-z0-9]{20})\.supabase\.co\/?$/i) || [])[1] || null;

console.log(`source URL: ${url || "(none found — set NEXT_PUBLIC_SUPABASE_URL or .env.local)"}`);
console.log(`project ref: ${ref ?? "(unrecognised)"}   locked-to-canonical: ${LOCKED}`);
console.log("");

check(
  "1. NEXT_PUBLIC_SUPABASE_URL is a well-formed https://<ref>.supabase.co",
  ref !== null,
);
check(
  LOCKED
    ? "2. project ref is the canonical SpunTales project (rollback is now locked out)"
    : "2. project ref is the canonical SpunTales project OR the documented rollback",
  ref === CANONICAL_REF || (!LOCKED && ref === ROLLBACK_REF),
);
check(
  "3. no third/placeholder project ref",
  ref === CANONICAL_REF || ref === ROLLBACK_REF,
);

// The app must not hard-code a project ref anywhere in src/ — it is env-only.
const srcHits = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) walk(fp);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
      const t = fs.readFileSync(fp, "utf8");
      if (t.includes(CANONICAL_REF) || t.includes(ROLLBACK_REF)) {
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

console.log("");
if (failures === 0) {
  console.log(
    ref === CANONICAL_REF
      ? "canonical Supabase project OK (vjg…)."
      : "on the rollback project (rgv…) — expected only until the LOOP-017 flip.",
  );
} else {
  console.log(`${failures} supabase-project check(s) FAILED.`);
  process.exit(1);
}
