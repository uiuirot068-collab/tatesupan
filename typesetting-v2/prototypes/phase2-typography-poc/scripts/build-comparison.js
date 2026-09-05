// TSP-V2 Phase 2 P2-L01C — wires the already-generated candidate outputs
// into comparison.html with a CLEAN default presentation (no yellow
// highlighting, no grid/cell diagnostic borders) and an explicit
// "診断表示" toggle that restores those diagnostics on demand.
//
// This script does NOT shape, position, or regenerate any candidate's
// typography — C1's grid math and C3's plain block are the same formulas
// used in the original P2-L01 build; C2's SVGs are read verbatim from
// disk (outputs/c2-full.svg, outputs/c2-focus-daketo.svg,
// outputs/c2-focus-bado.svg — all produced by the earlier, separate
// rescale pass, not by this script).
const fs = require("fs");
const path = require("path");

const POC_ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(POC_ROOT, "comparison.html");

// ---- 文庫 (bunko) 1-column preset, read verbatim (read-only) from
// src/constants/paperSizes.ts '文庫'.cols1.
const BUNKO = {
  widthMm: 105,
  heightMm: 148,
  marginTopMm: 14,
  marginBottomMm: 14,
  marginGutterMm: 15,
  marginOuterMm: 10,
  fontSizePt: 8.5,
  lineSpacing: 1.7,
  charsPerLine: 38,
  linesPerColumn: 16,
};

const FOCUS_FONT_SIZE_PT = 24; // shared inspection scale, matches c2-focus-*.svg

const FONT_CSS_FAMILY = "'Shippori Mincho', serif";
const FONT_GOOGLE_HREF =
  "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap";

const CANONICAL_SENTENCE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

const FOCUS_A = "だ。け"; // 。→け
const FOCUS_B = "ば、ど"; // 、→ど
const FOCUS_DAKETO = "それまでだ。けれど";
const FOCUS_BADO = "気づけば、どこへ";

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------------------------------------------------------------------
// C3 — Browser Control
// ---------------------------------------------------------------------
function buildC3Full() {
  const chars = Array.from(CANONICAL_SENTENCE);
  let html = "";
  for (const ch of chars) {
    if (FOCUS_A.includes(ch) || FOCUS_B.includes(ch)) {
      html += `<span class="hl">${escapeHtml(ch)}</span>`;
    } else {
      html += escapeHtml(ch);
    }
  }
  const heightPt = BUNKO.charsPerLine * BUNKO.fontSizePt;
  return `<div class="c3-block" style="height:${heightPt}pt;">${html}</div>`;
}

function buildVerticalBlock(text, fontSizePt) {
  return `<div class="focus-block" style="font-size:${fontSizePt}pt;">${escapeHtml(text)}</div>`;
}

// ---------------------------------------------------------------------
// C1 — Pragmatic Hybrid: explicit absolute-positioned character grid.
// ---------------------------------------------------------------------
function buildC1Full() {
  const chars = Array.from(CANONICAL_SENTENCE);
  const charPitchPt = BUNKO.fontSizePt;
  const colPitchPt = BUNKO.fontSizePt * BUNKO.lineSpacing;

  let html = "";
  chars.forEach((ch, i) => {
    const col = Math.floor(i / BUNKO.charsPerLine);
    const row = i % BUNKO.charsPerLine;
    const hl = FOCUS_A.includes(ch) || FOCUS_B.includes(ch) ? " hl" : "";
    html += `<span class="c1-cell${hl}" style="right:${col * colPitchPt}pt; top:${row * charPitchPt}pt; width:${colPitchPt}pt; height:${charPitchPt}pt; line-height:${charPitchPt}pt; font-size:${BUNKO.fontSizePt}pt;">${escapeHtml(ch)}</span>`;
  });
  const numCols = Math.ceil(chars.length / BUNKO.charsPerLine);
  const containerWidthPt = numCols * colPitchPt;
  const containerHeightPt = BUNKO.charsPerLine * charPitchPt;
  return `<div class="c1-grid" style="width:${containerWidthPt}pt; height:${containerHeightPt}pt;">${html}</div>`;
}

// C1 focused view: single short column, same grid math, larger scale, no wrap needed.
function buildC1Focus(text, fontSizePt) {
  const chars = Array.from(text);
  const charPitchPt = fontSizePt;
  let html = "";
  chars.forEach((ch, i) => {
    html += `<span class="c1-cell" style="right:0; top:${i * charPitchPt}pt; width:${charPitchPt}pt; height:${charPitchPt}pt; line-height:${charPitchPt}pt; font-size:${fontSizePt}pt;">${escapeHtml(ch)}</span>`;
  });
  return `<div class="c1-grid" style="width:${charPitchPt}pt; height:${chars.length * charPitchPt}pt;">${html}</div>`;
}

// ---------------------------------------------------------------------
// C2 — read the already-generated SVGs verbatim.
// ---------------------------------------------------------------------
function readSvg(name) {
  return fs.readFileSync(path.join(POC_ROOT, "outputs", `${name}.svg`), "utf-8");
}

function main() {
  const c1Full = buildC1Full();
  const c3Full = buildC3Full();
  const c1FocusDaketo = buildC1Focus(FOCUS_DAKETO, FOCUS_FONT_SIZE_PT);
  const c1FocusBado = buildC1Focus(FOCUS_BADO, FOCUS_FONT_SIZE_PT);
  const c3FocusDaketo = buildVerticalBlock(FOCUS_DAKETO, FOCUS_FONT_SIZE_PT);
  const c3FocusBado = buildVerticalBlock(FOCUS_BADO, FOCUS_FONT_SIZE_PT);

  const c2Full = readSvg("c2-full");
  const c2FocusDaketo = readSvg("c2-focus-daketo");
  const c2FocusBado = readSvg("c2-focus-bado");

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>TSP-V2 Phase 2 P2-L01 — Typography PoC Comparison (C1 / C2 / C3)</title>
<link href="${FONT_GOOGLE_HREF}" rel="stylesheet" />
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #fafaf7; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  h2.section { font-size: 15px; margin: 32px 0 4px; border-top: 1px solid #ddd; padding-top: 16px; }
  .meta { font-size: 12px; color: #555; margin-bottom: 12px; line-height: 1.6; }
  .meta code { background: #eee; padding: 1px 4px; }
  .diag-control { font-size: 13px; margin: 10px 0 20px; padding: 8px 12px; background: #fff; border: 1px solid #ccc; display: inline-block; }
  .diag-control label { cursor: pointer; user-select: none; }
  .panels { display: flex; gap: 28px; align-items: flex-start; flex-wrap: wrap; }
  .panel { border: 1px solid #ccc; background: #fff; padding: 16px; }
  .panel h3 { font-size: 14px; margin: 0 0 4px; }
  .panel .sub { font-size: 11px; color: #666; margin-bottom: 12px; max-width: 260px; }
  .c3-block, .c1-grid, .focus-block {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: ${FONT_CSS_FAMILY};
    font-size: ${BUNKO.fontSizePt}pt;
    line-height: ${BUNKO.lineSpacing};
    color: #111;
    position: relative;
  }
  .c1-grid { writing-mode: horizontal-tb; }
  .c1-cell {
    position: absolute;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: ${FONT_CSS_FAMILY};
    display: block;
    text-align: center;
    box-sizing: border-box;
    outline: none; /* diagnostic-only, see #diagToggle rule below */
  }
  .hl { background: none; } /* diagnostic-only, see #diagToggle rule below */

  /* ---- Diagnostic mode: OFF by default (clean Human QA presentation). ---- */
  #diagToggle:checked ~ .page .hl { background: rgba(255, 205, 0, 0.55); }
  #diagToggle:checked ~ .page .c1-cell { outline: 0.5px dotted #bbb; }
  #diagToggle:checked ~ .page .diag-only { display: block; }
  .diag-only { display: none; font-size: 11px; color: #a33; margin-top: 6px; }

  .svg-wrap svg { display: block; }
  .svg-wrap.full { max-height: 520px; overflow: auto; border: 1px solid #eee; }
  .focus-row { display: flex; gap: 40px; align-items: flex-start; flex-wrap: wrap; }
  .focus-col { text-align: center; }
  .focus-col h4 { font-size: 12px; margin: 0 0 8px; color: #444; }
</style>
</head>
<body>
  <div class="diag-control">
    <label><input type="checkbox" id="diagToggle"> 診断表示 (show yellow highlight / grid boundaries — off by default; toggling this never changes layout, only visibility of diagnostic overlays)</label>
  </div>
  <div class="page">

  <h1>TSP-V2 Phase 2 — P2-L01 Typography PoC: C1 / C2 / C3</h1>
  <div class="meta">
    Canonical regression sentence (Master §11.3 / REGRESSION_CORPUS_SPEC.md #1):<br>
    <code>${escapeHtml(CANONICAL_SENTENCE)}</code><br>
    Preset: <b>文庫</b> (1-column), read read-only from <code>src/constants/paperSizes.ts</code> — width ${BUNKO.widthMm}mm × height ${BUNKO.heightMm}mm,
    margins T${BUNKO.marginTopMm}/B${BUNKO.marginBottomMm}/gutter${BUNKO.marginGutterMm}/outer${BUNKO.marginOuterMm}mm,
    font-size ${BUNKO.fontSizePt}pt, line-spacing ${BUNKO.lineSpacing}, charsPerLine ${BUNKO.charsPerLine}, linesPerColumn ${BUNKO.linesPerColumn}.<br>
    Font: <b>Shippori Mincho</b> (same family used by all three candidates below).
  </div>

  <h2 class="section">Full canonical sentence</h2>
  <div class="panels">

    <div class="panel">
      <h3>C3 — Browser Control</h3>
      <div class="sub">Plain CSS <code>writing-mode:vertical-rl</code>. Browser performs line-breaking, kinsoku, glyph shaping and punctuation placement entirely natively. No compensation of any kind.</div>
      ${c3Full}
      <div class="diag-only">Height capped to ${BUNKO.charsPerLine} chars so the browser wraps a new column at the same capacity C1 uses.</div>
    </div>

    <div class="panel">
      <h3>C1 — Pragmatic Hybrid (explicit grid)</h3>
      <div class="sub">Explicit absolute-positioned character grid — logical layout is deterministic and capacity-exact (文庫: ${BUNKO.charsPerLine}/column). Glyph painting inside each cell is still 100% native browser shaping — zero per-glyph optical correction applied.</div>
      ${c1Full}
    </div>

    <div class="panel">
      <h3>C2 — Dedicated Shaping</h3>
      <div class="sub">Real HarfBuzz-via-WASM (harfbuzzjs) shaped glyph outlines, direction <code>ttb</code>, this font's own <code>vpal</code> feature applied (its only real vertical GPOS feature — see SHAPING_EVIDENCE.md). Rendered as raw SVG &lt;path&gt; elements at true 8.5pt scale, matching C1/C3 — the browser only rasterizes vectors here, it does not shape this text.</div>
      <div class="svg-wrap full">${c2Full}</div>
    </div>

  </div>

  <h2 class="section">Focused comparison — the two flagged sequences, shared ${FOCUS_FONT_SIZE_PT}pt inspection scale</h2>
  <div class="meta">Same real candidate output as above, not retyped — just the two flagged substrings shown larger for easier punctuation-rhythm inspection.</div>

  <div class="focus-row">
    <div class="focus-col">
      <h4>それまでだ。けれど — C3</h4>
      ${c3FocusDaketo}
    </div>
    <div class="focus-col">
      <h4>それまでだ。けれど — C1</h4>
      ${c1FocusDaketo}
    </div>
    <div class="focus-col">
      <h4>それまでだ。けれど — C2</h4>
      <div class="svg-wrap">${c2FocusDaketo}</div>
    </div>
  </div>

  <div class="focus-row" style="margin-top:32px;">
    <div class="focus-col">
      <h4>気づけば、どこへ — C3</h4>
      ${c3FocusBado}
    </div>
    <div class="focus-col">
      <h4>気づけば、どこへ — C1</h4>
      ${c1FocusBado}
    </div>
    <div class="focus-col">
      <h4>気づけば、どこへ — C2</h4>
      <div class="svg-wrap">${c2FocusBado}</div>
    </div>
  </div>

  <p class="meta" style="margin-top:32px;">This page was assembled programmatically and has not been independently visually verified by a headless browser in the authoring environment for this exact revision. Human Visual QA (see qa/human/PHASE2_L01_TYPOGRAPHY_SCORECARD.md) is the authority, per Master §11.1.</p>

  </div>
</body>
</html>
`;

  fs.writeFileSync(OUT_FILE, html, "utf-8");
  console.log("Wrote", OUT_FILE);
}

main();
