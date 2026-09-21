"use client";

import type { ReactNode } from "react";
import { useReviewHubFooterPins } from "../hooks/useReviewHubFooterPins";

interface ReviewHubFooterPinnedToolsProps {
  /**
   * The Editor's existing 現在の原稿文字数 pill (canonical `visualLength`), passed
   * in unchanged so the footer keeps its B1 wording/title and this component
   * never counts anything itself.
   */
  characterCount: ReactNode;
}

export function ReviewHubFooterPinnedTools({ characterCount }: ReviewHubFooterPinnedToolsProps) {
  const { pins } = useReviewHubFooterPins();

  if (pins.length === 0) return null;

  return (
    <div
      data-review-hub-footer-pinned-tools
      className="flex min-w-0 items-center gap-1"
      aria-label="見直し フッター表示"
    >
      {pins.map((toolId) =>
        toolId === "character-count" ? (
          <span key={toolId} data-review-hub-footer-tool="character-count" className="contents">
            {characterCount}
          </span>
        ) : (
          <span
            key={toolId}
            data-review-hub-footer-tool="writing-check"
            className="whitespace-nowrap rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700"
          >
            文章チェックβ
          </span>
        ),
      )}
    </div>
  );
}
