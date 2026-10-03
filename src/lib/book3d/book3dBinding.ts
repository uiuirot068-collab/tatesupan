/**
 * 3D binding / gutter-visibility model (visual only).
 * CST-PORT-012: copied from COLUMNSTAND `src/lib/book3dBinding.ts` unchanged
 * (only the gutterZone import path differs).
 *
 * Nothing here touches print / export geometry. It turns
 *   binding type (中綴じ / 平綴じ) + visual thickness (getBook3DThickness)
 * into the parameters of the curved-page model in EditorBook3D.
 */

import type { GutterModel } from "../gutterZone";

// CST-PORT-004 (C6): the gutter-zone model lives in the shared gutterZone.ts.
export {
  BOOK3D_BINDING_LABEL,
  defaultBinding,
  getGutterModel,
  type Book3DBinding,
  type GutterModel,
} from "../gutterZone";

export type CurlStrip = {
  /** texture offset (px) of the strip's start, measured from the flat/curl boundary toward the spine */
  offsetPx: number;
  widthPx: number;
  /** position of the strip's start edge after chaining (px), along the page and into the book */
  alongPx: number;
  depthPx: number;
  angleDeg: number;
  shadow: number;
};

/**
 * Chains `strips` equal strips from the flat/curl boundary toward the spine.
 * Angle grows toward the spine: a_j = maxCurl · ((j + 0.5) / n)^1.6.
 * Each strip starts where the previous one ended, so the page surface stays
 * continuous while it bends down into the book.
 */
export function buildCurlStrips(
  curlZonePx: number,
  model: GutterModel,
  intensity = 1,
): CurlStrip[] {
  const n = model.strips;
  const width = curlZonePx / n;
  const strips: CurlStrip[] = [];
  let along = 0;
  let depth = 0;
  for (let j = 0; j < n; j += 1) {
    const t = (j + 0.5) / n;
    const angleDeg = model.maxCurlDeg * intensity * Math.pow(t, 1.6);
    strips.push({
      offsetPx: j * width,
      widthPx: width,
      alongPx: along,
      depthPx: depth,
      angleDeg,
      shadow: model.shadowAlpha * intensity * Math.pow(t, 1.3),
    });
    const radians = (angleDeg * Math.PI) / 180;
    along += width * Math.cos(radians);
    depth += width * Math.sin(radians);
  }
  return strips;
}

export type GutterChainStrip = {
  /** horizontal distance (px) of the strip's spine-side edge from the spine axis */
  fromSpinePx: number;
  /** height (px) of that edge above the spine point (the valley bottom) */
  risePx: number;
  widthPx: number;
  angleDeg: number;
};

export type GutterChain = {
  strips: GutterChainStrip[];
  /** horizontal reach of the whole curl band */
  reachPx: number;
  /** height of the flat part above the valley bottom */
  risePx: number;
  /** shade alpha at strip boundary k (k = 0 at the spine … n at the flat part) */
  shadeAt: (k: number) => number;
  /** shade alpha where the flat part starts (fades to 0 across the flat part) */
  flatShadeAlpha: number;
};

/**
 * Refinement pass: the curl is chained OUTWARD FROM THE SPINE AXIS, so every
 * open page's gutter edge sits exactly on the hinge axis. Left and right pages
 * therefore meet in one continuous valley at any opening angle.
 * Strip j (j = 0 at the spine) leans by maxCurl · ((n − j − 0.5) / n)^curlProfile;
 * the flat part continues at height `risePx`.
 * Shade follows the same geometry: strongest in the valley, fading to 0 where
 * the page becomes flat (no separate flat overlay in the gutter).
 */
export function buildGutterChain(
  curlZonePx: number,
  model: GutterModel,
  intensity = 1,
): GutterChain {
  const n = model.strips;
  const width = curlZonePx / n;
  const strips: GutterChainStrip[] = [];
  let fromSpine = 0;
  let rise = 0;
  for (let j = 0; j < n; j += 1) {
    const angleDeg = model.maxCurlDeg * intensity * Math.pow((n - j - 0.5) / n, model.curlProfile);
    strips.push({ fromSpinePx: fromSpine, risePx: rise, widthPx: width, angleDeg });
    const radians = (angleDeg * Math.PI) / 180;
    fromSpine += width * Math.cos(radians);
    rise += width * Math.sin(radians);
  }
  const strength = model.shadowAlpha * intensity;
  return {
    strips,
    reachPx: fromSpine,
    risePx: rise,
    // Repair 2: shade follows the local surface angle (how far the paper turns
    // away from the reader), so it darkens exactly where the page bends, plus a
    // 30% base that continues as a soft fade onto the flat part (flatShadeAlpha).
    shadeAt: (k: number) => {
      const angle = Math.min(90, model.maxCurlDeg * intensity * Math.pow(Math.max(0, n - k) / n, model.curlProfile));
      return strength * (0.3 + 0.7 * Math.pow(Math.sin((angle * Math.PI) / 180), 0.7));
    },
    flatShadeAlpha: strength * 0.3,
  };
}
