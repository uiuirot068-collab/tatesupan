"use client";

/**
 * CST-PORT-003: preview pager  前 [ 15 ] / 226 次  (ported from COLUMNSTAND's
 * PageNumberInput). Numbers are physical page numbers (目次・奥付を含む).
 * - Enter or blur commits, Esc reverts to the page shown before editing
 * - 全角数字 OK; ≤ 0 → 1, > total → last page, non-numeric → revert
 * - the field shows the live current page whenever it is not being edited
 */
import { useState } from "react";
import { parsePageNumberInput } from "@/lib/pageJump";

const BUTTON_CLASS =
  "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded border border-ink/20 text-sm leading-none hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40 md:h-7 md:w-7 md:text-xs";

export default function PageNumberInput({
  currentPage,
  totalPages,
  onCommit,
  onPrevious,
  onNext,
  canPrevious,
  canNext,
}: {
  currentPage: number;
  totalPages: number;
  onCommit: (page: number) => void;
  onPrevious: () => void;
  onNext: () => void;
  canPrevious: boolean;
  canNext: boolean;
}) {
  // `editing` holds the draft only while the field is being edited; otherwise
  // the field always shows the live current page (no stale state to sync).
  const [editing, setEditing] = useState<string | null>(null);

  const commit = () => {
    if (editing === null) return;
    const page = parsePageNumberInput(editing, totalPages);
    setEditing(null);
    // Focus + blur without typing must not move the preview.
    if (page !== null && editing.trim() !== String(currentPage)) onCommit(page);
  };

  return (
    <span
      data-preview-page-jump=""
      className="flex flex-shrink-0 items-center gap-1 text-xs text-ink/70"
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canPrevious}
        aria-label="前のページへ"
        title="前のページへ"
        className={BUTTON_CLASS}
      >
        前
      </button>
      <input
        type="text"
        inputMode="numeric"
        enterKeyHint="go"
        autoComplete="off"
        aria-label={`ページ番号（1〜${totalPages}）。入力してEnterで移動`}
        title="ページ番号を入れてEnterで移動"
        value={editing ?? String(currentPage)}
        size={Math.max(2, String(totalPages).length)}
        disabled={totalPages < 1}
        onFocus={(event) => {
          setEditing(String(currentPage));
          event.currentTarget.select();
        }}
        onChange={(event) => setEditing(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          // Don't commit in the middle of an IME composition (全角入力の確定Enter).
          if (event.nativeEvent.isComposing) return;
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur(); // blur → commit
          } else if (event.key === "Escape") {
            event.preventDefault();
            event.stopPropagation();
            setEditing(null);
            // keep the reverted value even though blur follows
            const input = event.currentTarget;
            requestAnimationFrame(() => input.blur());
          }
        }}
        className="h-9 min-w-[3em] max-w-[4.5em] rounded-full border border-ink/20 bg-white px-2 text-center text-sm tabular-nums text-ink hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent md:h-7 md:text-xs dark:bg-neutral-900"
      />
      <span className="whitespace-nowrap tabular-nums">/ {totalPages}</span>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        aria-label="次のページへ"
        title="次のページへ"
        className={BUTTON_CLASS}
      >
        次
      </button>
    </span>
  );
}
