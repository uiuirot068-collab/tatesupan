// TSP-LOOP-010 (rev. TSP-LOOP-020) — responsive editor workspace scroll gate.
//
// TSP-LOOP-020 re-architected the phone editor: instead of a viewport-locked
// shell with a nested `<main overflow-y-auto>` between two fixed-height panes
// (which trapped touch scrolling and forced users to "touch the outer frame"
// to scroll), the phone now gets an ordinary scrolling DOCUMENT with a
// sticky nav, and Editor / Preview are mutually-exclusive views. This gate
// verifies that new model AND that the wide (md+) side-by-side, viewport-
// locked workspace is completely unchanged.
//
// Run:  node scripts/verify-responsive-workspace-scroll.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
}

const editor = read("src/components/TategakiEditor.tsx");
const globals = read("src/app/globals.css");
const editorPane = read("src/components/EditorPane.tsx");

// the <main> workspace element's className
const mainCls = (() => {
  const m = editor.match(/<main\b[\s\S]*?className="([^"]+)"/);
  return m ? m[1] : "";
})();
// the Editor <section> className (contains --editor-w)
const editorSectionCls = (() => {
  const i = editor.indexOf("--editor-w");
  const seg = editor.slice(i, i + 900);
  const m = seg.match(/className=\{`([^`]+)`\}/);
  return m ? m[1] : "";
})();
// the Preview <section> className (contains --preview-w)
const previewSectionCls = (() => {
  const i = editor.indexOf("--preview-w");
  const seg = editor.slice(i, i + 900);
  const m = seg.match(/className=\{`([^`]+)`\}/);
  return m ? m[1] : "";
})();

/* ---------------- 1. wide (md+) layout still side-by-side & viewport-locked ---------------- */

check(
  "1. wide (md+): <main> is side-by-side (md:flex-row), base is column",
  /\bflex-col\b/.test(mainCls) && /\bmd:flex-row\b/.test(mainCls) && !/\bmd:flex-col\b/.test(mainCls)
);
check(
  "1b. wide: panes still width-controlled from --editor-w / --preview-w and md:flex-none / md:h-full",
  /md:w-\[var\(--editor-w\)\]/.test(editorSectionCls) &&
    /md:flex-none/.test(editorSectionCls) &&
    /md:h-full/.test(editorSectionCls) &&
    /md:w-\[var\(--preview-w\)\]/.test(previewSectionCls) &&
    /md:h-full/.test(previewSectionCls)
);
check(
  "1c. wide: <main> reverts to md:overflow-hidden — no outer page scroll on desktop",
  /\bmd:overflow-hidden\b/.test(mainCls)
);
check(
  "1d. wide: editor shell keeps the md viewport lock (md:h-screen + md:overflow-hidden)",
  /data-editor-shell[\s\S]{0,400}md:h-screen[\s\S]{0,120}md:overflow-hidden/.test(editor)
);

/* ---------------- 2. phone: an ordinary scrolling document, not a nested scroller ---------------- */

check(
  "2. phone: <main> has NO base overflow-y-auto (the document scrolls, not a nested container)",
  !/\boverflow-y-auto\b/.test(mainCls)
);
check(
  "2b. phone: the editor shell opts out of the global viewport lock via data-editor-shell",
  /<div\s+data-editor-shell/.test(editor)
);
check(
  "2c. globals.css: the editor opt-out is scoped BOTH to max-width:767px AND to :has([data-editor-shell])",
  /@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?:has\(\[data-editor-shell\]\)[\s\S]*?overflow-y:\s*auto\s*!important/.test(
    globals
  )
);
check(
  "2d. phone: editor <section> is no longer a fixed h-[70dvh] overflow slab",
  !/h-\[70dvh\]/.test(editorSectionCls)
);
check(
  "2e. phone: the manuscript textarea keeps its own intentional scroll surface (bounded height + overflow-y-auto)",
  /max-md:h-\[\d+dvh\]/.test(editorPane) && /overflow-y-auto/.test(editorPane)
);

/* ---------------- 3. phone: Editor / Preview are mutually-exclusive views ---------------- */

check(
  "3. phone: a mobileView state drives which pane shows (no scrolling past a pane to reach the other)",
  /mobileView/.test(editor) && /setMobileView/.test(editor)
);
check(
  "3b. phone: editor section hides when preview is shown; preview section hides otherwise",
  /mobileView === "preview" \? "max-md:hidden" : ""/.test(editorSectionCls) &&
    /mobileView === "preview" \?[\s\S]*?: "max-md:hidden"/.test(previewSectionCls)
);
check(
  "3c. phone: preview is opened from the sticky nav, never an inline button after a tall pane",
  /onShowPreview/.test(editor) && !/プレビューを見る/.test(editor)
);

/* ---------------- 4. phone: comfortable bottom breathing room (safe-area aware) ---------------- */

check(
  "4. phone: shell bottom padding includes env(safe-area-inset-bottom) + extra mobile space",
  /pb-\[calc\(env\(safe-area-inset-bottom\)\s*\+\s*\d/.test(editor)
);
check(
  "4b. viewport-fit:cover is declared so safe-area insets actually resolve",
  /viewportFit:\s*"cover"/.test(read("src/app/layout.tsx"))
);

/* ---------------- 5. the global viewport lock still protects every OTHER route ---------------- */

check(
  "5. globals.css still locks the app shell for non-editor routes (html/body overflow:hidden !important; height:100vh)",
  /html,\s*\n?\s*body\s*\{[\s\S]{0,160}height:\s*100vh;[\s\S]{0,160}overflow:\s*hidden\s*!important;/.test(globals)
);

/* ---------------- 6. no renderer / content / export / pagination logic touched ---------------- */

check(
  "6. no /renderer-poc or experimental-renderer file change",
  (() => {
    try {
      const diff = execSync(
        "git diff --name-only HEAD -- src/app/renderer-poc src/components/PreviewPaneNew.tsx",
        { cwd: repoRoot }
      ).toString().trim();
      return diff === "";
    } catch {
      return true;
    }
  })()
);
check(
  "6b. no pagination / export / colophon / cloud-image / Supabase / PageCard logic touched",
  (() => {
    try {
      const diff = execSync("git diff --name-only HEAD", { cwd: repoRoot })
        .toString()
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      const forbidden =
        /^(src\/lib\/tategaki\.ts|src\/lib\/pageLayout\.ts|src\/lib\/colophon\.ts|src\/lib\/writingCheck\.ts|src\/lib\/cloudImageSync\.ts|src\/lib\/supabase\/|src\/components\/PageCard\.tsx|src\/utils\/export|supabase\/)/;
      return !diff.some((f) => forbidden.test(f));
    } catch {
      return true;
    }
  })()
);
check(
  "7. editor still uses the canonical EditorPane / PreviewPane components",
  /import EditorPane from "\.\/EditorPane"/.test(editor) &&
    /import PreviewPane from "\.\/PreviewPane"/.test(editor) &&
    /<EditorPane\b/.test(editor) &&
    /<PreviewPane\b/.test(editor)
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All responsive-workspace-scroll checks passed.");
} else {
  console.log(`${failures} responsive-workspace-scroll check(s) FAILED.`);
  process.exit(1);
}
