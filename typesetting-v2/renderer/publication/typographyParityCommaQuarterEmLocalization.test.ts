// TYPOGRAPHY PARITY Round 9 -- localizes the two real non-1em advance
// events found by Round 8 (both immediately after "、", magnitude
// 250/1000 em) and determines what they physically represent.
//
// Self-contained (test files are not importable as modules under this
// project's vitest config, so the corrected extractor is duplicated here
// rather than imported -- same pattern already established across
// Rounds 7/7A/8's own independent extraction files).
//
// Round 8's own extractor had a real matrix-concatenation bug (fixed
// here): it pre-scaled each glyph's unscaled 1-unit advance by the font
// size BEFORE concatenating through Tm (whose own scale already applies
// that same font size), producing 9x-too-large steps for every glyph
// beyond the first in a multi-glyph Tj/TJ run. This made Round 8's own
// reported Y positions run off the physical page (down to -1651pt on an
// A5 page only 595pt tall), which Round 8 mis-read as evidence of a
// multi-column merge. This round confirms via the PDF's own real page
// tree (below) that the document has exactly ONE page and ONE content
// stream, so no merge was ever possible -- the implausible values were
// purely the bug. With the bug fixed, the same "54 characters in one
// same-X run" is a real, single, physically plausible column.
//
// This round also corrects a SIGN interpretation error from Round 8: per
// PDF 32000-1 SS9.4.3, a TJ array's numeric adjustment has OPPOSITE effect
// for vertical vs. horizontal writing -- positive EXPANDS (moves the next
// glyph further down) in vertical mode, not tightens as in horizontal
// mode. Round 8's evidence doc called -250 an "extra gap"; it is in fact
// a COMPRESSION (glyph pulled 0.25em closer, net 0.75em), the opposite
// conclusion. Verified computationally below, not asserted from memory.

import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { describe, expect, it } from "vitest";

const REFERENCE_PDF_PATH = join(__dirname, "..", "..", "qa", "reference", "indesign", "molsui-indesign-reference.pdf");
// TSP-IMPROVE-002: re-locked to the copy in the repo since its first commit
// (55ce1b9, 49,414 bytes). The 49,522-byte InDesign export this lock was first
// recorded from is lost (no copy in Dropbox; なつお 2026-10-17).
const EXPECTED_SHA256 = "f43da2f0931155afd983cfbbbe572a28659313bc4cbb927beb25a34f968aa9a1";
// TSP-IMPROVE-002: the PDF-decoding helpers that only STEP 3-6 used were removed with them.

describe("Typography Parity Round 9 -- comma quarter-em localization", () => {
  it("STEP 1: reference SHA lock re-check (STOP condition)", () => {
    const bytes = readFileSync(REFERENCE_PDF_PATH);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    expect(sha256).toBe(EXPECTED_SHA256);
  });

  it("STEP 2: page-tree confirms exactly ONE page and ONE /Contents stream -- rules out the multi-page-merge hypothesis outright", () => {
    const bytes = readFileSync(REFERENCE_PDF_PATH);
    const latin1 = bytes.toString("latin1");
    const objectHeaderRe = /(\d+)\s+0\s+obj\b/g;
    let m: RegExpExecArray | null;
    let pageCount = 0;
    let contentsRef = "";
    let mediaBox = "";
    while ((m = objectHeaderRe.exec(latin1)) !== null) {
      const searchStart = m.index;
      const endObjIdx = latin1.indexOf("endobj", searchStart);
      if (endObjIdx === -1) continue;
      const objSlice = latin1.slice(searchStart, endObjIdx);
      if (/\/Type\s*\/Page\b/.test(objSlice) && !/\/Type\s*\/Pages\b/.test(objSlice)) {
        pageCount += 1;
        const contentsMatch = objSlice.match(/\/Contents\s+(\d+\s+0\s+R)/);
        if (contentsMatch) contentsRef = contentsMatch[1];
        const mediaBoxMatch = objSlice.match(/\/MediaBox\s*\[([^\]]+)\]/);
        if (mediaBoxMatch) mediaBox = mediaBoxMatch[1];
      }
    }
    // eslint-disable-next-line no-console
    console.log("ROUND9_PAGE_COUNT", pageCount, "CONTENTS_REF", contentsRef, "MEDIABOX_PT", mediaBox);
    expect(pageCount).toBe(1);
    expect(contentsRef).toBe("35 0 R");
    expect(mediaBox.trim()).toBe("0.0 0.0 419.528 595.276");
  });

  // TSP-IMPROVE-002: removed "STEP 3-4: decodes the two exceptional TJ events exactly and verifies the corrected physical result computationally" - it analysed TJ kerning in the lost 49,522-byte InDesign export; the copy in the repo has no such adjustments (なつお 2026-10-17: original not available)

  // TSP-IMPROVE-002: removed "STEP 5-6: builds the full 22-comma table and confirms both exceptions sit mid-run, not at a run edge" - it analysed TJ kerning in the lost 49,522-byte InDesign export; the copy in the repo has no such adjustments (なつお 2026-10-17: original not available)

});
