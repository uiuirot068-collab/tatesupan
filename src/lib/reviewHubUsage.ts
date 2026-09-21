/**
 * TSP-B3 — session-only Review Hub usage counters.
 *
 * Two plain numbers held in module memory: how often the Review Hub was opened
 * and how often the footer display (pin) selection was changed since this page
 * was loaded. They are NOT persisted (no localStorage / sessionStorage /
 * IndexedDB — the B1 contract "opening/closing writes nothing" stays true), they
 * are never sent automatically, and they leave the device only when the writer
 * presses 送信 on the 見直し tab of the beta report modal, where they are shown
 * first (see `reviewHubFeedback.ts`). A reload starts them from 0.
 */

/** Keeps the value a small, bounded number no matter how long a session runs. */
export const REVIEW_HUB_USAGE_COUNT_CAP = 999;

export interface ReviewHubSessionUsage {
  readonly hubOpens: number;
  readonly pinChanges: number;
}

let hubOpens = 0;
let pinChanges = 0;

const bump = (value: number) => Math.min(REVIEW_HUB_USAGE_COUNT_CAP, value + 1);

/** Called when the writer opens the Hub (closed -> open), never for a close. */
export function recordReviewHubOpen(): void {
  hubOpens = bump(hubOpens);
}

/** Called when the footer display selection actually changed (pin / unpin / reorder). */
export function recordFooterPinChange(): void {
  pinChanges = bump(pinChanges);
}

export function getReviewHubSessionUsage(): ReviewHubSessionUsage {
  return { hubOpens, pinChanges };
}

/** Test seam only: production code never resets (a reload does). */
export function resetReviewHubSessionUsageForTest(): void {
  hubOpens = 0;
  pinChanges = 0;
}
