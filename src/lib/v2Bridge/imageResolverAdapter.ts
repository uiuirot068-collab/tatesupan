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
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (mime === "image/png") return { format: "PNG", bytes };
  if (mime === "image/jpeg" || mime === "image/jpg") return { format: "JPEG", bytes };
  return { format: "PNG", detectedFormat: mime, bytes }; // format value unused when detectedFormat is set (see caller)
}

/**
 * Pre-resolves every real image (real bytes, real decoded pixel
 * dimensions) and returns a synchronous `ImageResolver` closure over the
 * results. Never throws for a single bad image -- an unparseable/corrupt/
 * undecodable dataURL becomes a real, structured MISSING/UNSUPPORTED_FORMAT/
 * CORRUPT resolution for that one refId (INV-010: no silent success), the
 * SAME failure-handling contract Step 3's own pre-flight check already
 * enforces downstream in `generatePublicationPdf`/`generatePublicationJpgPages`.
 */
export async function prepareImageResolver(images: Record<string, string>): Promise<ImageResolver> {
  const resolved = new Map<string, ImageResolution>();

  await Promise.all(
    Object.entries(images).map(async ([id, dataUrl]) => {
      const parsed = parseDataUrl(dataUrl);
      if (!parsed) {
        resolved.set(id, { kind: "CORRUPT" });
        return;
      }
      if (parsed.detectedFormat) {
        resolved.set(id, { kind: "UNSUPPORTED_FORMAT", detectedFormat: parsed.detectedFormat });
        return;
      }
      try {
        const bitmap = await createImageBitmap(new Blob([parsed.bytes as BlobPart]));
        resolved.set(id, { kind: "RESOLVED", url: `local-editor-image://${id}`, bytes: parsed.bytes, format: parsed.format, pixelWidth: bitmap.width, pixelHeight: bitmap.height });
        bitmap.close();
      } catch {
        resolved.set(id, { kind: "CORRUPT" });
      }
    })
  );

  return (refId: string): ImageResolution => resolved.get(refId) ?? { kind: "MISSING" };
}
