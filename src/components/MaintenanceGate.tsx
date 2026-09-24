"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const X_ACCOUNT_URL = "https://x.com/caroad_info";

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
}

export function isMaintenancePath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  return (
    normalized === "/" ||
    normalized === "/editor" ||
    normalized === "/tatespun" ||
    normalized === "/tatespun/editor"
  );
}

function MaintenancePage() {
  return (
    <main
      data-tatespun-maintenance=""
      className="flex min-h-dvh w-full items-center justify-center bg-[#f7f4ed] px-5 py-10 text-[#2a3142] dark:bg-[#11151D] dark:text-[#D4DBE7]"
    >
      <section
        className="w-full max-w-[760px] text-center"
        aria-labelledby="tatespun-maintenance-title"
      >
        <p className="text-xs font-semibold tracking-[0.28em] text-[#9f8a43] dark:text-[#C6AF63]">
          TateSpun
        </p>

        <p
          aria-hidden="true"
          className="mt-5 font-serif text-[clamp(44px,10vw,92px)] font-medium leading-none tracking-[0.08em] text-[#25314b] dark:text-[#D4DBE7]"
        >
          MAINTENANCE
        </p>

        <h1
          id="tatespun-maintenance-title"
          className="mt-7 font-serif text-[clamp(24px,4vw,36px)] font-medium leading-relaxed text-[#25314b] dark:text-[#D4DBE7]"
        >
          ただいまメンテナンス中です。
        </h1>

        <div className="mx-auto mt-5 max-w-[620px] space-y-2 text-sm leading-8 text-[#566078] sm:text-base dark:text-[#AEB7C6]">
          <p>終了次第、ページが開けるようになります。</p>
          <p>Xにて告知予定なので、フォローしてお待ちください。</p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={X_ACCOUNT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#25314b] px-6 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfa858] dark:bg-[#C6AF63] dark:text-[#11151D]"
          >
            Xでお知らせを見る
          </a>
          <a
            href="https://spuntales.net/"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#25314b]/20 px-6 py-2.5 text-sm font-semibold text-[#25314b] transition-colors hover:bg-[#25314b]/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#bfa858] dark:border-[#3A4658] dark:text-[#D4DBE7] dark:hover:bg-[#1D2430]"
          >
            SpunTalesへ戻る
          </a>
        </div>

        <p className="mt-8 text-xs leading-relaxed text-[#7a8397] dark:text-[#7F8A9C]">
          ご不便をおかけします。安全確認が完了するまで、しばらくお待ちください。
        </p>
      </section>
    </main>
  );
}

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (isMaintenancePath(pathname)) {
    return <MaintenancePage />;
  }

  return <>{children}</>;
}
