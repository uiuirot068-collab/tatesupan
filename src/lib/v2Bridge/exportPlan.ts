/**
 * V2 export plan preparation (Phase 3 export hardening) — pure steps applied
 * to the Publication PaintPlan before JPG/ZIP/PDF execution.
 *
 * 1. Layer order: the Editor's per-image front/back rank
 *    (`ImageRecord.layerOrder` → `imageLayerOrder`) was honoured by the Preview
 *    overlay (`PageCard` orderedByLayer → z-index) but ignored by export. Paint
 *    order is z-order in PDF/Canvas, so image commands on a page are re-ordered
 *    back-to-front with the SAME key the Preview uses (`layerOrder[id] ?? token
 *    order`). Only image commands move, and only among their own slots — text
 *    and every other command keep their positions.
 * 2. Grayscale: TateSpun publication output is monochrome. The LEGACY PDF was
 *    DeviceGray by 正式仕様 (`utils/exportPdf.ts` canvasToGrayscalePng), and
 *    LEGACY JPGs captured Preview images drawn with `filter: grayscale(100%)`.
 *    V2 embedded the original colour bytes — a regression. Images are
 *    converted to a 1-channel (or gray+alpha) PNG with the same luminance
 *    formula, so jsPDF embeds DeviceGray and the rasterizers draw gray.
 */
import { encode } from "fast-png";
import type { PaintCommand, PaintPagePlan, PaintPlan } from "../../../typesetting-v2/renderer/publication/pdfGenerator";

type ImageCommand = Extract<PaintCommand, { op: "image" }>;

export function applyImageLayerOrder(plan: PaintPlan, layerOrder: Record<string, number> | undefined): PaintPlan {
  if (!layerOrder || Object.keys(layerOrder).length === 0) return plan;
  return plan.map((page) => applyPageImageLayerOrder(page, layerOrder));
}

/** `applyImageLayerOrder` for one page (Phase 9: export builds and paints page by page). */
export function applyPageImageLayerOrder(page: PaintPagePlan, layerOrder: Record<string, number> | undefined): PaintPagePlan {
  if (!layerOrder || Object.keys(layerOrder).length === 0) return page;
  const slots: number[] = [];
  const images: Array<{ command: ImageCommand; tokenOrder: number }> = [];
  page.commands.forEach((command, index) => {
    if (command.op === "image" && command.refId !== undefined) {
      slots.push(index);
      images.push({ command, tokenOrder: images.length });
    }
  });
  if (images.length < 2) return page;
  const rank = (entry: { command: ImageCommand; tokenOrder: number }) => layerOrder[entry.command.refId!] ?? entry.tokenOrder;
  const sorted = [...images].sort((a, b) => rank(a) - rank(b) || a.tokenOrder - b.tokenOrder);
  if (sorted.every((entry, i) => entry === images[i])) return page;
  const commands = page.commands.slice();
  slots.forEach((slot, i) => {
    commands[slot] = sorted[i].command;
  });
  return { ...page, commands };
}

/**
 * RGBA pixels → grayscale PNG. Luminance is the LEGACY DeviceGray formula
 * (0.299 R + 0.587 G + 0.114 B). Alpha is kept (gray+alpha) only when some
 * pixel is not fully opaque, so opaque images stay true 1-channel DeviceGray.
 */
export function rgbaToGrayscalePng(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Uint8Array {
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) {
    if (rgba[i] !== 255) {
      opaque = false;
      break;
    }
  }
  const channels = opaque ? 1 : 2;
  const out = new Uint8Array(width * height * channels);
  for (let src = 0, dst = 0; src < rgba.length; src += 4, dst += channels) {
    out[dst] = Math.round(0.299 * rgba[src] + 0.587 * rgba[src + 1] + 0.114 * rgba[src + 2]);
    if (!opaque) out[dst + 1] = rgba[src + 3];
  }
  return encode({ width, height, channels, depth: 8, data: out });
}

export type RgbaDecoder = (bytes: Uint8Array, format: "JPEG" | "PNG") => Promise<{ data: Uint8Array | Uint8ClampedArray; width: number; height: number }>;

/** Replaces every image command's bytes with grayscale PNG bytes (each distinct image converted once). */
export async function grayscalePlanImages(plan: PaintPlan, decode: RgbaDecoder): Promise<PaintPlan> {
  const toGrayPage = createPageGrayscaler(decode);
  return Promise.all(plan.map(toGrayPage));
}

/**
 * Phase 9: `grayscalePlanImages` one page at a time. The returned function
 * keeps one conversion per distinct image bytes object for its lifetime, so
 * an image repeated on many pages is converted once.
 */
export function createPageGrayscaler(decode: RgbaDecoder): (page: PaintPagePlan) => Promise<PaintPagePlan> {
  const converted = new Map<Uint8Array, Promise<Uint8Array>>();
  const toGray = (command: ImageCommand) => {
    let pending = converted.get(command.bytes);
    if (!pending) {
      pending = decode(command.bytes, command.format).then(({ data, width, height }) => rgbaToGrayscalePng(data, width, height));
      converted.set(command.bytes, pending);
    }
    return pending;
  };
  return async (page) => {
    if (!page.commands.some((command) => command.op === "image")) return page;
    const commands = await Promise.all(
      page.commands.map(async (command): Promise<PaintCommand> =>
        command.op === "image" ? { ...command, bytes: await toGray(command), format: "PNG" } : command
      )
    );
    return { ...page, commands };
  };
}

/** Browser decoder: the image's own pixels at native size, no scaling. */
export const decodeImageInBrowser: RgbaDecoder = async (bytes, format) => {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: format === "PNG" ? "image/png" : "image/jpeg" }));
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像をグレースケールに変換できませんでした（2D context unavailable）。");
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { data, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
};

/**
 * Worker decoder (Phase 9 export worker): `decodeImageInBrowser` on an
 * OffscreenCanvas — the same native-size draw and `getImageData` read.
 */
export const decodeImageInWorker: RgbaDecoder = async (bytes, format) => {
  const bitmap = await createImageBitmap(new Blob([bytes as BlobPart], { type: format === "PNG" ? "image/png" : "image/jpeg" }));
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("画像をグレースケールに変換できませんでした（2D context unavailable）。");
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { data, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
};

/**
 * One reusable export plan per (composition, font, layer order): all three are
 * immutable per revision (a new composition is a new object), so reference
 * identity is a reliable invalidation key — no content hashing needed.
 */
export class ExportPlanCache<Key extends object[]> {
  private entry: { keys: Key; plan: Promise<PaintPlan> } | null = null;

  get(keys: Key, build: () => Promise<PaintPlan>): Promise<PaintPlan> {
    if (this.entry && this.entry.keys.length === keys.length && this.entry.keys.every((key, i) => key === keys[i])) {
      return this.entry.plan;
    }
    const plan = build();
    this.entry = { keys, plan };
    plan.catch(() => {
      if (this.entry?.plan === plan) this.entry = null;
    });
    return plan;
  }
}
