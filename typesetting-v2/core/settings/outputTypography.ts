export const WEB_READING_BODY_FONT_SIZE = 30;
export const WEB_READING_FOLIO_FONT_SIZE = 15;
export const WEB_READING_RUNNING_HEAD_FONT_SIZE = 20;

export function publicationFurnitureFontSizePt(bodyFontSizePt: number): number {
  return Math.max(4, bodyFontSizePt - 3);
}
