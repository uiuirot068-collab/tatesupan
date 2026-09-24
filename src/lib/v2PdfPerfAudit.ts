'use client';

export interface V2PdfPerfReport {
  kind: "TateSpun PDF V2 perf audit";
  createdAt: string;
  mode: string;
  pageCount: number;
  planMs: number;
  workerMs: number;
  downloadTriggerMs: number;
  totalMs: number;
  pdfBytes: number;
  browser: string;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
}

const STORAGE_KEY = "tatespun:pdf-v2-perf-audit:last";
const BUTTON_ID = "tatespun-pdf-v2-perf-audit-download";

function downloadReport(report: V2PdfPerfReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `TateSpun_PDF_V2_PERF_${report.createdAt.replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exposeV2PdfPerfReport(report: V2PdfPerfReport): void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(report));
  } catch {
    // Keep the in-memory report below.
  }

  document.getElementById(BUTTON_ID)?.remove();
  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = `V2計測JSONを保存（${(report.totalMs / 1000).toFixed(1)}秒）`;
  button.setAttribute("data-pdf-v2-perf-audit-download", "");
  Object.assign(button.style, {
    position: "fixed",
    right: "20px",
    bottom: "68px",
    zIndex: "2147483647",
    border: "1px solid rgba(42,49,66,.25)",
    borderRadius: "999px",
    padding: "10px 16px",
    background: "#9cc6b7",
    color: "#11151d",
    font: "600 13px/1.2 system-ui, sans-serif",
    boxShadow: "0 6px 24px rgba(0,0,0,.22)",
    cursor: "pointer",
  });
  button.addEventListener("click", () => {
    let current = report;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) current = JSON.parse(stored) as V2PdfPerfReport;
    } catch {
      // Use in-memory fallback.
    }
    downloadReport(current);
    button.textContent = "V2計測JSONを保存しました";
  });
  document.body.appendChild(button);
}
