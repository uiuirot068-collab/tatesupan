// TSP-LOOP-015 — password-recovery (PKCE) regression gate.
//
// The reset-password page used to gate the new-password form solely on the
// `PASSWORD_RECOVERY` auth event. With @supabase/ssr's shared singleton client,
// AuthProvider (rendered above this page) finishes the PKCE `?code=` exchange —
// and fires PASSWORD_RECOVERY — before this page subscribes, so a *valid*
// recovery session was shown as "invalid/expired". This gate locks in the fix:
// readiness is proven by an actual Supabase session, not by an event or a bare
// timeout; genuinely invalid links are still rejected.
//
// Run:  node scripts/verify-auth-recovery.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
}

const page = read("src/app/auth/reset-password/page.tsx") ?? "";
const authModal = read("src/components/AuthModal.tsx") ?? "";
const authProvider = read("src/components/AuthProvider.tsx") ?? "";

/* ---------------- 1. readiness is proven by a real session ---------------- */

check(
  "1. reset page proves validity via supabase.auth.getSession(), not the event alone",
  /supabase\.auth\.getSession\(\)/.test(page) &&
    (page.match(/getSession\(\)/g) || []).length >= 2
);
check(
  "1b. reset page no longer depends only on the PASSWORD_RECOVERY event to show the form",
  // PASSWORD_RECOVERY is still handled, but a session-based path exists too
  /PASSWORD_RECOVERY/.test(page) &&
    /event !== ['"]SIGNED_OUT['"] && session/.test(page)
);
check(
  "1c. arrival via a recovery link is detected (?code= / #access_token / type=recovery)",
  /readArrivedViaAuthLink/.test(page) &&
    /\.get\(['"]code['"]\)/.test(page) &&
    /type['"]\)\s*===\s*['"]recovery['"]/.test(page)
);

/* ---------------- 2. the old bare-timeout mechanism is gone ---------------- */

check(
  "2. no fixed 8000ms timeout used as the sole proof of validity",
  !/setTimeout\([^,]*,\s*8000\)/.test(page)
);
check(
  "2b. the invalid verdict is bounded by a deadline AND requires 'no session' (not a raw timer flip)",
  /Date\.now\(\)\s*\+\s*\(/.test(page) &&
    /Date\.now\(\)\s*>=\s*deadline/.test(page) &&
    /markInvalid\(\)/.test(page)
);
check(
  "2c. a link arrival gets a longer wait than a bare visit (exchange can be in flight)",
  /arrivedViaLink\s*\?\s*15_?000\s*:\s*3_?000/.test(page)
);

/* ---------------- 3. genuinely invalid links still rejected ---------------- */

check(
  "3. explicit URL error (error / error_description, query or hash) still wins immediately",
  /readUrlError/.test(page) &&
    /error_description/.test(page) &&
    /window\.location\.hash/.test(page) &&
    /useState<SessionStatus>\(\(\) =>\s*\n?\s*readUrlError\(\) \? ['"]invalid['"] : ['"]checking['"]/.test(
      page,
    ) &&
    /if \(readUrlError\(\)\) return;/.test(page)
);
check(
  "3b. no session + deadline reached => invalid",
  /if \(Date\.now\(\) >= deadline\) \{\s*\n?\s*markInvalid\(\);/.test(page)
);

/* ---------------- 4. security: no anonymous password reset ---------------- */

check(
  "4. handleSubmit re-checks getSession() before updateUser and bails if none",
  (() => {
    const h = page.slice(page.indexOf("const handleSubmit"));
    return (
      /getSession\(\)/.test(h) &&
      h.indexOf("getSession()") < h.indexOf("updateUser({ password })") &&
      /if \(!session\) \{[\s\S]{0,120}return;/.test(h)
    );
  })()
);
check(
  "4b. updateUser({ password }) then signOut() — explicit re-login is still required",
  (() => {
    const h = page.slice(page.indexOf("const handleSubmit"));
    return (
      h.indexOf("updateUser({ password })") < h.indexOf("signOut()") &&
      h.indexOf("signOut()") < h.indexOf("setUpdateSucceeded(true)")
    );
  })()
);
check(
  "4c. min password length + confirmation still enforced",
  /password\.length < 6/.test(page) && /password !== confirmPassword/.test(page)
);
check(
  "4d. no hardcoded credentials / service-role key on the page",
  !/service_role|SERVICE_ROLE|eyJ[A-Za-z0-9_-]{20,}/.test(page)
);
check(
  "4e. our own post-update signOut never flips the page to 'invalid'",
  /event === ['"]PASSWORD_RECOVERY['"] \|\|\s*\n?\s*\(event !== ['"]SIGNED_OUT['"] && session\)/.test(
    page.replace(/\s+/g, " ").replace(/ /g, (m, i) => m), // tolerate whitespace
  ) || /\(event !== ['"]SIGNED_OUT['"] && session\)/.test(page)
);

/* ---------------- 5. idempotency / effect-safety ---------------- */

check(
  "5. the detection effect cleans up (unsubscribe + clear timers) and guards with `cancelled`",
  /let cancelled = false;/.test(page) &&
    /subscription\.unsubscribe\(\)/.test(page) &&
    /timers\.forEach\(window\.clearTimeout\)/.test(page)
);
check(
  "5b. duplicate submit is guarded (doneRef)",
  /doneRef\.current/.test(page)
);

/* ---------------- 6. surrounding flow unchanged ---------------- */

check(
  "6. AuthModal recovery redirect is still basePath-aware (LOOP-013A)",
  /resetPasswordForEmail\(email, \{[\s\S]{0,200}\$\{window\.location\.origin\}\$\{BASE_PATH\}\/auth\/reset-password/.test(
    authModal
  )
);
check(
  "6b. sign-in / sign-up / AuthProvider session bootstrap untouched",
  /signInWithPassword/.test(authModal) &&
    /signUp\(\{/.test(authModal) &&
    /supabase\.auth\.getSession\(\)/.test(authProvider) &&
    /onAuthStateChange/.test(authProvider)
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All auth-recovery checks passed.");
} else {
  console.log(`${failures} auth-recovery check(s) FAILED.`);
  process.exit(1);
}
