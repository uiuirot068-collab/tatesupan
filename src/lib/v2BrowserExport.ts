import type { PaintPlan, PublicationFontResource } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import type { PublicationPdfMode } from "../../typesetting-v2/renderer/publication/pdfOutputGeometry";
import { withBasePath } from "./basePath";
import { createV2PdfWorkerStartMessage } from "./v2PdfWorkerContract";

export const V2_PUBLICATION_FONT_PATH = "/fonts/ShipporiMincho-Regular.ttf";

/**
 * TSP-PHASE13-001: fonts PDF export can embed — one per Editor font choice
 * (`FONT_FAMILY_OPTIONS`). JPG already rasterizes with the browser's webfont.
 * Any other family (the system「serif」stack) falls back to Shippori Mincho,
 * which is also the font Core measures layout with.
 */
export interface PublicationFontAsset {
  /** First family name of the Editor's CSS value, e.g. "Zen Old Mincho". */
  cssName: string;
  path: string;
  fileName: string;
  fontName: string;
}

const SHIPPORI_ASSET: PublicationFontAsset = {
  cssName: "Shippori Mincho",
  path: V2_PUBLICATION_FONT_PATH,
  fileName: "ShipporiMincho-Regular.ttf",
  fontName: "Shippori Mincho",
};

export const PUBLICATION_FONT_ASSETS: readonly PublicationFontAsset[] = [
  SHIPPORI_ASSET,
  { cssName: "Zen Old Mincho", path: "/fonts/ZenOldMincho-Regular.ttf", fileName: "ZenOldMincho-Regular.ttf", fontName: "Zen Old Mincho" },
  { cssName: "Noto Serif JP", path: "/fonts/NotoSerifJP-Regular.ttf", fileName: "NotoSerifJP-Regular.ttf", fontName: "Noto Serif JP" },
  { cssName: "Noto Sans JP", path: "/fonts/NotoSansJP-Regular.ttf", fileName: "NotoSansJP-Regular.ttf", fontName: "Noto Sans JP" },
];

/** The embeddable font for a CSS font-family value (first family wins; unknown → Shippori Mincho). */
export function publicationFontAssetFor(cssFamily: string | undefined): PublicationFontAsset {
  const first = (cssFamily ?? "").split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";
  return PUBLICATION_FONT_ASSETS.find((asset) => asset.cssName === first) ?? SHIPPORI_ASSET;
}

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

const fontBytesPromises = new Map<string, Promise<Uint8Array>>();
const fontPromises = new Map<string, Promise<PublicationFontResource>>();

/** Font bytes (fetched once per file). Without an argument: Shippori Mincho, Core's measurement font. */
export function loadV2FontBytes(asset: PublicationFontAsset = SHIPPORI_ASSET): Promise<Uint8Array> {
  let pending = fontBytesPromises.get(asset.path);
  if (!pending) {
    pending = fetch(withBasePath(asset.path))
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${asset.fontName} font unavailable (${response.status}). Retry after the asset is restored.`);
        }
        return response.arrayBuffer();
      })
      .then((buffer) => new Uint8Array(buffer));
    pending.catch(() => fontBytesPromises.delete(asset.path));
    fontBytesPromises.set(asset.path, pending);
  }
  return pending;
}

/** The PDF font resource for a CSS font-family value (Shippori Mincho when omitted or not embeddable). */
export function loadV2PublicationFont(cssFamily?: string): Promise<PublicationFontResource> {
  const asset = publicationFontAssetFor(cssFamily);
  let pending = fontPromises.get(asset.path);
  if (!pending) {
    pending = loadV2FontBytes(asset).then((bytes) => ({
      fileName: asset.fileName,
      fontName: asset.fontName,
      base64: bytesToBase64(bytes),
    }));
    pending.catch(() => fontPromises.delete(asset.path));
    fontPromises.set(asset.path, pending);
  }
  return pending;
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
  mode: PublicationPdfMode,
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
  worker.postMessage(createV2PdfWorkerStartMessage(plan, font, mode));
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
