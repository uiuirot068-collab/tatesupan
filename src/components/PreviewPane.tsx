import { useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import {
  computePageParagraphStarts,
  detokenizeTategaki,
  paginateTokens,
  tokenizeTategaki,
  type ImagePosition,
  type TategakiToken,
} from "@/lib/tategaki";
import { computeSpreadGroups, moveSelected, rangeIndices, reorderByDrag } from "@/lib/pageOrder";
import { fitImageToMm, readFileAsDataUrl } from "@/lib/image";
import type { ImageRecord } from "@/lib/db";
import { PX_PER_MM, type PageLayout, type PageSettings } from "@/lib/pageLayout";
import PageCard from "./PageCard";

/** Visual seam width (px) between the two pages of a spread. */
const SPREAD_GAP_PX = 4;

interface PreviewPaneProps {
  content: string;
  settings: PageSettings;
  layout: PageLayout;
  images: Record<string, string>;
  onContentChange?: (content: string) => void;
  onSettingsChange?: (settings: PageSettings) => void;
  onImageAdd?: (record: ImageRecord) => void;
  onImageDelete?: (imageId: string) => void;
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
}: PreviewPaneProps) {
  const pages = useMemo(() => {
    const tokens = tokenizeTategaki(content);
    return paginateTokens(tokens, {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
    });
  }, [content, layout.charsPerLine, layout.linesPerPage]);

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

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isPanningRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const scrollPosRef = useRef({ left: 0, top: 0 });

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
    const dataUrl = await readFileAsDataUrl(file);
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

  return (
    <div className="flex h-full flex-col bg-base">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2 text-sm text-ink/60">
        <span>プレビュー</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={zoomOut}
              disabled={zoomScale <= ZOOM_MIN}
              className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              －
            </button>
            <span className="w-10 text-center text-xs tabular-nums">
              {Math.round(zoomScale * 100)}%
            </span>
            <button
              type="button"
              onClick={zoomIn}
              disabled={zoomScale >= ZOOM_MAX}
              className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ＋
            </button>
            <button
              type="button"
              onClick={zoomReset}
              disabled={zoomScale === 1.0}
              className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              100%
            </button>
          </span>
          {canReorder && (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={selectAll}
                disabled={pages.length === 0 || selected.size === pages.length}
                className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                全選択
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selected.size === 0}
                className="rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                全解除
              </button>
            </span>
          )}
          <span>
            {layout.paper.label} / 全 {pages.length} ページ / 1ページ
            {layout.charsPerPage} 文字（{layout.charsPerLine}字×{layout.linesPerPage}行）
          </span>
        </div>
      </div>

      {canReorder && selected.size > 0 && (
        <div className="flex items-center gap-3 border-b border-ink/10 bg-accent/5 px-4 py-2 text-sm text-ink/70">
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
        className="flex-1 overflow-auto p-6"
        style={{ cursor: "grab" }}
        onMouseDown={handlePanMouseDown}
        onMouseMove={handlePanMouseMove}
        onMouseUp={stopPanning}
        onMouseLeave={stopPanning}
      >
        <div
          className="flex flex-col items-center gap-6"
          style={{
            transform: `scale(${zoomScale})`,
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
                <PageCard
                  key={index}
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
                  onImagePositionChange={canReorder ? handleImagePositionChange(index) : undefined}
                  onImageDelete={canReorder ? handleImageDelete(index) : undefined}
                  hideNombre={Boolean(settings.pageOverrides[index + 1]?.hideNombre)}
                  onHideNombreChange={
                    onSettingsChange ? handleHideNombreChange(index + 1) : undefined
                  }
                />
              ))}
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
