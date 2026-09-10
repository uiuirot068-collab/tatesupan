"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import type { PageSettings } from "@/lib/pageLayout";
import { composeV2Document, type V2BridgeResult } from "@/lib/v2Bridge/composeV2Document";
import { prepareImageResolver } from "@/lib/v2Bridge/imageResolverAdapter";
import { createFakeMeasurementProvider } from "../../typesetting-v2/core/measurement/fakeProvider";
import { mmToTicks } from "../../typesetting-v2/core/geometry/tick";
import {
  buildColophonPaintPages,
  buildPaintDocument,
  type PaintDocument,
  type PreviewRenderContext,
} from "../../typesetting-v2/renderer/preview/paintModel";
import { PREVIEW_RENDERER_STYLES, PreviewDocumentView } from "../../typesetting-v2/renderer/preview/PreviewRenderer";
import { buildPublicationPaintPlan, findUnresolvedImageIssues } from "../../typesetting-v2/renderer/publication/pdfGenerator";
import { exportPaintPlanToBrowserJpgPages, type JpgExportMode } from "../../typesetting-v2/renderer/publication/rasterGeneratorBrowser";
import { buildPageJpgFileName, buildZipFileName, sanitizeFilename } from "../../typesetting-v2/renderer/publication/jpgFilename";
import { ExportCancellationCoordinator, isExportCancelledError, waitForExportPermission } from "@/lib/exportCancellation";
import { downloadBytes, loadV2PublicationFont, startV2PdfWorker, type WorkerPdfHandle } from "@/lib/v2BrowserExport";
import { resolveJpgPageIndices } from "@/lib/jpgPageSelection";

export interface PreviewPaneNewProps {
  content: string;
  settings: PageSettings;
  title?: string;
  images: Record<string, string>;
  unresolvedImageIds: ReadonlySet<string>;
  blockExportForUnresolvedImages: boolean;
  onPdfExportSuccess?: () => void;
  selectedPageIndices: ReadonlySet<number>;
  onSelectedPageIndicesChange: (next: Set<number>) => void;
}

type ExportProgress = { label: string; current: number; total: number };

function buildPreview(bridge: V2BridgeResult, images: Record<string, string>): PaintDocument {
  const context: PreviewRenderContext = {
    scaleMultiplier: 0.72,
    linePitchTicks: bridge.layoutSettings.linePitchTicks,
    lineExtentTicks: bridge.layoutSettings.lineExtentTicks,
    columnExtentTicks: bridge.layoutSettings.columnExtentTicks,
    columnsPerPage: bridge.layoutSettings.columnsPerPage,
    nominalCellTicks: mmToTicks((bridge.layoutSettings.bodyFontSizePt * 25.4) / 72),
    measurementIdentity: bridge.document.version.measurementIdentity,
    paintFontIdentity: bridge.document.version.measurementIdentity,
    bodyFontSizeTick: mmToTicks((bridge.layoutSettings.bodyFontSizePt * 25.4) / 72),
    imageResolver: (id) => images[id] ? { kind: "RESOLVED", url: images[id] } : { kind: "PLACEHOLDER" },
  };
  const body = buildPaintDocument("editor-v2", "本の形で確認", bridge.document, bridge.units, bridge.source, context);
  if (!bridge.document.colophon || !bridge.colophonUnits || bridge.colophonSource === undefined) return body;

  const colophonPages = buildColophonPaintPages(
    bridge.document.colophon,
    bridge.colophonUnits,
    bridge.colophonSource,
    context
  );
  body.pages = bridge.document.pageSequence.map((page) =>
    page.kind === "body" ? body.pages[page.index] : colophonPages[page.index]
  );
  body.totalPageCount = body.pages.length;
  body.renderedPageCount = body.pages.length;
  return body;
}

export default function PreviewPaneNew({
  content,
  settings,
  title,
  images,
  unresolvedImageIds,
  blockExportForUnresolvedImages,
  onPdfExportSuccess,
  selectedPageIndices,
  onSelectedPageIndicesChange,
}: PreviewPaneNewProps) {
  const [bridge, setBridge] = useState<V2BridgeResult | null>(null);
  const [preview, setPreview] = useState<PaintDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [coordinator] = useState(() => new ExportCancellationCoordinator());
  const pdfHandleRef = useRef<WorkerPdfHandle | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void prepareImageResolver(images)
        .then((imageResolver) => composeV2Document({
          title: title?.trim() || "TateSpun",
          content,
          settings,
          measurement: createFakeMeasurementProvider(),
          imageResolver,
        }))
        .then((nextBridge) => {
          if (cancelled) return;
          setBridge(nextBridge);
          setPreview(buildPreview(nextBridge, images));
          setError(null);
        })
        .catch((cause: unknown) => {
          if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [content, images, settings, title]);

  const safeTitle = useMemo(() => sanitizeFilename(title?.trim() || "TateSpun"), [title]);
  const bridgeImageIssues = useMemo(
    () => bridge ? findUnresolvedImageIssues(bridge.model) : [],
    [bridge]
  );
  const imageHoldActive = blockExportForUnresolvedImages || unresolvedImageIds.size > 0 || bridgeImageIssues.length > 0;

  const beginExport = useCallback((label: string, total: number) => {
    const signal = coordinator.begin();
    setProgress({ label, current: 0, total: Math.max(total, 1) });
    return signal;
  }, [coordinator]);

  const finishExport = useCallback((signal: AbortSignal) => {
    coordinator.finish(signal);
    pdfHandleRef.current = null;
    setProgress(null);
    setConfirmOpen(false);
  }, [coordinator]);

  useEffect(() => {
    if (!progress) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (coordinator.handleEscape() === "open-confirmation") {
        pdfHandleRef.current?.pause();
        setConfirmOpen(true);
      } else {
        pdfHandleRef.current?.resume();
        setConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [coordinator, progress]);

  const requirePlan = useCallback(async () => {
    if (!bridge) throw new Error("Canonical Preview の準備が完了していません。");
    if (imageHoldActive) {
      throw new Error("未解決の画像があります。画像を再設定してから書き出してください。");
    }
    const font = await loadV2PublicationFont();
    return { font, plan: buildPublicationPaintPlan(bridge.model, font, bridge.pageGeometry, "v2 Beta export") };
  }, [bridge, imageHoldActive]);

  const exportPdf = useCallback(async () => {
    let signal: AbortSignal | null = null;
    try {
      const { font, plan } = await requirePlan();
      signal = beginExport("PDF", plan.length);
      const handle = startV2PdfWorker(plan, font, ({ current, total }) => setProgress({ label: "PDF", current, total }));
      pdfHandleRef.current = handle;
      const abort = () => handle.cancel();
      signal.addEventListener("abort", abort, { once: true });
      const bytes = await handle.result;
      signal.removeEventListener("abort", abort);
      await waitForExportPermission(signal);
      downloadBytes(bytes, `${safeTitle}.pdf`, "application/pdf");
      onPdfExportSuccess?.();
    } catch (cause: unknown) {
      if (!isExportCancelledError(cause)) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (signal) finishExport(signal);
    }
  }, [beginExport, finishExport, onPdfExportSuccess, requirePlan, safeTitle]);

  const exportJpg = useCallback(async (mode: JpgExportMode, scope: "first" | "zip") => {
    let signal: AbortSignal | null = null;
    try {
      const { plan } = await requirePlan();
      const pageIndices = scope === "first"
        ? [0]
        : resolveJpgPageIndices(plan.length, selectedPageIndices);
      const exportPlan = pageIndices.map((index) => plan[index]);
      const label = mode === "PRINT" ? "印刷用JPG" : "Web用JPG";
      signal = beginExport(label, exportPlan.length);
      const pages = await exportPaintPlanToBrowserJpgPages(
        exportPlan,
        "Shippori Mincho",
        (pageNumber) => buildPageJpgFileName(safeTitle, pageIndices[pageNumber - 1] + 1),
        mode,
        undefined,
        {
          beforePage: async () => waitForExportPermission(signal ?? undefined),
          onProgress: (current, total) => setProgress({ label, current, total }),
        }
      );
      await waitForExportPermission(signal);
      if (scope === "first") {
        saveAs(pages[0].blob, pages[0].fileName);
      } else {
        const zip = new JSZip();
        for (let index = 0; index < pages.length; index += 1) {
          await waitForExportPermission(signal);
          zip.file(pages[index].fileName, pages[index].blob);
          setProgress({ label: `${label} ZIP`, current: index + 1, total: pages.length });
        }
        await waitForExportPermission(signal);
        const blob = await zip.generateAsync({ type: "blob" });
        await waitForExportPermission(signal);
        saveAs(blob, buildZipFileName(safeTitle));
      }
    } catch (cause: unknown) {
      if (!isExportCancelledError(cause)) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (signal) finishExport(signal);
    }
  }, [beginExport, finishExport, requirePlan, safeTitle, selectedPageIndices]);

  const continueExport = () => {
    coordinator.continueExport();
    pdfHandleRef.current?.resume();
    setConfirmOpen(false);
  };
  const cancelExport = () => {
    coordinator.cancelExport();
    pdfHandleRef.current?.cancel();
    setConfirmOpen(false);
  };
  const togglePageSelection = (index: number) => {
    const next = new Set(selectedPageIndices);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    onSelectedPageIndicesChange(next);
  };

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-ink/[0.04]">
      <style>{`${PREVIEW_RENDERER_STYLES}
        .tsp-v2-preview .fixture{border:0;margin:0}.tsp-v2-preview .fixture>h2{display:none}
        .tsp-v2-preview .page-row{display:flex;align-items:flex-start;flex-wrap:wrap;gap:20px}
        .tsp-v2-preview .page-selection-item{position:relative;padding:28px 5px 5px;border:2px solid transparent;border-radius:8px}
        .tsp-v2-preview .page-selection-item.selected{border-color:var(--accent)}
        .tsp-v2-preview .page-selection-control{position:absolute;top:4px;left:6px;display:flex;align-items:center;gap:4px;font:12px sans-serif;color:var(--ink);cursor:pointer}
        .tsp-v2-preview .page{flex:none;box-shadow:0 3px 14px rgba(28,24,20,.18);font-family:"Shippori Mincho",serif}
        .tsp-v2-preview .image-placeholder{display:block;width:100%;height:100%;object-fit:contain}
      `}</style>
      <div className="flex flex-wrap items-center gap-2 border-b border-ink/10 bg-base px-3 py-2">
        <span className="mr-auto text-xs font-semibold text-ink/70">本の形で確認</span>
        {selectedPageIndices.size > 0 && (
          <button type="button" onClick={() => onSelectedPageIndicesChange(new Set())} className="rounded px-2 py-1 text-[11px] text-ink/55 hover:bg-ink/5">選択解除</button>
        )}
        <button type="button" disabled={!bridge || !!progress || imageHoldActive} onClick={() => void exportPdf()} className="rounded bg-ink px-3 py-1.5 text-xs text-white disabled:opacity-40">PDF</button>
        <button type="button" disabled={!bridge || !!progress || imageHoldActive} onClick={() => void exportJpg("WEB", "first")} className="rounded border border-ink/20 px-3 py-1.5 text-xs disabled:opacity-40">Web JPG 1ページ</button>
        <button type="button" disabled={!bridge || !!progress || imageHoldActive} onClick={() => void exportJpg("WEB", "zip")} className="rounded border border-ink/20 px-3 py-1.5 text-xs disabled:opacity-40">Web JPG ZIP</button>
        <button type="button" disabled={!bridge || !!progress || imageHoldActive} onClick={() => void exportJpg("PRINT", "zip")} className="rounded border border-ink/20 px-3 py-1.5 text-xs disabled:opacity-40">印刷用JPG ZIP</button>
      </div>
      <p className="border-b border-ink/10 bg-base px-3 py-1.5 text-[11px] text-ink/55">v2 Beta の PDF/JPG は仕上がりサイズ（裁ち落としなし）です。原稿と画像はブラウザ内で処理されます。</p>
      {imageHoldActive && (
        <div role="alert" className="border-b border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">HOLD: 未解決の画像があります。画像は省略せず、再設定されるまで書き出しを停止します。</div>
      )}
      {error && <div role="alert" className="border-b border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</div>}
      <div className="tsp-v2-preview min-h-0 flex-1 overflow-auto p-5">
        {preview ? <PreviewDocumentView model={preview} mode="normal" selectedPageIndices={selectedPageIndices} onTogglePage={togglePageSelection} /> : <p className="text-sm text-ink/60">Canonical Preview を準備しています…</p>}
      </div>
      {progress && <div className="border-t border-ink/10 bg-base px-3 py-2 text-xs text-ink/70">{progress.label} 書き出し中 ({progress.current}/{progress.total}) — Escで中断確認</div>}
      {confirmOpen && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/35 p-4" role="presentation">
          <div role="dialog" aria-modal="true" aria-labelledby="v2-export-cancel-title" className="w-full max-w-sm rounded-xl bg-base p-5 shadow-2xl">
            <h2 id="v2-export-cancel-title" className="text-base font-bold">書き出しを中断しますか？</h2>
            <p className="mt-2 text-sm text-ink/65">確認中は次のページ処理を開始しません。未完成ファイルは保存されません。</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={continueExport} className="rounded border border-ink/20 px-4 py-2 text-sm">書き出しを続ける</button>
              <button type="button" onClick={cancelExport} className="rounded bg-red-700 px-4 py-2 text-sm text-white">中断する</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
