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

import { ExportCancelledError } from "@/lib/exportCancellation";
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
