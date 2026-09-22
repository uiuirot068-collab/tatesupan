"use client";

import { formatReadAloudRate, type ReadAloudMode } from "@/lib/readAloud";
import { READ_ALOUD_NO_SELECTION_NOTICE, describeHeldSelection } from "@/lib/readAloudHeldSelection";
import { READ_ALOUD_TARGET_TITLES, describeReadAloudAvailability, type ReadAloudViewProps } from "./ReadAloudControls";

const MODES: readonly ReadAloudMode[] = ["selection", "paragraph", "full"];

const PILL_BUTTON =
  "rounded-full border border-ink/20 px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent";

const TARGET_HINTS: Record<ReadAloudMode, string> = {
  selection: "本文で選んだ範囲を読みます。",
  paragraph: "カーソルのある段落を読みます。",
  full: "原稿の最初から最後まで読みます。",
};

/**
 * TSP-B4 (Revision 2): the pinned tool as a Review Dock card.
 *
 * - The reading target (選択範囲 / 現在の段落 / 全文) is chosen HERE, so the writer never has to open 見直し just to switch.
 * - The stored 選択範囲 is spelled out: the browser stops painting a textarea's selection once focus leaves it, so the
 *   card says 「選択範囲を保持中」 — and only while a valid selection is really held (never a phantom).
 * - Play / pause / resume / stop / progress sit on their own row; speed stays adjustable in 見直し (shown here read-only).
 */
export function ReadAloudDockCard(props: ReadAloudViewProps) {
  const { state, target, held } = props;
  const unavailable = describeReadAloudAvailability(state);
  const active = state.status !== "idle";
  const playDisabled = unavailable !== null || (target === "selection" && !held);
  // ONE information line: the most relevant thing to know right now.
  const info =
    unavailable !== null
      ? { key: "unavailable", text: unavailable }
      : state.failure === "speech-error"
        ? { key: "error", text: "読み上げが途中で止まりました。もう一度お試しください。" }
        : state.emptyNotice && !active
          ? { key: "notice", text: state.emptyNotice }
          : target === "selection"
            ? held
              ? { key: "held", text: describeHeldSelection(held) }
              : { key: "need-selection", text: READ_ALOUD_NO_SELECTION_NOTICE }
            : { key: "hint", text: TARGET_HINTS[target] };

  return (
    <section data-review-dock-card="read-aloud" aria-label="音読β" className="min-w-[15rem] flex-1 rounded-lg border border-ink/15 bg-base p-1.5 text-xs text-ink">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[12px] font-bold">音読β</h3>
        <span data-read-aloud-card-status="" role="status" className="text-[11px] tabular-nums text-ink/60">
          {state.status === "speaking"
            ? `読み上げ中 ${state.chunkIndex + 1} / ${state.chunkCount}`
            : state.status === "paused"
              ? `一時停止中 ${state.chunkIndex + 1} / ${state.chunkCount}`
              : `待機中・速度 ${formatReadAloudRate(state.rate)}`}
        </span>
      </div>

      <div role="radiogroup" aria-label="音読範囲" className="mt-1 flex flex-wrap items-center gap-1">
        <span className="text-[11px] text-ink/70">音読範囲</span>
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={target === mode}
            data-read-aloud-target={mode}
            onClick={() => props.onTargetChange(mode)}
            className={`${PILL_BUTTON} ${target === mode ? "border-ink/50 bg-ink/10 font-semibold text-ink" : ""}`}
          >
            {READ_ALOUD_TARGET_TITLES[mode]}
          </button>
        ))}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {active ? (
          <span className="flex items-center gap-1">
            {state.status === "speaking" ? (
              <button type="button" data-read-aloud-card-pause="" onClick={props.onPause} className={PILL_BUTTON}>
                ⏸ 一時停止
              </button>
            ) : (
              <button type="button" data-read-aloud-card-resume="" onClick={props.onResume} className={PILL_BUTTON}>
                ▶ 再開
              </button>
            )}
            <button type="button" data-read-aloud-card-stop="" onClick={props.onStop} className={PILL_BUTTON}>
              ■ 停止
            </button>
          </span>
        ) : (
          <button type="button" data-read-aloud-card-play="" disabled={playDisabled} onClick={props.onStartTarget} className={PILL_BUTTON}>
            ▶ {READ_ALOUD_TARGET_TITLES[target]}を読む
          </button>
        )}
        <span
          data-read-aloud-card-info={info.key}
          {...(info.key === "held" ? { "data-read-aloud-card-held": "" } : {})}
          {...(info.key === "need-selection" ? { "data-read-aloud-card-need-selection": "" } : {})}
          {...(info.key === "unavailable" ? { "data-read-aloud-card-unavailable": "" } : {})}
          {...(info.key === "notice" ? { "data-read-aloud-card-notice": "" } : {})}
          {...(info.key === "error" ? { "data-read-aloud-card-error": "" } : {})}
          role={info.key === "hint" || info.key === "held" ? undefined : "status"}
          className={`min-w-0 flex-1 text-[11px] ${info.key === "held" ? "font-semibold text-ink/80" : "text-ink/70"}`}
        >
          {info.text}
        </span>
      </div>
    </section>
  );
}
