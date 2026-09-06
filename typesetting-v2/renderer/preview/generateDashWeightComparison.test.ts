// P3-O04-DASH-SEAM-HOLD (fourth review): Human accepted the native-glyph
// stroke weight direction but found the run visibly discontinuous — the
// pair breaks in the middle. Root cause (qa/evidence/P3_O04_DASH_VISUAL.md
// §17): the two dash characters shared ONE text node with no independently
// positioned per-character elements, so there was nothing to close a seam
// with beyond letter-spacing. This is now resolved architecturally:
// paintModel.ts's `dashGlyphsFor` splits a DASH run's own already-canonical
// box into one real-glyph-ink paint node per grapheme, with a small,
// em-relative overlap between consecutive nodes — Renderer-paint-only,
// never touching SemanticRunUnit/SourceSpan/canonical occupancy. This file
// compares three overlap VALUES (not strategies — the strategy itself,
// per-glyph native paint, is now the actual implementation) using the real
// `dashOverlapEm` render-context parameter, not a CSS string hack.

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ReactDOMServer from "react-dom/server";
import { composeCanonicalDocument, createFakeMeasurementProvider, DEFAULT_RULE_SET_V2 } from "../../core";
import { buildFixtureUnits } from "../../tools/compare/fixtureBuilder";
import { PreviewFoundationArtifact } from "./PreviewRenderer";
import { buildPaintDocument, DEFAULT_DASH_OVERLAP_EM, type PreviewRenderContext } from "./paintModel";
import { settingsFor } from "./fixtures";
import { DEFAULT_SCALE_MULTIPLIER } from "./geometry";

const ARTIFACT_DIR = join(__dirname, "..", "..", "qa", "visual", "p3-o04-dash-weight-comparison");
const ARTIFACT_PATH = join(ARTIFACT_DIR, "index.html");

const CANDIDATES: { label: string; description: string; overlapEm: number }[] = [
  {
    label: `A — minimal overlap (0.08em)`,
    description: "Smallest overlap tried. If a seam is still visible here, a larger value is needed; if the join already looks clean, prefer this one (less overlap means less risk of a doubled-ink join).",
    overlapEm: 0.08,
  },
  {
    label: `B — moderate overlap (${DEFAULT_DASH_OVERLAP_EM}em, current interim default)`,
    description: "The value currently applied to the main P3-O09 artifact by default.",
    overlapEm: DEFAULT_DASH_OVERLAP_EM,
  },
  {
    label: "C — stronger overlap (0.16em)",
    description: "Largest overlap tried. Watch specifically for a dark knot/blob at the join or a visually doubled-heavy stroke -- if present, this candidate fails regardless of continuity.",
    overlapEm: 0.16,
  },
];

function buildComparisonModel(id: string, overlapEm: number) {
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
    dashOverlapEm: overlapEm,
  };
  return buildPaintDocument(id, "彼は――そう言った。", document, units, source, ctx);
}

describe("P3-O04 Native Dash Seam Comparison (Human comparison artifact, fourth review)", () => {
  it("generates a 3-candidate seam-overlap comparison using the real dashOverlapEm render-context parameter — same phrase, same font, same scale, only overlap differs", () => {
    const sections = CANDIDATES.map(({ label, description, overlapEm }) => {
      const model = buildComparisonModel(`dash-seam-${overlapEm}`, overlapEm);
      const html = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));
      const bodyStart = html.indexOf("<body");
      const bodyContent = html.slice(html.indexOf(">", bodyStart) + 1, html.indexOf("</body>"));
      const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
      return { label, description, style: styleMatch ? styleMatch[0] : "", body: bodyContent };
    });

    const combined =
      '<!doctype html><html lang="ja"><head><meta charSet="utf-8"/><title>P3-O04 Native Dash Seam Comparison</title>' +
      "<style>body{font-family:sans-serif;margin:0;padding:20px;background:#fafafa;} h1{font-size:16px;} h2{font-size:13px;margin:24px 0 4px;} p.desc{font-size:11px;color:#666;max-width:640px;margin:0 0 8px;} .cand{border-top:2px solid #333;padding-top:8px;}</style>" +
      "</head><body>" +
      "<h1>P3-O04 Native Dash Seam Comparison — same phrase, same font, same scale; only inter-glyph overlap differs</h1>" +
      '<p style="font-size:12px;color:#555;">Non-Production comparison artifact. Real font glyph ink throughout (no geometric bar, no opacity trick, no font-size/weight change) — each candidate uses a different dashOverlapEm value only.</p>' +
      sections.map((s) => `<div class="cand"><h2>${s.label}</h2><p class="desc">${s.description}</p>${s.style}${s.body}</div>`).join("") +
      "</body></html>";

    expect(combined).toContain("A — minimal overlap (0.08em)");
    expect(combined).toContain(`B — moderate overlap (${DEFAULT_DASH_OVERLAP_EM}em`);
    expect(combined).toContain("C — stronger overlap (0.16em)");
    expect(combined).not.toContain("::after");
    expect(combined).not.toContain("opacity:");
    expect(combined).not.toContain("color: transparent");
    // Real "――" glyphs present, split into individual paint nodes.
    const dashGlyphCount = (combined.match(/class="dash-glyph"/g) ?? []).length;
    expect(dashGlyphCount).toBe(6); // 2 glyphs x 3 candidates

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(ARTIFACT_PATH, combined, "utf-8");
  });

  it("the three candidates produce genuinely different overlap geometry (not just different labels) — larger overlapEm shrinks each glyph's own start-to-start distance and increases its own height", () => {
    const models = CANDIDATES.map((c) => buildComparisonModel(`dash-seam-${c.overlapEm}`, c.overlapEm));
    const dashUnitsOf = (m: ReturnType<typeof buildComparisonModel>) =>
      m.pages.flatMap((p) => p.columns.flatMap((c) => c.lines.flatMap((l) => l.units))).find((u) => u.semanticRunKind === "DASH")!;

    const [a, b, c] = models.map(dashUnitsOf);
    // Larger overlap -> second glyph starts EARLIER (more negative offset
    // from the nominal half-way point) and each glyph's own height grows.
    expect(a.dashGlyphs![1].topPx).toBeGreaterThan(b.dashGlyphs![1].topPx);
    expect(b.dashGlyphs![1].topPx).toBeGreaterThan(c.dashGlyphs![1].topPx);
    expect(a.dashGlyphs![0].heightPx).toBeLessThan(b.dashGlyphs![0].heightPx);
    expect(b.dashGlyphs![0].heightPx).toBeLessThan(c.dashGlyphs![0].heightPx);
    // Canonical run extent (the unit's own heightPx) is identical across
    // all three -- only the INTERNAL glyph split changes.
    expect(a.heightPx).toBe(b.heightPx);
    expect(b.heightPx).toBe(c.heightPx);
  });
});
