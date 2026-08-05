export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("ファイルの読み込みに失敗しました"));
    reader.readAsDataURL(file);
  });
}

function loadImageNaturalSizePx(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
    img.src = dataUrl;
  });
}

const PX_PER_MM_96DPI = 96 / 25.4;

/**
 * Computes a display size in mm for an uploaded image, preserving its aspect
 * ratio and shrinking it to fit within the given bounds (never upscaling).
 */
export async function fitImageToMm(
  dataUrl: string,
  maxWidthMm: number,
  maxHeightMm: number
): Promise<{ widthMm: number; heightMm: number }> {
  const { width, height } = await loadImageNaturalSizePx(dataUrl);
  const naturalWidthMm = width / PX_PER_MM_96DPI;
  const naturalHeightMm = height / PX_PER_MM_96DPI;
  const scale = Math.min(1, maxWidthMm / naturalWidthMm, maxHeightMm / naturalHeightMm);
  return {
    widthMm: naturalWidthMm * scale,
    heightMm: naturalHeightMm * scale,
  };
}
