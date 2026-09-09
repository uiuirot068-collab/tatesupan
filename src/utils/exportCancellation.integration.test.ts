import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  saveAs: vi.fn(),
  zipFile: vi.fn(),
  zipGenerate: vi.fn(),
}));

vi.mock("./exportCapture", () => ({
  EXPORT_TIMING_ENABLED: false,
  capturePageToCanvas: mocks.capture,
}));

vi.mock("file-saver", () => ({ saveAs: mocks.saveAs }));

vi.mock("jszip", () => ({
  default: class MockZip {
    file = mocks.zipFile;
    generateAsync = mocks.zipGenerate;
  },
}));

import {
  ExportCancellationCoordinator,
  ExportCancelledError,
} from "@/lib/exportCancellation";
import { exportPagesAsIndividualJpgs, exportPagesToZip } from "./exportImage";

function fakeCanvas() {
  return {
    width: 100,
    height: 140,
    toDataURL: vi.fn(() => "data:image/jpeg;base64,AA=="),
    toBlob: vi.fn((callback: (blob: Blob) => void) => callback(new Blob(["jpg"]))),
  } as unknown as HTMLCanvasElement;
}

const items = [
  { element: {} as HTMLElement, fileName: "page-1.jpg" },
  { element: {} as HTMLElement, fileName: "page-2.jpg" },
];

describe("export pipeline cooperative cancellation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", {
      setTimeout,
      clearTimeout,
    });
    mocks.capture.mockImplementation(async () => fakeCanvas());
  });

  it("stops individual JPG work before the next page after cancellation", async () => {
    const controller = new AbortController();
    mocks.saveAs.mockImplementationOnce(() => controller.abort());

    await expect(exportPagesAsIndividualJpgs(
      items,
      undefined,
      1,
      undefined,
      controller.signal,
      0
    )).rejects.toBeInstanceOf(ExportCancelledError);

    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.saveAs).toHaveBeenCalledTimes(1);
  });

  it("finishes the current safe unit but does not schedule the next one while confirming", async () => {
    const cancellation = new ExportCancellationCoordinator();
    const signal = cancellation.begin();
    mocks.capture.mockImplementationOnce(async () => {
      expect(cancellation.handleEscape()).toBe("open-confirmation");
      return fakeCanvas();
    });

    const exportPromise = exportPagesAsIndividualJpgs(
      items,
      undefined,
      1,
      undefined,
      signal,
      0
    );

    await vi.waitFor(() => expect(mocks.capture).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(signal.aborted).toBe(false);
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.saveAs).not.toHaveBeenCalled();

    cancellation.continueExport();
    await exportPromise;
    expect(mocks.capture).toHaveBeenCalledTimes(2);
    expect(mocks.saveAs).toHaveBeenCalledTimes(2);
  });

  it("cancels remaining paused work without handing off incomplete output", async () => {
    const cancellation = new ExportCancellationCoordinator();
    const signal = cancellation.begin();
    mocks.capture.mockImplementationOnce(async () => {
      cancellation.handleEscape();
      return fakeCanvas();
    });

    const exportPromise = exportPagesAsIndividualJpgs(
      items,
      undefined,
      1,
      undefined,
      signal,
      0
    );

    await vi.waitFor(() => expect(mocks.capture).toHaveBeenCalledTimes(1));
    expect(cancellation.cancelExport()).toBe(true);
    await expect(exportPromise).rejects.toBeInstanceOf(ExportCancelledError);
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.saveAs).not.toHaveBeenCalled();
  });

  it("suppresses an incomplete ZIP at the final generation boundary", async () => {
    const controller = new AbortController();
    mocks.zipGenerate.mockImplementationOnce(async (_options, onUpdate) => {
      controller.abort();
      onUpdate?.({ percent: 50, currentFile: "page-2.jpg" });
      return new Blob(["incomplete"]);
    });

    await expect(exportPagesToZip(
      items,
      "pages.zip",
      undefined,
      1,
      undefined,
      controller.signal
    )).rejects.toBeInstanceOf(ExportCancelledError);

    expect(mocks.zipFile).toHaveBeenCalledTimes(2);
    expect(mocks.saveAs).not.toHaveBeenCalled();
  });
});
