"use client";

import { useEffect, useRef, useState } from "react";
import type { TrashRecord } from "@/lib/db";
import { countVisualLength } from "@/lib/tategaki";
import { TRASH_KEEP_DAYS, trashDaysLeft } from "@/lib/trash";

/**
 * TSP-SAFE-004: the bookshelf's ゴミ箱. A deleted work waits here for
 * TRASH_KEEP_DAYS days; 元に戻す puts it back on the bookshelf.
 */
export function TrashModal({
  items,
  now,
  onRestore,
  onPurge,
  onClose,
}: {
  items: TrashRecord[];
  now: number;
  onRestore: (id: number) => Promise<void>;
  onPurge: (id: number) => Promise<void>;
  onClose: () => void;
}) {
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // TSP-SAFE-004 QA: Esc closes it (Esc first closes an open 完全に削除
  // confirmation), and the keyboard starts inside it.
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (confirmingId !== null) setConfirmingId(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmingId, onClose]);

  const run = async (id: number, action: (id: number) => Promise<void>) => {
    setBusyId(id);
    try {
      await action(id);
    } finally {
      setBusyId(null);
      setConfirmingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="ゴミ箱"
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-baseline justify-between border-b border-ink/20 pb-2">
          <h2 className="text-base font-bold text-ink">ゴミ箱</h2>
          <button ref={closeRef} type="button" onClick={onClose} className="text-sm text-ink/60 hover:text-ink" aria-label="閉じる">
            閉じる
          </button>
        </div>
        <p className="mt-2 text-xs text-ink/60">削除した作品は{TRASH_KEEP_DAYS}日たつと自動で消えます。</p>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink/50">ゴミ箱は空です。</p>
        ) : (
          <ul className="mt-2 overflow-y-auto">
            {items.map((item) => {
              const title = item.document.title || "無題のドキュメント";
              const busy = busyId === item.id;
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-ink/10 py-2.5">
                  <span className="min-w-[12em] flex-1">
                    <span className="block truncate text-sm text-ink">{title}</span>
                    <span className="block text-xs text-ink/55">
                      あと{trashDaysLeft(item.trashedAt, now)}日で消えます・{countVisualLength(item.document.content).toLocaleString("ja-JP")}字
                    </span>
                  </span>
                  {confirmingId === item.id ? (
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                      <span className="text-xs text-red-700 dark:text-red-300">元に戻せなくなります</span>
                      <button type="button" disabled={busy} onClick={() => void run(item.id, onPurge)} className="font-semibold text-red-700 underline underline-offset-4 dark:text-red-300">
                        消す
                      </button>
                      <button type="button" onClick={() => setConfirmingId(null)} className="text-ink/60 underline underline-offset-4">
                        やめる
                      </button>
                    </span>
                  ) : (
                    <span className="flex items-center gap-3 text-sm">
                      <button type="button" disabled={busy} onClick={() => void run(item.id, onRestore)} className="text-ink underline underline-offset-4">
                        元に戻す
                      </button>
                      <button type="button" disabled={busy} onClick={() => setConfirmingId(item.id)} className="text-ink/60 underline underline-offset-4">
                        完全に削除
                      </button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
