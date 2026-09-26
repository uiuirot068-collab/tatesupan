/**
 * TateSpun Live Editor -> v2 Publication Bridge: image resolver adapter.
 *
 * Maps the real Editor's `images: Record<string,string>` (id -> dataURL,
 * `TategakiEditor.tsx`'s own real state shape) onto v2 Publication's
 * existing `ImageResolver` contract (`renderer/publication/paintModel.ts`,
 * Step 3, already built and Human-approved) -- reused unchanged here, not
 * bypassed or reimplemented.
 *
 * Browser-only (uses `atob`/`createImageBitmap`, the same real technique
 * `rasterGeneratorBrowser.ts` already uses to decode images) -- this is
 * the natural, already-established way images get decoded client-side in
 * this codebase, not a new invented path. `ImageResolver` itself is
 * synchronous (`(refId) => ImageResolution`), so this module pre-resolves
 * every image ASYNCHRONOUSLY once (decoding real pixel dimensions via a
 * real image decode), then returns a plain synchronous lookup closure --
 * no image resolution decision is deferred to paint time.
 */
import type { ImageResolution, ImageResolver } from "../../../typesetting-v2/renderer/publication/paintModel";

function parseDataUrl(dataUrl: string): { format: "PNG" | "JPEG"; detectedFormat?: string; bytes: Uint8Array } | null {
  const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  // A malformed base64 body is ONE corrupt image (-> CORRUPT), not a failure
  // of the whole composition: atob throws, which used to reject every image
  // and put the entire Preview on V2 HOLD (found by the Phase 7 benchmark).
  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (mime === "image/png") return { format: "PNG", bytes };
  if (mime === "image/jpeg" || mime === "image/jpg") return { format: "JPEG", bytes };
  return { format: "PNG", detectedFormat: mime, bytes }; // format value unused when detectedFormat is set (see caller)
}

/**
 * Phase 7: per-worker decode cache. The reusable Preview worker keeps one;
 * an image whose data URL is unchanged since the last composition is not
 * parsed or decoded again. Entries for ids no longer sent are dropped, so it
 * holds only the current manuscript's images.
 */
export type ImageResolutionCache = Map<string, { dataUrl: string; resolution: ImageResolution }>;

/**
 * Pre-resolves every real image (real bytes, real decoded pixel
 * dimensions) and returns a synchronous `ImageResolver` closure over the
 * results. Never throws for a single bad image -- an unparseable/corrupt/
 * undecodable dataURL becomes a real, structured MISSING/UNSUPPORTED_FORMAT/
 * CORRUPT resolution for that one refId (INV-010: no silent success), the
 * SAME failure-handling contract Step 3's own pre-flight check already
 * enforces downstream in `generatePublicationPdf`/`generatePublicationJpgPages`.
 */
export async function prepareImageResolver(images: Record<string, string>, cache?: ImageResolutionCache): Promise<ImageResolver> {
  const resolved = new Map<string, ImageResolution>();
  const remember = (id: string, dataUrl: string, resolution: ImageResolution) => {
    resolved.set(id, resolution);
    cache?.set(id, { dataUrl, resolution });
  };

  await Promise.all(
    Object.entries(images).map(async ([id, dataUrl]) => {
      const cached = cache?.get(id);
      if (cached && cached.dataUrl === dataUrl) {
        resolved.set(id, cached.resolution);
        return;
      }
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) {
        remember(id, dataUrl, { kind: "CORRUPT" });
        return;
      }
      if (parsed.detectedFormat) {
        remember(id, dataUrl, { kind: "UNSUPPORTED_FORMAT", detectedFormat: parsed.detectedFormat });
        return;
      }
      try {
        const bitmap = await createImageBitmap(new Blob([parsed.bytes as BlobPart]));
        remember(id, dataUrl, { kind: "RESOLVED", url: `local-editor-image://${id}`, bytes: parsed.bytes, format: parsed.format, pixelWidth: bitmap.width, pixelHeight: bitmap.height });
        bitmap.close();
      } catch {
        remember(id, dataUrl, { kind: "CORRUPT" });
      }
    })
  );
  if (cache) {
    for (const id of cache.keys()) if (!Object.hasOwn(images, id)) cache.delete(id);
  }

  return (refId: string): ImageResolution => resolved.get(refId) ?? { kind: "MISSING" };
}
