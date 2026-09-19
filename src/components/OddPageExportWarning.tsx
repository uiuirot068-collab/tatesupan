"use client";

import type { HTMLAttributes } from "react";
import ViewportModal from "./ViewportModal";
import {
  buildOddPageWarningTitle,
  ODD_PAGE_WARNING_CONTINUE_LABEL,
  ODD_PAGE_WARNING_EXPLANATION,
  ODD_PAGE_WARNING_MEANING,
  ODD_PAGE_WARNING_RETURN_LABEL,
} from "./oddPageWarningCopy";

interface OddPageExportWarningProps {
  totalPages: number;
  onReturn: () => void;
  onContinue: () => void;
}

/**
 * TSP-UX-V3-LOOP2-ODD-PAGE-012: replaces the old ambiguous `window.confirm`
 * for whole-book odd-page-count PDF export. Purely informational -- it never
 * mutates the manuscript, never adds a blank page, and never generates a
 * second PDF: "continue" resumes the exact pending export the caller already
 * built, "return" just closes this and leaves the PDF setup modal untouched.
 */
export default function OddPageExportWarning({
  totalPages,
  onReturn,
  onContinue,
}: OddPageExportWarningProps) {
  return (
    <ViewportModal
      title={buildOddPageWarningTitle(totalPages)}
      titleId="pdf-odd-page-warning-title"
      closeLabel="奇数ページの確認を閉じる"
      onClose={onReturn}
      panelClassName="max-w-sm"
      overlayProps={{ "data-pdf-odd-page-warning": "" } as HTMLAttributes<HTMLDivElement>}
      footer={(
        <>
          <button
            type="button"
            data-pdf-odd-page-warning-action="return"
            className="rounded border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5"
            onClick={onReturn}
          >
            {ODD_PAGE_WARNING_RETURN_LABEL}
          </button>
          <button
            type="button"
            data-pdf-odd-page-warning-action="continue"
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper-ink hover:opacity-90"
            onClick={onContinue}
          >
            {ODD_PAGE_WARNING_CONTINUE_LABEL}
          </button>
        </>
      )}
    >
      <p data-pdf-odd-page-warning-meaning="" className="text-sm leading-relaxed text-ink">
        {ODD_PAGE_WARNING_MEANING}
      </p>
      <p data-pdf-odd-page-warning-explanation="" className="mt-3 text-xs leading-relaxed text-ink/70">
        {ODD_PAGE_WARNING_EXPLANATION}
      </p>
    </ViewportModal>
  );
}
