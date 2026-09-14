/** 作品タイトルが空/未設定のときのファイル名フォールバック。既存UI（ProjectListModal等）の「無題の作品」慣例と揃えた表記。 */
const FALLBACK_TITLE = '無題のドキュメント';

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

/** PDF書き出しファイル名の入力欄が受け付ける文字（半角英数字のみ）にマッチする文字クラス。 */
const PDF_FILENAME_ALLOWED_CHARS = /[^A-Za-z0-9]/g;

/**
 * PDF保存ファイル名欄の入力/貼り付けをサニタイズする。全角英数字・記号・
 * 空白・日本語などASCII英数字以外は全て除去する（入稿用ファイル名は
 * 半角英数字のみが安全という前提のβ仕様）。
 */
export function sanitizePdfFilenameStem(input: string): string {
  return input.replace(PDF_FILENAME_ALLOWED_CHARS, '');
}

function padDatePart(value: number): string {
  return String(value).padStart(2, '0');
}

/** PDF保存ファイル名欄の初期値: `TateSpunYYYYMMDD`（ローカル日付）。 */
export function buildDefaultPdfFilenameStem(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = padDatePart(now.getMonth() + 1);
  const day = padDatePart(now.getDate());
  return `TateSpun${year}${month}${day}`;
}

/** サニタイズ済みstemに`.pdf`拡張子を付与する。二重拡張子を作らない。 */
export function buildPdfFileNameFromStem(stem: string): string {
  return `${stem}.pdf`;
}
