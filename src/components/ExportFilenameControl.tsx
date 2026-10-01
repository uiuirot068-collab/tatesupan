"use client";

import { useCallback, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { EXPORT_FILENAME_HELP } from "@/lib/editorTerminology";
import { resolveExportFilenameStem, sanitizePdfFilenameStem } from "@/utils/exportFilename";

interface ExportFilenameControlProps {
  stem: string;
  onChange: (stem: string) => void;
  className?: string;
  compact?: boolean;
}

const TOOLTIP_MAX_WIDTH_PX = 280;
const TOOLTIP_VIEWPORT_GUTTER_PX = 8;

/**
 * ⓘ-only help for the 保存名. The bubble is portaled to <body> with fixed
 * positioning so the Editor pane's `overflow-hidden` frame can never clip it,
 * and it opens ONLY while the ⓘ itself is hovered or focused (never on the
 * 「変更」 link or the current value).
 */
function ExportFilenameHelp() {
  const tooltipId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const open = useCallback(() => {
    const button = buttonRef.current;
    if (!button || typeof window === "undefined") return;
    const rect = button.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const width = Math.min(TOOLTIP_MAX_WIDTH_PX, viewportWidth - TOOLTIP_VIEWPORT_GUTTER_PX * 2);
    const centered = rect.left + rect.width / 2 - width / 2;
    const left = Math.max(
      TOOLTIP_VIEWPORT_GUTTER_PX,
      Math.min(centered, viewportWidth - width - TOOLTIP_VIEWPORT_GUTTER_PX)
    );
    setPosition({ top: rect.bottom + 8, left });
  }, []);
  const close = useCallback(() => setPosition(null), []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="保存名の説明"
        aria-describedby={position ? tooltipId : undefined}
        onMouseEnter={open}
        onMouseLeave={close}
        onFocus={open}
        onBlur={close}
        onKeyDown={(event) => {
          if (event.key === "Escape") close();
        }}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[13px] leading-none text-ink/45 outline-none transition-colors hover:bg-ink/5 hover:text-ink/70 focus:bg-ink/5 focus:text-ink/70"
      >
        ⓘ
      </button>
      {position && typeof document !== "undefined"
        ? createPortal(
            <span
              id={tooltipId}
              role="tooltip"
              data-export-filename-tooltip=""
              style={{ position: "fixed", top: position.top, left: position.left, maxWidth: TOOLTIP_MAX_WIDTH_PX }}
              className="pointer-events-none z-[200] block w-max rounded-md border border-ink/15 bg-base px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-ink shadow-lg"
            >
              {EXPORT_FILENAME_HELP}
            </span>,
            document.body
          )
        : null}
    </>
  );
}

export default function ExportFilenameControl({
  stem,
  onChange,
  className = "",
  compact = false,
}: ExportFilenameControlProps) {
  const allowedCharsHintId = useId();
  const [editing, setEditing] = useState(false);
  // Only meaningful while editing; seeded from the work's stem when 「変更」 opens.
  const [draft, setDraft] = useState(() => resolveExportFilenameStem(stem));

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
      className={`relative min-w-0 items-center gap-1.5 ${className}`}
    >
      {/* 狭幅では「保存名」ラベルとⓘを隠す（ボタンは常に表示）。 */}
      <span className="hidden shrink-0 items-center gap-0.5 text-[10px] text-ink/45 @min-[560px]:inline-flex">
        保存名
        <ExportFilenameHelp />
      </span>

      {editing ? (
        <>
          <div className="min-w-0">
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(sanitizePdfFilenameStem(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") commit();
                if (event.key === "Escape") reset();
              }}
              className={`min-w-0 rounded border border-ink/20 bg-base px-2 py-1 text-[11px] text-ink outline-none focus:border-accent ${compact ? "w-[120px]" : "flex-1"}`}
              aria-label="標準の書き出し保存ファイル名"
              aria-describedby={allowedCharsHintId}
            />
            {/* 編集中は幅に関係なく常に表示する（Human QA: 使える文字を必ず示す）。 */}
            <p
              id={allowedCharsHintId}
              data-export-filename-allowed-chars=""
              className="mt-0.5 whitespace-nowrap text-[9px] leading-tight text-ink/45"
            >
              半角英数字・_・-のみ使用できます
            </p>
          </div>
          <button
            type="button"
            onClick={commit}
            disabled={draft.length === 0}
            className="shrink-0 text-[11px] font-medium text-accent disabled:opacity-40"
          >
            設定
          </button>
          <button type="button" onClick={reset} className="shrink-0 text-[11px] text-ink/50">
            キャンセル
          </button>
        </>
      ) : (
        <>
          <span
            className={`hidden min-w-0 truncate text-[11px] font-medium text-ink/65 @min-[560px]:inline ${compact ? "max-w-[150px]" : "flex-1"}`}
          >
            {resolveExportFilenameStem(stem)}
          </span>
          <button
            type="button"
            onClick={() => {
              setDraft(resolveExportFilenameStem(stem));
              setEditing(true);
            }}
            aria-label="保存名を変更"
            data-export-filename-change=""
            className="shrink-0 whitespace-nowrap text-[11px] text-accent hover:underline"
          >
            {/* 「変更」単独では意味が曖昧なので、通常幅は「保存名を変更」、狭幅は「保存名」。 */}
            <span className="@min-[560px]:hidden">保存名</span>
            <span className="hidden @min-[560px]:inline">保存名を変更</span>
          </button>
        </>
      )}
    </div>
  );
}
