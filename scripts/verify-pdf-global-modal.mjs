// TSP-PDF-GLOBAL-MODAL-AND-POST-NOTICE-CLEANUP-014B — move PDF export setup
// to an application-level modal; retire the post-export filename notice.
//
// Structural contracts only. The runtime proof (modal stays full-width when
// Preview is dragged narrow, background Editor is actually unclickable,
// Escape during a real export opens the pause/cancel confirmation instead of
// closing the dialog) is the browser walkthrough — regex cannot assert
// rendering geometry or event timing.
//
// Run:  node scripts/verify-pdf-global-modal.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};
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

const preview = read("src/components/PreviewPane.tsx");
const editor = read("src/components/TategakiEditor.tsx");
const viewportModal = read("src/components/ViewportModal.tsx");
const noticeModal = read("src/components/PdfExportNoticeModal.tsx");
const noticeHook = read("src/hooks/useShowPdfFilenameNotice.ts");
const previewCode = code(preview);
const editorCode = code(editor);

/* ---------------- 1. reuses the existing app-level modal/portal ---------------- */

check(
  "1. ViewportModal is a real document.body portal (the established pattern)",
  !!viewportModal &&
    /createPortal/.test(viewportModal) &&
    /document\.body/.test(viewportModal),
);
check(
  "1b. PDF setup dialog is rendered via <ViewportModal ...>, not a bespoke overlay",
  /isPdfModalOpen && !isExporting && \(\s*<ViewportModal/.test(previewCode),
);
check(
  "1c. no second modal architecture invented (no new createPortal/document.body use added to PreviewPane)",
  !!preview && !/createPortal/.test(preview),
);
check(
  "1d. old bespoke PDF-modal backdrop markup is gone",
  !!preview && !/absolute inset-0 z-50 flex items-center justify-center bg-black\/40 p-4/.test(preview),
);

/* ---------------- 2. Preview-width independence ---------------- */

check(
  "2. the PDF setup modal is portaled to document.body, so it is never a descendant of PreviewPane's own clipped root",
  !!viewportModal && /return createPortal\(/.test(viewportModal),
);
check(
  "2b. dialog width comes from panelClassName (viewport-relative), not any Preview-pane measurement",
  /<ViewportModal[\s\S]{0,400}panelClassName="max-w-sm"/.test(previewCode),
);

/* ---------------- 3. content order preserved ---------------- */

check(
  "3. content order: title (ViewportModal header) -> warning -> 対象 -> 出力 -> 保存ファイル名 -> footer",
  (() => {
    const dialogStart = previewCode.indexOf("<ViewportModal\n          title=\"PDF出力\"");
    if (dialogStart === -1) return false;
    const warnIdx = previewCode.indexOf("TateSpunは現在β版です", dialogStart);
    const scopeIdx = previewCode.indexOf(">対象<", dialogStart);
    const modeIdx = previewCode.indexOf(">出力<", dialogStart);
    const filenameIdx = previewCode.indexOf("保存ファイル名", dialogStart);
    return (
      warnIdx > dialogStart &&
      scopeIdx > warnIdx &&
      modeIdx > scopeIdx &&
      filenameIdx > modeIdx
    );
  })(),
);

/* ---------------- 4. background interaction blocked while open ---------------- */

check(
  "4. ViewportModal's overlay is fixed inset-0 and intercepts backdrop clicks (blocks the app behind it)",
  !!viewportModal && /fixed inset-0[^"]*"/.test(viewportModal) && /onClick=\{onClose\}/.test(viewportModal),
);
check(
  "4b. dialog stops click propagation to the backdrop (background never receives the click)",
  !!viewportModal && /onClick=\{\(event\) => event\.stopPropagation\(\)\}/.test(viewportModal),
);

/* ---------------- 5. unmounts for the export duration; ExportProgressModal takes over ---------------- */

check(
  "5. setup dialog's render condition excludes isExporting",
  /\{isPdfModalOpen && !isExporting && \(/.test(previewCode),
);
check(
  "5b. ExportProgressModal still renders unconditionally on isExporting (unchanged)",
  /\{isExporting && \(\s*<ExportProgressModal/.test(previewCode),
);
check(
  "5c. Cancel/Download no longer carry a dead isExporting guard (dialog can't be open while exporting)",
  (() => {
    const dialogStart = previewCode.indexOf('title="PDF出力"');
    const dialogEnd = previewCode.indexOf("</ViewportModal>", dialogStart);
    if (dialogStart === -1 || dialogEnd === -1) return false;
    const dialogBlock = previewCode.slice(dialogStart, dialogEnd);
    return !/isExporting/.test(dialogBlock);
  })(),
);

/* ---------------- 6. Escape safety: no race with the pause/cancel listener ---------------- */

check(
  "6. the isExporting Escape/pause-cancel listener is untouched",
  /if \(event\.key !== "Escape" \|\| !isExporting \|\| isExportCancelConfirmOpen\) return;/.test(
    previewCode,
  ),
);
check(
  "6b. the setup ViewportModal's own onClose just closes the setup dialog (no export-aware branching needed, since it isn't mounted during export)",
  /onClose=\{\(\) => setIsPdfModalOpen\(false\)\}/.test(previewCode),
);

/* ---------------- 7. selected-page validation still visible in the modal ---------------- */

check(
  "7. 書き出すページを選択してください validation message preserved inside the dialog",
  /書き出すページを選択してください/.test(previewCode),
);

/* ---------------- 8. filename feature untouched by the modal move ---------------- */

check(
  "8. filename field / helper / sanitizer wiring still present",
  /id="pdf-filename-stem"/.test(preview) &&
    /sanitizePdfFilenameStem/.test(preview) &&
    /buildDefaultPdfFilenameStem/.test(preview),
);
check(
  "8b. Download stays disabled on empty stem or empty selected-page scope",
  /disabled=\{\(pdfScope === "selected" && selected\.size === 0\) \|\| pdfFilenameStem\.length === 0\}/.test(
    previewCode,
  ),
);

/* ---------------- 9. export-menu (78f7aee) interplay unchanged ---------------- */

check(
  "9. selecting PDF from the export menu still closes the menu synchronously before opening the modal",
  /setIsExportMenuOpen\(false\);\s*\n\s*handleOpenPdfModal\(\);/.test(previewCode),
);
check(
  "9b. export-menu's own fixed-position JS-anchor fix is untouched",
  /TSP-ANNOUNCEMENT-VIDEO-PREVIEW-BLOCKERS-013/.test(preview) &&
    /position: "fixed", top: exportMenuPos\.top, left: exportMenuPos\.left/.test(preview),
);

/* ---------------- 10. checklist gate still stacks correctly (unchanged) ---------------- */

check(
  "10. PdfExportChecklistGate still renders as its own ViewportModal, unmodified wiring",
  /\{pdfChecklistAttempt && \(\s*<PdfExportChecklistGate/.test(previewCode),
);

/* ---------------- 11. post-export notice disabled, not deleted ---------------- */

check(
  "11. a single named flag gates the post-export notice",
  /const PDF_POST_EXPORT_NOTICE_ENABLED = false;/.test(editorCode),
);
check(
  "11b. handlePreviewPdfExportSuccess checks the flag before opening the notice",
  /if \(PDF_POST_EXPORT_NOTICE_ENABLED && showPdfFilenameNotice\) setIsPdfNoticeOpen\(true\);/.test(
    editorCode,
  ),
);
check(
  "11c. PdfExportNoticeModal component is kept intact (not deleted) for future reuse",
  !!noticeModal && /export default function PdfExportNoticeModal/.test(noticeModal),
);
check(
  "11d. useShowPdfFilenameNotice hook is kept intact (not deleted); preference key unchanged",
  !!noticeHook &&
    /export function useShowPdfFilenameNotice/.test(noticeHook) &&
    /"tatespun_pdf_filename_notice"/.test(noticeHook),
);
check(
  "11e. TategakiEditor still imports and renders PdfExportNoticeModal (dormant, not removed)",
  /import PdfExportNoticeModal from ".\/PdfExportNoticeModal";/.test(editor) &&
    /<PdfExportNoticeModal/.test(editor),
);
check(
  "11f. no destructive deletion: isPdfNoticeOpen state and its setter still exist",
  /const \[isPdfNoticeOpen, setIsPdfNoticeOpen\] = useState\(false\);/.test(editorCode),
);

/* ---------------- 12. no new success toast/modal invented ---------------- */

check(
  "12. no new post-export success component introduced (PreviewPane's onPdfExportSuccess call sites unchanged in count)",
  (previewCode.match(/onPdfExportSuccess\?\.\(\)/g) ?? []).length === 2,
);

console.log(failures === 0 ? "\nALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
