/**
 * CST-PORT-012: one preview page → an image for the 3D book.
 *
 * TateSpun pages are heavy DOM (縦書き組版), so the 3D book never renders
 * page components itself. It photographs the two pages it shows with the
 * same capture the JPG/PDF export uses (`capturePageToCanvas`: the page as
 * the preview draws it, editor chrome and guides left out), crops it to the
 * 仕上がり線 like the print JPG, shrinks it to a texture size and hands back
 * an object URL. Every curl strip of the 3D page then reuses that one image.
 *
 * Preview only: nothing here is exported or saved.
 */
import { capturePageToCanvas, measureCaptureSize, measureTrimGuideRatioRect } from "./exportCapture";

/** Long side of a page texture (CSS px of the 3D book are ~300–700). */
export const BOOK3D_PAGE_TEXTURE_LONG_SIDE_PX = 1100;

function cropAndResize(source: HTMLCanvasElement, crop: { x: number; y: number; width: number; height: number }, longSide: number) {
  const scale = Math.min(1, longSide / Math.max(crop.width, crop.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(crop.width * scale));
  canvas.height = Math.max(1, Math.round(crop.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas を使えません。");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("画像を作れませんでした。"))), "image/jpeg", 0.9);
  });
}

/**
 * Captures the page wrapper `element` (anything containing one `.page-card`)
 * and returns an object URL of its trim area. The caller revokes it.
 */
export async function capturePreviewPageTexture(element: HTMLElement): Promise<string> {
  const { width, height } = measureCaptureSize(element);
  const trim = measureTrimGuideRatioRect(element);
  const longSide = Math.max(1, width, height);
  // enough pixels for the cropped trim area to reach the texture size
  const pixelRatio = Math.min(3, Math.max(1, (BOOK3D_PAGE_TEXTURE_LONG_SIDE_PX * 1.1) / longSide));
  const captured = await capturePageToCanvas(element, { pixelRatio });
  let texture: HTMLCanvasElement | null = null;
  try {
    const crop = trim
      ? {
          x: Math.round(captured.width * trim.xRatio),
          y: Math.round(captured.height * trim.yRatio),
          width: Math.max(1, Math.round(captured.width * trim.widthRatio)),
          height: Math.max(1, Math.round(captured.height * trim.heightRatio)),
        }
      : { x: 0, y: 0, width: captured.width, height: captured.height };
    crop.width = Math.min(crop.width, captured.width - crop.x);
    crop.height = Math.min(crop.height, captured.height - crop.y);
    texture = cropAndResize(captured, crop, BOOK3D_PAGE_TEXTURE_LONG_SIDE_PX);
    return URL.createObjectURL(await toBlob(texture));
  } finally {
    captured.width = 0;
    captured.height = 0;
    if (texture) {
      texture.width = 0;
      texture.height = 0;
    }
  }
}
