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
    // Ruby Placement Micro-Loop: the geometry debug tooltip (policy/offset/
    // extent) is DEBUG-only decoration, even though the annotation text
    // itself is real content shown in both modes (checked separately below).
    expect(normalHtml).not.toContain("policy=OVERFLOW_OPEN");

    // The same content, in DEBUG mode, does carry this decoration.
    expect(debugHtml).toContain('class="debug-info"');
    expect(debugHtml).toContain('class="page-label"');
    expect(debugHtml).toContain("policy=OVERFLOW_OPEN");
  });

  it("ruby annotation text is real content, visible in both modes; its geometry debug tooltip is debug-only (Ruby Placement Micro-Loop)", () => {
    const models = buildAllPaintDocuments();
    const rubyModel = models.find((m) => m.id === "atomic-ruby")!;
    const normalHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "normal" }));
    const debugHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "debug" }));
    expect(normalHtml).toContain(">東京<"); // base text, both modes
    expect(debugHtml).toContain(">東京<");
    expect(normalHtml).toContain("とうきょう"); // annotation text is real content, not dev-only chrome
    expect(debugHtml).toContain("とうきょう");
    expect(normalHtml).not.toContain("policy="); // geometry tooltip stays debug-only
    expect(debugHtml).toContain("policy=");
  });

  it("19. Renderer consumes canonical ruby geometry without recalculating it — painted offset/extent/policy trace exactly to PlacedUnit's own tick fields via the single tickToPx conversion, nothing independently derived", () => {
    const models = buildAllPaintDocuments();
    const rubyModel = models.find((m) => m.id === "atomic-ruby")!;
    const allUnits = rubyModel.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const rubyUnit = allUnits.find((u) => u.kind === "RUBY")!;
    expect(rubyUnit.rubyAnnotation?.status).toBe("PLACED");
    if (rubyUnit.rubyAnnotation?.status !== "PLACED") return;
    // Re-derive the SAME fixture's raw CanonicalDocument to compare the
    // PaintDocument's px fields directly against Core's own tick fields —
    // proving the conversion is a pure, one-way tickToPx mapping with no
    // independent renderer-side placement decision.
    const fx = ALL_FIXTURES.find((f) => f.id === "atomic-ruby")!;
    const measurement = createFakeMeasurementProvider();
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({ bodyUnits: fx.bodyUnits, ruleSet: DEFAULT_RULE_SET_V2, measurement, settings });
    const canonicalPlaced = document.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.placedUnits))).find((p) => p.id === rubyUnit.id)!;
    expect(canonicalPlaced.rubyBoundaryPolicy).toBe(rubyUnit.rubyAnnotation.policy);
    expect(rubyUnit.rubyAnnotation.offsetPx).toBeCloseTo((canonicalPlaced.rubyReadingOffsetTick ?? 0) * 0.001 * (96 / 25.4) * DEFAULT_SCALE_MULTIPLIER, 6);
    expect(rubyUnit.rubyAnnotation.extentPx).toBeCloseTo((canonicalPlaced.rubyReadingExtentTick ?? 0) * 0.001 * (96 / 25.4) * DEFAULT_SCALE_MULTIPLIER, 6);
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

  // P3-O09-PAGE-CONTENT-CLIPPING-HOLD regression guards. Root cause was
  // proven NOT to be Core/view-model geometry (every placed unit's own
  // bottom/right edge is already <= its page's own heightPx/widthPx for
  // every line of F20 and every page of long-prose, checked directly
  // against PaintDocument's own px fields — Core never places content past
  // canonical page/column/line extent, and the single tickToPx conversion
  // is used consistently everywhere) — it was a CSS regression: `.unit`
  // lacked `line-height: 1` (present in the already Human-approved Stage D
  // `.unit` rule), so the browser's default line-height made each glyph's
  // own rendered line box taller than its tightly-fitted (zero-margin,
  // by-design) paint box, and `overflow: hidden` clipped the excess.
  describe("Page Content Clipping HOLD (2026-09-07) — geometry and stylesheet regression guards", () => {
    it("no placed unit's painted bottom/right edge ever exceeds its own page's heightPx/widthPx, across every fixture, page, column, and line", () => {
      const models = buildAllPaintDocuments();
      for (const model of models) {
        for (const page of model.pages) {
          for (const column of page.columns) {
            for (const line of column.lines) {
              for (const unit of line.units) {
                expect(unit.topPx + unit.heightPx).toBeLessThanOrEqual(page.heightPx + 1e-6);
              }
            }
            const lastLine = column.lines[column.lines.length - 1];
            if (lastLine) {
              expect(lastLine.rightPx + lastLine.widthPx).toBeLessThanOrEqual(page.widthPx + 1e-6);
            }
          }
        }
      }
    });

    it("F20: the last body paint item's bottom edge lands exactly at (never past) the page's own bottom edge — Natural Pitch's own zero-margin, generous-not-clipped fit", () => {
      const models = buildAllPaintDocuments();
      const f20Model = models.find((m) => m.id === "f20-canonical-sentence")!;
      const firstPage = f20Model.pages[0];
      const firstColumn = firstPage.columns[0];
      const lastLine = firstColumn.lines[firstColumn.lines.length - 1];
      const lastUnit = lastLine.units[lastLine.units.length - 1];
      expect(lastUnit.topPx + lastUnit.heightPx).toBeLessThanOrEqual(firstPage.heightPx + 1e-6);
    });

    it("F20: the complete 56-character canonical sentence is reconstructable from ordered paint items across all lines/columns/pages — nothing lost, nothing duplicated", () => {
      const fx = ALL_FIXTURES.find((f) => f.id === "f20-canonical-sentence")!;
      const expected = (fx.bodyUnits[0] as { kind: "TEXT"; text: string }).text;
      const models = buildAllPaintDocuments();
      const f20Model = models.find((m) => m.id === "f20-canonical-sentence")!;
      // TEXT is grapheme-atomized (one PaintPlacedUnit per character), so
      // reconstruction concatenates ordered paint items rather than
      // requiring any contiguous multi-character HTML substring — the same
      // convention already established at Stage D for this exact reason.
      const reconstructed = f20Model.pages
        .flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)))
        .sort((a, b) => a.sourceSpan.start - b.sourceSpan.start)
        .map((u) => u.text)
        .join("");
      expect(reconstructed).toBe(expected);
    });

    it("long-prose page 0 and page 1: no clipping, and every line's content stays within its own page bounds", () => {
      const models = buildAllPaintDocuments();
      const longProseModel = models.find((m) => m.id === "long-prose")!;
      expect(longProseModel.pages.length).toBeGreaterThanOrEqual(2); // at least page 0 and page 1 exist to check
      for (const pageIndex of [0, 1]) {
        const page = longProseModel.pages[pageIndex];
        for (const column of page.columns) {
          for (const line of column.lines) {
            for (const unit of line.units) {
              expect(unit.topPx + unit.heightPx).toBeLessThanOrEqual(page.heightPx + 1e-6);
            }
          }
        }
      }
    });

    it("the generated artifact's stylesheet gives .unit a tight line-height (1) and vertical writing-mode, matching the already Human-approved Stage D rule — regression guard against the exact CSS omission that caused this HOLD", () => {
      const models = buildAllPaintDocuments();
      const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models, mode: "normal" }));
      const unitRuleMatch = html.match(/\.unit\s*\{[^}]*\}/);
      expect(unitRuleMatch).not.toBeNull();
      const unitRule = unitRuleMatch![0];
      expect(unitRule).toContain("line-height: 1");
      expect(unitRule).toContain("writing-mode: vertical-rl");
      expect(unitRule).toContain("white-space: nowrap");
      expect(unitRule).toContain("overflow: hidden");
    });
  });
});
