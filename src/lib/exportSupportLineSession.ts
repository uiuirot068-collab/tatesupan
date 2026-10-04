/**
 * SPN-SUPPORT-001/003: the after-export support line is shown at most until the
 * reader closes it once; after that it stays hidden for the rest of the visit.
 * Shared by the Preview pane, the phone 編集 view and the cover export dialog so
 * closing it in one place hides it everywhere.
 */
const EXPORT_SUPPORT_LINE_DISMISSED_KEY = "tatespun:export-support-line-dismissed";

export function isExportSupportLineDismissed(): boolean {
  try {
    return Boolean(window.sessionStorage.getItem(EXPORT_SUPPORT_LINE_DISMISSED_KEY));
  } catch {
    // Storage unavailable: still show the line.
    return false;
  }
}

export function rememberExportSupportLineDismissed(): void {
  try {
    window.sessionStorage.setItem(EXPORT_SUPPORT_LINE_DISMISSED_KEY, "1");
  } catch {
    // Storage unavailable: hidden until the next export.
  }
}
