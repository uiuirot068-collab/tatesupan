"use client";

/**
 * CST-PORT-011: 表紙の書き出し（COLUMNSTAND の書き出し画面の表紙部分を移植）。
 *
 *  - 表紙・裏表紙を別々に（背幅不要・おすすめ）
 *  - 表紙のみ
 *  - 背表紙込みの見開き（背幅が分かる人向け）
 * それぞれ JPG / PDF。Web閲覧用の用紙では本文と同じく PDF は使えない。
 */
import { useState } from "react";
import ViewportModal from "@/components/ViewportModal";
import ExportSupportLine from "@/components/ExportSupportLine";
import { isExportSupportLineDismissed, rememberExportSupportLineDismissed } from "@/lib/exportSupportLineSession";
import { PDF_UNAVAILABLE_NOTE } from "@/components/exportMenuEntries";
import { createDefaultCoverSettings, type CoverSettings } from "@/lib/cover/coverModel";
import { getCoverFaceGeometry } from "@/lib/cover/coverGeometry";
import {
  COVER_EXPORT_CONTENT_OPTIONS,
  coverExportAvailability,
  coverExportFileNames,
  coverSpineIssues,
  type CoverExportContent,
  type CoverExportFormat,
} from "@/lib/cover/coverExport";

export interface CoverExportDialogProps {
  cover: CoverSettings | undefined;
  paperSize: string;
  /** 書き出しファイル名（拡張子なし・安全化済み） */
  stem: string;
  imageDataUrls: Record<string, string>;
  onOpenCover: () => void;
  onClose: () => void;
}

export default function CoverExportDialog({ cover, paperSize, stem, imageDataUrls, onOpenCover, onClose }: CoverExportDialogProps) {
  const settings = cover ?? createDefaultCoverSettings();
  const pdfUnavailable = getCoverFaceGeometry(paperSize).isPx;
  const [content, setContent] = useState<CoverExportContent>("cover-separate");
  const [chosenFormat, setFormat] = useState<CoverExportFormat>("jpg");
  const format: CoverExportFormat = pdfUnavailable ? "jpg" : chosenFormat;
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  // SPN-SUPPORT-003: the same quiet after-export line as the Preview pane.
  const [isSupportLineVisible, setIsSupportLineVisible] = useState(false);

  const availability = coverExportAvailability(content, settings);
  const fileNames = coverExportFileNames(content, settings, stem, format);
  const spineIssues = content === "cover-spread" && availability.ok ? coverSpineIssues(settings, paperSize) : [];

  const handleExport = async () => {
    if (!availability.ok || busy) return;
    setBusy(true);
    setError("");
    try {
      // 書き出しの部品は押したときに読み込む（エディターを開く速さに影響させない）
      const { exportCoverFiles } = await import("@/lib/cover/coverExportRun");
      await exportCoverFiles({
        cover: settings,
        paperSize,
        content,
        format,
        stem,
        imageDataUrls,
        onProgress: setProgress,
      });
      setProgress("書き出し完了");
      if (!isExportSupportLineDismissed()) setIsSupportLineVisible(true);
    } catch (caught) {
      console.error(caught);
      setError(caught instanceof Error ? caught.message : "書き出し中にエラーが発生しました。");
      setProgress("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ViewportModal
      title="表紙の書き出し"
      titleId="cover-export-title"
      closeLabel="表紙の書き出しを閉じる"
      onClose={busy ? () => {} : onClose}
      panelClassName="max-w-md"
      overlayProps={{ "data-cover-export": "" } as React.HTMLAttributes<HTMLDivElement>}
      footer={
        <>
          <button
            type="button"
            onClick={onOpenCover}
            disabled={busy}
            className="mr-auto rounded px-2 py-1.5 text-sm text-ink/70 underline-offset-2 hover:underline disabled:opacity-40"
          >
            表紙を編集する
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border border-ink/25 px-3 py-1.5 text-sm text-ink hover:bg-ink/5 disabled:opacity-40"
          >
            閉じる
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={!availability.ok || busy}
            className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-base hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "書き出し中…" : "書き出す"}
          </button>
        </>
      }
    >
      <fieldset className="grid gap-2" disabled={busy}>
        <legend className="mb-1 text-xs font-semibold text-ink/70">書き出す内容</legend>
        {COVER_EXPORT_CONTENT_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`flex cursor-pointer gap-2 border-l-[3px] py-1 pl-2 ${content === option.id ? "border-accent" : "border-transparent"}`}
          >
            <input
              type="radio"
              name="cover-export-content"
              checked={content === option.id}
              onChange={() => {
                setContent(option.id);
                setError("");
                setProgress("");
              }}
              className="mt-1"
            />
            <span className="grid gap-0.5">
              <strong className="text-sm font-semibold text-ink">{option.label}</strong>
              <small className="text-[11px] leading-snug text-ink/55">{option.hint}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <fieldset className="mt-3 flex flex-wrap items-center gap-4 border-t border-ink/10 pt-3" disabled={busy}>
        <legend className="sr-only">形式</legend>
        <span className="text-xs font-semibold text-ink/70">形式</span>
        {(["jpg", "pdf"] as const).map((value) => (
          <label key={value} className={`flex items-center gap-1.5 text-sm ${value === "pdf" && pdfUnavailable ? "opacity-40" : ""}`}>
            <input
              type="radio"
              name="cover-export-format"
              checked={format === value}
              disabled={value === "pdf" && pdfUnavailable}
              onChange={() => setFormat(value)}
            />
            {value.toUpperCase()}
          </label>
        ))}
      </fieldset>
      {pdfUnavailable ? <p className="mt-1 text-[11px] leading-snug text-ink/55">{PDF_UNAVAILABLE_NOTE}</p> : null}

      <div className="mt-3 border-t border-ink/10 pt-3 text-xs">
        {availability.ok ? (
          <>
            <p className="text-ink/60">書き出すファイル{fileNames.length > 1 ? "（ZIPにまとめます）" : ""}</p>
            <ul className="mt-1 grid gap-0.5 font-mono text-[11px] text-ink">
              {fileNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-ink/50">
              350dpi・RGB。プレビューと同じ描き方で書き出します（点線のガイドは入りません）。
            </p>
          </>
        ) : (
          <p role="status" className="border-l-[3px] border-amber-500 pl-2 leading-snug text-amber-800 dark:text-amber-300">
            {availability.reason}
          </p>
        )}
        {spineIssues.length > 0 ? (
          <ul className="mt-2 list-disc border-l-[3px] border-amber-500 py-1 pl-6 text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
            {spineIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : null}
      </div>

      {progress ? (
        <p role="status" className="mt-3 text-xs text-ink/70">
          {progress}
        </p>
      ) : null}
      {isSupportLineVisible && !busy ? (
        <div className="mt-3">
          <ExportSupportLine
            onClose={() => {
              setIsSupportLineVisible(false);
              rememberExportSupportLineDismissed();
            }}
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </ViewportModal>
  );
}
