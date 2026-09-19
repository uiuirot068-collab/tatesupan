"use client";

import { useEffect, useRef, useState } from "react";
import { withBasePath } from "@/lib/basePath";
import {
  parseUpdateHistory,
  type UpdateHistoryEntry,
} from "@/lib/updateHistory";

const UPDATE_HISTORY_PATH = "/data/tatespun-update-history.json";

export function UpdateHistoryAccordion() {
  const [isOpen, setIsOpen] = useState(false);
  const [entries, setEntries] = useState<UpdateHistoryEntry[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen || entries !== null || loadError) return;

    const controller = new AbortController();

    void fetch(withBasePath(UPDATE_HISTORY_PATH), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`update history request failed: ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then((value) => {
        setEntries(parseUpdateHistory(value));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(true);
      });

    return () => controller.abort();
  }, [entries, isOpen, loadError]);

  const scrollBy = (direction: -1 | 1) => {
    scrollerRef.current?.scrollBy({
      top: direction * 180,
      behavior: "smooth",
    });
  };

  return (
    <section
      data-update-history=""
      className="border-t border-[rgba(31,42,68,0.14)] px-[18px] py-[22px] sm:px-[clamp(24px,6vw,72px)] dark:border-[#2A3240]"
      aria-labelledby="tatespun-update-history-title"
    >
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls="tatespun-update-history-panel"
          onClick={() => setIsOpen((current) => !current)}
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-sm font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent dark:text-[#D4DBE7]"
        >
          <span id="tatespun-update-history-title">
            {isOpen ? "▲" : "▼"} 更新・デバッグ・機能追加のお知らせ履歴
          </span>
          <span className="shrink-0 text-xs font-normal text-ink/45 dark:text-[#939DAF]">
            {isOpen ? "閉じる" : "見る"}
          </span>
        </button>

        {isOpen && (
          <div
            id="tatespun-update-history-panel"
            className="mt-3 rounded-[14px] border border-[rgba(31,42,68,0.14)] bg-white/55 px-3 py-3 shadow-[0_10px_28px_rgba(31,42,68,0.06)] dark:border-[#2A3240] dark:bg-[#171C26] dark:shadow-none"
          >
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              disabled={!entries?.length}
              aria-label="更新履歴を上へスクロール"
              className="mx-auto block min-h-8 min-w-10 rounded-md px-3 text-sm text-ink/55 hover:bg-ink/5 disabled:opacity-30 dark:text-[#939DAF] dark:hover:bg-[#1D2430]"
            >
              ▲
            </button>

            <div
              ref={scrollerRef}
              tabIndex={0}
              aria-label="TateSpun更新履歴"
              className="tsp-update-history-scroll max-h-[19rem] overflow-y-auto overscroll-contain rounded-[10px] border-y border-ink/10 dark:border-[#2A3240]"
            >
              {entries === null && !loadError && (
                <p className="px-4 py-8 text-center text-sm text-ink/50 dark:text-[#939DAF]">
                  読み込み中…
                </p>
              )}

              {loadError && (
                <p className="px-4 py-8 text-center text-sm text-ink/60 dark:text-[#AEB7C6]">
                  更新履歴を読み込めませんでした。時間をおいてもう一度ご確認ください。
                </p>
              )}

              {entries?.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-ink/50 dark:text-[#939DAF]">
                  まだお知らせはありません。
                </p>
              )}

              {entries?.map((entry, index) => (
                <article
                  key={`${entry.date}-${entry.title}-${index}`}
                  className="grid grid-cols-[5.2rem_minmax(0,1fr)] gap-x-3 gap-y-1 border-b border-ink/10 px-3 py-3 last:border-b-0 sm:grid-cols-[5.2rem_15rem_minmax(0,1fr)] sm:items-start sm:px-4 dark:border-[#2A3240]"
                >
                  <time className="text-xs tabular-nums text-ink/50 dark:text-[#939DAF]">
                    {entry.date}
                  </time>
                  <strong className="text-sm text-ink dark:text-[#D4DBE7]">
                    {entry.title}
                  </strong>
                  <p className="col-span-2 text-sm leading-relaxed text-ink/65 sm:col-span-1 dark:text-[#AEB7C6]">
                    {entry.detail}
                  </p>
                </article>
              ))}
            </div>

            <button
              type="button"
              onClick={() => scrollBy(1)}
              disabled={!entries?.length}
              aria-label="更新履歴を下へスクロール"
              className="mx-auto block min-h-8 min-w-10 rounded-md px-3 text-sm text-ink/55 hover:bg-ink/5 disabled:opacity-30 dark:text-[#939DAF] dark:hover:bg-[#1D2430]"
            >
              ▼
            </button>

            <p className="mt-1 text-center text-[11px] leading-relaxed text-ink/45 dark:text-[#939DAF]">
              マウスホイール・トラックパッド・タッチ操作・キーボードでも移動できます。
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
