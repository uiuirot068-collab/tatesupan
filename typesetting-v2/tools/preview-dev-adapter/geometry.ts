// Stage D — one-way GeometryTick -> CSS px conversion, for painting only.
// Deterministic, single centralized function, scale configurable via
// `scaleMultiplier`. Never reads a browser measurement; never feeds back
// into Core (Contract §28, INV-009). This is a Human Product Decision C
// item (see PREVIEW_DEVELOPMENT_ADAPTER_PLAN.md §7): "GeometryTick remains
// canonical; a development renderer may convert tick -> px ONLY for
// painting; that conversion MUST be one-way and MUST NOT feed back into
// Core geometry."

const MM_PER_TICK = 0.001; // Core Contract §21: 1 GeometryTick = 0.001mm
const CSS_PX_PER_MM = 96 / 25.4; // standard 96dpi CSS px/mm, not a physical print DPI

/**
 * Converts a canonical GeometryTick value to CSS pixels for painting.
 * `scaleMultiplier` is a pure display zoom factor (e.g. 4 = 4x actual
 * physical size, for on-screen legibility) — changing it changes only how
 * large the same tick value is drawn, never any GeometryTick value itself.
 */
export function tickToPx(tick: number, scaleMultiplier: number): number {
  return tick * MM_PER_TICK * CSS_PX_PER_MM * scaleMultiplier;
}

// Human Visual QA feedback (STAGE-D-QA-VISUAL-SCALE): 4x was too small to
// comfortably judge character rhythm, indent, and line spacing; 10x and
// then 6x were both too large. Tuned to 1.5x — a pure display constant,
// not a canonical value; changing it changes only how large the same
// GeometryTick values are drawn (verified by `viewModel.test.ts`'s own
// scale-only conversion test and by the CanonicalDocument-immutability
// test, neither of which depends on this specific number).
export const DEFAULT_SCALE_MULTIPLIER = 1.5;
