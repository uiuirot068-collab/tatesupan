// TSP-PRINT-001 — Preview body glyphs as outlines. Browser text snaps every
// glyph to whole screen pixels, so the character spacing alternated
// visibly; with an outline source the Renderer paints plain glyphs as SVG at
// their exact (fractional) cell position and keeps everything else as text.

import { describe, expect, it } from "vitest";
import ReactDOMServer from "react-dom/server";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { buildPaintDocument, type PreviewRenderContext } from "./paintModel";
import { PreviewPage, type PreviewGlyphOutlines } from "./PreviewRenderer";
import { settingsFor } from "./fixtures";
import { DEFAULT_SCALE_MULTIPLIER } from "./geometry";

const measurement = createFakeMeasurementProvider();

function paintPage(text: string) {
  const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text }]);
  const settings = settingsFor({ charsPerLine: 8, linesPerColumn: 3, columnCount: 1 });
  const document = composeCanonicalDocument({ bodyUnits: units, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
  const ctx: PreviewRenderContext = {
    scaleMultiplier: DEFAULT_SCALE_MULTIPLIER,
    linePitchTicks: settings.linePitchTicks,
    lineExtentTicks: settings.lineExtentTicks,
    columnExtentTicks: settings.columnExtentTicks,
    columnsPerPage: settings.columnsPerPage,
    nominalCellTicks: settings.linePitchTicks,
    measurementIdentity: document.version.measurementIdentity,
    paintFontIdentity: document.version.measurementIdentity,
  };
  return buildPaintDocument("id", "label", document, units, source, ctx);
}

const glyphs: PreviewGlyphOutlines = {
  unitsPerEm: 1000,
  baselineRatio: 0.88,
  outline: (g) => (g === "漢" ? { d: "M0 0L1 1Z", id: "g-kan", advance: 1000 } : g === "字" ? { d: "M0 0L2 2Z", advance: 900 } : undefined),
};

describe("TSP-PRINT-001 — Preview glyph outlines", () => {
  it("paints outlined glyphs in one SVG per line at the cell's exact place, and only those", () => {
    const model = paintPage("漢字、");
    const page = model.pages[0];
    const units = page.columns[0].lines[0].units;
    const line = page.columns[0].lines[0];
    const html = ReactDOMServer.renderToStaticMarkup(<PreviewPage page={page} fontSizePx={model.fontSizePx} mode="normal" glyphs={glyphs} />);
    expect(html.match(/class="line-glyphs"/g)).toHaveLength(1);
    const scale = model.fontSizePx / 1000;
    const kan = units.find((u) => u.text === "漢")!;
    expect(html).toContain(`<use href="#g-kan" transform="translate(${line.widthPx / 2 - (1000 * scale) / 2} ${kan.topPx + kan.heightPx * 0.88}) scale(${scale})"`);
    const ji = units.find((u) => u.text === "字")!;
    expect(html).toContain(`<path d="M0 0L2 2Z" transform="translate(${line.widthPx / 2 - (900 * scale) / 2} ${ji.topPx + ji.heightPx * 0.88}) scale(${scale})"`);
    // The outlined glyphs are no longer browser text; the comma still is.
    expect(html).not.toMatch(/<span class="unit-ink">漢<\/span>/);
    expect(html).not.toMatch(/<span class="unit-ink">字<\/span>/);
    expect(html).toMatch(/<span class="unit-ink">、<\/span>/);
  });

  it("without an outline source the Preview is browser text, as before", () => {
    const model = paintPage("漢字、");
    const html = ReactDOMServer.renderToStaticMarkup(<PreviewPage page={model.pages[0]} fontSizePx={model.fontSizePx} mode="normal" />);
    expect(html).not.toContain("line-glyphs");
    expect(html).toMatch(/<span class="unit-ink">漢<\/span>/);
  });
});
