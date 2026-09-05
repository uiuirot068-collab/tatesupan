// Canonical geometry precision (Core Contract §21, hardened at P3-L02 closeout).
// 1 GeometryTick = 0.001mm. All CANONICAL layout facts are integers in this
// unit — never floating-point mm. Renderer-boundary conversion (tick -> CSS
// px, tick -> PDF pt) happens only at a Renderer's own paint boundary
// (Contract §28) and never feeds back as layout authority (INV-013).

export type GeometryTick = number;

const TICKS_PER_MM = 1000;

export function mmToTicks(mm: number): GeometryTick {
  return Math.round(mm * TICKS_PER_MM);
}
