import { PAPER_SIZE_TEMPLATES } from "@/constants/paperSizes";
import {
  recommendedNombreFontSizePt,
  type ColumnCount,
  type NombrePosition,
  type PageSettings,
  type PaperSizeKey,
} from "@/lib/pageLayout";

const ONE_COLUMN_DEFAULTS = new Set<PaperSizeKey>(["文庫", "A6"]);
const COLUMN_FONT_PRESETS = new Set<PaperSizeKey>(["A5", "B5"]);

function profileFor(paperSize: PaperSizeKey, columnCount: ColumnCount) {
  const template = PAPER_SIZE_TEMPLATES[paperSize];
  return columnCount === 2 ? template.cols2 : template.cols1;
}

/** Paper changes reapply the complete destination preset, by product decision. */
export function applyDestinationPaperPreset(
  base: PageSettings,
  paperSize: PaperSizeKey
): PageSettings {
  const columnCount: ColumnCount = ONE_COLUMN_DEFAULTS.has(paperSize)
    ? 1
    : base.columnCount;
  const profile = profileFor(paperSize, columnCount);
  const nombreFontSize = profile.nombreFontSize ?? recommendedNombreFontSizePt(profile.fontSizePt);
  const headerFontSize = profile.headerFontSize ?? nombreFontSize;
  return {
    ...base,
    paperSize,
    columnCount,
    marginTop: profile.marginTop,
    marginBottom: profile.marginBottom,
    marginGutter: profile.marginGutter,
    marginOuter: profile.marginOuter,
    fontSizePt: profile.fontSizePt,
    lineHeightRatio: profile.lineSpacing,
    columnGapMm: profile.columnGap,
    charsPerLine: profile.charsPerLine,
    linesPerColumn: profile.linesPerColumn,
    masterPage: {
      ...base.masterPage,
      nombrePosition: profile.nombrePosition as NombrePosition,
      nombreBottomMargin: profile.nombreDistance,
      nombreFontSize,
      headerFontSize,
      nombreLayoutCustomized: false,
    },
  };
}

/**
 * A5/B5 column changes are the only column-triggered font preset. Other
 * manual typography/furniture values remain authoritative; the column gap
 * follows the destination structure so a newly selected 2-column layout is
 * never created with a zero gap.
 */
export function applyColumnCountPreset(
  base: PageSettings,
  columnCount: ColumnCount
): PageSettings {
  const profile = profileFor(base.paperSize, columnCount);
  return {
    ...base,
    columnCount,
    columnGapMm: profile.columnGap,
    ...(COLUMN_FONT_PRESETS.has(base.paperSize)
      ? { fontSizePt: profile.fontSizePt }
      : {}),
  };
}
