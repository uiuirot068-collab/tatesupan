// P3-O08 — Publication Renderer Foundation: the single, one-way
// GeometryTick -> physical millimeter conversion. Contract §21 fixes
// 1 tick = 0.001mm exactly, so this is a plain, lossless multiplication --
// unlike Preview's `tickToPx` (renderer/preview/geometry.ts), Publication
// output has no browser zoom/display-scale concept: a Publication page's
// physical size is the manuscript's actual printed size, not an arbitrary
// on-screen convenience multiplier. No scale parameter exists here on
// purpose -- accepting one would reopen the exact "browser display scale
// leaking into canonical physical output" class of bug Preview's own
// scaleMultiplier exists to contain for a *different* (on-screen) purpose.
export function tickToMm(tick: number): number {
  return tick * 0.001;
}
