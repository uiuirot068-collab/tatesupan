import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  ExportCancellationCoordinator,
  ExportCancelledError,
  isExportCancelledError,
  throwIfExportCancelled,
  waitForExportPermission,
} from "./exportCancellation";

const SRC_ROOT = join(__dirname, "..");

describe("beta export cancellation", () => {
  it("does nothing while idle and requires confirmation before aborting", () => {
    const cancellation = new ExportCancellationCoordinator();
    expect(cancellation.handleEscape()).toBe("idle");

    const signal = cancellation.begin();
    expect(cancellation.handleEscape()).toBe("open-confirmation");
    expect(signal.aborted).toBe(false);
    expect(cancellation.handleEscape()).toBe("close-confirmation");
    expect(signal.aborted).toBe(false);

    expect(cancellation.handleEscape()).toBe("open-confirmation");
    cancellation.continueExport();
    expect(signal.aborted).toBe(false);
    expect(cancellation.isConfirmationOpen).toBe(false);

    expect(cancellation.handleEscape()).toBe("open-confirmation");
    expect(cancellation.cancelExport()).toBe(true);
    expect(signal.aborted).toBe(true);
    expect(cancellation.finish(signal)).toBe(true);
    expect(cancellation.isActive).toBe(false);
  });

  it("pauses new cooperative units until Continue or a second Escape resumes", async () => {
    const cancellation = new ExportCancellationCoordinator();
    const signal = cancellation.begin();
    expect(cancellation.state).toBe("running");

    expect(cancellation.handleEscape()).toBe("open-confirmation");
    expect(cancellation.state).toBe("confirming-pause");
    expect(signal.aborted).toBe(false);

    let nextUnitStarted = false;
    const pausedUnit = waitForExportPermission(signal).then(() => {
      nextUnitStarted = true;
    });
    await Promise.resolve();
    expect(nextUnitStarted).toBe(false);

    cancellation.continueExport();
    await pausedUnit;
    expect(nextUnitStarted).toBe(true);
    expect(cancellation.state).toBe("running");

    expect(cancellation.handleEscape()).toBe("open-confirmation");
    let escapeResumed = false;
    const escapePausedUnit = waitForExportPermission(signal).then(() => {
      escapeResumed = true;
    });
    await Promise.resolve();
    expect(escapeResumed).toBe(false);
    expect(cancellation.handleEscape()).toBe("close-confirmation");
    await escapePausedUnit;
    expect(escapeResumed).toBe(true);
  });

  it("rejects paused work when cancellation is confirmed", async () => {
    const cancellation = new ExportCancellationCoordinator();
    const signal = cancellation.begin();
    cancellation.handleEscape();

    const pausedUnit = waitForExportPermission(signal);
    expect(signal.aborted).toBe(false);
    expect(cancellation.cancelExport()).toBe(true);
    await expect(pausedUnit).rejects.toBeInstanceOf(ExportCancelledError);
    expect(cancellation.state).toBe("cancelled");
  });

  it("stops remaining page work at the next safe checkpoint", async () => {
    const cancellation = new ExportCancellationCoordinator();
    const signal = cancellation.begin();
    const completed: number[] = [];
    let reportedSuccessful = false;

    try {
      for (const page of [1, 2, 3]) {
        throwIfExportCancelled(signal);
        completed.push(page);
        if (page === 1) cancellation.cancelExport();
        throwIfExportCancelled(signal);
      }
      reportedSuccessful = true;
    } catch (error) {
      expect(isExportCancelledError(error)).toBe(true);
    } finally {
      cancellation.finish(signal);
    }

    expect(completed).toEqual([1]);
    expect(reportedSuccessful).toBe(false);
    expect(cancellation.isActive).toBe(false);
  });

  it("wires the shared signal through PDF/JPG/ZIP and gates every final save", () => {
    const preview = readFileSync(join(SRC_ROOT, "components", "PreviewPane.tsx"), "utf8");
    const image = readFileSync(join(SRC_ROOT, "utils", "exportImage.ts"), "utf8");
    const pdf = readFileSync(join(SRC_ROOT, "utils", "exportPdf.ts"), "utf8");

    expect(preview).toContain("new ExportCancellationCoordinator()");
    expect(preview).toContain("書き出しを中断しますか？");
    expect(preview).toContain("isExportCancelledError(err)");
    // Five legacy export paths plus the V2 browser JPG and PDF paths.
    expect(preview.match(/finishExport\(signal\)/g)?.length).toBe(7);
    expect(preview).toContain('data-export-cancel-action="continue"');
    expect(preview).toContain('data-export-cancel-action="abort"');
    expect(image.match(/waitForExportPermission\(signal\)/g)?.length).toBeGreaterThanOrEqual(10);
    expect(image).toMatch(/await waitForExportPermission\(signal\);\s*saveAs\(content, zipFileName\)/);
    expect(pdf).toMatch(/await waitForExportPermission\(signal\);\s*pdf\.save\(fileName\)/);
    expect(preview).toMatch(/isExportCancelledError\(err\)[\s\S]{0,500}finally \{\s*finishExport\(signal\)/);
    expect(preview).toMatch(/await exportCustomPdf[\s\S]{0,900}onPdfExportSuccess\?\.\(\)/);
  });

  it("gives the open export confirmation the topmost Escape", () => {
    const preview = readFileSync(join(SRC_ROOT, "components", "PreviewPane.tsx"), "utf8");
    const modal = readFileSync(join(SRC_ROOT, "components", "ViewportModal.tsx"), "utf8");

    expect(preview).toMatch(/event\.key !== "Escape" \|\| !isExporting \|\| isExportCancelConfirmOpen/);
    expect(preview).toContain('exportCancellation.handleEscape() !== "open-confirmation"');
    expect(preview).toContain("event.stopImmediatePropagation()");
    expect(modal).toContain("modalStack.at(-1) !== id");
    expect(modal).toMatch(/event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);\s*onClose\(\)/);
    expect(preview).toContain("onClose={continueExport}");
  });
});
