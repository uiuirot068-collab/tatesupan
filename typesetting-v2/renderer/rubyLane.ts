import { DEFAULT_RUBY_SCALE } from "../core";

/**
 * Shippori Mincho optical compensation for vertical Ruby.
 *
 * Merely touching the parent and annotation em boxes leaves the visible ink
 * separated by both glyphs' side bearings.  Against the committed production
 * font, the limiting required fixtures measure 0.114em (聯想《れんそう》),
 * 0.135em (髑髏《もぐらもち》), and 0.107em (光《ひかり》).  Moving the
 * annotation lane 0.1 body-em toward its parent removes the conspicuous empty
 * strip while retaining a positive measured ink gap in all three cases.
 *
 * This is a paint-only, cross-axis metric.  It does not alter Core's reading-
 * direction offset/extent, Ruby scale/pitch, source spans, or body position.
 */
export const RUBY_PARENT_OPTICAL_INSET_EM = 0.1;

export interface RubyLaneGeometry {
  annotationWidth: number;
  annotationStartFromParentCenter: number;
  annotationCenterFromParentCenter: number;
  emBoxGap: number;
}

/** Returns one shared Ruby-lane contract in the caller's body-em unit. */
export function rubyLaneGeometry(
  bodyEm: number,
  rubyScale = DEFAULT_RUBY_SCALE,
): RubyLaneGeometry {
  const annotationWidth = bodyEm * rubyScale;
  const opticalInset = bodyEm * RUBY_PARENT_OPTICAL_INSET_EM;
  const annotationStartFromParentCenter = bodyEm / 2 - opticalInset;
  return {
    annotationWidth,
    annotationStartFromParentCenter,
    annotationCenterFromParentCenter:
      annotationStartFromParentCenter + annotationWidth / 2,
    emBoxGap: -opticalInset,
  };
}
