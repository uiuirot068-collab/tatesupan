/**
 * Phase 7: one reusable V2 Preview layout worker per PreviewPane lifetime.
 *
 * Before, every composition created a new Worker. Each new worker re-fetched,
 * hashed and parsed the measurement font before it could compose, and the
 * WHOLE image pool (every document's data URLs) was cloned into it and
 * decoded there. Now:
 *  - an IDLE worker is reused, so its font/provider cache survives;
 *  - a worker still composing an older request is TERMINATED and replaced.
 *    A synchronous composition cannot be interrupted inside the worker, so
 *    this keeps the previous "new input cancels the old composition" latency;
 *  - every request carries a monotonically increasing id. Only the latest
 *    request that has not been cancelled is ever delivered, so a stale layout
 *    can never overwrite a newer one (also across documents);
 *  - a worker that reported an error or crashed is never reused;
 *  - `dispose()` terminates it (unmount). A later request lazily creates a new
 *    one, which keeps React StrictMode's cleanup + re-setup safe.
 *
 * `referencedImages` trims the payload to the images the manuscript can
 * reference (same marker scan as the tokenizer).
 */
import { imageMarkerIds } from "../tategaki";

export interface PreviewWorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface PreviewWorkerReply {
  type: "complete" | "error";
  requestId?: number;
  message?: string;
  [key: string]: unknown;
}

export type PreviewWorkerOutcome =
  | { ok: true; reply: PreviewWorkerReply }
  | { ok: false; message: string };

export class ReusablePreviewWorker {
  private worker: PreviewWorkerLike | null = null;
  private latestRequestId = 0;
  private inFlight: { id: number; deliver: (outcome: PreviewWorkerOutcome) => void } | null = null;
  /** Diagnostics for tests and the Phase 7 benchmark. */
  workersCreated = 0;
  requestsSent = 0;

  constructor(private readonly createWorker: () => PreviewWorkerLike) {}

  /**
   * Posts `{ type: "compose", requestId, input }`. `deliver` runs at most once,
   * only for the latest request and only until the returned cancel is called.
   */
  request(input: unknown, deliver: (outcome: PreviewWorkerOutcome) => void): () => void {
    const id = ++this.latestRequestId;
    if (this.inFlight) this.discardWorker(); // busy with a superseded composition
    const worker = this.ensureWorker();
    let active = true;
    this.inFlight = {
      id,
      deliver: (outcome) => {
        if (!active) return;
        active = false;
        deliver(outcome);
      },
    };
    this.requestsSent += 1;
    worker.postMessage({ type: "compose", requestId: id, input });
    return () => {
      active = false;
    };
  }

  dispose(): void {
    this.latestRequestId += 1;
    this.inFlight = null;
    this.discardWorker();
  }

  get isComposing(): boolean {
    return this.inFlight !== null;
  }

  private ensureWorker(): PreviewWorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    this.workersCreated += 1;
    worker.onmessage = (event: MessageEvent) => this.handleReply(worker, event.data as PreviewWorkerReply);
    worker.onerror = (event: ErrorEvent) => this.handleCrash(worker, event?.message || "Preview worker failed");
    this.worker = worker;
    return worker;
  }

  private handleReply(worker: PreviewWorkerLike, reply: PreviewWorkerReply): void {
    if (worker !== this.worker) return;
    const inFlight = this.inFlight;
    if (!inFlight || reply.requestId !== inFlight.id) return; // stale reply
    this.inFlight = null;
    if (reply.type === "complete") {
      inFlight.deliver({ ok: true, reply });
      return;
    }
    this.discardWorker(); // never reuse a worker that failed
    inFlight.deliver({ ok: false, message: reply.message ?? "Preview worker failed" });
  }

  private handleCrash(worker: PreviewWorkerLike, message: string): void {
    if (worker !== this.worker) return;
    const inFlight = this.inFlight;
    this.inFlight = null;
    this.discardWorker();
    inFlight?.deliver({ ok: false, message });
  }

  private discardWorker(): void {
    const worker = this.worker;
    this.worker = null;
    this.inFlight = null;
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }
}

/** The subset of `images` whose ids appear as 挿絵 markers in `content`. */
export function referencedImages(
  images: Readonly<Record<string, string>>,
  content: string
): Record<string, string> {
  const picked: Record<string, string> = {};
  for (const id of imageMarkerIds(content)) {
    if (Object.hasOwn(picked, id) || !Object.hasOwn(images, id)) continue;
    picked[id] = images[id];
  }
  return picked;
}
