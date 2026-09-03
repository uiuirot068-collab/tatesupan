// TSP-LOOP-024 —「3分でわかる TateSpun おためしデモ」+ feature guide gate.
//
// Structural contracts only. The behavioural proof (data isolation, skip
// path, exits) is the automated Playwright walkthrough — not regex.
//
// Run:  node scripts/verify-tsp024-three-minute-demo.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
};
/** crude comment stripper so "no localStorage" in a doc comment isn't a hit */
const code = (src) =>
  (src ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

const demoData = read("src/constants/demoData.ts");
const tour = read("src/components/DemoTour.tsx");
const tourHook = read("src/hooks/useDemoTour.ts");
const editor = read("src/components/TategakiEditor.tsx");
const editorRoute = read("src/app/editor/page.tsx");
const db = read("src/lib/db.ts");
const useSettings = read("src/hooks/useEditorSettings.ts");
const entry = read("src/components/DemoEntryCard.tsx");
const home = read("src/app/page.tsx");
const guide = read("src/app/guide/page.tsx");
const editorPane = read("src/components/EditorPane.tsx");
const settingsPanel = read("src/components/PageSettingsPanel.tsx");
const header = read("src/components/Header.tsx");
const preview = read("src/components/PreviewPane.tsx");
const writingCheck = read("src/lib/writingCheck.ts");

/* ---------------- 1. exactly 10 steps, approved order, Next never gated ---------------- */

const stepTitles = [
  "作品にタイトルをつけよう",
  "本のサイズを決めよう",
  "ノンブルや柱も設定できるよ",
  "困ったらヘルプへ",
  "エディターを使いやすくしてみよう",
  "実際に文章を書いてみよう",
  "プレビューはいつでもしまえるよ",
  "作品を書き出してみよう",
  "クラウド保存について",
  "TateSpunの基本操作はこれで完了です！",
];
check(
  "1. DEMO_STEPS has exactly 10 steps in the approved order",
  !!demoData &&
    (() => {
      const found = [...demoData.matchAll(/n:\s*(\d+),\s*\n\s*title:\s*"([^"]+)"/g)];
      if (found.length !== 10) return false;
      return found.every((m, i) => Number(m[1]) === i + 1 && m[2] === stepTitles[i]);
    })()
);
check(
  "2. the step engine's `next` never checks interaction completion (every step skippable)",
  !!tourHook &&
    /const next = useCallback\(\s*\(\) => setIndex\(\(i\) => Math\.min\(i \+ 1, total - 1\)\)/.test(tourHook) &&
    !/completed|didInteract|requireAction/.test(code(tourHook))
);
check(
  "3. the guide shows STEP X / N, and 次へ + デモを終了 are always rendered",
  !!tour &&
    /STEP \{stepNumber\} \/ \{total\}/.test(tour) &&
    /data-demo-next=""/.test(tour) &&
    /data-demo-exit=""/.test(tour) &&
    // 次へ button is not `disabled={...}` on anything interaction-derived
    !/data-demo-next=""[\s\S]{0,120}disabled=\{(?!isFirst)/.test(tour)
);
check(
  "4. 戻る is hidden on step 1 only (disabled:invisible + isFirst), not action-gated",
  !!tour && /data-demo-prev=""[\s\S]{0,160}disabled=\{isFirst\}[\s\S]{0,220}disabled:invisible/.test(tour)
);

/* ---------------- 2. real editor reused, no duplicate ---------------- */

check(
  "5. the demo runs the REAL TategakiEditor via `?demo=1` — no DemoEditor fork",
  !!editorRoute &&
    /searchParams\.get\("demo"\) === "1"/.test(editorRoute) &&
    /<TategakiEditor[\s\S]{0,200}demoMode=\{demoMode\}/.test(editorRoute) &&
    !read("src/components/DemoEditor.tsx") &&
    !/class DemoEditor|function DemoEditor/.test(editor ?? "")
);
check(
  "6. demo entry sits by the bookshelf creation action and opens /editor?demo=1",
  !!entry && /href="\/editor\?demo=1"/.test(entry) &&
    /3分でわかる TateSpun おためしデモ/.test(entry) &&
    !!home && /<DemoEntryCard/.test(home) &&
    (home.match(/<DemoEntryCard/g) || []).length === 2 // both bookshelf branches
);

/* ---------------- 3. data isolation (structural — walkthrough proves behaviour) ---------------- */

check(
  "7. demoMode loads a purely in-memory seed — no loadDocument / no createDocument in the demo branch",
  !!editor &&
    /if \(demoMode\) \{[\s\S]{0,700}setContent\(DEMO_SEED_CONTENT\)[\s\S]{0,400}return;\s*\n\s*\}/.test(editor) &&
    !/if \(demoMode\) \{[\s\S]{0,700}loadDocument\(/.test(editor) &&
    !/if \(demoMode\) \{[\s\S]{0,700}createDocument\(/.test(editor)
);
check(
  "8. every persistence guard covers the demo (isSampleDocument = demoMode || isEphemeralDocId)",
  !!editor &&
    /const isSampleDocument = demoMode \|\| isEphemeralDocId\(docId\)/.test(editor) &&
    /const isEphemeralRoute = demoMode \|\| isEphemeralDocId\(documentId\)/.test(editor) &&
    /useEditorSettings\(\{ persist: !isEphemeralRoute \}\)/.test(editor)
);
check(
  "9. db.ts never writes a row for the ephemeral ids (-1 guide, -2 demo)",
  !!db &&
    /import \{ isEphemeralDocId \} from "@\/constants\/demoData"/.test(db) &&
    /if \(isEphemeralDocId\(id\)\) return;\s*\n\s*await db\.documents\.put/.test(db) &&
    /if \(isEphemeralDocId\(id\)\) return;\s*\n\s*await db\.documents\.delete/.test(db)
);
check(
  "10. DEMO_PROJECT.id (-2) is distinct from SAMPLE_PROJECT.id and never persisted; tour state is in-memory only",
  !!demoData && /id:\s*-2/.test(demoData) &&
    !!tourHook && /useState\(0\)/.test(tourHook) &&
    !/localStorage|sessionStorage|indexedDB|Dexie/i.test(code(tourHook))
);
check(
  "11. useEditorSettings honours persist:false (no localStorage write in the demo)",
  !!useSettings && /if \(!persist(?:\s*\|\|[^)]*)?\) return;/.test(useSettings)
);

/* ---------------- 4. seed guarantees a 2nd page for STEP 8 ---------------- */

check(
  "12. the demo seed contains 【改ページ】 so a 2nd body page exists even if STEP 6 is skipped",
  !!demoData && /DEMO_SEED_CONTENT = `[\s\S]*【改ページ】[\s\S]*`/.test(demoData) &&
    // original short wording — not a long copyrighted passage
    demoData.split("DEMO_SEED_CONTENT")[1].split("`")[1].length < 700
);

/* ---------------- 5. every step maps to a REAL control ---------------- */

check(
  "13. STEP targets are real data-demo-target hooks on real controls (title / settings / nombre / help / focus / editor / preview-collapse / export / cloud-save)",
  !!editorPane && /data-demo-target="title"/.test(editorPane) && /data-demo-target="editor"/.test(editorPane) &&
    !!settingsPanel && /data-demo-target="page-settings"/.test(settingsPanel) && /data-demo-target="nombre-settings"/.test(settingsPanel) &&
    !!header && /data-demo-target="help"/.test(header) && /data-demo-target="focus-mode"/.test(header) && /data-demo-target="cloud-save"/.test(header) &&
    !!preview && /data-demo-target="export"/.test(preview) && /data-demo-target="preview-collapse"/.test(preview)
);
check(
  "14. STEP 5 focus-mode target is the TSP-023 hook; STEP 7 uses the TSP-023 preview-collapse hook",
  !!header && /data-focus-mode-toggle=""\s*\n\s*data-demo-target="focus-mode"/.test(header) &&
    !!preview && /data-preview-collapse-toggle=""\s*\n\s*data-demo-target="preview-collapse"/.test(preview)
);
check(
  "15. device-appropriate copy exists for phone-absent controls (mobileNote), + non-destructive prepare() only",
  !!demoData && /mobileNote:/.test(demoData) &&
    /prepare\?:\s*"settings" \| "editor" \| "preview"/.test(demoData) &&
    !!tour && /if \(step\.prepare\) onPrepare\(step\.prepare\)/.test(tour) &&
    // prepare only switches the phone workspace — never types / changes settings / downloads
    !/onPrepare[\s\S]{0,200}(setContent|setSettings|export|download|createDocument)/.test(editor ?? "")
);

/* ---------------- 6. STEP 10 exits + feature guide ---------------- */

check(
  "16. STEP 10 has exactly the three exits (new project / bookshelf / feature guide), each leaving demo mode",
  !!tour &&
    /data-demo-exit-new=""/.test(tour) &&
    /data-demo-exit-bookshelf=""/.test(tour) &&
    /data-demo-open-guide=""/.test(tour) &&
    !!editor &&
    /onExitToNewProject=\{async \(\) => \{\s*\n\s*const id = await createDocument\(\);\s*\n\s*router\.push\(`\/editor\?id=\$\{id\}`\)/.test(editor) &&
    /onExitToBookshelf=\{\(\) => router\.push\("\/"\)\}/.test(editor) &&
    /onOpenFeatureGuide=\{\(\) => router\.push\("\/guide"\)\}/.test(editor)
);
check(
  "17. feature guide route exists with 10 cards in approved order + a conditional beta card",
  !!guide &&
    (() => {
      const ns = [...guide.matchAll(/n:\s*"(\d\d)"/g)].map((m) => m[1]);
      return ns.join(",") === "01,02,03,04,05,06,07,08,09,10";
    })() &&
    /BETA_FEEDBACK_ENABLED &&/.test(guide) &&
    /data-feature-card="beta"/.test(guide)
);
check(
  "18. feature guide card 06 (目次) does NOT advertise 扉 / title-page creation",
  !!guide &&
    (() => {
      const c6 = guide.match(/n:\s*"06"[\s\S]{0,300}?\}/);
      return !!c6 && !/扉|タイトルページ|title.?page/i.test(c6[0]);
    })() &&
    // and the title-page creation UI is still hidden upstream
    /\/\/ \{ id: 'title'/.test(read("src/components/BookPartsModal.tsx") ?? "")
);

/* ---------------- 7. audited copy claims ---------------- */

check(
  "19. writing-check 'no external AI' claim is backed by the implementation (no network in writingCheck.ts)",
  !!writingCheck &&
    /NO network, NO external API, NO AI/.test(writingCheck) &&
    !/\bfetch\(|XMLHttpRequest|axios|sendBeacon|new WebSocket|https?:\/\/[^\s"'`]+\/(v1|api)/.test(writingCheck) &&
    !!demoData && /原稿をAIへ送らず、ブラウザ内でチェック/.test(demoData) &&
    !!guide && /原稿を勝手に外部AIへ送信しません/.test(guide)
);
check(
  "20. cloud copy uses the real current label 「クラウドに保存」, not an obsolete one",
  !!demoData &&
    /ヘッダーの「クラウドに保存」から設定できます/.test(demoData) &&
    !/クラウド登録/.test(demoData) &&
    !!header && /クラウドに保存/.test(header)
);
check(
  "21. demo code imports nothing from supabase / has no .sql; title-page UI still hidden; no DemoEditor fork",
  !!demoData && !/from ["']@\/lib\/supabase|\.sql\b/i.test(code(demoData)) &&
    !!tour && !/from ["']@\/lib\/supabase/i.test(code(tour)) &&
    !read("src/components/DemoEditor.tsx") &&
    /\/\/ \{ id: 'title'/.test(read("src/components/BookPartsModal.tsx") ?? "")
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All TSP-024 three-minute-demo checks passed.");
} else {
  console.log(`${failures} TSP-024 three-minute-demo check(s) FAILED.`);
  process.exit(1);
}
