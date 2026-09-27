/// <reference lib="webworker" />

import { decodeImageInWorker } from "../lib/v2Bridge/exportPlan";
import {
  ExportWorkerSession,
  receivePortMessage,
  type ExportPageRequest,
  type ExportPdfJob,
  type ExportWorkerReply,
  type ExportWorkerRequest,
} from "../lib/v2Bridge/exportWorkerProtocol";
import { loadV2PublicationFont } from "../lib/v2BrowserExport";

// Phase 9 (exportWorkerProtocol.ts): one export worker per PreviewPane,
// reused across exports. The font is fetched here once per worker lifetime
// (never posted from the main thread), and the publication model arrives
// from the Preview worker on a MessagePort.
const session = new ExportWorkerSession({ loadFont: loadV2PublicationFont, decode: decodeImageInWorker });

// PDF jobs and page requests, strictly in order.
let queue: Promise<void> = Promise.resolve();
let paused = false;
let cancelled = false;
let resumeWaiters: Array<() => void> = [];

function releaseWaiters(): void {
  const waiters = resumeWaiters;
  resumeWaiters = [];
  for (const resolve of waiters) resolve();
}

async function waitForPermission(): Promise<void> {
  if (cancelled) throw new DOMException("Export cancelled", "AbortError");
  if (paused) await new Promise<void>((resolve) => resumeWaiters.push(resolve));
  if (cancelled) throw new DOMException("Export cancelled", "AbortError");
}

function reply(message: ExportWorkerReply, transfer?: Transferable[]): void {
  self.postMessage(message, transfer ? { transfer } : undefined);
}

self.onmessage = (event: MessageEvent<ExportWorkerRequest>) => {
  const message = event.data;
  if (message.type === "pause") {
    paused = true;
    return;
  }
  if (message.type === "resume") {
    paused = false;
    releaseWaiters();
    return;
  }
  if (message.type === "cancel") {
    cancelled = true;
    paused = false;
    releaseWaiters();
    return;
  }

  // PDF jobs and page requests run strictly in order, so a request that
  // follows a model delivery always sees that model.
  queue = queue.then(() => (message.type === "pdf" ? runPdf(message) : runPage(message)));
};


async function receiveModelIfSent(port: MessagePort | undefined): Promise<void> {
  // Font load overlaps the model delivery.
  const font = session.font();
  if (port) session.receiveModel(await receivePortMessage(port));
  await font;
}

async function runPdf(job: ExportPdfJob): Promise<void> {
  paused = false;
  cancelled = false;
  const { jobId } = job;
  try {
    await receiveModelIfSent(job.modelPort);
    const result = await session.renderPdf(job, {
      beforePage: waitForPermission,
      onProgress: (current, total) => reply({ type: "progress", jobId, current, total }),
    });
    if (cancelled) return;
    reply({ type: "complete", jobId, bytes: result.bytes, pageCount: result.pageCount }, [result.bytes.buffer]);
  } catch (error: unknown) {
    if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
      reply({ type: "cancelled", jobId });
      return;
    }
    reply({ type: "error", jobId, message: error instanceof Error ? error.message : String(error) });
  }
}

async function runPage(request: ExportPageRequest): Promise<void> {
  try {
    await receiveModelIfSent(request.modelPort);
    const page = await session.rasterPage(request.physicalIndex, request.layerOrder);
    reply({ type: "page", jobId: request.jobId, requestId: request.requestId, page });
  } catch (error: unknown) {
    reply({ type: "error", jobId: request.jobId, message: error instanceof Error ? error.message : String(error) });
  }
}

export {};
