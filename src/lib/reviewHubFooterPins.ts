export const REVIEW_HUB_FOOTER_STORAGE_KEY = "tatespun.reviewHub.footerTools.v1";
export const REVIEW_HUB_FOOTER_MAX = 2 as const;
export const REVIEW_HUB_FOOTER_TOOL_IDS = ["writing-check", "character-count"] as const;

export type ReviewHubFooterToolId =
  (typeof REVIEW_HUB_FOOTER_TOOL_IDS)[number];

/** Both shown = the footer exactly as it was before B2 (文章チェックβ strip above the status row, count pill in it). */
export const DEFAULT_REVIEW_HUB_FOOTER_TOOLS: ReviewHubFooterToolId[] = [
  "writing-check",
  "character-count",
];

export function normalizeReviewHubFooterTools(
  value: unknown,
): ReviewHubFooterToolId[] {
  if (!Array.isArray(value)) return [...DEFAULT_REVIEW_HUB_FOOTER_TOOLS];

  const result: ReviewHubFooterToolId[] = [];
  for (const valueItem of value) {
    if (
      (valueItem === "writing-check" || valueItem === "character-count") &&
      !result.includes(valueItem)
    ) {
      result.push(valueItem);
    }
    if (result.length === REVIEW_HUB_FOOTER_MAX) break;
  }
  return result;
}

export function toggleReviewHubFooterTool(
  current: readonly ReviewHubFooterToolId[],
  toolId: ReviewHubFooterToolId,
): ReviewHubFooterToolId[] {
  const normalized = normalizeReviewHubFooterTools([...current]);
  if (normalized.includes(toolId)) {
    return normalized.filter((id) => id !== toolId);
  }
  if (normalized.length >= REVIEW_HUB_FOOTER_MAX) return normalized;
  return [...normalized, toolId];
}

export function moveReviewHubFooterTool(
  current: readonly ReviewHubFooterToolId[],
  toolId: ReviewHubFooterToolId,
  direction: -1 | 1,
): ReviewHubFooterToolId[] {
  const normalized = normalizeReviewHubFooterTools([...current]);
  const index = normalized.indexOf(toolId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= normalized.length) {
    return normalized;
  }

  const next = [...normalized];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}
