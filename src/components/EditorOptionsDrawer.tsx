"use client";

import { useEffect } from "react";

interface EditorOptionsDrawerProps {
  onOpenVerticalColophon: () => void;
  onOpenHorizontalColophon: () => void;
  onOpenToc: () => void;
  onOpenChecklist: () => void;
  onImportSourceTxt: () => void;
  onExportSourceTxt: () => void;
  onExportReadableTxt: () => void;
  onOpenFeedback?: () => void;
  onClose: () => void;
}

export default function EditorOptionsDrawer({
  onOpenVerticalColophon,
  onOpenHorizontalColophon,
  onOpenToc,
  onOpenChecklist,
  onImportSourceTxt,
  onExportSourceTxt,
  onExportReadableTxt,
  onOpenFeedback,
  onClose,
}: EditorOptionsDrawerProps) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close, true);
    return () => document.removeEventListener("keydown", close, true);
  }, [onClose]);

  const open = (action: () => void) => {
    onClose();
    action();
  };
  const optionClass = "rounded-xl border border-ink/15 bg-base p-3";
  const buttonClass = "rounded border border-ink/20 px-3 py-2 text-left text-sm font-medium text-ink/75 hover:bg-ink/5";

  return (
    <div className="fixed inset-0 z-[75] bg-black/35" onMouseDown={onClose}>
      <aside aria-label="オプション" className="ml-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-base shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
          <div><p className="text-[10px] tracking-[0.16em] text-ink/45">EDITOR OPTIONS</p><h2 className="text-base font-bold">オプション</h2></div>
          <button type="button" onClick={onClose} aria-label="オプションを閉じる" className="rounded p-2 text-xl text-ink/55 hover:bg-ink/5">×</button>
        </header>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4">
          <section data-editor-option="vertical-colophon" className={optionClass}>
            <h3 className="text-sm font-semibold">奥付（縦）</h3>
            <p className="mt-1 text-xs text-ink/55">本文ページとして縦書きの奥付を作成します。</p>
            <button type="button" onClick={() => open(onOpenVerticalColophon)} className={`${buttonClass} mt-2 w-full`}>奥付（縦）を開く</button>
          </section>
          <section data-editor-option="horizontal-colophon" className={optionClass}>
            <h3 className="text-sm font-semibold">奥付（横）</h3>
            <p className="mt-1 text-xs text-ink/55">本文とは独立した横書き専用ページを設定します。</p>
            <button type="button" onClick={() => open(onOpenHorizontalColophon)} className={`${buttonClass} mt-2 w-full`}>奥付（横）を開く</button>
          </section>
          <section data-editor-option="toc" className={optionClass}>
            <h3 className="text-sm font-semibold">目次</h3>
            <p className="mt-1 text-xs text-ink/55">本文の見出しから目次を作成します。</p>
            <button type="button" onClick={() => open(onOpenToc)} className={`${buttonClass} mt-2 w-full`}>目次を開く</button>
          </section>
          <section data-editor-option="checklist" className={optionClass}>
            <h3 className="text-sm font-semibold">完成前チェック</h3>
            <p className="mt-1 text-xs text-ink/55">入稿前に自分の確認項目を見直します。</p>
            <button type="button" onClick={() => open(onOpenChecklist)} className={`${buttonClass} mt-2 w-full`}>完成前チェックを開く</button>
          </section>
          <section data-editor-option="txt-transfer" className={optionClass}>
            <h3 className="text-sm font-semibold">TXT出入力</h3>
            <div className="mt-2 grid gap-3">
              <div className="rounded-lg bg-ink/[0.035] p-3">
                <p className="text-xs font-semibold">A 原稿データ</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink/55">TateSpunの記法を残して保存・再読込できます。</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => open(onImportSourceTxt)} className={buttonClass}>読み込む</button>
                  <button type="button" onClick={() => open(onExportSourceTxt)} className={buttonClass}>書き出す</button>
                </div>
              </div>
              <div className="rounded-lg bg-ink/[0.035] p-3">
                <p className="text-xs font-semibold">B 整形本文</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink/55">記法や画像情報を除き、読みやすい本文だけを書き出します。</p>
                <button type="button" onClick={() => open(onExportReadableTxt)} className={`${buttonClass} mt-2`}>整形本文を書き出す</button>
              </div>
            </div>
          </section>
          {onOpenFeedback && (
            <button type="button" onClick={() => open(onOpenFeedback)} className={buttonClass}>β版フィードバックを送る</button>
          )}
        </div>
      </aside>
    </div>
  );
}
