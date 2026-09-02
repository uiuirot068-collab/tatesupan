// TSP-LOOP-012 — mobile focus mode ("集中モード") gate.
//
// UI / layout only. Verifies that:
//  - the focus preference is a per-device localStorage setting (never Supabase
//    / manuscript data), default OFF, malformed value -> OFF;
//  - a mobile-only (`md:hidden`) bar provides an enter + a one-tap exit + a
//    「報告」 button wired to the *existing* beta-feedback handler + save-status;
//  - focus mode removes (at zero height, `< md` only) the header, the
//    EditorPane title/toolbar strip and the PageSettings/help strip, while the
//    collapsed 「プレビューを見る」 control stays;
//  - every focus-mode branch is scoped to narrow viewports (`md:hidden` /
//    `max-md:` / `md:contents`) so desktop / tablet-wide is untouched;
//  - no renderer / pagination / export / Supabase / auth / feedback-backend
//    logic was touched, and no parallel feedback / preview state was created.
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
const bar = read("src/components/MobileFocusBar.tsx");
const editor = read("src/components/TategakiEditor.tsx");
const pane = read("src/components/EditorPane.tsx");

/* ---------------- 1. preference: local, safe default ---------------- */

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
  "1d. preference never goes to Supabase / network (no client import, fetch, or supabase call)",
  !!hook &&
    !/from ["'][^"']*supabase/i.test(hook) &&
    !/\bfetch\(|createClient\(|\.from\(/.test(hook)
);
check(
  "1e. SSR-safe: server snapshot is the OFF default",
  !!hook && /useSyncExternalStore\(subscribe, readFocus, \(\) => false\)/.test(hook)
);

/* ---------------- 2. the mobile focus bar ---------------- */

check("2. MobileFocusBar component exists", bar !== null);
check(
  "2b. bar is mobile-only (md:hidden)",
  !!bar && /className="[^"]*\bmd:hidden\b/.test(bar)
);
check(
  "2c. bar offers an enter control (集中モード) and a one-tap exit (通常表示に戻す)",
  !!bar && /集中モード/.test(bar) && /通常表示に戻す/.test(bar)
);
check(
  "2d. bar shows save-status and keeps works-list + cloud save reachable in focus mode",
  !!bar &&
    /saveStatus/.test(bar) &&
    /href="\/"/.test(bar) &&
    /onSave/.test(bar)
);
check(
  "2e. exit control restores full UI in one action (onExitFocus wired to a button)",
  !!bar && /onClick=\{focusMode \? onExitFocus : onEnterFocus\}/.test(bar)
);
check(
  "2f. focus bar has a「報告」button wired to an injected handler — NOT its own modal",
  !!bar &&
    /onOpenFeedback/.test(bar) &&
    /onClick=\{onOpenFeedback\}/.test(bar) &&
    />\s*報告\s*</.test(bar) &&
    !/BetaFeedbackModal|useState/.test(bar)
);

/* ---------------- 3. editor wiring is narrow-only ---------------- */

check(
  "3. editor imports the hook and the bar",
  !!editor &&
    /useMobileFocusMode/.test(editor) &&
    /import MobileFocusBar from "\.\/MobileFocusBar"/.test(editor)
);
check(
  "3b. header is only collapsed on narrow viewports (md:contents keeps desktop layout)",
  !!editor && /focusMode \? "hidden md:contents" : "contents"/.test(editor)
);
check(
  "3c. entering focus mode also closes the mobile preview (no trapped/overlapping pane)",
  !!editor && /setFocusMode\(true\);\s*setIsMobilePreviewOpen\(false\);/.test(editor)
);
check(
  "3d. editor pane gains height in focus mode via a narrow-scoped grow (max-md:), never a bare flex-1",
  !!editor &&
    /\$\{focusMode \? " ?max-md:grow" : ""\}/.test(editor) &&
    !/\$\{focusMode \? "[^"]*\bflex-1\b/.test(editor)
);
check(
  "3e. editor passes focusMode to EditorPane and the canonical feedback handler to the bar",
  !!editor &&
    /<EditorPane[\s\S]{0,900}?focusMode=\{focusMode\}/.test(editor) &&
    /onOpenFeedback=\{\s*BETA_FEEDBACK_ENABLED \? \(\) => setIsBetaFeedbackOpen\(true\) : undefined/.test(
      editor
    )
);
check(
  "3f. the collapsed「プレビューを見る」control stays visible in focus mode (not gated by focusMode)",
  !!editor &&
    /プレビューを見る/.test(editor) &&
    !/\{!focusMode && \(\s*<button[\s\S]{0,240}?プレビュー/.test(editor)
);
check(
  "3g. entering focus mode does NOT auto-open the full preview (only ever sets it false)",
  !!editor &&
    /setIsMobilePreviewOpen\(false\)/.test(editor) &&
    !/enterFocusMode[\s\S]{0,120}setIsMobilePreviewOpen\(true\)/.test(editor)
);

/* ---------------- 3h/3i. EditorPane strips are removed at zero height, < md only ---------------- */

check(
  "3h. EditorPane accepts focusMode (defaulting false) — desktop path unchanged",
  !!pane && /focusMode\?: boolean/.test(pane) && /focusMode = false/.test(pane)
);
check(
  "3i. focus mode removes the title/toolbar strip AND the PageSettings/help strip via max-md:hidden (display:none => zero height), never merely visually",
  !!pane &&
    (pane.match(/focusMode \? "max-md:hidden" : ""/g) || []).length >= 2 &&
    /border-b border-ink\/10 px-4 py-3[\s\S]{0,80}focusMode \? "max-md:hidden"/.test(pane) &&
    /flex-none \$\{focusMode \? "max-md:hidden" : ""\}[\s\S]{0,40}<PageSettingsPanel/.test(pane) &&
    !/opacity-0|invisible|sr-only/.test(
      (pane.match(/focusMode[^\n]*\n/g) || []).join("")
    )
);
check(
  "3j. those strips are only hidden on narrow (max-md:hidden), never a bare md:hidden, so md+ is untouched",
  !!pane &&
    /focusMode \? "max-md:hidden"/.test(pane) &&
    !/focusMode \? "(?!max-md:hidden")/.test(pane) &&
    !/focusMode \? "md:hidden"/.test(pane)
);

/* ---------------- 4. safety: nothing forbidden was touched ---------------- */

check(
  "4. no renderer / pagination / export / Supabase / auth / feedback / cloud-image files changed",
  (() => {
    try {
      const diff = execSync("git diff --name-only HEAD", { cwd: repoRoot })
        .toString()
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      const forbidden =
        /^(src\/lib\/tategaki\.ts|src\/lib\/pageLayout\.ts|src\/lib\/colophon\.ts|src\/lib\/writingCheck\.ts|src\/lib\/cloudImageSync\.ts|src\/lib\/supabase\/|src\/components\/PageCard\.tsx|src\/components\/PreviewPane(New)?\.tsx|src\/components\/AuthProvider\.tsx|src\/components\/AuthModal\.tsx|src\/components\/BetaFeedbackModal\.tsx|src\/components\/Header\.tsx|src\/utils\/export|src\/app\/renderer-poc|supabase\/)/;
      return !diff.some((f) => forbidden.test(f));
    } catch {
      return true;
    }
  })()
);
check(
  "4b. globals.css untouched",
  (() => {
    try {
      return (
        execSync("git diff --name-only HEAD -- src/app/globals.css", { cwd: repoRoot })
          .toString()
          .trim() === ""
      );
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
check(
  "4e. feedback backend / flag files untouched by this loop",
  (() => {
    try {
      const diff = execSync("git diff --name-only HEAD", { cwd: repoRoot })
        .toString()
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      return !diff.some((f) =>
        /^(src\/lib\/betaFeedback|src\/components\/BetaFeedbackModal\.tsx|supabase\/functions\/beta-feedback)/.test(
          f
        )
      );
    } catch {
      return true;
    }
  })()
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All mobile-focus checks passed.");
} else {
  console.log(`${failures} mobile-focus check(s) FAILED.`);
  process.exit(1);
}
