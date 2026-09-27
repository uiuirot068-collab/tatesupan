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
 *
 * Phase 8: `requestPublication` asks the worker for one layout's export-only
 * publication model (previewWorkerProtocol.ts). An export request is never
 * cancelled by typing: while one is pending, a newer composition is queued
 * behind it on the same worker instead of terminating the worker, and the
 * superseded composition's reply is ignored as before.
 *
 * Phase 9: `deliverPublication` sends the model to a `MessagePort` (the
   * export worker's) instead of back here. It counts as a pending export for
 * the rule above.
 */
import { imageMarkerIds } from "../tategaki";
import type { PhysicalPageRef } from "../../../typesetting-v2/core/layout/schema";
import type { PreviewWorkerInput, V2PublicationModel } from "./previewWorkerProtocol";

export interface PreviewWorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface PreviewWorkerReply {
  type: "complete" | "publication" | "error";
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
  private publications = new Map<number, { resolve: (publication: V2PublicationModel | undefined) => void; reject: (error: Error) => void; delivery: boolean }>();
  /** Diagnostics for tests and the Phase 7 benchmark. */
  workersCreated = 0;
  requestsSent = 0;

  constructor(private readonly createWorker: () => PreviewWorkerLike) {}

  /**
   * Posts `{ type: "compose", requestId, input, ...fields }` (Phase 9: `basePreviewLayoutId`). `deliver` runs at most once,
   * only for the latest request and only until the returned cancel is called.
   */
  request(input: unknown, deliver: (outcome: PreviewWorkerOutcome) => void, fields?: Record<string, unknown>): () => void {
    const id = ++this.latestRequestId;
    if (this.inFlight) {
      // Busy with a superseded composition: replace the worker, unless an
      // export is waiting on it (then queue behind; the old reply is ignored).
      if (this.publications.size === 0) this.discardWorker();
      else this.inFlight = null;
    }
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
    worker.postMessage({ type: "compose", requestId: id, input, ...fields });
    return () => {
      active = false;
    };
  }

  /**
   * The export-only publication model of the layout `layoutId` (Phase 8).
   * `input` and `pageSequence` are that layout's exact input and pages: the
   * worker recomposes from them only if it no longer holds the layout.
   */
  requestPublication(layoutId: number, pageSequence: readonly PhysicalPageRef[], input: PreviewWorkerInput): Promise<V2PublicationModel> {
    return this.postPublication({ layoutId, pageSequence, input }, false) as Promise<V2PublicationModel>;
  }

  /**
   * Phase 9: posts the same model to `port` (transferred) instead of
   * replying with it. Resolves once the worker has posted it there; rejects
   * as `requestPublication` would (the port then gets `{ ok: false }`).
   */
  deliverPublication(layoutId: number, pageSequence: readonly PhysicalPageRef[], input: PreviewWorkerInput, port: MessagePort): Promise<void> {
    return this.postPublication({ layoutId, pageSequence, input, port }, true).then(() => undefined);
  }

  private postPublication(fields: Record<string, unknown>, delivery: boolean): Promise<V2PublicationModel | undefined> {
    const id = ++this.latestRequestId;
    const worker = this.ensureWorker();
    return new Promise<V2PublicationModel | undefined>((resolve, reject) => {
      this.publications.set(id, { resolve, reject, delivery });
      this.requestsSent += 1;
      const port = fields.port as MessagePort | undefined;
      worker.postMessage({ type: "publication", requestId: id, ...fields }, port ? [port] : undefined);
    });
  }

  dispose(): void {
    this.latestRequestId += 1;
    this.inFlight = null;
    this.discardWorker();
  }

  get pendingPublicationCount(): number {
    return this.publications.size;
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
    const publication = reply.requestId === undefined ? undefined : this.publications.get(reply.requestId);
    if (publication) {
      this.publications.delete(reply.requestId!);
      if (reply.type === "publication" && (publication.delivery ? reply.delivered === true : reply.publication !== undefined)) {
        publication.resolve(reply.publication as V2PublicationModel | undefined);
      } else publication.reject(new Error(reply.message ?? "V2 export: the publication model could not be built."));
      return;
    }
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
    const publications = [...this.publications.values()];
    this.publications.clear();
    publications.forEach((publication) => publication.reject(new Error("V2 export: the Preview worker stopped.")));
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
