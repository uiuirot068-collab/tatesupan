// TYPOGRAPHY PARITY Round 8 -- diagnostic artifact, reduced scope.
//
// Data-table pages only (punctuation inventory + advance-audit summary),
// deliberately NOT an InDesign-vs-TateSpun visual overlay: this round's
// own exhaustive extractor found that its same-X run-grouping heuristic
// likely merges separate physical columns (see qa/evidence/
// TYPOGRAPHY_PARITY_YAKUMONO_MOJIKUMI.md §10), so absolute InDesign glyph
// positions are not yet reliable enough to render a trustworthy overlay.
// Building one anyway would misrepresent confidence this round does not
// have. Only what is exhaustively verified is rendered here.

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";

describe("Typography Parity Round 8 -- diagnostic artifact (reduced scope)", () => {
  it("generates the punctuation inventory + advance-audit data pages", () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [105, 148] });

    // Page 1: punctuation inventory.
    pdf.setFontSize(11);
    pdf.text("Round 8 -- InDesign punctuation inventory (exhaustive)", 8, 10, { maxWidth: 90 });
    pdf.setFontSize(9);
    const inventory: [string, number][] = [
      ["、", 22], ["。", 26], ["「", 4], ["」", 4], ["『", 0], ["』", 0],
      ["（", 0], ["）", 0], ["！", 0], ["？", 2], ["・", 0], ["――", 1],
      ["……", 1], ["！？", 0], ["？！", 0], ["。」", 0], ["、」", 0],
      ["！」", 0], ["？」", 2], ["！？」", 0], ["？！」", 0],
    ];
    let y = 20;
    for (const [cls, count] of inventory) {
      pdf.text(`${cls}   ${count > 0 ? "PRESENT" : "ABSENT"}   count=${count}`, 8, y);
      y += 5.5;
    }

    // Page 2: advance-audit summary.
    pdf.addPage([105, 148], "portrait");
    pdf.setFontSize(11);
    pdf.text("Round 8 -- real InDesign advance audit (9pt = 1em)", 8, 10, { maxWidth: 90 });
    pdf.setFontSize(9);
    const rows = [
      "Ordinary <-> ordinary: uniform 1em (9.0pt), zero exceptions",
      "Ordinary <-> punctuation: uniform 1em (9.0pt), zero exceptions",
      "〇」 (？」 question-closing-bracket): 2 real instances, both exactly 1em",
      "TJ-array adjustments found: 49x +10/1000em (~0.09pt, noise,",
      "  no punctuation correlation) + 2x -250/1000em (-2.25pt,",
      "  real, both immediately after 、 (comma) before an",
      "  ordinary kana -- CAUSE UNRESOLVED, see evidence doc SS10)",
      "",
      "All real body advances = 1em except the 2 flagged -250 cases:",
      "NO (2 real exceptions found, cause unresolved)",
    ];
    y = 20;
    for (const row of rows) { pdf.text(row, 8, y, { maxWidth: 92 }); y += 5.5; }

    const bytes = pdf.output("arraybuffer");
    expect(new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "typography-parity-yakumono-round8-diagnostic.pdf"), Buffer.from(bytes));
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
