// TSP-PDF-SAFE-FILENAME-014 — safe PDF export filename field.
//
// Structural contracts only. Sanitizer edge cases live in
// src/utils/exportFilename.test.ts (vitest); this script asserts the field is
// actually wired into both PDF download paths and the modal's disabled/reset
// behavior, which a pure unit test on exportFilename.ts cannot see.
//
// Run:  node scripts/verify-pdf-safe-filename.mjs
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
const exportFilename = read("src/utils/exportFilename.ts");
const previewCode = code(preview);

/* ---------------- 1. sanitizer/default/builder exist ---------------- */

check(
  "1. exportFilename exports the stem sanitizer, default, and .pdf builder",
  !!exportFilename &&
    /export function sanitizePdfFilenameStem/.test(exportFilename) &&
    /export function buildDefaultPdfFilenameStem/.test(exportFilename) &&
    /export function buildPdfFileNameFromStem/.test(exportFilename),
);
check(
  "1b. sanitizer allow-list is exactly ASCII alphanumeric",
  !!exportFilename && /\[\^A-Za-z0-9\]/.test(exportFilename),
);
check(
  "1c. default stem uses TateSpun + zero-padded YYYYMMDD",
  !!exportFilename && /`TateSpun\$\{year\}\$\{month\}\$\{day\}`/.test(exportFilename),
);
check(
  "1d. old title-derived PDF filename builder is gone (fully replaced, not left dead)",
  !!exportFilename && !/export function buildPdfFileName\(/.test(exportFilename),
);

/* ---------------- 2. field is wired into the PDF modal ---------------- */

check(
  "2. modal has a 保存ファイル名 label bound to the input via htmlFor/id",
  !!preview &&
    /保存ファイル名/.test(preview) &&
    /htmlFor="pdf-filename-stem"/.test(preview) &&
    /id="pdf-filename-stem"/.test(preview),
);
check(
  "2b. .pdf extension is rendered separately, not editable in the input",
  !!preview && /<span[^>]*>\.pdf<\/span>/.test(preview),
);
check(
  "2c. approved helper copy present, describing the field (aria-describedby)",
  !!preview &&
    /入稿用ファイル名は英数字がおすすめです。印刷所の指定もご確認ください。/.test(preview) &&
    /aria-describedby="pdf-filename-stem-help"/.test(preview) &&
    /id="pdf-filename-stem-help"/.test(preview),
);
check(
  "2d. existing top submission warning is preserved verbatim",
  !!preview &&
    /TateSpunは現在β版です。書き出したデータは、印刷所への入稿前にページ・サイズ・文字・画像などを必ずご確認ください。/.test(
      preview,
    ),
);

/* ---------------- 3. input enforces the sanitizer on every keystroke/paste ---------------- */

check(
  "3. onChange runs the value through sanitizePdfFilenameStem before storing it",
  !!preview &&
    /onChange=\{\(e\) => setPdfFilenameStem\(sanitizePdfFilenameStem\(e\.target\.value\)\)\}/.test(
      preview,
    ),
);

/* ---------------- 4. default/reset policy ---------------- */

check(
  "4. handleOpenPdfModal reinitializes the stem to today's default on open",
  /const handleOpenPdfModal = \(\) => \{[\s\S]{0,200}setPdfFilenameStem\(buildDefaultPdfFilenameStem\(\)\)[\s\S]{0,80}setIsPdfModalOpen\(true\)/.test(
    previewCode,
  ),
);
check(
  "4b. radio onChange handlers (scope/mode) never touch pdfFilenameStem",
  !/onChange=\{\(\) => setPdfScope\([^)]*\)[\s\S]{0,40}setPdfFilenameStem/.test(previewCode) &&
    !/onChange=\{\(\) => setPdfMode\([^)]*\)[\s\S]{0,40}setPdfFilenameStem/.test(previewCode),
);

/* ---------------- 5. empty stem disables Download, Cancel stays enabled ---------------- */

check(
  "5. Download button's disabled expression includes an empty-stem check",
  /disabled=\{[\s\S]{0,200}pdfFilenameStem\.length === 0/.test(previewCode),
);
check(
  "5b. Cancel button has no disabled/isExporting guard (dialog unmounts entirely while exporting — see 8d)",
  !/onClick=\{\(\) => setIsPdfModalOpen\(false\)\}\s*\n\s*disabled=/.test(preview),
);

/* ---------------- 6. actual download filename, both engine paths ---------------- */

check(
  "6. no PDF download call site in the modal still calls the old title-derived builder",
  !!preview && !/buildPdfFileName\(title/.test(preview),
);
check(
  "6b. downloadBytes (V2 engine path) uses the sanitized-stem filename",
  /downloadBytes\(bytes, pdfFileName, "application\/pdf"\)/.test(previewCode),
);
check(
  "6c. exportCustomPdf (legacy engine path) uses the sanitized-stem filename",
  /fileName: pdfFileName,/.test(previewCode),
);
check(
  "6d. pdfFileName is built once via buildPdfFileNameFromStem(pdfFilenameStem)",
  /const pdfFileName = buildPdfFileNameFromStem\(pdfFilenameStem\);/.test(previewCode),
);

/* ---------------- 7. no scope creep ---------------- */

check(
  "7. no Supabase/analytics/network call introduced near the filename state",
  !/pdfFilenameStem[\s\S]{0,300}(supabase|analytics|fetch\()/i.test(previewCode),
);

console.log(failures === 0 ? "\nALL CHECKS PASS" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
