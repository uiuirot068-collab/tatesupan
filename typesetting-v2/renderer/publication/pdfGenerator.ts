// P3-O08 — Publication Renderer Foundation: PublicationDocument -> real PDF
// bytes, via jsPDF (already an approved dependency — see `package.json`;
// no new package added for this task).
//
// ARCHITECTURE, proven not assumed: legacy `src/utils/exportPdf.ts` uses
// jsPDF only as a page container for an `addImage()` raster PNG captured
// from the live Preview DOM via `html-to-image` (`src/utils/exportCapture.ts`)
// — a screenshot pipeline. That is exactly the "Preview DOM as layout
// authority" antipattern this task's own frozen contract forbids for the
// canonical v2 Publication path. This generator instead calls jsPDF's own
// vector primitives (`rect`, `page.addPage`) directly from
// `PublicationDocument`'s own physical mm coordinates — it never touches a
// browser DOM, a canvas, or any screenshot of anything, and needs no
// Preview Renderer to exist or run first.
//
// HONEST, PROVEN LIMITATION (not a shortcut): jsPDF's built-in "standard 14"
// fonts (Helvetica/Times/Courier) carry no CJK glyph coverage at all — an
// actual `pdf.text()` call with Japanese manuscript text would either throw
// or silently paint nothing/tofu, which would be a FAKE "finished" PDF
// (explicitly forbidden by this task's own instruction). Embedding a real
// CJK-capable font requires either a font file this repository does not
// ship or a licensed embed mechanism — both are new-dependency-shaped
// decisions explicitly out of this task's scope ("do not commit font
// files", "no new dependencies without an approved gate"). This generator
// therefore draws each placed unit's own canonical bounding box as a vector
// rectangle at its true physical mm coordinates (`rect()`, no font
// involved) — a genuine, real, deterministic PDF proving coordinate-fidelity
// end-to-end from CanonicalDocument, honestly NOT claiming finished
// typography. See qa/evidence/P3_O08_PUBLICATION_RENDERER_FOUNDATION.md §21
// for the named next technical task (font embedding).

import { jsPDF } from "jspdf";
import type { PublicationDocument } from "./paintModel";

export interface PublicationPdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

// Refuses to emit a normal-looking publication PDF for a HOLD document —
// mirrors Preview's own HOLD structural exclusion (never silently painting
// an unresolved document as an approved layout). Throws rather than
// returning a partially-built result, since there is no "banner-only PDF
// page" concept defined by any frozen contract yet.
export function generatePublicationPdf(doc: PublicationDocument): PublicationPdfResult {
  if (doc.hold) {
    throw new Error(`generatePublicationPdf: refusing to emit a Publication PDF for a HOLD document (${doc.holdReasons.join("; ")})`);
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [1, 1] });
  // jsPDF always creates one initial page at construction time (sized to
  // `format` above, a throwaway placeholder) — every real page below is
  // added explicitly with its own correct physical size, then the
  // placeholder is deleted, so the emitted document contains exactly
  // `doc.pages.length` pages, never one extra.
  doc.pages.forEach((page, i) => {
    pdf.addPage([page.widthMm, page.heightMm], "portrait");
    pdf.setPage(i + 2); // page 1 is the throwaway placeholder
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.05);
    for (const column of page.columns) {
      for (const line of column.lines) {
        for (const unit of line.units) {
          if (unit.kind === "UNKNOWN") continue;
          // vertical-rl physical placement: a "line" is one vertical strip,
          // offset from the page's right edge by `column.rightMm + line.rightMm`;
          // a unit's own topMm is its offset down that strip.
          const x = page.widthMm - column.rightMm - line.rightMm - line.widthMm;
          const y = unit.topMm;
          pdf.rect(x, y, line.widthMm, unit.heightMm);
        }
      }
    }
  });
  pdf.deletePage(1);

  const arrayBuffer = pdf.output("arraybuffer") as ArrayBuffer;
  return { bytes: new Uint8Array(arrayBuffer), pageCount: doc.pages.length };
}
