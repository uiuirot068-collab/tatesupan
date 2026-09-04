"use client";

import { useEffect, useState } from "react";

interface PdfExportNoticeModalProps {
  /** Current "keep showing this" preference — seeds the checkbox. */
  initialKeepShowing: boolean;
  /**
   * Called on every intentional dismiss path (閉じる / ✕ / Escape / backdrop)
   * with the checkbox state as it stands at that moment. The parent commits
   * the preference here — the checkbox toggle alone never persists anything,
   * so an accidental tap that is toggled back before closing has no effect.
   */
  onClose: (keepShowing: boolean) => void;
}

/**
 * TSP-LOOP-028 — the one post-export conclusion for a successful PDF export.
 * Practical "check your 入稿 filename" advice, not an error or a blocker.
 * Shown only after `exportCustomPdf` resolves (PDF built + download triggered);
 * never for JPG / Web閲覧用, never on failure.
 */
export default function PdfExportNoticeModal({
  initialKeepShowing,
  onClose,
}: PdfExportNoticeModalProps) {
  const [keepShowing, setKeepShowing] = useState(initialKeepShowing);

  const dismiss = () => onClose(keepShowing);

  // Re-bound whenever the checkbox or onClose identity changes, so Escape
  // always commits the checkbox exactly as it stands.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose(keepShowing);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keepShowing, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-ink/10 bg-base p-4 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-export-notice-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between gap-2">
          <h2
            id="pdf-export-notice-title"
            className="text-sm font-bold text-ink"
          >
            PDFを書き出しました
          </h2>
          <button
            type="button"
            onClick={dismiss}
            aria-label="閉じる"
            className="-mr-1 -mt-1 rounded p-1 text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 text-xs leading-relaxed text-ink/75">
          <p>
            入稿ファイル名は日本語ではなくアルファベット表記に直しておくと、入稿時の事故が防ぎやすいです。
          </p>
          <p>
            印刷所のファイル名の指定をご確認してからご入稿ください。
          </p>
        </div>

        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink/70">
          <input
            type="checkbox"
            checked={keepShowing}
            onChange={(e) => setKeepShowing(e.target.checked)}
          />
          今後も表示する
        </label>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded border border-ink/20 px-3 py-1.5 text-xs text-ink/80 hover:bg-ink/5"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
