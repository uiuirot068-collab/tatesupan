/**
 * CST-PORT-003: "ページ番号を入れて移動" (ported from COLUMNSTAND's
 * PageNumberInput / clampPageInput). Pure navigation math for the preview
 * pager; the UI lives in components/PageNumberInput.tsx and PreviewPane.tsx.
 *
 * Page numbers here are PHYSICAL page numbers (1-based positions in the
 * Presentation Sequence: 目次 and 奥付 included), the same numbers the
 * preview's ノンブル and 「全 N ページ」 use since Phase 11.
 */
import { computeSpreadGroups } from "./pageOrder";
import {
  findPreviewZoomAnchor,
  findPreviewSpreadIndex,
  type PreviewSpreadLayout,
} from "./previewPageVirtualization";

/** 1ページ表示 (each page alone) or 見開き表示 (page 1 alone, then 2-3, 4-5, ...). */
export type PreviewPageLayout = "single" | "spread";

/**
 * Parse what the user typed into the page field.
 * - 全角数字 / 全角マイナス are accepted (NFKC).
 * - ≤ 0 → 1, > total → total.
 * - anything that is not an integer (empty, "abc", "1.5", "1-2") → null (= revert).
 */
export function parsePageNumberInput(raw: string, total: number): number | null {
  const digits = raw.normalize("NFKC").trim().replace(/^[−‐‑–—]/, "-");
  if (!/^-?\d+$/.test(digits) || total < 1) return null;
  const value = Number.parseInt(digits, 10);
  return Math.min(total, Math.max(1, value));
}

/** Navigation groups (lists of presentation indices) for the given layout. */
export function previewNavigationGroups(pageCount: number, layout: PreviewPageLayout): number[][] {
  if (layout === "spread") return computeSpreadGroups(pageCount);
  return Array.from({ length: Math.max(0, pageCount) }, (_, index) => [index]);
}

/**
 * Physical page number → presentation index (0-based). Uses the preview's own
 * physical-number table when it has the page, otherwise falls back to
 * `page - 1` (the two coincide whenever the table is the plain 1..N run).
 */
export function presentationIndexForPhysicalPage(
  physicalNumbers: readonly number[],
  page: number
): number {
  const found = physicalNumbers.indexOf(page);
  if (found >= 0) return found;
  return Math.min(Math.max(physicalNumbers.length, 1), Math.max(1, page)) - 1;
}

/** Physical page number at a presentation index (falls back to index + 1). */
export function physicalPageAt(physicalNumbers: readonly number[], presentationIndex: number): number {
  return physicalNumbers[presentationIndex] ?? presentationIndex + 1;
}

/**
 * Which navigation group (spread in 見開き, page in 1ページ) shows `page`.
 * null when there are no pages.
 */
export function groupIndexForPhysicalPage(
  groups: readonly (readonly number[])[],
  physicalNumbers: readonly number[],
  page: number
): number | null {
  return findPreviewSpreadIndex(groups, presentationIndexForPhysicalPage(physicalNumbers, page));
}

/**
 * ‹ › buttons: the page to show after one step.
 * - 1ページ: ±1.
 * - 見開き: the first page of the previous / next spread (1 → 2 → 4 → 6 …),
 *   from whichever page of the current spread is "current".
 * Stays put at either end.
 */
export function stepPreviewPage(
  current: number,
  direction: -1 | 1,
  groups: readonly (readonly number[])[],
  physicalNumbers: readonly number[]
): number {
  const groupIndex = groupIndexForPhysicalPage(groups, physicalNumbers, current);
  if (groupIndex === null) return current;
  const target = groups[groupIndex + direction];
  if (!target || target.length === 0) return current;
  return physicalPageAt(physicalNumbers, Math.min(...target));
}

/**
 * The page the pager should show for the current scroll position.
 * `logicalViewportY` is the viewport centre in untransformed spread layout
 * (the same coordinate the zoom anchor uses). If `current` is one of the
 * pages of the group under the centre it is kept (so jumping to the left page
 * of a spread keeps showing that page); otherwise the group's first page.
 */
export function pageAtViewport(
  layouts: readonly PreviewSpreadLayout[],
  logicalViewportY: number,
  groups: readonly (readonly number[])[],
  physicalNumbers: readonly number[],
  current: number
): number | null {
  const anchor = findPreviewZoomAnchor(layouts, logicalViewportY);
  if (!anchor) return null;
  const group = groups[anchor.spreadIndex];
  if (!group || group.length === 0) return null;
  const pages = group.map((index) => physicalPageAt(physicalNumbers, index));
  return pages.includes(current) ? current : Math.min(...pages);
}
