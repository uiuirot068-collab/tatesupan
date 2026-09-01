"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { issueContext, type WritingIssue } from "@/lib/writingCheck";

interface WritingCheckBarProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  /** Issues paired with the exact text they were computed against (for the snippets). */
  text: string;
  issues: WritingIssue[];
  onSelectIssue: (issue: WritingIssue) => void;
}

/**
 * TSP-LOOP-004: the on/off control + 確認候補 count + reason list for
 * 「文章チェック β」. Lives in the editor footer area; the reason list is a
 * popover so it never changes the textarea's height. Selecting an item moves
 * the caret/selection to that range — it never edits the text.
 */
export default function WritingCheckBar({
  enabled,
  onToggle,
  text,
  issues,
  onSelectIssue,
}: WritingCheckBarProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const count = issues.length;
  // The popover is only ever rendered when `count > 0` (see the JSX guard), so
  // it collapses on its own when the last issue clears — no effect needed.
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
      className="relative flex flex-none flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink/10 px-4 py-1.5 text-xs text-ink/70"
    >
      <label className="flex cursor-pointer select-none items-center gap-1.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-3.5 w-3.5 accent-[#dc2626]"
        />
        <span className="font-medium">文章チェック β</span>
      </label>

      {enabled && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          disabled={count === 0}
          aria-expanded={isOpen}
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
            count > 0
              ? "bg-[#dc2626]/15 text-[#b91c1c] hover:bg-[#dc2626]/25"
              : "text-ink/40"
          }`}
        >
          {count > 0 ? `確認候補 ${count}件` : "確認候補なし"}
        </button>
      )}

      {enabled && (
        <span className="ml-auto text-[10px] text-ink/40">
          赤い波線は編集画面のみ。本文・プレビュー・書き出しには影響しません
        </span>
      )}

      {isOpen && (
        <div className="absolute bottom-full left-2 right-2 z-20 mb-1 max-h-60 overflow-y-auto rounded-lg border border-ink/15 bg-base p-1.5 shadow-lg">
          <p className="px-2 py-1 text-[10px] text-ink/50">
            赤い波線は「間違い」ではなく確認の目安です。内容を確認してご自身で判断してください。
          </p>
          <ul className="space-y-0.5">
            {contexts.map(({ issue, before, target, after }, index) => (
              <li key={index}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectIssue(issue);
                    setOpen(false);
                  }}
                  className="w-full rounded px-2 py-1.5 text-left hover:bg-ink/5"
                >
                  <span className="block truncate font-mono text-[11px] text-ink/55">
                    {before}
                    <mark className="bg-[#dc2626]/15 text-[#b91c1c]">
                      {target || "∅"}
                    </mark>
                    {after}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-ink/80">
                    {issue.message}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
