import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  INITIAL_SEARCH_REPLACE_STATE,
  deriveSearchReplaceView,
  findMatchOffsets,
  planActiveReplace,
  replaceAllMatches,
  searchReplaceReducer,
  stepMatchIndex,
} from "@/lib/searchReplaceNavigation";

export { findMatchOffsets, stepMatchIndex } from "@/lib/searchReplaceNavigation";

interface SearchReplaceModalProps {
  content: string;
  /**
   * Phase 9: reveal a match in the editor (canonical offsets): scroll it into
   * view and select it. The windowed editor mounts one 編集ページ, so browser
   * find (Ctrl+F) cannot reach the rest of the manuscript; 前へ / 次へ here
   * searches the whole canonical text on either editor surface and switches
   * 編集ページ when the match lives on another one.
   */
  onFind?: (start: number, end: number) => void;
  /**
   * 選択箇所を置換: replace exactly `[start, end)` with `text` as ONE editor
   * edit (undoable on both surfaces). The dialog then activates the next
   * match once the new content arrives back through `content`.
   */
  onReplaceOne?: (start: number, end: number, text: string) => void;
  onReplace: (
    nextContent: string,
    replacements: readonly { deletedText: string; insertedText: string }[]
  ) => void;
  onClose: () => void;
  /** Desktop Preview uses a non-blocking pane panel; phone keeps the screen modal. */
  placement?: "screen" | "preview";
}

export default function SearchReplaceModal({
  content,
  onFind,
  onReplaceOne,
  onReplace,
  onClose,
  placement = "screen",
}: SearchReplaceModalProps) {
  const [state, dispatch] = useReducer(searchReplaceReducer, INITIAL_SEARCH_REPLACE_STATE);
  const { searchText, replaceText } = state;
  const matches = useMemo(() => findMatchOffsets(content, searchText), [content, searchText]);
  const view = deriveSearchReplaceView(content, state, matches);

  // 選択箇所を置換 → the match to reveal once the replaced manuscript has
  // actually committed (the editor surfaces map offsets against `content`).
  const pendingAfterReplaceRef = useRef<{ content: string; index: number; offset: number } | null>(null);
  useEffect(() => {
    const pending = pendingAfterReplaceRef.current;
    if (!pending || pending.content !== content) return;
    pendingAfterReplaceRef.current = null;
    dispatch({ type: "activate", index: pending.index });
    if (pending.index >= 0) onFind?.(pending.offset, pending.offset + searchText.length);
  }, [content, onFind, searchText.length]);

  const step = (dir: 1 | -1) => {
    if (!view.canStep || !onFind) return;
    pendingAfterReplaceRef.current = null;
    // From the index that is valid for the CURRENT match list (an edit made
    // while the panel is open can shrink it), never a stale stored one.
    const next = stepMatchIndex(view.activeIndex, view.count, dir);
    dispatch({ type: "activate", index: next });
    onFind(matches[next], matches[next] + searchText.length);
  };

  const handleReplaceActive = () => {
    if (!onReplaceOne) return;
    const plan = planActiveReplace(content, state, view.activeOffset);
    if (!plan) return;
    if (plan.nextContent === content) {
      // Replacing with identical text commits nothing, so no `content`
      // change would ever release a pending reveal: just move on.
      dispatch({ type: "activate", index: plan.nextIndex });
      if (plan.nextIndex >= 0) onFind?.(plan.nextOffset, plan.nextOffset + searchText.length);
      return;
    }
    pendingAfterReplaceRef.current = { content: plan.nextContent, index: plan.nextIndex, offset: plan.nextOffset };
    onReplaceOne(plan.start, plan.end, replaceText);
  };

  const handleReplaceAll = () => {
    if (!view.canReplaceAll) return;
    const { nextContent, count } = replaceAllMatches(content, searchText, replaceText);
    onReplace(
      nextContent,
      Array.from({ length: count }, () => ({
        deletedText: searchText,
        insertedText: replaceText,
      }))
    );
  };

  const panePlacement = placement === "preview";
  const secondaryButton = "rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <div
      data-search-replace-placement={placement}
      className={panePlacement
        ? "pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center p-4"
        : "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"}
      onClick={panePlacement ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-label="検索・置換"
        className="pointer-events-auto w-full max-w-sm rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <h2 className="mb-4 text-base font-semibold text-ink">検索・置換</h2>

        <label className="mb-1 block text-xs text-ink/60" htmlFor={`search-text-${placement}`}>
          検索する文字列
        </label>
        <input
          id={`search-text-${placement}`}
          data-search-input=""
          autoFocus
          value={searchText}
          onChange={(e) => {
            pendingAfterReplaceRef.current = null;
            dispatch({ type: "setSearch", searchText: e.target.value });
          }}
          onKeyDown={(e) => {
            // Enter = 次へ, Shift+Enter = 前へ (never while an IME is converting).
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          }}
          className="mb-3 w-full rounded border border-ink/20 bg-base px-3 py-2 text-sm text-ink outline-none focus:border-ink/60"
          placeholder="例: 山田"
        />

        <label className="mb-1 block text-xs text-ink/60" htmlFor={`replace-text-${placement}`}>
          置換後の文字列<span className="ml-1 text-ink/40">（検索だけなら空欄のまま）</span>
        </label>
        <input
          id={`replace-text-${placement}`}
          data-replace-input=""
          value={replaceText}
          onChange={(e) => dispatch({ type: "setReplace", replaceText: e.target.value })}
          className="mb-3 w-full rounded border border-ink/20 bg-base px-3 py-2 text-sm text-ink outline-none focus:border-ink/60"
          placeholder="例: 田中"
        />

        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-ink/60">
            {view.statusLabel === null ? (
              "検索文字列を入力してください"
            ) : (
              <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-paper-ink" data-search-match-status="">
                {view.statusLabel}
              </span>
            )}
          </p>
          {onFind && (
            <div className="flex flex-none gap-2">
              <button
                type="button"
                data-search-step="prev"
                onClick={() => step(-1)}
                disabled={!view.canStep}
                className={secondaryButton}
              >
                前へ
              </button>
              <button
                type="button"
                data-search-step="next"
                onClick={() => step(1)}
                disabled={!view.canStep}
                className={secondaryButton}
              >
                次へ
              </button>
            </div>
          )}
        </div>

        {view.context && (
          <p data-search-match-context="" className="mb-3 rounded border border-ink/10 bg-ink/[0.03] px-2 py-1.5 text-xs leading-relaxed text-ink/70">
            …{view.context}…
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            data-search-action="close"
            onClick={onClose}
            className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5"
          >
            閉じる
          </button>
          {onReplaceOne && (
            <button
              type="button"
              data-search-action="replace-one"
              onClick={handleReplaceActive}
              disabled={!view.canReplaceActive}
              title={view.canReplaceActive ? "選択中の一致 1 件だけを置換して次へ進みます" : "「次へ」で一致箇所を選んでから置換できます"}
              className={secondaryButton}
            >
              選択箇所を置換
            </button>
          )}
          <button
            type="button"
            data-search-action="replace-all"
            onClick={handleReplaceAll}
            disabled={!view.canReplaceAll}
            className="rounded bg-ink px-3 py-1.5 text-sm text-base hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            すべて置換
          </button>
        </div>
      </div>
    </div>
  );
}
