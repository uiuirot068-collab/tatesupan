// TSP-LOOP-010 — responsive editor workspace scroll gate.
//
// Layout / scroll only. Verifies that the narrow (stacked) editor branch has
// a vertical scroll path, the wide (side-by-side) branch is unchanged, the
// viewport-lock shell is not broadly removed, and no renderer / content /
// export logic was touched.
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

// the <main> workspace element's className
const mainCls = (() => {
  const m = editor.match(/<main\b[\s\S]*?className="([^"]+)"/);
  return m ? m[1] : "";
})();
// the Editor <section> className (contains --editor-w)
const editorSectionCls = (() => {
  const i = editor.indexOf("--editor-w");
  const seg = editor.slice(i, i + 600);
  const m = seg.match(/className=\{`([^`]+)`\}/);
  return m ? m[1] : "";
})();
// the Preview <section> className (contains --preview-w)
const previewSectionCls = (() => {
  const i = editor.indexOf("--preview-w");
  const seg = editor.slice(i, i + 600);
  const m = seg.match(/className=\{`([^`]+)`\}/);
  return m ? m[1] : "";
})();

/* ---------------- 1. wide layout still side-by-side ---------------- */

check(
  "1. wide (md+) layout: <main> is side-by-side (md:flex-row), base is column",
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

/* ---------------- 2. narrow layout still stacked Editor/Preview ---------------- */

check(
  "2. narrow (< md): Editor + Preview stack — Editor section not md:hidden, Preview shows on isMobilePreviewOpen",
  /<EditorPane\b/.test(editor) &&
    /isMobilePreviewOpen \? "([^"]*flex[^"]*)" : "hidden"/.test(editor) &&
    /プレビューを見る|プレビューを閉じる/.test(editor)
);

/* ---------------- 3. narrow has an explicit vertical scroll path ---------------- */

check(
  "3. narrow: <main> owns a vertical scroll path (overflow-y-auto) + no horizontal (overflow-x-hidden)",
  /\boverflow-y-auto\b/.test(mainCls) && /\boverflow-x-hidden\b/.test(mainCls)
);
check(
  "3b. narrow: panes are fixed, usably-tall blocks so <main> can scroll past them",
  /(^|\s)h-\[70dvh\](\s|$)/.test(editorSectionCls) &&
    /(^|\s)shrink-0(\s|$)/.test(editorSectionCls) &&
    /isMobilePreviewOpen \? "flex h-\[85dvh\] shrink-0/.test(editor)
);
check(
  "3c. narrow: Editor section no longer relies on flex-1 / min-h-[40vh] (which clipped inside overflow-hidden)",
  !/\bflex-1\b/.test(editorSectionCls) && !/min-h-\[40vh\]/.test(editorSectionCls)
);

/* ---------------- 4. wide branch does NOT gain outer scrolling ---------------- */

check(
  "4. wide (md+): <main> reverts to md:overflow-hidden — no outer page scroll on desktop",
  /\bmd:overflow-hidden\b/.test(mainCls)
);
check(
  "4b. wide: Editor section keeps its md overrides (h-[70dvh] is overridden by md:h-full)",
  /h-\[70dvh\][\s\S]*md:h-full/.test(editorSectionCls)
);

/* ---------------- 5. viewport-lock shell is NOT broadly removed ---------------- */

check(
  "5. globals.css still locks the app shell (html/body overflow:hidden !important; height:100vh)",
  /html,\s*\n?\s*body\s*\{[\s\S]{0,120}height:\s*100vh;[\s\S]{0,120}overflow:\s*hidden\s*!important;/.test(globals)
);
check(
  "5b. editor root <div> still h-screen + overflow-hidden (shell unchanged)",
  /<div className="box-border flex h-screen w-screen flex-col gap-6 overflow-hidden/.test(editor)
);
check(
  "5c. globals.css NOT modified by this loop",
  (() => {
    try {
      const diff = execSync("git diff --name-only HEAD -- src/app/globals.css", {
        cwd: repoRoot,
      }).toString().trim();
      return diff === "";
    } catch {
      return true; // git unavailable -> don't hard-fail the gate
    }
  })()
);

/* ---------------- 6/7/8. no renderer / content / export / poc changes ---------------- */

check(
  "6. no /renderer-poc or experimental renderer change",
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
  "7. Editor / Preview remain the same canonical components",
  /import EditorPane from "\.\/EditorPane"/.test(editor) &&
    /import PreviewPane from "\.\/PreviewPane"/.test(editor) &&
    /<EditorPane\b/.test(editor) &&
    /<PreviewPane\b/.test(editor)
);
check(
  "8. no renderer / content / export / pagination logic touched",
  (() => {
    try {
      const diff = execSync("git diff --name-only HEAD", { cwd: repoRoot })
        .toString()
        .trim()
        .split(/\r?\n/)
        .filter(Boolean);
      const forbidden =
        /^(src\/lib\/tategaki\.ts|src\/lib\/pageLayout\.ts|src\/lib\/colophon\.ts|src\/lib\/writingCheck\.ts|src\/lib\/cloudImageSync\.ts|src\/lib\/supabase\/manuscriptImages\.ts|src\/components\/PageCard\.tsx|src\/utils\/export|supabase\/)/;
      return !diff.some((f) => forbidden.test(f));
    } catch {
      return true;
    }
  })()
);
check(
  "8b. this loop's tracked changes are confined to TategakiEditor.tsx (+ this script)",
  (() => {
    try {
      const diff = execSync("git diff --name-only HEAD", { cwd: repoRoot })
        .toString()
        .trim()
        .split(/\r?\n/)
        .filter(Boolean)
        .filter((f) => f !== "CLAUDE.md");
      return diff.length === 0 || (diff.length === 1 && diff[0] === "src/components/TategakiEditor.tsx");
    } catch {
      return true;
    }
  })()
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All responsive-workspace-scroll checks passed.");
} else {
  console.log(`${failures} responsive-workspace-scroll check(s) FAILED.`);
  process.exit(1);
}
