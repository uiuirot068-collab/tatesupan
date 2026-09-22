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

/**
 * B2: the count pill in the footer's status row, shown only while 文字数カウント
 * is set to フッターに表示 (B4 adds the compact 音読β control the same way).
 * (文章チェックβ's footer strip is shown/hidden by EditorPane from the same preference; both are display only.)
 */
export function ReviewHubFooterPinnedTools({ characterCount }: ReviewHubFooterPinnedToolsProps) {
  const { isPinned } = useReviewHubFooterPins();
  // 音読β and 描写・修飾チェックβ are Review Dock cards (EditorPane); 文章チェックβ keeps its own strip.
  if (!isPinned("character-count")) return null;

  return (
    <span data-review-hub-footer-tool="character-count" className="contents">
      {characterCount}
    </span>
  );
}
