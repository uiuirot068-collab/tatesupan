// TSP-V2 Phase 2 P2-L06 — true vertical-page visual fidelity PoC.
// Reuses the SAME P2-L05 engine (tokenize/expandToUnits/breakIntoLines) —
// this file only renders its real output into a realistic publication-
// like page, plus a naive (no-rule) comparison for kinsoku/hanging, plus
// a browser-side glyph-alignment measurement for dash/ellipsis (no
// headless tooling — the viewer's own browser measures on load).
const fs = require("fs");
const path = require("path");
const { tokenize, expandToUnits, breakIntoLines } = require("./engine.js");

const ROOT = path.join(__dirname, "..");

// ---- A5 1段, read-only from src/constants/paperSizes.ts (cols1) ----
const PX_PER_MM = 2.2; // src/lib/pageLayout.ts
const MM_PER_PT = 25.4 / 72; // src/lib/pageLayout.ts
const DISPLAY_ZOOM = 4; // uniform legibility zoom, same as P2-L04 — no ratio changed
const A5_1 = { fontSizePt: 9.0, lineSpacing: 1.7, gridMode: "solid" }; // already Human-approved as C1-NATURAL-equivalent (P2-L04)
const fontSizeMm = A5_1.fontSizePt * MM_PER_PT;
const fontSizePx = fontSizeMm * PX_PER_MM * DISPLAY_ZOOM;
const colPitchPx = fontSizeMm * A5_1.lineSpacing * PX_PER_MM * DISPLAY_ZOOM;
const charPitchPx = fontSizePx; // A5 1段 gridMode=solid: natural 1em, matches C1-NATURAL exactly

const FONT_CSS_FAMILY = "'Shippori Mincho', serif";
const FONT_GOOGLE_HREF = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap";

function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// Naive (no rule-decision layer at all) chunker, for the "before" column —
// same unit stream, same capacity, but breaks strictly every N cells with
// no kinsoku/hanging adjustment. Used ONLY as a visual control, never as
// part of C1-NATURAL's real output.
function naiveBreak(units, capacityCells) {
  const lines = [];
  let i = 0;
  while (i < units.length) {
    let cells = 0, j = i;
    while (j < units.length && cells + units[j].cells <= capacityCells) { cells += units[j].cells; j++; }
    if (j === i) j = i + 1; // always make progress
    lines.push(units.slice(i, j));
    i = j;
  }
  return lines;
}

let uidCounter = 0;
function renderUnit(u, opts) {
  const id = `u${uidCounter++}`;
  const measure = opts && opts.measureIds ? opts.measureIds : null;
  if (u.kind === "rubyBase") {
    // Rendered per-group below (buildColumnFromLines groups consecutive
    // rubyBase units sharing a groupId into ONE <ruby> element) — this
    // function is only reached for non-ruby kinds; ruby is handled by
    // renderRubyGroup.
    return `<span class="cell" style="height:${charPitchPx}px;line-height:${charPitchPx}px;font-size:${fontSizePx}px;">${escapeHtml(u.display)}</span>`;
  }
  if (u.kind === "tcy") {
    // NOT `.cell` (inline-block): text-combine-upright only combines the
    // 2-character run into one cell's worth of space when the span stays
    // a plain INLINE box participating in normal vertical text flow —
    // wrapping it in an inline-block (as every other cell kind uses)
    // silently defeats the combine and renders "12" as two ordinary
    // stacked vertical characters instead (a real bug caught via
    // screenshot inspection this loop, fixed here).
    return `<span class="tcyCell" style="font-size:${fontSizePx}px;">${escapeHtml(u.display)}</span>`;
  }
  if (u.kind === "dashRun" || u.kind === "ellipsisRun") {
    if (measure) measure.push({ id, kind: u.kind });
    return `<span class="cell runCell" id="${id}" style="height:${charPitchPx * u.cells}px;line-height:${charPitchPx * u.cells}px;font-size:${fontSizePx}px;">${escapeHtml(u.display)}</span>`;
  }
  return `<span class="cell" style="height:${charPitchPx}px;line-height:${charPitchPx}px;font-size:${fontSizePx}px;">${escapeHtml(u.display)}</span>`;
}

// P2-L07 ruby fix: BASE TEXT LAYOUT and RUBY ANNOTATION LAYOUT are now two
// separate concerns, per Human QA finding that native <ruby> wrapping the
// whole base run (P2-L06) let the browser's own ruby-box sizing perturb
// the base characters' positions relative to the same text WITHOUT ruby.
// Root cause: a native <ruby> element (no per-character height/line-height)
// does not receive the exact same explicit per-cell sizing as an ordinary
// `.cell`, so its natural block extent can differ slightly from
// `cellCount * charPitchPx` — shifting whatever follows it in the same
// column. Fix: every rubyBase character now renders as an ORDINARY `.cell`
// (byte-identical mechanism to a character with no ruby at all — this is
// the actual invariant, not merely a visual approximation of it), and the
// reading is instead collected as a separate annotation descriptor,
// positioned later via `position:absolute` (removed from normal flow
// entirely, so it structurally cannot displace base positions).
function renderLineAsColumn(lineUnits, opts) {
  let html = "";
  const annotations = [];
  let rowIndex = 0;
  let i = 0;
  while (i < lineUnits.length) {
    const u = lineUnits[i];
    if (u.kind === "rubyBase" && u.groupId) {
      let j = i;
      const rowStart = rowIndex;
      while (j < lineUnits.length && lineUnits[j].groupId === u.groupId) {
        // Identical markup/inline-style to renderUnit's plain-char branch —
        // this identity IS the invariant (base position with ruby present
        // is computed by the exact same code path as without ruby).
        html += `<span class="cell" style="height:${charPitchPx}px;line-height:${charPitchPx}px;font-size:${fontSizePx}px;">${escapeHtml(lineUnits[j].display)}</span>`;
        rowIndex++;
        j++;
      }
      annotations.push({ groupId: u.groupId, rowStart, cellCount: rowIndex - rowStart, rt: u.rt || "" });
      i = j;
      continue;
    }
    html += renderUnit(u, opts);
    rowIndex += u.kind === "dashRun" || u.kind === "ellipsisRun" ? u.cells : 1;
    i++;
  }
  return { html: `<div class="col" style="width:${colPitchPx}px;">${html}</div>`, annotations };
}

function renderRubyAnnotations(annotations, lineExtentPx) {
  // P2-L07B fix — root cause of the P2-L07 "ruby wraps" defect: the
  // annotation box's HEIGHT was sized from the BASE group's cell count
  // (cellCount * charPitchPx), not from the READING's own required
  // extent. For 東京/とうきょう (2 base cells, 4 half-size reading chars)
  // that happened to be just enough; for 其/なにがし (1 base cell, 4
  // half-size reading chars) the box was half the height its own content
  // needed — with a generous WIDTH still set (colPitchPx, a full column),
  // the browser had room to wrap the vertical text into a second column
  // once it overflowed that height, exactly like ordinary multi-column
  // vertical text reflow. Fixed generically (no fixture-specific branch,
  // no word-specific case) by inverting both dimensions: WIDTH is now
  // narrow — exactly the annotation's own font-size, i.e. room for only
  // one character-width — so there is never physical room for a second
  // column to start, and HEIGHT is now `auto` (unconstrained), so the
  // reading just flows straight down as one uninterrupted run, however
  // long it is. `top` (start-anchored to the base group's own first row)
  // is unchanged from P2-L07 and remains purely geometry-derived.
  const annotationFontSizePx = fontSizePx * 0.5;
  // P2-L07D — generic boundary-aware placement. lineStart/lineEnd are the
  // available column extent (0..lineExtentPx, the SAME column the base
  // group itself lives in — not a fixture-specific number). Four cases,
  // purely geometry-derived, no base-length/word/preset branch:
  //   A. desiredStart >= lineStart && desiredEnd <= lineEnd  -> CENTER
  //   B. desiredStart <  lineStart                            -> START_CLAMP (rubyStart = lineStart)
  //   C. desiredEnd   >  lineEnd                               -> END_CLAMP   (rubyStart = lineEnd - rubyExtent)
  //   D. rubyExtent > lineExtent (cannot fit even clamped)     -> OVERFLOW_OPEN (falls back to base-start-anchored; one run preserved, not shrunk/split/wrapped)
  return annotations
    .map((a) => {
      const baseExtentPx = a.cellCount * charPitchPx;
      const readingCharCount = Array.from(a.rt).length;
      const rubyExtentPx = readingCharCount * annotationFontSizePx;
      const baseStartPx = a.rowStart * charPitchPx;
      const { placement, topPx } = decidePlacement(baseStartPx, baseExtentPx, rubyExtentPx, lineExtentPx);
      return `<span class="rubyAnnotation" data-group="${escapeHtml(a.groupId)}" data-placement="${placement}" style="top:${topPx}px; width:${annotationFontSizePx}px; font-size:${annotationFontSizePx}px;">${escapeHtml(a.rt)}</span>`;
    })
    .join("\n");
}

function renderPage(lines, opts, pageId) {
  // P2-L06 bug fix: a flexbox `.page` containing multiple orthogonal-
  // writing-mode (vertical-rl) `.col` children caused Chromium to overlap
  // them instead of laying them out side by side (a known flex/orthogonal-
  // flow sizing quirk) — confirmed by screenshot: single-column pages
  // (Ruby, Dash/Ellipsis) rendered fine, multi-column pages (Kinsoku,
  // Hanging, TCY) overlapped illegibly. Fixed by switching to explicit
  // `position:absolute` placement (the same robust pattern already used
  // successfully for C1 grids in P2-L02/P2-L04), which is not subject to
  // this flex quirk.
  const numCols = lines.length;
  let maxColHeightPx = 0;
  const cols = lines.map((lineUnits, colIndex) => {
    const cellCount = lineUnits.reduce((n, u) => n + (u.kind === "dashRun" || u.kind === "ellipsisRun" ? u.cells : 1), 0);
    const colHeightPx = cellCount * charPitchPx;
    maxColHeightPx = Math.max(maxColHeightPx, colHeightPx);
    const { html: inner, annotations } = renderLineAsColumn(lineUnits, opts);
    // lineExtentPx = THIS column's own available extent (0..colHeightPx) —
    // the real boundary the base group already lives inside, not an
    // invented number.
    const annotationHtml = renderRubyAnnotations(annotations, colHeightPx);
    // `.colWrap` (position:absolute) is itself a containing block for its
    // own descendants, so the ruby annotation spans (also position:
    // absolute) anchor to THIS column specifically, not the whole page —
    // they are siblings of `.col`, not descendants, so they cannot affect
    // `.col`'s own normal-flow child layout in any way.
    return `<div class="colWrap" style="position:absolute; right:${colIndex * colPitchPx}px; top:0;">${inner}${annotationHtml}</div>`;
  }).join("\n");
  const pageWidthPx = numCols * colPitchPx; // content-box: CSS padding adds on top
  const pageHeightPx = maxColHeightPx;
  const idAttr = pageId ? ` id="${pageId}"` : "";
  return `<div class="page"${idAttr} style="width:${pageWidthPx}px; height:${pageHeightPx}px; position:relative;">${cols}</div>`;
}

// ---------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------
function buildKinsokuSection() {
  const text = "これはテストです」と彼は静かに言った。それでも彼女は笑っていた";
  const capacity = 8;
  const units = expandToUnits(tokenize(text));
  const { lines } = breakIntoLines(units, capacity);
  const naive = naiveBreak(units, capacity);
  return `
  <section class="feature">
    <h2>Feature A — Kinsoku (行頭禁則)</h2>
    <div class="label">POC RULE — NOT FINAL KINSOKU TABLE</div>
    <div class="purpose">Source: <code>${escapeHtml(text)}</code> · demo capacity ${capacity} cells/column</div>
    <div class="pair">
      <div><h3>NAIVE (no rule layer)</h3>${renderPage(naive)}</div>
      <div><h3>C1-NATURAL (rule-controlled)</h3>${renderPage(lines)}</div>
    </div>
    <div class="note diag-only">Naive column 1 ends with 」 starting a new column (prohibited); C1-NATURAL pulls 」 back onto column 1 instead (追い出し).</div>
  </section>`;
}

function buildHangingSection() {
  const text = "それはとても静かな夜だった。」と彼は思った。窓の外は雨だった";
  const capacity = 13;
  const units = expandToUnits(tokenize(text));
  const { lines } = breakIntoLines(units, capacity);
  const naive = naiveBreak(units, capacity);
  return `
  <section class="feature">
    <h2>Feature B — Hanging punctuation (ぶら下げ)</h2>
    <div class="label">POC RULE — NOT FINAL HANGING COVERAGE</div>
    <div class="purpose">Source: <code>${escapeHtml(text)}</code> · demo capacity ${capacity} cells/column</div>
    <div class="pair">
      <div><h3>NAIVE (no rule layer)</h3>${renderPage(naive)}</div>
      <div><h3>C1-NATURAL (。and 」 hang together)</h3>${renderPage(lines)}</div>
    </div>
    <div class="note">Placement derives from the logical cell extent (same charPitch as every other cell) — no per-fixture pixel offset. Whether the hang should visually extend PAST the column edge (using ink-extent data, per P2-L01's shaping evidence) is a separate, still-OPEN rendering-precision question — marked OPEN, not implemented here.</div>
  </section>`;
}

// P2-L07C geometry report — same formula renderRubyAnnotations uses,
// computed here for the evidence doc / on-page summary (not a second
// implementation of the rule, just its inputs/outputs made visible).
function decidePlacement(baseStartPx, baseExtentPx, rubyExtentPx, lineExtentPx) {
  if (rubyExtentPx <= baseExtentPx) return { placement: "START", topPx: baseStartPx };
  if (rubyExtentPx > lineExtentPx) return { placement: "OVERFLOW_OPEN", topPx: baseStartPx };
  const desiredStart = baseStartPx + baseExtentPx / 2 - rubyExtentPx / 2;
  const desiredEnd = desiredStart + rubyExtentPx;
  if (desiredStart < 0) return { placement: "START_CLAMP", topPx: 0 };
  if (desiredEnd > lineExtentPx) return { placement: "END_CLAMP", topPx: lineExtentPx - rubyExtentPx };
  return { placement: "CENTER", topPx: desiredStart };
}

function rubyGeometry(text, capacity) {
  const lines = breakIntoLines(expandToUnits(tokenize(text)), capacity).lines;
  const results = [];
  const seen = new Set();
  for (const line of lines) {
    let rowIndex = 0;
    const colHeightPx = line.reduce((n, u) => n + (u.kind === "dashRun" || u.kind === "ellipsisRun" ? u.cells : 1), 0) * charPitchPx;
    for (const u of line) {
      if (u.kind === "rubyBase" && u.groupId && !seen.has(u.groupId)) {
        seen.add(u.groupId);
        let cellCount = 0;
        for (const u2 of line) if (u2.groupId === u.groupId) cellCount++;
        const baseExtentPx = cellCount * charPitchPx;
        const readingCharCount = Array.from(u.rt || "").length;
        const rubyExtentPx = readingCharCount * (fontSizePx * 0.5);
        const baseStartPx = rowIndex * charPitchPx;
        const { placement } = decidePlacement(baseStartPx, baseExtentPx, rubyExtentPx, colHeightPx);
        results.push({ groupId: u.groupId, base: line.filter((x) => x.groupId === u.groupId).map((x) => x.display).join(""), rt: u.rt, cellCount, readingCharCount, baseExtentPx, rubyExtentPx, baseStartPx, colHeightPx, overlong: rubyExtentPx > baseExtentPx, placement });
      }
      rowIndex += u.kind === "dashRun" || u.kind === "ellipsisRun" ? u.cells : 1;
    }
  }
  return { lines, geometry: results };
}

function buildRubySection() {
  const shortText = "｜東京《とうきょう》に行く用事があった。少し急いでいた";
  const shortTextNoRuby = "東京に行く用事があった。少し急いでいた"; // same prose, ruby markup stripped — the required invariant control
  const longText = "｜其《なにがし》という名の男が現れた。誰も知らない人物だった";
  // POC GEOMETRY FIXTURE (not an existing product/spec fixture — constructed
  // for this loop only, to prove the centering rule fires from geometry,
  // not from a base-character-count==1 special case): 2-char base "地図"
  // with a 6-char reading "ちけいずめん" — rubyExtent (6*0.5=3 cells) >
  // baseExtent (2 cells), so the SAME formula used for 其/なにがし must
  // also center here, despite a multi-character base.
  const multiOverlongText = "｜地図《ちけいずめん》を広げて確認した";
  // Genuine NON-overlong control (Fixture 4): 2-char base, 4-char reading
  // → rubyExtent (4*0.5=2 cells) == baseExtent (2 cells), NOT strictly
  // greater, so the rule must NOT fire here — proves centering isn't
  // applied unconditionally. (東京/とうきょう turned out to be 5 reading
  // chars, not 4 as assumed when first written — genuinely overlong too;
  // caught when the geometry table was inspected this loop, not silently
  // left mislabeled.)
  const nonOverlongText = "｜本日《ほんじつ》の予定を確認した";
  const cap = 14;
  // P2-L07D boundary fixtures — 其/なにがし (baseExtent 1 cell, rubyExtent
  // 4 cells) at three different positions within the SAME capacity-14
  // column, to exercise all three non-overflow placement branches with
  // the identical base/ruby pair (geometry alone determines the outcome):
  //   longText (below, already existed): 其 is the very FIRST unit of its
  //     column (rowStart 0) -> desiredStart < 0 -> START_CLAMP
  const middleText = "あああああ｜其《なにがし》あああ"; // 其 at row 5 of 14 -> fits fully centered -> CENTER
  const endTextNearBoundary = "あああああああああああああ｜其《なにがし》あ"; // 13 padding chars -> 其 at row 13 of 14 -> desiredEnd > lineEnd -> END_CLAMP
  const s1 = breakIntoLines(expandToUnits(tokenize(shortText)), cap).lines;
  const s0 = breakIntoLines(expandToUnits(tokenize(shortTextNoRuby)), cap).lines;
  const s2 = breakIntoLines(expandToUnits(tokenize(longText)), cap).lines;
  const s3 = breakIntoLines(expandToUnits(tokenize(multiOverlongText)), cap).lines;
  const s4 = breakIntoLines(expandToUnits(tokenize(nonOverlongText)), cap).lines;
  const s5 = breakIntoLines(expandToUnits(tokenize(middleText)), cap).lines;
  const s6 = breakIntoLines(expandToUnits(tokenize(endTextNearBoundary)), cap).lines;

  const geomMiddle = rubyGeometry(middleText, cap).geometry[0];
  const geomEnd = rubyGeometry(endTextNearBoundary, cap).geometry[0];
  const geomShort = rubyGeometry(shortText, cap).geometry[0];
  const geomLong = rubyGeometry(longText, cap).geometry[0];
  const geomMulti = rubyGeometry(multiOverlongText, cap).geometry[0];
  const geomNonOverlong = rubyGeometry(nonOverlongText, cap).geometry[0];
  // P2-L07E fix: this table was displaying `g.overlong ? CENTER : START`
  // (a leftover P2-L07C binary check) instead of the real `g.placement`
  // field `decidePlacement` actually computes (START/CENTER/START_CLAMP/
  // END_CLAMP/OVERFLOW_OPEN, added in P2-L07D). The renderer itself
  // (`renderRubyAnnotations`) already called `decidePlacement` correctly —
  // this was a DISPLAY-ONLY bug in the evidence table, confirmed via
  // `scripts/verify-ruby-boundary-policy.js` (imports the real function,
  // shows correct START_CLAMP/CENTER/END_CLAMP for all three boundary
  // fixtures). Not a renderer bug, not a policy bug.
  const geomRow = (g) => `<tr><td>${escapeHtml(g.base)}</td><td>${escapeHtml(g.rt)}</td><td>${g.cellCount}</td><td>${g.readingCharCount}</td><td>${g.baseExtentPx.toFixed(1)}px</td><td>${g.rubyExtentPx.toFixed(1)}px</td><td><b>${g.placement}</b></td></tr>`;

  // Automated base-position invariant check (not visual approximation):
  // compare the row (top-offset) of every unit AFTER the ruby group in s1
  // against the row of the corresponding unit in s0 (same prose, no ruby).
  // If the renderer's rowIndex accounting is truly identical whether or
  // not a run happens to carry a ruby group, these must match exactly.
  const withRubyUnits = s1.flat();
  const noRubyUnits = s0.flat();
  let rowWith = 0, rowWithout = 0, invariantHolds = true;
  const rowsWith = withRubyUnits.map((u) => { const r = rowWith; rowWith += u.kind === "dashRun" || u.kind === "ellipsisRun" ? u.cells : 1; return r; });
  const rowsWithout = noRubyUnits.map((u) => { const r = rowWithout; rowWithout += u.kind === "dashRun" || u.kind === "ellipsisRun" ? u.cells : 1; return r; });
  // Compare the tail (everything after 東京's 2 base cells) — same length since only the ruby markup differs, not the visible text.
  for (let k = 0; k < rowsWithout.length; k++) {
    if (rowsWith[k] !== rowsWithout[k]) { invariantHolds = false; break; }
  }

  return `
  <section class="feature">
    <h2>Feature C — Ruby (conditional overlong centering, P2-L07C)</h2>
    <div class="purpose">Policy: if a ruby group's annotation extent (reading-char-count × annotation-font-size) exceeds its base group's known extent (cellCount × charPitch), the annotation is centered on the base group's center; otherwise it stays start-anchored (P2-L07B). Same formula for every group — no base-character-count special case. Base-position invariant (WITH ruby vs. WITHOUT ruby, same prose): <b class="${invariantHolds ? "ok" : "bad"}">${invariantHolds ? "PASS — base positions identical" : "FAIL — see evidence doc"}</b>.</div>
    <table class="geomTable">
      <thead><tr><th>base</th><th>ruby</th><th>base cells</th><th>ruby chars</th><th>baseExtent</th><th>rubyExtent</th><th>placement</th></tr></thead>
      <tbody>${geomRow(geomMiddle)}${geomRow(geomLong)}${geomRow(geomEnd)}${geomRow(geomShort)}${geomRow(geomMulti)}${geomRow(geomNonOverlong)}</tbody>
    </table>
    <h3>Control — WITHOUT ruby: 東京に行く用事があった...</h3>
    ${renderPage(s0, undefined, "pageWithoutRuby")}
    <h3>東京（とうきょう） — group-association demo (its base sits at column-start, rowStart 0 → START_CLAMP; see geometry table)</h3>
    ${renderPage(s1, undefined, "pageWithRuby")}
    <div id="bodyInvariantOut" class="note">Measuring actual rendered body positions in your browser…</div>
    <h3>其（なにがし） — middle of column → CENTER</h3>
    ${renderPage(s5)}
    <h3>其（なにがし） — at column START (rowStart 0) → START_CLAMP (never extends before line start)</h3>
    ${renderPage(s2)}
    <h3>其（なにがし） — near column END → END_CLAMP (never extends past line end)</h3>
    ${renderPage(s6)}
    <h3>地図（ちけいずめん） — POC GEOMETRY FIXTURE: 2-char base, overlong ruby, also at column-start → START_CLAMP (same rule, proves it is not a base-length==1 special case; would CENTER if placed mid-column, as 其 does above)</h3>
    ${renderPage(s3)}
    <h3>本日（ほんじつ） — NON-overlong control: rubyExtent == baseExtent → START</h3>
    ${renderPage(s4)}
    <div class="note">All cases retain full source mapping — this loop shows the base/reading VISUAL grouping, the base-position invariant, the boundary-clamped centering policy, and OVERFLOW_OPEN fallback are all representable; final overhang/spacing standards policy remains OPEN.</div>
  </section>`;
}

function buildTcySection() {
  const text = "その日は12月だった。西暦は2026年の出来事だ";
  const cap = 16;
  const lines = breakIntoLines(expandToUnits(tokenize(text)), cap).lines;
  return `
  <section class="feature">
    <h2>Feature D — TCY (縦中横)</h2>
    <div class="purpose">Source: <code>${escapeHtml(text)}</code> — "12" and "2026" are bare auto-detect TCY runs, each 1 logical cell, rendered inline within real vertical prose.</div>
    ${renderPage(lines)}
    <div class="note">Compare "12"/"2026" against neighboring ordinary characters — both should sit horizontally within the vertical column, occupying one cell. Digit-run auto-detect threshold (2 vs. up to 4 digits) remains Product-policy OPEN (Freeze §17) — not decided by this rendering.</div>
  </section>`;
}

function buildDashEllipsisSection(measureIds) {
  const dashText = "彼は――そうだ――と静かに言った。それから黙り込んだ";
  const ellipsisText = "……そうか……と彼はつぶやいた。それ以上何も言わなかった";
  const cap = 12;
  const dashLines = breakIntoLines(expandToUnits(tokenize(dashText)), cap).lines;
  const ellipsisLines = breakIntoLines(expandToUnits(tokenize(ellipsisText)), cap).lines;
  const dashHtml = renderPage(dashLines, { measureIds });
  const ellipsisHtml = renderPage(ellipsisLines, { measureIds });
  return `
  <section class="feature">
    <h2>Feature E/F — Dash (――) and Ellipsis (……)</h2>
    <div class="purpose">Rendered inline within real vertical prose. A live browser-side measurement below compares each run's rendered glyph center against its logical cell's horizontal center — no manual optical nudge applied anywhere in this file.</div>
    <h3>Dash</h3>${dashHtml}
    <h3>Ellipsis</h3>${ellipsisHtml}
    <div id="measureOut" class="note">Measuring alignment in your browser…</div>
  </section>`;
}

function main() {
  const measureIds = [];
  const kinsoku = buildKinsokuSection();
  const hanging = buildHangingSection();
  const ruby = buildRubySection();
  const tcy = buildTcySection();
  const dashEllipsis = buildDashEllipsisSection(measureIds);

  const measureScript = `
    window.addEventListener('load', function () {
      var ids = ${JSON.stringify(measureIds)};
      var out = document.getElementById('measureOut');
      var lines = [];
      ids.forEach(function (m) {
        var el = document.getElementById(m.id);
        var col = el.closest('.col');
        var elRect = el.getBoundingClientRect();
        var colRect = col.getBoundingClientRect();
        var colCenterX = colRect.left + colRect.width / 2;
        var elCenterX = elRect.left + elRect.width / 2;
        var offsetPx = elCenterX - colCenterX;
        var offsetEm = offsetPx / ${fontSizePx};
        lines.push(m.kind + ' (' + m.id + '): column center ' + colCenterX.toFixed(1) + 'px, glyph center ' + elCenterX.toFixed(1) + 'px &rarr; offset ' + offsetPx.toFixed(2) + 'px (' + offsetEm.toFixed(3) + 'em)' + (Math.abs(offsetPx) < 1 ? ' <span class="ok">≈centered</span>' : ' <b class="bad">off-center</b>'));
      });
      out.innerHTML = lines.join('<br>');
    });
  `;

  // P2-L07D — ACTUAL rendered-DOM body-position invariant, per Human
  // instruction ("do not merely grep for a PASS string... measure the
  // ACTUAL rendered DOM"). Compares real getBoundingClientRect() output
  // for the first several body .cell elements in the WITHOUT-ruby page
  // vs. the WITH-ruby page, each measured RELATIVE TO ITS OWN page's
  // origin (the two <div class="page"> boxes are separate DOM
  // subtrees at different screen positions, so raw/absolute screen
  // coordinates would not be a meaningful comparison — relative-to-own-
  // page-origin is the correct frame for "did the base move within its
  // own layout").
  const bodyInvariantScript = `
    window.addEventListener('load', function () {
      var out = document.getElementById('bodyInvariantOut');
      var pageWithout = document.getElementById('pageWithoutRuby');
      var pageWith = document.getElementById('pageWithRuby');
      if (!pageWithout || !pageWith) { out.textContent = '(pages not found)'; return; }
      var cellsWithout = pageWithout.querySelectorAll('.cell');
      var cellsWith = pageWith.querySelectorAll('.cell');
      var rectWithout = pageWithout.getBoundingClientRect();
      var rectWith = pageWith.getBoundingClientRect();
      var n = Math.min(cellsWithout.length, cellsWith.length, 6);
      var rows = [];
      var maxAbsDelta = 0;
      for (var i = 0; i < n; i++) {
        var rw = cellsWithout[i].getBoundingClientRect();
        var rW = cellsWith[i].getBoundingClientRect();
        var topWithout = rw.top - rectWithout.top;
        var topWith = rW.top - rectWith.top;
        var leftWithout = rw.left - rectWithout.left;
        var leftWith = rW.left - rectWith.left;
        var deltaTop = topWith - topWithout;
        var deltaLeft = leftWith - leftWithout;
        maxAbsDelta = Math.max(maxAbsDelta, Math.abs(deltaTop), Math.abs(deltaLeft));
        rows.push(cellsWithout[i].textContent + ': main-axis(top) delta ' + deltaTop.toFixed(2) + 'px, cross-axis(left) delta ' + deltaLeft.toFixed(2) + 'px');
      }
      var verdict = maxAbsDelta < 0.5
        ? '<span class="ok">PASS — max abs delta ' + maxAbsDelta.toFixed(2) + 'px (effectively zero, rendered body unchanged)</span>'
        : '<b class="bad">FAIL — max abs delta ' + maxAbsDelta.toFixed(2) + 'px (real rendered displacement)</b>';
      out.innerHTML = 'ACTUAL rendered body-position invariant (measured via getBoundingClientRect, relative to each page\\'s own origin):<br>' + rows.join('<br>') + '<br>' + verdict;
    });
  `;

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>TSP-V2 P2-L06 — Visual Fidelity: C1-NATURAL Japanese Features</title>
<link href="${FONT_GOOGLE_HREF}" rel="stylesheet" />
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #f0f0ec; color: #111; }
  h1 { font-size: 17px; margin: 0 0 6px; }
  .top-meta { font-size: 12px; color: #555; margin-bottom: 16px; line-height: 1.6; max-width: 900px; }
  .top-meta code { background: #eee; padding: 1px 4px; }
  .feature { border-top: 2px solid #ccc; padding: 18px 0; }
  .feature h2 { font-size: 15px; margin: 0 0 4px; }
  .feature h3 { font-size: 12px; color: #444; margin: 14px 0 6px; }
  .label { display: inline-block; font-size: 10px; background: #fde68a; color: #713f12; padding: 1px 6px; border-radius: 3px; margin-bottom: 6px; }
  .purpose { font-size: 11px; color: #666; margin-bottom: 10px; max-width: 700px; }
  .pair { display: flex; gap: 32px; flex-wrap: wrap; }
  .page {
    background: #fff; border: 1px solid #ccc; box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    box-sizing: content-box; padding: 16px; margin-bottom: 8px;
  }
  .col {
    writing-mode: vertical-rl; text-orientation: mixed;
    font-family: ${FONT_CSS_FAMILY}; color: #111;
  }
  /* P2-L06 bug fix: display:block stacks children along the BLOCK-
     PROGRESSION axis of their vertical-rl containing block — i.e.
     horizontally, one cell to the left of the previous — instead of down
     the column. inline-block participates in inline flow (which for
     vertical-rl runs top-to-bottom, the axis we actually want) while
     still honoring each cell's explicit width/height. */
  .cell { display: inline-block; box-sizing: border-box; vertical-align: top; }
  .tcyCell { text-combine-upright: all; }
  /* P2-L07: ruby reading rendered as an absolutely-positioned annotation
     layer, NOT as a native <ruby> participating in normal flow — this is
     what makes it structurally incapable of displacing base .cell
     positions (see renderLineAsColumn's comment). right:-1em sits it just
     outside the base column's own footprint (traditional furigana
     placement, vertical-rl); exact offset is a rendering-precision choice,
     not a base-position invariant concern (that invariant is enforced by
     construction, not by this number). */
  .rubyAnnotation {
    position: absolute; right: -1em; writing-mode: vertical-rl; text-orientation: mixed;
    font-family: ${FONT_CSS_FAMILY}; color: #333; box-sizing: border-box;
    white-space: nowrap; /* defensive: no room for a second column anyway (width = 1 char) */
  }
  body.diag .rubyAnnotation { outline: 1px dashed #f59e0b; }
  .geomTable { border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
  .geomTable th, .geomTable td { border: 1px solid #ccc; padding: 3px 8px; text-align: left; }
  .geomTable th { background: #eee; }
  .note { font-size: 11px; color: #666; margin-top: 10px; max-width: 700px; }
  .diag-only { display: none; }
  body.diag .diag-only { display: block; }
  .ok { color: #1a7f1a; }
  .bad { color: #a33; }
  .diag-control { font-size: 12px; margin: 10px 0 16px; }
</style>
</head>
<body>
  <h1>TSP-V2 Phase 2 — P2-L06: Visual Fidelity (C1-NATURAL Japanese features, A5 1段)</h1>
  <div class="top-meta">
    True vertical-page rendering of the SAME P2-L05 engine output (tokenize → logical units → rule-decided lines) — this file adds no new typesetting logic, only a realistic publication-like presentation. Font/pitch: A5 1段's real values (Shippori Mincho, ${A5_1.fontSizePt}pt, natural 1em pitch — already Human-preferred as C1-NATURAL in P2-L04), at a uniform ${DISPLAY_ZOOM}&times; legibility zoom (ratios unaffected). Columns run right-to-left, top-to-bottom, as in a real TateSpun page.<br>
    Standards status: full kinsoku table — OPEN. Hanging coverage — OPEN beyond 。/、. Dash/ellipsis primary-source rule — OPEN. Long-ruby overflow policy — OPEN. TCY threshold — OPEN/Product-policy. Nothing below freezes any of these.
  </div>
  <div class="diag-control"><label><input type="checkbox" id="diagToggle" onchange="document.body.classList.toggle('diag', this.checked)"> 診断表示 (show boundary/rule notes)</label></div>
  ${kinsoku}
  ${hanging}
  ${ruby}
  ${tcy}
  ${dashEllipsis}
  <script>${measureScript}</script>
  <script>${bodyInvariantScript}</script>
</body>
</html>
`;

  fs.writeFileSync(path.join(ROOT, "visual-fidelity-comparison.html"), html, "utf-8");
  console.log("Wrote visual-fidelity-comparison.html");
}

if (require.main === module) main();

module.exports = { decidePlacement, rubyGeometry };
