// TSP-LOOP-028 — PDF post-export UX finish.
//
// Structural contracts only. The runtime proof (notice fires AFTER a real PDF
// export success, never for JPG / Web / failure; preference survives reload)
// is the browser walkthrough — regex cannot assert timing.
//
// Run:  node scripts/verify-tsp028-export-ux-finish.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};
/** crude comment stripper */
const code = (src) =>
  (src ?? "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
};

const hook = read("src/hooks/useShowPdfFilenameNotice.ts");
const modal = read("src/components/PdfExportNoticeModal.tsx");
const editor = read("src/components/TategakiEditor.tsx");
const preview = read("src/components/PreviewPane.tsx");
const exportPdf = read("src/utils/exportPdf.ts");
const exportImage = read("src/utils/exportImage.ts");
const exportFilename = read("src/utils/exportFilename.ts");
const helpMd = read("public/docs/help.md");
const editorCode = code(editor);
const previewCode = code(preview);

/* ---------------- 1. notice component exists ---------------- */

check(
  "1. PdfExportNoticeModal component exists and is a dialog",
  !!modal && /role="dialog"/.test(modal) && /aria-modal="true"/.test(modal),
);

/* ---------------- 2. approved filename guidance, unaltered meaning ---------------- */

check(
  "2. notice carries the approved filename guidance",
  !!modal &&
    /入稿ファイル名は日本語ではなくアルファベット表記に直しておくと、入稿時の事故が防ぎやすいです。/.test(modal) &&
    /印刷所のファイル名の指定をご確認してからご入稿ください。/.test(modal),
);
check(
  "2b. no forbidden overstatements",
  !!modal &&
    !/日本語ファイル名は禁止/.test(modal) &&
    !/必ず(英数字|アルファベット)/.test(modal) &&
    !/日本語だと入稿できません/.test(modal) &&
    !/日本語(の)?ファイル名は使えません/.test(modal),
);

/* ---------------- 3. 「今後も表示する」 ---------------- */

check(
  "3. notice has a 「今後も表示する」 checkbox",
  !!modal && /今後も表示する/.test(modal) && /type="checkbox"/.test(modal),
);

/* ---------------- 4. default is show / checked ---------------- */

check(
  "4. preference defaults to ON when the key is absent",
  !!hook && /!==\s*"off"/.test(hook) && /catch\s*\{\s*return true;/.test(code(hook)),
);
check(
  "4b. checkbox seeds from the current preference",
  !!modal && /initialKeepShowing/.test(modal) && /useState\(initialKeepShowing\)/.test(modal),
);
check(
  "4c. the notice only opens when the preference is ON",
  !!editor && /if \(showPdfFilenameNotice\) setIsPdfNoticeOpen\(true\)/.test(editorCode),
);

/* ---------------- 5. preference is browser-local ---------------- */

check(
  "5. preference is localStorage-backed, namespaced tatespun_*",
  !!hook &&
    /window\.localStorage/.test(hook) &&
    /"tatespun_pdf_filename_notice"/.test(hook),
);
check(
  "5b. hook follows the existing useSyncExternalStore preference convention",
  !!hook && /useSyncExternalStore/.test(hook) && /\(\)\s*=>\s*true/.test(hook),
);

/* ---------------- 6/7. no schema / no Supabase ---------------- */

check(
  "6. the preference touches no manuscript / cloud-project schema",
  !!hook &&
    !/supabase|from ["']@\/lib\/db|Dexie|manuscript|cloud/i.test(code(hook)) &&
    !!modal &&
    !/supabase|from ["']@\/lib\/db/i.test(code(modal)),
);
check(
  "7. notice wiring adds no persistence call",
  !!editor &&
    !/supabase[\s\S]{0,40}pdf_?filename|pdf_?filename[\s\S]{0,40}supabase/i.test(editorCode),
);

/* ---------------- 8. PDF success path -> parent -> notice ---------------- */

check(
  "8. PreviewPane notifies onPdfExportSuccess only after exportCustomPdf resolves",
  !!preview &&
    (() => {
      const awaitIdx = previewCode.indexOf("await exportCustomPdf(");
      const cbIdx = previewCode.indexOf("onPdfExportSuccess?.()");
      const catchIdx = previewCode.indexOf("PDF書き出しに失敗しました");
      return (
        awaitIdx !== -1 &&
        cbIdx > awaitIdx &&
        catchIdx > cbIdx &&
        /await exportCustomPdf\(elements/.test(previewCode)
      );
    })(),
);
check(
  "8b. exportCustomPdf still ends by triggering the download (pdf.save)",
  !!exportPdf && /pdf\.save\(fileName\)\s*;/.test(exportPdf),
);
check(
  "8c. TategakiEditor wires onPdfExportSuccess -> open the notice",
  !!editor &&
    /onPdfExportSuccess=\{\(\) => \{[\s\S]{0,120}setIsPdfNoticeOpen\(true\)/.test(editor),
);

/* ---------------- 9. JPG success path does NOT invoke the notice ---------------- */

check(
  "9. no JPG / ZIP handler calls onPdfExportSuccess",
  !!preview &&
    (() => {
      for (const fn of [
        "handleExportJpg",
        "handleExportColophonJpg",
        "handleExportJpgBatch",
        "handleExportZip",
      ]) {
        const start = previewCode.indexOf(`const ${fn} = `);
        if (start === -1) continue;
        const body = previewCode.slice(start, previewCode.indexOf("\n  };", start));
        if (/onPdfExportSuccess|setIsPdfNoticeOpen/.test(body)) return false;
      }
      return true;
    })(),
);
check(
  "9b. the JPG export utils never reference the notice / its preference",
  !!exportImage &&
    !/PdfExportNotice|pdf_filename_notice|onPdfExportSuccess/.test(exportImage),
);

/* ---------------- 10. Web export cannot reach the notice ---------------- */

check(
  "10. handleDownloadPdf early-returns for Web閲覧用 (isPx) before onPdfExportSuccess",
  !!preview &&
    (() => {
      const start = previewCode.indexOf("const handleDownloadPdf");
      const body = previewCode.slice(start, previewCode.indexOf("\n  };", start));
      return (
        /if \(layout\.paper\.isPx\) return;/.test(body) &&
        body.indexOf("layout.paper.isPx") < body.indexOf("onPdfExportSuccess?.()")
      );
    })(),
);

/* ---------------- 11. failure path does not falsely mark success ---------------- */

check(
  "11. onPdfExportSuccess sits inside the try, before catch — a throw skips it",
  !!preview &&
    (() => {
      const start = previewCode.indexOf("const handleDownloadPdf");
      const cbIdx = previewCode.indexOf("onPdfExportSuccess?.()", start);
      const catchIdx = previewCode.indexOf("} catch (err) {", start);
      const alertIdx = previewCode.indexOf("PDF書き出しに失敗しました", start);
      return cbIdx !== -1 && cbIdx < catchIdx && catchIdx < alertIdx;
    })(),
);
check(
  "11b. an unresolved-image block returns before onPdfExportSuccess",
  !!preview &&
    (() => {
      const start = previewCode.indexOf("const handleDownloadPdf");
      const body = previewCode.slice(start, previewCode.indexOf("\n  };", start));
      return (
        body.indexOf("exportBlockedByUnresolvedImages()") <
        body.indexOf("onPdfExportSuccess?.()")
      );
    })(),
);

/* ---------------- 12. no automatic rename / transliteration ---------------- */

check(
  "12. no romaji / transliteration / ASCII-forcing / filename mutation added",
  !!exportFilename &&
    !/romaji|romanize|transliterat|kana2roman/i.test(exportFilename) &&
    !!modal &&
    !/romaji|transliterat|\.setAttribute\(["']download["']|download\.name\s*=/.test(code(modal)),
);

/* ---------------- 13. stable namespace ---------------- */

check(
  "13. preference key is a single stable namespaced constant",
  !!hook &&
    (hook.match(/STORAGE_KEY = "tatespun_pdf_filename_notice"/g) || []).length === 1 &&
    (hook.match(/"tatespun_pdf_filename_notice"/g) || []).length === 1,
);

/* ---------------- 14. coherent dismiss behavior ---------------- */

check(
  "14. every dismiss path (閉じる / ✕ / Escape / backdrop) commits the visible checkbox state",
  !!modal &&
    /const dismiss = \(\) => onClose\(keepShowing\)/.test(modal) &&
    /className="fixed inset-0[^"]*"\s*\n\s*onClick=\{dismiss\}/.test(modal) &&
    /e\.key === "Escape"[\s\S]{0,120}onClose\(keepShowing\)/.test(modal) &&
    (modal.match(/onClick=\{dismiss\}/g) || []).length >= 3,
);
check(
  "14b. the checkbox toggle alone never persists — only onClose does",
  !!modal &&
    /onChange=\{\(e\) => setKeepShowing\(e\.target\.checked\)\}/.test(modal) &&
    !/onChange=\{[^}]*onClose/.test(modal),
);
check(
  "14c. TategakiEditor commits the returned checkbox state to the preference on close",
  !!editor &&
    /onClose=\{\(keepShowing\) => \{[\s\S]{0,220}setShowPdfFilenameNotice\(keepShowing\)[\s\S]{0,80}setIsPdfNoticeOpen\(false\)/.test(
      editor,
    ),
);

/* ---------------- 15. notice is app-level, not scoped to the preview pane ---------------- */

check(
  "15. the notice modal renders in TategakiEditor (survives the phone workspace switch), not inside PreviewPane",
  !!editor &&
    /\{isPdfNoticeOpen && \(\s*\n?\s*<PdfExportNoticeModal/.test(editor) &&
    !!preview &&
    !/PdfExportNoticeModal/.test(preview),
);

/* ---------------- 16. help consistency (no contradiction) ---------------- */

check(
  "16. help.md export section stays consistent (mentions the notice, same non-overstated advice)",
  !!helpMd &&
    /ファイル名についての短い案内が表示されます/.test(helpMd) &&
    /アルファベット表記のほうが入稿時の事故を防ぎやすい/.test(helpMd) &&
    !/日本語ファイル名は禁止|日本語だと入稿できません/.test(helpMd),
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All TSP-028 export-ux-finish checks passed.");
} else {
  console.log(`${failures} TSP-028 export-ux-finish check(s) FAILED.`);
  process.exit(1);
}
