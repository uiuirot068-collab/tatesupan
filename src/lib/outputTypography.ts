import type { PageSettings } from "@/lib/pageLayout";
import {
  publicationFurnitureFontSizePt,
  WEB_READING_BODY_FONT_SIZE,
  WEB_READING_FOLIO_FONT_SIZE,
  WEB_READING_RUNNING_HEAD_FONT_SIZE,
} from "../../typesetting-v2/core/settings/outputTypography";

export {
  publicationFurnitureFontSizePt,
  WEB_READING_BODY_FONT_SIZE,
  WEB_READING_FOLIO_FONT_SIZE,
  WEB_READING_RUNNING_HEAD_FONT_SIZE,
};

const isPositiveFinite = (value: number | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

/**
 * Canonicalizes fixed Web output sizes and fills genuinely missing publication
 * defaults. Existing print values are authoritative manual/persisted values:
 * normalization must never continuously re-derive them from body size.
 */
export function normalizeOutputTypography(settings: PageSettings): PageSettings {
  const web = settings.paperSize === "Web閲覧用";
  const bodyFontSizePt = web ? WEB_READING_BODY_FONT_SIZE : settings.fontSizePt;
  return {
    ...settings,
    fontSizePt: bodyFontSizePt,
    masterPage: {
      ...settings.masterPage,
      nombreFontSize: web
        ? WEB_READING_FOLIO_FONT_SIZE
        : isPositiveFinite(settings.masterPage.nombreFontSize)
          ? settings.masterPage.nombreFontSize
          : publicationFurnitureFontSizePt(bodyFontSizePt),
      headerFontSize: web
        ? WEB_READING_RUNNING_HEAD_FONT_SIZE
        : isPositiveFinite(settings.masterPage.headerFontSize)
          ? settings.masterPage.headerFontSize
          : publicationFurnitureFontSizePt(bodyFontSizePt),
    },
  };
}
