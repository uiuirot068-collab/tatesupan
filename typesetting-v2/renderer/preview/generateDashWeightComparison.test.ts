// P3-O04-DASH-STROKE-WEIGHT-HOLD: Human Visual QA rejected the original
// dash stroke thickness (12% of the unit's own box width) as far too
// heavy. No single replacement value is objectively evidenced (Phase 2's
// own P2-L06 measurement concerned horizontal centering, not stroke
// thickness, and no Human Product decision on an exact thickness value
// exists) — per this task's own explicit instruction, this generates a
// small, non-Production, Renderer-only comparison artifact with 3
// candidate stroke thicknesses of the SAME fixture, everything else held
// identical (same font, same page scale, same canonical geometry, same
// source, same run length), so Human selection is about stroke weight
// only. This is NOT the main P3-O09 artifact and does not affect it —
// the main artifact's own interim default (0.06em, candidate B below) is
// set directly in PreviewRenderer.tsx's own stylesheet.

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ReactDOMServer from "react-dom/server";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { PreviewFoundationArtifact } from "./PreviewRenderer";
import { buildPaintDocument, type PreviewRenderContext } from "./paintModel";
import { settingsFor } from "./fixtures";
import { DEFAULT_SCALE_MULTIPLIER } from "./geometry";

const ARTIFACT_DIR = join(__dirname, "..", "..", "qa", "visual", "p3-o04-dash-weight-comparison");
const ARTIFACT_PATH = join(ARTIFACT_DIR, "index.html");

// Candidates bracket the interim default (B) chosen for the main artifact.
const CANDIDATES: { label: string; em: number }[] = [
  { label: "A — thin (0.03em)", em: 0.03 },
  { label: "B — medium-thin (0.06em, current main-artifact default)", em: 0.06 },
  { label: "C — lighter-than-original (0.09em, still far lighter than the rejected 12%/~0.12em-equivalent)", em: 0.09 },
];

function buildComparisonModel(id: string) {
  const measurement = createFakeMeasurementProvider();
  const { units, source } = buildFixtureUnits("body", [
    { kind: "TEXT", text: "彼は" },
    { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
    { kind: "TEXT", text: "そう言った。" },
  ]);
  const settings = settingsFor({ charsPerLine: 10, linesPerColumn: 3, columnCount: 1 });
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
  return buildPaintDocument(id, "彼は――そう言った。", document, units, source, ctx);
}

// Swaps ONLY the dash stroke rule's own width value in an already-rendered
// artifact's <style> block — a targeted string substitution, never a
// change to canonical geometry or to PreviewRenderer.tsx's own source for
// this comparison-only variant. Confirmed present-and-unique before
// substituting (fails loudly, not silently, if the rule ever changes shape).
function withStrokeWidth(html: string, em: number): string {
  const needle = "width: 0.06em;";
  if (!html.includes(needle)) {
    throw new Error("generateDashWeightComparison: expected dash stroke rule (width: 0.06em;) not found in rendered HTML — PreviewRenderer.tsx's own rule must have changed shape.");
  }
  return html.replace(needle, `width: ${em}em;`);
}

describe("P3-O04 Dash Stroke Weight — Human comparison artifact", () => {
  it("generates a 3-candidate, non-Production comparison of the SAME fixture, differing only in dash stroke thickness", () => {
    const model = buildComparisonModel("dash-weight-comparison");
    const baseHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));

    const sections = CANDIDATES.map(({ label, em }) => {
      const html = withStrokeWidth(baseHtml, em);
      // Extract just the rendered fixture body (after </style>) so each
      // candidate can be labeled and stacked in one combined page without
      // duplicating <html>/<head> wrappers three times.
      const bodyStart = html.indexOf("<body");
      const bodyContent = html.slice(html.indexOf(">", bodyStart) + 1, html.indexOf("</body>"));
      const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
      return { label, style: styleMatch ? styleMatch[0] : "", body: bodyContent };
    });

    const combined =
      "<!doctype html><html lang=\"ja\"><head><meta charSet=\"utf-8\"/><title>P3-O04 Dash Stroke Weight Comparison</title>" +
      "<style>body{font-family:sans-serif;margin:0;padding:20px;background:#fafafa;} h2{font-size:13px;margin:24px 0 8px;} .cand{border-top:2px solid #333;padding-top:8px;}</style>" +
      "</head><body>" +
      "<h1 style=\"font-size:16px;\">P3-O04 Dash Stroke Weight Comparison — same fixture, three candidate stroke thicknesses only</h1>" +
      "<p style=\"font-size:12px;color:#555;\">Non-Production comparison artifact. Everything except dash stroke thickness is identical: same font, same page scale, same canonical geometry, same source, same run length.</p>" +
      sections
        .map(
          (s) =>
            `<div class="cand"><h2>${s.label}</h2>${s.style}${s.body}</div>`
        )
        .join("") +
      "</body></html>";

    expect(combined).toContain("A — thin");
    expect(combined).toContain("B — medium-thin");
    expect(combined).toContain("C — lighter-than-original");
    expect(combined).toContain("width: 0.03em;");
    expect(combined).toContain("width: 0.06em;");
    expect(combined).toContain("width: 0.09em;");

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(ARTIFACT_PATH, combined, "utf-8");
  });
});
