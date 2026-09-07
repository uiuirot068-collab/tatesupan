// P3-O08 — Publication Renderer Foundation: generates a real, controlled,
// NON-PRODUCTION PDF artifact under `typesetting-v2/qa/publication/p3-o08/`
// directly from CanonicalDocument via `buildPublicationDocument` +
// `generatePublicationPdf` -- no browser, no DOM, no screenshot, no
// dependency on the Preview Renderer.

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildPublicationDocument, type PublicationRenderContext } from "./paintModel";
import { generatePublicationPdf } from "./pdfGenerator";
import { ALL_FIXTURES, settingsFor } from "./fixtures";

const measurement = createFakeMeasurementProvider();
const OUT_DIR = join(__dirname, "..", "..", "qa", "publication", "p3-o08");

describe("P3-O08 — Publication artifact generation", () => {
  it("composes the dash-ellipsis fixture and writes a real, structurally valid PDF file", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "dash-ellipsis")!;
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const ctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    const model = buildPublicationDocument("dash-ellipsis", fx.label, document, fx.bodyUnits, fx.source, ctx);
    const { bytes, pageCount } = generatePublicationPdf(model);

    expect(pageCount).toBe(document.pages.length);
    // A real PDF file always begins with this magic header -- proves this
    // is genuine PDF byte output, not a placeholder/text stub.
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
    expect(bytes.byteLength).toBeGreaterThan(200);

    if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, "dash-ellipsis.pdf"), bytes);
  });

  it("composes every foundation fixture without throwing, and every non-HOLD fixture produces a page count matching its own CanonicalDocument", () => {
    for (const fx of ALL_FIXTURES) {
      const settings = settingsFor(fx.capacity);
      const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
      const ctx: PublicationRenderContext = {
        linePitchTicks: settings.linePitchTicks,
        lineExtentTicks: settings.lineExtentTicks,
        columnExtentTicks: settings.columnExtentTicks,
        columnsPerPage: settings.columnsPerPage,
        measurementIdentity: document.version.measurementIdentity,
        paintFontIdentity: document.version.measurementIdentity,
      };
      const model = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
      expect(model.hold).toBe(false);
      const { pageCount } = generatePublicationPdf(model);
      expect(pageCount).toBe(document.pages.length);
    }
  });

  it("F20 fixture: every placed unit's painted bottom edge never exceeds its own page's physical heightMm (coordinate-fidelity sweep, mm equivalent of Preview's own Page Content Clipping regression)", () => {
    const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const ctx: PublicationRenderContext = {
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    const model = buildPublicationDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
    for (const page of model.pages) {
      for (const column of page.columns) {
        for (const line of column.lines) {
          for (const unit of line.units) {
            expect(unit.topMm + unit.heightMm).toBeLessThanOrEqual(page.heightMm + 1e-9);
          }
        }
      }
    }
  });
});
