// Deterministic, fixture-backed MeasurementFacts implementation — the only
// concrete provider until a real Renderer-adjacent measurement adapter is
// designed (P3-O08/O09, explicitly out of Core scope). Every character gets
// the same advance regardless of its actual glyph: Natural Pitch (Contract
// §18) treats one character as one full-width cell sized to the declared
// font size, which is exactly what this fake computes, deterministically.

import type { GeometryTick } from "../geometry/tick";
import type { MeasurementFacts } from "./facts";

const MM_PER_PT = 25.4 / 72;

// Documented fixture value: a 10pt font size -> ~3.528mm cell -> 3528 ticks.
function ptToTicks(sizePt: number): GeometryTick {
  return Math.round(sizePt * MM_PER_PT * 1000);
}

export function createFakeMeasurementProvider(): MeasurementFacts {
  return {
    providerId: "tatespun-fake-measurement-provider",
    providerVersion: "1.0.0",
    naturalAdvanceTick: (_fontRef, sizePt, _char) => ptToTicks(sizePt),
    rubyReadingExtentTick: (_fontRef, sizePt, text) => ptToTicks(sizePt) * Array.from(text).length,
    imageIntrinsicTick: (_refId) => ({ width: 0, height: 0 }), // images are out of this Loop's scope (P3-L13)
  };
}
