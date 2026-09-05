// TSP-V2 Phase 2 P2-L02 — C1 (explicit grid) vs C3 (browser control) across
// TateSpun's mandatory Human QA preset matrix (Master §11.2). Read-only
// preset values from src/constants/paperSizes.ts (PAPER_SIZE_TEMPLATES) —
// nothing here invents a dimension. No new optical/punctuation correction
// rules are added; C1's grid formula and C3's plain-block formula are the
// same ones used in P2-L01/P2-L01C, just re-parameterized per preset.
const fs = require("fs");
const path = require("path");

const POC_ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(POC_ROOT, "multipreset-comparison.html");
const PT_PER_MM = 2.834645669;

// ---- Read-only, verbatim from src/constants/paperSizes.ts PAPER_SIZE_TEMPLATES ----
// (transcribed by hand-reading that file in this session; not derived/invented)
const PRESETS = [
  {
    key: "文庫",
    label: "文庫 (1段)",
    unit: "mm",
    width: 105, height: 148,
    ...{ marginTop: 14, marginBottom: 14, marginGutter: 15, marginOuter: 10, fontSize: 8.5, lineSpacing: 1.7, charsPerLine: 38, linesPerColumn: 16, gridMode: "justified" },
  },
  {
    key: "A5-1col",
    label: "A5 1段",
    unit: "mm",
    width: 148, height: 210,
    ...{ marginTop: 18, marginBottom: 18, marginGutter: 20, marginOuter: 14, fontSize: 9.0, lineSpacing: 1.7, charsPerLine: 53, linesPerColumn: 22, gridMode: "solid" }, // TSP-LOOP-003: explicit gridMode override in source
  },
  {
    key: "A5-2col",
    label: "A5 2段",
    unit: "mm",
    width: 148, height: 210,
    // NOTE: TateSpun's "2段" is vertical top/bottom STACKING within one page,
    // not side-by-side columns (see docs/requirements/CURRENT_PRODUCT_COMPATIBILITY_MATRIX.md
    // row 17) — charsPerLine(25) is the height, in characters, of EACH of
    // the two stacked half-blocks, not the full page column height. Modeled
    // via stacked2col below; columnGap(8mm) is the gap BETWEEN the two
    // stacked blocks, not between left/right columns.
    ...{ marginTop: 16, marginBottom: 16, marginGutter: 18, marginOuter: 14, fontSize: 8.5, lineSpacing: 1.65, charsPerLine: 25, linesPerColumn: 24, columnGap: 8, gridMode: "justified", stacked2col: true },
  },
  {
    key: "B5",
    label: "B5 (1段)",
    unit: "mm",
    width: 182, height: 257,
    ...{ marginTop: 20, marginBottom: 20, marginGutter: 22, marginOuter: 16, fontSize: 9.5, lineSpacing: 1.7, charsPerLine: 45, linesPerColumn: 26, gridMode: "justified" },
  },
  {
    key: "B6",
    label: "B6 (1段)",
    unit: "mm",
    width: 128, height: 182,
    ...{ marginTop: 16, marginBottom: 16, marginGutter: 18, marginOuter: 12, fontSize: 9.0, lineSpacing: 1.7, charsPerLine: 40, linesPerColumn: 18, gridMode: "justified" },
  },
  {
    key: "新書",
    label: "新書 (1段)",
    unit: "mm",
    width: 103, height: 182,
    ...{ marginTop: 15, marginBottom: 15, marginGutter: 16, marginOuter: 11, fontSize: 8.5, lineSpacing: 1.7, charsPerLine: 40, linesPerColumn: 15, gridMode: "justified" },
  },
  {
    key: "A6",
    label: "A6 (1段)",
    unit: "mm",
    width: 105, height: 148,
    ...{ marginTop: 14, marginBottom: 14, marginGutter: 15, marginOuter: 10, fontSize: 8.5, lineSpacing: 1.7, charsPerLine: 38, linesPerColumn: 16, gridMode: "justified" },
  },
  {
    key: "Web閲覧用",
    label: "Web閲覧用 (1段)",
    unit: "px",
    width: 768, height: 1024,
    ...{ marginTop: 40, marginBottom: 40, marginGutter: 20, marginOuter: 20, fontSize: 36, lineSpacing: 1.8, charsPerLine: 29, linesPerColumn: 12, gridMode: "justified" },
  },
];

const FONT_CSS_FAMILY = "'Shippori Mincho', serif";
const FONT_GOOGLE_HREF =
  "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap";

const CANONICAL_SENTENCE =
  "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

// SYNTHETIC pagination-stress fixture: the canonical sentence repeated.
// Clearly marked as synthetic repetition, not literary sample text (per
// loop brief) — used only to have enough characters to exercise each
// preset's real page-1 capacity and to feed C3 more than it can fit, so
// its own natural clipping boundary is visible.
const STRESS_TEXT = CANONICAL_SENTENCE.repeat(30);

function unitToPt(preset, mmValue) {
  return preset.unit === "mm" ? mmValue * PT_PER_MM : mmValue; // Web閲覧用ではpx値をそのままCSS単位として使う
}
function cssUnit(preset) {
  return preset.unit === "mm" ? "pt" : "px";
}

function computeCapacity(preset) {
  let columnHeightPt = unitToPt(preset, preset.height - preset.marginTop - preset.marginBottom);
  if (preset.stacked2col) {
    // Two vertically-stacked half-blocks per page, separated by columnGap.
    const gapPt = unitToPt(preset, preset.columnGap || 0);
    columnHeightPt = (columnHeightPt - gapPt) / 2;
  }
  const charPitch = preset.gridMode === "solid" ? preset.fontSize : columnHeightPt / preset.charsPerLine;
  const colPitch = preset.fontSize * preset.lineSpacing;
  const capacityChars = preset.charsPerLine * preset.linesPerColumn;
  return { columnHeightPt, charPitch, colPitch, capacityChars };
}

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildC1(preset, text) {
  const { charPitch, colPitch } = computeCapacity(preset);
  const u = cssUnit(preset);
  const chars = Array.from(text);
  let html = "";
  chars.forEach((ch, i) => {
    const col = Math.floor(i / preset.charsPerLine);
    const row = i % preset.charsPerLine;
    html += `<span class="c1-cell" style="right:${col * colPitch}${u}; top:${row * charPitch}${u}; width:${colPitch}${u}; height:${charPitch}${u}; line-height:${charPitch}${u}; font-size:${preset.fontSize}${u};">${escapeHtml(ch)}</span>`;
  });
  const numCols = Math.min(preset.linesPerColumn, Math.ceil(chars.length / preset.charsPerLine));
  const containerWidth = numCols * colPitch;
  const containerHeight = preset.charsPerLine * charPitch;
  return { html: `<div class="c1-grid" style="width:${containerWidth}${u}; height:${containerHeight}${u};">${html}</div>`, charsUsed: chars.length };
}

function buildC3(preset, text) {
  const { charPitch, colPitch } = computeCapacity(preset);
  const u = cssUnit(preset);
  const boxHeight = preset.charsPerLine * charPitch;
  const boxWidth = preset.linesPerColumn * colPitch;
  return `<div class="c3-block" style="height:${boxHeight}${u}; width:${boxWidth}${u}; font-size:${preset.fontSize}${u}; line-height:${preset.lineSpacing};">${escapeHtml(text)}</div>`;
}

function buildPresetSection(preset) {
  const cap = computeCapacity(preset);
  const c1SliceText = Array.from(STRESS_TEXT).slice(0, cap.capacityChars).join("");
  const c1 = buildC1(preset, c1SliceText);
  // C3 gets the FULL stress text (much longer than capacity) inside a
  // physically page-1-sized, overflow:hidden box — its own natural
  // line-break/kinsoku decides exactly how much of it becomes visible,
  // independently of C1's naive fixed-count slice. This is the actual
  // determinism check: does C3's real capacity match C1's declared one?
  // NOT independently measured/verified visually in this loop (no
  // rendering/screenshot tool was used) — left for Human inspection.
  const c3Html = buildC3(preset, STRESS_TEXT);

  return `
  <section class="preset-section">
    <h2>${escapeHtml(preset.label)}</h2>
    <div class="preset-meta">
      page: ${preset.width}${preset.unit==="mm"?"mm":"px"} × ${preset.height}${preset.unit==="mm"?"mm":"px"} ·
      margins T${preset.marginTop}/B${preset.marginBottom}/gutter${preset.marginGutter}/outer${preset.marginOuter}${preset.unit==="mm"?"mm":"px"} ·
      font ${preset.fontSize}${preset.unit==="mm"?"pt":"px"} · line-spacing ${preset.lineSpacing} ·
      charsPerLine ${preset.charsPerLine} · linesPerColumn ${preset.linesPerColumn} · gridMode ${preset.gridMode} ·
      declared page-1 capacity ${cap.capacityChars} chars · computed charPitch ${cap.charPitch.toFixed(3)}${cssUnit(preset)}
    </div>
    <div class="pair">
      <div class="col">
        <h3>C1 — explicit grid (naive slice, exactly ${cap.capacityChars} chars)</h3>
        ${c1.html}
      </div>
      <div class="col">
        <h3>C3 — browser control (full ${Array.from(STRESS_TEXT).length}-char stress text, box clipped to same physical page-1 size)</h3>
        <div class="c3-clip">${c3Html}</div>
      </div>
    </div>
  </section>`;
}

function main() {
  const sections = PRESETS.map(buildPresetSection).join("\n");

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>TSP-V2 Phase 2 P2-L02 — C1 vs C3 Multi-Preset Comparison</title>
<link href="${FONT_GOOGLE_HREF}" rel="stylesheet" />
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #fafaf7; color: #111; }
  h1 { font-size: 17px; margin: 0 0 6px; }
  .top-meta { font-size: 12px; color: #555; margin-bottom: 16px; line-height: 1.6; max-width: 900px; }
  .top-meta code { background: #eee; padding: 1px 4px; }
  .preset-section { border-top: 2px solid #ccc; padding: 16px 0; }
  .preset-section h2 { font-size: 15px; margin: 0 0 4px; }
  .preset-meta { font-size: 11px; color: #666; margin-bottom: 12px; }
  .pair { display: flex; gap: 32px; flex-wrap: wrap; align-items: flex-start; }
  .col h3 { font-size: 12px; color: #444; margin: 0 0 8px; max-width: 320px; }
  .c1-grid, .c3-block {
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: ${FONT_CSS_FAMILY};
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
  }
  .c3-clip { overflow: hidden; border: 1px solid #ddd; display: inline-block; }
</style>
</head>
<body>
  <h1>TSP-V2 Phase 2 — P2-L02: C1 vs C3 across the mandatory preset matrix</h1>
  <div class="top-meta">
    Regression text: canonical sentence (Master §11.3) repeated ×30 as a <b>synthetic pagination-stress fixture</b> (clearly not literary sample text — used only to exceed every preset's page-1 capacity so each candidate's own real limit is visible).<br>
    Font: <b>Shippori Mincho</b>, same for C1 and C3 in every preset below. All page/margin/font/capacity values read read-only from <code>src/constants/paperSizes.ts</code> <code>PAPER_SIZE_TEMPLATES</code> — see <code>evidence/P2_L02_MULTIPRESET_MEASUREMENTS.md</code> for the full table.<br>
    <b>C1</b>: explicit absolute-positioned grid, fixed at the preset's declared page-1 capacity (charsPerLine × linesPerColumn), zero per-glyph correction.<br>
    <b>C3</b>: plain native <code>writing-mode:vertical-rl</code>, given far more text than fits, clipped to the same physical page-1 box — the browser's own line-breaking/kinsoku decides how much is actually visible, independent of C1's declared capacity number.<br>
    No typography/punctuation correction rules were added or changed in this loop.<br>
    <b>Known open item:</b> B5/B6/新書's computed "justified" charPitch comes out 18-44% larger than their declared font size (vs. ~5% for 文庫/A5/A6) under this script's simplified reproduction of the documented capacity formula — this may be intentional existing product design, or may mean this script doesn't fully reproduce <code>src/lib/pageLayout.ts</code>'s real <code>computePageLayout</code> clamp logic (not read in this loop). See <code>evidence/P2_L02_MULTIPRESET_MEASUREMENTS.md</code> §3. Whether C3's actual browser-rendered capacity matches C1's declared number was <b>not independently measured</b> in this loop (no rendering/screenshot tool used) — please inspect visually.
  </div>
  ${sections}
</body>
</html>
`;

  fs.writeFileSync(OUT_FILE, html, "utf-8");
  console.log("Wrote", OUT_FILE);

  // Also emit the measurement table data as JSON for the evidence doc to cite.
  const measurements = PRESETS.map((p) => ({ key: p.key, label: p.label, ...p, ...computeCapacity(p) }));
  fs.writeFileSync(path.join(POC_ROOT, "scripts", "multipreset-measurements.json"), JSON.stringify(measurements, null, 2), "utf-8");
}

main();
