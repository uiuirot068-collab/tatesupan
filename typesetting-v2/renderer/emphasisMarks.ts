import type { LogicalUnit } from "../core";
import { rubyLaneGeometry } from "./rubyLane";

/**
 * 傍点（圏点）paint geometry — post-beta typography Phase 1.
 *
 * ONE shared, paint-only contract consumed identically by Preview
 * (`preview/paintModel.ts` + `PreviewRenderer.tsx`, CSS px) and Publication
 * (`publication/paintModel.ts` + `pdfGenerator.ts`, mm → vector PDF and the
 * browser/Node JPG rasterizers), exactly like `rubyLane.ts` is for ruby.
 * Nothing here touches Core: a decorated unit composes with the same span,
 * advance and breaks as an undecorated one, so 傍点 can never move text or
 * change pagination.
 *
 * Cross-axis position: the dot is centred in the ruby lane (jlreq places
 * emphasis dots where ruby would go), i.e. at the Human-approved
 * `RUBY_LANE_COLUMN_PITCH_RATIO` of the column pitch from the base glyph
 * centre, never closer than a small clearance from the base em box (a very
 * tight 行間 cannot pull the dot onto the glyph). When the same base
 * characters also carry ruby, the dots move to the OPPOSITE side so the ruby
 * reading keeps its lane and geometry completely unchanged.
 *
 * Along-flow position: one dot per dot-bearing grapheme, centred in that
 * grapheme's equal share of its placed atom — the same per-grapheme split
 * Publication's `verticalGraphemeCommands` uses to place the glyphs.
 */

/** Dot diameter as a fraction of the body em (≈ CSS `text-emphasis: filled dot`). */
export const EMPHASIS_DOT_DIAMETER_EM = 0.18;

/** Minimum gap between the base em box and the dot's inner edge. */
const EMPHASIS_MIN_CLEARANCE_EM = 0.06;

export type EmphasisSide = "RIGHT" | "LEFT";

export interface EmphasisDotLane {
  /** Signed cross-axis offset of the dot centre from the base glyph centre (+ = right). */
  centerFromParentCenter: number;
  radius: number;
}

/** Returns the dot lane in the caller's unit (px for Preview, mm for Publication). */
export function emphasisDotLane(bodyEm: number, columnPitch: number, side: EmphasisSide): EmphasisDotLane {
  const radius = (bodyEm * EMPHASIS_DOT_DIAMETER_EM) / 2;
  const laneCenter = rubyLaneGeometry(bodyEm, columnPitch).annotationCenterFromParentCenter;
  const offset = Math.max(laneCenter, bodyEm / 2 + bodyEm * EMPHASIS_MIN_CLEARANCE_EM + radius);
  return { centerFromParentCenter: side === "RIGHT" ? offset : -offset, radius };
}

// Graphemes that never take a dot: whitespace and 約物 (brackets, 句読点,
// 中黒/colon/semicolon, !?, quotes, dash and leader marks). Emphasis applies
// to the letters of the emphasised word, not to its punctuation.
const NO_EMPHASIS_DOT = /^[\s　、。，．,.・：；:;！？!?‼⁉「」『』（）()［］[\]〔〕｛｝{}〈〉《》【】〘〙〖〗“”‘’"'―—…‥]$/u;

export function takesEmphasisDot(grapheme: string): boolean {
  return grapheme.length > 0 && !NO_EMPHASIS_DOT.test(grapheme);
}

/**
 * Along-flow dot centres for one placed atom's text, relative to the atom's
 * own start, in the same unit as `extent`.
 */
export function emphasisDotFlowCenters(text: string, extent: number): number[] {
  const graphemes = Array.from(text);
  if (graphemes.length === 0) return [];
  const pitch = extent / graphemes.length;
  const centers: number[] = [];
  graphemes.forEach((grapheme, i) => {
    if (takesEmphasisDot(grapheme)) centers.push((i + 0.5) * pitch);
  });
  return centers;
}

/** Paint-ready 傍点 for one placed atom (flow centres in the caller's unit). */
export interface EmphasisDots {
  side: EmphasisSide;
  flowCenters: number[];
}

/**
 * Resolves the owning unit's `InlineDecoration.emphasis` into dots for one
 * placed atom of `extent` length whose painted text is `text`. TEXT and RUBY
 * (base characters) get one dot per dot-bearing grapheme; a 縦中横 cell is
 * one character cell, so it gets exactly one dot; a SEMANTIC_RUN (――/……)
 * is a punctuation run and gets none. Ruby-bearing atoms put their dots on
 * the LEFT so the ruby reading keeps the right-hand lane.
 */
export function emphasisDotsForUnit(owner: LogicalUnit | null | undefined, text: string, extent: number): EmphasisDots | undefined {
  if (!owner || (owner.kind !== "TEXT" && owner.kind !== "RUBY" && owner.kind !== "TCY")) return undefined;
  if (owner.decoration?.emphasis !== "DOT") return undefined;
  const flowCenters = owner.kind === "TCY" ? [extent / 2] : emphasisDotFlowCenters(text, extent);
  if (flowCenters.length === 0) return undefined;
  return { side: owner.kind === "RUBY" ? "LEFT" : "RIGHT", flowCenters };
}
