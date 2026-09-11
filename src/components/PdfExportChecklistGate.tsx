"use client";

import type { Dispatch, HTMLAttributes, SetStateAction } from "react";
import {
  pdfExportChecklistAttemptProgress,
  updatePdfExportChecklistAttempt,
  type PdfExportChecklistAttempt,
} from "../../typesetting-v2/tools/human-e2e-editor/checklistModel";
import ViewportModal from "./ViewportModal";

interface PdfExportChecklistGateProps {
  attempt: PdfExportChecklistAttempt;
  onAttemptChange: Dispatch<SetStateAction<PdfExportChecklistAttempt | null>>;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Per-attempt Human confirmation. Its checked state is never persisted. */
export default function PdfExportChecklistGate({
  attempt,
  onAttemptChange,
  onCancel,
  onConfirm,
}: PdfExportChecklistGateProps) {
  const progress = pdfExportChecklistAttemptProgress(attempt);

  return (
    <ViewportModal
      title="完成前マイチェックリスト"
      titleId="pdf-export-checklist-gate-title"
      closeLabel="PDF書き出し前の確認を閉じる"
      onClose={onCancel}
      panelClassName="max-w-lg"
      overlayProps={{ "data-pdf-checklist-gate": "" } as HTMLAttributes<HTMLDivElement>}
      footer={(
        <>
          <button
            type="button"
            data-pdf-checklist-gate-action="cancel"
            className="rounded border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5"
            onClick={onCancel}
          >
            戻る
          </button>
          <button
            type="button"
            data-pdf-checklist-gate-action="export"
            disabled={!progress.complete}
            className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={onConfirm}
          >
            PDFを書き出す
          </button>
        </>
      )}
    >
      <p data-pdf-checklist-gate-name="" className="text-sm font-medium text-ink">
        「{attempt.name}」
      </p>

      {attempt.items.length === 0 ? (
        <p data-pdf-checklist-gate-empty="" className="mt-3 rounded bg-ink/5 px-3 py-3 text-sm leading-relaxed text-ink/60">
          このリストには確認項目がありません。そのままPDFを書き出せます。
        </p>
      ) : (
        <ul className="mt-3 grid gap-2">
          {attempt.items.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded border border-ink/10 px-3 py-2 text-sm hover:bg-ink/5">
                <input
                  type="checkbox"
                  data-pdf-checklist-gate-item={item.id}
                  checked={attempt.checkedItemIds.includes(item.id)}
                  onChange={(event) => onAttemptChange((current) => current
                    ? updatePdfExportChecklistAttempt(current, item.id, event.target.checked)
                    : current)}
                  className="mt-0.5"
                />
                <span className="leading-relaxed text-ink">{item.text || "無題の項目"}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <p data-pdf-checklist-gate-progress="" aria-live="polite" className="mt-3 rounded bg-ink/5 px-3 py-2 text-sm text-ink/65">
        {progress.checked} / {progress.total} 項目を確認済み
      </p>
      <p className="mt-3 text-xs leading-relaxed text-ink/50">
        この確認状態は今回のPDF書き出しにだけ使用され、保存されません。
      </p>
    </ViewportModal>
  );
}
