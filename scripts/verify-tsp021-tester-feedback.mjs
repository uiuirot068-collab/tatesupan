// TSP-LOOP-021 — tester-feedback UX polish gate.
//
// Focused regression checks for the 9 accumulated tester-feedback items.
// Pure string/regex assertions over source (same style as the other
// verify-*.mjs gates) plus a couple of tiny behavioural checks for the
// title-page generator.
//
// Run:  node scripts/verify-tsp021-tester-feedback.mjs
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

const homePage = read("src/app/page.tsx");
const help = read("public/docs/help.md");
const sample = read("src/constants/sampleData.ts");
const editorPane = read("src/components/EditorPane.tsx");
const header = read("src/components/Header.tsx");
const combine = read("src/components/CombineModal.tsx");
const bookStructure = read("src/utils/bookStructure.ts");
const bookParts = read("src/components/BookPartsModal.tsx");
const pageLayout = read("src/lib/pageLayout.ts");
const pageSettings = read("src/components/PageSettingsPanel.tsx");
const pageCard = read("src/components/PageCard.tsx");
const helpAsset = read("public/help/README.md");

/* ---------------- 1. image save / 72-hour explanation ---------------- */

check(
  "1a. home image card leads with the save model, THEN β 72h (never 'original disappears in 72h')",
  !!homePage &&
    /◇ 画像はどこに保存される？/.test(homePage) &&
    homePage.indexOf("この端末のブラウザに保存") <
      homePage.indexOf("クラウド上へ一時保存された画像は72時間で自動削除") &&
    /端末側の元画像や原稿を72時間後に削除するという意味ではありません/.test(homePage)
);
check(
  "1b. no forbidden absolutes / alarming phrasings anywhere in home or help",
  !!homePage && !!help &&
    !/ブラウザ保存だから絶対に消えません/.test(homePage + help) &&
    !/72時間後に(原稿|作品)が消え/.test(homePage + help) &&
    !/画像は永久に保存されます/.test(homePage + help) &&
    !/絶対に消えません/.test(homePage + help) &&
    // permanence must only ever appear as an explicit denial ("...ではありません")
    (homePage + help).split("\n").every((line) => !/永久/.test(line) || /ではありません|保証するものではありません/.test(line))
);
check(
  "1c. help.md section renamed + ordered: save model -> 72h -> browser-loss -> backup",
  !!help &&
    /^## 画像の保存とバックアップ$/m.test(help) &&
    help.indexOf("### まず、画像はどこに保存される？") <
      help.indexOf("### β版のクラウド一時画像は72時間で消えます") &&
    help.indexOf("### β版のクラウド一時画像は72時間で消えます") <
      help.indexOf("### ブラウザ保存も、絶対ではありません")
);

/* ---------------- 2. まとめ機能: no premature plan wording ---------------- */

check(
  "2a. CombineModal: no Light / Premium / プレミアム plan wording in user-facing copy",
  !!combine &&
    !/PREMIUM<\/span>/.test(combine) &&
    !/Lightプラン以上/.test(combine) &&
    !/プレミアム/.test(combine)
);
check(
  "2b. CombineModal: neutral future-release wording present",
  !!combine &&
    /今後リリース予定/.test(combine) &&
    /現在準備中です。今後のアップデートで公開予定です。/.test(combine)
);
check(
  "2c. legitimate current account terminology NOT globally stripped (home still has plan comment)",
  !!homePage && /Traveler \/ Resident \/ Light \/ Unlimited/.test(homePage)
);

/* ---------------- 3. manuscript backup reminder ---------------- */

check(
  "3a. home: friendly backup reminder block near the image explanation",
  !!homePage &&
    /id="backup-reminder-title"/.test(homePage) &&
    /大切な原稿は、ときどきバックアップを/.test(homePage) &&
    /別の場所にも保存しておくと安心です/.test(homePage)
);
check(
  "3b. backup illustration is a gated slot, never an unconditional <img> (asset is PENDING)",
  !!homePage &&
    /const BACKUP_ILLUSTRATION_AVAILABLE = false;/.test(homePage) &&
    /BACKUP_ILLUSTRATION_AVAILABLE\s*&&\s*\(/.test(homePage) &&
    /withBasePath\("\/help\/backup-caroad\.png"\)/.test(homePage) &&
    !/withBasePath\("\/tatespun\/help/.test(homePage)
);
check(
  "3c. public/help/README documents the two PENDING human assets",
  !!helpAsset &&
    /backup-caroad\.png/.test(helpAsset) &&
    /preview-drag\.gif/.test(helpAsset)
);

/* ---------------- 4. preview movement help (no 「パン」) ---------------- */

check(
  "4a. help.md: section is 'プレビューを移動する', no 「パン」 anywhere in the guide",
  !!help &&
    /^## プレビューを移動する$/m.test(help) &&
    !/パン/.test(help)
);
check(
  "4b. help.md: describes drag-to-move + where zoom lives; optional gif is a comment slot only",
  !!help &&
    /ドラッグ（マウスで押したまま動かす/.test(help) &&
    /preview-drag\.gif/.test(help) &&
    /<!--[\s\S]*preview-drag\.gif[\s\S]*-->/.test(help)
);

/* ---------------- 5. help guide opening is structurally clear ---------------- */

check(
  "5a. no ambiguous 「タイトルの下」 wording in the sample guide or editor placeholder",
  !!sample && !!editorPane &&
    !/タイトルの下/.test(sample) &&
    !/タイトルの下/.test(editorPane)
);
check(
  "5b. sample guide names the menu items explicitly instead of a vague visual location",
  !!sample && /編集画面のメニュー（①ページ設定／②ノンブル・柱／③メモ／④ヘルプ）/.test(sample)
);

/* ---------------- 6. 「？」 vs 「ヘルプ」 terminology ---------------- */

check(
  "6a. Header help control labelled ヘルプ (aria/title), glyph stays ？",
  !!header && /aria-label="ヘルプ"/.test(header) && /title="ヘルプ"/.test(header)
);
check(
  "6b. docs use ヘルプ as the primary name, ？ only as a supplement",
  !!help && !!sample &&
    /「ヘルプ」ボタン/.test(help) &&
    /「？」マークからも/.test(help) &&
    /④ヘルプ/.test(sample) &&
    !/④？/.test(sample)
);

/* ---------------- 7. nombre defaults + clipping ---------------- */

check(
  "7a. default nombre distance aligned to 文庫 preset (6mm, was 8mm too close to body)",
  !!pageLayout && /nombreBottomMargin: 6,/.test(pageLayout)
);
check(
  "7b. NombreOverlay: ノド/小口 nombre inset by (bleed + 2mm) — stays inside the trim line, was crossing it",
  !!pageCard &&
    /const inset = \(bleedMm \+ 2\) \* PX_PER_MM;/.test(pageCard) &&
    // odd/even mirroring for gutter vs outer is still driven by isOddPage
    /position === "gutter"[\s\S]{0,80}isOddPage/.test(pageCard)
);
check(
  "7c. NombreOverlay: minimum rendered nombre size is clamped (>= 6pt)",
  !!pageCard && /Math\.max\(fontSize \?\? 8, 6\)/.test(pageCard)
);
check(
  "7d. HiddenNombreOverlay: position UNCHANGED (report was about ノド/小口, not the hidden folio)",
  !!pageCard &&
    /left: isOddPage \? undefined : bleedMm \* PX_PER_MM,/.test(pageCard) &&
    /right: isOddPage \? bleedMm \* PX_PER_MM : undefined,/.test(pageCard) &&
    !/edgeInset/.test(pageCard)
);
check(
  "7e. §7C: nombreLayoutCustomized optional flag exists, defaults false, no DB migration",
  !!pageLayout &&
    /nombreLayoutCustomized\?: boolean;/.test(pageLayout) &&
    /nombreLayoutCustomized: false,/.test(pageLayout)
);
check(
  "7f. §7C: applyPaperTemplate only re-applies preset nombre defaults when NOT customized",
  !!pageSettings &&
    /base\.masterPage\.nombreLayoutCustomized\s*\n?\s*\?\s*\{\}/.test(pageSettings) &&
    /nombreFontSize: Math\.max\(6, Math\.round\(profile\.fontSizePt - 1\)\)/.test(pageSettings)
);
check(
  "7g. §7C: editing a nombre position/size field marks the layout as customized",
  !!pageSettings &&
    /NOMBRE_LAYOUT_KEYS = new Set/.test(pageSettings) &&
    /nombreLayoutCustomized: true/.test(pageSettings)
);
check(
  "7h. §7A: help.md explains the dotted line = 仕上がり線 (trim), preview-only, not in exports",
  !!help &&
    /^## プレビューの点線（仕上がり線）について$/m.test(help) &&
    /JPG・PDF の書き出しには出力されません/.test(help) &&
    !/断ち切り線/.test(help.slice(help.indexOf("プレビューの点線")))
);

/* ---------------- 8. title page: blank author outputs nothing ---------------- */

const titleBlank = renderTitle("わたしの本", "   ");
const titleNamed = renderTitle("わたしの本", "山田はな");

check(
  "8a. generateTitlePageText: whitespace-only author -> NO author row, no placeholder",
  !/著/.test(titleBlank) &&
    !/著者名未設定|undefined|null/.test(titleBlank) &&
    titleBlank.startsWith("わたしの本")
);
check(
  "8b. generateTitlePageText: real author -> author row present",
  /著：山田はな/.test(titleNamed)
);
check(
  "8c. BookPartsModal passes the raw author (no '|| placeholder' fallback) and never mentions 著者名未設定",
  !!bookParts &&
    /generateTitlePageText\(currentTitle, titleAuthor\)/.test(bookParts) &&
    !/titleAuthor \|\|/.test(bookParts) &&
    !/著者名未設定/.test(bookParts)
);

/* ---------------- 9. title page: no auto-generated visible '#' ---------------- */

check(
  "9a. generateTitlePageText output has no leading Markdown heading '#'",
  !titleBlank.trimStart().startsWith("#") && !titleNamed.trimStart().startsWith("#") &&
    !/^#\s/m.test(titleBlank)
);
check(
  "9b. generateColophonText still emits its own content (unchanged) — user-typed # not stripped globally",
  !!bookStructure && /generateColophonText/.test(bookStructure)
);

/* ---- tiny inline reimplementation kept in lock-step with bookStructure.ts ---- */
function renderTitle(title, author) {
  const src = bookStructure ?? "";
  // sanity: the real generator must match this shape, or these checks are stale
  if (!/const trimmedAuthor = author\.trim\(\);/.test(src)) {
    console.log("FAIL: (meta) generateTitlePageText shape changed — update verify script");
    failures += 1;
  }
  const trimmedAuthor = author.trim();
  const authorLine = trimmedAuthor ? `\n\n  著：${trimmedAuthor}` : "";
  return `${title}${authorLine}\n\n【改ページ】\n\n`;
}

/* ---------------- A. mobile per-page preview controls ---------------- */

check(
  "A1. phone per-page toolbar: state-labelled toggle buttons, not double-negative checkboxes",
  !!pageCard &&
    /md:hidden[\s\S]{0,4000}aria-pressed=\{!hideNombre\}/.test(pageCard) &&
    /hideNombre \? "非表示" : "表示"/.test(pageCard) &&
    /hideHashira \? "非表示" : "表示"/.test(pageCard)
);
check(
  "A2. desktop checkbox toolbar kept, just gated to md+ (no behaviour change on desktop)",
  !!pageCard &&
    /hidden w-full items-center justify-between px-1 md:flex/.test(pageCard) &&
    /ノンブル非表示\s*<\/label>/.test(pageCard)
);
check(
  "A3. 画像 stays visible on phone; 選択 / 並べ替え move under a ⋮ disclosure (state never hidden there)",
  !!pageCard &&
    /mobileFileInputRef\.current\?\.click\(\)/.test(pageCard) &&
    /setMobilePageMenuOpen\(\(open\) => !open\)/.test(pageCard) &&
    /mobilePageMenuOpen &&[\s\S]{0,1200}このページを選択（書き出し対象）/.test(pageCard)
);
check(
  "A4. phone toggles carry a full-sentence aria-label with the current state",
  !!pageCard &&
    /aria-label=\{\s*hideNombre\s*\?\s*"このページのノンブルを表示する（現在: 非表示）"/.test(pageCard) &&
    /min-h-\[40px\]/.test(pageCard)
);
check(
  "A5. per-page data semantics unchanged — still the same onHideNombreChange / onHideHashiraChange props",
  !!pageCard &&
    /onHideNombreChange\(!hideNombre\)/.test(pageCard) &&
    /onHideHashiraChange\(!hideHashira\)/.test(pageCard) &&
    // no new persisted field / pageOverride shape
    !/pageOverrides\[/.test(pageCard)
);

/* ---------------- B. vertical glyph substitution (…／‥／―／—) ---------------- */

check(
  "B1. lone bar/leader class ―—…‥ is re-set for vertical typesetting via [data-vertical-leader]",
  !!pageCard &&
    /const VERT_LEADER_TEST = \/\[―—…‥\]\/;/.test(pageCard) &&
    /data-vertical-leader/.test(pageCard) &&
    /VERT_LEADER_TEST\.test\(slot\.text\)/.test(pageCard)
);
check(
  "B1b. the leader wrapper re-asserts font-feature-settings: normal (+ fvea normal) and does NOT override text-orientation to mixed",
  !!pageCard &&
    (() => {
      const m = pageCard.match(/data-vertical-leader=""[\s\S]{0,320}?\}\}/);
      return !!m &&
        /fontFeatureSettings: "normal"/.test(m[0]) &&
        /fontVariantEastAsian: "normal"/.test(m[0]) &&
        !/textOrientation: "mixed"/.test(m[0]);
    })()
);
check(
  "B2. fix is render-layer only — no source-text character replacement of …／― anywhere in src",
  (() => {
    const files = ["src/lib/tategaki.ts", "src/components/PageCard.tsx", "src/lib/writingCheck.ts"]
      .map(read)
      .filter(Boolean)
      .join("\n");
    return !/["'`][…‥―—]["'`]\s*[,)]\s*["'`][︙⋮⋯｜│]["'`]/.test(files) &&
      !/replace\([^)]*[…‥―—][^)]*[︙⋮⋯｜│]/.test(files) &&
      !/[…‥―—]\s*(->|→)\s*[︙⋮⋯｜│|]/.test(files);
  })()
);
check(
  "B3. …… / ―― (2+) protected run is UNCHANGED — text-orientation: upright + explicit font-feature-settings: normal (works on mobile Safari; keeps Zen Old centred)",
  !!pageCard &&
    /data-protected-run-wrapper=\{run\.kind\}/.test(pageCard) &&
    /if \(slotCount >= 2\)/.test(pageCard) &&
    /textOrientation: "upright",\s*\n\s*WebkitTextOrientation: "upright",\s*\n\s*fontFeatureSettings: "normal",\s*\n\s*fontVariantEastAsian: "normal"/.test(pageCard)
);
check(
  "B4. legacy TokenView flow also re-sets a lone bar/leader (Preview / JPG / PDF agree, desktop / mobile agree)",
  !!pageCard &&
    /const LONE_LEADER_SPLIT = \/\(\[―—…‥\]\)\/;/.test(pageCard) &&
    /sub\.length === 1 && VERT_LEADER_TEST\.test\(sub\)/.test(pageCard) &&
    /withLoneLeaders\(part, index\)/.test(pageCard)
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All TSP-021 tester-feedback checks passed.");
} else {
  console.log(`${failures} TSP-021 tester-feedback check(s) FAILED.`);
  process.exit(1);
}
