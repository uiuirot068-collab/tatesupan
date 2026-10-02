/**
 * Page furniture (folio / 柱) physical placement — Phase 11 残件③.
 *
 * Core decides WHAT each page carries (`CanonicalPage.folio` / `.header`,
 * already parity-resolved to a physical side). This module is the ONE place
 * that turns that semantic placement into paper coordinates, and it is shared
 * by every painter: the Publication paint plan (PDF / JPG) and the Editor's
 * Preview overlays. Before this, Preview anchored furniture to the text
 * frame's edge with parity-aware ノド/小口 margins and the Editor's own
 * `nombreBottomMargin`, while PDF/JPG centred it half a cell inside a fixed,
 * parity-independent left/right margin at `marginBottom / 2` — the same
 * page printed its ノンブル/柱 in a different place than the Preview showed.
 *
 * Coordinates are millimetres on the finished (trim) page, origin top-left.
 * A caller that supplies `PublicationFurnitureGeometry` gets the Editor's
 * (Preview's) established geometry; without it the historical Publication
 * formulas are kept byte-for-byte (every pre-existing renderer test/tool).
 */
import type { ResolvedFolioPosition, ResolvedHeaderPosition } from "../core/layout/schema";

/** Editor furniture geometry (TateSpun `PageSettings` / `MasterPageSettings`). */
export interface PublicationFurnitureGeometry {
  /** ノド (binding side) margin, mm. */
  marginGutterMm: number;
  /** 小口 (outer side) margin, mm. */
  marginOuterMm: number;
  /** Distance from the paper's bottom edge to the folio's bottom edge, mm (`nombreBottomMargin`). */
  folioBottomEdgeMm: number;
  /**
   * TSP-PHASE13-001: 隠しノンブル (`masterPage.showHiddenNombre`). Present only
   * when enabled; `nombreStart` gives the number of a page without a folio.
   */
  hiddenNombre?: { nombreStart: number };
}

export interface FurniturePageFrame {
  paperWidthMm: number;
  paperHeightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  /** Fixed left/right margins used when no furniture geometry is supplied. */
  marginLeftMm: number;
  marginRightMm: number;
  furniture?: PublicationFurnitureGeometry;
}

export interface FurniturePlacement {
  /** Anchor x (mm): the text's left edge, centre or right edge per `align`. */
  xMm: number;
  align: "left" | "center" | "right";
  /** Vertical centre of the text (mm from the paper's top edge). */
  yCenterMm: number;
}

const MM_PER_PT = 25.4 / 72;

/**
 * Physical left / right text-frame margins of one page. Right-bound vertical
 * books: an odd page (recto) has 小口 on the left and ノド on the right; an
 * even page (verso) mirrors — the same convention as Core's
 * `resolveFolioPhysicalSide` and the Preview sheet padding.
 */
export function furnitureFrameMargins(frame: FurniturePageFrame, isOddPage: boolean): { leftMm: number; rightMm: number } {
  if (!frame.furniture) return { leftMm: frame.marginLeftMm, rightMm: frame.marginRightMm };
  const { marginGutterMm, marginOuterMm } = frame.furniture;
  return isOddPage ? { leftMm: marginOuterMm, rightMm: marginGutterMm } : { leftMm: marginGutterMm, rightMm: marginOuterMm };
}

/**
 * Folio placement. With Editor geometry: left/right anchor the number's
 * outer edge to the text frame's edge (it extends inward), centre is the
 * paper centre, and the number's bottom edge sits `folioBottomEdgeMm` above
 * the paper bottom (a one-line box of the folio font size).
 */
export function folioPlacement(
  position: ResolvedFolioPosition,
  frame: FurniturePageFrame,
  isOddPage: boolean,
  fontSizePt: number,
  bodyEmMm: number
): FurniturePlacement {
  if (!frame.furniture) {
    const xMm =
      position === "left"
        ? frame.marginLeftMm + bodyEmMm / 2
        : position === "right"
          ? frame.paperWidthMm - frame.marginRightMm - bodyEmMm / 2
          : frame.paperWidthMm / 2;
    return { xMm, align: "center", yCenterMm: frame.paperHeightMm - frame.marginBottomMm / 2 };
  }
  const { leftMm, rightMm } = furnitureFrameMargins(frame, isOddPage);
  const yCenterMm = frame.paperHeightMm - frame.furniture.folioBottomEdgeMm - (fontSizePt * MM_PER_PT) / 2;
  if (position === "left") return { xMm: leftMm, align: "left", yCenterMm };
  if (position === "right") return { xMm: frame.paperWidthMm - rightMm, align: "right", yCenterMm };
  return { xMm: frame.paperWidthMm / 2, align: "center", yCenterMm };
}

/**
 * 柱 placement: vertically centred in its margin band (top / bottom);
 * horizontally flush with the text frame edge on its resolved side (outer
 * side by default), or the paper centre.
 *
 * `legacyColophonCentring`: the historical colophon-page painter centred the
 * 柱 half a cell inside the margin; kept only for callers without Editor
 * geometry so existing renderer fixtures stay byte-identical.
 */
export function headerPlacement(
  position: ResolvedHeaderPosition,
  frame: FurniturePageFrame,
  isOddPage: boolean,
  bodyEmMm: number,
  legacyColophonCentring = false
): FurniturePlacement {
  const yCenterMm = position.band === "top" ? frame.marginTopMm / 2 : frame.paperHeightMm - frame.marginBottomMm / 2;
  if (!frame.furniture && legacyColophonCentring) {
    const xMm =
      position.horizontal === "left"
        ? frame.marginLeftMm + bodyEmMm / 2
        : position.horizontal === "right"
          ? frame.paperWidthMm - frame.marginRightMm - bodyEmMm / 2
          : frame.paperWidthMm / 2;
    return { xMm, align: "center", yCenterMm };
  }
  const { leftMm, rightMm } = furnitureFrameMargins(frame, isOddPage);
  if (position.horizontal === "left") return { xMm: leftMm, align: "left", yCenterMm };
  if (position.horizontal === "right") return { xMm: frame.paperWidthMm - rightMm, align: "right", yCenterMm };
  return { xMm: frame.paperWidthMm / 2, align: "center", yCenterMm };
}

/** 隠しノンブル font size (pt, physical) and its inset from the trim edge (mm). */
export const HIDDEN_NOMBRE_FONT_SIZE_PT = 6;
export const HIDDEN_NOMBRE_INSET_MM = 1;

/**
 * TSP-PHASE13-001: 隠しノンブル geometry shared by the Preview overlay and
 * PDF/JPG. The number runs vertically (one upright digit per em), centred on
 * the page height, against the ノド trim edge (right on odd pages, left on
 * even pages). Returns the column centre x and the centre y of each digit.
 */
export function hiddenNombreGlyphCentres(
  text: string,
  frame: { paperWidthMm: number; paperHeightMm: number },
  isOddPage: boolean
): { xCenterMm: number; emMm: number; yCentersMm: number[] } {
  const emMm = HIDDEN_NOMBRE_FONT_SIZE_PT * MM_PER_PT;
  const xCenterMm = isOddPage
    ? frame.paperWidthMm - HIDDEN_NOMBRE_INSET_MM - emMm / 2
    : HIDDEN_NOMBRE_INSET_MM + emMm / 2;
  const glyphs = Array.from(text);
  const topMm = (frame.paperHeightMm - glyphs.length * emMm) / 2;
  return { xCenterMm, emMm, yCentersMm: glyphs.map((_, i) => topMm + (i + 0.5) * emMm) };
}

/** The number a 隠しノンブル shows: the page's folio when it has one, else nombreStart + physical page - 1. */
export function hiddenNombreText(folioText: string | undefined, nombreStart: number, physicalPageNumber: number): string {
  const parsed = folioText === undefined ? Number.NaN : Number(folioText);
  return String(Number.isFinite(parsed) && folioText !== "" ? parsed : nombreStart + physicalPageNumber - 1);
}
