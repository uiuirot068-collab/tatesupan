"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";

interface HelpModalProps {
  onClose: () => void;
}

export default function HelpModal({ onClose }: HelpModalProps) {
  const [markdown, setMarkdown] = useState("");
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/docs/help.md`)
      .then((res) => {
        if (!res.ok) throw new Error("failed to load help.md");
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setMarkdown(text);
        setStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">使い方ガイド</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded p-1 text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1 text-sm text-ink">
          {status === "loading" && <p className="text-ink/60">読み込み中…</p>}
          {status === "error" && (
            <p className="text-ink/60">ガイドの読み込みに失敗しました。</p>
          )}
          {status === "loaded" && (
            <div
              className="space-y-3 text-ink
                [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-ink
                [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-ink/15 [&_h2]:pb-1
                  [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-ink
                [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink/80
                [&_p]:leading-relaxed
                [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5
                [&_li]:leading-relaxed
                [&_strong]:font-semibold
                [&_code]:rounded [&_code]:bg-ink/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
                [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-ink/10 [&_pre]:p-2 [&_pre]:text-xs"
            >
              <ReactMarkdown>{markdown}</ReactMarkdown>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
