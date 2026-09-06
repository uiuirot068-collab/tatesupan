// P3-O04-DASH-STROKE-WEIGHT-HOLD (second review): Human rejected ALL three
// prior thickness candidates (0.03em/0.06em/0.09em) as still too thick.
// Root-cause audit (qa/evidence/P3_O04_DASH_VISUAL.md's own HOLD section)
// found the implementation itself clean (glyph correctly hidden, exactly
// one bar, no overlap, no stray background/border, no transform distorting
// thickness, correct per-candidate CSS override) — the three requested
// widths (~0.63px / 1.26px / 1.89px at this fixture's actual font-size)
// are all under 2 device pixels and within ~1.26px of each other, squarely
// in the range where standard browser rasterization for solid-fill
// elements at 1x device-pixel-ratio rounds/clamps to similar effective
// widths. Further decrementing the SAME geometric-width lever would only
// repeat this: this file now compares three DIFFERENT STRATEGIES instead
// of three more arbitrary numbers, per this task's own explicit
// instruction not to reuse the rejected 0.03/0.06/0.09em range and to
// compare strategies, not just numbers.

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

const UNIT_INK_OVERRIDE_RULE = '.unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; color: transparent; }';
const AFTER_RULE_PATTERN = /\.unit\.kind-SEMANTIC_RUN\.semantic-dash \.unit-ink::after\s*\{[^}]*\}/;

interface Strategy {
  label: string;
  description: string;
  apply: (html: string) => string;
}

const STRATEGIES: Strategy[] = [
  {
    label: "A — corrected native glyph (no painted bar at all)",
    description:
      "Restores the real ―― font glyph ink (removes color:transparent) and removes the painted bar entirely (content:none). Preserves the typeface's own natural stroke weight exactly as the font renders it -- no invented thickness value, trivially Publication-portable (real text, not a CSS-only trick). Tests whether the Phase 2 P2-L06 off-center finding (measured in a DIFFERENT, now-superseded PoC DOM structure) even recurs in THIS Renderer's own structure at all -- the same kind of surprise already found for TCY's own historical uncertainty.",
    apply: (html) => {
      if (!html.includes(UNIT_INK_OVERRIDE_RULE)) throw new Error("Strategy A: expected unit-ink override rule not found");
      if (!AFTER_RULE_PATTERN.test(html)) throw new Error("Strategy A: expected ::after rule not found");
      return html
        .replace(UNIT_INK_OVERRIDE_RULE, ".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; }")
        .replace(AFTER_RULE_PATTERN, ".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink::after { content: none; }");
    },
  },
  {
    label: "B — ultra-light geometric (width just above the rasterization floor + reduced opacity)",
    description:
      "Keeps the painted-bar strategy but defeats the sub-pixel rounding problem directly: width is set to 0.05em (≈ 1.05px at this fixture's font-size -- just above, not below, the ~1 device-pixel floor that made 0.03/0.06/0.09em visually indistinguishable) and opacity is reduced to 0.4, so the bar reads as visually LIGHTER via alpha blending (partial pixel coverage, the same mechanism a real anti-aliased hairline stroke uses) rather than through further geometric width reduction, which this audit proved has no further visible effect at this scale.",
    apply: (html) => {
      if (!AFTER_RULE_PATTERN.test(html)) throw new Error("Strategy B: expected ::after rule not found");
      return html.replace(
        AFTER_RULE_PATTERN,
        '.unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink::after { content: ""; position: absolute; top: 0; bottom: 0; left: 50%; transform: translateX(-50%); width: 0.05em; background: #111; opacity: 0.4; }'
      );
    },
  },
  {
    label: "C — alternative geometric (current solid bar, unchanged, kept only for direct comparison)",
    description:
      "The current main-artifact rule (0.06em, full opacity, solid fill), left exactly as-is. Included only so the Human can compare it directly against A and B in the same view -- the root-cause audit found no implementation defect in how this renders, only that its resulting look (at any of the three widths tried) was rejected; kept here in case a side-by-side comparison changes that judgment.",
    apply: (html) => html,
  },
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

describe("P3-O04 Dash Paint Strategy — Human comparison artifact (second review)", () => {
  it("generates a 3-strategy, non-Production comparison of the SAME fixture, differing only in dash paint strategy", () => {
    const model = buildComparisonModel("dash-strategy-comparison");
    const baseHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));

    const sections = STRATEGIES.map(({ label, description, apply }) => {
      const html = apply(baseHtml);
      const bodyStart = html.indexOf("<body");
      const bodyContent = html.slice(html.indexOf(">", bodyStart) + 1, html.indexOf("</body>"));
      const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
      return { label, description, style: styleMatch ? styleMatch[0] : "", body: bodyContent };
    });

    const combined =
      '<!doctype html><html lang="ja"><head><meta charSet="utf-8"/><title>P3-O04 Dash Strategy Comparison</title>' +
      "<style>body{font-family:sans-serif;margin:0;padding:20px;background:#fafafa;} h2{font-size:13px;margin:24px 0 4px;} p.desc{font-size:11px;color:#666;max-width:600px;margin:0 0 8px;} .cand{border-top:2px solid #333;padding-top:8px;}</style>" +
      "</head><body>" +
      '<h1 style="font-size:16px;">P3-O04 Dash Paint Strategy Comparison — same fixture, three candidate STRATEGIES (not just three numbers)</h1>' +
      '<p style="font-size:12px;color:#555;">Non-Production comparison artifact. Same font, same page scale, same canonical geometry, same source, same run length throughout — only the dash paint strategy differs per section.</p>' +
      sections.map((s) => `<div class="cand"><h2>${s.label}</h2><p class="desc">${s.description}</p>${s.style}${s.body}</div>`).join("") +
      "</body></html>";

    expect(combined).toContain("A — corrected native glyph");
    expect(combined).toContain("B — ultra-light geometric");
    expect(combined).toContain("C — alternative geometric");
    // Strategy A must show the real glyph text visibly (no color:transparent, no bar).
    expect(combined).toContain('.unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; }');
    expect(combined).toContain(".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink::after { content: none; }");
    // Strategy B must use a width just above the proven rasterization floor, plus reduced opacity.
    expect(combined).toContain("width: 0.05em; background: #111; opacity: 0.4;");
    // Strategy C must be the unchanged, current 0.06em solid rule.
    expect(combined).toContain("width: 0.06em;\n    background: #111;\n  }");

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(ARTIFACT_PATH, combined, "utf-8");
  });
});
