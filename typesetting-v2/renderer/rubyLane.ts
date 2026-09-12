import { DEFAULT_RUBY_SCALE } from "../core";

/**
 * Shippori Mincho optical compensation for vertical Ruby.
 *
 * Merely touching the parent and annotation em boxes leaves the visible ink
 * separated by both glyphs' side bearings.  Against the committed production
 * font, the limiting required fixtures measure 0.114em (聯想《れんそう》),
 * 0.135em (髑髏《もぐらもち》), and 0.107em (光《ひかり》).  Moving the
 * Human visual QA selected the annotation center at 46% of the actual
 * runtime body-column pitch from the parent lane toward the Ruby side.
 *
 * This is a paint-only, cross-axis metric.  It does not alter Core's reading-
 * direction offset/extent, Ruby scale/pitch, source spans, or body position.
 */
export const RUBY_LANE_COLUMN_PITCH_RATIO = 0.46;

export interface RubyLaneGeometry {
  annotationWidth: number;
  annotationStartFromParentCenter: number;
  annotationCenterFromParentCenter: number;
  emBoxGap: number;
}

/** Returns one shared Ruby-lane contract in the caller's body-em unit. */
export function rubyLaneGeometry(
  bodyEm: number,
  columnPitch: number,
  rubyScale = DEFAULT_RUBY_SCALE,
): RubyLaneGeometry {
  const annotationWidth = bodyEm * rubyScale;
  const annotationCenterFromParentCenter =
    columnPitch * RUBY_LANE_COLUMN_PITCH_RATIO;
  const annotationStartFromParentCenter =
    annotationCenterFromParentCenter - annotationWidth / 2;
  return {
    annotationWidth,
    annotationStartFromParentCenter,
    annotationCenterFromParentCenter,
    emBoxGap: annotationStartFromParentCenter - bodyEm / 2,
  };
}
