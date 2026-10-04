import { useEffect, useMemo, useReducer, useRef } from "react";
import {
  INITIAL_SEARCH_REPLACE_STATE,
  deriveSearchReplaceView,
  findMatchOffsets,
  planActiveReplace,
  planUndoReceipt,
  replaceAllMatches,
  searchReplaceReducer,
  stepFromView,
  type MatchContext,
  type ReplaceReceipt,
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
   * edit (undoable on both surfaces), leaving the new text selected where it
   * is. CST-PORT-015: the dialog stays on it (「3 件目を置換しました」 with
   * its surroundings); only 次へ / 前へ move on.
   */
  onReplaceOne?: (start: number, end: number, text: string) => void;
  onReplace: (
    nextContent: string,
    replacements: readonly { deletedText: string; insertedText: string }[]
  ) => void;
  onClose: () => void;
  /** Desktop Preview uses a non-blocking pane panel; phone keeps the screen modal. */
  placement?: "screen" | "preview";
  /** CST-PORT-015: the text just replaced / restored, for the editor's pale tint (null = none). */
  onMarkChange?: (range: { start: number; end: number } | null) => void;
}

const CONTEXT_CLASS = "mb-3 rounded border border-ink/10 bg-ink/[0.03] px-2 py-1.5 text-xs leading-relaxed text-ink/70";

/** …before[hit]after… with the hit marked (B7). */
function ContextText({ parts }: { parts: MatchContext }) {
  return (
    <>
      …{parts.before}
      <mark className="rounded-sm bg-accent/40 px-0.5 text-ink">{parts.hit || "（削除）"}</mark>
      {parts.after}…
    </>
  );
}

export default function SearchReplaceModal({
  content,
  onFind,
  onReplaceOne,
  onReplace,
  onClose,
  placement = "screen",
  onMarkChange,
}: SearchReplaceModalProps) {
  const [state, dispatch] = useReducer(searchReplaceReducer, INITIAL_SEARCH_REPLACE_STATE);
  const { searchText, replaceText } = state;
  const matches = useMemo(() => findMatchOffsets(content, searchText), [content, searchText]);
  const view = deriveSearchReplaceView(content, state, matches);

  // 置換 / この置換を戻す → the receipt to show once the edited manuscript
  // has actually committed (offsets are only valid against `content`). The
  // editor is NOT moved on to the next match (CST-PORT-015).
  const pendingReceiptRef = useRef<{ content: string; receipt: ReplaceReceipt } | null>(null);
  useEffect(() => {
    const pending = pendingReceiptRef.current;
    if (!pending || pending.content !== content) return;
    pendingReceiptRef.current = null;
    // A restored match is the active one again, so 置換 can be pressed straight away.
    const index = pending.receipt.kind === "restored" ? matches.indexOf(pending.receipt.start) : -1;
    dispatch({ type: "receipt", receipt: pending.receipt, matchIndex: index });
  }, [content, matches]);

  const markStart = view.markRange?.start ?? -1;
  const markEnd = view.markRange?.end ?? -1;
  useEffect(() => {
    onMarkChange?.(markStart >= 0 ? { start: markStart, end: markEnd } : null);
  }, [onMarkChange, markStart, markEnd]);
  useEffect(() => () => onMarkChange?.(null), [onMarkChange]);

  const step = (dir: 1 | -1) => {
    if (!view.canStep || !onFind) return;
    pendingReceiptRef.current = null;
    // From the index that is valid for the CURRENT match list (an edit made
    // while the panel is open can shrink it), or from the text just replaced.
    const next = stepFromView(view, searchText.length, dir);
    if (next < 0) return;
    dispatch({ type: "activate", index: next });
    onFind(matches[next], matches[next] + searchText.length);
  };

  const handleReplaceActive = () => {
    if (!onReplaceOne) return;
    const plan = planActiveReplace(content, state, view.activeOffset);
    if (!plan) return;
    const receipt: ReplaceReceipt = { kind: "replaced", start: plan.start, text: replaceText, previousText: searchText, ordinal: view.activeIndex + 1 };
    if (plan.nextContent === content) {
      // Replacing with identical text commits nothing, so no `content`
      // change would ever release a pending receipt: show it now.
      dispatch({ type: "receipt", receipt, matchIndex: -1 });
      return;
    }
    pendingReceiptRef.current = { content: plan.nextContent, receipt };
    onReplaceOne(plan.start, plan.end, replaceText);
  };

  const handleUndoReceipt = () => {
    if (!onReplaceOne || !view.receipt) return;
    const plan = planUndoReceipt(content, view.receipt);
    if (!plan) return;
    const receipt: ReplaceReceipt = { kind: "restored", start: plan.start, text: plan.text, previousText: view.receipt.text, ordinal: view.receipt.ordinal };
    if (plan.nextContent === content) {
      dispatch({ type: "receipt", receipt, matchIndex: matches.indexOf(plan.start) });
      return;
    }
    pendingReceiptRef.current = { content: plan.nextContent, receipt };
    onReplaceOne(plan.start, plan.end, plan.text);
  };

  const handleReplaceAll = () => {
    if (!view.canReplaceAll) return;
    const { nextContent, count } = replaceAllMatches(content, searchText, replaceText);
    // The panel stays open and says how many were replaced (CST-PORT-015).
    const receipt: ReplaceReceipt = { kind: "all", start: -1, text: replaceText, previousText: searchText, ordinal: count };
    if (nextContent === content) dispatch({ type: "receipt", receipt, matchIndex: -1 });
    else pendingReceiptRef.current = { content: nextContent, receipt };
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
            pendingReceiptRef.current = null;
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

        {view.receiptLabel && (
          <div className="mb-1 flex items-center justify-between gap-2" data-search-receipt={view.receipt?.kind}>
            <p className="text-xs font-semibold text-ink/80" aria-live="polite">{view.receiptLabel}</p>
            {view.canUndoReceipt && onReplaceOne && (
              <button
                type="button"
                data-search-action="undo-one"
                onClick={handleUndoReceipt}
                title="いま置換した 1 件だけを元の文字に戻します"
                className="rounded px-2 py-0.5 text-xs text-ink/70 underline underline-offset-2 hover:bg-ink/5"
              >
                この置換を戻す
              </button>
            )}
          </div>
        )}
        {view.receipt?.kind === "all" && (
          <p className="mb-3 text-[11px] leading-relaxed text-ink/60">閉じたあと、エディターの「元に戻す」（Ctrl+Z）1回でまとめて戻せます。</p>
        )}
        {view.receiptContext ? (
          <p data-search-receipt-context="" className={CONTEXT_CLASS}>
            <ContextText parts={view.receiptContext} />
          </p>
        ) : view.contextParts ? (
          <p data-search-match-context="" className={CONTEXT_CLASS}>
            <ContextText parts={view.contextParts} />
          </p>
        ) : null}

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
              title={view.canReplaceActive ? "選択中の一致 1 件だけを置換します（画面はそのまま。次の一致へは「次へ」で進みます）" : "「次へ」で一致箇所を選んでから置換できます"}
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
