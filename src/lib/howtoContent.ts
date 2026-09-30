import { EDITOR_PAGE_HELP, EXPORT_FILENAME_HELP, TITLE_HELP } from "./editorTerminology";

/**
 * TSP-HOWTO-BETA-016 — shared content for the `/howto` beta onboarding page.
 *
 * Pulled into its own module (rather than inlined in `src/app/howto/page.tsx`)
 * so `src/lib/howtoContent.test.ts` can assert on it directly: every
 * referenced image file actually exists under `public/howto/assets/`, and
 * the two beta-required explanations (Editor Pages, PDF filename) contain
 * the right user-facing phrasing without leaking internal implementation
 * terms.
 */

export const HOWTO_ROUTE = "/howto";

export interface HowtoImage {
  /** Filename under `public/howto/assets/`. */
  file: string;
  alt: string;
}

export const HOWTO_IMAGES = {
  hero: { file: "hero-guide-illust.png", alt: "パソコンでTateSpunを開く案内猫と、頭上の「？」マーク" },
  guideCat: { file: "guide-cat-icon.png", alt: "TateSpun案内猫のアイコン" },
  myCheck: { file: "feature-01-my-check.png", alt: "完成前マイチェックリストとPDF書き出し前チェックの画面" },
  writingCheck: { file: "feature-02-writing-check.png", alt: "文章チェックβの表示例" },
  bodyNotation: { file: "feature-03-body-notation.png", alt: "ルビ・縦中横・改ページの本文記法の入力例" },
  workCounter: { file: "feature-04-work-counter.png", alt: "作業カウントの表示例" },
  txtImportExport: { file: "feature-05-txt-import-export.png", alt: "TXT出入力メニューの画面" },
  settings: { file: "tip-01-settings.png", alt: "本の設定画面の例" },
  preview: { file: "tip-02-preview.png", alt: "プレビュー機能の画面" },
  fourButtons: { file: "tip-03-four-buttons.png", alt: "タイトル下の便利な４ボタン" },
  memo: { file: "tip-04-memo.png", alt: "メモ機能の画面" },
  focusMode: { file: "tip-05-focus-mode.png", alt: "集中モードの画面" },
  folioHeader: { file: "tip-06-folio-header.png", alt: "ノンブル・柱の設定画面" },
  imageInsert: { file: "tip-07-image-insert.png", alt: "画像挿入機能の画面" },
  colophon: { file: "tip-08-colophon.png", alt: "奥付機能の画面" },
  darkMode: { file: "tip-09-dark-mode.png", alt: "ダークモード表示例" },
  exportMenu: { file: "tip-10-export.png", alt: "書き出しメニューの画面" },
} as const satisfies Record<string, HowtoImage>;

/**
 * TSP-HOWTO-BETA-016 test req #10 — Editor Pages explained without internal
 * implementation terminology (forcedBoundaries / joinedRanges / WINDOWED /
 * FULL / auto-manual). Placed inside the existing「原稿持ち込み運用」chapter.
 */
export const EDITOR_PAGE_EXPLANATION_TITLE = "長い原稿を分割できる「編集ページ」";
export const EDITOR_PAGE_EXPLANATION_BODY =
  "長い原稿は、書きやすいように軽量な「編集ページ」に分けて作業できます。" +
  "テキストエディター上部の「ここで区切る」で新しい編集ページを作り、続けて書きたいときは「前のページとつなぐ」でもとに戻せます。" +
  "編集ページをまたいで原稿全体を操作するときは、「全文を選択」または Ctrl+A を使います。" +
  "編集ページはあくまで編集中の作業単位の分割で、原稿そのものは1つの続いた文章として扱われます。プレビューやPDF・JPGの実際のページ割りには影響しません。";

/**
 * TSP-HOWTO-BETA-016 test req #11 — matches the shipped safe export filename
 * field (2baaed1 feat(pdf): add safe export filename field). No mention of
 * the old post-export filename notice.
 */
export const TITLE_AND_FILENAME_EXPLANATION =
  TITLE_HELP + " " + EXPORT_FILENAME_HELP;

export const PDF_FILENAME_EXPLANATION =
  "作品ごとの「保存ファイル名（保存名）」をPDF・JPG・ZIPなどの書き出し名に共通で使えます。半角英数字・_・-が使えます。" +
  "PDFの拡張子.pdfなどは自動で付きます。書き出し画面では今回だけの名前に変更することもできます。";

export const EDITOR_PAGE_TOOLTIP_EXPLANATION = EDITOR_PAGE_HELP;

/**
 * TSP-RC-AFFILIATE-FOOTER-001 — HOW TO's bottom "お買い物リンク" section.
 *
 * No affiliate URL, tag, or operator name is hard-coded anywhere in this
 * repo (searched before writing this). Each button is independently gated
 * on its own config being present; the whole section is hidden if neither
 * is. Amazon additionally requires a confirmed Associates operator name
 * (the wording Amazon's program terms require) before its button/disclosure
 * render at all -- a URL alone is not sufficient, since shipping the
 * required disclosure with a guessed/wrong operator name would be a real
 * compliance problem, not just a missing feature. Takes explicit params
 * (not `process.env` itself) so it's a pure function callers can unit-test
 * with synthetic config, per this task's own test requirement.
 */
export interface AffiliateFooterEnv {
  amazonUrl?: string;
  amazonAssociateOperatorName?: string;
  rakutenUrl?: string;
}

export interface AffiliateFooterConfig {
  showSection: boolean;
  amazon: { url: string; operatorName: string } | null;
  rakuten: { url: string } | null;
}

export function resolveAffiliateFooterConfig(
  env: AffiliateFooterEnv
): AffiliateFooterConfig {
  const amazonUrl = (env.amazonUrl ?? "").trim();
  const amazonOperatorName = (env.amazonAssociateOperatorName ?? "").trim();
  const rakutenUrl = (env.rakutenUrl ?? "").trim();

  const amazon =
    amazonUrl && amazonOperatorName ? { url: amazonUrl, operatorName: amazonOperatorName } : null;
  const rakuten = rakutenUrl ? { url: rakutenUrl } : null;

  return { showSection: Boolean(amazon || rakuten), amazon, rakuten };
}
