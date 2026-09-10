"use client";

import { useState } from "react";
import {
  canConfirmMemoDraft,
  clearMemoDraft,
  readMemoDraft,
  writeMemoDraft,
} from "@/lib/memoDraft";

export default function InlineMemoAccordion({
  open,
  storageKey,
  confirmedMemo,
  onConfirm,
  onClose,
}: {
  open: boolean;
  storageKey: string;
  confirmedMemo: string;
  onConfirm: (memo: string) => void;
  onClose: () => void;
}) {
  const initialSavedDraft = () => typeof window === "undefined"
    ? null
    : readMemoDraft(window.localStorage, storageKey);
  const [draft, setDraft] = useState(() => initialSavedDraft() ?? confirmedMemo);
  const [editing, setEditing] = useState(() => initialSavedDraft() !== null);
  const [hasSavedDraft, setHasSavedDraft] = useState(() => initialSavedDraft() !== null);

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

  return (
    <section
      data-inline-memo=""
      aria-label="メモ"
      className="flex max-h-[min(34dvh,18rem)] flex-none flex-col overflow-hidden rounded-xl border border-ink/15 bg-base shadow-sm"
    >
      <header className="flex flex-none items-center justify-between gap-2 border-b border-ink/10 px-3 py-2">
        <div>
          <strong className="text-sm text-ink">メモ</strong>
          {hasSavedDraft && <span className="ml-2 text-[10px] text-accent">下書き保存済み</span>}
        </div>
        <div className="flex items-center gap-1">
          {!editing && (
            <button type="button" onClick={beginEdit} className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5">
              編集
            </button>
          )}
          {editing && (
            <button type="button" onClick={confirm} disabled={!confirmAllowed} className="rounded bg-accent px-3 py-1 text-xs font-semibold text-paper-ink disabled:cursor-not-allowed disabled:opacity-40">
              確定
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="メモを閉じる" className="rounded px-2 py-1 text-sm text-ink/55 hover:bg-ink/5">×</button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {editing ? (
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
