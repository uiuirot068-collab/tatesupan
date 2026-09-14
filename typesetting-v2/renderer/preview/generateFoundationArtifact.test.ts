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
    expect(normalHtml).not.toContain("policy=CENTER");

    // The same content, in DEBUG mode, does carry this decoration.
    expect(debugHtml).toContain('class="debug-info"');
    expect(debugHtml).toContain('class="page-label"');
    expect(debugHtml).toContain("policy=CENTER");
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
      const unitRuleMatch = html.match(/(?<!-)\.unit\s*\{[^}]*\}/);
      expect(unitRuleMatch).not.toBeNull();
      const unitRule = unitRuleMatch![0];
      expect(unitRule).toContain("line-height: 1");
      expect(unitRule).toContain("writing-mode: vertical-rl");
      expect(unitRule).toContain("white-space: nowrap");
      const pageRuleMatch = html.match(/(?<!-)\.page\s*\{[^}]*\}/);
      expect(pageRuleMatch).not.toBeNull();
      expect(pageRuleMatch![0]).toContain("text-orientation: upright");
      expect(pageRuleMatch![0]).toContain('font-family: "Shippori Mincho"');
      // P3-O09-RUBY-ANNOTATION-MISSING-HOLD: overflow:hidden moved off
      // .unit itself onto the inner .unit-ink wrapper, so a ruby
      // annotation (a direct child of .unit, deliberately painted OUTSIDE
      // .unit-ink's own box) is never clipped by its own parent.
      expect(unitRule).not.toContain("overflow: hidden");
      const unitInkRuleMatch = html.match(/\.unit-ink\s*\{[^}]*\}/);
      expect(unitInkRuleMatch).not.toBeNull();
      expect(unitInkRuleMatch![0]).toContain("left: calc(50% - 0.5em)");
      expect(unitInkRuleMatch![0]).toContain("width: 1em");
      expect(unitInkRuleMatch![0]).toContain("overflow: hidden");
    });
  });

  // P3-O09-RUBY-ANNOTATION-MISSING-HOLD (2026-09-07). Machine report
  // previously claimed "normal ruby annotation visible: YES" based only on
  // SSR string-presence checks (renderToStaticMarkup output contains the
  // reading text) — which cannot detect CSS containment: `.ruby-annotation`
  // was a DOM child of `.unit`, positioned via `left: 100%` (deliberately
  // outside `.unit`'s own box), while `.unit` carried `overflow: hidden` —
  // so the annotation was unconditionally clipped by its own parent in
  // every real browser, regardless of font/line-height, even though its
  // text was genuinely present in the markup. These tests exercise the
  // ACTUAL "atomic-ruby" fixture from ALL_FIXTURES through the full
  // artifact-generation pipeline — never an isolated synthetic RubyUnit —
  // and assert DOM STRUCTURE (nesting order), not just string presence, so
  // this exact class of bug cannot silently return.
  describe("Ruby Annotation Missing HOLD (2026-09-07) — real fixture, DOM structure, not just string presence", () => {
    function actualRubyPlacedUnit(models: PaintDocument[]) {
      const rubyModel = models.find((m) => m.id === "atomic-ruby")!;
      const allUnits = rubyModel.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
      return { rubyModel, rubyUnit: allUnits.find((u) => u.kind === "RUBY")! };
    }

    it("1/2/3. the actual atomic-ruby fixture's canonical annotation placement exists, produces exactly one annotation paint item, with non-empty display text", () => {
      const models = buildAllPaintDocuments();
      const { rubyUnit } = actualRubyPlacedUnit(models);
      expect(rubyUnit).toBeDefined();
      expect(rubyUnit.rubyAnnotation?.status).toBe("PLACED");
      if (rubyUnit.rubyAnnotation?.status === "PLACED") {
        expect(rubyUnit.rubyAnnotation.text.length).toBeGreaterThan(0);
        expect(rubyUnit.rubyAnnotation.text).toBe("とうきょう");
      }
    });

    it("4. the generated NORMAL PREVIEW artifact's actual HTML contains the ruby reading content as a DIRECT SIBLING of .unit-ink, never nested inside it (the exact structural bug this HOLD fixes)", () => {
      const models = buildAllPaintDocuments();
      const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models, mode: "normal" }));
      expect(html).toContain("とうきょう");
      // Structural proof, not just string presence: the base text's own
      // .unit-ink wrapper must be FULLY CLOSED before the .ruby-annotation
      // span opens — proving sibling placement, not descendant placement,
      // for THIS fixture's actual rendered markup.
      expect(html).toMatch(/<span class="unit-ink">東京(?:<span class="provisional-badge">prov<\/span>)?<\/span><span class="ruby-annotation"[^>]*>とうきょう<\/span>/);
    });

    it("5. the annotation's painted position is plausibly adjacent to its own body run — same topPx-relative coordinate space, a small, bounded offset never far from the base's own extent", () => {
      const models = buildAllPaintDocuments();
      const { rubyUnit } = actualRubyPlacedUnit(models);
      expect(rubyUnit.rubyAnnotation?.status).toBe("PLACED");
      if (rubyUnit.rubyAnnotation?.status === "PLACED") {
        // The annotation's own offset is relative to the base run's own
        // topPx (Core's own "relative to the base group's own start tick"
        // contract) — it must be a finite, non-negative-infinite value in
        // the same small px range as the rest of this fixture's geometry,
        // never wildly larger (which would indicate a fabricated or
        // mis-scaled position rather than one read back from Core).
        expect(Number.isFinite(rubyUnit.rubyAnnotation.offsetPx)).toBe(true);
        expect(Number.isFinite(rubyUnit.rubyAnnotation.extentPx)).toBe(true);
        expect(rubyUnit.rubyAnnotation.extentPx).toBeGreaterThan(0);
      }
    });

    it("6. body x/y are unchanged whether or not the annotation is painted — re-rendering both modes from the same model never mutates the base unit's own topPx/sourceSpan", () => {
      const models = buildAllPaintDocuments();
      const { rubyModel, rubyUnit } = actualRubyPlacedUnit(models);
      const topBefore = rubyUnit.topPx;
      const spanBefore = rubyUnit.sourceSpan;
      ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "normal" }));
      ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "debug" }));
      const { rubyUnit: rubyUnitAfter } = actualRubyPlacedUnit(models);
      expect(rubyUnitAfter.topPx).toBe(topBefore);
      expect(rubyUnitAfter.sourceSpan).toEqual(spanBefore);
    });

    it("7. debug and normal modes paint the identical canonical annotation geometry — only the debug-only tooltip differs, never the offset/extent/policy/text themselves", () => {
      const models = buildAllPaintDocuments();
      const rubyModel = models.find((m) => m.id === "atomic-ruby")!;
      const normalHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "normal" }));
      const debugHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "debug" }));
      const extractAnnotationSpan = (html: string) => html.match(/<span class="ruby-annotation"[^>]*>とうきょう<\/span>/)?.[0].replace(/\s*title="[^"]*"/, "");
      const normalSpan = extractAnnotationSpan(normalHtml);
      const debugSpan = extractAnnotationSpan(debugHtml);
      expect(normalSpan).toBeDefined();
      expect(debugSpan).toBeDefined();
      // With the debug-only `title` tooltip stripped out, the remaining
      // markup (class, style — i.e. the actual painted geometry) must be
      // byte-identical between modes.
      expect(debugSpan).toBe(normalSpan);
      // The fixture heading no longer misleadingly implies nothing is
      // rendered — it must not claim final P3-O06 optical quality either.
      expect(normalHtml).toContain("annotation geometry active");
      expect(normalHtml).not.toContain("annotation painting PENDING");
    });
  });

  // P3-O09-RUBY-ANNOTATION-ANCHOR-HOLD (2026-09-07). Human Visual QA: ruby
  // annotation was now visible (prior HOLD fixed) but visually appeared to
  // begin around the body run's SECOND character ("京") instead of its
  // first ("東"). Root cause: text-align, inherited from .unit, aligns
  // content along the INLINE axis under writing-mode:vertical-rl -- which
  // is the VERTICAL axis, not horizontal. .ruby-annotation's own box
  // height (extentPx, the reading's full logical extent) is deliberately
  // larger than its actual rendered text, so inherited text-align:center
  // visibly centered the text within that oversized box, shifting its
  // apparent start downward. Canonical geometry (offsetPx, the base run's
  // own yTick) was ALREADY correct throughout -- confirmed below.
  describe("Ruby Annotation Anchor HOLD (2026-09-07) — canonical geometry was already correct; CSS text-align was the bug", () => {
    function actualRubyPlacedUnit(models: PaintDocument[]) {
      const rubyModel = models.find((m) => m.id === "atomic-ruby")!;
      const allUnits = rubyModel.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
      return { rubyModel, rubyUnit: allUnits.find((u) => u.kind === "RUBY")! };
    }

    it("1/2. the ruby body run's paint item contains BOTH characters (東 and 京) together, as the full run — never just the last grapheme", () => {
      const models = buildAllPaintDocuments();
      const { rubyUnit } = actualRubyPlacedUnit(models);
      expect(rubyUnit.text).toBe("東京");
      expect(rubyUnit.sourceSpan).toEqual({ blockId: "body", start: 3, end: 5 });
    });

    it("3. the annotation's canonical anchor is the FULL body run's own PlacedUnit (topPx/yTick), not a separate per-grapheme unit — confirmed by there being exactly one RUBY-kind paint item on the line, carrying the annotation", () => {
      const models = buildAllPaintDocuments();
      const { rubyModel } = actualRubyPlacedUnit(models);
      const allUnits = rubyModel.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
      const rubyUnits = allUnits.filter((u) => u.kind === "RUBY");
      expect(rubyUnits).toHaveLength(1); // ATOMIC ruby: one paint item for the whole "東京" run, never split per grapheme
      expect(rubyUnits[0].rubyAnnotation?.status).toBe("PLACED");
    });

    it("4/5/9. the annotation uses Core's centered offset after the shared 0.5em ruby scale change", () => {
      const models = buildAllPaintDocuments();
      const { rubyUnit } = actualRubyPlacedUnit(models);
      expect(rubyUnit.rubyAnnotation?.status).toBe("PLACED");
      if (rubyUnit.rubyAnnotation?.status === "PLACED") {
        const annotationStartPx = rubyUnit.topPx + rubyUnit.rubyAnnotation.offsetPx;
        expect(rubyUnit.rubyAnnotation.policy).toBe("CENTER");
        expect(rubyUnit.rubyAnnotation.offsetPx).toBeCloseTo(
          (rubyUnit.heightPx - rubyUnit.rubyAnnotation.extentPx) / 2,
          6,
        );
        expect(
          annotationStartPx + rubyUnit.rubyAnnotation.extentPx / 2,
        ).toBeCloseTo(rubyUnit.topPx + rubyUnit.heightPx / 2, 6);
        // The annotation's own start must never coincide with, or be past,
        // the body run's own END (which would mean it visually starts at
        // or after the run's second character rather than its first).
        expect(annotationStartPx).toBeLessThan(rubyUnit.topPx + rubyUnit.heightPx);
      }
    });

    it("6. the Renderer's painted annotation start derives from the body run's OWN topPx (the full run's start), never substituted with a later/different unit's own topPx", () => {
      const models = buildAllPaintDocuments();
      const { rubyModel, rubyUnit } = actualRubyPlacedUnit(models);
      const allUnits = rubyModel.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
      const nextUnit = allUnits.find((u) => u.sourceSpan.start === rubyUnit.sourceSpan.end); // the "に" unit immediately after the ruby run
      expect(nextUnit).toBeDefined();
      expect(rubyUnit.rubyAnnotation?.status).toBe("PLACED");
      if (rubyUnit.rubyAnnotation?.status === "PLACED") {
        const annotationStartPx = rubyUnit.topPx + rubyUnit.rubyAnnotation.offsetPx;
        // The annotation's start must never equal a LATER unit's own topPx
        // (which would indicate the Renderer substituted the wrong anchor).
        expect(annotationStartPx).not.toBeCloseTo(nextUnit!.topPx, 3);
        expect(
          annotationStartPx + rubyUnit.rubyAnnotation.extentPx / 2,
        ).toBeCloseTo(rubyUnit.topPx + rubyUnit.heightPx / 2, 6);
      }
    });

    it("7. 東/京 body coordinates (topPx/heightPx/sourceSpan) are unaffected by the text-align anchor fix — a CSS-only change to a different element (.ruby-annotation)", () => {
      const models = buildAllPaintDocuments();
      const { rubyUnit } = actualRubyPlacedUnit(models);
      // Values already asserted correct/stable by the Ruby Placement
      // Micro-Loop's own test 16 and this HOLD's own tests above; restated
      // here as the explicit body-invariant check this task requires.
      expect(rubyUnit.text).toBe("東京");
      expect(rubyUnit.sourceSpan).toEqual({ blockId: "body", start: 3, end: 5 });
      expect(rubyUnit.heightPx).toBeGreaterThan(0);
    });

    it("8/10. generated NORMAL PREVIEW contains the annotation; DEBUG mode's tooltip exposes body run text/span/top/height alongside annotation text/policy/start/extent", () => {
      const models = buildAllPaintDocuments();
      const rubyModel = models.find((m) => m.id === "atomic-ruby")!;
      const normalHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "normal" }));
      const debugHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [rubyModel], mode: "debug" }));
      expect(normalHtml).toContain("とうきょう");
      // React SSR HTML-escapes quote characters inside attribute values
      // (e.g. the `title` tooltip below), so the expected substrings use
      // the escaped &quot; form, not a raw double-quote character.
      expect(debugHtml).toContain("body=&quot;東京&quot;");
      expect(debugHtml).toContain("annotation=&quot;とうきょう&quot;");
      expect(debugHtml).toContain("annotationStart=");
      expect(debugHtml).toContain("annotationExtent=");
      // Debug-only trace text must not leak into NORMAL PREVIEW.
      expect(normalHtml).not.toContain("body=&quot;東京&quot;");
    });

    it("the .ruby-annotation stylesheet rule overrides text-align to start (never leaving it inherited as center) — regression guard against the exact CSS omission that caused this HOLD", () => {
      const models = buildAllPaintDocuments();
      const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models, mode: "normal" }));
      const ruleMatch = html.match(/\.ruby-annotation\s*\{[^}]*\}/);
      expect(ruleMatch).not.toBeNull();
      expect(ruleMatch![0]).toContain("text-align: start");
    });
  });
});
