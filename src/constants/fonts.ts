/**
 * The typography faces TateSpun exposes in its font selectors.
 *
 * Every `value` here is either one of the four web fonts already loaded in
 * `src/app/layout.tsx` (Shippori Mincho / Zen Old Mincho / Noto Serif JP /
 * Noto Sans JP) or a pure system stack — no new font dependency. The body
 * font selector (PageSettingsPanel「ページ設定」) and the page-number font
 * selector (「ノンブル・柱」) both render from this one list so the two can
 * never drift apart.
 */
export interface FontOption {
  value: string;
  label: string;
}

export const FONT_FAMILY_OPTIONS: readonly FontOption[] = [
  { value: "'Shippori Mincho', serif", label: "しっぽり明朝" },
  { value: "'Zen Old Mincho', serif", label: "Zenオールド明朝" },
  { value: "'Noto Serif JP', serif", label: "Noto Serif 明朝" },
  { value: "'BIZ UDMincho', serif", label: "BIZ UD明朝" },
  { value: "'Shippori Mincho B1', serif", label: "しっぽり明朝B1" },
  { value: "'Kaisei Tokumin', serif", label: "Kaisei Tokumin（解星 特ミン）" },
  { value: "'Kaisei Opti', serif", label: "Kaisei Opti（解星 オプティ）" },
  { value: "'Hina Mincho', serif", label: "ひな明朝" },
  { value: "'Zen Antique', serif", label: "Zenアンティーク" },
  { value: "'Noto Sans JP', sans-serif", label: "Noto Sans ゴシック" },
  { value: "'BIZ UDGothic', sans-serif", label: "BIZ UDゴシック" },
  { value: "'Zen Kaku Gothic New', sans-serif", label: "Zen角ゴシック" },
  { value: "'M PLUS 1p', sans-serif", label: "M PLUS 1p" },
  { value: "'Zen Maru Gothic', sans-serif", label: "Zen丸ゴシック" },
  { value: "'Kiwi Maru', sans-serif", label: "キウイ丸" },
];

/**
 * TSP-PHASE13-001: every choice must have a font PDF can embed
 * (`PUBLICATION_FONT_ASSETS`), so the system「serif」stack was retired.
 * A stored family that is no longer offered resolves to `fallback`
 * (Shippori Mincho for the body — what its PDF already printed — or the
 * "same as body" sentinel for the ノンブル / 奥付).
 */
export function normalizeFontChoice(value: string | undefined, fallback: string): string {
  if (value === undefined || value === "") return fallback;
  return FONT_FAMILY_OPTIONS.some((option) => option.value === value) ? value : fallback;
}

/**
 * Sentinel stored in `masterPage.nombreFontFamily` meaning "follow the body
 * font". It is the default for every document (including those saved before
 * the setting existed — see `DEFAULT_MASTER_PAGE_SETTINGS`), so a document
 * with no explicit choice keeps rendering its page number in the body face.
 */
export const NOMBRE_FONT_SAME_AS_BODY = "";

/** Resolves the effective page-number font family. */
export function resolveNombreFontFamily(
  nombreFontFamily: string | undefined,
  bodyFontFamily: string
): string {
  return nombreFontFamily && nombreFontFamily !== NOMBRE_FONT_SAME_AS_BODY
    ? nombreFontFamily
    : bodyFontFamily;
}

const DEFAULT_BODY_FONT_FAMILY = "'Shippori Mincho', serif";

/** Body / ノンブル font choices of loaded settings, with retired families resolved. */
export function normalizeSettingsFonts<T extends { fontFamily: string; masterPage: { nombreFontFamily?: string } }>(settings: T): T {
  const fontFamily = normalizeFontChoice(settings.fontFamily, DEFAULT_BODY_FONT_FAMILY);
  const nombreFontFamily = normalizeFontChoice(settings.masterPage.nombreFontFamily, NOMBRE_FONT_SAME_AS_BODY);
  if (fontFamily === settings.fontFamily && nombreFontFamily === (settings.masterPage.nombreFontFamily ?? NOMBRE_FONT_SAME_AS_BODY)) {
    return settings;
  }
  return { ...settings, fontFamily, masterPage: { ...settings.masterPage, nombreFontFamily } };
}
