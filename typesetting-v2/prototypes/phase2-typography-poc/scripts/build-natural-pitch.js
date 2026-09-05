// TSP-V2 Phase 2 P2-L04 — Natural-Pitch Explicit Grid PoC.
//
// C1-JUSTIFIED: reproduces Production's CURRENT gridMode per preset
//   (solid for A5 1段, justified-stretch for everything else) — same
//   formula as P2-L02, now correctly PX_PER_MM-scaled for every preset
//   including Web (fixing the P2-L03-diagnosed unit bug).
// C1-NATURAL: same explicit deterministic grid, same declared charsPerLine
//   (logical capacity UNCHANGED), but every preset's visual character
//   pitch = fontSizeMm exactly (1em, physical-unit-derived) — i.e. what
//   Production already calls "solid" mode, applied uniformly. Leftover
//   column space becomes residual margin, shown on screen, not hidden.
// C3: plain native vertical-rl, real font size, box capped to the FULL
//   physical column height (same real page bounds C1 uses), fed far more
//   text than fits so its own native (no-stretch) capacity is visible.
//
// No punctuation/optical correction, no preset-specific multipliers.
const fs = require("fs");
const path = require("path");

const POC_ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(POC_ROOT, "natural-pitch-comparison.html");

const PX_PER_MM = 2.2; // src/lib/pageLayout.ts — Production's real preview scale
const MM_PER_PT = 25.4 / 72; // src/lib/pageLayout.ts
// Uniform display zoom applied equally to EVERY measurement below (font
// size, all pitches, column height, residual) purely so the Human can
// legibly judge text on a normal monitor — Production's own PX_PER_MM=2.2
// renders an 8.5pt character at ~6.6 screen px, too small to visually
// judge rhythm from. This is not a typography change: it preserves every
// ratio (stretch ratio, residual-as-fraction-of-column, etc.) exactly,
// applied identically across all presets and all three candidates.
const DISPLAY_ZOOM = 4;

// Read-only, transcribed from src/constants/paperSizes.ts PAPER_SIZE_TEMPLATES.
// Only the 5 presets this loop requires (3 discriminating + 2 controls).
const PRESETS = [
  { key: "文庫", label: "文庫", isPx: false, width: 105, height: 148, marginTop: 14, marginBottom: 14, fontSizePt: 8.5, lineSpacing: 1.7, charsPerLine: 38, gridMode: "justified", stacked2col: false, columnGap: 0 },
  { key: "A5-1", label: "A5 1段", isPx: false, width: 148, height: 210, marginTop: 18, marginBottom: 18, fontSizePt: 9.0, lineSpacing: 1.7, charsPerLine: 53, gridMode: "solid", stacked2col: false, columnGap: 0 },
  { key: "B5", label: "B5", isPx: false, width: 182, height: 257, marginTop: 20, marginBottom: 20, fontSizePt: 9.5, lineSpacing: 1.7, charsPerLine: 45, gridMode: "justified", stacked2col: false, columnGap: 0 },
  { key: "新書", label: "新書", isPx: false, width: 103, height: 182, marginTop: 15, marginBottom: 15, fontSizePt: 8.5, lineSpacing: 1.7, charsPerLine: 40, gridMode: "justified", stacked2col: false, columnGap: 0 },
  { key: "Web", label: "Web閲覧用", isPx: true, width: 768, height: 1024, marginTop: 40, marginBottom: 40, fontSizePt: 36, lineSpacing: 1.8, charsPerLine: 29, gridMode: "justified", stacked2col: false, columnGap: 0 },
];

const FONT_CSS_FAMILY = "'Shippori Mincho', serif";
const FONT_GOOGLE_HREF = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap";

// Fixture A — technical regression text (unchanged across all P2 loops).
const FIXTURE_A = "「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」";

// Fixture B — Human QA long-text fixture. Verbatim, no manual line breaks,
// not repeated, not shortened.
const FIXTURE_B = "朝の光がまだ薄いころ、駅前の商店街には昨日の雨が残っていた。閉じたままのシャッターに小さな水滴が並び、軒先から落ちる雫だけが静かな通りに音を立てている。交差点を渡った先では、パン屋の主人が店先の黒板を書き直していた。今日のおすすめは胡桃の入った丸パンらしい。通り過ぎようとしたところで焼き上がったばかりの香りが漂ってきて、私は足を止めた。予定より少し早く家を出たのだから、急ぐ必要はない。そう思って扉を開けると、店内には古い木の棚と小さなランプが並び、窓際の席には既に一人だけ客がいた。温かい紅茶を頼み、包み紙を開く。外側は軽く乾いているのに、中は驚くほど柔らかかった。胡桃を噛むたびに香ばしさが広がり、さっきまで気になっていた仕事のことが少し遠くなる。窓の外では配達の自転車が何台か行き交い、制服姿の学生たちが笑いながら駅へ向かっていた。時計を見ると、まだ十分ほど余裕がある。私は鞄から小さな手帳を取り出し、昨日思いついたことを読み返した。書いたときには大事に思えた言葉も、朝になって見ると妙に大げさに感じることがある。それでも消さずに残しておくと、数週間後には別の意味を持って見えることもあった。だから最近は、思いついたことをすぐ整理しようとせず、そのまま置いておくようにしている。紅茶が半分ほどになったころ、雲の切れ間から日が差した。濡れていた舗道が急に明るくなり、向かいの花屋が鉢植えを外へ運び始める。季節はまだ夏の名残を引きずっているのに、店頭にはもう小さな秋色の花が増えていた。私は最後の一口を食べ、包み紙を畳んで席を立つ。特別な出来事は何もなかったが、こういう短い時間が一日の輪郭を少しだけ整えてくれる。店を出ると、さっきまで静かだった商店街には人の声が増えていた。駅へ向かう途中で一度だけ振り返ると、パン屋の扉がまた開き、新しい客が中へ入っていった。";

function geom(p) {
  const widthMm = p.isPx ? p.width / PX_PER_MM : p.width;
  const heightMm = p.isPx ? p.height / PX_PER_MM : p.height;
  let textAreaHeightMm = Math.max(heightMm - p.marginTop - p.marginBottom, 0);
  if (p.stacked2col) textAreaHeightMm = Math.max((textAreaHeightMm - p.columnGap) / 2, 0);
  const fontSizeMm = p.fontSizePt * MM_PER_PT;
  const colPitchMm = fontSizeMm * p.lineSpacing;
  const justifiedSlotMm = p.gridMode === "solid" ? fontSizeMm : textAreaHeightMm / Math.max(p.charsPerLine, 1);
  const naturalSlotMm = fontSizeMm; // C1-NATURAL: always exactly 1 em, physical-unit-derived
  const residualMm = Math.max(textAreaHeightMm - p.charsPerLine * naturalSlotMm, 0);
  return {
    widthMm, heightMm, textAreaHeightMm, fontSizeMm, colPitchMm,
    justifiedSlotMm, naturalSlotMm, residualMm,
    fontSizePx: fontSizeMm * PX_PER_MM * DISPLAY_ZOOM,
    colPitchPx: colPitchMm * PX_PER_MM * DISPLAY_ZOOM,
    justifiedSlotPx: justifiedSlotMm * PX_PER_MM * DISPLAY_ZOOM,
    naturalSlotPx: naturalSlotMm * PX_PER_MM * DISPLAY_ZOOM,
    residualPx: residualMm * PX_PER_MM * DISPLAY_ZOOM,
    textAreaHeightPx: textAreaHeightMm * PX_PER_MM * DISPLAY_ZOOM,
    justifiedStretchRatio: justifiedSlotMm / fontSizeMm,
    naturalStretchRatio: naturalSlotMm / fontSizeMm, // always 1.000
  };
}

function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

function buildGrid(p, g, slotPx, text, sourceLabel) {
  const chars = Array.from(text).slice(0, p.charsPerLine);
  let html = "";
  chars.forEach((ch, i) => {
    html += `<span class="cell" style="right:0; top:${i * slotPx}px; width:${g.colPitchPx}px; height:${slotPx}px; line-height:${slotPx}px; font-size:${g.fontSizePx}px;">${escapeHtml(ch)}</span>`;
  });
  const usedPx = chars.length * slotPx;
  const residualPx = Math.max(g.textAreaHeightPx - usedPx, 0);
  return `<div class="grid-wrap">
    <div class="grid" style="width:${g.colPitchPx}px; height:${g.textAreaHeightPx}px;">
      ${html}
      ${residualPx > 1 ? `<div class="residual" style="top:${usedPx}px; height:${residualPx}px; width:${g.colPitchPx}px;" title="residual margin (${(residualPx / PX_PER_MM).toFixed(1)}mm)"></div>` : ""}
    </div>
    <div class="cap">${sourceLabel}: ${chars.length}/${p.charsPerLine} chars shown, residual ${(residualPx).toFixed(0)}px (${(residualPx / PX_PER_MM).toFixed(1)}mm)</div>
  </div>`;
}

function buildC3(p, g, text) {
  // P2-L04B FIX: the text-flowing element itself (not just an outer
  // wrapper) must carry BOTH the explicit height (bounded inline/wrap
  // extent — without this a vertical-rl block never wraps into a new
  // column at all) AND a generous explicit width (block-progression
  // extent — without this a normal in-flow block child defaults to its
  // parent's width, i.e. exactly one column, leaving nowhere for
  // wrapped columns to go). Root cause of the P2-L04 misalignment bug:
  // both constraints were previously placed on an outer `.c3-clip`
  // wrapper instead of on `.c3-block` itself.
  //
  // Width is sized generously (using native 1em pitch as a
  // minimum-density estimate) so the ENTIRE Fixture B text fits with no
  // clipping and no scrolling — block flow always starts painting at
  // the container's own top/right origin, so 「朝」(the first
  // character) is guaranteed visible with no scroll-position ambiguity.
  // C3's natural capacity is NOT forced to match C1 — it may (and does)
  // show a different number of characters per column than C1's declared
  // charsPerLine; only the STARTING point is aligned.
  const charCount = Array.from(text).length;
  const nativeCharsPerColumnEstimate = Math.max(1, Math.floor(g.textAreaHeightPx / g.fontSizePx));
  const numColumns = Math.ceil(charCount / nativeCharsPerColumnEstimate);
  const blockWidthPx = numColumns * g.colPitchPx;
  return `<div class="grid-wrap">
    <div class="c3-block" style="height:${g.textAreaHeightPx}px; width:${blockWidthPx}px; font-size:${g.fontSizePx}px; line-height:${p.lineSpacing};">${escapeHtml(text)}</div>
    <div class="cap">native, same physical column height (${(g.textAreaHeightPx / PX_PER_MM).toFixed(1)}mm); full Fixture B shown across as many columns as it naturally needs (no scroll, no clipping, no capacity forced to match C1)</div>
  </div>`;
}

function buildPresetSection(p) {
  const g = geom(p);
  const invalidWebNote = p.key === "Web"
    ? `<p class="invalid-note">The P2-L02 C1 sample for Web閲覧用 was <b>INVALID</b> (unit-conversion bug, see P2-L03). Not shown here — both C1 variants below use the corrected unit model (margins/font-size treated as canonical mm/pt, converted via PX_PER_MM=2.2, matching Production's real preview scale).</p>`
    : "";

  return `
  <section class="preset-section">
    <h2>${escapeHtml(p.label)}</h2>
    <div class="preset-meta">
      declared font ${p.fontSizePt}${p.isPx ? "px(canonical pt-equivalent)" : "pt"} (${g.fontSizePx.toFixed(2)}px on screen) ·
      charsPerLine (logical capacity, UNCHANGED between variants) ${p.charsPerLine} ·
      line pitch (colPitch, UNCHANGED between variants) ${g.colPitchPx.toFixed(2)}px ·
      full column height ${g.textAreaHeightPx.toFixed(1)}px (${g.textAreaHeightMm.toFixed(1)}mm) ·
      Production gridMode: ${p.gridMode}
    </div>
    ${invalidWebNote}
    <div class="pair">
      <div class="col">
        <h3>C1-JUSTIFIED (Production's current formula, gridMode=${p.gridMode})</h3>
        <div class="ratio">stretch ratio ${g.justifiedStretchRatio.toFixed(3)}× · slot ${g.justifiedSlotPx.toFixed(2)}px/char</div>
        ${buildGrid(p, g, g.justifiedSlotPx, FIXTURE_B, "C1-JUSTIFIED")}
      </div>
      <div class="col">
        <h3>C1-NATURAL (1em physical pitch, residual = margin)</h3>
        <div class="ratio">stretch ratio ${g.naturalStretchRatio.toFixed(3)}× (always 1.000) · slot ${g.naturalSlotPx.toFixed(2)}px/char · residual ${g.residualMm.toFixed(1)}mm</div>
        ${buildGrid(p, g, g.naturalSlotPx, FIXTURE_B, "C1-NATURAL")}
      </div>
      <div class="col">
        <h3>C3 — browser control</h3>
        ${buildC3(p, g, FIXTURE_B)}
      </div>
    </div>
  </section>`;
}

function buildFixtureASection() {
  const rows = PRESETS.map((p) => {
    const g = geom(p);
    return `<div class="fa-row">
      <div class="fa-label">${escapeHtml(p.label)} — C1-JUSTIFIED (${g.justifiedSlotPx.toFixed(1)}px/char)</div>
      <div class="fa-block" style="writing-mode:vertical-rl; text-orientation:mixed; font-family:${FONT_CSS_FAMILY}; font-size:${g.fontSizePx}px; line-height:${g.justifiedSlotPx / g.fontSizePx};">${escapeHtml(FIXTURE_A)}</div>
      <div class="fa-label">${escapeHtml(p.label)} — C1-NATURAL (${g.naturalSlotPx.toFixed(1)}px/char)</div>
      <div class="fa-block" style="writing-mode:vertical-rl; text-orientation:mixed; font-family:${FONT_CSS_FAMILY}; font-size:${g.fontSizePx}px; line-height:1;">${escapeHtml(FIXTURE_A)}</div>
    </div>`;
  }).join("\n");
  return `<section class="preset-section"><h2>Technical diagnostic — Fixture A (canonical sentence), all presets</h2><div class="fa-grid">${rows}</div></section>`;
}

function main() {
  const sections = PRESETS.map(buildPresetSection).join("\n");
  const fixtureA = buildFixtureASection();

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>TSP-V2 P2-L04 — Natural-Pitch C1 vs C3</title>
<link href="${FONT_GOOGLE_HREF}" rel="stylesheet" />
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #fafaf7; color: #111; }
  h1 { font-size: 17px; margin: 0 0 6px; }
  .top-meta { font-size: 12px; color: #555; margin-bottom: 16px; line-height: 1.6; max-width: 900px; }
  .top-meta code { background: #eee; padding: 1px 4px; }
  .preset-section { border-top: 2px solid #ccc; padding: 16px 0; }
  .preset-section h2 { font-size: 15px; margin: 0 0 4px; }
  .preset-meta { font-size: 11px; color: #666; margin-bottom: 10px; }
  .invalid-note { font-size: 11px; color: #a33; max-width: 700px; }
  .pair { display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-start; }
  .col h3 { font-size: 12px; color: #333; margin: 0 0 4px; max-width: 260px; }
  .ratio { font-size: 11px; color: #666; margin-bottom: 8px; }
  .grid { position: relative; box-sizing: border-box; border: 1px solid #ddd; }
  .cell {
    position: absolute;
    writing-mode: vertical-rl;
    text-orientation: mixed;
    font-family: ${FONT_CSS_FAMILY};
    display: block;
    text-align: center;
    box-sizing: border-box;
  }
  .residual { position: absolute; right: 0; background: repeating-linear-gradient(45deg, #eee, #eee 4px, #f7f7f7 4px, #f7f7f7 8px); border-top: 1px dashed #bbb; box-sizing: border-box; }
  .c3-clip { overflow: hidden; border: 1px solid #ddd; box-sizing: border-box; }
  .c3-block { writing-mode: vertical-rl; text-orientation: mixed; font-family: ${FONT_CSS_FAMILY}; color: #111; }
  .cap { font-size: 10px; color: #888; margin-top: 6px; max-width: 260px; }
  .fa-grid { display: flex; gap: 20px; flex-wrap: wrap; }
  .fa-row { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
  .fa-label { font-size: 10px; color: #666; }
  .fa-block { color: #111; }
</style>
</head>
<body>
  <h1>TSP-V2 Phase 2 — P2-L04: C1-JUSTIFIED vs C1-NATURAL vs C3</h1>
  <div class="top-meta">
    <b>C1-JUSTIFIED</b>: Production's current per-preset gridMode (solid for A5 1段, justified-stretch elsewhere), corrected to real PX_PER_MM=2.2 screen scale for every preset including Web (fixing the P2-L03-diagnosed unit bug).<br>
    <b>C1-NATURAL</b>: same explicit deterministic grid, same declared charsPerLine (logical capacity unchanged), but every character's visual pitch = exactly the physical font size (1em) — Production's own "solid" mode, applied uniformly. Unused column space is shown as a visible residual-margin stripe, not hidden.<br>
    <b>C3</b>: plain native <code>writing-mode:vertical-rl</code>, fed far more text than fits, clipped to the same real physical column height — its own line-breaking decides how much becomes visible, no compensation.<br>
    Line pitch (column-to-column spacing) is identical across all three for a given preset — only character (down-column) pitch differs. No punctuation/optical correction or preset-specific tuning was added anywhere below.<br>
    Human QA fixture: the long non-repeating prose sample below (see <code>qa/human/PHASE2_L04_NATURAL_PITCH_SCORECARD.md</code>). A separate compact technical section (Fixture A, the canonical sentence) follows for diagnostic continuity only.<br>
    <b>Display note:</b> all sizes below are Production's real PX_PER_MM=2.2 preview scale × a uniform ${DISPLAY_ZOOM}&times; display zoom, applied identically to every measurement (font size, all pitches, column height, residual) so text is legible on a normal monitor — this changes nothing about any ratio (stretch ratio, residual-as-fraction-of-column) between candidates or presets.
  </div>
  ${sections}
  ${fixtureA}
</body>
</html>
`;

  fs.writeFileSync(OUT_FILE, html, "utf-8");
  console.log("Wrote", OUT_FILE);

  const measurements = PRESETS.map((p) => ({ key: p.key, label: p.label, ...p, ...geom(p) }));
  fs.writeFileSync(path.join(POC_ROOT, "scripts", "natural-pitch-measurements.json"), JSON.stringify(measurements, null, 2), "utf-8");
}

main();
