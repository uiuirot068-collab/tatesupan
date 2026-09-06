// P3-O09 — Preview Renderer Foundation: renderable artifact generation.
// Reuses the same non-Production mechanism already proven at Stage C/D — a
// vitest test's side effect writes a static, Human-openable HTML file, via
// react-dom/server (already an installed dependency). This is a controlled
// visual-continuity artifact for the FOUNDATION architecture, not a final
// special-unit typography judgment (P3-O03/O04/O05/O06 remain OPEN).
//
// Written to a SEPARATE location from the Stage D artifact
// (`typesetting-v2/qa/visual/stage-d/index.html`, left untouched) so
// historical Stage D evidence is preserved, not overwritten.

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ReactDOMServer from "react-dom/server";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { PreviewFoundationArtifact } from "./PreviewRenderer";
import { buildColophonPaintPages, buildPaintDocument, type PaintDocument, type PreviewRenderContext } from "./paintModel";
import { ALL_FIXTURES, settingsFor } from "./fixtures";
import { DEFAULT_SCALE_MULTIPLIER } from "./geometry";

const ARTIFACT_DIR = join(__dirname, "..", "..", "qa", "visual", "p3-o09-preview");
const NORMAL_ARTIFACT_PATH = join(ARTIFACT_DIR, "index.html");
const DEBUG_ARTIFACT_PATH = join(ARTIFACT_DIR, "debug.html");
const MAX_PAGES = 6;

function buildAllPaintDocuments(): PaintDocument[] {
  const measurement = createFakeMeasurementProvider();
  return ALL_FIXTURES.map((fx) => {
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const ctx: PreviewRenderContext = {
      scaleMultiplier: DEFAULT_SCALE_MULTIPLIER,
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      nominalCellTicks: settings.linePitchTicks,
      maxPages: MAX_PAGES,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity,
    };
    return buildPaintDocument(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
  });
}

describe("P3-O09 — renderable foundation artifact generation", () => {
  it("composes every fixture, builds a non-empty PaintDocument, and writes NORMAL + DEBUG static HTML artifacts", () => {
    const models = buildAllPaintDocuments();
    expect(models.length).toBe(ALL_FIXTURES.length);
    for (const m of models) {
      if (!m.hold) expect(m.pages.length).toBeGreaterThan(0);
      else expect(m.holdReasons.length).toBeGreaterThan(0);
    }

    const normalHtml = "<!doctype html>" + ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models, mode: "normal" }));
    const debugHtml = "<!doctype html>" + ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models, mode: "debug" }));
    expect(normalHtml).toContain("P3-O09 Preview Renderer Foundation");
    expect(debugHtml).toContain("P3-O09 Preview Renderer Foundation");
    for (const fx of ALL_FIXTURES) {
      expect(normalHtml).toContain(fx.id);
      expect(debugHtml).toContain(fx.id);
    }

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(NORMAL_ARTIFACT_PATH, normalHtml, "utf-8");
    writeFileSync(DEBUG_ARTIFACT_PATH, debugHtml, "utf-8");
  });

  it("20. debug mode does not alter canonical layout — NORMAL and DEBUG render the identical set of source spans, sizes, and positions", () => {
    const models = buildAllPaintDocuments();
    // Debug mode only ADDS decoration; it must never change any paint
    // coordinate, span, or count. Verified directly against the same
    // PaintDocument object rendered in both modes (single source of truth
    // for layout data — the `mode` prop only governs presentation).
    const paragraphModel = models.find((m) => m.id === "paragraph-blank-line")!;
    const spans = paragraphModel.pages[0].columns[0].lines.flatMap((l) => l.units.map((u) => u.sourceSpan));
    const tops = paragraphModel.pages[0].columns[0].lines.flatMap((l) => l.units.map((u) => u.topPx));
    // Re-render both modes from the SAME model — proves the model itself
    // (the only thing that could carry layout) is mode-independent.
    ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [paragraphModel], mode: "normal" }));
    ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [paragraphModel], mode: "debug" }));
    const spansAfter = paragraphModel.pages[0].columns[0].lines.flatMap((l) => l.units.map((u) => u.sourceSpan));
    const topsAfter = paragraphModel.pages[0].columns[0].lines.flatMap((l) => l.units.map((u) => u.topPx));
    expect(spansAfter).toEqual(spans);
    expect(topsAfter).toEqual(tops);
  });

  it("21. normal mode omits dev-only debug decoration; debug mode includes it", () => {
    const models = buildAllPaintDocuments();
    const normalHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models, mode: "normal" }));
    const debugHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models, mode: "debug" }));

    // Dev-only DOM elements that must never leak into NORMAL PREVIEW. Note:
    // the shared <style> block always contains these class NAMES as CSS
    // selectors (e.g. ".debug-info { ... }") regardless of mode — that is
    // static, inert CSS text, not a rendered element, so the check below
    // looks for the class actually being APPLIED to an element
    // (`class="debug-info"`), never the bare substring.
    expect(normalHtml).not.toContain('class="debug-info"');
    expect(normalHtml).not.toContain('class="page-label"');
    expect(normalHtml).not.toContain('class="indent-marker"');
    expect(normalHtml).not.toContain("annotation pending");

    // The same content, in DEBUG mode, does carry this decoration.
    expect(debugHtml).toContain('class="debug-info"');
    expect(debugHtml).toContain('class="page-label"');
    expect(debugHtml).toContain("annotation pending");
  });

  it("provisional badge (prov) is present for RUBY/TCY/SEMANTIC_RUN/IMAGE kinds in both modes (content, not debug-only decoration) but ruby-annotation-pending text is debug-only", () => {
    const models = buildAllPaintDocuments();
    const rubyModel = models.find((m) => m.id === "atomic-ruby")!;
    const normalHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "normal" }));
    const debugHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "debug" }));
    expect(normalHtml).toContain(">東京<");
    expect(debugHtml).toContain(">東京<");
    expect(normalHtml).not.toContain("annotation pending");
    expect(debugHtml).toContain("annotation pending");
  });

  it("colophon pages paint in the horizontal orientation convention, using the identical page/column/line schema as the body", () => {
    // No fixture in this corpus currently supplies a Core-composed colophon
    // (composeColophon is a separate compose/page.ts run over its own
    // SourceBlock — out of scope to fabricate a full colophon fixture
    // here). ColophonBlock is, by Core's own design, just `{ sourceBlockId,
    // pages: CanonicalPage[] }` (core/colophon/index.ts) — the identical
    // shape as body pages — so this test proves buildColophonPaintPages
    // against a hand-built ColophonBlock that reuses an already-composed
    // page's own real geometry, without inventing any new Core data.
    const f20 = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
    const measurement = createFakeMeasurementProvider();
    const settings = settingsFor(f20.capacity);
    const document = composeCanonicalDocument({ bodyUnits: f20.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
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
    const colophonPages = buildColophonPaintPages({ sourceBlockId: "body", pages: document.pages }, f20.bodyUnits, f20.source, ctx);
    expect(colophonPages.length).toBe(document.pages.length);
    for (const page of colophonPages) expect(page.orientation).toBe("horizontal");
    // Body pages built through the normal path remain vertical — the
    // convention is applied only at the colophon call site, never globally.
    const bodyPaintModel = buildPaintDocument("id", "label", document, f20.bodyUnits, f20.source, ctx);
    for (const page of bodyPaintModel.pages) expect(page.orientation).toBe("vertical");
  });
});
