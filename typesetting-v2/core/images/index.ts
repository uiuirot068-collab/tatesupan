// Image flow placement (Core Contract §14). Decides whether an ImageUnit
// fits the remaining line/column capacity and whether it forces a
// break-before/break-after — final decode/paint is Renderer responsibility
// (§14/§28); this module never touches raw binary, only the refId reference
// and its already-supplied intrinsic MeasurementFacts.

import type { GeometryTick } from "../geometry/tick";
import type { MeasurementFacts } from "../measurement/facts";
import type { ImageUnit } from "../units";

export interface ImagePlacementResult {
  fits: boolean;
  intrinsicWidthTick: GeometryTick;
  intrinsicHeightTick: GeometryTick;
  // FULL placement always isolates the image on both sides — Contract §14's
  // "does this force a break" is a Core decision, never left to a renderer
  // to infer from the placement value itself.
  breakBefore: boolean;
  breakAfter: boolean;
}

export function placeImage(
  unit: ImageUnit,
  measurement: MeasurementFacts,
  availableExtentTick: GeometryTick
): ImagePlacementResult {
  const { width, height } = measurement.imageIntrinsicTick(unit.refId);
  // Images flow along the same axis compose/line.ts already measures line
  // extent on (the vertical reading direction) — height is what must fit.
  const fits = height <= availableExtentTick;
  const isolates = unit.placement === "FULL";
  return {
    fits,
    intrinsicWidthTick: width,
    intrinsicHeightTick: height,
    breakBefore: isolates,
    breakAfter: isolates,
  };
}
