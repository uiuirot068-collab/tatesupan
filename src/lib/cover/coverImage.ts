/**
 * CST-PORT-011: 表紙に敷く画像の読み込み（ブラウザ専用）。
 *
 * PNG / JPG / WebP / PSD を受け付け、IndexedDB に入れる dataUrl にする。
 * 印刷に要る大きさ（B5 の1面を 350dpi で約2600×3700px）を大きく超える画像は、
 * 長い辺を COVER_IMAGE_MAX_EDGE_PX まで縮めて保存容量を抑える。
 */
import { loadImageNaturalSizePx, readFileAsDataUrl } from "../image";
import { convertPsdToPngDataUrl } from "../../utils/psdConverter";

export const COVER_IMAGE_MAX_EDGE_PX = 4000;

export const COVER_IMAGE_ACCEPT =
  ".png,.jpg,.jpeg,.webp,.psd,image/png,image/jpeg,image/webp,image/vnd.adobe.photoshop";

export function isSupportedCoverImageFile(file: File): boolean {
  return /\.(png|jpe?g|webp|psd)$/i.test(file.name) || /^image\/(png|jpeg|webp|vnd\.adobe\.photoshop)$/.test(file.type);
}

export type PreparedCoverImage = {
  dataUrl: string;
  width: number;
  height: number;
  mimeType: string;
  fileName: string;
};

function resizeDataUrl(dataUrl: string, width: number, height: number, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("画像を縮小できませんでした。"));
        return;
      }
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, width, height);
      resolve(mimeType === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.92));
    };
    image.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
    image.src = dataUrl;
  });
}

export async function prepareCoverImage(file: File): Promise<PreparedCoverImage> {
  if (!isSupportedCoverImageFile(file)) {
    throw new Error("PNG / JPG / JPEG / WebP / PSD を選択してください。");
  }
  const isPsd = /\.psd$/i.test(file.name) || file.type === "image/vnd.adobe.photoshop";
  let dataUrl = isPsd ? await convertPsdToPngDataUrl(file) : await readFileAsDataUrl(file);
  let mimeType = isPsd ? "image/png" : file.type || "image/png";
  let { width, height } = await loadImageNaturalSizePx(dataUrl);
  const longest = Math.max(width, height);
  if (longest > COVER_IMAGE_MAX_EDGE_PX) {
    const scale = COVER_IMAGE_MAX_EDGE_PX / longest;
    width = Math.round(width * scale);
    height = Math.round(height * scale);
    mimeType = mimeType === "image/png" ? "image/png" : "image/jpeg";
    dataUrl = await resizeDataUrl(dataUrl, width, height, mimeType);
  }
  return { dataUrl, width, height, mimeType, fileName: file.name };
}

export function createCoverImageId(side: "front" | "back"): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `cover-${side}-${Date.now().toString(36)}-${random}`;
}
