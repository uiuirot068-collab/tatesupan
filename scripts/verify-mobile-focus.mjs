// TSP-LOOP-012 (rev. TSP-LOOP-020) — mobile focus mode ("集中モード") gate.
//
// TSP-LOOP-020 folded TSP-012's `MobileFocusBar` into `MobileEditorNav` — a
// sticky phone-only nav that KEEPS every capability the focus bar had
// (per-device localStorage focus preference, one-tap enter/exit, save-status,
// works-list link, cloud save, 報告 wired to the shared handler) and adds the
// primary 本文 / プレビュー / 設定 navigation. This gate tracks that rename +
// the preserved guarantees, and that desktop / tablet-wide is untouched.
//
// Run:  node scripts/verify-mobile-focus.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
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

const hook = read("src/hooks/useMobileFocusMode.ts");
const nav = read("src/components/MobileEditorNav.tsx");
const editor = read("src/components/TategakiEditor.tsx");
const pane = read("src/components/EditorPane.tsx");

/* ---------------- 1. preference: local, safe default (unchanged from TSP-012) ---------------- */

check("1. useMobileFocusMode hook exists", hook !== null);
check(
  "1b. preference is stored under a tatespun_ localStorage key",
  !!hook && /localStorage\b/.test(hook) && /"tatespun_mobile_focus"/.test(hook)
);
check(
  "1c. default OFF — read requires an explicit \"on\" and catch falls back to false",
  !!hook &&
    /getItem\([^)]*\)\s*===\s*"on"/.test(hook) &&
    /catch\s*\{\s*return false;/.test(hook)
);
check(
  "1d. preference never goes to Supabase / network",
  !!hook &&
    !/from ["'][^"']*supabase/i.test(hook) &&
    !/\bfetch\(|createClient\(|\.from\(/.test(hook)
);
check(
  "1e. SSR-safe: server snapshot is the OFF default",
  !!hook && /useSyncExternalStore\(subscribe, readFocus, \(\) => false\)/.test(hook)
);

/* ---------------- 2. the phone nav (was MobileFocusBar) ---------------- */

check("2. MobileEditorNav component exists (MobileFocusBar renamed)", nav !== null);
check("2a. old MobileFocusBar.tsx is gone", read("src/components/MobileFocusBar.tsx") === null);
check(
  "2b. nav is phone-only (md:hidden) and sticky (always reachable from any gesture)",
  !!nav && /\bmd:hidden\b/.test(nav) && /\bsticky\b/.test(nav) && /\btop-0\b/.test(nav)
);
check(
  "2c. nav offers an enter control (集中モード) and a one-tap exit (通常表示に戻す)",
  !!nav && /集中モード/.test(nav) && /通常表示に戻す/.test(nav)
);
check(
  "2d. nav shows save-status and keeps works-list + cloud save reachable",
  !!nav && /saveStatus/.test(nav) && /href="\/"/.test(nav) && /onSave/.test(nav)
);
check(
  "2e. exit control restores full UI in one action (onExitFocus wired to a button)",
  !!nav && /onClick=\{focusMode \? onExitFocus : onEnterFocus\}/.test(nav)
);
check(
  "2f. nav has a「報告」button wired to an injected handler — NOT its own modal / state",
  !!nav &&
    /onOpenFeedback/.test(nav) &&
    /onClick=\{onOpenFeedback\}/.test(nav) &&
    />\s*報告\s*</.test(nav) &&
    !/BetaFeedbackModal|useState/.test(nav)
);
check(
  "2g. nav adds the primary 本文 / プレビュー / 設定 navigation",
  !!nav &&
    /onShowEditor/.test(nav) &&
    /onShowPreview/.test(nav) &&
    /onShowSettings/.test(nav) &&
    /本文/.test(nav) &&
    /プレビュー/.test(nav) &&
    /設定/.test(nav)
);

/* ---------------- 3. editor wiring is narrow-only ---------------- */

check(
  "3. editor imports the hook and the nav",
  !!editor &&
    /useMobileFocusMode/.test(editor) &&
    /import MobileEditorNav from "\.\/MobileEditorNav"/.test(editor)
);
check(
  "3b. header is only collapsed on narrow viewports (md:contents keeps desktop layout)",
  !!editor && /focusMode \? "hidden md:contents" : "contents"/.test(editor)
);
check(
  "3c. entering focus mode also resets the phone to the editor view (no trapped/overlapping pane)",
  !!editor && /setFocusMode\(true\);\s*setMobileView\("editor"\);/.test(editor)
);
check(
  "3d. editor passes focusMode to EditorPane and the canonical feedback handler to the nav",
  !!editor &&
    /<EditorPane[\s\S]{0,1200}?focusMode=\{focusMode\}/.test(editor) &&
    /onOpenFeedback=\{\s*BETA_FEEDBACK_ENABLED \? \(\) => setIsBetaFeedbackOpen\(true\) : undefined/.test(
      editor
    )
);
check(
  "3e. the「本文を書く」action never autofocuses on load — focus() only from the direct tap handler",
  !!pane &&
    /goToManuscript/.test(pane) &&
    /\.scrollIntoView\(/.test(pane) &&
    /onClick=\{goToManuscript\}/.test(pane) &&
    !/useEffect\([\s\S]{0,200}\.focus\(\)/.test(pane)
);

/* ---------------- 3h/3i. EditorPane strips are removed at zero height, < md only ---------------- */

check(
  "3h. EditorPane accepts focusMode (defaulting false) — desktop path unchanged",
  !!pane && /focusMode\?: boolean/.test(pane) && /focusMode = false/.test(pane)
);
check(
  "3i. focus mode removes the title/toolbar strip AND the PageSettings/help strip via max-md:hidden",
  !!pane &&
    (pane.match(/focusMode \? "max-md:hidden" : ""/g) || []).length >= 2 &&
    !/opacity-0|invisible|sr-only/.test((pane.match(/focusMode[^\n]*\n/g) || []).join(""))
);
check(
  "3j. those strips are only hidden on narrow (max-md:hidden), never a bare md:hidden",
  !!pane && !/focusMode \? "md:hidden"/.test(pane)
);

/* ---------------- 4. safety: nothing forbidden was touched ---------------- */

check(
  "4. no renderer / pagination / export / Supabase / auth / feedback-backend / cloud-image files changed",
  (() => {
    try {
      const diff = execSync("git diff --name-only HEAD", { cwd: repoRoot })
        .toString()
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      const forbidden =
        /^(src\/lib\/tategaki\.ts|src\/lib\/pageLayout\.ts|src\/lib\/colophon\.ts|src\/lib\/writingCheck\.ts|src\/lib\/cloudImageSync\.ts|src\/lib\/betaFeedback|src\/lib\/supabase\/|src\/components\/PageCard\.tsx|src\/components\/PreviewPaneNew\.tsx|src\/components\/AuthProvider\.tsx|src\/components\/AuthModal\.tsx|src\/components\/BetaFeedbackModal\.tsx|src\/utils\/export|src\/app\/renderer-poc|supabase\/)/;
      return !diff.some((f) => forbidden.test(f));
    } catch {
      return true;
    }
  })()
);
check(
  "4c. editor still uses the canonical EditorPane / PreviewPane and the shared Header",
  !!editor &&
    /import EditorPane from "\.\/EditorPane"/.test(editor) &&
    /import PreviewPane from "\.\/PreviewPane"/.test(editor) &&
    /<EditorPane\b/.test(editor) &&
    /<PreviewPane\b/.test(editor) &&
    /<Header\b/.test(editor)
);
check(
  "4d. single beta-feedback modal — still one <BetaFeedbackModal> mount, gated by the same flag + state",
  !!editor &&
    (editor.match(/<BetaFeedbackModal\b/g) || []).length === 1 &&
    /BETA_FEEDBACK_ENABLED && isBetaFeedbackOpen && \(\s*<BetaFeedbackModal/.test(editor) &&
    (editor.match(/setIsBetaFeedbackOpen\(true\)/g) || []).length >= 1
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All mobile-focus checks passed.");
} else {
  console.log(`${failures} mobile-focus check(s) FAILED.`);
  process.exit(1);
}
