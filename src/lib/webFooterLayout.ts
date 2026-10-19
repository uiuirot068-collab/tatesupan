/**
 * TSP-PRINT-004 (P4-8): the Web閲覧用 footer (rule, TateSpun logo, wordmark,
 * URL, hashtag) — ONE set of measurements for the Preview overlay
 * (`PageCard` WebFooterOverlay, CSS) and the JPG export (`drawWebFooter`,
 * canvas). Values are paper px of the 768px-wide Web閲覧用 page; the JPG
 * multiplies them by its own scale.
 */
export const WEB_FOOTER_BOTTOM_PX = 15;
export const WEB_FOOTER_RULE_PX = 1;
export const WEB_FOOTER_RULE_COLOR = "#333";
export const WEB_FOOTER_PAD_TOP_PX = 4;
export const WEB_FOOTER_PAD_BOTTOM_PX = 6;
export const WEB_FOOTER_PAD_LEFT_PX = 48;
export const WEB_FOOTER_PAD_RIGHT_PX = 16;
export const WEB_FOOTER_GAP_PX = 7;
export const WEB_FOOTER_TEXT_COLOR = "#888";
export const WEB_FOOTER_URL = "https://spuntales.net/tatespun/";
export const WEB_FOOTER_HASHTAG = "#スパンテイルズ";
export const WEB_FOOTER_FONT_FAMILY = '"Shippori Mincho", serif';

/**
 * The footer text sizes follow the body size (the wordmark at 75% of it, the
 * URL / hashtag one step smaller), so the footer keeps the same weight beside
 * any Web body size.
 */
export function webFooterFontSizesPx(bodyFontSizePx: number): { main: number; fine: number } {
  const main = bodyFontSizePx * 0.75;
  return { main, fine: main * 0.82 };
}
