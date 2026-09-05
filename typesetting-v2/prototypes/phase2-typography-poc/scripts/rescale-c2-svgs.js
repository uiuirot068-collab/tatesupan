// TSP-V2 Phase 2 P2-L01B — presentation-only rescale/re-slice of the
// ALREADY-GENERATED C2 SVG (outputs/c2-vpal-vhal-vkrn.svg, produced in the
// original P2-L01 pass). Per SHAPING_EVIDENCE.md, vhal/vkrn are no-ops in
// this font, so this file's glyph geometry is identical to vpal=1 alone —
// it is reused here, unmodified at the glyph level, purely to avoid
// re-reading the font/re-running harfbuzzjs for a presentation-only fix.
//
// This script does NOT shape anything and does NOT touch glyph outlines,
// advances, or offsets — it only:
//   1. Re-declares the SVG's on-screen width/height in physical pt units
//      matching 文庫's real 8.5pt (previously it used an arbitrary
//      root-em-relative size, which is what caused the "clipped/oversized"
//      Human QA complaint).
//   2. Slices out the two flagged sub-sequences by their known character
//      index range and re-wraps them as standalone focused-view SVGs at a
//      shared, larger inspection scale (24pt/em) — same technique, same
//      untouched per-glyph transforms, just a different declared physical
//      size and a recomputed group origin so the slice starts at the top.
const fs = require("fs");
const path = require("path");

const POC_ROOT = path.join(__dirname, "..");
const SRC_SVG = path.join(POC_ROOT, "outputs", "c2-vpal-vhal-vkrn.svg");
const OUT_DIR = path.join(POC_ROOT, "outputs");

const UPEM = 1000;
const FULL_SENTENCE_FONT_SIZE_PT = 8.5; // matches 文庫 cols1 fontSizePt exactly
const FOCUS_FONT_SIZE_PT = 24; // shared, generous inspection scale

// Canonical sentence, 0-indexed, used only to locate the two flagged
// sub-sequences within the already-shaped glyph sequence (1 glyph per
// source character in this sentence — no ligature/reordering cases).
const CANONICAL_SENTENCE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";
const FOCUS_DAKETO = "それまでだ。けれど";
const FOCUS_BADO = "気づけば、どこへ";

function extractPaths(svgText) {
  const re = /<path d="([^"]*)" transform="translate\(([-\d.]+),([-\d.]+)\)" \/>/g;
  const paths = [];
  let m;
  while ((m = re.exec(svgText))) {
    paths.push({ d: m[1], x: parseFloat(m[2]), y: parseFloat(m[3]) });
  }
  return paths;
}

function buildSvg(paths, fontSizePt, label) {
  const pad = UPEM * 0.6;
  const width = UPEM * 1.6;
  const count = paths.length;
  const yFirst = paths[0].y;
  const height = count * UPEM + pad * 2;
  const originX = width / 2;
  const originY = pad + yFirst; // re-anchors this slice's first glyph near the top

  const glyphEls = paths.map((p) => `<path d="${p.d}" transform="translate(${p.x},${p.y})" />`).join("\n    ");
  const widthPt = ((width / UPEM) * fontSizePt).toFixed(2);
  const heightPt = ((height / UPEM) * fontSizePt).toFixed(2);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${widthPt}pt" height="${heightPt}pt" preserveAspectRatio="xMidYMin meet">
  <g fill="#111" stroke="none" transform="translate(${originX},${originY}) scale(1,-1)">
    ${glyphEls}
  </g>
  <!-- label: ${label}, presented at ${fontSizePt}pt/em (re-sliced/rescaled presentation only — glyph paths and transforms are byte-identical to the original P2-L01 c2-vpal-vhal-vkrn.svg output) -->
</svg>`;
}

function main() {
  const srcText = fs.readFileSync(SRC_SVG, "utf-8");
  const allPaths = extractPaths(srcText);
  const chars = Array.from(CANONICAL_SENTENCE);
  if (allPaths.length !== chars.length) {
    throw new Error(`Expected ${chars.length} glyphs (1 per source char), found ${allPaths.length} paths in ${SRC_SVG}`);
  }

  const daketoStart = CANONICAL_SENTENCE.indexOf(FOCUS_DAKETO);
  const badoStart = CANONICAL_SENTENCE.indexOf(FOCUS_BADO);
  if (daketoStart < 0 || badoStart < 0) throw new Error("focus sequence not found in canonical sentence");

  const daketoPaths = allPaths.slice(daketoStart, daketoStart + Array.from(FOCUS_DAKETO).length);
  const badoPaths = allPaths.slice(badoStart, badoStart + Array.from(FOCUS_BADO).length);

  const outputs = {
    "c2-full": buildSvg(allPaths, FULL_SENTENCE_FONT_SIZE_PT, "c2-full (vpal=1 effective; vhal/vkrn confirmed no-ops in this font)"),
    "c2-focus-daketo": buildSvg(daketoPaths, FOCUS_FONT_SIZE_PT, "c2-focus-daketo それまでだ。けれど"),
    "c2-focus-bado": buildSvg(badoPaths, FOCUS_FONT_SIZE_PT, "c2-focus-bado 気づけば、どこへ"),
  };

  for (const [name, svg] of Object.entries(outputs)) {
    fs.writeFileSync(path.join(OUT_DIR, `${name}.svg`), svg, "utf-8");
    console.log(`Wrote outputs/${name}.svg`);
  }

  fs.writeFileSync(path.join(__dirname, "..", "candidates", "c2-dedicated-shaping", "svg-fragments-clean.json"), JSON.stringify(outputs, null, 2), "utf-8");
}

main();
