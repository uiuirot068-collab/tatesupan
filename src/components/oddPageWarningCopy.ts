/**
 * TSP-UX-V3-LOOP2-ODD-PAGE-012 canonical copy, pulled out as plain data so
 * it's testable without mounting OddPageExportWarning.tsx -- ViewportModal
 * (which it wraps) renders null outside a browser DOM (no `document`), so a
 * `renderToStaticMarkup` test of the component itself can never see this
 * text in this repo's Node-only (no jsdom) vitest environment.
 */
export function buildOddPageWarningTitle(totalPages: number): string {
  return `全体が奇数ページです（全 ${totalPages} ページ）`;
}

export const ODD_PAGE_WARNING_MEANING =
  "冊子にすると、最後の見開きの片側が空く構成です。";

export const ODD_PAGE_WARNING_EXPLANATION =
  "PDFはこのまま書き出せます。ただし、印刷所や本の仕様によっては白ページの追加が必要です。入稿先の指定を確認してください。";

export const ODD_PAGE_WARNING_CONTINUE_LABEL = "このままPDFを書き出す";

export const ODD_PAGE_WARNING_RETURN_LABEL = "戻って確認する";
