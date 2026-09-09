// TYPOGRAPHY PARITY Round 9 -- human diagnostic PDF: all 22 real commas,
// the two exceptional events in local context, and TateSpun's own
// (unmodified) rendering of the same two contexts for comparison.

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";

describe("Typography Parity Round 9 -- comma quarter-em diagnostic", () => {
  it("generates the 3-page human diagnostic", () => {
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [105, 148] });

    // Page 1: all 22 commas summary.
    pdf.setFontSize(11);
    pdf.text("Round 9 -- all 22 real commas (InDesign reference)", 8, 10, { maxWidth: 90 });
    pdf.setFontSize(8);
    const rows = [
      "# prev->,->next   delta   note",
      "1  de->,->ka        1.01em  noise, span-1",
      "2  ha->,->tou       1.01em  noise, span-1",
      "3  ta->,->to        0.75em  REAL, span-2",
      "4  ba->,->do        0.75em  REAL, span-2",
      "5-21 (17 commas)    1.00em  plain Tj, zero deviation",
      "22 se->, (end)      n/a     last glyph",
      "",
      "20 of 22: exactly uniform 1em.",
      "2 of 22: negligible +0.01em noise (span-1 only).",
      "2 of 22: real 0.25em compression (span-2 only).",
    ];
    let y = 20;
    for (const r of rows) { pdf.text(r, 8, y, { maxWidth: 92 }); y += 5; }

    // Page 2: exception contexts.
    pdf.addPage([105, 148], "portrait");
    pdf.setFontSize(11);
    pdf.text("Round 9 -- the two real exceptions, local context", 8, 10, { maxWidth: 90 });
    pdf.setFontSize(9);
    y = 20;
    const contexts = [
      "Exception 1: ...合った、と言ってしまえば...",
      "  before-YPt=490.25  after-YPt=483.50",
      "  actual delta = 6.75pt = 0.75em",
      "  run position: 5/54 from start, 48/54 from end (mid-run)",
      "",
      "Exception 2: ...気づけば、どこへ行く...",
      "  before-YPt=294.50  after-YPt=287.75",
      "  actual delta = 6.75pt = 0.75em",
      "  run position: 27/54 from start, 26/54 from end (mid-run)",
      "",
      "Both sit in TJ-span-2 only. TJ-span-1's own 2 real commas",
      "(de->,->ka and ha->,->tou) show NO such compression --",
      "ruling out a fixed per-character comma rule.",
    ];
    for (const c of contexts) { pdf.text(c, 8, y, { maxWidth: 92 }); y += 5; }

    // Page 3: conclusion.
    pdf.addPage([105, 148], "portrait");
    pdf.setFontSize(11);
    pdf.text("Round 9 -- classification: D", 8, 10, { maxWidth: 90 });
    pdf.setFontSize(9);
    y = 20;
    const conclusion = [
      "InDesign paragraph-composition/justification artifact,",
      "specific to one paragraph's own layout pass -- NOT a",
      "general Japanese mojikumi rule TateSpun is missing.",
      "",
      "TateSpun's Natural Pitch (uniform 1em, no per-document",
      "justification engine) is an intentional, frozen design.",
      "Real InDesign rendering of TateSpun's own equivalent",
      "text (typography-parity-comma-quarter-em-tatespun-",
      "exception1/2.pdf) shows uniform spacing throughout, as",
      "architecturally guaranteed -- this is by design, not a",
      "defect requiring a fix.",
      "",
      "No production code changed. No Implementation Gate met.",
    ];
    for (const c of conclusion) { pdf.text(c, 8, y, { maxWidth: 92 }); y += 5; }

    const bytes = pdf.output("arraybuffer");
    expect(new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5))).toBe("%PDF-");

    const outDir = join(__dirname, "..", "..", "qa", "publication", "p3-o08");
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
    try {
      writeFileSync(join(outDir, "typography-parity-comma-quarter-em-diagnostic.pdf"), Buffer.from(bytes));
    } catch {
      /* best-effort, transient Dropbox sync lock, non-fatal */
    }
  });
});
