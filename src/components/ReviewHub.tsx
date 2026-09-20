"use client";

import type { ReactNode } from "react";
import {
  REVIEW_HUB_HEADING,
  REVIEW_HUB_HEADING_ID,
  REVIEW_HUB_PANEL_ID,
  REVIEW_HUB_TOOLS,
  REVIEW_HUB_TRIGGER_LABEL,
  formatReviewHubCharacterCount,
  type ReviewHubToolId,
} from "@/lib/reviewHub";
import { describeWritingIssueSummary, type WritingIssueSummary } from "@/lib/writingCheckSummary";

/**
 * TSP-B1 Review Hub view. Presentational only: every value and action arrives
 * from EditorPane's existing state (writing-check enabled flag + handlers,
 * the debounced `visualLength`). Nothing here analyses or counts text. It also
 * touches no `document`/`window` while rendering, so it renders in Node tests.
 */

const PILL_BUTTON =
  "rounded-full border border-ink/20 px-2 py-0.5 text-[11px] text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

interface ReviewHubTriggerProps {
  open: boolean;
  onToggle: () => void;
  /** One-line mobile footer: tighter padding, never allowed to shrink. */
  compact?: boolean;
  /** Desktop status row: shares a ~20px line with the syntax hint, so it takes only a hairline of vertical padding. */
  flush?: boolean;
}

/** The persistent footer control. A real button; the panel it controls opens upward. */
export function ReviewHubTrigger({ open, onToggle, compact = false, flush = false }: ReviewHubTriggerProps) {
  return (
    <button
      type="button"
      data-editor-review-hub-trigger=""
      aria-expanded={open}
      aria-controls={REVIEW_HUB_PANEL_ID}
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-ink/20 ${
        compact ? "gap-0 px-1" : "gap-1 px-2"
      } ${flush ? "py-px" : "py-0.5"} text-[11px] font-semibold text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
    >
      <span aria-hidden="true" className={`inline-block transition-transform ${open ? "-rotate-90" : ""}`}>
        ▶
      </span>{" "}
      {REVIEW_HUB_TRIGGER_LABEL}
    </button>
  );
}

interface ReviewHubPanelProps {
  open: boolean;
  onClose: () => void;
  sections: Record<ReviewHubToolId, ReactNode>;
  /** Measured cap (px) = space between the Editor pane's top and the footer; the CSS cap is the fallback before it is measured. */
  maxHeightPx?: number | null;
}

/**
 * Anchored to the footer stack's top edge (`bottom-full` of the relative
 * wrapper in EditorPane), so it grows UPWARD over the manuscript's lower edge
 * like the 文章チェックβ result popover — it never changes the textarea's
 * height. Always in the DOM (so `aria-controls` resolves) and `hidden` while
 * closed.
 */
export function ReviewHubPanel({ open, onClose, sections, maxHeightPx = null }: ReviewHubPanelProps) {
  return (
    <section
      id={REVIEW_HUB_PANEL_ID}
      data-review-hub-panel=""
      aria-labelledby={REVIEW_HUB_HEADING_ID}
      hidden={!open}
      style={maxHeightPx === null ? undefined : { maxHeight: maxHeightPx }}
      className="absolute bottom-full left-2 right-2 z-20 mb-1 max-h-[min(22rem,45vh)] overflow-y-auto rounded-lg border border-ink/15 bg-base p-3 text-xs text-ink shadow-lg md:left-auto md:w-[22rem] md:max-w-[calc(100%-1rem)]"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id={REVIEW_HUB_HEADING_ID} className="text-sm font-bold">
          {REVIEW_HUB_HEADING}
        </h2>
        <button
          type="button"
          data-review-hub-close=""
          aria-label="見直しを閉じる"
          onClick={onClose}
          className="-mr-1 -mt-1 rounded px-1.5 py-0.5 text-ink/50 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ✕
        </button>
      </div>
      <ul className="mt-1.5 divide-y divide-ink/10">
        {REVIEW_HUB_TOOLS.map((tool) => (
          <li key={tool.id} data-review-hub-tool={tool.id} className="py-2 first:pt-0 last:pb-0">
            <p className="text-xs font-semibold">{tool.title}</p>
            <p className="text-[11px] text-ink/60">{tool.summary}</p>
            {sections[tool.id]}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface WritingCheckReviewSectionProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  summary: WritingIssueSummary;
  onShowResults: () => void;
  onOpenSettings: () => void;
}

/** Reuses the existing 文章チェックβ state/handlers; adds no analysis of its own. */
export function WritingCheckReviewSection({
  enabled,
  onToggle,
  summary,
  onShowResults,
  onOpenSettings,
}: WritingCheckReviewSectionProps) {
  return (
    <div className="mt-1.5 space-y-1.5">
      <label className="flex cursor-pointer select-none items-center gap-1.5">
        <input
          type="checkbox"
          data-review-hub-writing-check-toggle=""
          checked={enabled}
          onChange={(event) => onToggle(event.target.checked)}
          className="h-3.5 w-3.5 accent-[#dc2626]"
        />
        <span className="font-medium">文章チェックβを使う</span>
      </label>
      {enabled && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span data-review-hub-writing-check-status="" className="text-[11px] font-semibold text-ink/70">
            {describeWritingIssueSummary(summary)}
          </span>
          {summary.total > 0 && (
            <button type="button" data-review-hub-writing-check-results="" onClick={onShowResults} className={PILL_BUTTON}>
              確認候補を見る
            </button>
          )}
          <button type="button" data-review-hub-writing-check-settings="" onClick={onOpenSettings} className={PILL_BUTTON}>
            ⚙ 設定
          </button>
        </div>
      )}
    </div>
  );
}

interface CharacterCountReviewSectionProps {
  /** The Editor's canonical `visualLength` — the very value the footer pill shows. */
  count: number;
}

export function CharacterCountReviewSection({ count }: CharacterCountReviewSectionProps) {
  return (
    <p data-review-hub-character-count="" className="mt-1.5 tabular-nums">
      <span className="text-ink/60">現在の原稿文字数 </span>
      <strong className="text-sm font-bold">{formatReviewHubCharacterCount(count)}</strong>
    </p>
  );
}
