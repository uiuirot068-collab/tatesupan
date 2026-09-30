export type ExportPreflightSeverity = "blocker" | "warning";

export interface ExportPreflightIssue {
  id: string;
  severity: ExportPreflightSeverity;
  title: string;
  detail?: string;
  pageNumbers?: number[];
  actionLabel?: string;
}

export interface ExportPreflightReport {
  issues: ExportPreflightIssue[];
  blockerCount: number;
  warningCount: number;
  ok: boolean;
}

export function buildExportPreflightReport(issues: readonly ExportPreflightIssue[]): ExportPreflightReport {
  const normalized = issues.map((issue) => ({
    ...issue,
    pageNumbers: issue.pageNumbers ? [...new Set(issue.pageNumbers)].sort((a, b) => a - b) : undefined,
  }));
  const blockerCount = normalized.filter((issue) => issue.severity === "blocker").length;
  const warningCount = normalized.filter((issue) => issue.severity === "warning").length;
  return {
    issues: normalized,
    blockerCount,
    warningCount,
    ok: blockerCount === 0 && warningCount === 0,
  };
}

export function exportPreflightFingerprint(report: ExportPreflightReport): string {
  return JSON.stringify(
    report.issues.map((issue) => [
      issue.id,
      issue.severity,
      issue.title,
      issue.detail ?? "",
      issue.pageNumbers ?? [],
    ])
  );
}

export function canContinueExportAfterPreflight(
  report: ExportPreflightReport,
  reviewed: boolean
): boolean {
  return reviewed && report.blockerCount === 0;
}
