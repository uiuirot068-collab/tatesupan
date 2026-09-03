// TSP-LOOP-022 — dedicated mobile workspace gate.
//
// Structural regression checks for the phone workspace model. These verify
// composition contracts only — they do NOT prove the visual UX (that stays a
// HUMAN Preview QA item):
//
//  - the phone has THREE mutually-exclusive primary workspaces (本文 /
//    プレビュー / 設定), driven by one lifted `mobileView` state;
//  - 設定 is a first-class workspace, not "switch to 本文 and scroll to a
//    strip" — the inline PageSettingsPanel strip inside EditorPane is md+
//    only, and TategakiEditor renders a phone-only PageSettingsPanel surface;
//  - the three surfaces are toggled with `hidden` (kept mounted), so a switch
//    can't drop manuscript text / caret, preview zoom+pan, or a settings
//    draft;
//  - business logic is NOT duplicated: still ONE TategakiEditor controller,
//    ONE save/autosave path, shared EditorPane / PreviewPane / PageSettingsPanel;
//  - the desktop split (editor | divider | preview + inline settings strip)
//    is untouched;
//  - the TSP-020 phone scroll model (scrolling document + sticky nav +
//    safe-area padding) is intact;
//  - the mobile nav uses plain labels (no decorative emoji), marks the active
//    workspace with aria-pressed, and surfaces ヘルプ;
//  - TSP-021 invariants (Apple vertical glyphs, per-page checkbox + [⋮],
//    nombre geometry, hidden 扉 UI, PSD help) are all still present.
//
// Run:  node scripts/verify-tsp022-mobile-workspace.mjs
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
const settingsPanel = read("src/components/PageSettingsPanel.tsx");
const nav = read("src/components/MobileEditorNav.tsx");
const header = read("src/components/Header.tsx");
const globals = read("src/app/globals.css");
const pageCard = read("src/components/PageCard.tsx");

/* ---------------- 1. three phone workspaces, one lifted state ---------------- */

check(
  "1. mobileView is a 3-way lifted state: editor | preview | settings",
  !!editor &&
    /useState<"editor" \| "preview" \| "settings">\(\s*"editor"\s*\)/.test(editor)
);
check(
  "1b. MobileEditorNav's MobileView type has all three workspaces",
  !!nav && /type MobileView = "editor" \| "preview" \| "settings"/.test(nav)
);
check(
  "1c. 設定 nav action selects the settings workspace (not 'editor + scroll to a strip')",
  !!editor &&
    /const showSettingsView = \(\) => \{[\s\S]{0,220}setMobileView\("settings"\)/.test(editor) &&
    !/showSettingsView = \(\) => \{[\s\S]{0,160}scrollMobileTo\("tsp-settings"\)/.test(editor)
);
check(
  "1d. each workspace switcher is a real button with aria-pressed on its own state",
  !!nav &&
    /onClick=\{onShowEditor\}[\s\S]{0,80}aria-pressed=\{mobileView === "editor"\}/.test(nav) &&
    /onClick=\{onShowPreview\}[\s\S]{0,80}aria-pressed=\{mobileView === "preview"\}/.test(nav) &&
    /onClick=\{onShowSettings\}[\s\S]{0,80}aria-pressed=\{mobileView === "settings"\}/.test(nav)
);

/* ---------------- 2. 設定 is its own workspace, desktop strip untouched ---------------- */

check(
  "2. EditorPane's inline settings strip is md+ only (phone 本文 surface has no settings panel to scroll past)",
  !!editorPane &&
    /id="tsp-settings"\s*\n\s*className="hidden flex-none md:block"/.test(editorPane)
);
check(
  "2b. TategakiEditor renders a phone-only 設定 workspace with the shared PageSettingsPanel",
  !!editor &&
    /id="tsp-settings-view"/.test(editor) &&
    /md:hidden/.test(editor.slice(editor.indexOf("tsp-settings-view"))) &&
    /<PageSettingsPanel[\s\S]{0,400}onChange=\{setSettings\}/.test(
      editor.slice(editor.indexOf("tsp-settings-view"))
    )
);
check(
  "2c. the phone 設定 surface toggles with `hidden` (mounted → draft/tab survive a switch)",
  !!editor &&
    /tsp-settings-view[\s\S]{0,320}mobileView === "settings" \? "" : "hidden"/.test(editor)
);
check(
  "2d. the phone 本文 surface is hidden for BOTH other workspaces (preview AND settings)",
  !!editor && /\$\{mobileView !== "editor" \? "max-md:hidden" : ""\}/.test(editor)
);
check(
  "2e. no duplicated business logic — one controller, one save path, shared panes",
  !!editor &&
    (editor.match(/function TategakiEditor/g) || []).length === 1 &&
    (editor.match(/saveDocument\(/g) || []).length >= 1 &&
    !/MobileApp|DesktopApp|MobileTategakiEditor/.test(editor) &&
    // PageSettingsPanel imported once into the controller, reused (not forked)
    /import PageSettingsPanel from "\.\/PageSettingsPanel"/.test(editor)
);

/* ---------------- 3. desktop split unchanged ---------------- */

check(
  "3. desktop editor|divider|preview split is intact (resize divider + width vars)",
  !!editor &&
    /cursor-col-resize/.test(editor) &&
    /--editor-w/.test(editor) &&
    /--preview-w/.test(editor) &&
    /handleDividerMouseDown/.test(editor)
);
check(
  "3b. desktop still shows the inline settings strip inside the editor pane",
  !!editorPane && /md:block/.test(editorPane) && /<PageSettingsPanel/.test(editorPane)
);

/* ---------------- 4. TSP-020 phone scroll model intact ---------------- */

check(
  "4. phone scroll model kept: scrolling shell + sticky nav + safe-area bottom padding",
  !!editor &&
    /data-editor-shell/.test(editor) &&
    /min-h-\[100dvh\]/.test(editor) &&
    /md:overflow-hidden/.test(editor) &&
    /pb-\[calc\(env\(safe-area-inset-bottom\)\s*\+\s*\d/.test(editor)
);
check(
  "4b. the phone nav is still sticky top-0 z-40",
  !!nav && /\bsticky\b/.test(nav) && /\btop-0\b/.test(nav) && /z-40/.test(nav)
);
check(
  "4c. globals.css still restores document scroll for the editor shell only <=767px",
  !!globals &&
    /@media\s*\(max-width:\s*767px\)/.test(globals) &&
    /:has\(\[data-editor-shell\]\)/.test(globals) &&
    /overflow-y:\s*auto\s*!important/.test(globals)
);
check(
  "4d. the phone scroll lives on <html>, not <body> — body:overflow-y:visible so the sticky nav actually pins (clip+auto would compute overflow-x to hidden and defeat it)",
  !!globals &&
    /html:has\(\[data-editor-shell\]\)\s*\{\s*overflow-y:\s*auto\s*!important/.test(globals) &&
    /body:has\(\[data-editor-shell\]\)\s*\{\s*overflow-y:\s*visible\s*!important/.test(globals)
);

/* ---------------- 5. calmer mobile chrome, no functionality hidden ---------------- */

check(
  "5. mobile workspace switcher uses plain labels — no decorative emoji on the tabs",
  !!nav &&
    />\s*本文\s*<\/button>/.test(nav) &&
    />\s*プレビュー\s*<\/button>/.test(nav) &&
    />\s*設定\s*<\/button>/.test(nav) &&
    !/✏️ 本文|👁️ プレビュー|⚙️ 設定/.test(nav)
);
check(
  "5b. ヘルプ is reachable from the sticky mobile nav",
  !!nav && /onOpenHelp/.test(nav) && /aria-label="ヘルプ"/.test(nav) &&
    !!editor && /onOpenHelp=\{\(\) => setIsHelpOpen\(true\)\}/.test(editor)
);
check(
  "5c. header 「← 作品一覧」 link is md+ only on phone (MobileEditorNav owns 一覧)",
  !!header &&
    (() => {
      const link = header.match(/<Link\s+href="\/"[\s\S]{0,400}?←\s*作品一覧/);
      return !!link && /className="hidden [^"]*md:inline"/.test(link[0]);
    })()
);
check(
  "5d. header ？ヘルプ + クラウド保存 buttons are md+ only on phone",
  !!header &&
    (() => {
      const help = header.match(/aria-label="ヘルプ"[\s\S]{0,400}?className="([^"]*)"/);
      const save = header.match(/onClick=\{handleSaveClick\}[\s\S]{0,400}?className="([^"]*)"/);
      return (
        !!help && /\bhidden\b/.test(help[1]) && /\bmd:flex\b/.test(help[1]) &&
        !!save && /\bhidden\b/.test(save[1]) && /\bmd:inline-flex\b/.test(save[1])
      );
    })()
);
check(
  "5e. essential phone actions still exist somewhere: save + save-status + 一覧 + 集中モード in the sticky nav",
  !!nav &&
    /onSave/.test(nav) &&
    /SAVE_TEXT/.test(nav) &&
    /一覧/.test(nav) &&
    /集中モード/.test(nav)
);

/* ---------------- 5f. touch-safe page reorder in the ⋮ menu ---------------- */

check(
  "5f. the ⋮ menu carries explicit 「1ページ前へ移動 / 後ろへ移動」 reorder buttons (touch-safe alt to drag)",
  !!pageCard &&
    />\s*1ページ前へ移動\s*</.test(pageCard) &&
    />\s*1ページ後ろへ移動\s*</.test(pageCard) &&
    /onMovePageBackward\?\.\(\)/.test(pageCard) &&
    /onMovePageForward\?\.\(\)/.test(pageCard)
);
check(
  "5g. first/last page: the edge command renders a real <button disabled>, not hidden",
  !!pageCard &&
    /disabled=\{!canMovePageBackward\}/.test(pageCard) &&
    /disabled=\{!canMovePageForward\}/.test(pageCard) &&
    // both buttons show whenever either handler is present (edge state = disabled)
    /\(onMovePageBackward \|\| onMovePageForward\) &&/.test(pageCard)
);
check(
  "5h. PreviewPane routes both commands through the canonical reorder pipeline (reorderByDrag + applyReorder), no second model",
  !!preview &&
    /const movePageBy = \(bodyIndex: number, direction: -1 \| 1\) => \{/.test(preview) &&
    /reorderByDrag\(pages, new Set\(\[bodyIndex\]\), insertionIndex\)/.test(preview) &&
    /applyReorder\(nextPages, new Set\(\[target\]\)\)/.test(preview) &&
    // first/last gated by the caller AND re-checked in movePageBy
    /if \(target < 0 \|\| target >= pages\.length\) return;/.test(preview) &&
    /canMovePageBackward=\{canReorder && bodyIndex > 0\}/.test(preview) &&
    /canMovePageForward=\{canReorder && bodyIndex < pages\.length - 1\}/.test(preview)
);
check(
  "5i. the move commands close the menu after a move; desktop drag reorder untouched",
  !!preview &&
    /const movePageBy = [\s\S]{0,700}setOpenPageMenuIndex\(null\);/.test(preview) &&
    /const handleDrop = \(index: number\) => \(event: DragEvent\) => \{/.test(preview) &&
    /reorderByDrag\(pages, movingSet, insertionIndex\)/.test(preview)
);
check(
  "5j. reorder adds no persisted field — pageOverrides / selection semantics reused as-is",
  !!preview &&
    !/movePageBy[\s\S]{0,600}pageOverrides:/.test(preview) &&
    // still the same selection Set, still driven by applyReorder→setSelected
    /applyReorder = \([\s\S]{0,160}setSelected\(nextSelected\)/.test(preview)
);

/* ---------------- 6. TSP-021 invariants still present ---------------- */

const helpMd = read("public/docs/help.md");
const bookParts = read("src/components/BookPartsModal.tsx");
check(
  "6. TSP-021 Apple vertical-glyph render layer untouched (text-orientation: mixed wrappers)",
  !!pageCard &&
    /VERT_LEADER_TEST = \/\[―—…‥\]\//.test(pageCard) &&
    /data-vertical-leader/.test(pageCard) &&
    /textOrientation:\s*"mixed"/.test(pageCard) &&
    /data-protected-run-wrapper/.test(pageCard)
);
check(
  "6b. TSP-021 per-page controls: permanent selection checkbox + [⋮] menu",
  !!pageCard &&
    /checked=\{selected\}/.test(pageCard) &&
    /ページの操作メニュー/.test(pageCard) &&
    /このページに画像を挿入/.test(pageCard) &&
    !/👁|🚫|🖼/.test(pageCard)
);
check(
  "6c. TSP-021 nombre text-frame geometry preserved",
  !!pageCard &&
    /const outerEdgePx = \(marginOuterMm \+ bleedMm\) \* PX_PER_MM;/.test(pageCard) &&
    /const gutterEdgePx = \(marginGutterMm \+ bleedMm\) \* PX_PER_MM;/.test(pageCard)
);
check(
  "6d. TSP-021 title-page creation UI stays hidden",
  !!bookParts && /\/\/ \{ id: 'title'/.test(bookParts) && /📖 奥付・目次/.test(bookParts)
);
check(
  "6e. TSP-021 PSD help stays accurate (selectable via image insertion, no drag-and-drop claim)",
  !!helpMd &&
    /## PSDファイルの挿入/.test(helpMd) &&
    /PNGへ変換/.test(helpMd) &&
    /ドラッグ＆ドロップ[^。]*対応していません/.test(helpMd)
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All TSP-022 mobile-workspace checks passed.");
} else {
  console.log(`${failures} TSP-022 mobile-workspace check(s) FAILED.`);
  process.exit(1);
}
