"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { issueContext, type WritingDiagnostic } from "@/lib/writingCheckEngine";
import { summarizeWritingIssues } from "@/lib/writingCheckSummary";

interface WritingCheckBarProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  /** Issues paired with the exact text they were computed against (for the snippets). Already ignore-filtered by the caller. */
  text: string;
  issues: WritingDiagnostic[];
  onSelectIssue: (issue: WritingDiagnostic) => void;
  onFixIssue: (issue: WritingDiagnostic) => void;
  onIgnoreIssue: (issue: WritingDiagnostic) => void;
  onBulkFix: () => void;
  onOpenSettings: () => void;
  undoAvailable: boolean;
  onUndo: () => void;
  /**
   * TSP-B1: bump this counter to open the result list from outside (the Review
   * Hub's 「確認候補を見る」). Purely a request — the list still only opens when
   * the check is on and has candidates, exactly as before.
   */
  resultsRequestNonce?: number;
  /**
   * TSP-B2: whether the footer strip (checkbox, candidate count, settings, note) is displayed. Display only —
   * `enabled` is untouched, and the result-list popover host stays mounted so the Review Hub's 「確認候補を見る」
   * still opens it. While a fix's one-step 元に戻す window is open that single button is kept, so an automated
   * manuscript change is never left without an undo.
   */
  showBar?: boolean;
}

/**
 * TSP-LOOP-004 → 文章チェック β 2.0 (Phase 3) result panel. Lives in the
 * editor footer area; the reason list is a popover so it never changes the
 * textarea's height. Selecting an item's own text moves the caret/selection
 * to that range — it never edits the text on its own; only the explicit 直す
 * / まとめて直す buttons ever mutate the manuscript, and only in direct
 * response to a click (see `applyFix.ts`/`applyBulkFix.ts`'s own doc: a fix
 * never applies silently).
 *
 * RED (原稿事故・高確度) vs YELLOW (確認推奨) is `severity`, drawn with BOTH a
 * color AND a text label — never color alone (accessibility requirement from
 * the Phase 3 task). This is INDEPENDENT of `fixClass` (直す is offered
 * whenever `suggestedReplacement` exists, regardless of severity).
 */
export default function WritingCheckBar({
  enabled,
  onToggle,
  text,
  issues,
  onSelectIssue,
  onFixIssue,
  onIgnoreIssue,
  onBulkFix,
  onOpenSettings,
  undoAvailable,
  onUndo,
  resultsRequestNonce,
  showBar = true,
}: WritingCheckBarProps) {
  const [open, setOpen] = useState(false);
  // Adjust-state-during-render: a changed request counter opens the list once.
  const [handledResultsRequest, setHandledResultsRequest] = useState(resultsRequestNonce);
  if (resultsRequestNonce !== handledResultsRequest) {
    setHandledResultsRequest(resultsRequestNonce);
    if (resultsRequestNonce !== undefined) setOpen(true);
  }
  const rootRef = useRef<HTMLDivElement>(null);
  const summary = useMemo(() => summarizeWritingIssues(issues), [issues]);
  const redCount = summary.red;
  const yellowCount = summary.yellow;
  const bulkFixCount = useMemo(() => issues.filter((i) => i.fixClass === "SAFE_AUTO_FIX" && i.suggestedReplacement).length, [issues]);
  const count = summary.total;
  const isOpen = open && enabled && count > 0;

  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen]);

  const contexts = useMemo(
    () => issues.map((issue) => ({ issue, ...issueContext(text, issue) })),
    [issues, text]
  );

  return (
    <div
      ref={rootRef}
      className={
        showBar || (enabled && undoAvailable)
          ? "relative flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink/10 px-4 py-1.5 text-xs text-ink/70"
          : "relative flex-none"
      }
    >
      {showBar && (
        <label className="flex cursor-pointer select-none items-center gap-1.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className="h-3.5 w-3.5 accent-[#dc2626]"
          />
          <span className="font-medium">文章チェック β</span>
        </label>
      )}

      {showBar && enabled && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={count === 0}
          aria-expanded={isOpen}
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
            count > 0 ? "bg-[#dc2626]/15 text-[#b91c1c] hover:bg-[#dc2626]/25" : "text-ink/40"
          }`}
        >
          {count > 0 ? (
            <>
              {redCount > 0 && <span>事故確認 {redCount}件</span>}
              {redCount > 0 && yellowCount > 0 && <span> ／ </span>}
              {yellowCount > 0 && <span className="text-[#92400e]">確認推奨 {yellowCount}件</span>}
            </>
          ) : (
            "確認候補なし"
          )}
        </button>
      )}

      {enabled && undoAvailable && (
        <button
          type="button"
          onClick={onUndo}
          className="rounded-full border border-ink/20 px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5"
        >
          元に戻す
        </button>
      )}

      {showBar && enabled && (
        <button
          type="button"
          onClick={onOpenSettings}
          title="文章チェック設定（プリセット・ルール・辞書・NGワード）"
          className="ml-auto rounded-full border border-ink/20 px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5"
        >
          ⚙ 設定
        </button>
      )}

      {showBar && enabled && (
        <span className="text-[10px] text-ink/40">
          波線は編集画面のみ。本文・プレビュー・書き出しには影響しません
        </span>
      )}

      {isOpen && (
        <div className="absolute bottom-full left-2 right-2 z-20 mb-1 max-h-80 overflow-y-auto rounded-lg border border-ink/15 bg-base p-1.5 shadow-lg">
          <div className="flex items-center justify-between gap-2 px-2 py-1">
            <p className="text-[10px] text-ink/50">
              波線は「間違い」ではなく確認の目安です。内容を確認してご自身で判断してください。
            </p>
            {bulkFixCount > 0 && (
              <button
                type="button"
                onClick={onBulkFix}
                className="shrink-0 whitespace-nowrap rounded-full bg-ink/10 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-ink/20"
              >
                安全な項目をまとめて直す（{bulkFixCount}件）
              </button>
            )}
          </div>
          <ul className="space-y-0.5">
            {contexts.map(({ issue, before, target, after }) => {
              const isRed = issue.severity === "HIGH_CONFIDENCE";
              return (
                <li key={issue.id} className="rounded px-2 py-1.5 hover:bg-ink/5">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectIssue(issue);
                      setOpen(false);
                    }}
                    className="block w-full text-left"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
                          isRed ? "bg-[#dc2626]/15 text-[#b91c1c]" : "bg-[#b45309]/15 text-[#92400e]"
                        }`}
                      >
                        {isRed ? "事故確認" : "確認推奨"}
                      </span>
                      <span className="block truncate font-mono text-sm text-ink/55">
                        {before}
                        <mark className={isRed ? "bg-[#dc2626]/15 text-[#b91c1c]" : "bg-[#b45309]/15 text-[#92400e]"}>
                          {target || "∅"}
                        </mark>
                        {after}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink/80">{issue.message}</span>
                  </button>
                  <div className="mt-1 flex gap-2">
                    {issue.suggestedReplacement && (
                      <button
                        type="button"
                        onClick={() => onFixIssue(issue)}
                        className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold text-ink hover:bg-ink/20"
                      >
                        直す
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onIgnoreIssue(issue)}
                      className="rounded-full border border-ink/15 px-2 py-0.5 text-[10px] text-ink/60 hover:bg-ink/5"
                    >
                      無視
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
