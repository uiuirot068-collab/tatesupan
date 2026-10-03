"use client";

import {
  SUPPORT_AFTER_EXPORT_FANBOX_LABEL,
  SUPPORT_AFTER_EXPORT_OFUSE_LABEL,
  SUPPORT_AFTER_EXPORT_TEXT,
  SUPPORT_FANBOX_URL,
  SUPPORT_OFUSE_URL,
} from "@/lib/supportLinks";

/**
 * SPN-SUPPORT-001: a quiet one-line support note shown in the Preview pane
 * right after an export succeeds. Not a popup: it sits in the pane's header
 * area, never blocks anything, and the ✕ hides it for the rest of the visit.
 */
export default function ExportSupportLine({ onClose }: { onClose: () => void }) {
  return (
    <p
      data-export-support-line=""
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-ink/10 pt-1.5 text-xs leading-relaxed text-ink/70 dark:border-[#2A3240] dark:text-[#AEB7C6]"
    >
      <span>{SUPPORT_AFTER_EXPORT_TEXT}</span>
      <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
        <a
          href={SUPPORT_OFUSE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ink underline underline-offset-2 dark:text-[#D4DBE7]"
        >
          {SUPPORT_AFTER_EXPORT_OFUSE_LABEL}
        </a>
        <span aria-hidden="true" className="text-ink/30">／</span>
        <a
          href={SUPPORT_FANBOX_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-ink underline underline-offset-2 dark:text-[#D4DBE7]"
        >
          {SUPPORT_AFTER_EXPORT_FANBOX_LABEL}
        </a>
      </span>
      <button
        type="button"
        onClick={onClose}
        aria-label="この一行を閉じる"
        className="ml-auto px-1 text-ink/40 hover:text-ink/70"
      >
        ✕
      </button>
    </p>
  );
}
