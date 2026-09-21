"use client";

import {
  DESCRIPTION_KEEP_NOTE,
  DESCRIPTION_MODES,
  DESCRIPTION_MODE_LABELS,
  DESCRIPTION_MODE_SUMMARIES,
  DESCRIPTION_NOT_A_JUDGEMENT_NOTE,
  type DescriptionMode,
} from "@/lib/descriptionCheck";
import type { DescriptionMark } from "@/lib/descriptionCheckManuscript";

/**
 * TSP-B5 描写語・修飾表現チェックβ views (Review Hub section, footer pill, detail card).
 * Presentational only: state and the analysis arrive from EditorPane's `useDescriptionCheck`.
 * Wording rule: a candidate is "見直し候補 / 気づきの補助", never "削除すべき表現".
 */

const PILL_BUTTON =
  "rounded-full border border-ink/20 px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** How many candidates the Hub list shows (the manuscript can hold thousands; the count is exact, the list is a sample to jump from). */
export const DESCRIPTION_LIST_LIMIT = 40;

export function describeCategoryTag(mark: Pick<DescriptionMark, "category" | "label">): string {
  return `${mark.category}｜${mark.label}`;
}

export function formatDescriptionCount(enabled: boolean, current: boolean, count: number): string {
  if (!enabled) return "描写・修飾 OFF";
  return current ? `描写・修飾 ${count.toLocaleString("ja-JP")}件` : "描写・修飾 確認中";
}

export interface DescriptionCheckViewProps {
  enabled: boolean;
  mode: DescriptionMode;
  onToggle: (next: boolean) => void;
  onModeChange: (mode: DescriptionMode) => void;
  /** Candidates for the current mode (already filtered), sorted by position. */
  marks: readonly DescriptionMark[];
  /** False while the analysis lags the text (typing / first run). */
  current: boolean;
  /** The candidate under the caret, if any. */
  activeMark: DescriptionMark | null;
  onJump: (mark: DescriptionMark) => void;
}

export function DescriptionMarkDetailBody({ mark }: { mark: DescriptionMark }) {
  return (
    <div data-description-detail="" className="space-y-0.5 text-[11px] leading-snug">
      <p className="font-semibold">
        <span data-description-detail-category="" className="mr-1 rounded bg-yellow-300/50 px-1">
          {describeCategoryTag(mark)}
        </span>
        <span data-description-detail-text="">「{mark.text}」</span>
      </p>
      <p data-description-detail-reason="">{mark.reason}</p>
      <p data-description-detail-keep="" className="text-ink/60">
        {DESCRIPTION_KEEP_NOTE}
      </p>
    </div>
  );
}

export function DescriptionCheckReviewSection(props: DescriptionCheckViewProps) {
  const { enabled, mode, marks, current, activeMark } = props;
  const shown = marks.slice(0, DESCRIPTION_LIST_LIMIT);

  return (
    <div data-review-hub-description-check="" className="mt-1.5 space-y-1.5">
      <label className="flex cursor-pointer select-none items-center gap-1.5">
        <input
          type="checkbox"
          data-description-check-toggle=""
          checked={enabled}
          onChange={(event) => props.onToggle(event.target.checked)}
          className="h-3.5 w-3.5 accent-[#ca8a04]"
        />
        <span className="font-medium">描写語・修飾表現チェックβを使う</span>
      </label>

      {enabled ? (
        <>
          <div role="radiogroup" aria-label="検出の広さ" className="flex flex-wrap items-center gap-1.5">
            {DESCRIPTION_MODES.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={option === mode}
                data-description-mode={option}
                onClick={() => props.onModeChange(option)}
                className={`${PILL_BUTTON} ${option === mode ? "bg-yellow-300/50 font-semibold text-ink" : ""}`}
              >
                {DESCRIPTION_MODE_LABELS[option]}
              </button>
            ))}
            <span data-description-check-status="" role="status" className="text-[11px] font-semibold tabular-nums text-ink/70">
              {current ? `候補 ${marks.length.toLocaleString("ja-JP")}件` : "確認中…"}
            </span>
          </div>
          <p data-description-mode-summary="" className="text-[11px] text-ink/70">
            {DESCRIPTION_MODE_SUMMARIES[mode]}
          </p>
          <p data-description-not-judgement="" className="text-[11px] text-ink/60">
            {DESCRIPTION_NOT_A_JUDGEMENT_NOTE}黄色の箇所は「見直し候補」です。残してよい表現もあります。
          </p>

          {activeMark ? (
            <div data-description-active="" className="rounded border border-yellow-400/60 bg-yellow-300/20 p-1.5">
              <DescriptionMarkDetailBody mark={activeMark} />
            </div>
          ) : null}

          {current && marks.length === 0 ? (
            <p data-description-empty="" className="text-[11px] text-ink/60">
              この広さでは候補が見つかりませんでした。
            </p>
          ) : null}

          {shown.length > 0 ? (
            <details data-description-list="" className="text-[11px]">
              <summary className="cursor-pointer select-none text-ink/70">
                候補の一覧（{marks.length > shown.length ? `先頭${shown.length}件 / 全${marks.length.toLocaleString("ja-JP")}件` : `${marks.length}件`}）
              </summary>
              <ul className="mt-1 divide-y divide-ink/10">
                {shown.map((mark) => (
                  <li key={`${mark.start}:${mark.end}:${mark.ruleId}`}>
                    <button
                      type="button"
                      data-description-item=""
                      onClick={() => props.onJump(mark)}
                      className="block w-full px-1 py-1 text-left hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <span className="font-semibold">「{mark.text}」</span>
                      <span className="ml-1 rounded bg-yellow-300/40 px-1">{describeCategoryTag(mark)}</span>
                      <span className="block text-ink/60">{mark.reason}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <p data-description-off-note="" className="text-[11px] text-ink/60">
          OFFのあいだは何も解析しません。使うと、形容・様子の説明になっている表現を黄色でお知らせします（最初は「A」だけ）。
        </p>
      )}
    </div>
  );
}

/** Compact footer representation (shown only while フッターに表示): `描写・修飾 18件`. A tap opens the Hub. */
export function DescriptionCheckFooterPill(props: { enabled: boolean; current: boolean; count: number; onOpen: () => void }) {
  const label = formatDescriptionCount(props.enabled, props.current, props.count);
  return (
    <button
      type="button"
      data-description-check-footer=""
      onClick={props.onOpen}
      title="描写語・修飾表現チェックβ（タップで見直しを開く）"
      className="shrink-0 whitespace-nowrap rounded-full border border-yellow-500/50 bg-yellow-300/30 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink/80 hover:bg-yellow-300/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {label}
    </button>
  );
}

/** The card shown while the caret is inside a candidate (Hub closed): category + reason + "keeping it may be right". */
export function DescriptionMarkDetailCard(props: { mark: DescriptionMark; onDismiss: () => void }) {
  return (
    <aside
      data-description-mark-detail=""
      role="status"
      className="absolute bottom-full left-2 right-2 z-10 mb-1 flex items-start gap-2 rounded-lg border border-yellow-400/70 bg-base p-2 text-xs text-ink shadow-lg md:left-auto md:w-[22rem] md:max-w-[calc(100%-1rem)]"
    >
      <div className="min-w-0 flex-1">
        <DescriptionMarkDetailBody mark={props.mark} />
      </div>
      <button
        type="button"
        data-description-detail-dismiss=""
        aria-label="候補の説明を閉じる"
        onClick={props.onDismiss}
        className="-mr-1 -mt-1 shrink-0 rounded px-1.5 py-0.5 text-ink/50 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ✕
      </button>
    </aside>
  );
}
