// P3-O08 -- JPG Export filename contract (Human Visual QA HOLD round 32:
// browser production integration). Ported verbatim from
// `src/utils/exportFilename.ts`'s real, cited legacy logic -- NOT
// imported from `src/` (typesetting-v2 must not depend on Production),
// re-implemented here as v2's own owned copy of the same contract.
// Pure string logic, zero platform imports -- safe from both the Node
// (`jpgExport.ts`) and browser (`rasterGeneratorBrowser.ts`) executors.

const FALLBACK_TITLE = "無題のドキュメント";
const FORBIDDEN_FILENAME_CHARS = /[\\/:*?"<>|]/g;

export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(FORBIDDEN_FILENAME_CHARS, "")
    .trim()
    .replace(/[.\s]+$/, "");
  return cleaned.length > 0 ? cleaned : FALLBACK_TITLE;
}

function padPageNumber(pageNumber: number): string {
  return String(pageNumber).padStart(3, "0");
}

export function buildPageJpgFileName(title: string, pageNumber: number): string {
  return `${sanitizeFilename(title)}_${padPageNumber(pageNumber)}.jpg`;
}

export function buildZipFileName(title: string): string {
  return `${sanitizeFilename(title)}_jpg.zip`;
}
