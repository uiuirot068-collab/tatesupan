// Measurement-provider boundary (Core Contract §17). Contract-only —
// no implementation here. The Core is deterministic GIVEN a supplied
// MeasurementFacts bundle; it never invokes a font-shaping engine or a
// browser itself. Real adapter selection (HarfBuzz/browser/Canvas) is
// explicitly out of scope (Master §7 white-sheet rule, P3-O08/O09).

import type { GeometryTick } from "../geometry/tick";

export interface MeasurementFacts {
  providerId: string;
  providerVersion: string;
  naturalAdvanceTick: (fontRef: string, sizePt: number, char: string) => GeometryTick;
  rubyReadingExtentTick: (fontRef: string, sizePt: number, text: string) => GeometryTick;
  imageIntrinsicTick: (refId: string) => { width: GeometryTick; height: GeometryTick };
}
