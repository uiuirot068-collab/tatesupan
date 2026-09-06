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
});
