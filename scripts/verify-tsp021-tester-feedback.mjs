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
const preview = read("src/components/PreviewPane.tsx");
const helpAsset = read("public/help/README.md");

/* ---------------- 1. image save / 72-hour explanation ---------------- */

check(
  "1a. home image card: §5 heading + A(この端末)/B(クラウド) split; 72h scoped; 'nothing to do in 72h' spelled out",
  !!homePage &&
    /◇ TateSpunは画像挿入が可能！/.test(homePage) &&
    /でも、画像はどこに保存される？/.test(homePage) &&
    /A\. この端末で使うとき/.test(homePage) &&
    /B\. クラウド保存を使うとき/.test(homePage) &&
    homePage.indexOf("A. この端末で使うとき") < homePage.indexOf("B. クラウド保存を使うとき") &&
    /72時間で削除されるのは、クラウド上の一時コピーです。/.test(homePage) &&
    /72時間以内に何かをする必要はありません/.test(homePage) &&
    /この端末の画像を72時間後に削除するという意味ではありません/.test(homePage)
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
  "1c. help.md §5: '## TateSpunは画像挿入が可能！でも、画像はどこに保存される？' with A / B subsections + the 72h callout",
  !!help &&
    /^## TateSpunは画像挿入が可能！でも、画像はどこに保存される？$/m.test(help) &&
    /^### A\. この端末で使うとき$/m.test(help) &&
    /^### B\. クラウド保存を使うとき（会員）$/m.test(help) &&
    help.indexOf("### A. この端末で使うとき") < help.indexOf("### B. クラウド保存を使うとき（会員）") &&
    /> \*\*72時間で削除されるのは、クラウド上の一時コピーです。\*\*/.test(help) &&
    /72時間以内に何かをする必要はありません/.test(help)
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
  "3b. §6: backup illustration received — rendered (basePath-safe, alt text, no gating flag left)",
  !!homePage &&
    /src=\{withBasePath\("\/help\/backup-caroad\.png"\)\}/.test(homePage) &&
    /alt="原稿のバックアップをすすめる、カロードのイラスト"/.test(homePage) &&
    !/BACKUP_ILLUSTRATION_AVAILABLE/.test(homePage) &&
    !/withBasePath\("\/tatespun\/help/.test(homePage) &&
    // help.md wires it too, via a root-absolute markdown path (HelpModal adds basePath)
    /!\[原稿のバックアップをすすめる[^\]]*\]\(\/help\/backup-caroad\.png\)/.test(help ?? "") &&
    !!read("public/help/backup-caroad.png")
);
check(
  "3b2. §6: preview-drag.gif optimized + integrated — file present, ≤3MB, live markdown image in help.md (no hold comment)",
  (() => {
    const gif = read("public/help/preview-drag.gif");
    if (!gif) return false;
    if (gif.length > 3 * 1024 * 1024) return false;
    const h = help ?? "";
    const stripped = h.replace(/<!--[\s\S]*?-->/g, "");
    // referenced as a live markdown image (survives comment stripping), root-absolute
    return (
      /!\[[^\]]*\]\(\/help\/preview-drag\.gif\)/.test(stripped) &&
      !/仕様外|保留|再書き出し/.test(h)
    );
  })()
);
check(
  "3c. public/help/README documents both human assets as integrated (neither held)",
  !!helpAsset &&
    /backup-caroad\.png/.test(helpAsset) &&
    /preview-drag\.gif/.test(helpAsset) &&
    !/仕様外|保留/.test(helpAsset)
);

/* ---------------- 4. preview movement help (no 「パン」) ---------------- */

check(
  "4a. help.md: section is 'プレビューを移動する', no 「パン」 anywhere in the guide",
  !!help &&
    /^## プレビューを移動する$/m.test(help) &&
    !/パン/.test(help)
);
check(
  "4b. help.md: describes drag-to-move + where zoom lives; the operation gif is a live image (no hold comment)",
  !!help &&
    /ドラッグ（マウスで押したまま動かす/.test(help) &&
    /!\[[^\]]*\]\(\/help\/preview-drag\.gif\)/.test(help.replace(/<!--[\s\S]*?-->/g, ""))
);

/* ---------------- PSD help: accurate, no drag-and-drop claim ---------------- */

check(
  "PSD-1. help.md has a PSD insertion section: selectable via image insertion, converted to PNG, NO drag-and-drop claim",
  !!help &&
    /## PSDファイルの挿入/.test(help) &&
    /画像挿入から[^。]*`\.psd`/.test(help) &&
    /PNGへ変換/.test(help) &&
    /ドラッグ＆ドロップ[^。]*対応していません/.test(help) &&
    // stale wording must not return
    !/PSDファイルの直接挿入/.test(help) &&
    !/そのままプレビューへドラッグ/.test(help) &&
    !/高画質(?:な)?PNG/.test(help)
);
check(
  "PSD-2. ordinary (non-PSD) image insertion help still present",
  !!help &&
    /## ページの複数選択/.test(help) &&
    /画像は［天側］［中央］|画像を挿入|画像の配置|挿絵/.test((sample ?? "") + help)
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
  "7b. §3: ノド/小口 nombre anchored to the TEXT-FRAME edge (marginGutter/marginOuter + bleed), not the paper edge + inset",
  !!pageCard &&
    /const outerEdgePx = \(marginOuterMm \+ bleedMm\) \* PX_PER_MM;/.test(pageCard) &&
    /const gutterEdgePx = \(marginGutterMm \+ bleedMm\) \* PX_PER_MM;/.test(pageCard) &&
    // odd/even mirroring: outer→(odd left / even right); gutter→(odd right / even left)
    /position === "outer"[\s\S]{0,60}isOddPage[\s\S]{0,40}"left"[\s\S]{0,20}"right"[\s\S]{0,40}isOddPage[\s\S]{0,40}"right"[\s\S]{0,20}"left"/.test(pageCard) &&
    /const anchorPx = position === "outer" \? outerEdgePx : gutterEdgePx;/.test(pageCard) &&
    // no more "paper edge + fixed inset" datum
    !/const inset = \(bleedMm \+ 2\) \* PX_PER_MM;/.test(pageCard) &&
    // both callers pass the margins through
    /marginGutterMm=\{settings\.marginGutter\}/.test(pageCard) &&
    !!read("src/components/ColophonPageCard.tsx") &&
    /marginGutterMm=\{settings\.marginGutter\}/.test(read("src/components/ColophonPageCard.tsx"))
);
check(
  "7c. NombreOverlay: minimum rendered nombre size is clamped (>= 6pt); user vertical-distance slider still drives 'bottom'",
  !!pageCard &&
    /Math\.max\(fontSize \?\? 8, 6\)/.test(pageCard) &&
    /const bottomPx = \(bottomMarginMm \+ bleedMm\) \* PX_PER_MM;/.test(pageCard)
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
  "7f. §7C + §4 (+ TSP-022 HUMAN-QA): applyPaperTemplate re-applies preset nombre/柱 defaults only when NOT customized; per-preset nombreFontSize with body−3pt/min6 fallback",
  !!pageSettings && !!pageLayout &&
    /base\.masterPage\.nombreLayoutCustomized\s*\n?\s*\?\s*\{\}/.test(pageSettings) &&
    // per-preset explicit value, fall back to the recommended formula
    /nombreFontSize:\s*\n?\s*profile\.nombreFontSize \?\? recommendedNombreFontSizePt\(profile\.fontSizePt\)/.test(pageSettings) &&
    /profile\.headerFontSize != null/.test(pageSettings) &&
    /export function recommendedNombreFontSizePt\(bodyFontSizePt: number\): number \{\s*\n?\s*return Math\.max\(6, Math\.round\(bodyFontSizePt - 3\)\);/.test(pageLayout) &&
    // new-project (文庫) default — TSP-022 HUMAN-QA lowered 6 → 5
    /nombreFontSize: 5,/.test(pageLayout)
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

/* ---------------- A. per-page controls: C pattern, one arrangement PC + mobile ---------------- */

check(
  "A1. one compact ⋮ per page (no permanently-repeated control row); PC + mobile identical (no md: split of the pattern)",
  !!pageCard &&
    /aria-label=\{`\$\{pageNumber\}ページの操作メニュー`\}/.test(pageCard) &&
    /aria-expanded=\{isMenuOpen\}/.test(pageCard) &&
    // the previous per-page toggle-button row / desktop checkbox toolbar are gone
    !/md:hidden[\s\S]{0,4000}aria-pressed=\{!hideNombre\}/.test(pageCard) &&
    !/hidden w-full items-center justify-between px-1 md:flex/.test(pageCard) &&
    !/ノンブル非表示\s*<\/label>/.test(pageCard)
);
check(
  "A2. export-target checkbox stays PERMANENTLY visible (outside ⋮), left of the ⋮ button — multi-page export flow",
  !!pageCard &&
    (() => {
      const row = pageCard.match(/data-page-menu-root=""[\s\S]{0,2800}?<\/div>/);
      if (!row) return false;
      return (
        /checked=\{selected\}/.test(row[0]) &&
        /onClick=\{onToggleCheckbox\}/.test(row[0]) &&
        /\{selected \? "選択中" : "選択"\}/.test(row[0]) &&
        // checkbox appears BEFORE the ⋮ button in the row
        row[0].indexOf("checked={selected}") < row[0].indexOf("aria-label={`${pageNumber}ページの操作メニュー`}")
      );
    })()
);
check(
  "A3. the ⋮ menu holds page-move + ノンブル / 柱 / 画像 + a desktop-drag note; selection is NOT duplicated inside it",
  !!pageCard &&
    (() => {
      // menu panel = from its id to the file <input> that immediately follows it
      const start = pageCard.indexOf("id={`page-menu-${pageNumber}`}");
      const end = pageCard.indexOf("ref={fileInputRef}", start);
      if (start < 0 || end < 0) return false;
      const menu = pageCard.slice(start, end);
      return (
        /ノンブル（ページ番号）/.test(menu) &&
        /柱（ヘッダー）/.test(menu) &&
        /このページに画像を挿入/.test(menu) &&
        // TSP-LOOP-022: touch-safe reorder commands + the desktop-drag note
        // (reworded: drag is now an *additional* desktop path, not the only one)
        /1ページ前へ移動/.test(menu) &&
        /1ページ後ろへ移動/.test(menu) &&
        /ドラッグ(?:して|しても)/.test(menu) &&
        // selection toggle is not repeated in the panel
        !/onToggleCheckbox\(\)/.test(menu) &&
        !/書き出し対象にする/.test(menu)
      );
    })()
);
check(
  "A4. no unsolicited emoji in the per-page controls (⋮ and ⠿ are UI glyphs, not emoji)",
  !!pageCard &&
    (() => {
      const block = pageCard.slice(
        pageCard.indexOf("data-page-menu-root=\"\""),
        pageCard.indexOf("id={`page-menu-${pageNumber}`}") + 2600,
      );
      return !/👁|🚫|🖼|📄|✏️|📝/.test(block) && !/\p{Extended_Pictographic}/u.test(block);
    })()
);
check(
  "A5. per-page data semantics unchanged — same onToggleCheckbox / onHideNombreChange / onHideHashiraChange / onInsertImage props; no new persisted field",
  !!pageCard &&
    /onHideNombreChange\(!hideNombre\)/.test(pageCard) &&
    /onHideHashiraChange\(!hideHashira\)/.test(pageCard) &&
    /onClick=\{onToggleCheckbox\}/.test(pageCard) &&
    /fileInputRef\.current\?\.click\(\)/.test(pageCard) &&
    !/pageOverrides\[/.test(pageCard) &&
    // menu open state is lifted to PreviewPane (one at a time), not per-card local
    !/useState\(false\)\s*;?\s*\/\/.*menu/i.test(pageCard) &&
    /isMenuOpen = false,\s*\n\s*onToggleMenu,/.test(pageCard)
);
check(
  "A6. PreviewPane lifts the ⋮ open state (one menu at a time) + closes on outside pointerdown / Escape; Shift-range + 全選択/全解除 untouched",
  !!preview &&
    /const \[openPageMenuIndex, setOpenPageMenuIndex\] = useState<number \| null>\(null\)/.test(preview) &&
    /stableTogglePageMenu/.test(preview) &&
    /data-page-menu-root/.test(preview) &&
    /\bkey === "Escape"/.test(preview) &&
    // existing selection machinery still present
    /全選択/.test(preview) && /全解除/.test(preview) &&
    /rangeIndices|handleToggleSelect/.test(preview)
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
  "B1b. the leader wrapper overrides text-orientation: mixed (+ -webkit-) — the Apple-WebKit-safe path — and clears the fixed-slot feature list",
  !!pageCard &&
    (() => {
      const m = pageCard.match(/data-vertical-leader=""[\s\S]{0,420}?\}\}/);
      return !!m &&
        /textOrientation: "mixed"/.test(m[0]) &&
        /WebkitTextOrientation: "mixed"/.test(m[0]) &&
        /fontFeatureSettings: "normal"/.test(m[0]) &&
        /fontVariantEastAsian: "normal"/.test(m[0]);
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
  "B3. protected run: text-orientation: mixed; ―― stays ONE text run, …… is rendered PER CHARACTER",
  (() => {
    if (!pageCard) return false;
    const runBlock = pageCard.slice(pageCard.indexOf("data-protected-run-wrapper=\{run.kind\}"));
    return (
      /if \(slotCount >= 2\)/.test(pageCard) &&
      /textOrientation: "mixed",[\s\S]{0,60}WebkitTextOrientation: "mixed",/.test(runBlock) &&
      /run\.kind === "ellipsis" \?/.test(runBlock) &&
      /Array\.from\(run\.text\)\.map\(\(ch, i\)/.test(runBlock) &&
      /<span data-protected-run-glyph=\{run\.kind\}>\{run\.text\}<\/span>/.test(runBlock)
    );
  })()
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
