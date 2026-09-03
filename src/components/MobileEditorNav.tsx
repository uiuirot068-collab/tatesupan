"use client";

import Link from "next/link";

type SaveStatus = "loading" | "saved" | "saving" | "error";
type MobileView = "editor" | "preview";

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

interface MobileEditorNavProps {
  /** Which pane the phone layout is currently showing. */
  mobileView: MobileView;
  /** Show the manuscript editor and scroll it into view (never steals keyboard focus). */
  onShowEditor: () => void;
  /** Show the vertical-writing preview. */
  onShowPreview: () => void;
  /** Show the editor and open + scroll to the page-settings panel. */
  onShowSettings: () => void;
  /** Whether the narrow-viewport 集中モード is active. */
  focusMode: boolean;
  onEnterFocus: () => void;
  onExitFocus: () => void;
  /** Draft save status. Omitted for the sample/使い方ガイド document. */
  saveStatus?: SaveStatus;
  /** Cloud-save handler. Omitted for the sample document. */
  onSave?: () => void;
  isSaving?: boolean;
  /**
   * Opens the canonical β beta-feedback modal — the SAME handler the editor
   * toolbar's「報告」button uses. Omitted when beta feedback is disabled.
   */
  onOpenFeedback?: () => void;
}

/**
 * TSP-LOOP-020: the phone-only (`md:hidden`) editor navigation bar.
 *
 * It is `position: sticky; top: 0`, so it stays on screen no matter which
 * inner surface (manuscript textarea, preview canvas) currently owns a touch
 * gesture — the user is never trapped behind a nested scroller with no way
 * back to 本文 / プレビュー / 設定 / 一覧.
 *
 * Supersedes TSP-LOOP-012's `MobileFocusBar`: it keeps every capability that
 * bar had (save-status, cloud save, 報告 wired to the injected handler,
 * one-tap 集中モード enter/exit, a back link to the works list) and adds the
 * primary 本文 ↔ プレビュー ↔ 設定 navigation that previously required
 * scrolling past a 70dvh pane.
 *
 * Desktop (`md+`) never renders this — the full `Header` owns navigation there.
 */
export default function MobileEditorNav({
  mobileView,
  onShowEditor,
  onShowPreview,
  onShowSettings,
  focusMode,
  onEnterFocus,
  onExitFocus,
  saveStatus,
  onSave,
  isSaving,
  onOpenFeedback,
}: MobileEditorNavProps) {
  const tab = (active: boolean) =>
    `flex-1 whitespace-nowrap rounded-md px-2 py-1.5 text-center text-xs font-medium transition-colors ${
      active
        ? "bg-ink text-base shadow-sm"
        : "text-ink/70 hover:bg-ink/5"
    }`;

  return (
    <div
      className="sticky top-0 z-40 flex flex-none flex-col gap-1.5 rounded-xl border border-ink/10 bg-base/95 px-3 py-2 shadow-md backdrop-blur supports-[backdrop-filter]:bg-base/80 md:hidden"
    >
      <div className="flex items-center gap-1">
        <Link
          href="/"
          className="shrink-0 whitespace-nowrap rounded-md border border-ink/15 px-2 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
          aria-label="作品一覧へ戻る"
        >
          ← 一覧
        </Link>
        <div className="flex flex-1 items-center gap-1 rounded-lg bg-ink/5 p-0.5">
          <button
            type="button"
            onClick={onShowEditor}
            aria-pressed={mobileView === "editor"}
            className={tab(mobileView === "editor")}
          >
            ✏️ 本文
          </button>
          <button
            type="button"
            onClick={onShowPreview}
            aria-pressed={mobileView === "preview"}
            className={tab(mobileView === "preview")}
          >
            👁️ プレビュー
          </button>
          <button
            type="button"
            onClick={onShowSettings}
            className={tab(false)}
          >
            ⚙️ 設定
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        {saveStatus && (
          <span className="flex min-w-0 items-center gap-1.5 text-ink/60">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${SAVE_DOT[saveStatus]}`} />
            <span className="truncate">{SAVE_TEXT[saveStatus]}</span>
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="rounded-full bg-[#c5a059] px-3 py-1 font-medium text-white shadow-sm transition-colors hover:bg-[#b38f48] disabled:opacity-50"
            >
              {isSaving ? "保存中…" : "クラウド保存"}
            </button>
          )}
          {onOpenFeedback && (
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
    </div>
  );
}
