export const WEB_FOOTER_BRAND_SOURCE_WIDTH = 384;
export const WEB_FOOTER_BRAND_SOURCE_HEIGHT = 341;
export const WEB_FOOTER_BRAND_CSS_WIDTH = 19;

export interface RasterRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** One-step aspect-fit used by the direct Web JPG footer-branding paint. */
export function containRasterRect(
  source: { width: number; height: number },
  box: RasterRect
): RasterRect {
  if (source.width <= 0 || source.height <= 0 || box.width <= 0 || box.height <= 0) {
    return { x: box.x, y: box.y, width: 0, height: 0 };
  }
  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
}
