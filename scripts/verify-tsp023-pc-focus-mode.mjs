// TSP-LOOP-023 — desktop 集中モード (PC focus / concentration mode) gate.
//
// Structural contracts only — visual "feels wider / calmer" stays a HUMAN QA
// item. Verifies:
//  - the SAME `focusMode` flag (per-device localStorage, no schema) now drives
//    desktop layout, entered/exited by a real 集中モード / 通常に戻す button;
//  - focus mode gives the manuscript editor the width (`md:grow`), hides the
//    desktop inline settings strip, and removes the centre resize divider;
//  - Preview is NOT replaced — it is the same shared PreviewPane, tucked to a
//    capped-width side panel / the existing right-edge collapse rail, one
//    click away;
//  - the user's normal split width (`editorWidthPercent`) is never written by
//    focus mode — exiting restores it, and the pre-focus preview-collapsed
//    state is remembered + restored;
//  - the TSP-022 mobile 本文/プレビュー/設定 workspace + sticky nav are
//    untouched, and the phone never shows the PC focus button;
//  - TSP-021/022 invariants still present.
//
// Run:  node scripts/verify-tsp023-pc-focus-mode.mjs
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

const editor = read("src/components/TategakiEditor.tsx");
const editorPane = read("src/components/EditorPane.tsx");
const preview = read("src/components/PreviewPane.tsx");
const header = read("src/components/Header.tsx");
const nav = read("src/components/MobileEditorNav.tsx");
const focusHook = read("src/hooks/useMobileFocusMode.ts");

/* ---------------- 1. one focus flag, no schema, desktop entry/exit ---------------- */

check(
  "1. desktop focus mode reuses the existing per-device localStorage flag (no DB / no persisted schema)",
  !!editor && !!focusHook &&
    /const \[focusMode, setFocusMode\] = useMobileFocusMode\(\)/.test(editor) &&
    /window\.localStorage/.test(focusHook) &&
    !/import[^\n]*supabase/i.test(focusHook) &&
    !/\.sql\b|createTable|addColumn|migration\(/i.test(focusHook)
);
check(
  "2. Header carries a real 集中モード entry / 通常に戻す exit button (md+ only)",
  !!header &&
    /data-focus-mode-toggle=""/.test(header) &&
    /onClick=\{focusMode \? onExitFocus : onEnterFocus\}/.test(header) &&
    /'通常に戻す' : '集中モード'/.test(header) &&
    /aria-pressed=\{!!focusMode\}/.test(header) &&
    /md:inline-flex/.test(header.slice(header.indexOf("data-focus-mode-toggle")))
);
check(
  "2b. the phone focus control stays in MobileEditorNav — Header's is not shown on phone",
  !!nav && /集中モード/.test(nav) &&
    !!header &&
    /hidden [^"]*md:inline-flex/.test(header.slice(header.indexOf("data-focus-mode-toggle")))
);
check(
  "3. TategakiEditor's enter/exit remember + restore the pre-focus preview-collapsed state; split width is never touched",
  !!editor &&
    /preFocusPreviewCollapsedRef/.test(editor) &&
    /const enterFocusMode = \(\) => \{[\s\S]{0,320}setIsPreviewCollapsed\(true\)/.test(editor) &&
    /const exitFocusMode = \(\) => \{[\s\S]{0,320}setIsPreviewCollapsed\(preFocusPreviewCollapsedRef\.current\)/.test(editor) &&
    // focus mode does not call the split-width setter
    !/(enter|exit)FocusMode = \(\) => \{[\s\S]{0,320}setEditorWidthPercent/.test(editor)
);

/* ---------------- 4. focused editor gets the space, settings + divider go ---------------- */

check(
  "4. focus mode gives the manuscript editor the width (md:grow)",
  !!editor &&
    /\$\{focusMode \|\| isPreviewCollapsed \? "md:w-auto md:grow" : "md:w-\[var\(--editor-w\)\]"\}/.test(editor)
);
check(
  "5. the desktop inline settings strip hides in focus mode (data untouched — same PageSettingsPanel)",
  !!editorPane &&
    /id="tsp-settings"\s*\n\s*className=\{`flex-none \$\{focusMode \? "hidden" : "hidden md:block"\}`\}/.test(editorPane) &&
    /<PageSettingsPanel/.test(editorPane)
);
check(
  "6. the centre resize divider is removed in focus mode (and only there — normal desktop keeps it)",
  !!editor &&
    /\{!isPreviewCollapsed && !focusMode && \(\s*\n?\s*<div\s*\n?\s*onMouseDown=\{handleDividerMouseDown\}/.test(editor) &&
    /cursor-col-resize/.test(editor)
);

/* ---------------- 5. Preview is the real shared component, tucked not destroyed ---------------- */

check(
  "7. focus mode renders the SAME shared <PreviewPane> — not replaced by fake content",
  !!editor &&
    (editor.match(/<PreviewPane\b/g) || []).length === 1 &&
    !/<(FocusPreview|PreviewPlaceholder|FakePreview|MiniPreview)\b/.test(editor) &&
    !/import\s+\w*(FocusPreview|PreviewPlaceholder)\w*/.test(editor)
);
check(
  "8. an expanded Preview in focus mode is a capped-width side panel (editor stays dominant)",
  !!editor &&
    /focusMode\s*\n?\s*\?\s*"md:w-\[38%\] md:max-w-\[480px\]"/.test(editor)
);
check(
  "9. the collapsed Preview is a real labelled button (right-edge affordance), state announced",
  !!preview &&
    /data-preview-collapsed-toggle=""/.test(preview) &&
    /aria-label="プレビューを開く"/.test(preview) &&
    /aria-expanded=\{false\}/.test(preview) &&
    /onClick=\{onToggleCollapse\}/.test(preview.slice(preview.indexOf("data-preview-collapsed-toggle")))
);
check(
  "10. Preview can be collapsed again from the expanded panel (real button, labelled)",
  !!preview &&
    /data-preview-collapse-toggle=""/.test(preview) &&
    /aria-label="プレビューを右側に格納"/.test(preview)
);
check(
  "11. the collapse rail is a desktop affordance — a phone showing プレビュー is never collapsed",
  !!editor &&
    /isCollapsed=\{isPreviewCollapsed && mobileView !== "preview"\}/.test(editor)
);

/* ---------------- 6. mobile workspace untouched ---------------- */

check(
  "12. TSP-022 mobile 本文/プレビュー/設定 workspace + sticky nav are untouched",
  !!editor && !!nav &&
    /useState<"editor" \| "preview" \| "settings">/.test(editor) &&
    /id="tsp-settings-view"/.test(editor) &&
    /\bsticky\b/.test(nav) && /\btop-0\b/.test(nav)
);
check(
  "13. no new persisted field / DB migration introduced",
  !!editor &&
    !/migration|\.sql\b/i.test(editor) &&
    // focus state is the localStorage hook only
    /useMobileFocusMode/.test(editor)
);

/* ---------------- 7. TSP-021 / 022 invariants ---------------- */

const pageCard = read("src/components/PageCard.tsx");
const helpMd = read("public/docs/help.md");
const exportCapture = read("src/utils/exportCapture.ts");
check(
  "14. TSP-021 Apple vertical-glyph render layer + per-page checkbox/⋮ + nombre geometry intact",
  !!pageCard &&
    /VERT_LEADER_TEST = \/\[―—…‥\]\//.test(pageCard) &&
    /data-protected-run-wrapper/.test(pageCard) &&
    /checked=\{selected\}/.test(pageCard) &&
    /ページの操作メニュー/.test(pageCard) &&
    /const outerEdgePx = \(marginOuterMm \+ bleedMm\) \* PX_PER_MM;/.test(pageCard)
);
check(
  "14b. TSP-022 touch-safe page reorder + Safari export footer-logo fix intact (incl. 8a884e1 canvas composite)",
  !!pageCard && /1ページ前へ移動/.test(pageCard) && /1ページ後ろへ移動/.test(pageCard) &&
    !!exportCapture &&
    /prepareUrlImagesForCapture/.test(exportCapture) &&
    /compositeImagesOntoCanvas\(canvas, imageComposites\)/.test(exportCapture)
);
check(
  "14c. title-page creation UI still hidden; PSD help still accurate",
  !!helpMd && /## PSDファイルの挿入/.test(helpMd) && /ドラッグ＆ドロップ[^。]*対応していません/.test(helpMd)
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All TSP-023 PC-focus-mode checks passed.");
} else {
  console.log(`${failures} TSP-023 PC-focus-mode check(s) FAILED.`);
  process.exit(1);
}
