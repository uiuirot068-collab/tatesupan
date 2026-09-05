// TSP-V2 Phase 2 P2-L01 — Candidate 2 (Dedicated Shaping) visual output.
// PoC-only. Builds a genuine SVG rendering of the canonical regression
// sentence directly from HarfBuzz-via-WASM shaped glyph outlines (real
// vector paths from font.glyphToPath), NOT a browser-rendered screenshot.
// The browser only rasterizes the resulting <path> elements — it performs
// no text shaping, no line-breaking, no glyph positioning here. Positions
// come entirely from HarfBuzz's shape() output (x/y advance + x/y offset).
//
// Standard HarfBuzz vertical-rendering pattern: for each shaped glyph,
// draw at (penX + dx, penY + dy), then advance the pen by (xAdvance,
// yAdvance) for the next glyph. Font space is Y-up; SVG is Y-down, so the
// whole column is wrapped in a single `scale(1,-1)` group — under that
// flip, yAdvance (negative, i.e. decreasing font-Y) correctly walks the
// pen down the page in reading order.
const fs = require("fs");
const path = require("path");
const hbjsReady = require("harfbuzzjs");

const FONT_PATH = process.env.TSP_FONT_PATH;
if (!FONT_PATH) {
  console.error("Set TSP_FONT_PATH to the Shippori Mincho .ttf path.");
  process.exit(1);
}

const CANONICAL_SENTENCE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

// The two flagged sub-sequences (P2-L01B focused-comparison view).
const FOCUS_DAKETO = "それまでだ。けれど";
const FOCUS_BADO = "気づけば、どこへ";

const UPEM = 1000; // font.setScale(1000, 1000)

// P2-L01B: vpal is this font's only real vertical GPOS feature (see
// SHAPING_EVIDENCE.md) — it is the presentation default. "default" (no
// explicit features, HarfBuzz auto vert/vrt2 only) is kept only as a
// diagnostic-mode extra, not the primary comparison candidate.
const PRIMARY_FEATURES = "vpal=1";
const DIAGNOSTIC_FEATURE_SETS = {
  "c2-default": null,
  "c2-vpal-vhal-vkrn": "vpal=1,vhal=1,vkrn=1",
};

// Physical scale: 1000 font-units == fontSizePt physical points, matching
// C1/C3's actual on-page character size — NOT a typography change, purely
// how large the same shaped-glyph geometry is presented on screen.
const FULL_SENTENCE_FONT_SIZE_PT = 8.5; // matches 文庫 cols1 fontSizePt exactly
const FOCUS_FONT_SIZE_PT = 24; // shared, generous inspection scale for C1/C2/C3 focused panels

function shapeColumn(hb, fontBuffer, text, featureString) {
  const blob = hb.createBlob(fontBuffer);
  const face = hb.createFace(blob, 0);
  const font = hb.createFont(face);
  font.setScale(UPEM, UPEM);
  const buffer = hb.createBuffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  buffer.setDirection("ttb");
  hb.shape(font, buffer, featureString || undefined);
  const glyphs = buffer.json(font);

  let penX = 0;
  let penY = 0;
  const placed = [];
  for (const g of glyphs) {
    const glyphPath = font.glyphToPath(g.g);
    placed.push({
      pathData: glyphPath,
      x: penX + g.dx,
      y: penY + g.dy,
      cluster: g.cl,
    });
    penX += g.ax;
    penY += g.ay;
  }
  const columnLength = Math.abs(penY); // total travel down the column, font units

  buffer.destroy();
  font.destroy();
  face.destroy();
  blob.destroy();
  return { placed, columnLength };
}

// fontSizePt: physical point size that 1000 font-units (1em) should occupy
// on screen — this is a presentation/scale parameter only (P2-L01B), never
// a change to the shaped glyph coordinates themselves (those come entirely
// from shapeColumn's penX/penY/dx/dy, untouched here).
function toSvg(placed, columnLength, label, fontSizePt) {
  const pad = UPEM * 0.6;
  const width = UPEM * 1.6;
  const height = columnLength + pad * 2;
  const originX = width / 2;
  const originY = pad; // near the top; pen travels downward as penY (font-space, Y-up) decreases

  const glyphEls = placed
    .map((p) => `<path d="${p.pathData}" transform="translate(${p.x},${p.y})" />`)
    .join("\n    ");

  const widthPt = (width / UPEM) * fontSizePt;
  const heightPt = (height / UPEM) * fontSizePt;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${widthPt.toFixed(2)}pt" height="${heightPt.toFixed(2)}pt" preserveAspectRatio="xMidYMin meet">
  <g fill="#111" stroke="none" transform="translate(${originX},${originY}) scale(1,-1)">
    ${glyphEls}
  </g>
  <!-- label: ${label}, presented at ${fontSizePt}pt/em (physical scale only, not a shaping change) -->
</svg>`;
}

async function renderOne(hb, fontBuffer, text, featureString, label, fontSizePt, outDir) {
  const { placed, columnLength } = shapeColumn(hb, fontBuffer, text, featureString);
  const svg = toSvg(placed, columnLength, label, fontSizePt);
  fs.writeFileSync(path.join(outDir, `${label}.svg`), svg, "utf-8");
  console.log(`Wrote outputs/${label}.svg (${placed.length} glyphs, column length ${columnLength}u, ${fontSizePt}pt/em)`);
  return svg;
}

async function main() {
  const fontBuffer = new Uint8Array(fs.readFileSync(FONT_PATH));
  const hb = await hbjsReady;

  const outDir = path.join(__dirname, "..", "..", "outputs");
  fs.mkdirSync(outDir, { recursive: true });

  const svgFragments = {};

  // Primary (clean, default-view) outputs — vpal=1, physical scale.
  svgFragments["c2-full"] = await renderOne(hb, fontBuffer, CANONICAL_SENTENCE, PRIMARY_FEATURES, "c2-full", FULL_SENTENCE_FONT_SIZE_PT, outDir);
  svgFragments["c2-focus-daketo"] = await renderOne(hb, fontBuffer, FOCUS_DAKETO, PRIMARY_FEATURES, "c2-focus-daketo", FOCUS_FONT_SIZE_PT, outDir);
  svgFragments["c2-focus-bado"] = await renderOne(hb, fontBuffer, FOCUS_BADO, PRIMARY_FEATURES, "c2-focus-bado", FOCUS_FONT_SIZE_PT, outDir);

  // Diagnostic-only extras — feature-set comparison, full sentence, same physical scale.
  for (const [label, featureString] of Object.entries(DIAGNOSTIC_FEATURE_SETS)) {
    svgFragments[label] = await renderOne(hb, fontBuffer, CANONICAL_SENTENCE, featureString, label, FULL_SENTENCE_FONT_SIZE_PT, outDir);
  }

  fs.writeFileSync(
    path.join(__dirname, "svg-fragments.json"),
    JSON.stringify(svgFragments, null, 2),
    "utf-8"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
