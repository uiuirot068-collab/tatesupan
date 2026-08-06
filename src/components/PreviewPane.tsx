import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from "react";
import {
  computePageParagraphStarts,
  computePageSourceRanges,
  detokenizeTategaki,
  findPageIndexForCharIndex,
  paginateTokens,
  tokenizeTategaki,
  type ImagePosition,
  type TategakiToken,
} from "@/lib/tategaki";
import { computeSpreadGroups, moveSelected, rangeIndices, reorderByDrag } from "@/lib/pageOrder";
import { fitImageToMm, readFileAsDataUrl } from "@/lib/image";
import { convertPsdToPngDataUrl } from "@/utils/psdConverter";
import { exportAllPagesToZip, exportPageToJpg } from "@/utils/exportImage";
import { exportCustomPdf, type PdfExportMode } from "@/utils/exportPdf";
import type { ImageRecord } from "@/lib/db";
import { PX_PER_MM, type PageLayout, type PageSettings } from "@/lib/pageLayout";
import { useShortcuts } from "@/hooks/useShortcuts";
import ExportProgressModal from "./ExportProgressModal";
import PageCard from "./PageCard";

/** Visual seam width (px) between the two pages of a spread. */
const SPREAD_GAP_PX = 4;

/** Horizontal padding (px) of the scroll container (`p-6` = 1.5rem × 2 sides). */
const SCROLL_CONTAINER_PADDING_X_PX = 48;

interface PreviewPaneProps {
  content: string;
  settings: PageSettings;
  layout: PageLayout;
  images: Record<string, string>;
  onContentChange?: (content: string) => void;
  onSettingsChange?: (settings: PageSettings) => void;
  onImageAdd?: (record: ImageRecord) => void;
  onImageDelete?: (imageId: string) => void;
  /** Character index of the editor caret into `content`; when it changes, the matching page scrolls into view. */
  cursorIndex?: number | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function PreviewPane({
  content,
  settings,
  layout,
  images,
  onContentChange,
  onSettingsChange,
  onImageAdd,
  onImageDelete,
  cursorIndex,
  isCollapsed = false,
  onToggleCollapse,
}: PreviewPaneProps) {
  // Deferring the (expensive, O(content length)) pagination recompute keeps
  // keystrokes in the editor responsive on large manuscripts: React renders
  // this at low priority and lets input updates interrupt it, instead of
  // recomputing every page's layout synchronously on every keystroke.
  const deferredContent = useDeferredValue(content);

  const pages = useMemo(() => {
    const tokens = tokenizeTategaki(deferredContent);
    return paginateTokens(tokens, {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
    });
  }, [deferredContent, layout.charsPerLine, layout.linesPerPage]);

  const pageSourceRanges = useMemo(
    () =>
      computePageSourceRanges(deferredContent, {
        charsPerLine: layout.charsPerLine,
        linesPerPage: layout.linesPerPage,
      }),
    [deferredContent, layout.charsPerLine, layout.linesPerPage]
  );

  // 会話文（「」などで始まる段落）以外の地文だけを字下げ対象にするため、
  // ページをまたいで中断された段落の先頭には適用しないよう事前に判定する。
  const paragraphStarts = useMemo(() => computePageParagraphStarts(pages), [pages]);

  // 面付け: page 1 stands alone (奇数ページ始まり), then pages pair up as
  // (2,3), (4,5), ... into 見開き spreads.
  const spreadGroups = useMemo(() => computeSpreadGroups(pages.length), [pages.length]);
  const spreadWidthPx = layout.paper.widthMm * 2 * PX_PER_MM + SPREAD_GAP_PX;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [insertingImageIndex, setInsertingImageIndex] = useState<number | null>(null);
  const lastClickedRef = useRef<number | null>(null);

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.1;
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  const clampZoom = (value: number) =>
    Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value * 10) / 10));

  const zoomOut = () => setZoomScale((prev) => clampZoom(prev - ZOOM_STEP));
  const zoomIn = () => setZoomScale((prev) => clampZoom(prev + ZOOM_STEP));
  const zoomReset = () => setZoomScale(1.0);

  useShortcuts([
    { key: "+", handler: zoomIn },
    { key: "-", handler: zoomOut },
    { key: "0", handler: zoomReset },
  ]);

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const scrollPosRef = useRef({ left: 0, top: 0 });

  // Auto-fit: on narrow (mobile) viewports the spread's natural pixel width
  // can exceed the scroll container, which used to just clip the overflow
  // (overflow-x-hidden) and hide part of the manuscript. Track the
  // container's measured width so the spread can be scaled down to fit
  // instead, independent of the user's manual zoomScale above.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const update = () => setContainerWidth(container.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const autoFitScale = useMemo(() => {
    if (!containerWidth || spreadWidthPx <= 0) return 1;
    const availableWidth = containerWidth - SCROLL_CONTAINER_PADDING_X_PX;
    if (availableWidth <= 0) return 1;
    return Math.min(1, availableWidth / spreadWidthPx);
  }, [containerWidth, spreadWidthPx]);

  // Cursor-follow: scrolls the preview to the page containing the editor
  // caret. isAutoScrollingRef guards against the programmatic scroll being
  // mistaken for a manual one by any future manual-scroll-driven logic.
  const pageElementsRef = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const isAutoScrollingRef = useRef(false);
  const autoScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerPageElement = (index: number) => (el: HTMLDivElement | null) => {
    pageElementsRef.current.set(index, el);
  };

  const activePageIndex = useMemo(
    () => (cursorIndex == null ? null : findPageIndexForCharIndex(pageSourceRanges, cursorIndex)),
    [cursorIndex, pageSourceRanges]
  );

  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(
    null
  );
  const [exportLabel, setExportLabel] = useState("");

  const handleExportJpg = async () => {
    const index =
      selected.size > 0 ? Math.min(...selected) : activePageIndex ?? 0;
    const el = pageElementsRef.current.get(index);
    if (!el) return;
    setIsExporting(true);
    setExportLabel("画像");
    try {
      await exportPageToJpg(el, "tatespun_page.jpg");
    } catch (err) {
      alert(err instanceof Error ? err.message : "JPG書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportZip = async () => {
    const elements = pages
      .map((_, i) => pageElementsRef.current.get(i))
      .filter((el): el is HTMLDivElement => el != null);
    if (elements.length === 0) return;
    setIsExporting(true);
    setExportLabel("画像");
    setExportProgress({ current: 0, total: elements.length });
    try {
      await exportAllPagesToZip(elements, "tatespun_all_pages.zip", (current, total) => {
        setExportProgress({ current, total });
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "ZIP書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfMode, setPdfMode] = useState<PdfExportMode>("trim");

  const handleOpenPdfModal = () => setIsPdfModalOpen(true);

  const handleDownloadPdf = async () => {
    const elements = pages
      .map((_, i) => pageElementsRef.current.get(i))
      .filter((el): el is HTMLDivElement => el != null);
    if (elements.length === 0) return;
    setIsExporting(true);
    setExportLabel("PDF");
    setExportProgress({ current: 0, total: elements.length });
    try {
      await exportCustomPdf(elements, {
        mode: pdfMode,
        paperSizeName: layout.paper.label,
        bleed: 3,
        onProgress: (current, total) => setExportProgress({ current, total }),
      });
      setIsPdfModalOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "PDF書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  useEffect(() => {
    if (activePageIndex == null) return;
    const el = pageElementsRef.current.get(activePageIndex);
    if (!el) return;

    isAutoScrollingRef.current = true;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });

    if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    autoScrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 600);

    return () => {
      if (autoScrollTimeoutRef.current) clearTimeout(autoScrollTimeoutRef.current);
    };
  }, [activePageIndex]);

  const handlePreviewScroll = () => {
    // While an automatic cursor-follow scroll is in flight, ignore scroll
    // events so they can't be misread as a manual scroll and trigger a
    // feedback loop.
    if (isAutoScrollingRef.current) return;
  };

  const handlePanMouseDown = (event: MouseEvent) => {
    if (event.button !== 0 && event.button !== 1) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    isPanningRef.current = true;
    startPosRef.current = { x: event.clientX, y: event.clientY };
    scrollPosRef.current = { left: container.scrollLeft, top: container.scrollTop };
    container.style.cursor = "grabbing";
    document.body.style.userSelect = "none";
  };

  const handlePanMouseMove = (event: MouseEvent) => {
    if (!isPanningRef.current) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const dx = event.clientX - startPosRef.current.x;
    const dy = event.clientY - startPosRef.current.y;
    container.scrollLeft = scrollPosRef.current.left - dx;
    container.scrollTop = scrollPosRef.current.top - dy;
  };

  const stopPanning = () => {
    if (!isPanningRef.current) return;
    isPanningRef.current = false;
    const container = scrollContainerRef.current;
    if (container) container.style.cursor = "grab";
    document.body.style.userSelect = "";
  };

  const canReorder = Boolean(onContentChange);

  const applyReorder = (nextPages: TategakiToken[][], nextSelected: Set<number>) => {
    if (!onContentChange) return;
    onContentChange(nextPages.map((tokens) => detokenizeTategaki(tokens)).join(""));
    setSelected(nextSelected);
  };

  const handleToggleSelect = (index: number) => (event: MouseEvent) => {
    const next = new Set(selected);
    if (event.shiftKey && lastClickedRef.current !== null) {
      for (const i of rangeIndices(lastClickedRef.current, index)) next.add(i);
    } else if (event.ctrlKey || event.metaKey) {
      if (next.has(index)) next.delete(index);
      else next.add(index);
    } else if (next.size === 1 && next.has(index)) {
      next.clear();
    } else {
      next.clear();
      next.add(index);
    }
    lastClickedRef.current = index;
    setSelected(next);
  };

  const moveBy = (direction: -1 | 1) => {
    const { items, selected: nextSelected } = moveSelected(pages, selected, direction);
    applyReorder(items, nextSelected);
  };

  const clearSelection = () => setSelected(new Set());

  const selectAll = () => setSelected(new Set(pages.map((_, i) => i)));

  const handleDragStart = (index: number) => (event: DragEvent) => {
    const movingSet = selected.has(index) ? selected : new Set([index]);
    if (!selected.has(index)) setSelected(movingSet);
    setDragIndex(index);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (index: number) => (event: DragEvent) => {
    if (dragIndex === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropIndex(index);
  };

  const handleDrop = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    if (dragIndex === null) return;
    const movingSet = selected.has(dragIndex) ? selected : new Set([dragIndex]);
    const nextPages = reorderByDrag(pages, movingSet, index);

    // Re-derive selection: which final positions hold the moved pages.
    const movedCount = movingSet.size;
    const restIndices = pages
      .map((_, i) => i)
      .filter((i) => !movingSet.has(i));
    let insertAt = restIndices.findIndex((i) => i >= index);
    if (insertAt === -1) insertAt = restIndices.length;
    const nextSelected = new Set<number>();
    for (let k = 0; k < movedCount; k++) nextSelected.add(insertAt + k);

    applyReorder(nextPages, nextSelected);
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
  };

  const handleInsertImage = (index: number) => async (file: File) => {
    if (!onContentChange) return;
    const isPsd = file.name.toLowerCase().endsWith(".psd");
    setInsertingImageIndex(index);
    try {
      const dataUrl = isPsd ? await convertPsdToPngDataUrl(file) : await readFileAsDataUrl(file);
      const { widthMm, heightMm } = await fitImageToMm(
        dataUrl,
        layout.textAreaWidthMm * 0.9,
        layout.textAreaHeightMm * 0.6
      );
      const id = crypto.randomUUID();
      onImageAdd?.({ id, dataUrl, createdAt: Date.now() });
      const nextPages = pages.map((tokens, i) =>
        i === index
          ? [...tokens, { type: "image" as const, id, widthMm, heightMm, position: "center" as const }]
          : tokens
      );
      onContentChange(nextPages.map((tokens) => detokenizeTategaki(tokens)).join(""));
    } catch (err) {
      alert(err instanceof Error ? err.message : "画像の挿入に失敗しました。");
    } finally {
      setInsertingImageIndex(null);
    }
  };

  const handleImagePositionChange =
    (index: number) => (imageId: string, position: ImagePosition) => {
      if (!onContentChange) return;
      const nextPages = pages.map((tokens, i) =>
        i === index
          ? tokens.map((token) =>
              token.type === "image" && token.id === imageId ? { ...token, position } : token
            )
          : tokens
      );
      onContentChange(nextPages.map((tokens) => detokenizeTategaki(tokens)).join(""));
    };

  const handleImageDelete = (index: number) => (imageId: string) => {
    if (!onContentChange) return;
    const nextPages = pages.map((tokens, i) =>
      i === index ? tokens.filter((token) => !(token.type === "image" && token.id === imageId)) : tokens
    );
    onContentChange(nextPages.map((tokens) => detokenizeTategaki(tokens)).join(""));
    onImageDelete?.(imageId);
  };

  const handleHideNombreChange = (pageNumber: number) => (hideNombre: boolean) => {
    if (!onSettingsChange) return;
    const nextOverrides = { ...settings.pageOverrides };
    if (hideNombre) {
      nextOverrides[pageNumber] = { ...nextOverrides[pageNumber], hideNombre: true };
    } else {
      delete nextOverrides[pageNumber];
    }
    onSettingsChange({ ...settings, pageOverrides: nextOverrides });
  };

  if (isCollapsed) {
    return (
      <div className="flex h-full w-full flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-base py-4 shadow-sm">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="プレビューを展開"
          className="rounded border border-ink/20 p-1.5 text-ink/60 hover:bg-ink/5"
        >
          ◀
        </button>
        <span className="text-xs text-ink/60 [writing-mode:vertical-rl]">プレビュー</span>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-base shadow-sm">
      <div className="flex flex-none flex-col gap-1.5 border-b border-ink/10 bg-gray-50 p-2 dark:bg-neutral-800">
        <div className="flex flex-wrap items-center gap-2">
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="プレビューを折りたたむ"
              className="hidden flex-shrink-0 rounded border border-ink/20 px-1.5 py-1 text-xs text-ink/60 hover:bg-ink/5 md:inline-flex"
            >
              ▶
            </button>
          )}
          <span className="flex-shrink-0 whitespace-nowrap text-sm text-ink/60">プレビュー</span>
          <span className="flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoomScale <= ZOOM_MIN}
              className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              －
            </button>
            <span className="w-10 flex-shrink-0 whitespace-nowrap text-center text-xs tabular-nums">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoomScale >= ZOOM_MAX}
              className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ＋
            </button>
            <button
              type="button"
              onClick={zoomReset}
              disabled={zoomScale === 1.0}
              className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              100%
            </button>
          </span>
          {canReorder && (
            <span className="flex flex-shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={selectAll}
                disabled={pages.length === 0 || selected.size === pages.length}
                className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                全選択
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selected.size === 0}
                className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                全解除
              </button>
            </span>
          )}
          <span className="flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportJpg}
              disabled={isExporting || pages.length === 0}
              className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              JPG保存
            </button>
            <button
              type="button"
              onClick={handleExportZip}
              disabled={isExporting || pages.length === 0}
              className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExporting && exportProgress
                ? `書き出し中 (${exportProgress.current}/${exportProgress.total})...`
                : "ZIP保存"}
            </button>
            <button
              type="button"
              onClick={handleOpenPdfModal}
              disabled={isExporting || pages.length === 0}
              className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              PDF出力
            </button>
          </span>
        </div>
        <div className="flex-shrink-0 whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
          {layout.paper.label} / 全 {pages.length} ページ / 1ページ
          {layout.charsPerPage} 文字（{layout.charsPerLine}字×{layout.linesPerPage}行）
        </div>
      </div>

      {canReorder && selected.size > 0 && (
        <div className="flex flex-none items-center gap-3 border-b border-ink/10 bg-accent/5 px-4 py-2 text-sm text-ink/70">
          <span>{selected.size} ページ選択中</span>
          <button
            type="button"
            onClick={() => moveBy(-1)}
            className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5"
          >
            前へ移動
          </button>
          <button
            type="button"
            onClick={() => moveBy(1)}
            className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5"
          >
            後へ移動
          </button>
        </div>
      )}

      <div
        ref={scrollContainerRef}
        className="flex w-full flex-1 min-h-0 overflow-y-scroll overflow-x-auto p-6"
        style={{ cursor: "grab" }}
        onMouseDown={handlePanMouseDown}
        onMouseMove={handlePanMouseMove}
        onMouseUp={stopPanning}
        onMouseLeave={stopPanning}
        onScroll={handlePreviewScroll}
      >
        <div
          className="m-auto flex w-max h-max flex-col gap-6"
          style={{
            // autoFitScale shrinks the spread to the container's measured
            // width on narrow (mobile) viewports; zoomScale is the user's
            // manual zoom on top of that fitted baseline.
            transform: `scale(${zoomScale * autoFitScale})`,
            // top-left origin keeps all scaled overflow in the
            // positive-scroll direction; a centered origin pushes half
            // the overflow to negative offsets that scrollLeft/scrollTop
            // can never reach (min is 0), which clipped the right/bottom
            // edges when zoomed in.
            transformOrigin: "top left",
            transition: "transform 0.1s ease-out",
          }}
        >
        {spreadGroups.map((group, spreadIndex) => {
          const isSingle = group.length === 1;
          // Lone pages (page 1, or a trailing page when the count is even)
          // stay aligned to their conventional side: page 1 (奇数ページ始まり)
          // sits at the left, so lone odd pages align left and lone even
          // pages align right.
          const singleIsOdd = isSingle && (group[0] + 1) % 2 === 1;
          // 右綴じ: within a spread the odd/recto page reads on the left and
          // the even/verso page reads on the right (right-to-left reading
          // visits the right page first, i.e. the lower page number).
          const displayGroup = isSingle ? group : [group[1], group[0]];
          return (
            <div
              key={spreadIndex}
              className="flex flex-row items-start"
              style={{
                gap: SPREAD_GAP_PX,
                width: isSingle ? spreadWidthPx : undefined,
                justifyContent: isSingle
                  ? singleIsOdd
                    ? "flex-start"
                    : "flex-end"
                  : undefined,
              }}
            >
              {displayGroup.map((index) => (
                <div key={index} ref={registerPageElement(index)} className="flex shrink-0">
                  <PageCard
                    pageNumber={index + 1}
                    tokens={pages[index]}
                    startsNewParagraph={paragraphStarts[index]}
                    settings={settings}
                    layout={layout}
                    images={images}
                    selected={selected.has(index)}
                    isDragging={dragIndex === index}
                    isDropTarget={dropIndex === index && dragIndex !== index}
                    onToggleSelect={canReorder ? handleToggleSelect(index) : undefined}
                    onDragStart={canReorder ? handleDragStart(index) : undefined}
                    onDragOver={canReorder ? handleDragOver(index) : undefined}
                    onDrop={canReorder ? handleDrop(index) : undefined}
                    onDragEnd={canReorder ? handleDragEnd : undefined}
                    onInsertImage={canReorder ? handleInsertImage(index) : undefined}
                    insertingImage={insertingImageIndex === index}
                    onImagePositionChange={canReorder ? handleImagePositionChange(index) : undefined}
                    onImageDelete={canReorder ? handleImageDelete(index) : undefined}
                    hideNombre={Boolean(settings.pageOverrides[index + 1]?.hideNombre)}
                    onHideNombreChange={
                      onSettingsChange ? handleHideNombreChange(index + 1) : undefined
                    }
                  />
                </div>
              ))}
            </div>
          );
        })}
        </div>
      </div>

      {isPdfModalOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !isExporting && setIsPdfModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-ink/10 bg-base p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-3 text-sm font-bold text-ink">PDF出力</h2>
            <div className="flex flex-col gap-2">
              {(
                [
                  { value: "trim", label: "仕上がりサイズ（塗り足し内側）" },
                  { value: "bleed", label: "断ち落としサイズ（塗り足し3mm込み・トンボなし）" },
                  { value: "full", label: "入稿用フルサイズ（トンボ＋塗り足し3mm付き）" },
                ] as { value: PdfExportMode; label: string }[]
              ).map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2 rounded border border-ink/10 px-3 py-2 text-sm hover:bg-ink/5"
                >
                  <input
                    type="radio"
                    name="pdf-export-mode"
                    value={option.value}
                    checked={pdfMode === option.value}
                    onChange={() => setPdfMode(option.value)}
                    className="mt-0.5"
                  />
                  <span className="text-ink">{option.label}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(false)}
                disabled={isExporting}
                className="rounded border border-ink/20 px-3 py-1.5 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className="rounded bg-accent px-3 py-1.5 text-xs font-medium text-paper-ink hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isExporting && exportProgress
                  ? `書き出し中 (${exportProgress.current}/${exportProgress.total})...`
                  : "ダウンロード"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isExporting && (
        <ExportProgressModal
          label={exportLabel || "ファイル"}
          current={exportProgress?.current ?? 0}
          total={exportProgress?.total ?? 0}
        />
      )}
    </div>
  );
}
