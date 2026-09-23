"use client";

import { useState } from "react";
import {
  DESCRIPTION_CATEGORIES,
  DESCRIPTION_CATEGORY_SUMMARIES,
  DESCRIPTION_CATEGORY_TITLES,
  DESCRIPTION_KEEP_NOTE,
  DESCRIPTION_NOT_A_JUDGEMENT_NOTE,
  describeDescriptionCategory,
  type DescriptionCategory,
  type DescriptionCategorySet,
} from "@/lib/descriptionCheck";
import type { DescriptionMark } from "@/lib/descriptionCheckManuscript";
import { formatCandidatePosition } from "@/lib/descriptionCandidateNav";

/**
 * TSP-B5 描写語・修飾表現チェックβ views: Review Hub section (full settings + explanation + full candidate
 * list), the pinned footer Review Dock card (daily operation + current candidate), the compact one-line
 * mobile pill and the caret detail card. Presentational only: state and the analysis arrive from EditorPane's
 * `useDescriptionCheck`.
 * Wording rule: a candidate is a "見直し候補 / 気づきの補助", never "削除すべき表現". Colour means CATEGORY only, and
 * the category is always also written out (A｜… / B｜… / C｜…).
 */

const PILL_BUTTON =
  "rounded-full border border-ink/20 px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40 disabled:hover:bg-transparent";

/** Same yellow family as the editor tints (A a little stronger, B standard, C paler). */
const CATEGORY_TINT: Record<DescriptionCategory, string> = {
  A: "bg-[rgba(250,204,21,0.58)]",
  B: "bg-[rgba(250,204,21,0.36)]",
  C: "bg-[rgba(250,204,21,0.2)]",
};

export const DESCRIPTION_CLICK_HINT = "色の付いた箇所をクリック（タップ）すると、候補になった理由を確認できます。";
export const DESCRIPTION_NONE_SELECTED_NOTE = "確認する種類が選ばれていません。A・B・Cのどれかにチェックを入れると、候補が表示されます。";

/** How many candidates the Hub list shows (the manuscript can hold thousands; the count is exact, the list is a sample to jump from). */
export const DESCRIPTION_LIST_LIMIT = 40;

/** `A｜直接的な説明` — text, so colour is never the only carrier of the category. */
export function describeCategoryTag(mark: Pick<DescriptionMark, "category">): string {
  return describeDescriptionCategory(mark.category);
}

export function formatDescriptionCount(enabled: boolean, current: boolean, count: number): string {
  if (!enabled) return "描写・修飾 OFF";
  return current ? `描写・修飾 ${count.toLocaleString("ja-JP")}件` : "描写・修飾 確認中";
}

export const noCategorySelected = (categories: DescriptionCategorySet) => !DESCRIPTION_CATEGORIES.some((category) => categories[category]);

export interface DescriptionCheckViewProps {
  enabled: boolean;
  categories: DescriptionCategorySet;
  onToggle: (next: boolean) => void;
  onToggleCategory: (category: DescriptionCategory) => void;
  /** Candidates of the categories that are switched on, sorted by position. */
  marks: readonly DescriptionMark[];
  /** False while the analysis lags the text (typing / first run). */
  current: boolean;
  /** The candidate under the caret, if any. */
  activeMark: DescriptionMark | null;
  onJump: (mark: DescriptionMark) => void;
}

function CategoryBadge({ category }: { category: DescriptionCategory }) {
  return (
    <span data-description-badge={category} className={`rounded px-1 ${CATEGORY_TINT[category]}`}>
      {describeDescriptionCategory(category)}
    </span>
  );
}

export function DescriptionMarkDetailBody({ mark }: { mark: DescriptionMark }) {
  return (
    <div data-description-detail="" className="space-y-0.5 text-[11px] leading-snug">
      <p className="font-semibold">
        <span data-description-detail-category="" className={`mr-1 rounded px-1 ${CATEGORY_TINT[mark.category]}`}>
          {describeCategoryTag(mark)}
        </span>
        <span data-description-detail-text="">「{mark.text}」</span>
      </p>
      <p data-description-detail-reason="">{mark.reason}</p>
      <p data-description-detail-keep="" className="text-ink/70">
        {DESCRIPTION_KEEP_NOTE}
      </p>
    </div>
  );
}

/** Full explanation of the three categories with an independent on/off for each. */
function CategoryToggles(props: Pick<DescriptionCheckViewProps, "categories" | "onToggleCategory">) {
  return (
    <fieldset data-description-categories="" className="space-y-1">
      <legend className="text-[11px] font-semibold text-ink/80">確認する表現</legend>
      {DESCRIPTION_CATEGORIES.map((category) => (
        <label key={category} className="flex cursor-pointer select-none items-start gap-1.5">
          <input
            type="checkbox"
            data-description-category-toggle={category}
            checked={props.categories[category]}
            onChange={() => props.onToggleCategory(category)}
            className="mt-0.5 h-3.5 w-3.5 accent-[#ca8a04]"
          />
          <span className="text-[11px] leading-snug">
            <span className={`mr-1 rounded px-1 font-semibold ${CATEGORY_TINT[category]}`}>{category}</span>
            <span className="font-medium">{DESCRIPTION_CATEGORY_TITLES[category]}</span>
            <span className="block text-ink/70">{DESCRIPTION_CATEGORY_SUMMARIES[category]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function DescriptionCheckReviewSection(props: DescriptionCheckViewProps) {
  const { enabled, categories, marks, current, activeMark } = props;
  const shown = marks.slice(0, DESCRIPTION_LIST_LIMIT);
  const none = noCategorySelected(categories);

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
          <CategoryToggles categories={categories} onToggleCategory={props.onToggleCategory} />
          <p data-description-not-judgement="" className="text-[11px] text-ink/70">
            {DESCRIPTION_NOT_A_JUDGEMENT_NOTE}
          </p>
          {none ? (
            <p data-description-none-selected="" role="status" className="text-[11px] text-ink/70">
              {DESCRIPTION_NONE_SELECTED_NOTE}
            </p>
          ) : (
            <>
              <p data-description-check-status="" role="status" className="text-[11px] font-semibold tabular-nums text-ink/70">
                {current ? `候補 ${marks.length.toLocaleString("ja-JP")}件` : "確認中…"}
              </p>
              <p data-description-hint="" className="text-[11px] text-ink/70">
                {DESCRIPTION_CLICK_HINT}
              </p>
            </>
          )}

          {activeMark ? (
            <div data-description-active="" className="rounded border border-yellow-400/60 bg-yellow-300/20 p-1.5">
              <DescriptionMarkDetailBody mark={activeMark} />
            </div>
          ) : null}

          {!none && current && marks.length === 0 ? (
            <p data-description-empty="" className="text-[11px] text-ink/70">
              選んだ種類では候補が見つかりませんでした。
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
                      <span className="ml-1">
                        <CategoryBadge category={mark.category} />
                      </span>
                      <span className="block text-ink/70">{mark.reason}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </>
      ) : (
        <p data-description-off-note="" className="text-[11px] text-ink/70">
          OFFのあいだは何も解析しません。使うと、形容・様子の説明になっている表現に色をつけてお知らせします（最初は「A」だけ）。
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- footer Review Dock card

export interface DescriptionDockCardProps extends DescriptionCheckViewProps {
  /** The candidate the card is about: the one under the caret, else the last one navigated to. */
  currentMark: DescriptionMark | null;
  onPrev: () => void;
  onNext: () => void;
}

/**
 * The pinned tool as a Review Dock card: everything needed day to day (ON/OFF, A/B/C, count, previous / next,
 * the current candidate and its reason) without opening 見直し. The full list and the long explanation stay in the Hub.
 */
export function DescriptionCheckDockCard(props: DescriptionDockCardProps) {
  const { enabled, categories, marks, current, currentMark } = props;
  const [reasonOpen, setReasonOpen] = useState(false);
  const none = noCategorySelected(categories);
  const navDisabled = !enabled || none || !current || marks.length === 0;

  return (
    <section
      data-review-dock-card="description-check"
      aria-label="描写・修飾チェックβ"
      className="@container min-w-0 w-full max-w-full flex-1 rounded-lg border border-ink/15 bg-base p-2.5 text-xs text-ink"
    >
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
        <h3 className="min-w-0 text-[12px] font-bold">描写・修飾チェックβ</h3>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          data-description-card-toggle=""
          onClick={() => props.onToggle(!enabled)}
          className={`${PILL_BUTTON} ${enabled ? "bg-yellow-300/50 font-semibold text-ink" : ""}`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>

      {!enabled ? (
        <p data-description-card-off="" className="mt-1 text-[11px] text-ink/70">
          いまはオフです。ONにすると、形容・様子の説明になっている表現に色をつけます。
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-1">
            <span className="text-[11px] text-ink/70">対象</span>
            {DESCRIPTION_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={categories[category]}
                aria-label={`${describeDescriptionCategory(category)}を表示`}
                title={DESCRIPTION_CATEGORY_SUMMARIES[category]}
                data-description-card-category={category}
                onClick={() => props.onToggleCategory(category)}
                className={`${PILL_BUTTON} ${categories[category] ? `${CATEGORY_TINT[category]} font-semibold text-ink` : ""}`}
              >
                {categories[category] ? "☑" : "☐"} {category}
              </button>
            ))}
            <span data-description-card-count="" className="ml-auto text-[11px] font-semibold tabular-nums text-ink/70 @max-[360px]:ml-0 @max-[360px]:basis-full @max-[360px]:w-full">
              {none ? "未選択" : current ? `候補 ${marks.length.toLocaleString("ja-JP")}件` : "確認中…"}
            </span>
          </div>

          {none ? (
            <p data-description-card-none="" className="text-[11px] text-ink/70">
              {DESCRIPTION_NONE_SELECTED_NOTE}
            </p>
          ) : (
            <>
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5">
                <button type="button" data-description-card-prev="" disabled={navDisabled} onClick={props.onPrev} className={PILL_BUTTON}>
                  <span className="@max-[360px]:hidden">← 前へ</span>
                  <span className="hidden @max-[360px]:inline">←前へ</span>
                </button>
                <span data-description-card-position="" className="min-w-0 text-center text-[11px] tabular-nums text-ink/70">
                  {formatCandidatePosition(marks, currentMark)}
                </span>
                <button type="button" data-description-card-next="" disabled={navDisabled} onClick={props.onNext} className={PILL_BUTTON}>
                  <span className="@max-[360px]:hidden">次へ →</span>
                  <span className="hidden @max-[360px]:inline">次へ→</span>
                </button>
              </div>

              {currentMark ? (
                <div data-description-card-current="" className="rounded border border-ink/10 bg-ink/[0.03] px-2.5 py-2">
                  <p className="text-[13px] font-semibold leading-relaxed">「{currentMark.text}」</p>
                  <p className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                    <CategoryBadge category={currentMark.category} />
                    <button
                      type="button"
                      data-description-card-reason-toggle=""
                      aria-expanded={reasonOpen}
                      onClick={() => setReasonOpen((open) => !open)}
                      className={PILL_BUTTON}
                    >
                      {reasonOpen ? "理由を閉じる" : "理由を見る"}
                    </button>
                  </p>
                  {reasonOpen ? (
                    <div data-description-card-reason="" className="mt-2 space-y-1 text-[12px] leading-relaxed">
                      <p>{currentMark.reason}</p>
                      <p className="text-ink/70">{DESCRIPTION_KEEP_NOTE}</p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p data-description-card-hint="" className="text-[11px] text-ink/70">
                  「次へ」で最初の候補へ移動します。{DESCRIPTION_CLICK_HINT}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Compact one-line representation for the mobile collapsed footer: `描写・修飾 18件`. A tap opens the Hub. */
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

/** The card shown while the caret is inside a candidate and the tool is NOT pinned (Hub closed): category + reason + "keeping it may be right". */
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
