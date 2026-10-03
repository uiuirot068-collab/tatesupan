/**
 * CST-PORT-012: 3D book preview — pure rules (no DOM).
 *
 * Open states, fit scale and hinge angles are COLUMNSTAND `EditorBook3D.tsx`
 * values unchanged. The page pairing is TateSpun's own: the preview's
 * 見開き groups (page 1 alone, then 2-3, 4-5, …, colophon / 目次 included)
 * with the physical page numbers of the Presentation Sequence.
 *
 * Visual only: nothing here changes pagination, export or saved data.
 */
import { computeSpreadGroups } from "../pageOrder";
import { presentationIndexForPhysicalPage } from "../pageJump";
import { findPreviewSpreadIndex } from "../previewPageVirtualization";
import type { GutterModel } from "../gutterZone";

export type Book3DOpenState = "closed" | "ajar" | "open";

export const BOOK3D_OPEN_LABEL: Record<Book3DOpenState, string> = {
  closed: "閉じる",
  ajar: "少し開く",
  open: "開く",
};

/** Hinge angle of "少し開く"; "開く" comes from the binding model (flatter for 中綴じ). */
export const BOOK3D_AJAR_ANGLE = 34;

/** Curl intensity per open state (0 = no page curve rendered). */
export const BOOK3D_CURL_INTENSITY: Record<Book3DOpenState, number> = { closed: 0, ajar: 0.6, open: 1 };

export function book3dOpenAngle(state: Book3DOpenState, model: GutterModel): number {
  if (state === "closed") return 0;
  if (state === "ajar") return BOOK3D_AJAR_ANGLE;
  return model.openAngleDeg;
}

/** Clear space (px) kept between the book and the stage edges. */
export const BOOK3D_FIT_SAFE_PX = 14;
/**
 * Extra room for what the camera adds on top of the flat w × h box. Per open
 * state, NOT per drag angle, so rotating the book never rescales it.
 */
const BOOK3D_FIT_ALLOWANCE: Record<Book3DOpenState, { x: number; y: number }> = {
  closed: { x: 1.08, y: 1.06 },
  ajar: { x: 1.12, y: 1.36 },
  open: { x: 1.04, y: 1.08 },
};

/**
 * Base ("100%") scale of the book: 86% width / 80% height of the stage, and
 * never closer than BOOK3D_FIT_SAFE_PX to an edge. User zoom multiplies it.
 */
export function book3dFitScale(
  stage: { width: number; height: number },
  bookWidthPx: number,
  bookHeightPx: number,
  openState: Book3DOpenState,
): number {
  if (!(stage.width > 0 && stage.height > 0 && bookWidthPx > 0 && bookHeightPx > 0)) return 0.5;
  const allow = BOOK3D_FIT_ALLOWANCE[openState];
  const accepted = Math.min((stage.width * 0.86) / bookWidthPx, (stage.height * 0.8) / bookHeightPx);
  const safeWidth = Math.max(1, stage.width - 2 * BOOK3D_FIT_SAFE_PX) / (bookWidthPx * allow.x);
  const safeHeight = Math.max(1, stage.height - 2 * BOOK3D_FIT_SAFE_PX) / (bookHeightPx * allow.y);
  return Math.max(0.05, Math.min(accepted, safeWidth, safeHeight));
}

/**
 * The two pages the open book shows for `currentPage`.
 * TateSpun is always right-bound (縦書き): the spine is on the right of the
 * front cover. Like the 2D 見開き, the odd page reads on the left (it lies on
 * the back-cover half, which stays still) and the even page on the right (it
 * lies on the front-cover half, which turns on the hinge). Page 1 alone faces
 * the inside of the front cover; a last even page faces the back cover.
 *
 * Indices are Presentation Sequence positions (0-based); page numbers are the
 * physical ones shown on ノンブル and in the pager.
 */
export type Book3DSpread = {
  /** left page (odd, static half) */
  leftIndex: number | null;
  /** right page (even, hinged half) */
  rightIndex: number | null;
  leftPage: number | null;
  rightPage: number | null;
};

export function book3dSpreadForPage(physicalNumbers: readonly number[], currentPage: number): Book3DSpread {
  const empty: Book3DSpread = { leftIndex: null, rightIndex: null, leftPage: null, rightPage: null };
  const total = physicalNumbers.length;
  if (total === 0) return empty;
  const groups = computeSpreadGroups(total);
  const groupIndex = findPreviewSpreadIndex(groups, presentationIndexForPhysicalPage(physicalNumbers, currentPage));
  if (groupIndex === null) return empty;
  const spread = { ...empty };
  for (const index of groups[groupIndex]) {
    const page = physicalNumbers[index] ?? index + 1;
    if (page % 2 === 1) {
      spread.leftIndex = index;
      spread.leftPage = page;
    } else {
      spread.rightIndex = index;
      spread.rightPage = page;
    }
  }
  return spread;
}

/** Each open state comes with a camera that actually shows it (CST values). */
export function book3dViewForOpenState(
  state: Book3DOpenState,
  spineEdge: "left" | "right",
): { yaw: number; pitch: number } {
  const spineSign = spineEdge === "right" ? 1 : -1;
  if (state === "ajar") return { yaw: spineSign * 30, pitch: -10 };
  if (state === "open") return { yaw: 0, pitch: 16 };
  return { yaw: spineEdge === "right" ? -32 : 32, pitch: -8 };
}

/** Per-browser preferences (separate on purpose): guide visibility / explanation. */
export const BOOK3D_GUTTER_GUIDE_PREF_KEY = "tatespun-3d-gutter-guide";
export const BOOK3D_GUTTER_HELP_PREF_KEY = "tatespun-3d-gutter-guide-help";

export function parseGutterGuidePref(stored: string | null): boolean {
  return stored !== "off";
}

export function parseGutterHelpPref(stored: string | null): boolean {
  return stored !== "dismissed";
}
