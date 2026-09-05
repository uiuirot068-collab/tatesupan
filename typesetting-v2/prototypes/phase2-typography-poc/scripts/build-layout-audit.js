// TSP-V2 Phase 2 P2-L03 — self-diagnostic layout formula audit page.
// No headless-browser tooling needed: all measurement happens client-side
// in the viewer's own browser via getBoundingClientRect, on load. Compares
// three things per preset: (a) TateSpun's real, current formula (read-only
// from src/lib/pageLayout.ts + src/components/PageCard.tsx, transcribed by
// hand in this script), (b) the P2-L02 PoC's formula as actually used in
// multipreset-comparison.html, and (c) a live-measured native (C3-style,
// unstretched) character pitch rendered fresh in this page. This does NOT
// change any candidate's typography — it only measures and displays.
const fs = require("fs");
const path = require("path");

const POC_ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(POC_ROOT, "layout-audit.html");

const PX_PER_MM = 2.2; // src/lib/pageLayout.ts
const MM_PER_PT = 25.4 / 72; // src/lib/pageLayout.ts

// Read-only, transcribed from src/constants/paperSizes.ts PAPER_SIZE_TEMPLATES.
const PRESETS = [
  { key: "文庫", label: "文庫", isPx: false, width: 105, height: 148, marginTop: 14, marginBottom: 14, fontSizePt: 8.5, lineSpacing: 1.7, charsPerLine: 38, gridMode: "justified", stacked2col: false, columnGap: 0 },
  { key: "A5-1", label: "A5 1段", isPx: false, width: 148, height: 210, marginTop: 18, marginBottom: 18, fontSizePt: 9.0, lineSpacing: 1.7, charsPerLine: 53, gridMode: "solid", stacked2col: false, columnGap: 0 },
  { key: "A5-2", label: "A5 2段", isPx: false, width: 148, height: 210, marginTop: 16, marginBottom: 16, fontSizePt: 8.5, lineSpacing: 1.65, charsPerLine: 25, gridMode: "justified", stacked2col: true, columnGap: 8 },
  { key: "B5", label: "B5", isPx: false, width: 182, height: 257, marginTop: 20, marginBottom: 20, fontSizePt: 9.5, lineSpacing: 1.7, charsPerLine: 45, gridMode: "justified", stacked2col: false, columnGap: 0 },
  { key: "B6", label: "B6", isPx: false, width: 128, height: 182, marginTop: 16, marginBottom: 16, fontSizePt: 9.0, lineSpacing: 1.7, charsPerLine: 40, gridMode: "justified", stacked2col: false, columnGap: 0 },
  { key: "新書", label: "新書", isPx: false, width: 103, height: 182, marginTop: 15, marginBottom: 15, fontSizePt: 8.5, lineSpacing: 1.7, charsPerLine: 40, gridMode: "justified", stacked2col: false, columnGap: 0 },
  { key: "A6", label: "A6", isPx: false, width: 105, height: 148, marginTop: 14, marginBottom: 14, fontSizePt: 8.5, lineSpacing: 1.7, charsPerLine: 38, gridMode: "justified", stacked2col: false, columnGap: 0 },
  { key: "Web", label: "Web閲覧用", isPx: true, width: 768, height: 1024, marginTop: 40, marginBottom: 40, fontSizePt: 36, lineSpacing: 1.8, charsPerLine: 29, gridMode: "justified", stacked2col: false, columnGap: 0 },
];

// ---- Production formula (real), per src/lib/pageLayout.ts + PageCard.tsx ----
function computeReal(p) {
  const widthMm = p.isPx ? p.width / PX_PER_MM : p.width;
  const heightMm = p.isPx ? p.height / PX_PER_MM : p.height;
  let textAreaHeightMm = Math.max(heightMm - p.marginTop - p.marginBottom, 0);
  if (p.stacked2col) textAreaHeightMm = Math.max((textAreaHeightMm - p.columnGap) / 2, 0);
  const fontSizeMm = p.fontSizePt * MM_PER_PT;
  const maxCapacityChars = fontSizeMm > 0 ? Math.floor(textAreaHeightMm / fontSizeMm) : 0;
  const clamped = p.charsPerLine > maxCapacityChars;
  const charsPerLine = clamped ? maxCapacityChars : p.charsPerLine;
  const canonicalSlotExtentMm = p.gridMode === "solid" ? fontSizeMm : textAreaHeightMm / Math.max(charsPerLine, 1);
  const colPitchMm = fontSizeMm * p.lineSpacing;
  return {
    fontSizePx: fontSizeMm * PX_PER_MM,
    slotExtentPx: canonicalSlotExtentMm * PX_PER_MM,
    colPitchPx: colPitchMm * PX_PER_MM,
    maxCapacityChars,
    clamped,
    charsPerLine,
    stretchRatio: canonicalSlotExtentMm / fontSizeMm,
  };
}

// ---- P2-L02 PoC formula, AS ACTUALLY USED in build-multipreset.js (bug reproduced, not fixed) ----
const PT_PER_MM = 2.834645669;
function computePoC(p) {
  // build-multipreset.js: unitToPt() treats mm-unit presets via *PT_PER_MM,
  // but Web (unit:"px") used its raw template numbers AS-IS with no
  // PX_PER_MM / mm-pt round trip at all — reproduced here verbatim.
  const columnHeightRaw = p.isPx
    ? p.height - p.marginTop - p.marginBottom // literal px arithmetic, the PoC's actual (buggy) path for Web
    : (p.height - p.marginTop - p.marginBottom) * PT_PER_MM; // mm->pt for print presets
  const fontSizeRaw = p.fontSizePt; // used directly as the CSS unit value (pt for print, px for Web) with no conversion
  const charPitchRaw = p.gridMode === "solid" ? fontSizeRaw : columnHeightRaw / p.charsPerLine;
  // Convert PoC's own declared CSS unit to an actual on-screen px figure so
  // it's comparable to Production's PX_PER_MM-scaled numbers above:
  // print presets declared "pt" (1pt = 4/3 css px); Web declared "px" as-is.
  const ptToPx = 4 / 3;
  return {
    fontSizePx: p.isPx ? fontSizeRaw : fontSizeRaw * ptToPx,
    slotExtentPx: p.isPx ? charPitchRaw : charPitchRaw * ptToPx,
    stretchRatio: charPitchRaw / fontSizeRaw,
  };
}

function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function main() {
  const rows = PRESETS.map((p) => {
    const real = computeReal(p);
    const poc = computePoC(p);
    return { p, real, poc };
  });

  const tableRows = rows.map(({ p, real, poc }) => {
    const diffPct = ((poc.stretchRatio - real.stretchRatio) / real.stretchRatio * 100).toFixed(1);
    const flag = Math.abs(poc.stretchRatio - real.stretchRatio) > 0.02 ? `<b class="bad">DIFFERS ${diffPct}%</b>` : `<span class="ok">matches</span>`;
    return `<tr data-key="${p.key}">
      <td>${escapeHtml(p.label)}</td>
      <td>${p.gridMode}${p.clamped ? " (clamped!)" : ""}</td>
      <td>${real.fontSizePx.toFixed(2)}px</td>
      <td>${real.slotExtentPx.toFixed(2)}px</td>
      <td>${real.stretchRatio.toFixed(3)}×</td>
      <td>${poc.slotExtentPx.toFixed(2)}px</td>
      <td>${poc.stretchRatio.toFixed(3)}×</td>
      <td>${flag}</td>
      <td class="live-cell" id="live-${p.key}">measuring…</td>
    </tr>`;
  }).join("\n");

  const testStrings = rows.map(({ p, real }) => {
    // 20 plain kanji/kana characters, no punctuation (avoids vpal-type
    // glyph-specific distortion), rendered at Production's real fontSizePx,
    // unconstrained height, single column (width capped to colPitch) so it
    // never wraps — used to measure native (unstretched) per-char pitch.
    const text = "気合言葉行人今日花山川空水火土木金風雲";
    return { key: p.key, text, fontSizePx: real.fontSizePx, colPitchPx: real.colPitchPx, slotExtentPx: real.slotExtentPx };
  });

  const hiddenBlocks = testStrings.map((t) => `
    <div class="measure-block" id="measure-${t.key}" style="writing-mode:vertical-rl; text-orientation:mixed; font-family:'Shippori Mincho',serif; font-size:${t.fontSizePx}px; width:${t.colPitchPx}px; position:absolute; left:-9999px; top:0;">${escapeHtml(t.text)}</div>
  `).join("\n");

  const script = `
    window.addEventListener('load', function () {
      var data = ${JSON.stringify(testStrings)};
      data.forEach(function (t) {
        var el = document.getElementById('measure-' + t.key);
        var rect = el.getBoundingClientRect();
        var charCount = Array.from(t.text).length;
        var measuredPitchPx = rect.height / charCount;
        var declaredSlotPx = t.slotExtentPx;
        var diffPct = ((measuredPitchPx - declaredSlotPx) / declaredSlotPx * 100).toFixed(1);
        var matches = Math.abs(measuredPitchPx - declaredSlotPx) < 0.05 * declaredSlotPx;
        var cell = document.getElementById('live-' + t.key);
        cell.innerHTML = 'native ' + measuredPitchPx.toFixed(2) + 'px vs. declared (stretched) ' + declaredSlotPx.toFixed(2) + 'px &rarr; ' +
          (matches ? '<span class="ok">MATCH</span>' : '<b class="bad">DIFFER (' + diffPct + '%)</b>');
      });
    });
  `;

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>TSP-V2 P2-L03 — Layout Formula Audit</title>
<link href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap" rel="stylesheet" />
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #fafaf7; color: #111; }
  h1 { font-size: 17px; margin: 0 0 8px; }
  p.intro { font-size: 12px; color: #555; max-width: 900px; line-height: 1.6; }
  table { border-collapse: collapse; margin-top: 16px; font-size: 12px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; }
  th { background: #eee; }
  .ok { color: #1a7f1a; }
  .bad { color: #a33; }
  .live-cell { min-width: 260px; }
</style>
</head>
<body>
  <h1>P2-L03 — Layout Formula Audit: Production vs. P2-L02 PoC vs. live-measured native pitch</h1>
  <p class="intro">
    "Production" columns are TateSpun's actual, current formula (<code>computePageLayout</code> + <code>PageCard.tsx</code>'s <code>canonicalSlotExtentPx</code>, read read-only from <code>src/lib/pageLayout.ts</code>/<code>src/components/PageCard.tsx</code>), scaled via the real <code>PX_PER_MM=2.2</code> preview constant.
    "PoC (P2-L02)" columns reproduce exactly what <code>scripts/build-multipreset.js</code> actually rendered, bugs included (Web閲覧用's unit-conversion bug is reproduced here, not silently fixed).
    "Live-measured" renders a real 20-character run at Production's real font size directly in this page (hidden off-screen, measured via <code>getBoundingClientRect()</code> on load, no headless tooling) — this shows what a genuinely native/unstretched (C3-style) render actually does, for comparison against the declared "justified"-stretched slot size. See <code>evidence/P2_L03_LAYOUT_FORMULA_AUDIT.md</code> for the full write-up.
  </p>
  <table>
    <thead>
      <tr>
        <th>Preset</th><th>gridMode</th>
        <th>Production fontSizePx</th><th>Production slotExtentPx</th><th>Production stretch ratio</th>
        <th>PoC slotExtentPx</th><th>PoC stretch ratio</th><th>PoC vs Production</th>
        <th>Live-measured native pitch vs. declared (stretched) slot</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
  ${hiddenBlocks}
  <script>${script}</script>
</body>
</html>
`;

  fs.writeFileSync(OUT_FILE, html, "utf-8");
  console.log("Wrote", OUT_FILE);
}

main();
