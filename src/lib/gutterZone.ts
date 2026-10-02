/**
 * ノドの見づらい範囲 (gutter zone) — shared by COLUMNSTAND and TateSpun.
 *
 * CST-PORT-004 (C6): moved out of COLUMNSTAND `book3dBinding.ts` unchanged so
 * both apps compute "how much of the page near the ノド is hard to read once
 * bound" the same way. Pure and dependency-free: keep this file byte-identical
 * in both repositories (each has the same tests in gutterZone.test.ts).
 *
 * Input: binding type (中綴じ / 平綴じ) + book thickness in mm.
 * Output: the curl band, the ノド注意 guide width (`warnMm`) and the shading
 * parameters. Visual / advisory only: it never changes print geometry.
 */

export type Book3DBinding = "saddle" | "perfect"; // 中綴じ / 平綴じ

export const BOOK3D_BINDING_LABEL: Record<Book3DBinding, string> = {
  saddle: "中綴じ",
  perfect: "平綴じ",
};

/** Default when the user has not chosen: thin books → 中綴じ, else 平綴じ. */
export function defaultBinding(pageCount: number): Book3DBinding {
  return pageCount <= 64 ? "saddle" : "perfect";
}

export type GutterModel = {
  binding: Book3DBinding;
  /** 0..1 eased thickness factor */
  thicknessFactor: number;
  /** 0..1 overall "how hard is the gutter to read" */
  difficulty: number;
  /** width (mm) of the page band that curls into the gutter */
  curlZoneMm: number;
  /** width (mm) of the optional ノド注意 guide band */
  warnMm: number;
  /** steepest strip angle (deg) right at the spine when the book is open */
  maxCurlDeg: number;
  /** hinge angle (deg) of the "開く" state — flatter for 中綴じ */
  openAngleDeg: number;
  /** curl strips per page (each strip = one clipped PageCard instance) */
  strips: number;
  /** angle profile exponent along the curl band (smaller = the whole band stays steep) */
  curlProfile: number;
  /** strongest gutter-shadow alpha */
  shadowAlpha: number;
};

const THICKNESS_MIN_MM = 1.2;
const THICKNESS_FULL_MM = 25;
/** 平綴じ reaches full gutter difficulty sooner (Human-QA Repair 2). */
const PERFECT_FULL_MM = 22;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const round05 = (value: number) => Math.round(value * 2) / 2;

/**
 * Rules (documented in COLUMNSTAND_EDITOR_3D_BINDING_RESULTS.txt):
 *   f  = clamp((t − 1.2) / (25 − 1.2), 0, 1) ^ 0.6     (eased; grows fast, then saturates)
 *   中綴じ: difficulty = 0.10 + 0.25·f   warn = 5 + 4·f mm    maxCurl = 14 + 18·f°   open = 176°
 *   平綴じ (Human-QA Repair 2 — stronger, its own faster-saturating factor):
 *     g  = clamp((t − 1.2) / (22 − 1.2), 0, 1) ^ 0.5
 *     base = 12 + 12·g mm; difficulty = 0.55 + 0.45·g;  maxCurl = 62 + 44·g°
 *     open = 164 − 14·g°;  curlZone = base × 1.5;  ノド注意 warn = curlZone + 3mm;  strips 7
 *     (the guide reaches 3mm past the rolled band onto paper that still faces the reader)
 *     angle profile exponent = 0.85 − 0.25·g (中綴じ 1.6): the band stays steep
 *     (maxCurl > 90° near the spine = the page rolls INTO the gutter)
 *   中綴じ: curlZone = warn × 1.6
 *   shadowAlpha = 0.10 + 0.45·difficulty (平綴じ capped at 0.58 to keep text legible)
 *   strips: 中綴じ 3 / 平綴じ 7 (each strip = one clipped PageCard window)
 */
export function getGutterModel(binding: Book3DBinding, thicknessMm: number): GutterModel {
  const f = Math.pow(
    clamp01((thicknessMm - THICKNESS_MIN_MM) / (THICKNESS_FULL_MM - THICKNESS_MIN_MM)),
    0.6,
  );
  if (binding === "saddle") {
    const difficulty = 0.1 + 0.25 * f;
    const warnMm = round05(5 + 4 * f);
    return {
      binding,
      thicknessFactor: f,
      difficulty,
      curlZoneMm: warnMm * 1.6,
      warnMm,
      maxCurlDeg: 14 + 18 * f,
      openAngleDeg: 176,
      strips: 3,
      curlProfile: 1.6,
      shadowAlpha: 0.1 + 0.45 * difficulty,
    };
  }
  const g = Math.pow(
    clamp01((thicknessMm - THICKNESS_MIN_MM) / (PERFECT_FULL_MM - THICKNESS_MIN_MM)),
    0.5,
  );
  const difficulty = 0.55 + 0.45 * g;
  const baseMm = 12 + 12 * g;
  // The guide must reach past the rolled-in band onto paper that still faces the
  // reader, otherwise the pink would itself be hidden in the gutter.
  const curlZoneMm = baseMm * 1.5;
  const warnMm = round05(curlZoneMm + 3);
  return {
    binding,
    thicknessFactor: g,
    difficulty,
    curlZoneMm,
    warnMm,
    maxCurlDeg: 62 + 44 * g,
    openAngleDeg: 164 - 14 * g,
    strips: 7,
    // Repair 2: the whole curl band stays steep, so the gutter side really narrows
    curlProfile: 0.85 - 0.25 * g,
    shadowAlpha: Math.min(0.58, 0.1 + 0.45 * difficulty),
  };
}
