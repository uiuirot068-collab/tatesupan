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

function auditFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `TateSpun_PDF_PERF_${stamp}.json`;
}

export function downloadPdfExportPerfReport(report: PdfExportPerfReport): void {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = auditFileName();
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
