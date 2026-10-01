import { describe, expect, it } from "vitest";
import { resolvePreviewListAuthority, warningPageIndices } from "./previewListAuthority";
import { EMPTY_IMAGE_WARNING_STATE, reconcileImageWarnings } from "../imageWarningLifecycle";
import { computePageSourceRanges, paginateTokens, tokenizeTategaki } from "../tategaki";

// Phase 11 残件④ — the initial-wait LEGACY page list is provisional in V2
// mode: visible (never a blank pane), but nothing page-keyed is written from it.

describe("resolvePreviewListAuthority", () => {
  it("LEGACY mode (rollback) is canonical and fully interactive, unchanged", () => {
    expect(resolvePreviewListAuthority({ useV2Engine: false, v2SourceContent: null, content: "本文" })).toEqual({
      canonical: true,
      rangesCurrent: true,
      pageActionsEnabled: true,
    });
  });

  it("V2 before the first layout: provisional — no ranges, no page-keyed actions", () => {
    expect(resolvePreviewListAuthority({ useV2Engine: true, v2SourceContent: null, content: "本文" })).toEqual({
      canonical: false,
      rangesCurrent: false,
      pageActionsEnabled: false,
    });
  });

  it("V2 with a current layout: canonical, ranges current", () => {
    expect(resolvePreviewListAuthority({ useV2Engine: true, v2SourceContent: "本文", content: "本文" })).toEqual({
      canonical: true,
      rangesCurrent: true,
      pageActionsEnabled: true,
    });
  });

  it("V2 with a stale layout (typing ahead of composition): canonical list, but its ranges must not drive edits", () => {
    expect(resolvePreviewListAuthority({ useV2Engine: true, v2SourceContent: "本文", content: "本文追記" })).toEqual({
      canonical: true,
      rangesCurrent: false,
      pageActionsEnabled: true,
    });
  });
});

describe("image-break warnings wait for the canonical page", () => {
  const legacyPages = new Map([["pic", [3]]]);
  const canonicalPages = new Map([["pic", [4]]]);

  it("during the initial wait a broken image is not recorded with a provisional LEGACY page", () => {
    const waiting = resolvePreviewListAuthority({ useV2Engine: true, v2SourceContent: null, content: "x" });
    const result = reconcileImageWarnings(EMPTY_IMAGE_WARNING_STATE, {
      unresolvedIds: new Set(["pic"]),
      pageIndicesById: warningPageIndices(waiting, legacyPages),
    });
    expect(result.state).toBe(EMPTY_IMAGE_WARNING_STATE);
    expect(result.newlyBrokenIds).toEqual([]);
  });

  it("once the V2 list exists the break is recorded and announced once, with the canonical page", () => {
    const ready = resolvePreviewListAuthority({ useV2Engine: true, v2SourceContent: "x", content: "x" });
    const result = reconcileImageWarnings(EMPTY_IMAGE_WARNING_STATE, {
      unresolvedIds: new Set(["pic"]),
      pageIndicesById: warningPageIndices(ready, canonicalPages),
    });
    expect(result.state.pending).toEqual({ pic: [4] });
    expect(result.newlyBrokenIds).toEqual(["pic"]);
  });

  it("an already-recorded warning keeps its last canonical page while V2 is on HOLD without a list", () => {
    const recorded = { ...EMPTY_IMAGE_WARNING_STATE, pending: { pic: [4] } };
    const waiting = resolvePreviewListAuthority({ useV2Engine: true, v2SourceContent: null, content: "x" });
    const result = reconcileImageWarnings(recorded, { unresolvedIds: new Set(["pic"]), pageIndicesById: warningPageIndices(waiting, legacyPages) });
    expect(result.state).toBe(recorded);
  });

  it("LEGACY mode records LEGACY pages exactly as before", () => {
    const legacy = resolvePreviewListAuthority({ useV2Engine: false, v2SourceContent: null, content: "x" });
    const result = reconcileImageWarnings(EMPTY_IMAGE_WARNING_STATE, { unresolvedIds: new Set(["pic"]), pageIndicesById: warningPageIndices(legacy, legacyPages) });
    expect(result.state.pending).toEqual({ pic: [3] });
  });
});

describe("initial-wait LEGACY fallback cost on a long manuscript (30万字 / ~800 pages)", () => {
  it("tokenize + paginate + source ranges stay well under an interactive budget", () => {
    const paragraph = "吾輩は猫である。名前はまだ無い。どこで生れたかとんと見当がつかぬ。｜東京《とうきょう》に20年住んだ。";
    const content = Array.from({ length: Math.ceil(300_000 / paragraph.length) }, () => paragraph).join("\n");
    const started = performance.now();
    const pages = paginateTokens(tokenizeTategaki(content), { charsPerLine: 39, linesPerPage: 15, columnCount: 1, linesPerColumn: 15 });
    const ranges = computePageSourceRanges(content, { charsPerLine: 39, linesPerPage: 15 });
    const elapsed = performance.now() - started;
    expect(pages.length).toBeGreaterThan(500);
    expect(ranges.length).toBe(pages.length);
    // Measured ≈130 ms in CI-class hardware; the budget only catches a
    // complexity regression (e.g. an accidental O(n²)), not machine noise.
    expect(elapsed).toBeLessThan(3000);
  });
});
