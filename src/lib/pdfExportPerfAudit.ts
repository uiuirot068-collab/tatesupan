'use client';

export interface PdfExportPerfPageSample {
  page: number;
  captureMs: number;
  cropMs: number;
  encodeMs: number;
  addImageMs: number;
  yieldMs: number;
  retryCount: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface PdfExportPerfReport {
  kind: "TateSpun PDF legacy perf audit";
  createdAt: string;
  mode: string;
  paperSizeName: string;
  pageCount: number;
  scale: number;
  preflightMs: number;
  loopMs: number;
  saveMs: number;
  totalMs: number;
  browser: string;
  hardwareConcurrency: number | null;
  deviceMemoryGb: number | null;
  pages: PdfExportPerfPageSample[];
}

const PERF_STORAGE_KEY = "tatespun:pdf-perf-audit:last";
const PERF_BUTTON_ID = "tatespun-pdf-perf-audit-download";

function auditFileName(report: PdfExportPerfReport): string {
  const stamp = report.createdAt.replace(/[:.]/g, "-");
  return `TateSpun_PDF_PERF_${stamp}.json`;
}

function downloadReport(report: PdfExportPerfReport): void {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = auditFileName(report);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function ensureManualDownloadButton(report: PdfExportPerfReport): void {
  document.getElementById(PERF_BUTTON_ID)?.remove();

  const button = document.createElement("button");
  button.id = PERF_BUTTON_ID;
  button.type = "button";
  button.textContent = "PDF計測JSONを保存";
  button.setAttribute("data-pdf-perf-audit-download", "");
  Object.assign(button.style, {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: "2147483647",
    border: "1px solid rgba(42,49,66,.25)",
    borderRadius: "999px",
    padding: "10px 16px",
    background: "#c6af63",
    color: "#11151d",
    font: "600 13px/1.2 system-ui, sans-serif",
    boxShadow: "0 6px 24px rgba(0,0,0,.22)",
    cursor: "pointer",
  });

  button.addEventListener("click", () => {
    let current = report;
    try {
      const stored = localStorage.getItem(PERF_STORAGE_KEY);
      if (stored) current = JSON.parse(stored) as PdfExportPerfReport;
    } catch {
      // Keep the in-memory report as a safe fallback.
    }
    downloadReport(current);
    button.textContent = "計測JSONを保存しました";
    setTimeout(() => {
      if (document.body.contains(button)) button.textContent = "PDF計測JSONを保存";
    }, 1800);
  });

  document.body.appendChild(button);
}

export function downloadPdfExportPerfReport(report: PdfExportPerfReport): void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;

  // Chrome may block the second automatic download when PDF + audit JSON are
  // triggered by one export action. Persist the report first, then expose an
  // explicit one-click download button. An explicit user click is reliably
  // allowed and the report also survives accidental dismissal/reload.
  try {
    localStorage.setItem(PERF_STORAGE_KEY, JSON.stringify(report));
  } catch {
    // The report is still available in memory for the button below.
  }
  ensureManualDownloadButton(report);
}
