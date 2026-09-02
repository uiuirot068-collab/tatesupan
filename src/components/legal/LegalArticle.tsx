import Link from "next/link";
import type { ReactNode } from "react";

/** TSP-LOOP-009: 静的な法務ページ（/privacy・/terms）共通の枠。
 *  ログイン不要・Member不要・モーダルではない通常ルート。 */
export function LegalArticle({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  // The TateSpun app shell locks html/body to `overflow:hidden` (globals.css)
  // for the editor. Legal pages are plain long documents, so this shell owns a
  // full-viewport-height scroll container of its own rather than relying on the
  // document scroll (which the shell suppresses).
  return (
    <div className="flex h-dvh flex-col overflow-x-hidden overflow-y-auto bg-[#f9f8f6] text-[#1f2a44] dark:bg-[#11151D] dark:text-[#D4DBE7]">
      <header className="border-b border-[rgba(31,42,68,0.14)] px-4 py-3 sm:px-8 dark:border-[#2A3240]">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-ink/70 hover:text-ink dark:text-[#939DAF] dark:hover:text-[#D4DBE7]"
        >
          <span aria-hidden="true">←</span>
          <span className="font-bold text-ink dark:text-[#D4DBE7]">TateSpun</span>
        </Link>
      </header>

      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <article
          className="
            text-[15px] leading-[1.9] text-ink/80 dark:text-[#B9C2D0]
            [&_h1]:mb-8 [&_h1]:font-serif [&_h1]:text-[26px] [&_h1]:font-medium [&_h1]:text-ink sm:[&_h1]:text-[30px] dark:[&_h1]:text-[#D4DBE7]
            [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-medium [&_h2]:text-ink dark:[&_h2]:text-[#D4DBE7]
            [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-ink dark:[&_h3]:text-[#D4DBE7]
            [&_p]:my-3
            [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-1
            [&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 dark:[&_a]:text-[#C6AF63]
          "
        >
          <h1>{title}</h1>
          {children}
        </article>

        <div className="mt-12 border-t border-[rgba(31,42,68,0.14)] pt-6 text-sm dark:border-[#2A3240]">
          <Link
            href="/"
            className="text-accent underline underline-offset-2 dark:text-[#C6AF63]"
          >
            TateSpun のトップへ戻る
          </Link>
        </div>
      </main>
    </div>
  );
}

/** 運営者・制定日ブロック（両ページ共通）。 */
export function LegalFooterBlock({ date }: { date: string }) {
  return (
    <p className="mt-10 text-sm text-ink/60 dark:text-[#939DAF]">
      運営者：caload
      <br />
      制定日：{date}
    </p>
  );
}

/** お問い合わせフォームへの外部リンク（canonical Google Form）。 */
export const INQUIRY_FORM_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLSfKtzQy7a6kufXDnhdkWkkeourqbSEJWxEHW7NQn4Wq1bQhhA/viewform?usp=dialog";
