// TSP-V2 Phase 2 P2-L01 — Candidate 2 (Dedicated Shaping) spike.
// PoC-only. Not production code. Shapes the canonical regression sentence
// (and the two flagged sub-sequences) through HarfBuzz-via-WASM directly
// against Shippori Mincho, in vertical (ttb) direction, with several
// explicit OpenType feature combinations, and dumps raw glyph/advance/offset
// data as evidence — no visual judgement is made by this script.
const fs = require("fs");
const path = require("path");
const hbjsReady = require("harfbuzzjs"); // module itself is a Promise<hbjs>, not a factory
const opentype = require("opentype.js");

const FONT_PATH = process.env.TSP_FONT_PATH ||
  "/c/Users/PC_User/AppData/Local/Temp/claude/D--Dropbox-neuneunet-Dropbox-------molnatu----2026--------tate-tate-typesetting-v2-worktree/fb308635-b9d1-48b0-9d04-841a6f68246f/scratchpad/fonts/ShipporiMincho-Regular.ttf";

const CANONICAL_SENTENCE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

const FOCUS_SEQUENCES = {
  "daketo": "それまでだ。けれど", // 。→け focus
  "bado": "気づけば、どこへ",     // 、→ど focus
};

const FEATURE_SETS = {
  "default (harfbuzz auto, no explicit features)": null,
  "vert=1 explicit": "vert=1",
  "vrt2=1 explicit": "vrt2=1",
  "vpal=1 explicit": "vpal=1",
  "vpal=0 explicit (force off)": "vpal=0",
  "vhal=1 explicit": "vhal=1",
  "vhal=0 explicit (force off)": "vhal=0",
  "vchw=1 explicit": "vchw=1",
  "vkrn=1 explicit": "vkrn=1",
  "vpal=1,vhal=1,vkrn=1 combined": "vpal=1,vhal=1,vkrn=1",
};

function listOpenTypeFeatures(fontPath) {
  const otFont = opentype.loadSync(fontPath);
  const feats = new Set();
  for (const tableName of ["gsub", "gpos"]) {
    const table = otFont.tables[tableName];
    if (!table || !table.features) continue;
    for (const f of table.features) feats.add(`${tableName.toUpperCase()}:${f.tag}`);
  }
  return Array.from(feats).sort();
}

async function main() {
  const fontBuffer = new Uint8Array(fs.readFileSync(FONT_PATH));
  const hb = await hbjsReady;

  const supportedFeatures = listOpenTypeFeatures(FONT_PATH);

  const report = {
    poc: "TSP-V2 Phase 2 P2-L01 Candidate 2 — HarfBuzz-via-WASM shaping evidence",
    generatedAt: new Date().toISOString(),
    font: {
      path: FONT_PATH,
      family: "Shippori Mincho",
      note: "Downloaded from google/fonts GitHub mirror (OFL) into an out-of-repo scratch location for this PoC only; not committed.",
    },
    harfbuzzjsVersion: require("harfbuzzjs/package.json").version,
    fontDeclaredOpenTypeFeatures_GSUB_GPOS: supportedFeatures,
    canonicalSentence: CANONICAL_SENTENCE,
    focusSequences: FOCUS_SEQUENCES,
    shapes: {},
  };

  function shapeOnce(text, featureString) {
    const blob = hb.createBlob(fontBuffer);
    const face = hb.createFace(blob, 0);
    const font = hb.createFont(face);
    font.setScale(1000, 1000);
    const buffer = hb.createBuffer();
    buffer.addText(text);
    buffer.guessSegmentProperties();
    buffer.setDirection("ttb"); // vertical, top-to-bottom — this is the axis under test
    hb.shape(font, buffer, featureString || undefined);
    const result = buffer.json(font);
    const chars = Array.from(text);
    const glyphs = result.map((g) => ({
      sourceChar: chars[g.cl] !== undefined ? chars[g.cl] : null,
      cluster: g.cl,
      glyphId: g.g,
      glyphName: (() => {
        try {
          return font.glyphName(g.g);
        } catch {
          return null;
        }
      })(),
      xAdvance: g.ax,
      yAdvance: g.ay,
      xOffset: g.dx,
      yOffset: g.dy,
    }));
    buffer.destroy();
    font.destroy();
    face.destroy();
    blob.destroy();
    return glyphs;
  }

  for (const [seqName, seqText] of Object.entries(FOCUS_SEQUENCES)) {
    report.shapes[seqName] = { sourceText: seqText, byFeatureSet: {} };
    for (const [label, featureString] of Object.entries(FEATURE_SETS)) {
      report.shapes[seqName].byFeatureSet[label] = shapeOnce(seqText, featureString);
    }
  }

  // Full canonical sentence, default features only (evidence volume control —
  // per-feature-set full-sentence dumps are in the sidecar file below).
  report.canonicalSentenceShape_defaultFeatures = shapeOnce(CANONICAL_SENTENCE, null);

  fs.writeFileSync(
    path.join(__dirname, "shape-output.json"),
    JSON.stringify(report, null, 2),
    "utf-8"
  );
  console.log("Wrote shape-output.json");
  console.log("Font declared GSUB/GPOS features:", supportedFeatures.join(", "));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
