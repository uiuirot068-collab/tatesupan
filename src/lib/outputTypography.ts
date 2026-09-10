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

/** Canonicalizes the sizes that are fixed output contracts, including old documents. */
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
        : publicationFurnitureFontSizePt(bodyFontSizePt),
      headerFontSize: web
        ? WEB_READING_RUNNING_HEAD_FONT_SIZE
        : publicationFurnitureFontSizePt(bodyFontSizePt),
    },
  };
}
