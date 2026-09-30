"use client";

import type { ReactNode } from "react";

interface InfoTooltipProps {
  text: string;
  label?: string;
  className?: string;
  children?: ReactNode;
}

export default function InfoTooltip({
  text,
  label = "説明を見る",
  className = "",
  children,
}: InfoTooltipProps) {
  return (
    <span className={`group relative inline-flex shrink-0 items-center ${className}`}>
      {children}
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[13px] leading-none text-ink/45 outline-none transition-colors hover:bg-ink/5 hover:text-ink/70 focus:bg-ink/5 focus:text-ink/70"
      >
        ⓘ
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-[80] mt-2 hidden w-max max-w-[280px] -translate-x-1/2 rounded-md border border-ink/15 bg-base px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-ink shadow-lg group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
