// Stage D — renderable artifact generation. Run this file (via the
// project's own already-approved `npx vitest run` mechanism, no new
// dependency, no bundler, no server) to (re)generate the Human-openable
// static HTML artifact at typesetting-v2/qa/visual/stage-d/index.html.
// Uses react-dom/server (already an installed dependency) to render the
// React absolute-position painter (PreviewApp.tsx) to static markup —
// there is no client-side JavaScript in the output at all, so the file
// opens directly in any browser with no build step, no server, and no
// network access.

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import ReactDOMServer from "react-dom/server";
import {
  composeCanonicalDocument,
  createFakeMeasurementProvider,
  DEFAULT_RULE_SET_V2,
} from "../../core";
import { PreviewApp } from "./PreviewApp";
import { buildPreviewViewModel, type PreviewRenderContext, type PreviewViewModel } from "./viewModel";
import { ALL_FIXTURES, settingsFor } from "./fixtures";
import { DEFAULT_SCALE_MULTIPLIER } from "./geometry";

const ARTIFACT_PATH = join(__dirname, "..", "..", "qa", "visual", "stage-d", "index.html");
const MAX_PAGES = 6; // bounded page window — Preview Adapter plan §13, not full virtualization

function buildAllViewModels(): PreviewViewModel[] {
  const measurement = createFakeMeasurementProvider();
  return ALL_FIXTURES.map((fx) => {
    const settings = settingsFor(fx.capacity);
    const document = composeCanonicalDocument({
      bodyUnits: fx.bodyUnits,
      ruleSet: DEFAULT_RULE_SET_V2,
      measurement,
      settings,
    });
    const ctx: PreviewRenderContext = {
      scaleMultiplier: DEFAULT_SCALE_MULTIPLIER,
      linePitchTicks: settings.linePitchTicks,
      lineExtentTicks: settings.lineExtentTicks,
      columnExtentTicks: settings.columnExtentTicks,
      columnsPerPage: settings.columnsPerPage,
      nominalCellTicks: settings.linePitchTicks,
      maxPages: MAX_PAGES,
      measurementIdentity: document.version.measurementIdentity,
      paintFontIdentity: document.version.measurementIdentity, // no mismatch in this artifact — see viewModel.test.ts for the warning path itself
    };
    return buildPreviewViewModel(fx.id, fx.label, document, fx.bodyUnits, fx.source, ctx);
  });
}

describe("Stage D — renderable artifact generation", () => {
  it("composes every fixture, builds a non-empty view model, and writes the static HTML artifact", () => {
    const viewModels = buildAllViewModels();
    expect(viewModels.length).toBe(ALL_FIXTURES.length);
    for (const vm of viewModels) {
      // Every fixture must produce SOME visible content — either real pages, or a visible HOLD state.
      if (!vm.hold) {
        expect(vm.pages.length).toBeGreaterThan(0);
      } else {
        expect(vm.holdReasons.length).toBeGreaterThan(0);
      }
    }

    const html = "<!doctype html>" + ReactDOMServer.renderToStaticMarkup(PreviewApp({ viewModels }));
    expect(html).toContain("Stage D Preview Development Adapter");
    for (const fx of ALL_FIXTURES) {
      expect(html).toContain(fx.id);
    }

    mkdirSync(dirname(ARTIFACT_PATH), { recursive: true });
    writeFileSync(ARTIFACT_PATH, html, "utf-8");
  });

  it("the HOLD fixture is visibly marked HOLD in the artifact, not painted as an approved page", () => {
    const viewModels = buildAllViewModels();
    const holdModel = viewModels.find((vm) => vm.id === "hold-example");
    expect(holdModel?.hold).toBe(true);
    expect(holdModel?.holdReasons[0]).toContain("SINGLE_ATOM_EXCEEDS_LINE_EXTENT");
    // Regardless of what document.pages happens to contain for a HOLD
    // document (composePages still pushes a partial page/column/empty-lines
    // structure before detecting the hold), PreviewApp's own FixtureSection
    // never renders `model.pages` when `model.hold` is true — verified here
    // by confirming the rendered HTML shows the hold banner, not a page-row.
    const html = ReactDOMServer.renderToStaticMarkup(PreviewApp({ viewModels: [holdModel!] }));
    expect(html).toContain("hold-banner");
    expect(html).not.toContain('class="page-row"'); // the CSS declaration for .page-row is always present in <style>; the rendered DIV is not
  });

  it("the multi-page fixture is bounded to the configured page window, not fully mounted", () => {
    const viewModels = buildAllViewModels();
    const multiPage = viewModels.find((vm) => vm.id === "multi-page");
    expect(multiPage).toBeDefined();
    expect(multiPage!.renderedPageCount).toBeLessThanOrEqual(MAX_PAGES);
    expect(multiPage!.renderedPageCount).toBe(Math.min(multiPage!.totalPageCount, MAX_PAGES));
  });

  // Regression guard for the Human Visual QA HOLD (blank body): manuscript
  // text was present in the DOM but invisible, clipped by a `.line`
  // container whose width silently collapsed to ~0 (absolutely-positioned
  // children never contribute to an ancestor's auto/shrink-to-fit width —
  // see viewModel.ts's `ViewLine.widthPx` doc comment for the full
  // explanation). A multi-character substring check (e.g. "これは") is
  // NOT a valid way to detect this class of bug and must never be used
  // here: Core atomizes TEXT per grapheme, so consecutive characters are
  // ALWAYS in separate sibling elements and never appear contiguous in the
  // serialized HTML, bug or no bug — that is precisely the false-negative
  // that let this HOLD ship in the first place.
  it("body text is present in the DOM AND every line container has a real, non-zero width (not silently clipped)", () => {
    const viewModels = buildAllViewModels();

    let bodyPaintItemCount = 0;
    let visibleTextCharacterCount = 0;
    for (const vm of viewModels) {
      for (const page of vm.pages) {
        for (const column of page.columns) {
          for (const line of column.lines) {
            for (const unit of line.units) {
              if (unit.text.length > 0) {
                bodyPaintItemCount += 1;
                visibleTextCharacterCount += unit.text.length;
              }
            }
          }
        }
      }
    }
    expect(bodyPaintItemCount).toBeGreaterThan(0);
    expect(visibleTextCharacterCount).toBeGreaterThan(0);

    const html = ReactDOMServer.renderToStaticMarkup(PreviewApp({ viewModels }));
    // A single-character check IS valid (unlike a multi-character
    // substring) since Core places each grapheme as its own element.
    expect(html).toContain(">気<"); // from F20's canonical sentence, as an isolated element's own text content

    // Guard the actual root cause directly: every rendered `.line` element
    // must declare a real, positive pixel width, never `undefined`
    // (which React/CSS serializes as the style property being entirely
    // absent) and never `0`.
    const lineStyleWidths = [...html.matchAll(/class="line" style="right:[^;"]*;width:([^;"]*)px/g)].map((m) => Number(m[1]));
    expect(lineStyleWidths.length).toBeGreaterThan(0);
    for (const width of lineStyleWidths) {
      expect(Number.isFinite(width)).toBe(true);
      expect(width).toBeGreaterThan(0);
    }
  });

  // Regression guard for STAGE-D-FIRST-LINE-INDENT-VISUAL-HOLD: the earlier
  // bug left `indentTick` metadata present but never actually shifted any
  // painted glyph — the artifact's own indent-marker band and its first
  // glyph's `top:` must both reflect the same canonical, non-zero offset,
  // not merely reduced line capacity.
  it("10. the generated artifact HTML visibly paints the paragraph indent — the indent-marker height and the first glyph's own top match the canonical shifted position, not zero", () => {
    const viewModels = buildAllViewModels();
    const html = "<!doctype html>" + ReactDOMServer.renderToStaticMarkup(PreviewApp({ viewModels }));

    const paragraphModel = viewModels.find((vm) => vm.id === "paragraph-blank-line");
    expect(paragraphModel).toBeDefined();
    const firstLine = paragraphModel!.pages[0].columns[0].lines[0];
    expect(firstLine.indentPx).toBeGreaterThan(0);
    const expectedIndentPx = firstLine.indentPx!;
    const expectedFirstUnitTopPx = firstLine.units[0].topPx;
    expect(expectedFirstUnitTopPx).toBeCloseTo(expectedIndentPx, 6);
    expect(expectedFirstUnitTopPx).not.toBe(0);

    const markerHeights = [...html.matchAll(/class="indent-marker" style="height:([^;"]*)px"/g)].map((m) => Number(m[1]));
    expect(markerHeights.length).toBeGreaterThan(0);
    expect(markerHeights.some((h) => Math.abs(h - expectedIndentPx) < 1e-6)).toBe(true);

    const textUnitTops = [...html.matchAll(/class="unit kind-TEXT" style="top:([^;"]*)px/g)].map((m) => Number(m[1]));
    expect(textUnitTops.length).toBeGreaterThan(0);
    expect(textUnitTops.some((t) => Math.abs(t - expectedFirstUnitTopPx) < 1e-6)).toBe(true);
  });
});
