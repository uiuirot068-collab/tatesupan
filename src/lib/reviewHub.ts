/**
 * TSP-B1 Review Hub / 見直し — pure model (no React, no DOM).
 *
 * The Review Hub is an information-architecture layer that gathers the
 * writing-review tools behind ONE persistent footer control `▶ 見直し`. It is
 * not a feature category of its own and it owns no analysis or counting
 * logic: every entry reuses state/actions the Editor already has.
 *
 * EXTENSIBILITY (for later loops, NOT exposed today): a future tool is added by
 *   1. adding its id to `ReviewHubToolId`,
 *   2. adding one `ReviewHubToolMeta` row to `REVIEW_HUB_TOOLS`,
 *   3. supplying its section in `ReviewHubSections` (the `Record` type makes a
 *      missing section a compile error).
 * A tool must be registered only when it is implemented AND released. Nothing
 * unreleased (描写語・修飾表現チェックβ, …) may appear
 * here as a placeholder — see `reviewHub.test.tsx`.
 */

export const REVIEW_HUB_PANEL_ID = "editor-review-hub";
export const REVIEW_HUB_HEADING_ID = "editor-review-hub-heading";
export const REVIEW_HUB_TRIGGER_LABEL = "見直し";
export const REVIEW_HUB_HEADING = "見直し";

export type ReviewHubToolId = "writing-check" | "character-count" | "read-aloud";

export interface ReviewHubToolMeta {
  readonly id: ReviewHubToolId;
  readonly title: string;
  readonly summary: string;
}

/** Tools that exist and are usable today, in display order. */
export const REVIEW_HUB_TOOLS: readonly ReviewHubToolMeta[] = [
  {
    id: "writing-check",
    title: "文章チェックβ",
    summary: "括弧の閉じ忘れなど、気になる箇所を波線でお知らせします。",
  },
  {
    id: "character-count",
    title: "文字数カウント",
    summary: "画面下の表示と同じ、現在の原稿の文字数です。",
  },
  {
    id: "read-aloud",
    title: "音読β",
    summary: "声に出して読む代わりに、文章のリズムを耳で確かめます。",
  },
];

/** Upper bound of the panel's height (22rem at the 16px root). */
export const REVIEW_HUB_MAX_HEIGHT_PX = 352;
const REVIEW_HUB_MIN_HEIGHT_PX = 72;
const REVIEW_HUB_AREA_GAP_PX = 8;

/**
 * The panel is an overlay that grows upward from the footer. Its height is its
 * own content height, capped by the space between the top of the Editor pane and
 * the top of the footer (`spaceAboveFooterPx`) so it can never leave the pane
 * (the global header stays untouched). On every ordinary phone/desktop that
 * content fits inside the manuscript area, so the title / undo-redo / 設定・オプション
 * rows are not covered; only on a very short screen, where the expanded footer
 * leaves the manuscript area smaller than the panel, does it rise over those rows
 * — and only as far as it needs. Longer content scrolls inside the panel.
 */
export function computeReviewHubMaxHeight(spaceAboveFooterPx: number): number {
  const available = Math.floor(spaceAboveFooterPx) - REVIEW_HUB_AREA_GAP_PX;
  return Math.min(REVIEW_HUB_MAX_HEIGHT_PX, Math.max(REVIEW_HUB_MIN_HEIGHT_PX, available));
}

/**
 * The Hub follows the footer's existing chrome rules instead of inventing its
 * own: 集中モード and the mobile keyboard-open state already hide the whole
 * footer (see EditorPane), so the Hub is never visible there either.
 */
export function isReviewHubVisible(
  requestedOpen: boolean,
  chrome: { focusMode: boolean; keyboardActive: boolean }
): boolean {
  return requestedOpen && !chrome.focusMode && !chrome.keyboardActive;
}

/**
 * Escape closes the Hub only while focus is inside it (handled on the Hub's
 * own wrapper), and never mid-IME-composition, so it cannot fight the
 * manuscript textarea or an open modal.
 */
export function shouldCloseReviewHubOnKey(key: string, isComposing: boolean): boolean {
  return key === "Escape" && !isComposing;
}

/** Same grouping the footer's mobile compact line already uses (`toLocaleString("ja-JP")`). */
export function formatReviewHubCharacterCount(count: number): string {
  return `${count.toLocaleString("ja-JP")}文字`;
}
