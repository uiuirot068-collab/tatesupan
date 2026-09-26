/**
 * 挿絵 geometry contract — the ONE definition of how large an illustration may
 * be drawn, shared by the insert action (`PreviewPane.handleInsertImage`), the
 * Preview overlay (`PageCard` getDisplayImageSize) and V2 composition/export
 * (`v2Bridge/composeV2Document`).
 *
 * The persisted IMG marker keeps the size chosen at insertion time; when later
 * settings shrink the text frame the stored size may no longer fit. Every
 * consumer then scales it DOWN uniformly (aspect ratio preserved, never
 * upscaled) into the same box: 90% of the text-frame width × 60% of its height
 * — the caps insertion has always used. V2 additionally never lets an image be
 * longer than one line's extent, because a Core atom longer than the line has
 * no legal break and would HOLD the whole document.
 */
export const IMAGE_MAX_TEXT_AREA_WIDTH_RATIO = 0.9;
export const IMAGE_MAX_TEXT_AREA_HEIGHT_RATIO = 0.6;

export interface ImageSizeMm {
  widthMm: number;
  heightMm: number;
}

export interface ImageMaxBoxMm {
  maxWidthMm: number;
  maxHeightMm: number;
}

/** The insertion/display cap box for a text frame. */
export function imageMaxBoxForTextArea(textAreaWidthMm: number, textAreaHeightMm: number): ImageMaxBoxMm {
  return {
    maxWidthMm: textAreaWidthMm * IMAGE_MAX_TEXT_AREA_WIDTH_RATIO,
    maxHeightMm: textAreaHeightMm * IMAGE_MAX_TEXT_AREA_HEIGHT_RATIO,
  };
}

/**
 * Uniformly scales `size` down to fit `box` (never up). A degenerate box or
 * size is returned unchanged, exactly like the Preview overlay always did.
 */
export function fitImageToBox(size: ImageSizeMm, box: ImageMaxBoxMm): ImageSizeMm {
  if (box.maxWidthMm <= 0 || box.maxHeightMm <= 0 || size.widthMm <= 0 || size.heightMm <= 0) return size;
  const scale = Math.min(1, box.maxWidthMm / size.widthMm, box.maxHeightMm / size.heightMm);
  return scale === 1 ? size : { widthMm: size.widthMm * scale, heightMm: size.heightMm * scale };
}
