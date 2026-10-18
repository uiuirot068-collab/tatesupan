"use client";

import { useEffect, useState } from "react";
import {
  hasRescuableText,
  readEditorRescue,
  rescueFilename,
  rescueText,
  rescueTitle,
} from "@/lib/editorRescue";
import { createDocument, saveDocument } from "@/lib/db";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "@/lib/pageLayout";
import { withBasePath } from "@/lib/basePath";

/**
 * TSP-SAFE-003: shown instead of a white page when the editor crashes while
 * drawing. The text the screen last showed (lib/editorRescue.ts) can be taken
 * out as TXT, copied, or kept as a new work on the bookshelf before trying again.
 */
export default function EditorCrashScreen({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const [rescue] = useState(() => readEditorRescue());
  const [notice, setNotice] = useState<string | null>(null);
  const [keptAs, setKeptAs] = useState<string | null>(null);
  const rescuable = hasRescuableText(rescue) && !rescue.sample;

  useEffect(() => {
    console.error("TateSpun: the editor stopped with an error", error);
  }, [error]);

  const download = () => {
    if (!rescuable) return;
    const url = URL.createObjectURL(new Blob([rescueText(rescue)], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = rescueFilename(rescue.title);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    if (!rescuable) return;
    try {
      await navigator.clipboard.writeText(rescueText(rescue));
      setNotice("原稿をコピーしました。メモ帳などに貼りつけて残してください。");
    } catch {
      setNotice("コピーできませんでした。「TXTで保存」をお使いください。");
    }
  };

  const keepOnBookshelf = async () => {
    if (!rescuable || keptAs) return;
    try {
      const title = rescueTitle(rescue.title);
      const id = await createDocument();
      await saveDocument(id, title, rescue.content, (rescue.settings as PageSettings | undefined) ?? DEFAULT_PAGE_SETTINGS, rescue.plotNote);
      setKeptAs(title);
      setNotice(`本棚に「${title}」として残しました。`);
    } catch {
      setNotice("このブラウザの保存場所に残せませんでした。「TXTで保存」か「コピー」をお使いください。");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-5 px-5 py-12 text-ink" role="alert">
      <h1 className="border-b border-ink/30 pb-2 text-lg font-bold">画面にエラーが起きました</h1>
      {rescuable ? (
        <>
          <p className="text-sm leading-relaxed">
            ここまで書いた原稿は、ふだんはこの端末に自動で保存されています。念のため、もう一度開く前に控えを取ってください。
          </p>
          <p className="text-xs text-ink/70">
            {rescue.title.trim() || "無題"}・{rescue.content.length.toLocaleString()}字
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-3 border-y border-ink/15 py-3 text-sm">
            <button type="button" onClick={download} className="underline underline-offset-4 hover:text-ink/70">
              TXTで保存
            </button>
            <button type="button" onClick={() => void copy()} className="underline underline-offset-4 hover:text-ink/70">
              コピー
            </button>
            <button
              type="button"
              onClick={() => void keepOnBookshelf()}
              disabled={keptAs !== null}
              className="underline underline-offset-4 hover:text-ink/70 disabled:no-underline disabled:opacity-50"
            >
              本棚に控えを残す
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm leading-relaxed">もう一度開いてください。本棚の作品はこの端末に残っています。</p>
      )}
      {notice && <p className="text-sm">{notice}</p>}
      <div className="flex flex-wrap gap-x-5 gap-y-3 text-sm">
        <button type="button" onClick={() => retry()} className="font-bold underline underline-offset-4 hover:text-ink/70">
          もう一度開く
        </button>
        {/* A full page load: after a crash, start from a clean screen. */}
        <a href={withBasePath("/")} className="underline underline-offset-4 hover:text-ink/70">
          本棚へ
        </a>
      </div>
    </main>
  );
}
