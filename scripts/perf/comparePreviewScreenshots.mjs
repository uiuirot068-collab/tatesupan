// node scripts/perf/comparePreviewScreenshots.mjs <dirA> <dirB> [--diff-dir dir]
//
// Pixel-compares the PNGs two runs of tests/e2e/previewVisualParity.e2e.mjs
// wrote (same file names). Reports, per file: identical, or the number of
// differing pixels, the max channel delta and the differing region; writes
// a red-on-grey diff image for every non-identical pair when --diff-dir is
// given. Exit code 1 if any card image differs or a file is missing.
// `-viewport.png` files are reported but never fail the run (they include
// the editor pane, whose text has no parity contract here).
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const [dirA, dirB] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const diffDirIndex = process.argv.indexOf("--diff-dir");
const diffDir = diffDirIndex > 0 ? process.argv[diffDirIndex + 1] : null;
if (!dirA || !dirB) {
  console.error("usage: comparePreviewScreenshots.mjs <dirA> <dirB> [--diff-dir dir]");
  process.exit(2);
}
if (diffDir) mkdirSync(diffDir, { recursive: true });

const raw = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
};

const files = [...new Set([...readdirSync(dirA), ...readdirSync(dirB)])].filter((f) => f.endsWith(".png")).sort();
let failures = 0;
let identical = 0;
for (const file of files) {
  const fatal = !file.endsWith("-viewport.png");
  const a = join(dirA, file);
  const b = join(dirB, file);
  if (!existsSync(a) || !existsSync(b)) {
    console.log(`MISSING   ${file} (${existsSync(a) ? "B" : "A"})`);
    if (fatal) failures++;
    continue;
  }
  const [ia, ib] = await Promise.all([raw(a), raw(b)]);
  if (ia.width !== ib.width || ia.height !== ib.height) {
    console.log(`SIZE      ${file} ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}`);
    if (fatal) failures++;
    continue;
  }
  let differing = 0;
  let maxDelta = 0;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  const diff = diffDir ? Buffer.alloc(ia.width * ia.height * 4) : null;
  for (let i = 0; i < ia.data.length; i += 4) {
    const delta = Math.max(Math.abs(ia.data[i] - ib.data[i]), Math.abs(ia.data[i + 1] - ib.data[i + 1]), Math.abs(ia.data[i + 2] - ib.data[i + 2]), Math.abs(ia.data[i + 3] - ib.data[i + 3]));
    const p = i / 4;
    if (delta > 0) {
      differing++;
      maxDelta = Math.max(maxDelta, delta);
      const x = p % ia.width, y = Math.floor(p / ia.width);
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    }
    if (diff) {
      const grey = Math.round((ia.data[i] + ia.data[i + 1] + ia.data[i + 2]) / 3 * 0.3 + 178);
      diff[i] = delta > 0 ? 255 : grey; diff[i + 1] = delta > 0 ? 0 : grey; diff[i + 2] = delta > 0 ? 0 : grey; diff[i + 3] = 255;
    }
  }
  if (differing === 0) {
    identical++;
    console.log(`IDENTICAL ${file}`);
    continue;
  }
  console.log(`DIFF      ${file} pixels=${differing} maxDelta=${maxDelta} region=[${minX},${minY}]-[${maxX},${maxY}]${fatal ? "" : " (viewport, informational)"}`);
  if (fatal) failures++;
  if (diff) await sharp(diff, { raw: { width: ia.width, height: ia.height, channels: 4 } }).png().toFile(join(diffDir, file));
}
console.log(`${identical}/${files.length} identical; ${failures} failing`);
process.exit(failures ? 1 : 0);
