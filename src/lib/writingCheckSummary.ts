import type { WritingDiagnostic } from "@/lib/writingCheckEngine";

/**
 * TSP-B1: one place that turns the (already ignore-filtered) 文章チェックβ
 * issue list into the "事故確認 N件 ／ 確認推奨 M件" numbers. Shared by the
 * existing footer WritingCheckBar and the Review Hub so the two can never
 * disagree; it only counts the issues the engine already produced and does
 * no analysis of its own.
 */
export interface WritingIssueSummary {
  total: number;
  /** severity HIGH_CONFIDENCE — shown as 事故確認 */
  red: number;
  /** everything else — shown as 確認推奨 */
  yellow: number;
}

export function summarizeWritingIssues(
  issues: readonly Pick<WritingDiagnostic, "severity">[]
): WritingIssueSummary {
  const red = issues.filter((issue) => issue.severity === "HIGH_CONFIDENCE").length;
  return { total: issues.length, red, yellow: issues.length - red };
}

export const WRITING_CHECK_NO_CANDIDATES_LABEL = "確認候補なし";

/** Plain-text form of the same wording WritingCheckBar renders as badges. */
export function describeWritingIssueSummary(summary: WritingIssueSummary): string {
  if (summary.total === 0) return WRITING_CHECK_NO_CANDIDATES_LABEL;
  const parts: string[] = [];
  if (summary.red > 0) parts.push(`事故確認 ${summary.red}件`);
  if (summary.yellow > 0) parts.push(`確認推奨 ${summary.yellow}件`);
  return parts.join(" ／ ");
}
