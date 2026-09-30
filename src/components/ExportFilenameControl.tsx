"use client";

import { useEffect, useState } from "react";
import { resolveExportFilenameStem, sanitizePdfFilenameStem } from "@/utils/exportFilename";
import { EXPORT_FILENAME_HELP } from "@/lib/editorTerminology";

interface ExportFilenameControlProps {
  stem: string;
  onChange: (stem: string) => void;
  className?: string;
  compact?: boolean;
}

export default function ExportFilenameControl({
  stem,
  onChange,
  className = "",
  compact = false,
}: ExportFilenameControlProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => resolveExportFilenameStem(stem));

  useEffect(() => {
    if (!editing) setDraft(resolveExportFilenameStem(stem));
  }, [stem, editing]);

  const reset = () => {
    setDraft(resolveExportFilenameStem(stem));
    setEditing(false);
  };

  const commit = () => {
    const next = sanitizePdfFilenameStem(draft);
    if (!next) return;
    onChange(next);
    setDraft(next);
    setEditing(false);
  };

  return (
    <div
      data-export-filename-control=""
      className={`min-w-0 items-center gap-1.5 ${className}`}
      title={EXPORT_FILENAME_HELP}
    >
      <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-ink/45">
        保存名
        <InfoTooltip text={EXPORT_FILENAME_HELP} label="保存名の説明" />
      </span>

      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(sanitizePdfFilenameStem(event.target.value))}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit();
              if (event.key === "Escape") reset();
            }}
            title={EXPORT_FILENAME_HELP}
            className={`min-w-0 rounded border border-ink/20 bg-base px-2 py-1 text-[11px] text-ink outline-none focus:border-accent ${compact ? "w-[120px]" : "flex-1"}`}
            aria-label="標準の書き出し保存ファイル名"
          />
          <button type="button" onClick={commit} disabled={draft.length === 0} className="shrink-0 text-[11px] font-medium text-accent disabled:opacity-40">
            設定
          </button>
          <button type="button" onClick={reset} className="shrink-0 text-[11px] text-ink/50">
            キャンセル
          </button>
        </>
      ) : (
        <>
          <span
            title={EXPORT_FILENAME_HELP}
            className={`min-w-0 truncate text-[11px] font-medium text-ink/65 ${compact ? "max-w-[150px]" : "flex-1"}`}
          >
            {resolveExportFilenameStem(stem)}
          </span>
          <button
            type="button"
            title={EXPORT_FILENAME_HELP}
            onClick={() => {
              setDraft(resolveExportFilenameStem(stem));
              setEditing(true);
            }}
            className="shrink-0 text-[11px] text-accent hover:underline"
          >
            変更
          </button>
        </>
      )}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[90] mt-2 hidden w-max max-w-[280px] -translate-x-1/2 rounded-md border border-ink/15 bg-base px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-ink shadow-lg group-hover:block group-focus-within:block"
      >
        {SAVE_NAME_HELP}
      </span>
    </div>
  );
}
