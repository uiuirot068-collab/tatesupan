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

// Deterministic fixture: derives an intrinsic size from refId's own
// characters (a stable sum of code points), so tests get predictable,
// varied dimensions without any real image decode (Contract §14/§28 — that
// stays Renderer-only). Never reads file bytes; refId is a reference only.
function refIdSeed(refId: string): number {
  return Array.from(refId).reduce((sum, ch) => sum + (ch.codePointAt(0) ?? 0), 0);
}

export function createFakeMeasurementProvider(): MeasurementFacts {
  return {
    providerId: "tatespun-fake-measurement-provider",
    providerVersion: "1.0.0",
    naturalAdvanceTick: (_fontRef, sizePt, _char) => ptToTicks(sizePt),
    rubyReadingExtentTick: (_fontRef, sizePt, text) => ptToTicks(sizePt) * Array.from(text).length,
    imageIntrinsicTick: (refId) => {
      const seed = refIdSeed(refId);
      const cell = ptToTicks(10);
      return {
        width: cell * (1 + (seed % 5)),
        height: cell * (1 + ((seed >> 2) % 5)),
      };
    },
  };
}
