"use client";

import Link from "next/link";

type SaveStatus = "loading" | "saved" | "saving" | "error";

const SAVE_TEXT: Record<SaveStatus, string> = {
  loading: "読み込み中…",
  saving: "保存中…",
  saved: "保存済み",
  error: "保存に失敗",
};

const SAVE_DOT: Record<SaveStatus, string> = {
  loading: "bg-ink/30",
  saving: "bg-accent animate-pulse",
  saved: "bg-accent",
  error: "bg-red-500",
};

interface MobileFocusBarProps {
  /** Whether focus mode is currently active. */
  focusMode: boolean;
  onEnterFocus: () => void;
  onExitFocus: () => void;
  /** Draft save status. Omitted for the sample/使い方ガイド document. */
  saveStatus?: SaveStatus;
  /** Cloud-save handler. Omitted for the sample document (no cloud button then). */
  onSave?: () => void;
  isSaving?: boolean;
  /**
   * Opens the canonical β beta-feedback modal — the SAME handler the editor
   * toolbar's「報告」button uses. Omitted when beta feedback is disabled.
   */
  onOpenFeedback?: () => void;
}

/**
 * TSP-LOOP-012: a slim, mobile-only (`md:hidden`) control strip for the editor.
 *
 * - Normal mode: surfaces the draft save-status (otherwise only in the large
 *   header) plus a single「集中モード」button to collapse non-editor chrome.
 * - Focus mode: the persistent bar the user is never trapped behind — keeps a
 *   one-tap exit (「通常表示に戻す」), the save-status, a back link to the
 *   works list, and cloud save when relevant.
 *
 * Desktop (`md+`) never renders this — the full header owns all of it there.
 */
export default function MobileFocusBar({
  focusMode,
  onEnterFocus,
  onExitFocus,
  saveStatus,
  onSave,
  isSaving,
  onOpenFeedback,
}: MobileFocusBarProps) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-ink/10 bg-base px-3 py-1.5 text-xs shadow-sm md:hidden">
      {focusMode && (
        <Link
          href="/"
          className="shrink-0 whitespace-nowrap font-medium text-ink/60 hover:text-ink hover:underline"
          aria-label="作品一覧へ戻る"
        >
          ← 一覧
        </Link>
      )}

      {saveStatus && (
        <span className="flex min-w-0 items-center gap-1.5 text-ink/60">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SAVE_DOT[saveStatus]}`} />
          <span className="truncate">{SAVE_TEXT[saveStatus]}</span>
        </span>
      )}

      <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
        {focusMode && onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="rounded-full bg-[#c5a059] px-3 py-1 font-medium text-white shadow-sm transition-colors hover:bg-[#b38f48] disabled:opacity-50"
          >
            {isSaving ? "保存中…" : "クラウド保存"}
          </button>
        )}
        {focusMode && onOpenFeedback && (
          <button
            type="button"
            onClick={onOpenFeedback}
            title="β版フィードバック（不具合・気になる事・要望）"
            className="rounded-full border border-amber-400 bg-amber-50 px-3 py-1 font-medium text-amber-800 hover:bg-amber-100"
          >
            報告
          </button>
        )}
        <button
          type="button"
          onClick={focusMode ? onExitFocus : onEnterFocus}
          className="whitespace-nowrap rounded-full border border-ink/20 px-3 py-1 font-medium text-ink/70 hover:bg-ink/5"
        >
          {focusMode ? "通常表示に戻す" : "⤢ 集中モード"}
        </button>
      </div>
    </div>
  );
}
