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

type ExportPauseGate = () => Promise<void>;

const pauseGates = new WeakMap<AbortSignal, ExportPauseGate>();

/**
 * Waits at a cooperative export boundary while cancellation confirmation is
 * open. Third-party/synchronous work already in progress is allowed to finish;
 * the next safe unit does not start until the Human resumes or cancels.
 */
export async function waitForExportPermission(signal?: AbortSignal): Promise<void> {
  throwIfExportCancelled(signal);
  if (!signal) return;
  const wait = pauseGates.get(signal);
  if (wait) await wait();
  throwIfExportCancelled(signal);
}

/** Abort-aware pause used between browser-triggered page downloads. */
export async function waitForExportDelay(delayMs: number, signal?: AbortSignal): Promise<void> {
  await waitForExportPermission(signal);
  if (delayMs <= 0) return;

  await new Promise<void>((resolve, reject) => {
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
  await waitForExportPermission(signal);
}

export type ExportEscapeResult = "idle" | "open-confirmation" | "close-confirmation";
export type ExportCancellationState =
  | "idle"
  | "running"
  | "confirming-pause"
  | "cancelling"
  | "cancelled"
  | "completed";

interface ExportPauseWaiter {
  resolve: () => void;
  reject: (error: ExportCancelledError) => void;
  removeAbortListener: () => void;
}

/** State machine shared by every export button in PreviewPane. */
export class ExportCancellationCoordinator {
  private controller: AbortController | null = null;
  private confirmationOpen = false;
  private waiters = new Set<ExportPauseWaiter>();
  private currentState: ExportCancellationState = "idle";

  begin(): AbortSignal {
    if (this.controller) {
      throw new Error("An export is already active.");
    }
    this.controller = new AbortController();
    this.confirmationOpen = false;
    this.currentState = "running";
    const signal = this.controller.signal;
    pauseGates.set(signal, () => this.waitUntilResumed(signal));
    return signal;
  }

  finish(signal: AbortSignal): boolean {
    if (this.controller?.signal !== signal) return false;
    pauseGates.delete(signal);
    this.releaseWaiters();
    this.currentState = signal.aborted ? "cancelled" : "completed";
    this.controller = null;
    this.confirmationOpen = false;
    return true;
  }

  handleEscape(): ExportEscapeResult {
    if (!this.controller) return "idle";
    if (this.confirmationOpen) {
      this.continueExport();
      return "close-confirmation";
    }
    this.confirmationOpen = true;
    this.currentState = "confirming-pause";
    return "open-confirmation";
  }

  continueExport(): void {
    if (!this.controller) return;
    this.confirmationOpen = false;
    this.currentState = "running";
    this.releaseWaiters();
  }

  cancelExport(): boolean {
    if (!this.controller) return false;
    this.confirmationOpen = false;
    this.currentState = "cancelling";
    this.controller.abort();
    this.rejectWaiters();
    this.currentState = "cancelled";
    return true;
  }

  private waitUntilResumed(signal: AbortSignal): Promise<void> {
    throwIfExportCancelled(signal);
    if (!this.confirmationOpen) return Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const abort = () => {
        this.waiters.delete(waiter);
        reject(new ExportCancelledError());
      };
      const waiter: ExportPauseWaiter = {
        resolve,
        reject,
        removeAbortListener: () => signal.removeEventListener("abort", abort),
      };
      this.waiters.add(waiter);
      signal.addEventListener("abort", abort, { once: true });

      // The Human may have resumed between the initial check and registration.
      if (!this.confirmationOpen) {
        this.waiters.delete(waiter);
        waiter.removeAbortListener();
        resolve();
      }
    });
  }

  private releaseWaiters(): void {
    for (const waiter of this.waiters) {
      waiter.removeAbortListener();
      waiter.resolve();
    }
    this.waiters.clear();
  }

  private rejectWaiters(): void {
    for (const waiter of this.waiters) {
      waiter.removeAbortListener();
      waiter.reject(new ExportCancelledError());
    }
    this.waiters.clear();
  }

  get isActive(): boolean {
    return this.controller !== null;
  }

  get isConfirmationOpen(): boolean {
    return this.confirmationOpen;
  }

  get state(): ExportCancellationState {
    return this.currentState;
  }
}
