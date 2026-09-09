import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  ExportCancellationCoordinator,
  isExportCancelledError,
  throwIfExportCancelled,
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
    expect(preview.match(/finishExport\(signal\)/g)?.length).toBe(5);
    expect(preview).toContain('data-export-cancel-action="continue"');
    expect(preview).toContain('data-export-cancel-action="abort"');
    expect(image.match(/throwIfExportCancelled\(signal\)/g)?.length).toBeGreaterThanOrEqual(8);
    expect(image).toMatch(/throwIfExportCancelled\(signal\);\s*saveAs\(content, zipFileName\)/);
    expect(pdf).toMatch(/throwIfExportCancelled\(signal\);\s*pdf\.save\(fileName\)/);
  });
});
