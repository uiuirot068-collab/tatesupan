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
// FONT EMBEDDING GATE (qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md): jsPDF's
// built-in "standard 14" fonts (Helvetica/Times/Courier) carry no CJK glyph
// coverage — an actual `pdf.text()` call with Japanese text through one of
// those would throw or silently paint tofu. A real, license-cleared CJK
// font resource (Shippori Mincho, SIL OFL 1.1, embedding + redistribution
// both explicitly permitted — see the evidence doc) can now be supplied via
// the optional `fontResource` parameter below, proven viable by
// `fontPoc.test.ts`'s own isolated PoC first. `fontResource` is optional
// and paint-only: when supplied, ordinary TEXT units (one placed atom per
// character already, per Core's own composition) draw as real vector glyph
// text via jsPDF's own `text()` primitive at each atom's own already-fixed
// physical coordinate — never a screenshot, never re-measured, never
// re-positioned, never changing which coordinate Core already decided.
// RUBY/TCY/SEMANTIC_RUN/IMAGE remain vector-rectangle placeholders
// regardless (deliberately out of THIS step's scope, per instruction not to
// fully implement their own Publication-layer visual treatment yet — see
// the evidence doc's own scope boundary). When `fontResource` is omitted,
// behavior is byte-for-byte the same rectangle-only foundation this module
// already shipped (backward compatible, existing tests unmodified).

import { jsPDF } from "jspdf";
import type { PublicationDocument } from "./paintModel";

export interface PublicationFontResource {
  /** Arbitrary VFS filename jsPDF registers the font under (e.g. "ShipporiMincho-Regular.ttf"). */
  fileName: string;
  /** The font family name later code refers to via `setFont`. */
  fontName: string;
  /** Base64-encoded raw TTF bytes (never read from a browser/DOM, never re-measured). */
  base64: string;
}

export interface PublicationPdfResult {
  bytes: Uint8Array;
  pageCount: number;
}

// Approximates a CJK font's baseline as a fixed fraction of its own em-box
// height, since no real MeasurementFacts-derived baseline metric exists yet
// (qa/evidence/P3_O08_FONT_EMBEDDING_GATE.md §6 — only the fake, font-
// agnostic fixture provider exists anywhere in Core today). This is a
// disclosed approximation, not a real font-metrics value; it only affects
// where inside its own already-fixed canonical cell a glyph's baseline
// sits, never the cell's own position or extent.
const BASELINE_RATIO = 0.88;

// Refuses to emit a normal-looking publication PDF for a HOLD document —
// mirrors Preview's own HOLD structural exclusion (never silently painting
// an unresolved document as an approved layout). Throws rather than
// returning a partially-built result, since there is no "banner-only PDF
// page" concept defined by any frozen contract yet.
export function generatePublicationPdf(doc: PublicationDocument, fontResource?: PublicationFontResource): PublicationPdfResult {
  if (doc.hold) {
    throw new Error(`generatePublicationPdf: refusing to emit a Publication PDF for a HOLD document (${doc.holdReasons.join("; ")})`);
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [1, 1] });
  if (fontResource) {
    pdf.addFileToVFS(fontResource.fileName, fontResource.base64);
    pdf.addFont(fontResource.fileName, fontResource.fontName, "normal");
  }
  // jsPDF always creates one initial page at construction time (sized to
  // `format` above, a throwaway placeholder) — every real page below is
  // added explicitly with its own correct physical size, then the
  // placeholder is deleted, so the emitted document contains exactly
  // `doc.pages.length` pages, never one extra.
  doc.pages.forEach((page, i) => {
    pdf.addPage([page.widthMm, page.heightMm], "portrait");
    pdf.setPage(i + 2); // page 1 is the throwaway placeholder
    if (fontResource) pdf.setFont(fontResource.fontName);
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
          if (fontResource && unit.kind === "TEXT" && unit.text.length > 0) {
            pdf.setFontSize(unit.heightMm * (72 / 25.4)); // mm -> pt, jsPDF's own font-size unit
            pdf.text(unit.text, x + line.widthMm / 2, y + unit.heightMm * BASELINE_RATIO, { align: "center" });
          } else {
            pdf.rect(x, y, line.widthMm, unit.heightMm);
          }
        }
      }
    }
  });
  pdf.deletePage(1);

  const arrayBuffer = pdf.output("arraybuffer") as ArrayBuffer;
  return { bytes: new Uint8Array(arrayBuffer), pageCount: doc.pages.length };
}
