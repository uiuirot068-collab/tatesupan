/**
 * Phase 9: the main thread's side of the V2 export worker
 * (exportWorkerProtocol.ts). One client per PreviewPane lifetime.
 *
 *  - The worker is created on the first export and reused, so its font and
 *    paint contexts survive between exports.
 *  - The worker keeps the publication model of the last exported layout. An
 *    export of another layout (compared by identity: a layout object is one
 *    exact composition input, Phase 3) opens a MessageChannel and asks the
 *    Preview worker to deliver that layout's model to the export worker.
 *  - PDF: `startPdf` runs one job; the worker builds and paints every page.
 *  - JPG: `openPages` returns a stream the rasterizer pulls one built page at
 *    a time from (one request in flight, so memory stays bounded).
 *  - One export at a time. Cancelling a PDF terminates the worker (as the PDF
 *    worker did before), and so does an error or crash: a worker that failed
 *    is never reused. The next export creates a new one. Closing a page
 *    stream keeps the worker.
 *  - `dispose()` on unmount terminates it and rejects whatever is running.
 */
import type { PublicationPdfMode } from "../../../typesetting-v2/renderer/publication/pdfOutputGeometry";
import type { PaintPagePlan } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import type { WorkerPdfHandle, WorkerPdfProgress } from "../v2BrowserExport";
import type { ExportWorkerReply } from "./exportWorkerProtocol";

export interface ExportWorkerLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
}

export interface ChannelLike {
  port1: MessagePort;
  port2: MessagePort;
}

export interface ExportModelSource {
  /** The exact layout the export resolved; identity decides whether the worker's model is current. */
  layout: object;
  /** Asks the Preview worker to post `layout`'s publication model to `port`. */
  deliverModel: (port: MessagePort) => Promise<void>;
  layerOrder: Record<string, number>;
}

export interface ExportPdfRequest extends ExportModelSource {
  physicalIndices: number[];
  mode: PublicationPdfMode;
  onProgress: (progress: WorkerPdfProgress) => void;
}

export interface ExportPageStream {
  /** The built page (layer order and grayscale applied) for one physical page index. */
  pageAt: (physicalIndex: number) => Promise<PaintPagePlan>;
  /** Ends the stream; pending pages reject as cancelled. The worker is kept. */
  close: () => void;
}

const cancelled = () => new DOMException("Export cancelled", "AbortError");

/**
 * Reads `physicalIndices` in order from `stream`, requesting the next page
 * while the current one is being rasterized (at most `1 + lookahead` pages
 * in flight), so the worker's build and transfer overlap the main thread's
 * painting instead of adding to it.
 */
export function readPagesAhead(stream: ExportPageStream, physicalIndices: readonly number[], lookahead = 1): (i: number) => Promise<PaintPagePlan> {
  const requested = new Map<number, Promise<PaintPagePlan>>();
  const request = (i: number) => {
    if (i >= physicalIndices.length || requested.has(i)) return;
    const page = stream.pageAt(physicalIndices[i]);
    page.catch(() => undefined); // a prefetched page may be abandoned (cancel, error); the reader sees the failure on its own request
    requested.set(i, page);
  };
  return (i) => {
    for (let ahead = 0; ahead <= lookahead; ahead += 1) request(i + ahead);
    const page = requested.get(i)!;
    requested.delete(i);
    return page;
  };
}

interface PdfJob {
  kind: "pdf";
  jobId: number;
  resolve: (bytes: Uint8Array) => void;
  reject: (error: unknown) => void;
  onProgress: (progress: WorkerPdfProgress) => void;
}

interface PageJob {
  kind: "pages";
  jobId: number;
  pending: Map<number, { resolve: (page: PaintPagePlan) => void; reject: (error: unknown) => void }>;
  failure: unknown;
}

export class V2ExportWorkerClient {
  private worker: ExportWorkerLike | null = null;
  private heldLayout: object | null = null;
  private active: PdfJob | PageJob | null = null;
  private nextJobId = 0;
  private nextRequestId = 0;
  /** Diagnostics for tests and the benchmark. */
  workersCreated = 0;
  modelsRequested = 0;

  constructor(
    private readonly createWorker: () => ExportWorkerLike,
    private readonly createChannel: () => ChannelLike = () => new MessageChannel()
  ) {}

  get isRunning(): boolean {
    return this.active !== null;
  }

  startPdf(request: ExportPdfRequest): WorkerPdfHandle {
    if (this.active) throw new Error("V2 export: another export is still running.");
    const jobId = ++this.nextJobId;
    const result = new Promise<Uint8Array>((resolve, reject) => {
      this.active = { kind: "pdf", jobId, resolve, reject, onProgress: request.onProgress };
    });
    const worker = this.ensureWorker();
    const modelPort = this.modelPortFor(request, jobId);
    worker.postMessage(
      {
        type: "pdf",
        jobId,
        ...(modelPort ? { modelPort } : {}),
        physicalIndices: [...request.physicalIndices],
        layerOrder: request.layerOrder,
        mode: request.mode,
      },
      modelPort ? [modelPort] : undefined
    );
    return {
      result,
      pause: () => this.control(jobId, { type: "pause" }),
      resume: () => this.control(jobId, { type: "resume" }),
      cancel: () => {
        if (this.active?.jobId !== jobId) return;
        this.worker?.postMessage({ type: "cancel" });
        this.finish(jobId, cancelled());
        this.discardWorker();
      },
    };
  }

  openPages(request: ExportModelSource): ExportPageStream {
    if (this.active) throw new Error("V2 export: another export is still running.");
    const jobId = ++this.nextJobId;
    const job: PageJob = { kind: "pages", jobId, pending: new Map(), failure: null };
    this.active = job;
    return {
      pageAt: (physicalIndex) => {
        if (this.active !== job) return Promise.reject(job.failure ?? cancelled());
        const worker = this.ensureWorker();
        const requestId = ++this.nextRequestId;
        const page = new Promise<PaintPagePlan>((resolve, reject) => job.pending.set(requestId, { resolve, reject }));
        const modelPort = this.modelPortFor(request, jobId);
        worker.postMessage(
          { type: "page", jobId, requestId, ...(modelPort ? { modelPort } : {}), physicalIndex, layerOrder: request.layerOrder },
          modelPort ? [modelPort] : undefined
        );
        return page;
      },
      close: () => this.finish(jobId, cancelled()),
    };
  }

  dispose(): void {
    const active = this.active;
    if (active) this.finish(active.jobId, cancelled());
    this.discardWorker();
  }

  /** A port for the model when the worker does not hold `request.layout`'s model yet. */
  private modelPortFor(request: ExportModelSource, jobId: number): MessagePort | undefined {
    if (this.heldLayout === request.layout) return undefined;
    const channel = this.createChannel();
    this.heldLayout = request.layout;
    this.modelsRequested += 1;
    // A delivery that never happens (the Preview worker stopped) would leave
    // the export worker waiting on the port: fail the export instead.
    request.deliverModel(channel.port1).catch((error: unknown) => this.fail(jobId, error));
    return channel.port2;
  }

  private control(jobId: number, message: { type: "pause" | "resume" }): void {
    if (this.active?.jobId === jobId) this.worker?.postMessage(message);
  }

  private ensureWorker(): ExportWorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    this.workersCreated += 1;
    worker.onmessage = (event: MessageEvent) => {
      if (worker === this.worker) this.handleReply(event.data as ExportWorkerReply);
    };
    worker.onerror = (event: ErrorEvent) => {
      if (worker !== this.worker) return;
      const jobId = this.active?.jobId;
      if (jobId !== undefined) this.fail(jobId, new Error(event?.message || "Export worker failed"));
      else this.discardWorker();
    };
    this.worker = worker;
    return worker;
  }

  private handleReply(reply: ExportWorkerReply): void {
    const active = this.active;
    if (!active || active.jobId !== reply.jobId) return; // a finished, cancelled or failed export
    if (reply.type === "error") {
      this.fail(reply.jobId, new Error(reply.message || "V2 export failed"));
      return;
    }
    if (active.kind === "pages") {
      if (reply.type !== "page") return;
      const pending = active.pending.get(reply.requestId);
      active.pending.delete(reply.requestId);
      pending?.resolve(reply.page);
      return;
    }
    if (reply.type === "progress") {
      active.onProgress({ current: reply.current, total: reply.total });
    } else if (reply.type === "complete") {
      this.active = null;
      active.resolve(reply.bytes);
    } else if (reply.type === "cancelled") {
      this.finish(reply.jobId, cancelled());
      this.discardWorker();
    }
  }

  private fail(jobId: number, error: unknown): void {
    if (this.active?.jobId !== jobId) return;
    this.finish(jobId, error);
    this.discardWorker(); // never reuse a worker that failed
  }

  /** Ends the active export with `error` (rejecting whatever is pending). */
  private finish(jobId: number, error: unknown): void {
    const active = this.active;
    if (!active || active.jobId !== jobId) return;
    this.active = null;
    if (active.kind === "pdf") {
      active.reject(error);
      return;
    }
    active.failure = error;
    const pending = [...active.pending.values()];
    active.pending.clear();
    pending.forEach((entry) => entry.reject(error));
  }

  private discardWorker(): void {
    const worker = this.worker;
    this.worker = null;
    this.heldLayout = null;
    if (!worker) return;
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  }
}
