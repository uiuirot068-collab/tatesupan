import type { PaintPlan, PublicationFontResource } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import { withBasePath } from "./basePath";

export const V2_PUBLICATION_FONT_PATH = "/fonts/ShipporiMincho-Regular.ttf";

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

let fontBytesPromise: Promise<Uint8Array> | null = null;
let fontPromise: Promise<PublicationFontResource> | null = null;

export function loadV2FontBytes(): Promise<Uint8Array> {
  fontBytesPromise ??= fetch(withBasePath(V2_PUBLICATION_FONT_PATH))
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Shippori Mincho font unavailable (${response.status}). Retry after the asset is restored.`);
      }
      return response.arrayBuffer();
    })
    .then((buffer) => new Uint8Array(buffer))
    .catch((error: unknown) => {
      fontBytesPromise = null;
      throw error;
    });
  return fontBytesPromise;
}

export function loadV2PublicationFont(): Promise<PublicationFontResource> {
  fontPromise ??= loadV2FontBytes()
    .then((bytes) => ({
      fileName: "ShipporiMincho-Regular.ttf",
      fontName: "Shippori Mincho",
      base64: bytesToBase64(bytes),
    }))
    .catch((error: unknown) => {
      fontPromise = null;
      throw error;
    });
  return fontPromise;
}

export interface WorkerPdfProgress {
  current: number;
  total: number;
}

export interface WorkerPdfHandle {
  result: Promise<Uint8Array>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

export function startV2PdfWorker(
  plan: PaintPlan,
  font: PublicationFontResource,
  onProgress: (progress: WorkerPdfProgress) => void
): WorkerPdfHandle {
  const worker = new Worker(new URL("../workers/v2Pdf.worker.ts", import.meta.url), { type: "module" });
  let settled = false;
  let rejectResult: (reason?: unknown) => void = () => undefined;
  const result = new Promise<Uint8Array>((resolve, reject) => {
    rejectResult = reject;
    worker.onmessage = (event: MessageEvent<{ type: string; current?: number; total?: number; bytes?: Uint8Array; message?: string }>) => {
      const message = event.data;
      if (message.type === "progress") onProgress({ current: message.current ?? 0, total: message.total ?? plan.length });
      if (message.type === "complete" && message.bytes) {
        settled = true;
        worker.terminate();
        resolve(message.bytes);
      }
      if (message.type === "cancelled") {
        settled = true;
        worker.terminate();
        reject(new DOMException("Export cancelled", "AbortError"));
      }
      if (message.type === "error") {
        settled = true;
        worker.terminate();
        reject(new Error(message.message ?? "PDF export failed"));
      }
    };
    worker.onerror = (event) => {
      settled = true;
      worker.terminate();
      reject(new Error(event.message || "PDF worker failed"));
    };
  });
  worker.postMessage({ type: "start", plan, font });
  return {
    result,
    pause: () => worker.postMessage({ type: "pause" }),
    resume: () => worker.postMessage({ type: "resume" }),
    cancel: () => {
      if (settled) return;
      settled = true;
      worker.postMessage({ type: "cancel" });
      worker.terminate();
      rejectResult(new DOMException("Export cancelled", "AbortError"));
    },
  };
}

export function downloadBytes(bytes: Uint8Array, fileName: string, type: string): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
