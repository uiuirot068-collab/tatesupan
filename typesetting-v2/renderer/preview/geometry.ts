// P3-O09 — Preview Renderer Foundation: one-way GeometryTick -> CSS px
// conversion, for painting only. Deterministic, single centralized
// function, scale configurable via `scaleMultiplier`. Never reads a browser
// measurement; never feeds back into Core (Contract §28, INV-009).
//
// This is a fresh, foundation-owned copy of the same Contract §21 formula
// the Stage D development adapter used (`tools/preview-dev-adapter/geometry.ts`)
// — duplicated deliberately, not imported, so the final Renderer module has
// no dependency on the disposable Stage D QA tool (P3-O09 task instruction:
// "final renderer code must not depend on the QA artifact generator").

const MM_PER_TICK = 0.001; // Core Contract §21: 1 GeometryTick = 0.001mm
const CSS_PX_PER_MM = 96 / 25.4; // standard 96dpi CSS px/mm, not a physical print DPI

/**
 * Converts a canonical GeometryTick value to CSS pixels for painting.
 * `scaleMultiplier` is a pure display zoom factor — changing it changes only
 * how large the same tick value is drawn, never any GeometryTick value
 * itself. CSS px values produced here must never feed back into Core,
 * MeasurementFacts, capacity, or line/page composition.
 */
export function tickToPx(tick: number, scaleMultiplier: number): number {
  return tick * MM_PER_TICK * CSS_PX_PER_MM * scaleMultiplier;
}

// A reasonable default for a foundation-stage Preview Renderer artifact.
// Not a canonical value; a Product-facing final Preview may choose its own
// zoom/fit behavior independently (this foundation does not decide that).
export const DEFAULT_SCALE_MULTIPLIER = 1.5;
