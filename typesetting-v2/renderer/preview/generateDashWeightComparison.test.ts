// P3-O04-DASH-SEAM-HOLD (final confirmation): Human selected candidate C
// (0.16em) from the 3-way seam-overlap comparison — continuity PASS,
// native stroke weight PASS, no dark knot or heavy doubled stroke for the
// 2-glyph "――" run. `DEFAULT_DASH_OVERLAP_EM` is now 0.16 (paintModel.ts).
// This file no longer compares candidates (per explicit instruction: do
// not reopen the thickness/overlap strategy, do not create new candidates
// unless the 3-glyph case visibly fails) — it generates a FINAL
// CONFIRMATION artifact at the single selected value, covering both the
// already-approved 2-glyph "――" run and a new required 3-glyph "―――" run,
// to prove the SAME deterministic rule generalizes correctly to N=3
// without a separate code path.

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ReactDOMServer from "react-dom/server";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildFixtureUnits, type FixturePiece } from "../../tools/compare/fixtureBuilder";
import { PreviewFoundationArtifact } from "./PreviewRenderer";
import { buildPaintDocument, DEFAULT_DASH_OVERLAP_EM, type PaintDocument, type PreviewRenderContext } from "./paintModel";
import { settingsFor } from "./fixtures";
import { DEFAULT_SCALE_MULTIPLIER } from "./geometry";

const ARTIFACT_DIR = join(__dirname, "..", "..", "qa", "visual", "p3-o04-dash-weight-comparison");
const ARTIFACT_PATH = join(ARTIFACT_DIR, "index.html");

const FIXTURES: { id: string; label: string; pieces: FixturePiece[] }[] = [
  {
    id: "dash-2glyph-final",
    label: "彼は――そう言った。 (2-glyph dash run, already Human-approved)",
    pieces: [
      { kind: "TEXT", text: "彼は" },
      { kind: "SEMANTIC_RUN", text: "――", runKind: "DASH" },
      { kind: "TEXT", text: "そう言った。" },
    ],
  },
  {
    id: "dash-3glyph-final",
    label: "彼は―――そう言った。 (3-glyph dash run, new required confirmation)",
    pieces: [
      { kind: "TEXT", text: "彼は" },
      { kind: "SEMANTIC_RUN", text: "―――", runKind: "DASH" },
      { kind: "TEXT", text: "そう言った。" },
    ],
  },
];

function buildFixtureModel(id: string, pieces: FixturePiece[]) {
  const measurement = createFakeMeasurementProvider();
  const { units, source } = buildFixtureUnits("body", pieces);
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
    // dashOverlapEm intentionally omitted -> uses DEFAULT_DASH_OVERLAP_EM,
    // exactly like the main P3-O09 artifact, proving this confirmation
    // artifact reflects the actual shipped default, not a special value.
  };
  return { document, model: buildPaintDocument(id, id, document, units, source, ctx) };
}

function findDashUnit(model: PaintDocument) {
  return model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "DASH")!;
}

describe("P3-O04 Native Dash Seam — final confirmation artifact (2-glyph + 3-glyph, selected 0.16em overlap)", () => {
  it("generates a final confirmation artifact at the selected overlap value, showing the 2-glyph and 3-glyph dash runs side by side", () => {
    expect(DEFAULT_DASH_OVERLAP_EM).toBe(0.16); // the Human-selected value, not a candidate to re-pick

    const sections = FIXTURES.map(({ id, label, pieces }) => {
      const { model } = buildFixtureModel(id, pieces);
      const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
      const bodyStart = html.indexOf("<body");
      const bodyContent = html.slice(html.indexOf(">", bodyStart) + 1, html.indexOf("</body>"));
      const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
      return { label, style: styleMatch ? styleMatch[0] : "", body: bodyContent };
    });

    const combined =
      '<!doctype html><html lang="ja"><head><meta charSet="utf-8"/><title>P3-O04 Dash Seam Final Confirmation</title>' +
      "<style>body{font-family:sans-serif;margin:0;padding:20px;background:#fafafa;} h1{font-size:16px;} h2{font-size:13px;margin:24px 0 4px;} p.desc{font-size:11px;color:#666;max-width:640px;margin:0 0 8px;} .cand{border-top:2px solid #333;padding-top:8px;}</style>" +
      "</head><body>" +
      "<h1>P3-O04 Dash Seam — Final Confirmation (selected overlap: 0.16em, Human-approved for the 2-glyph run)</h1>" +
      '<p style="font-size:12px;color:#555;">Non-Production confirmation artifact. Both dash runs below use the SAME shipped default (DEFAULT_DASH_OVERLAP_EM = 0.16em) -- no new candidates, no thickness change. The 3-glyph run proves the same deterministic per-grapheme overlap rule generalizes correctly to N=3.</p>' +
      sections.map((s) => `<div class="cand"><h2>${s.label}</h2>${s.style}${s.body}</div>`).join("") +
      "</body></html>";

    expect(combined).toContain("2-glyph dash run, already Human-approved");
    expect(combined).toContain("3-glyph dash run, new required confirmation");
    expect(combined).not.toContain("::after");
    expect(combined).not.toContain("opacity:");
    expect(combined).not.toContain("color: transparent");

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(ARTIFACT_PATH, combined, "utf-8");
  });

  it("1/2. 3-glyph run: no gap between glyph 1/2 or glyph 2/3 — each consecutive pair genuinely overlaps", () => {
    const { model } = buildFixtureModel("dash-3glyph-final", FIXTURES[1].pieces);
    const dash = findDashUnit(model);
    expect(dash.dashGlyphs).toHaveLength(3);
    const [g1, g2, g3] = dash.dashGlyphs!;
    // "Overlap" (not merely touching) means each glyph's own box begins
    // strictly before the previous glyph's own box ends.
    expect(g2.topPx).toBeLessThan(g1.topPx + g1.heightPx);
    expect(g3.topPx).toBeLessThan(g2.topPx + g2.heightPx);
  });

  it("3. the middle glyph does not become disproportionately taller/heavier than the two end glyphs — it extends on both sides by the same per-seam overlap the end glyphs extend on one side", () => {
    const { model } = buildFixtureModel("dash-3glyph-final", FIXTURES[1].pieces);
    const dash = findDashUnit(model);
    const [g1, g2, g3] = dash.dashGlyphs!;
    const fontSizePx = model.fontSizePx;
    const overlapPx = DEFAULT_DASH_OVERLAP_EM * fontSizePx;
    // End glyphs extend by overlapPx/2 beyond their own nominal share; the
    // middle glyph extends by overlapPx/2 on EACH side, i.e. overlapPx
    // total -- exactly double an end glyph's own extra height, never more.
    const nominal = dash.heightPx / 3;
    expect(g1.heightPx).toBeCloseTo(nominal + overlapPx / 2, 6);
    expect(g3.heightPx).toBeCloseTo(nominal + overlapPx / 2, 6);
    expect(g2.heightPx).toBeCloseTo(nominal + overlapPx, 6);
    expect(g2.heightPx).toBeCloseTo(g1.heightPx + overlapPx / 2, 6); // exactly double the extra, not disproportionate
  });

  it("4. the run does not become obviously too short — the first glyph starts at 0 and the last glyph's bottom exactly equals the run's own canonical heightPx", () => {
    const { model } = buildFixtureModel("dash-3glyph-final", FIXTURES[1].pieces);
    const dash = findDashUnit(model);
    const [g1, , g3] = dash.dashGlyphs!;
    expect(g1.topPx).toBe(0);
    expect(g3.topPx + g3.heightPx).toBeCloseTo(dash.heightPx, 6);
  });

  it("5. the canonical SemanticRun remains ONE unit for the 3-glyph run too — never decomposed into three logical units", () => {
    const { model } = buildFixtureModel("dash-3glyph-final", FIXTURES[1].pieces);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const dashUnits = allUnits.filter((u) => u.semanticRunKind === "DASH");
    expect(dashUnits).toHaveLength(1);
    expect(dashUnits[0].text).toBe("―――");
  });

  it("6. SourceSpan / canonical extent unchanged for the 3-glyph run — matches the canonical PlacedUnit exactly, extent equals 3 cells", () => {
    const { document, model } = buildFixtureModel("dash-3glyph-final", FIXTURES[1].pieces);
    const dash = findDashUnit(model);
    const canonicalPlaced = document.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.placedUnits))).find((p) => p.id === dash.id)!;
    expect(dash.sourceSpan).toEqual(canonicalPlaced.sourceSpan);
    expect(dash.heightPx).toBeCloseTo(model.fontSizePx * 3, 6);
  });

  it("7. surrounding text is unchanged by the 3-glyph run's own glyph-splitting — same-line neighbor coordinates follow the ordinary cumulative-advance relationship exactly", () => {
    const { model } = buildFixtureModel("dash-3glyph-final", FIXTURES[1].pieces);
    const line0 = model.pages[0].columns[0].lines[0];
    const dashIndex = line0.units.findIndex((u) => u.semanticRunKind === "DASH");
    const before = line0.units[dashIndex - 1];
    const dash = line0.units[dashIndex];
    const after = line0.units[dashIndex + 1];
    expect(dash.topPx).toBeCloseTo(before.topPx + before.heightPx, 6);
    if (after) expect(after.topPx).toBeCloseTo(dash.topPx + dash.heightPx, 6);
  });

  it("8. the ー prolonged sound mark (U+30FC) is NOT affected by the dash treatment — it composes as an ordinary TEXT unit, never gets the semantic-dash class or dashGlyphs", () => {
    const { units, source } = buildFixtureUnits("body", [{ kind: "TEXT", text: "コーヒー" }]);
    const settings = settingsFor({ charsPerLine: 10, linesPerColumn: 3, columnCount: 1 });
    const measurement = createFakeMeasurementProvider();
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
    const model = buildPaintDocument("id", "label", document, units, source, ctx);
    const allUnits = model.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units)));
    const chouonpuUnits = allUnits.filter((u) => u.text === "ー");
    expect(chouonpuUnits.length).toBeGreaterThan(0);
    for (const u of chouonpuUnits) {
      expect(u.kind).toBe("TEXT");
      expect(u.semanticRunKind).toBeUndefined();
      expect(u.dashGlyphs).toBeUndefined();
    }
    const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
    // Check that no ELEMENT actually carries these classes (the static
    // <style> block always contains the class NAMES as CSS selector text,
    // regardless of whether this fixture has any DASH unit at all — that
    // is inert CSS text, not a rendered element).
    expect(html).not.toContain('class="dash-glyph"');
    expect(html).not.toContain("semantic-dash\"");
  });
});
