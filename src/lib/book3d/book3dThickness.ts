/**
 * 3D book thickness (visual only — NOT print geometry).
 * CST-PORT-012: copied from COLUMNSTAND `src/lib/coverGeometry.ts`
 * (Editor 3D book thickness section) unchanged.
 */
import { roundSpineWidthMm } from "../cover/coverGeometry";

/** Minimum visual book thickness so a 0mm spine still reads as a book. */
export const BOOK3D_MIN_VISUAL_THICKNESS_MM = 1.2;

/**
 * Visual estimate ONLY (3D preview). Assumes a typical body paper of about 0.09mm per
 * sheet (= 2 pages) plus about 0.5mm for the two covers. This is NOT a printer's spine
 * calculation and guarantees no paper thickness.
 */
export const BOOK3D_NOMINAL_SHEET_MM = 0.09;
/** Two cover boards in the visual estimate. */
export const BOOK3D_NOMINAL_COVERS_MM = 0.5;
export const BOOK3D_MAX_VISUAL_THICKNESS_MM = 40;
/**
 * Plausibility band for a USER-SET spine width, by page count. Deliberately wide:
 * very thin paper (0.05mm / sheet, no cover allowance) … thick paper (0.16mm / sheet)
 * + heavy covers (1.0mm). Outside the band the 3D shows a non-blocking note.
 */
export const BOOK3D_PLAUSIBLE_SHEET_MIN_MM = 0.05;
export const BOOK3D_PLAUSIBLE_SHEET_MAX_MM = 0.16;
export const BOOK3D_PLAUSIBLE_COVERS_MAX_MM = 1.0;
/** ignore differences smaller than this (mm), so thin books never warn over rounding */
export const BOOK3D_PLAUSIBLE_TOLERANCE_MM = 1.0;

export type Book3DThicknessPlausibility = "ok" | "large" | "small";

export type Book3DThickness = {
  /** thickness actually drawn by the 3D model (clamped for display) */
  thicknessMm: number;
  /** "spine" = the cover's spine width set by the user wins; "estimate" = from page count */
  source: "spine" | "estimate";
  /** unclamped estimate from the page count (shown for reference) */
  estimateMm: number;
  /** the user-set spine width (0 = not set) */
  spineMm: number;
  /** how a user-set spine width compares with the page count ("ok" for estimates) */
  plausibility: Book3DThicknessPlausibility;
};

export function getBook3DPlausibleSpineRange(pageCount: number): { minMm: number; maxMm: number } {
  const sheets = Math.ceil(Math.max(0, pageCount) / 2);
  return {
    minMm: sheets * BOOK3D_PLAUSIBLE_SHEET_MIN_MM,
    maxMm: sheets * BOOK3D_PLAUSIBLE_SHEET_MAX_MM + BOOK3D_PLAUSIBLE_COVERS_MAX_MM,
  };
}

/**
 * Editor 3D thickness: the cover spine width wins when it is set (the user's real
 * spine is never changed or overridden); otherwise the body page count gives a visual
 * estimate. Clamped for display only. Never feeds print / export geometry.
 */
export function getBook3DThickness(spineWidthMmRaw: number, pageCount: number): Book3DThickness {
  const spine = roundSpineWidthMm(spineWidthMmRaw);
  const sheets = Math.ceil(Math.max(0, pageCount) / 2);
  const estimateMm = sheets * BOOK3D_NOMINAL_SHEET_MM + BOOK3D_NOMINAL_COVERS_MM;
  const raw = spine > 0 ? spine : estimateMm;
  let plausibility: Book3DThicknessPlausibility = "ok";
  if (spine > 0) {
    const range = getBook3DPlausibleSpineRange(pageCount);
    if (spine > range.maxMm && spine - estimateMm >= BOOK3D_PLAUSIBLE_TOLERANCE_MM) {
      plausibility = "large";
    } else if (spine < range.minMm && estimateMm - spine >= BOOK3D_PLAUSIBLE_TOLERANCE_MM) {
      plausibility = "small";
    }
  }
  return {
    thicknessMm: Math.min(
      BOOK3D_MAX_VISUAL_THICKNESS_MM,
      Math.max(BOOK3D_MIN_VISUAL_THICKNESS_MM, raw),
    ),
    source: spine > 0 ? "spine" : "estimate",
    estimateMm,
    spineMm: spine,
    plausibility,
  };
}

/** Status text: where the thickness comes from. Estimates always carry 「約」. */
export function describeBook3DThickness(thickness: Book3DThickness): string {
  const capped =
    Math.max(thickness.spineMm, thickness.estimateMm) > BOOK3D_MAX_VISUAL_THICKNESS_MM
      ? `・3Dは${BOOK3D_MAX_VISUAL_THICKNESS_MM}mmまで表示`
      : "";
  return thickness.source === "spine"
    ? `厚み ${thickness.spineMm.toFixed(1)}mm（設定した背幅${capped}）`
    : `厚み 約${thickness.estimateMm.toFixed(1)}mm（ページ数から推定${capped}）`;
}

/** Non-blocking note for an implausible user-set spine width (null = nothing to say). */
export function describeBook3DThicknessNotice(thickness: Book3DThickness): string | null {
  if (thickness.plausibility === "large") {
    return "ページ数に対して背幅が大きく設定されています。3Dでは設定した背幅を優先して表示しています。";
  }
  if (thickness.plausibility === "small") {
    return "ページ数に対して背幅が小さく設定されています。3Dでは設定した背幅を優先して表示しています。";
  }
  return null;
}
