"use client";

import type { ExportPreflightReport } from "@/lib/exportPreflight";

interface ExportPreflightAccordionProps {
  report: ExportPreflightReport;
  open: boolean;
  reviewed: boolean;
  onToggle: (open: boolean) => void;
  onIssueAction?: (issueId: string) => void;
}

function StatusDot({ active, tone }: { active: boolean; tone: "red" | "yellow" }) {
  const toneClass = tone === "red"
    ? active ? "border-red-600 bg-red-600" : "border-red-500 bg-transparent"
    : active ? "border-amber-500 bg-amber-400" : "border-amber-400 bg-transparent";
  return <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full border ${toneClass}`} />;
}

export default function ExportPreflightAccordion({
  report,
  open,
  reviewed,
  onToggle,
  onIssueAction,
}: ExportPreflightAccordionProps) {
  return (
    <section
      data-export-preflight=""
      className="mb-3 overflow-hidden rounded-lg border border-ink/15 bg-ink/[0.025]"
    >
      <button
        type="button"
        data-export-preflight-toggle=""
        aria-expanded={open}
        onClick={() => onToggle(!open)}
        className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left hover:bg-ink/[0.035]"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-ink">書き出し前チェック</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
            {report.ok ? (
              <span data-export-preflight-status="ok" className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
                <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                問題なし
              </span>
            ) : (
              <>
                <span data-export-preflight-status="blocker" className="inline-flex items-center gap-1.5 text-ink/75">
                  <StatusDot active={report.blockerCount > 0} tone="red" />
                  出力不可 {report.blockerCount}件
                </span>
                <span data-export-preflight-status="warning" className="inline-flex items-center gap-1.5 text-ink/75">
                  <StatusDot active={report.warningCount > 0} tone="yellow" />
                  確認推奨 {report.warningCount}件
                </span>
              </>
            )}
          </div>
        </div>
        <span className="shrink-0 text-xs text-ink/50">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div data-export-preflight-body="" className="border-t border-ink/10 px-3 py-3">
          {report.issues.length === 0 ? (
            <p className="rounded bg-emerald-500/10 px-3 py-2 text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
              現在の書き出し対象に問題は見つかりませんでした。
            </p>
          ) : (
            <div className="grid gap-2">
              {report.issues.map((issue) => {
                const blocker = issue.severity === "blocker";
                return (
                  <div
                    key={issue.id}
                    data-export-preflight-issue={issue.id}
                    data-export-preflight-severity={issue.severity}
                    className={`rounded border px-3 py-2 ${blocker
                      ? "border-red-300 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20"
                      : "border-amber-300 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <span aria-hidden="true" className={`mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${blocker ? "bg-red-600" : "bg-amber-400"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-ink">{issue.title}</p>
                        {issue.pageNumbers && issue.pageNumbers.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-ink/65">
                            対象：{issue.pageNumbers.map((page) => `${page}P`).join("・")}
                          </p>
                        )}
                        {issue.detail && (
                          <p className="mt-1 text-[11px] leading-relaxed text-ink/65">{issue.detail}</p>
                        )}
                        {issue.actionLabel && onIssueAction && (
                          <button
                            type="button"
                            onClick={() => onIssueAction(issue.id)}
                            className="mt-2 rounded border border-ink/20 px-2 py-1 text-[11px] font-medium hover:bg-ink/5"
                          >
                            {issue.actionLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-ink/55">
            この欄を確認すると書き出しボタンが有効になります。赤い項目が残る場合は、書き出し対象を変更するか問題を解消してください。
          </p>
          {reviewed && (
            <p data-export-preflight-reviewed="" className="mt-1 text-[11px] font-medium text-ink/70">
              ✓ 現在のチェック内容を確認済み
            </p>
          )}
        </div>
      )}
    </section>
  );
}
