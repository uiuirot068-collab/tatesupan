// P3-O04-DASH-VISUAL (third review): Human rejected BOTH geometric-bar
// strategies previously compared here — the low-opacity bar read as pale/
// blurred, and the solid bar read as too rule-like ("does not visually
// belong to the surrounding typeface"). The native-glyph candidate (no
// painted bar at all) was judged visually closer to real typography, but
// still needs continuity (seam between the two ―― characters) and
// centering review. Per that explicit Human direction, this file no
// longer compares geometric-bar strategies at all — it compares three
// NATIVE-GLYPH-based paint-position candidates only, so the primary
// candidate always uses actual font glyph ink, never a pseudo-element
// rectangle, never an opacity trick, never a replacement font size/weight.
//
// Audited first (qa/evidence/P3_O04_DASH_VISUAL.md's own §17): the "――"
// DASH run composes as exactly ONE atom (SEMANTIC_RUN generates zero
// internal break opportunities) and paints as ONE text node ("――", both
// characters together) inside ONE .unit-ink box — there are no separate,
// independently-positioned per-character elements to "overlap." The only
// available, well-defined, canonical-extent-independent CSS lever for
// inter-character spacing WITHIN that one text node is `letter-spacing`
// (which works correctly along the inline axis under vertical-rl, exactly
// like under horizontal writing). No reliable, evidence-backed CSS lever
// for cross-axis (block-axis) centering was found without fabricating an
// unverified pixel/em offset — Phase 2's own P2-L06 measurement was taken
// against a different, now-superseded PoC DOM structure, not directly
// transferable to this Renderer's own structure, and no live-browser
// re-measurement tool is available here. Candidate C's centering nudge is
// therefore explicitly disclosed as SPECULATIVE, not a proven correction.

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

const UNIT_INK_OVERRIDE_RULE = ".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; color: transparent; }";
const AFTER_RULE_PATTERN = /\.unit\.kind-SEMANTIC_RUN\.semantic-dash \.unit-ink::after\s*\{[^}]*\}/;

interface Strategy {
  label: string;
  description: string;
  apply: (html: string) => string;
}

// Strips the rejected geometric-bar rules (color:transparent + ::after
// bar), restoring the plain, already-generic `.unit-ink` rendering (real
// glyph ink, whatever the resolved font provides) as the shared starting
// point for every native-based candidate below.
function withNativeGlyphBase(html: string, extraUnitInkRule: string): string {
  if (!html.includes(UNIT_INK_OVERRIDE_RULE)) throw new Error("expected unit-ink override rule not found");
  if (!AFTER_RULE_PATTERN.test(html)) throw new Error("expected ::after rule not found");
  return html
    .replace(UNIT_INK_OVERRIDE_RULE, extraUnitInkRule)
    .replace(AFTER_RULE_PATTERN, ".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink::after { content: none; }");
}

const STRATEGIES: Strategy[] = [
  {
    label: "A — native glyph, no correction at all (baseline)",
    description:
      "Real ―― font glyph ink, no painted bar, no opacity change, no letter-spacing, no transform -- exactly the same generic rendering every other unit kind already gets. Establishes whether the historical Phase 2 P2-L06 off-center/seam concerns (measured in a different, now-superseded PoC DOM structure) recur in THIS Renderer's own structure at all before any correction is attempted.",
    apply: (html) => withNativeGlyphBase(html, ".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; }"),
  },
  {
    label: "B — native glyph + seam-tightening only (letter-spacing, no centering change)",
    description:
      "Same real glyph ink as A. Adds letter-spacing:-0.05em -- a well-defined CSS lever that reduces the INLINE-axis (vertical, under writing-mode:vertical-rl) gap BETWEEN the two ― characters within their one shared text node, addressing a possible seam from the font's own glyph side-bearing without touching canonical run extent, cross-axis position, or surrounding text. No cross-axis (centering) change in this candidate.",
    apply: (html) =>
      withNativeGlyphBase(
        html,
        ".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; letter-spacing: -0.05em; }"
      ),
  },
  {
    label: "C — native glyph + seam-tightening + speculative centering nudge (EXPERIMENTAL, not proven)",
    description:
      "Same seam correction as B, plus a small, disclosed, UNVERIFIED cross-axis nudge (transform:translateX(-0.03em)) attempting to address the P2-L06-documented off-center concern. This value is NOT backed by a live re-measurement in this Renderer's own structure (none is available in this environment) -- it is offered only as a labeled experiment for Human visual judgment, not a claimed correction. If it looks wrong, reject it -- it carries no evidentiary weight beyond 'worth trying'.",
    apply: (html) =>
      withNativeGlyphBase(
        html,
        ".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; letter-spacing: -0.05em; transform: translateX(-0.03em); }"
      ),
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

describe("P3-O04 Native Dash Paint Comparison (Human comparison artifact, third review)", () => {
  it("generates a 3-candidate NATIVE DASH PAINT COMPARISON — real glyph ink only, no geometric bar, no opacity trick, differing only in paint-only seam/centering correction", () => {
    const model = buildComparisonModel("dash-native-comparison");
    const baseHtml = ReactDOMServer.renderToStaticMarkup(PreviewFoundationArtifact({ models: [model], mode: "normal" }));

    const sections = STRATEGIES.map(({ label, description, apply }) => {
      const html = apply(baseHtml);
      const bodyStart = html.indexOf("<body");
      const bodyContent = html.slice(html.indexOf(">", bodyStart) + 1, html.indexOf("</body>"));
      const styleMatch = html.match(/<style>[\s\S]*?<\/style>/);
      return { label, description, style: styleMatch ? styleMatch[0] : "", body: bodyContent };
    });

    const combined =
      '<!doctype html><html lang="ja"><head><meta charSet="utf-8"/><title>P3-O04 Native Dash Paint Comparison</title>' +
      "<style>body{font-family:sans-serif;margin:0;padding:20px;background:#fafafa;} h1{font-size:16px;} h2{font-size:13px;margin:24px 0 4px;} p.desc{font-size:11px;color:#666;max-width:640px;margin:0 0 8px;} .cand{border-top:2px solid #333;padding-top:8px;} .warn{color:#a00;font-weight:bold;}</style>" +
      "</head><body>" +
      '<h1>NATIVE DASH PAINT COMPARISON — real font glyph ink only (geometric-bar and opacity strategies were rejected by Human Visual QA and are not shown here)</h1>' +
      '<p style="font-size:12px;color:#555;">Non-Production comparison artifact. Same font, same page scale, same canonical geometry, same source, same run length throughout — only native-glyph paint-position correction differs per section. Candidate C\'s centering nudge is <span class="warn">experimental and unverified</span>.</p>' +
      sections.map((s) => `<div class="cand"><h2>${s.label}</h2><p class="desc">${s.description}</p>${s.style}${s.body}</div>`).join("") +
      "</body></html>";

    expect(combined).toContain("NATIVE DASH PAINT COMPARISON");
    expect(combined).toContain("A — native glyph, no correction at all");
    expect(combined).toContain("B — native glyph + seam-tightening only");
    expect(combined).toContain("C — native glyph + seam-tightening + speculative centering nudge");

    // None of the three candidates may reintroduce the rejected geometric
    // bar or an opacity trick.
    expect(combined).not.toContain("content: \"\"");
    expect(combined).not.toContain("opacity:");
    expect(combined).not.toContain("background: #111");

    // A: no letter-spacing, no transform.
    expect(combined).toContain(".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; }");
    // B: letter-spacing only, no transform.
    expect(combined).toContain(".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; letter-spacing: -0.05em; }");
    // C: letter-spacing + transform.
    expect(combined).toContain(
      ".unit.kind-SEMANTIC_RUN.semantic-dash .unit-ink { position: relative; letter-spacing: -0.05em; transform: translateX(-0.03em); }"
    );

    // The real "――" text is preserved (source/semantic identity), visible
    // as actual glyph ink (no color:transparent anywhere in this artifact).
    expect(combined).not.toContain("color: transparent");
    expect(combined).toContain("――");

    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(ARTIFACT_PATH, combined, "utf-8");
  });
});
