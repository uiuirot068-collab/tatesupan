"use client";

import { useReviewHubFooterPins } from "../hooks/useReviewHubFooterPins";
import type { ReviewHubFooterToolId } from "../lib/reviewHubFooterPins";

/**
 * B2: "フッターに表示" controls for the Review Hub. They sit on each tool's own
 * title row (and one note line under the list) rather than in a separate
 * settings block: a stacked block cost ~170px and pushed the panel past its
 * cap on a 320x568 phone. This is footer *display* only -- it never touches a
 * tool's ON/OFF state.
 */

const CONTROL_BUTTON =
  "rounded-full border border-ink/20 px-2 py-px text-[11px] text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40";

interface ReviewHubFooterPinControlProps {
  toolId: ReviewHubFooterToolId;
  /** The tool's title as shown in the Hub; used for accessible names only. */
  label: string;
}

export function ReviewHubFooterPinControl({ toolId, label }: ReviewHubFooterPinControlProps) {
  const { pins, isPinned, canPin, togglePin, movePin } = useReviewHubFooterPins();
  const pinned = isPinned(toolId);
  const index = pins.indexOf(toolId);
  // With two tools shown, a single arrow swaps them (top-to-bottom in the footer): the first can only go down, the second only up.
  const moveDirection = index === 0 ? 1 : -1;

  return (
    // -my-0.5: the pill is a little taller than the 16px title line; the negative margin keeps the title row at its B1 height.
    <span data-review-hub-footer-pin-control={toolId} className="-my-0.5 flex shrink-0 items-center gap-1">
      {pinned && pins.length > 1 ? (
        <button
          type="button"
          data-review-hub-footer-pin-move=""
          aria-label={`${label}をフッターの${moveDirection === 1 ? "下" : "上"}へ`}
          onClick={() => movePin(toolId, moveDirection)}
          className={CONTROL_BUTTON}
        >
          {moveDirection === 1 ? "↓" : "↑"}
        </button>
      ) : null}
      <button
        type="button"
        data-review-hub-footer-pin-toggle=""
        aria-pressed={pinned}
        aria-label={`${label}をフッターに表示`}
        title="最大2件・このブラウザに保存"
        disabled={!canPin(toolId)}
        onClick={() => togglePin(toolId)}
        className={`${CONTROL_BUTTON} ${pinned ? "bg-ink/10 font-semibold text-ink" : ""}`}
      >
        {pinned ? "✓ " : ""}フッターに表示
      </button>
    </span>
  );
}

/** One line in the panel's header row (beside 見直し / ✕), so it costs no vertical space. A span, not a lead paragraph. */
export function ReviewHubFooterPinNote() {
  return (
    <span
      data-review-hub-footer-pin-note=""
      title="フッター表示は機能のON/OFFとは別です。表示していないツールも「見直し」から使えます。"
      className="min-w-0 grow self-center truncate text-right text-[11px] text-ink/60"
    >
      フッター表示は機能ON/OFFとは別
    </span>
  );
}
