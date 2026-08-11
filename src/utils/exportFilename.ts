import type { PdfExportMode } from './exportPdf';

/** 作品タイトルが空/未設定のときのファイル名フォールバック。既存UI（ProjectListModal等）の「無題の作品」慣例と揃えた表記。 */
const FALLBACK_TITLE = '無題のドキュメント';

/** PDF出力モードごとの、G-1で例示されたファイル名サフィックス。 */
const PDF_MODE_SUFFIX: Record<PdfExportMode, string> = {
  trim: '仕上がり',
  bleed: '断ち落とし',
  full: '入稿用',
};

/** OSで使用不能な文字（\ / : * ? " < > |）にマッチする文字クラス。 */
const FORBIDDEN_FILENAME_CHARS = new RegExp('[\\\\/:*?"<>|]', 'g');

/**
 * OSで使用不能な文字を除去し、Windowsでファイル名末尾に残ると
 * 無視/エラーになる末尾のドット・空白も取り除く。
 * 結果が空文字ならフォールバック名を使う。
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(FORBIDDEN_FILENAME_CHARS, '')
    .trim()
    .replace(/[.\s]+$/, '');
  return cleaned.length > 0 ? cleaned : FALLBACK_TITLE;
}

function padPageNumber(pageNumber: number): string {
  return String(pageNumber).padStart(3, '0');
}

/** JPG単ページ / JPG一括（個別ダウンロード）で共通のページ単位ファイル名。 */
export function buildPageJpgFileName(title: string, pageNumber: number): string {
  return `${sanitizeFilename(title)}_${padPageNumber(pageNumber)}.jpg`;
}

export function buildZipFileName(title: string): string {
  return `${sanitizeFilename(title)}_jpg.zip`;
}

export function buildPdfFileName(
  title: string,
  mode: PdfExportMode,
  scope: 'all' | 'selected'
): string {
  const suffix = PDF_MODE_SUFFIX[mode];
  const scopeSuffix = scope === 'selected' ? '_選択' : '';
  return `${sanitizeFilename(title)}_${suffix}${scopeSuffix}.pdf`;
}
