"use client";

import { useState } from "react";
import {
  canConfirmMemoDraft,
  clearMemoDraft,
  readMemoDraft,
  writeMemoDraft,
} from "@/lib/memoDraft";
import { readMemoPanelTab, writeMemoPanelTab, type MemoPanelTab } from "@/lib/plotPanel";
import PlotPanelView from "./PlotPanelView";

export default function InlineMemoAccordion({
  open,
  storageKey,
  confirmedMemo,
  onConfirm,
  onClose,
  plotStorageKey,
  currentHeading,
}: {
  open: boolean;
  storageKey: string;
  confirmedMemo: string;
  onConfirm: (memo: string) => void;
  onClose: () => void;
  /** PLT-LOOP-003: where this work's read-only plot is kept */
  plotStorageKey: string;
  /** the manuscript heading the cursor is under, for the plot to follow */
  currentHeading: string | null;
}) {
  const initialSavedDraft = () => typeof window === "undefined"
    ? null
    : readMemoDraft(window.localStorage, storageKey);
  const [draft, setDraft] = useState(() => initialSavedDraft() ?? confirmedMemo);
  const [editing, setEditing] = useState(() => initialSavedDraft() !== null);
  const [hasSavedDraft, setHasSavedDraft] = useState(() => initialSavedDraft() !== null);
  const [tab, setTab] = useState<MemoPanelTab>(() => typeof window === "undefined" ? "memo" : readMemoPanelTab(window.localStorage));

  if (!open) return null;

  const confirmAllowed = canConfirmMemoDraft(draft, confirmedMemo);
  const beginEdit = () => {
    const saved = readMemoDraft(window.localStorage, storageKey);
    setDraft(saved ?? confirmedMemo);
    setHasSavedDraft(saved !== null);
    setEditing(true);
  };
  const updateDraft = (value: string) => {
    setDraft(value);
    setHasSavedDraft(true);
    writeMemoDraft(window.localStorage, storageKey, value);
  };
  const confirm = () => {
    if (!confirmAllowed) return;
    onConfirm(draft);
    clearMemoDraft(window.localStorage, storageKey);
    setHasSavedDraft(false);
    setEditing(false);
  };

  const chooseTab = (next: MemoPanelTab) => {
    setTab(next);
    writeMemoPanelTab(window.localStorage, next);
  };
  const tabClass = (active: boolean) =>
    `border-b-2 px-1 pb-0.5 text-sm transition-colors ${active ? "border-accent font-semibold text-ink" : "border-transparent text-ink/50 hover:text-ink/80"}`;

  return (
    <section
      data-inline-memo=""
      data-memo-panel-tab={tab}
      aria-label="メモ・プロット"
      className="flex max-h-[min(34dvh,18rem)] flex-none flex-col overflow-hidden rounded-xl border border-ink/15 bg-base shadow-sm"
    >
      <header className="flex flex-none items-center justify-between gap-2 border-b border-ink/10 px-3 py-2">
        <div role="tablist" aria-label="メモ・プロット" className="flex items-center gap-3">
          <button type="button" role="tab" aria-selected={tab === "memo"} data-memo-tab="memo" onClick={() => chooseTab("memo")} className={tabClass(tab === "memo")}>
            メモ
          </button>
          <button type="button" role="tab" aria-selected={tab === "plot"} data-memo-tab="plot" onClick={() => chooseTab("plot")} className={tabClass(tab === "plot")}>
            プロット
          </button>
          {tab === "memo" && hasSavedDraft && <span className="text-[10px] text-accent">下書き保存済み</span>}
        </div>
        <div className="flex items-center gap-1">
          {tab === "memo" && !editing && (
            <button type="button" onClick={beginEdit} className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5">
              編集
            </button>
          )}
          {tab === "memo" && editing && (
            <button type="button" onClick={confirm} disabled={!confirmAllowed} className="rounded bg-accent px-3 py-1 text-xs font-semibold text-paper-ink disabled:cursor-not-allowed disabled:opacity-40">
              確定
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="メモを閉じる" title="メモ・プロットを閉じる" className="rounded px-2 py-1 text-sm text-ink/55 hover:bg-ink/5">×</button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {tab === "plot" ? (
          <PlotPanelView key={plotStorageKey} storageKey={plotStorageKey} currentHeading={currentHeading} />
        ) : editing ? (
          <>
            <textarea
              autoFocus
              value={draft}
              onChange={(event) => updateDraft(event.target.value)}
              className="h-32 min-h-24 w-full resize-none overflow-y-auto rounded border border-ink/20 bg-paper p-3 font-mono text-sm leading-relaxed text-ink outline-none focus:ring-2 focus:ring-accent/30"
              aria-label="メモの下書き"
            />
            {!confirmAllowed && <p role="alert" className="mt-1 text-xs text-red-700">空の下書きで確定済みメモを上書きすることはできません。</p>}
          </>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink/75">{confirmedMemo || "メモはまだありません。"}</p>
        )}
      </div>
    </section>
  );
}
