// TSP-V2 Phase 2 P2-L05 — builds capability-comparison.html and the
// evidence markdown files directly from actual engine.js output (not
// hand-transcribed), so the documented trace can never drift from what
// the engine actually computed.
const fs = require("fs");
const path = require("path");
const { runCapability, tokenize } = require("./engine.js");

const ROOT = path.join(__dirname, "..");

const FIXTURES = [
  { id: "F-KINSOKU", purpose: "行頭禁則 push-out (追い出し)", text: "これはテストです」と彼は静かに言った", capacity: 8 },
  { id: "F-LINE-END", purpose: "行末禁則 (opening bracket cannot end a line)", text: "すると「静かな声が聞こえた気がした", capacity: 4 },
  { id: "F-HANGING", purpose: "ぶら下げ (hanging 。)", text: "それはとても静かな夜だった。窓の外には雪が降っていた", capacity: 13 },
  { id: "F-HANGING-BRACKET", purpose: "ぶら下げ + riding close-bracket", text: "それはとても静かな夜だった。」と彼は思った", capacity: 13 },
  { id: "F-RUBY-SHORT", purpose: "ordinary ruby", text: "｜東京《とうきょう》に行く用事があった", capacity: 10 },
  { id: "F-RUBY-LONG", purpose: "ruby longer than its base (overflow pressure)", text: "｜其《なにがし》という名の男が現れた", capacity: 6 },
  { id: "F-RUBY-BOUNDARY", purpose: "multi-char ruby base at a naive boundary", text: "あ｜東京都《とうきょうと》へ行く", capacity: 4 },
  { id: "F-TCY-BARE", purpose: "TCY: bare auto-detect + explicit [tate] notation", text: "その日は12月だった。西暦は[tate]2026[/tate]年だ", capacity: 8 },
  { id: "F-DASH-FIT", purpose: "dash run, fits whole", text: "彼は――そうだ――と静かに言った", capacity: 5 },
  { id: "F-DASH-DEFER", purpose: "dash run, must defer whole (not split)", text: "彼は――そうだ――と静かに言った", capacity: 3 },
  { id: "F-ELLIPSIS", purpose: "ellipsis run", text: "……そうか……と彼はつぶやいた", capacity: 5 },
];

function escapeHtml(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

// ---------------------------------------------------------------------
// Determinism check: run every fixture twice, compare structural result.
// ---------------------------------------------------------------------
function checkDeterminism() {
  const results = [];
  for (const f of FIXTURES) {
    const r1 = runCapability(f.text, f.capacity);
    const r2 = runCapability(f.text, f.capacity);
    const s1 = JSON.stringify(r1.lines.map((l) => l.map((u) => [u.kind, u.display, u.start, u.end])));
    const s2 = JSON.stringify(r2.lines.map((l) => l.map((u) => [u.kind, u.display, u.start, u.end])));
    results.push({ id: f.id, deterministic: s1 === s2 });
  }
  return results;
}

// ---------------------------------------------------------------------
// Evidence: break decision trace (generated from actual trace data)
// ---------------------------------------------------------------------
function buildTraceDoc(runs) {
  let md = `# P2-L05 — Break Decision Trace\n\n` +
    `- Status: Phase 2 PoC evidence, not a Phase 3 spec\n` +
    `- Generated directly from \`scripts/engine.js\` output by \`scripts/build-capability-poc.js\` — not hand-transcribed, cannot drift from what the engine actually computed.\n` +
    `- Every row is reproducible: \`node -e \"console.log(require('./scripts/engine.js').runCapability('<text>', <capacity>).trace)\"\`\n\n`;
  for (const { f, r } of runs) {
    md += `## ${f.id} — ${f.purpose}\n\n`;
    md += `Source: \`${f.text}\` · demo capacity: ${f.capacity} cells\n\n`;
    md += `| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |\n`;
    md += `|---|---|---|---|---|---|---|---|\n`;
    for (const t of r.trace) {
      const rules = t.ruleDecisions.length ? t.ruleDecisions.map((d) => d.rule).join("; ") : "(none — naive break stood)";
      md += `| ${t.lineIndex} | [${t.sourceRange[0]},${t.sourceRange[1]}) | ${t.naiveBreakUnit.kind}:"${t.naiveBreakUnit.display}"@${t.naiveBreakUnit.start} | ${t.naiveNextUnit ? `${t.naiveNextUnit.kind}:"${t.naiveNextUnit.display}"@${t.naiveNextUnit.start}` : "(end of text)"} | ${rules} | "${t.finalLineText}" | ${t.finalCellCount} | ${t.nextLineStartUnit ? `"${t.nextLineStartUnit.display}"@${t.nextLineStartUnit.start}` : "(end of text)"} |\n`;
    }
    md += `\n`;
  }
  return md;
}

// ---------------------------------------------------------------------
// Evidence: source mapping (every unit's source range, grouped)
// ---------------------------------------------------------------------
function buildSourceMappingDoc(runs) {
  let md = `# P2-L05 — Source Mapping Evidence\n\n` +
    `- Status: Phase 2 PoC evidence, not a Phase 3 spec\n` +
    `- Demonstrates that every logical unit (ordinary char, ruby-base char, TCY run, dash/ellipsis run) retains its manuscript source range (\`start\`/\`end\`, UTF-16 code-unit offsets into the original source string) all the way through tokenization, unit expansion, and line-breaking — nothing is glyph-only / source-detached.\n\n`;
  for (const { f, r } of runs) {
    md += `## ${f.id}\n\n`;
    md += `Source: \`${f.text}\`\n\n`;
    md += `| Unit kind | Display | Source [start,end) | Group |\n|---|---|---|---|\n`;
    for (const u of r.units) {
      md += `| ${u.kind} | ${escapeHtml(u.display)} | [${u.start},${u.end}) | ${u.keepTogetherGroup || u.groupId || "—"} |\n`;
    }
    md += `\n`;
  }
  return md;
}

// ---------------------------------------------------------------------
// Renderer: capability-comparison.html
// ---------------------------------------------------------------------
const FONT_CSS_FAMILY = "'Shippori Mincho', serif";
const FONT_GOOGLE_HREF = "https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap";
const CELL_PX = 32; // PoC demonstration scale only — not tied to any preset

function renderUnitCell(u) {
  if (u.kind === "rubyBase") {
    const rt = u.rt ? `<rt>${escapeHtml(u.rt)}</rt>` : "";
    return `<span class="cell rubyCell" title="ruby group ${escapeHtml(u.groupId)}"><ruby>${escapeHtml(u.display)}${rt}</ruby></span>`;
  }
  if (u.kind === "tcy") {
    return `<span class="cell tcyCell" title="TCY run, 1 cell">${escapeHtml(u.display)}</span>`;
  }
  if (u.kind === "dashRun" || u.kind === "ellipsisRun") {
    return `<span class="cell runCell" title="${u.kind}, ${u.cells} cells kept together">${escapeHtml(u.display)}</span>`;
  }
  const cats = Array.from(u.category || []);
  return `<span class="cell${cats.length ? " " + cats.join(" ") : ""}" title="${cats.join(",") || "ordinary"}">${escapeHtml(u.display)}</span>`;
}

function renderC1Natural(r) {
  const cols = r.lines.map((line) => `<div class="c1col">${line.map(renderUnitCell).join("")}</div>`).join("\n");
  return `<div class="c1nat">${cols}</div>`;
}

function renderC3Native(text) {
  return `<div class="c3block">${escapeHtml(text)}</div>`;
}

function buildFixtureSection(f, r) {
  return `
  <section class="fixture">
    <h2>${f.id}</h2>
    <div class="purpose">${escapeHtml(f.purpose)} — source: <code>${escapeHtml(f.text)}</code> — demo capacity ${f.capacity} cells (PoC scale only, not a preset value)</div>
    <div class="pair">
      <div class="col"><h3>C1-NATURAL (engine-controlled, source-mapped)</h3>${renderC1Natural(r)}</div>
      <div class="col"><h3>C3 — browser-native (no rule layer)</h3>${renderC3Native(f.text)}</div>
    </div>
    <div class="trace-summary">${r.trace.length} line(s); rule decisions fired: ${r.trace.reduce((n, t) => n + t.ruleDecisions.length, 0)}</div>
  </section>`;
}

function main() {
  const runs = FIXTURES.map((f) => ({ f, r: runCapability(f.text, f.capacity) }));
  const determinism = checkDeterminism();

  fs.writeFileSync(path.join(ROOT, "evidence", "P2_L05_BREAK_DECISION_TRACE.md"), buildTraceDoc(runs), "utf-8");
  fs.writeFileSync(path.join(ROOT, "evidence", "P2_L05_SOURCE_MAPPING.md"), buildSourceMappingDoc(runs), "utf-8");
  fs.writeFileSync(path.join(ROOT, "scripts", "determinism-check.json"), JSON.stringify(determinism, null, 2), "utf-8");

  const sections = runs.map(({ f, r }) => buildFixtureSection(f, r)).join("\n");
  const allDeterministic = determinism.every((d) => d.deterministic);

  const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<title>TSP-V2 P2-L05 — Japanese Typesetting Capability PoC</title>
<link href="${FONT_GOOGLE_HREF}" rel="stylesheet" />
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #fafaf7; color: #111; }
  h1 { font-size: 17px; margin: 0 0 6px; }
  .top-meta { font-size: 12px; color: #555; margin-bottom: 16px; line-height: 1.6; max-width: 900px; }
  .top-meta code { background: #eee; padding: 1px 4px; }
  .fixture { border-top: 2px solid #ccc; padding: 16px 0; }
  .fixture h2 { font-size: 14px; margin: 0 0 4px; }
  .purpose { font-size: 11px; color: #666; margin-bottom: 10px; max-width: 700px; }
  .pair { display: flex; gap: 28px; flex-wrap: wrap; align-items: flex-start; }
  .col h3 { font-size: 12px; color: #333; margin: 0 0 6px; }
  .c1nat { display: flex; gap: 6px; }
  .c1col {
    display: flex; flex-direction: column;
    writing-mode: vertical-rl; text-orientation: mixed;
    font-family: ${FONT_CSS_FAMILY};
    border: 1px solid #ddd; padding: 4px;
  }
  .cell { display: inline-block; width: ${CELL_PX}px; height: ${CELL_PX}px; line-height: ${CELL_PX}px; text-align: center; font-size: 18px; box-sizing: border-box; }
  .cell.lineStartProhibited { background: rgba(255,120,120,0.15); }
  .cell.lineEndProhibited { background: rgba(120,160,255,0.15); }
  .cell.hangingPunct { background: rgba(255,205,0,0.25); }
  .cell.hangingCloseBracket { background: rgba(255,205,0,0.15); }
  .rubyCell rt { font-size: 9px; }
  .tcyCell { text-combine-upright: all; }
  .runCell { letter-spacing: 0; }
  .c3block { writing-mode: vertical-rl; text-orientation: mixed; font-family: ${FONT_CSS_FAMILY}; font-size: 18px; color: #111; height: ${CELL_PX * 8}px; }
  .trace-summary { font-size: 11px; color: #888; margin-top: 10px; }
  .diag-control { font-size: 12px; margin: 10px 0 16px; }
</style>
</head>
<body>
  <h1>TSP-V2 Phase 2 — P2-L05: Japanese Typesetting Capability PoC (C1-NATURAL)</h1>
  <div class="top-meta">
    Each fixture below is rendered two ways: <b>C1-NATURAL</b> (this loop's engine — source text is tokenized into logical units, a rule-decision layer resolves kinsoku/hanging/keep-together BEFORE any position is assigned, then units are painted into an explicit per-line grid) and <b>C3</b> (plain browser-native <code>vertical-rl</code>, no rule layer — for comparison only). Highlighted cells (default off — see toggle) mark rule-relevant categories. Font: Shippori Mincho, same as prior Phase 2 loops.<br>
    Determinism check (every fixture run twice, structural output compared): <b>${allDeterministic ? "ALL DETERMINISTIC" : "MISMATCH DETECTED — see scripts/determinism-check.json"}</b>.<br>
    Full break-decision trace: <code>evidence/P2_L05_BREAK_DECISION_TRACE.md</code>. Source mapping: <code>evidence/P2_L05_SOURCE_MAPPING.md</code>. Capability matrix: <code>evidence/P2_L05_JAPANESE_CAPABILITY_MATRIX.md</code>.<br>
    <b>Standards status:</b> full kinsoku class table — OPEN. Dash/ellipsis primary-source rule — OPEN. Nothing below freezes either; see FIXTURES.md.
  </div>
  <div class="diag-control"><label><input type="checkbox" id="diagToggle" onchange="document.body.classList.toggle('diag', this.checked)"> 診断表示 (highlight rule-relevant cell categories)</label></div>
  <style>body:not(.diag) .cell.lineStartProhibited, body:not(.diag) .cell.lineEndProhibited, body:not(.diag) .cell.hangingPunct, body:not(.diag) .cell.hangingCloseBracket { background: none; }</style>
  ${sections}
</body>
</html>
`;

  fs.writeFileSync(path.join(ROOT, "capability-comparison.html"), html, "utf-8");
  console.log("Wrote capability-comparison.html, evidence docs, determinism-check.json");
  console.log("Determinism:", determinism);
}

main();
