"use client";

import { useEffect } from "react";

interface EditorOptionsDrawerProps {
  onOpenVerticalColophon: () => void;
  onOpenHorizontalColophon: () => void;
  onOpenToc: () => void;
  onOpenChecklist: () => void;
  onImportSourceTxt: () => void;
  onImportDocx: () => void;
  onExportSourceTxt: () => void;
  onExportReadableTxt: () => void;
  onClose: () => void;
}

export default function EditorOptionsDrawer({
  onOpenVerticalColophon,
  onOpenHorizontalColophon,
  onOpenToc,
  onOpenChecklist,
  onImportSourceTxt,
  onImportDocx,
  onExportSourceTxt,
  onExportReadableTxt,
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
  const flatOptionClass = "border-b border-ink/10 pb-3";
  const groupedOptionClass = "rounded-xl border border-ink/15 bg-base p-3";
  const buttonClass = "rounded border border-ink/20 px-3 py-2 text-left text-sm font-medium text-ink/75 hover:bg-ink/5";

  return (
    <div className="fixed inset-0 z-[75] bg-black/35" onMouseDown={onClose}>
      <aside aria-label="オプション" className="ml-auto flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-base shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
          <div><p className="text-[10px] tracking-[0.16em] text-ink/45">EDITOR OPTIONS</p><h2 className="text-base font-bold">オプション</h2></div>
          <button type="button" onClick={onClose} aria-label="オプションを閉じる" className="rounded p-2 text-xl text-ink/55 hover:bg-ink/5">×</button>
        </header>
        <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-4">
          <section data-editor-option="vertical-colophon" className={flatOptionClass}>
            <h3 className="text-sm font-semibold text-accent">奥付（縦）</h3>
            <p className="mt-1 text-xs text-ink/55">本文ページとして縦書きの奥付を作成します。</p>
            <button type="button" onClick={() => open(onOpenVerticalColophon)} className={`${buttonClass} mt-2 w-full`}>奥付（縦）を開く</button>
          </section>
          <section data-editor-option="horizontal-colophon" className={flatOptionClass}>
            <h3 className="text-sm font-semibold text-accent">奥付（横）</h3>
            <p className="mt-1 text-xs text-ink/55">本文とは独立した横書き専用ページを設定します。</p>
            <button type="button" onClick={() => open(onOpenHorizontalColophon)} className={`${buttonClass} mt-2 w-full`}>奥付（横）を開く</button>
          </section>
          <section data-editor-option="toc" className={flatOptionClass}>
            <h3 className="text-sm font-semibold text-accent">目次</h3>
            <p className="mt-1 text-xs text-ink/55">本文の見出しから目次を作成します。</p>
            <button type="button" onClick={() => open(onOpenToc)} className={`${buttonClass} mt-2 w-full`}>目次を開く</button>
          </section>
          <section data-editor-option="checklist" className={flatOptionClass}>
            <h3 className="text-sm font-semibold text-accent">完成前チェック</h3>
            <p className="mt-1 text-xs text-ink/55">入稿前に自分の確認項目を見直します。</p>
            <button type="button" onClick={() => open(onOpenChecklist)} className={`${buttonClass} mt-2 w-full`}>完成前チェックを開く</button>
          </section>
          <section data-editor-option="txt-transfer" className={groupedOptionClass}>
            <h3 className="text-sm font-semibold">原稿データ入出力</h3>
            <div className="mt-2 grid gap-3">
              <div className="rounded-lg bg-ink/[0.035] p-3">
                <p className="text-xs font-semibold">A 原稿データ（TXT）</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink/55">TateSpunの記法を残して保存・再読込できます。</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" onClick={() => open(onImportSourceTxt)} className={buttonClass}>TXTを読み込む</button>
                  <button type="button" onClick={() => open(onExportSourceTxt)} className={buttonClass}>TXTを書き出す</button>
                </div>
              </div>
              <div className="rounded-lg bg-ink/[0.035] p-3">
                <p className="text-xs font-semibold">B 整形本文（TXT）</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink/55">記法や画像情報を除き、読みやすい本文だけを書き出します。</p>
                <button type="button" onClick={() => open(onExportReadableTxt)} className={`${buttonClass} mt-2`}>整形本文を書き出す</button>
              </div>
              <div className="rounded-lg border border-amber-300/60 bg-amber-50/60 p-3">
                <p className="text-xs font-semibold">C Word（.docx）から読み込む β</p>
                <p className="mt-1 text-[11px] leading-relaxed text-ink/65">
                  横書き・通常の縦書きWordから本文・段落・改行を取り込みます。WordのルビはTateSpunのルビ記法へ、手動改ページは「【改ページ】」へ変換します。Word側の縦書き設定そのものは引き継ぎません。
                </p>
                <div className="mt-2 rounded-md bg-base/80 p-2 text-[11px] leading-relaxed text-ink/60">
                  <p className="font-semibold text-ink/70">読み込み時の注意</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    <li>画像、フォント・文字サイズ・太字/斜体/色、ページ設定、ヘッダー/フッターは取り込みません。</li>
                    <li>脚注・コメント・テキストボックス（縦書きテキストボックスを含む）は取り込みません。表はセル構造を保たず文字だけを順番に取り込みます。</li>
                    <li>現在の原稿本文を置き換えます。元のDOCXファイル自体は変更しません。</li>
                    <li>読み込み処理はこのブラウザ内で行います。</li>
                  </ul>
                </div>
                <button type="button" onClick={() => open(onImportDocx)} className={`${buttonClass} mt-2 w-full`}>DOCXを読み込む（β）</button>
              </div>
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
