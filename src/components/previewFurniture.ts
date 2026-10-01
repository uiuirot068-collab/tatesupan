/**
 * Phase 11 残件③: Preview page furniture (ノンブル / 柱) through the V2
 * canonical path.
 *
 * WHAT a page carries comes from Core (`CanonicalPage.folio` / `.header`, then
 * `v2Bridge/pageFurniture.ts` for the Editor's per-page overrides and the TOC
 * rule) — the same objects PDF / JPG paint. WHERE it sits on the paper comes
 * from `typesetting-v2/renderer/furnitureGeometry.ts`, the one placement
 * function the Publication paint plan also uses. This module only converts
 * that shared millimetre placement into Preview CSS; it decides nothing.
 *
 * LEGACY cards (no V2 page yet / V2 disabled) keep the prop-based rules.
 */
import type { CSSProperties } from "react";
import { MM_PER_PT, PX_PER_MM, type PageSettings, type PaperSize } from "@/lib/pageLayout";
import type { FolioPosition, GeneratedHeader, GeneratedPageFurniture, ResolvedFolioPosition } from "../../typesetting-v2/core/layout/schema";
import { resolveFolioPhysicalSide } from "../../typesetting-v2/core/folio";
import {
  folioPlacement,
  headerPlacement,
  type FurniturePageFrame,
  type FurniturePlacement,
} from "../../typesetting-v2/renderer/furnitureGeometry";

/** Canonical furniture of one V2 page (body, TOC or colophon). */
export interface CanonicalPageFurniture {
  folio?: GeneratedPageFurniture;
  header?: GeneratedHeader;
}

export interface PreviewHashiraInput {
  hasCanonicalPage: boolean;
  canonicalHeader: GeneratedHeader | undefined;
  /** LEGACY: page override text or the odd/even master text. */
  legacyText: string | undefined;
  hideHashira: boolean;
  /** LEGACY band (`masterPage.hashiraPosition`). */
  legacyBand: "top" | "bottom";
  isOddPage: boolean;
}

export interface PreviewHashira {
  show: boolean;
  text: string;
  band: "top" | "bottom";
  horizontal: ResolvedFolioPosition;
}

/**
 * V2: Core's header decides presence, text, band and side (per-page
 * overrides, TOC removal and odd/even text already applied). LEGACY: the
 * historical rule — text from override/master, always on the 小口 side.
 */
export function resolvePreviewHashira(input: PreviewHashiraInput): PreviewHashira {
  if (input.hasCanonicalPage) {
    const header = input.canonicalHeader;
    if (!header || header.text.length === 0) return { show: false, text: "", band: input.legacyBand, horizontal: "center" };
    return { show: true, text: header.text, band: header.position.band, horizontal: header.position.horizontal };
  }
  const text = input.legacyText ?? "";
  return {
    show: text.length > 0 && !input.hideHashira,
    text,
    band: input.legacyBand,
    horizontal: resolveFolioPhysicalSide("outer", input.isOddPage),
  };
}

/** Physical side of an Editor ノンブル position on a page (Core's parity rule). */
export function folioSideForPage(position: FolioPosition, isOddPage: boolean): ResolvedFolioPosition {
  return resolveFolioPhysicalSide(position, isOddPage);
}

/** The Editor's furniture frame — the same values `buildV2PageGeometry` hands the export. */
export function previewFurnitureFrame(settings: PageSettings, paper: PaperSize): FurniturePageFrame {
  return {
    paperWidthMm: paper.widthMm,
    paperHeightMm: paper.heightMm,
    marginTopMm: settings.marginTop,
    marginBottomMm: settings.marginBottom,
    marginLeftMm: settings.marginOuter,
    marginRightMm: settings.marginGutter,
    furniture: {
      marginGutterMm: settings.marginGutter,
      marginOuterMm: settings.marginOuter,
      folioBottomEdgeMm: settings.masterPage.nombreBottomMargin,
    },
  };
}

/**
 * Furniture font size on the Preview card. Print papers are drawn at
 * `PX_PER_MM`, so the furniture is scaled exactly like body text and keeps
 * its printed proportion to the page. Web閲覧用 (isPx) keeps its fixed
 * web-reading point size.
 */
export function previewFurnitureFontSize(fontSizePt: number, paper: PaperSize): string {
  return paper.isPx ? `${fontSizePt}pt` : `${fontSizePt * MM_PER_PT * PX_PER_MM}px`;
}

/** Folio placement in paper millimetres (shared with PDF/JPG). */
export function previewFolioPlacement(
  side: ResolvedFolioPosition,
  frame: FurniturePageFrame,
  isOddPage: boolean,
  fontSizePt: number
): FurniturePlacement {
  // bodyEmMm only matters for frames without furniture geometry, which the
  // Preview never builds.
  return folioPlacement(side, frame, isOddPage, fontSizePt, 0);
}

/** 柱 placement in paper millimetres (shared with PDF/JPG). */
export function previewHeaderPlacement(
  band: "top" | "bottom",
  side: ResolvedFolioPosition,
  frame: FurniturePageFrame,
  isOddPage: boolean
): FurniturePlacement {
  return headerPlacement({ band, horizontal: side }, frame, isOddPage, 0);
}

/**
 * Absolute CSS for one furniture text box on a Preview card whose outer box
 * includes `bleedMm` on every side. The box is one line high (`lineHeight: 1`)
 * and centred on `yCenterMm`; horizontally its left/right edge (or centre) is
 * the placement anchor.
 */
export function previewFurnitureStyle(placement: FurniturePlacement, paperWidthMm: number, bleedMm: number): CSSProperties {
  const topPx = (placement.yCenterMm + bleedMm) * PX_PER_MM;
  const vertical: CSSProperties = { position: "absolute", top: topPx, transform: "translateY(-50%)", lineHeight: 1, whiteSpace: "nowrap" };
  if (placement.align === "left") return { ...vertical, left: (placement.xMm + bleedMm) * PX_PER_MM };
  if (placement.align === "right") return { ...vertical, right: (paperWidthMm - placement.xMm + bleedMm) * PX_PER_MM };
  return { ...vertical, left: 0, right: 0, display: "flex", justifyContent: "center" };
}

export interface ColophonPreviewFurnitureInput {
  /** V2 only: the colophon page's canonical furniture. */
  canonicalFurniture: CanonicalPageFurniture | undefined;
  /** LEGACY rule (`resolveColophonNombre`). */
  legacyNombre: { value: number; isOddPage: boolean } | null;
  /** LEGACY physical side of the Editor nombre position. */
  legacySide: ResolvedFolioPosition;
}

export interface ColophonPreviewFurniture {
  nombre: { value: number; side: ResolvedFolioPosition } | null;
  hashira: { text: string; band: "top" | "bottom"; horizontal: ResolvedFolioPosition } | null;
}

/**
 * Colophon page furniture on the Preview. V2: exactly Core's canonical
 * colophon folio / 柱 (what PDF/JPG print — Core continues both across the
 * physical sequence). LEGACY: nombre from the master settings, no 柱.
 */
export function resolveColophonPreviewFurniture(input: ColophonPreviewFurnitureInput): ColophonPreviewFurniture {
  if (input.canonicalFurniture) {
    const { folio, header } = input.canonicalFurniture;
    const parsed = folio ? Number(folio.text) : Number.NaN;
    return {
      nombre: folio && Number.isFinite(parsed) ? { value: parsed, side: folio.position } : null,
      hashira: header && header.text.length > 0 ? { text: header.text, band: header.position.band, horizontal: header.position.horizontal } : null,
    };
  }
  return {
    nombre: input.legacyNombre ? { value: input.legacyNombre.value, side: input.legacySide } : null,
    hashira: null,
  };
}
