// TSP-PRINT-001 (P4-0): page-image comparison for tests/e2e/printParity.e2e.mjs.
import sharp from "sharp";

export const BLEED_MM = 3; // src/lib/pageLayout.ts BLEED_MM: the Preview card shows the bleed, JPG/PDF do not.
export const PDF_DPI = 150;
const COMPARE_WIDTH = 600;

/**
 * One page as a blurred grayscale bitmap of the trim area, COMPARE_WIDTH wide.
 * `bleedOfWidth` / `bleedOfHeight` cut the Preview's bleed; 2% more is cut
 * on every side so the bleed guide and edge antialiasing do not count.
 */
async function pageBitmap(file, height, bleedOfWidth = 0, bleedOfHeight = 0) {
  const meta = await sharp(file).metadata();
  const left = Math.round(meta.width * (bleedOfWidth + 0.02));
  const top = Math.round(meta.height * (bleedOfHeight + 0.02));
  return sharp(file)
    .flatten({ background: "#ffffff" })
    .extract({ left, top, width: meta.width - left * 2, height: meta.height - top * 2 })
    .grayscale()
    // The Preview's paper is cream and JPG/PDF are white: stretch each page
    // so its paper is white and its darkest ink black.
    .normalise({ lower: 0.5, upper: 60 })
    .resize({ width: COMPARE_WIDTH, height, fit: "fill" })
    .blur(2.5)
    .raw()
    .toBuffer();
}

const MAX_SHIFT_PX = 6;

/**
 * How different two pages look, in percent: the summed gray difference over
 * the summed ink of the darker of the two (0 = the same, 100 = no ink in
 * common), after shifting one page by up to MAX_SHIFT_PX to line them up.
 * Antialiasing and a JPG's compression stay low; another typeface or a moved
 * line stays high. Also returns that shift in mm (how far the whole page
 * sits off).
 */
export async function inkDifference(fileA, fileB, paperMm) {
  const height = Math.round((COMPARE_WIDTH * paperMm.height) / paperMm.width);
  const bleed = (file) => (file.includes("preview-") ? [BLEED_MM / (paperMm.width + BLEED_MM * 2), BLEED_MM / (paperMm.height + BLEED_MM * 2)] : [0, 0]);
  const [a, b] = await Promise.all([pageBitmap(fileA, height, ...bleed(fileA)), pageBitmap(fileB, height, ...bleed(fileB))]);
  const W = COMPARE_WIDTH;
  const m = MAX_SHIFT_PX;
  let best = { percent: Infinity, dx: 0, dy: 0 };
  for (let dy = -m; dy <= m; dy++) {
    for (let dx = -m; dx <= m; dx++) {
      let difference = 0;
      let ink = 0;
      for (let y = m; y < height - m; y++) {
        const rowA = y * W;
        const rowB = (y + dy) * W + dx;
        for (let x = m; x < W - m; x++) {
          const va = a[rowA + x];
          const vb = b[rowB + x];
          difference += va > vb ? va - vb : vb - va;
          ink += 255 - (va < vb ? va : vb);
        }
      }
      const percent = ink === 0 ? 0 : (difference / ink) * 100;
      if (percent < best.percent) best = { percent, dx, dy };
    }
  }
  const mmPerPx = paperMm.width / W;
  return {
    percent: Math.round(best.percent * 10) / 10,
    shiftMm: Math.round(Math.hypot(best.dx, best.dy) * mmPerPx * 100) / 100,
  };
}

