"use client";

import { useState } from "react";
import {
  formatSessionActivityShareText,
  type SessionActivity,
} from "@/lib/editorSessionActivity";

export default function SessionActivityCounter({ activity }: { activity: SessionActivity }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const text = formatSessionActivityShareText(activity);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <span className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title="入力と削除を合計した、現在のブラウザタブの編集量"
        className="whitespace-nowrap rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-ink hover:bg-accent/25"
      >
        このセッションの編集量 {activity.totalActivity}文字
      </button>

      {open && (
        <span className="absolute bottom-full right-0 z-30 mb-2 block w-64 rounded-lg border border-ink/15 bg-base p-3 text-left shadow-lg">
          <span className="block text-xs font-semibold text-ink">このセッションの編集量</span>
          <span className="mt-1 block text-xl font-bold tabular-nums text-ink">
            {activity.totalActivity}文字
          </span>
          <span className="mt-1 block text-[11px] text-ink/60">
            入力 {activity.insertedCodePoints}文字 ＋ 削除 {activity.deletedCodePoints}文字
          </span>
          <span className="mt-2 block text-[10px] leading-relaxed text-ink/45">
            原稿の現在文字数とは別の値です。このタブを閉じるまで、作品を切り替えても引き継がれます。
          </span>
          <span className="mt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-2 py-1 text-[11px] text-ink/55 hover:bg-ink/5"
            >
              閉じる
            </button>
            <button
              type="button"
              onClick={share}
              className="rounded-full bg-ink px-3 py-1 text-[11px] font-semibold text-base hover:opacity-90"
            >
              {copied ? "コピーしました" : "結果をシェア"}
            </button>
          </span>
        </span>
      )}
    </span>
  );
}
