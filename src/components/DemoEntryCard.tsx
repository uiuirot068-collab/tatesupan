"use client";

import Link from "next/link";

/**
 * TSP-LOOP-024 — bookshelf entry for「3分でわかる TateSpun おためしデモ」.
 * Secondary to「＋ 新しい作品を作成する」: quieter styling, sits beside it.
 * Opens the real editor in disposable demo mode (`/editor?demo=1`).
 */
export default function DemoEntryCard({ className = "" }: { className?: string }) {
  return (
    <div
      data-demo-entry=""
      className={`flex flex-col gap-1 rounded-2xl border border-ink/15 bg-base/60 px-4 py-3 text-left sm:max-w-xs ${className}`}
    >
      <p className="text-sm font-semibold text-ink">3分でわかる TateSpun おためしデモ</p>
      <p className="text-xs leading-relaxed text-ink/60">
        実際のエディターを触りながら、基本操作を順番に試せます。
      </p>
      <Link
        href="/editor?demo=1"
        data-demo-entry-cta=""
        className="mt-1.5 inline-flex w-fit items-center rounded-full border border-ink/25 px-3 py-1 text-xs font-medium text-ink/75 transition-colors hover:bg-ink/5"
      >
        デモを始める ▶
      </Link>
    </div>
  );
}
