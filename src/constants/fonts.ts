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
  { value: "'Noto Sans JP', sans-serif", label: "Noto Sans ゴシック" },
  { value: "serif", label: "システム標準明朝" },
];

/**
 * Sentinel stored in `masterPage.nombreFontFamily` meaning "follow the body
 * font". It is the default for every document (including those saved before
 * the setting existed — see `DEFAULT_MASTER_PAGE_SETTINGS`), so a document
 * with no explicit choice keeps rendering its page number in the body face.
 */
export const NOMBRE_FONT_SAME_AS_BODY = "";

/**
 * Resolves the effective page-number font family.
 *
 * TSP-PHASE13-001: ノンブル・奥付は本文と同じフォントに統一（なつお決定
 * 2026-10-02）。PDF/JPG が本文フォントでしか描けないため、Preview との
 * 食い違いをなくす。保存済みの `nombreFontFamily` は消さずに無視する。
 */
export function resolveNombreFontFamily(
  _nombreFontFamily: string | undefined,
  bodyFontFamily: string
): string {
  return bodyFontFamily;
}
