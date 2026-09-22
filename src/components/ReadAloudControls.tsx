"use client";

import {
  READ_ALOUD_MODE_LABELS,
  READ_ALOUD_RATE_MAX,
  READ_ALOUD_RATE_MIN,
  READ_ALOUD_RATE_STEP,
  formatReadAloudRate,
  type ReadAloudMode,
} from "@/lib/readAloud";
import type { ReadAloudState } from "@/lib/readAloudEngine";
import { describeHeldSelection, type HeldSelection } from "@/lib/readAloudHeldSelection";

/**
 * TSP-B4 音読β views (Review Hub section + compact footer representation).
 * Presentational: state and actions come from EditorPane's single
 * `useReadAloud` instance. Nothing here reads the manuscript or the browser.
 */

const PILL_BUTTON =
  "rounded-full border border-ink/20 px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent";

export interface ReadAloudViewProps {
  state: ReadAloudState;
  /** What the footer ▶ reads. */
  target: ReadAloudMode;
  onTargetChange: (mode: ReadAloudMode) => void;
  /** The stored, still-valid 選択範囲 (null = none). The UI only ever says 「保持中」 while this is non-null. */
  held: HeldSelection | null;
  onStart: (mode: ReadAloudMode) => void;
  onStartTarget: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onRateChange: (rate: number) => void;
  onVoiceChange: (voiceURI: string | null) => void;
}

const MODES: readonly ReadAloudMode[] = ["selection", "paragraph", "full"];
const AUTO_VOICE_VALUE = "";

/** Short names for the three reading targets (footer / dock labels; the long ones live in `READ_ALOUD_MODE_LABELS`). */
export const READ_ALOUD_TARGET_TITLES: Record<ReadAloudMode, string> = {
  selection: "選択範囲",
  paragraph: "現在の段落",
  full: "全文",
};

/** One human sentence for the most relevant non-playing situation, or null when reading is available. */
export function describeReadAloudAvailability(state: ReadAloudState): string | null {
  if (state.support === "unsupported") {
    return "このブラウザでは音読機能を使えません。Chrome・Edge・Safari など、音声読み上げに対応したブラウザでお試しください。";
  }
  if (state.support === "checking" || !state.voicesReady) return "この端末の音声を確認しています…";
  if (!state.selectedVoiceURI) {
    return "この端末に日本語の音声が見つかりません。端末の設定で日本語の音声を追加すると使えます。";
  }
  return null;
}

export function ReadAloudReviewSection(props: ReadAloudViewProps) {
  const { state } = props;
  const unavailable = describeReadAloudAvailability(state);
  const active = state.status !== "idle";
  const canRead = unavailable === null;
  const hasOnlineChoice = state.onlineVoices.length > 0;
  const showVoiceSelect = state.support === "supported" && state.voicesReady && state.localVoices.length + state.onlineVoices.length > 0 && (state.localVoices.length > 1 || hasOnlineChoice);

  return (
    <div data-review-hub-read-aloud="" className="mt-1.5 space-y-1.5">
      {unavailable !== null ? (
        <p data-read-aloud-unavailable="" role="status" className="text-[11px] text-ink/70">
          {unavailable}
        </p>
      ) : null}

      {state.selectedIsOnline ? (
        <p data-read-aloud-online-warning="" role="status" className="text-[11px] font-semibold text-ink/80">
          選んだ音声はオンライン音声です。読み上げる本文がブラウザの音声サービスへ送られる場合があります。
        </p>
      ) : (
        <p data-read-aloud-privacy="" className="text-[11px] text-ink/60">
          この端末の音声で読みます。原稿を外部へ送りません。
        </p>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            data-read-aloud-start={mode}
            disabled={!canRead}
            onClick={() => props.onStart(mode)}
            className={PILL_BUTTON}
          >
            {READ_ALOUD_MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {props.held ? (
        <p data-read-aloud-held="" className="text-[11px] font-semibold text-ink/80">
          {describeHeldSelection(props.held)}
        </p>
      ) : null}

      {active ? (
        <div data-read-aloud-playback="" className="flex flex-wrap items-center gap-1.5">
          {state.status === "speaking" ? (
            <button type="button" data-read-aloud-pause="" onClick={props.onPause} className={PILL_BUTTON}>
              ⏸ 一時停止
            </button>
          ) : (
            <button type="button" data-read-aloud-resume="" onClick={props.onResume} className={PILL_BUTTON}>
              ▶ 再開
            </button>
          )}
          <button type="button" data-read-aloud-stop="" onClick={props.onStop} className={PILL_BUTTON}>
            ■ 停止
          </button>
          <span data-read-aloud-progress="" className="text-[11px] tabular-nums text-ink/60">
            {state.status === "paused" ? "一時停止中 " : ""}
            {state.chunkIndex + 1} / {state.chunkCount} 文
          </span>
        </div>
      ) : null}

      {state.emptyNotice && !active ? (
        <p data-read-aloud-notice="" role="status" className="text-[11px] text-ink/70">
          {state.emptyNotice}
        </p>
      ) : null}
      {state.failure === "speech-error" ? (
        <p data-read-aloud-error="" role="status" className="text-[11px] text-ink/70">
          読み上げが途中で止まりました。もう一度お試しください。
        </p>
      ) : null}

      <label className="flex items-center gap-1.5 text-[11px] text-ink/70">
        <span className="shrink-0">速度</span>
        <input
          type="range"
          data-read-aloud-rate=""
          aria-label="読み上げ速度"
          min={READ_ALOUD_RATE_MIN}
          max={READ_ALOUD_RATE_MAX}
          step={READ_ALOUD_RATE_STEP}
          value={state.rate}
          disabled={state.support !== "supported"}
          onChange={(event) => props.onRateChange(Number(event.target.value))}
          className="min-w-0 flex-1 accent-[#dc2626]"
        />
        <span data-read-aloud-rate-label="" className="w-8 shrink-0 text-right font-semibold tabular-nums">
          {formatReadAloudRate(state.rate)}
        </span>
      </label>

      {showVoiceSelect ? (
        <label className="flex items-center gap-1.5 text-[11px] text-ink/70">
          <span className="shrink-0">音声</span>
          <select
            data-read-aloud-voice=""
            aria-label="読み上げに使う音声"
            value={state.preferredVoiceURI ?? AUTO_VOICE_VALUE}
            onChange={(event) => props.onVoiceChange(event.target.value === AUTO_VOICE_VALUE ? null : event.target.value)}
            className="min-w-0 flex-1 rounded border border-ink/20 bg-base px-1 py-0.5 text-[11px] text-ink"
          >
            <option value={AUTO_VOICE_VALUE}>おまかせ（この端末の日本語音声）</option>
            {state.localVoices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name}
              </option>
            ))}
            {hasOnlineChoice ? (
              <optgroup label="オンライン音声（本文が送信される場合があります）">
                {state.onlineVoices.map((voice) => (
                  <option key={voice.voiceURI} value={voice.voiceURI}>
                    {voice.name}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
      ) : null}
    </div>
  );
}

/**
 * The compact footer representation (shown only while 音読β is フッターに表示):
 * one tap reads the selection (or the paragraph at the caret); while reading it
 * becomes pause/resume + stop with the sentence counter.
 */
export function ReadAloudFooterControl(props: ReadAloudViewProps) {
  const { state } = props;
  const unavailable = describeReadAloudAvailability(state);
  const active = state.status !== "idle";
  const button =
    "shrink-0 whitespace-nowrap rounded-full border border-ink/20 px-2 py-0.5 text-[11px] font-semibold text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <span data-read-aloud-footer="" className="flex shrink-0 items-center gap-1">
      {active ? (
        <>
          {state.status === "speaking" ? (
            <button type="button" data-read-aloud-footer-pause="" aria-label="音読を一時停止" onClick={props.onPause} className={button}>
              ⏸
            </button>
          ) : (
            <button type="button" data-read-aloud-footer-resume="" aria-label="音読を再開" onClick={props.onResume} className={button}>
              ▶
            </button>
          )}
          <button type="button" data-read-aloud-footer-stop="" aria-label="音読を停止" onClick={props.onStop} className={button}>
            ■
          </button>
          <span data-read-aloud-footer-progress="" className="text-[11px] tabular-nums text-ink/60">
            {state.chunkIndex + 1}/{state.chunkCount}
          </span>
        </>
      ) : (
        <button
          type="button"
          data-read-aloud-footer-start=""
          disabled={unavailable !== null || (props.target === "selection" && !props.held)}
          title={unavailable ?? `${READ_ALOUD_TARGET_TITLES[props.target]}を読みます`}
          aria-label={`音読（${READ_ALOUD_TARGET_TITLES[props.target]}）`}
          onClick={props.onStartTarget}
          className={button}
        >
          ▶ 音読
        </button>
      )}
    </span>
  );
}
