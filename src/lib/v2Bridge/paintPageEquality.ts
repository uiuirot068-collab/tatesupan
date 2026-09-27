/**
 * Phase 8: structural equality of two V2 Preview paint pages.
 *
 * Every layout reply is a fresh structured clone, so a page whose content did
 * not change (e.g. every page before the edited one) still arrives as a new
 * object. PageCard's memo compared `v2PreviewPage` by identity, so each new
 * layout re-rendered every mounted page's whole glyph tree (hundreds of
 * `UnitBox` elements per page). `PreviewPage` is a pure function of the page
 * data (plus font size / mode, compared separately), so a structurally equal
 * page renders identically and may skip.
 *
 * Plain data only (objects, arrays, primitives) — which is all a PaintPage
 * holds. It exits on the first difference, and it is only evaluated for
 * mounted pages whose identity changed.
 */
import type { PaintPage } from "../../../typesetting-v2/renderer/preview/paintModel";

function samePlainData(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return typeof a === "number" && typeof b === "number" && Number.isNaN(a) && Number.isNaN(b);
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!samePlainData(a[i], b[i])) return false;
    return true;
  }
  if (Array.isArray(b)) return false;
  const aRecord = a as Record<string, unknown>;
  const bRecord = b as Record<string, unknown>;
  const aKeys = Object.keys(aRecord);
  if (aKeys.length !== Object.keys(bRecord).length) return false;
  for (const key of aKeys) {
    if (!Object.hasOwn(bRecord, key) || !samePlainData(aRecord[key], bRecord[key])) return false;
  }
  return true;
}

export function samePaintPage(a: PaintPage | undefined, b: PaintPage | undefined): boolean {
  if (a === b) return true;
  if (a === undefined || b === undefined) return false;
  return samePlainData(a, b);
}
