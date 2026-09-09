export class ExportCancelledError extends Error {
  constructor() {
    super("Export cancelled by the user.");
    this.name = "ExportCancelledError";
  }
}

export function throwIfExportCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new ExportCancelledError();
}

export function isExportCancelledError(error: unknown): error is ExportCancelledError {
  return error instanceof ExportCancelledError
    || (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError");
}

/** Abort-aware pause used between browser-triggered page downloads. */
export function waitForExportDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  throwIfExportCancelled(signal);
  if (delayMs <= 0) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, delayMs);
    const abort = () => {
      window.clearTimeout(timer);
      reject(new ExportCancelledError());
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
}

export type ExportEscapeResult = "idle" | "open-confirmation" | "close-confirmation";

/** State machine shared by every export button in PreviewPane. */
export class ExportCancellationCoordinator {
  private controller: AbortController | null = null;
  private confirmationOpen = false;

  begin(): AbortSignal {
    this.controller = new AbortController();
    this.confirmationOpen = false;
    return this.controller.signal;
  }

  finish(signal: AbortSignal): boolean {
    if (this.controller?.signal !== signal) return false;
    this.controller = null;
    this.confirmationOpen = false;
    return true;
  }

  handleEscape(): ExportEscapeResult {
    if (!this.controller) return "idle";
    if (this.confirmationOpen) {
      this.confirmationOpen = false;
      return "close-confirmation";
    }
    this.confirmationOpen = true;
    return "open-confirmation";
  }

  continueExport(): void {
    this.confirmationOpen = false;
  }

  cancelExport(): boolean {
    if (!this.controller) return false;
    this.confirmationOpen = false;
    this.controller.abort();
    return true;
  }

  get isActive(): boolean {
    return this.controller !== null;
  }

  get isConfirmationOpen(): boolean {
    return this.confirmationOpen;
  }
}
