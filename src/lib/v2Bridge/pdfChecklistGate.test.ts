import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("PDF export checklist setting UI contract", () => {
  const checklist = source("src/components/ChecklistPanel.tsx");

  it("places the PDF setting below the list name and above progress/items", () => {
    const listName = checklist.indexOf("<span>リスト名</span>");
    const setting = checklist.indexOf('data-pdf-checklist-setting=""');
    const progress = checklist.indexOf("項目を確認済み");
    const items = checklist.indexOf('<ul className="grid gap-2">');

    expect(listName).toBeGreaterThanOrEqual(0);
    expect(setting).toBeGreaterThan(listName);
    expect(progress).toBeGreaterThan(setting);
    expect(items).toBeGreaterThan(progress);
    expect(checklist).toContain("PDF書き出し時にこのリストを表示する");
  });

  it("shows the live selected name and requires an explicit switch confirmation", () => {
    expect(checklist).toContain("pdfExportChecklist.name");
    expect(checklist).toContain("PDF書き出し時の確認リストに設定されています。");
    expect(checklist).toContain('data-pdf-checklist-switch-modal');
    expect(checklist).toContain('data-pdf-checklist-switch-action="cancel"');
    expect(checklist).toContain('data-pdf-checklist-switch-action="confirm"');
    expect(checklist).toContain("キャンセル");
    expect(checklist).toContain("切り替える");
  });

  it("clears by unchecking and never stores independent per-list booleans", () => {
    expect(checklist).toContain("setPdfExportChecklist(current, null)");
    expect(checklist).toContain("state.pdfExportSetId === active.id");
    expect(checklist).not.toMatch(/pdfExportEnabled|exportChecklistEnabled|isPdfChecklist/);
  });
});

describe("PDF pre-export Human Gate integration contract", () => {
  const preview = source("src/components/PreviewPane.tsx");
  const gate = source("src/components/PdfExportChecklistGate.tsx");
  const viewportModal = source("src/components/ViewportModal.tsx");

  it("keeps the no-selection path on the existing PDF function and gates a configured list before work starts", () => {
    const request = preview.slice(
      preview.indexOf("const handleDownloadPdf = () =>"),
      preview.indexOf("const confirmPdfChecklistAndDownload = () =>")
    );
    const perform = preview.slice(
      preview.indexOf("const performDownloadPdf = async () =>"),
      preview.indexOf("const handleDownloadPdf = () =>")
    );

    expect(request).toContain("readPdfExportChecklistAttempt()");
    expect(request).toContain("setPdfChecklistAttempt(attempt)");
    expect(request).toContain("void performDownloadPdf()");
    expect(request).not.toContain("beginExport(");
    expect(perform).toContain('beginExport("PDF"');
    expect(perform).toContain("startV2PdfWorker");
    expect(perform).toContain("exportCustomPdf");
  });

  it("enables export only at full Human completion and reuses generation exactly once", () => {
    const confirm = preview.slice(
      preview.indexOf("const confirmPdfChecklistAndDownload = () =>"),
      preview.indexOf("useEffect(() =>", preview.indexOf("const confirmPdfChecklistAndDownload = () =>"))
    );

    expect(gate).toContain("disabled={!progress.complete}");
    expect(gate).toContain("PDFを書き出す");
    expect(gate).toContain("updatePdfExportChecklistAttempt");
    expect(confirm).toContain("pdfExportChecklistAttemptProgress(pdfChecklistAttempt).complete");
    expect(confirm.match(/performDownloadPdf\(\)/g)).toHaveLength(1);
  });

  it("makes checked state per-attempt and resets it on every new PDF request", () => {
    expect(preview).toContain("beginPdfExportChecklistAttempt(");
    expect(preview).toContain("setPdfChecklistAttempt(null)");
    expect(gate).toContain("今回のPDF書き出しにだけ使用され、保存されません。");
    expect(gate).not.toMatch(/localStorage|CHECKLIST_STORAGE_KEY/);
  });

  it("cancels on Back, X, Escape, and backdrop without invoking PDF generation", () => {
    expect(gate).toContain('data-pdf-checklist-gate-action="cancel"');
    expect(gate).toContain("onClick={onCancel}");
    expect(gate).toContain("onClose={onCancel}");
    expect(viewportModal).toContain("onClick={onClose}");
    expect(viewportModal).toContain('event.key !== "Escape"');
    expect(gate.slice(gate.indexOf('data-pdf-checklist-gate-action="cancel"')))
      .not.toContain("performDownloadPdf");
  });

  it("allows a zero-item list and contains no automatic manuscript judgement", () => {
    expect(gate).toContain("このリストには確認項目がありません。そのままPDFを書き出せます。");
    expect(gate).toContain("progress.complete");
    expect(gate).not.toMatch(/paperSize|colophon|typo|manuscript|content|layout|PaintPlan/);
  });

  it("does not gate or modify the JPG export paths", () => {
    const jpg = preview.slice(
      preview.indexOf("const handleExportJpg = async () =>"),
      preview.indexOf("const [isPdfModalOpen")
    );
    expect(jpg).not.toMatch(/Checklist|checklist/);
    expect(jpg).toContain("exportV2JpgPages");
    expect(jpg).toContain("exportPagesAsIndividualJpgs");
    expect(jpg).toContain("exportPagesToZip");
  });
});
