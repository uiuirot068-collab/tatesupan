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

/** Gap between illustrations that share one 天/中央/地 position (and between their rows). */
export const IMAGE_GROUP_GAP_MM = 4;

export type GroupedImagePosition = "TOP" | "CENTER" | "BOTTOM";

export interface ImageRectMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface ImageContentBoxMm {
  leftMm: number;
  topMm: number;
  widthMm: number;
  heightMm: number;
}

/**
 * TSP-PHASE13-001: the ONE placement rule for illustrations that share a
 * 天/中央/地 position on a page, used by the V2 Preview overlay and by
 * PDF/JPG export alike. Images keep document order and flow left-to-right
 * in rows (wrapping when a row would exceed the text frame width), each row
 * centred horizontally in the text frame with `gapMm` between images and
 * rows. 天 puts the block at the frame top, 地 at the frame bottom (each
 * row bottom-aligned), 中央 centres the block vertically. Rows of 天/中央
 * are top-aligned. Sizes are used as given (callers fit them first).
 */
export function layoutImageGroup(
  sizes: readonly ImageSizeMm[],
  box: ImageContentBoxMm,
  position: GroupedImagePosition,
  gapMm: number = IMAGE_GROUP_GAP_MM
): ImageRectMm[] {
  const rows: number[][] = [];
  let rowWidth = 0;
  sizes.forEach((size, index) => {
    const current = rows[rows.length - 1];
    if (current && rowWidth + gapMm + size.widthMm <= box.widthMm + 1e-9) {
      current.push(index);
      rowWidth += gapMm + size.widthMm;
      return;
    }
    rows.push([index]);
    rowWidth = size.widthMm;
  });
  const rowHeights = rows.map((row) => Math.max(...row.map((i) => sizes[i].heightMm)));
  const blockHeight = rowHeights.reduce((sum, h) => sum + h, 0) + gapMm * Math.max(0, rows.length - 1);
  let rowTop =
    position === "TOP"
      ? box.topMm
      : position === "BOTTOM"
        ? box.topMm + box.heightMm - blockHeight
        : box.topMm + (box.heightMm - blockHeight) / 2;
  const rects: ImageRectMm[] = new Array(sizes.length);
  rows.forEach((row, rowIndex) => {
    const width = row.reduce((sum, i) => sum + sizes[i].widthMm, 0) + gapMm * (row.length - 1);
    let x = box.leftMm + (box.widthMm - width) / 2;
    for (const i of row) {
      const { widthMm, heightMm } = sizes[i];
      const yMm = position === "BOTTOM" ? rowTop + rowHeights[rowIndex] - heightMm : rowTop;
      rects[i] = { xMm: x, yMm, widthMm, heightMm };
      x += widthMm + gapMm;
    }
    rowTop += rowHeights[rowIndex] + gapMm;
  });
  return rects;
}
