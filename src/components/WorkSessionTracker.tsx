"use client";

import { useCallback, useEffect, useState, type HTMLAttributes } from "react";
import {
  activeWorkDurationMs,
  formatWorkSessionShareText,
  type CompletedWorkSession,
  type WorkSessionState,
} from "@/lib/editorSessionActivity";
import ViewportModal from "./ViewportModal";

function formatElapsed(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDuration(durationMs: number): string {
  const totalMinutes = Math.floor(Math.max(0, durationMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}時間${minutes}分` : `${minutes}分`;
}

function formatClock(timestamp: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function formatHistoryDate(timestamp: number): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function openXShare(record: CompletedWorkSession): void {
  const text = formatWorkSessionShareText(record.writtenCharacterCount);
  window.open(
    `https://x.com/intent/post?text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function WorkSessionPauseModal({
  onClose,
  onResume,
  onEnd,
}: {
  onClose: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  return (
    <ViewportModal
      title="一時停止中"
      titleId="work-session-pause-title"
      closeLabel="一時停止の窓を閉じる"
      onClose={onClose}
      overlayProps={{ "data-work-session-pause-modal": "" } as HTMLAttributes<HTMLDivElement>}
      dialogProps={{ "data-work-session-pause": "" } as HTMLAttributes<HTMLDivElement>}
      closeButtonProps={{ "data-work-session-pause-action": "close-icon" } as HTMLAttributes<HTMLButtonElement>}
      footer={(
        <>
          <button
            type="button"
            data-work-session-pause-action="close"
            onClick={onClose}
            className="rounded px-2 py-1 text-[11px] text-ink/55 hover:bg-ink/5"
          >
            一時停止の窓を閉じる
          </button>
          <button
            type="button"
            data-work-session-pause-action="resume"
            onClick={onResume}
            className="rounded border border-ink/20 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-ink/5"
          >
            作業を再開する
          </button>
          <button
            type="button"
            data-work-session-pause-action="end"
            onClick={onEnd}
            className="rounded bg-ink px-2 py-1 text-[11px] font-semibold text-base hover:opacity-90"
          >
            今日の作業を終了する
          </button>
        </>
      )}
    >
      <p className="text-xs text-ink/65">作業時間のカウントを停止しています。</p>
    </ViewportModal>
  );
}

function WorkSessionResultModal({
  result,
  copied,
  onClose,
  onCopy,
  onShare,
}: {
  result: CompletedWorkSession;
  copied: boolean;
  onClose: () => void;
  onCopy: () => void;
  onShare: () => void;
}) {
  return (
    <ViewportModal
      title="作業おつかれさまでした"
      titleId="work-session-result-title"
      closeLabel="作業結果を閉じる"
      onClose={onClose}
      overlayProps={{ "data-work-session-result-modal": "" } as HTMLAttributes<HTMLDivElement>}
      dialogProps={{ "data-work-session-result": "" } as HTMLAttributes<HTMLDivElement>}
      closeButtonProps={{ "data-work-session-result-action": "close-icon" } as HTMLAttributes<HTMLButtonElement>}
      footer={(
        <>
          <button
            type="button"
            data-work-session-result-action="close"
            onClick={onClose}
            className="rounded px-2 py-1 text-[11px] text-ink/55 hover:bg-ink/5"
          >
            閉じる
          </button>
          <button
            type="button"
            data-work-session-result-action="copy"
            onClick={onCopy}
            className="rounded border border-ink/20 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-ink/5"
          >
            {copied ? "コピーしました" : "テキストをコピー"}
          </button>
          <button
            type="button"
            data-work-session-result-action="share-x"
            onClick={onShare}
            className="rounded bg-ink px-2 py-1 text-[11px] font-semibold text-base hover:opacity-90"
          >
            Xでシェア
          </button>
        </>
      )}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-ink/55">今回書いた文字数</dt>
        <dd className="text-right text-lg font-bold tabular-nums text-ink" data-work-session-result-written-count>
          {result.writtenCharacterCount.toLocaleString("ja-JP")}文字
        </dd>
        <dt className="text-ink/55">実作業時間</dt>
        <dd className="text-right font-semibold text-ink">{formatDuration(result.durationMs)}</dd>
        <dt className="text-ink/55">開始時刻</dt>
        <dd className="text-right tabular-nums text-ink">{formatClock(result.startedAt)}</dd>
        <dt className="text-ink/55">終了時刻</dt>
        <dd className="text-right tabular-nums text-ink">{formatClock(result.endedAt)}</dd>
      </dl>
      <p className="mt-2 text-[10px] text-ink/45">現在の原稿文字数とは別の値です。</p>
    </ViewportModal>
  );
}

function WorkSessionHistoryModal({
  history,
  onClose,
  onShare,
}: {
  history: readonly CompletedWorkSession[];
  onClose: () => void;
  onShare: (record: CompletedWorkSession) => void;
}) {
  return (
    <ViewportModal
      title="作業記録"
      titleId="work-session-history-title"
      closeLabel="作業記録を閉じる"
      onClose={onClose}
      panelClassName="max-w-lg"
      overlayProps={{ "data-work-session-history-modal": "" } as HTMLAttributes<HTMLDivElement>}
      dialogProps={{ "data-work-session-history": "" } as HTMLAttributes<HTMLDivElement>}
      closeButtonProps={{ "data-work-session-history-action": "close-icon" } as HTMLAttributes<HTMLButtonElement>}
      footer={(
        <button
          type="button"
          data-work-session-history-action="close"
          onClick={onClose}
          className="rounded bg-ink px-4 py-1.5 text-xs font-semibold text-base hover:opacity-90"
        >
          閉じる
        </button>
      )}
    >
      {history.length === 0 ? (
        <p className="text-xs text-ink/50">完了した作業はまだありません。</p>
      ) : (
        <ul data-work-session-history-list="" className="divide-y divide-ink/10">
          {[...history].reverse().map((record) => (
            <li
              key={record.id}
              data-work-session-history-record={record.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0 text-xs">
                <p className="tabular-nums text-ink">
                  {formatHistoryDate(record.startedAt)}〜{formatClock(record.endedAt)}
                </p>
                <p className="mt-0.5 tabular-nums text-ink/60">
                  {formatDuration(record.durationMs)} / {record.writtenCharacterCount.toLocaleString("ja-JP")}文字
                </p>
              </div>
              <button
                type="button"
                data-work-session-history-action="share-x"
                onClick={() => onShare(record)}
                className="shrink-0 rounded border border-ink/20 px-2 py-1 text-[11px] font-semibold text-ink hover:bg-ink/5"
              >
                Xでシェア
              </button>
            </li>
          ))}
        </ul>
      )}
    </ViewportModal>
  );
}

export default function WorkSessionTracker({
  state,
  onStart,
  onPause,
  onResume,
  onEnd,
  compact = false,
}: {
  state: WorkSessionState;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => CompletedWorkSession | null;
  /** TSP-RC-LATIN-AND-MOBILE-COMPACT-001: collapsed mobile footer bar. Hides
   *  the status badge, written-count, elapsed-time, and 作業記録 button --
   *  everything else (state, start/pause/resume/end handlers, modals) is
   *  identical to the full view; no new work-session logic is introduced. */
  compact?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [panel, setPanel] = useState<"pause" | "result" | "history" | null>(null);
  const [result, setResult] = useState<CompletedWorkSession | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const activeId = state.active?.id;
  const activeStatus = state.active?.status;

  const closePanel = useCallback(() => setPanel(null), []);

  useEffect(() => {
    if (!activeId || activeStatus !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeId, activeStatus]);

  const start = () => {
    setNow(Date.now());
    setResult(null);
    setPanel(null);
    onStart();
  };

  const end = () => {
    const completed = onEnd();
    if (!completed) return;
    setResult(completed);
    setPanel("result");
  };

  const pause = () => {
    setNow(Date.now());
    onPause();
    setPanel("pause");
  };

  const resume = () => {
    setNow(Date.now());
    onResume();
    setPanel(null);
  };

  const copyShareText = async (record: CompletedWorkSession) => {
    try {
      await navigator.clipboard.writeText(formatWorkSessionShareText(record.writtenCharacterCount));
      setCopiedId(record.id);
      window.setTimeout(() => setCopiedId((current) => current === record.id ? null : current), 1800);
    } catch {
      // Clipboard permission can be denied. X share remains available separately.
    }
  };

  return (
    <div
      className="relative flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1"
      data-work-session-tracker
      data-work-session-status={state.active?.status ?? "idle"}
      data-work-session-compact={compact ? "" : undefined}
      data-demo-target="work-session"
    >
      {state.active ? (
        <>
          {!compact && (
            <>
              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${state.active.status === "paused" ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                {state.active.status === "paused" ? "一時停止中" : "作業中"}
              </span>
              <span
                className="whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink"
                data-work-session-written-count={state.active.writtenCharacterCount}
              >
                今回書いた文字数 {state.active.writtenCharacterCount.toLocaleString("ja-JP")}文字
              </span>
              <span className="whitespace-nowrap text-[11px] tabular-nums text-ink/60" data-work-session-elapsed>
                経過時間 {formatElapsed(activeWorkDurationMs(
                  state.active,
                  state.active.status === "paused" ? state.active.pausedAt ?? now : now
                ))}
              </span>
            </>
          )}
          <span className="flex shrink-0 items-center gap-1">
            {state.active.status === "paused" ? (
              <button
                type="button"
                data-work-session-action="resume"
                onClick={resume}
                className="whitespace-nowrap rounded-full bg-ink px-2 py-0.5 text-[11px] font-semibold text-base hover:opacity-90"
              >
                {compact ? "再開" : "作業を再開"}
              </button>
            ) : (
              <button
                type="button"
                data-work-session-action="pause"
                onClick={pause}
                className="whitespace-nowrap rounded-full border border-ink/25 px-2 py-0.5 text-[11px] font-semibold text-ink hover:bg-ink/5"
              >
                一時停止
              </button>
            )}
            <button
              type="button"
              data-work-session-action="end"
              onClick={end}
              className="whitespace-nowrap rounded-full border border-ink/25 px-2 py-0.5 text-[11px] font-semibold text-ink hover:bg-ink/5"
            >
              {compact ? "終了" : "作業終了"}
            </button>
          </span>
        </>
      ) : (
        <button
          type="button"
          data-work-session-action="start"
          onClick={start}
          className="whitespace-nowrap rounded-full bg-ink px-3 py-0.5 text-[11px] font-semibold text-base hover:opacity-90"
        >
          {compact ? "作業開始" : "作業スタート"}
        </button>
      )}

      {!compact && (
        <button
          type="button"
          data-work-session-action="history"
          aria-expanded={panel === "history"}
          onClick={() => setPanel((current) => current === "history" ? null : "history")}
          className="whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] text-ink/60 hover:bg-ink/5"
        >
          作業記録{state.history.length > 0 ? ` ${state.history.length}` : ""}
        </button>
      )}

      {panel === "pause" && (
        <WorkSessionPauseModal
          onClose={closePanel}
          onResume={resume}
          onEnd={end}
        />
      )}

      {panel === "result" && result && (
        <WorkSessionResultModal
          result={result}
          copied={copiedId === result.id}
          onClose={closePanel}
          onCopy={() => copyShareText(result)}
          onShare={() => openXShare(result)}
        />
      )}

      {panel === "history" && (
        <WorkSessionHistoryModal
          history={state.history}
          onClose={closePanel}
          onShare={openXShare}
        />
      )}
    </div>
  );
}
