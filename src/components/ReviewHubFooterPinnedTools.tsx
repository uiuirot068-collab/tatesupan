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
  /** B4: the compact 音読β control (shown only while 音読β is フッターに表示). */
  readAloud?: ReactNode;
}

/**
 * B2: the count pill in the footer's status row, shown only while 文字数カウント
 * is set to フッターに表示 (B4 adds the compact 音読β control the same way).
 * (文章チェックβ's footer strip is shown/hidden by EditorPane from the same preference; both are display only.)
 */
export function ReviewHubFooterPinnedTools({ characterCount, readAloud }: ReviewHubFooterPinnedToolsProps) {
  const { pins } = useReviewHubFooterPins();
  // Pin order = display order left to right; 文章チェックβ has its own strip above this row.
  const shown = pins.filter((id) => id === "character-count" || (id === "read-aloud" && readAloud));
  if (shown.length === 0) return null;

  return (
    <>
      {shown.map((id) => (
        <span key={id} data-review-hub-footer-tool={id} className="contents">
          {id === "read-aloud" ? readAloud : characterCount}
        </span>
      ))}
    </>
  );
}
