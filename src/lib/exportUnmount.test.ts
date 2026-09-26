import { describe, expect, it, vi } from "vitest";
import {
  ExportCancellationCoordinator,
  isExportCancelledError,
  throwIfExportCancelled,
  waitForExportPermission,
} from "./exportCancellation";

/**
 * Phase 6.1: a PDF export that is still running when the editor unmounts must
 * not download. PreviewPane's unmount cleanup calls `dispose()`; this mirrors
 * the V2 PDF flow in PreviewPane.runPdfExport (begin → worker → permission
 * checkpoint → download) with a controllable fake worker.
 */
function fakeWorker() {
  let complete: (bytes: Uint8Array) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const result = new Promise<Uint8Array>((resolve, reject) => {
    complete = resolve;
    fail = reject;
  });
  const cancel = vi.fn(() => fail(new DOMException("Export cancelled", "AbortError")));
  return { result, cancel, complete };
}

async function runPdfLikeExport(
  coordinator: ExportCancellationCoordinator,
  worker: ReturnType<typeof fakeWorker>,
  download: () => void,
  beforeBegin: Promise<void> = Promise.resolve()
): Promise<"downloaded" | "cancelled"> {
  await beforeBegin; // requireV2ExportPlan()
  const signal = coordinator.begin();
  try {
    throwIfExportCancelled(signal);
    signal.addEventListener("abort", () => worker.cancel(), { once: true });
    await worker.result;
    await waitForExportPermission(signal);
    download();
    return "downloaded";
  } catch (error) {
    if (!isExportCancelledError(error)) throw error;
    return "cancelled";
  } finally {
    coordinator.finish(signal);
  }
}

describe("export after editor unmount", () => {
  it("baseline: a mounted export downloads", async () => {
    const coordinator = new ExportCancellationCoordinator();
    const worker = fakeWorker();
    const download = vi.fn();
    const run = runPdfLikeExport(coordinator, worker, download);
    await Promise.resolve();
    worker.complete(new Uint8Array([1]));
    expect(await run).toBe("downloaded");
    expect(download).toHaveBeenCalledTimes(1);
  });

  it("unmount mid-worker terminates the worker and never downloads, even if bytes arrive later", async () => {
    const coordinator = new ExportCancellationCoordinator();
    const worker = fakeWorker();
    const download = vi.fn();
    const run = runPdfLikeExport(coordinator, worker, download);
    await Promise.resolve();
    coordinator.dispose(); // PreviewPane unmount cleanup
    worker.complete(new Uint8Array([1])); // late completion
    expect(await run).toBe("cancelled");
    expect(worker.cancel).toHaveBeenCalledTimes(1);
    expect(download).not.toHaveBeenCalled();
    expect(coordinator.isActive).toBe(false);
  });

  it("unmount while the plan is still preparing: the later begin() is already cancelled and no worker starts", async () => {
    const coordinator = new ExportCancellationCoordinator();
    const worker = fakeWorker();
    const download = vi.fn();
    let planReady: () => void = () => undefined;
    const plan = new Promise<void>((resolve) => { planReady = resolve; });
    const run = runPdfLikeExport(coordinator, worker, download, plan);
    coordinator.dispose();
    planReady();
    expect(await run).toBe("cancelled");
    expect(download).not.toHaveBeenCalled();
    expect(coordinator.isActive).toBe(false);
  });

  it("activate() re-enables exports after a StrictMode effect re-run", async () => {
    const coordinator = new ExportCancellationCoordinator();
    coordinator.dispose();
    coordinator.activate();
    const signal = coordinator.begin();
    expect(signal.aborted).toBe(false);
    expect(coordinator.finish(signal)).toBe(true);
  });
});
