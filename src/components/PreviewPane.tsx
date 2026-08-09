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
  PAGE_BREAK_MARKER,
  computePageParagraphStarts,
  computePageSourceRanges,
  detokenizeTategaki,
  findPageIndexForCharIndex,
  paginateTokens,
  tokenizeTategaki,
  type ImagePosition,
  type TategakiPage,
} from "@/lib/tategaki";
import { computeSpreadGroups, moveSelected, rangeIndices, reorderByDrag } from "@/lib/pageOrder";
import { PAPER_SIZE_TEMPLATES } from "@/constants/paperSizes";
import { fitImageToMm, readFileAsDataUrl } from "@/lib/image";
import { convertPsdToPngDataUrl } from "@/utils/psdConverter";
import { exportAllPagesToZip, exportPageToJpg } from "@/utils/exportImage";
import { exportCustomPdf, type PdfExportMode } from "@/utils/exportPdf";
import type { ImageRecord } from "@/lib/db";
import { PX_PER_MM, cssPxToPhysicalMm, type PageLayout, type PageSettings } from "@/lib/pageLayout";
import { useShortcuts } from "@/hooks/useShortcuts";
import ExportProgressModal from "./ExportProgressModal";
import PageCard from "./PageCard";

/** Visual seam width (px) between the two pages of a spread. */
const SPREAD_GAP_PX = 4;

/** Padding (px) of the scroll container per axis (`p-6` = 1.5rem × 2 sides, uniform on all four sides). */
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
      columnCount: settings.columnCount,
      linesPerColumn: layout.linesPerColumn,
    });
  }, [
    deferredContent,
    layout.charsPerLine,
    layout.linesPerPage,
    layout.linesPerColumn,
    settings.columnCount,
  ]);

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

  // Maps each paginated page object back to its position in `pages` so
  // reorder reconstruction can tell which pages were originally adjacent
  // (moveSelected/reorderByDrag rearrange these same references, they never
  // clone), letting it pull exact original source text instead of
  // re-detokenizing — detokenizing drops 【改ページ】 markers entirely, since
  // paginateTokensByLines consumes pageBreak tokens without ever placing
  // them into a page's `tokens` array.
  const pageOriginalIndex = useMemo(() => {
    const map = new Map<TategakiPage, number>();
    pages.forEach((page, i) => map.set(page, i));
    return map;
  }, [pages]);

  // 面付け: page 1 stands alone (奇数ページ始まり), then pages pair up as
  // (2,3), (4,5), ... into 見開き spreads.
  const spreadGroups = useMemo(() => computeSpreadGroups(pages.length), [pages.length]);

  // Web閲覧用 (isPx) authors its canonical DOM size directly in *screen*
  // pixels (768×1024) rather than the small mm-based magnitude every other
  // preset's canonical size resolves to (e.g. 文庫/A6 ≈ 230×326px). Fitting
  // the fit-ratio math directly against that literal 768/1024 makes the
  // *fit result itself* swing between presets depending on which axis binds
  // for that particular preset's aspect ratio vs. the pane's aspect ratio.
  // The preview's job is legibility, not physical-size comparison (spec:
  // 100% here already isn't a literal canonical-px 1:1 view), so Web asks
  // the *fit math* to treat it as if its canonical size were
  // WEB_PREVIEW_REFERENCE_WIDTH/HEIGHT_PX — a magnitude in the same
  // ballpark as the print presets' own canonical sizes, and at the exact
  // same 3:4 ratio as the true 768×1024 so orientation/proportion is
  // unaffected — then `webPreviewBaseScale` below corrects the resulting
  // scale factor back up so it still lands correctly on the *real* 768×1024
  // DOM node (which is never resized or touched here).
  const WEB_PREVIEW_REFERENCE_WIDTH_PX = 240;
  const WEB_PREVIEW_REFERENCE_HEIGHT_PX = 320;
  const isWebPreset = layout.paper.isPx;
  const fitUnitWidthPx = isWebPreset ? WEB_PREVIEW_REFERENCE_WIDTH_PX : layout.paper.widthMm * PX_PER_MM;
  const fitUnitHeightPx = isWebPreset ? WEB_PREVIEW_REFERENCE_HEIGHT_PX : layout.paper.heightMm * PX_PER_MM;
  const webPreviewBaseScale =
    isWebPreset && layout.paper.widthPx ? WEB_PREVIEW_REFERENCE_WIDTH_PX / layout.paper.widthPx : 1;

  // `spreadWidthPx` sizes the *real* DOM row (two true-canonical-width page
  // cards side by side, and the empty verso/recto slot reserved beside a
  // lone page — see the spread-row JSX below) and must stay the true
  // canonical magnitude — it has no bearing on the fit-scale math (see
  // `fitUnitWidthPx` above), which is single-page-only regardless of page
  // count or how many real 2-up spreads exist. A 2-up row that doesn't fit
  // the pane at that single-page scale simply overflows into the scroll
  // container's existing `overflow-x-auto`, rather than shrinking every
  // page to make the spread fit.
  const spreadWidthPx = layout.paper.widthMm * 2 * PX_PER_MM + SPREAD_GAP_PX;
  // True canonical single-page height, used only to reserve visual breathing
  // room below a still-single-page manuscript (see the spacer below) — never
  // for the fit-scale math, which uses `fitUnitHeightPx` instead.
  const canonicalPageHeightPx = layout.paper.heightMm * PX_PER_MM;

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [insertingImageIndex, setInsertingImageIndex] = useState<number | null>(null);
  const lastClickedRef = useRef<number | null>(null);

  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.0;
  const ZOOM_STEP = 0.1;
  // Default view is an overview of the book's page layout — [page1][空き] /
  // [page3][page2] / ... at a glance — not one page maximized to fill the
  // pane, so the preview opens at 50% rather than 100%. Resetting via the
  // "100%" toolbar button still targets a literal 100%, matching its label;
  // only this initial mount value changes.
  const [zoomScale, setZoomScale] = useState<number>(0.5);

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

  // Fit-to-pane presentation scale: each paper preset's *canonical* CSS px
  // size (used for layout/export, e.g. mm-based presets via PX_PER_MM, or
  // Web閲覧用's 768×1024px) has nothing to do with how large it should look
  // in this editor pane. A page's own canonical DOM size is decided by
  // PageCard's inline width/height and is never touched here — this only
  // scales the `data-export-scale-root` wrapper visually so every preset
  // reads at a comparably legible size regardless of how big or small its
  // canonical px magnitude happens to be (Web閲覧用's 768px canonical width
  // used to make it render far smaller than e.g. A6 once naively shrunk to
  // fit the pane, since A6's much smaller canonical width rarely needed any
  // shrinking at all). Track both container dimensions so the fit can scale
  // pages up as well as down; exports always strip this transform before
  // capture, so it never affects the exported pixel size.
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  const [containerHeight, setContainerHeight] = useState<number | null>(null);
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const update = () => {
      setContainerWidth(container.clientWidth);
      setContainerHeight(container.clientHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // baseAutoFitScale: fits *one single page only* to the currently visible
  // pane — never a 2-up spread, never the whole multi-page document — so it
  // is entirely independent of page count and of whether any spread rows
  // exist. Only the paper preset's own single-page dimensions (or Web閲覧用's
  // reference-size stand-in above) and the pane's measured size affect it.
  // webPreviewBaseScale (1 for every non-Web preset) rescales the
  // reference-size fit ratio back onto the real 768×1024 canonical DOM node.
  const baseAutoFitScale = useMemo(() => {
    if (!containerWidth || !containerHeight || fitUnitWidthPx <= 0 || fitUnitHeightPx <= 0) return 1;
    // p-6 (SCROLL_CONTAINER_PADDING_X_PX = 1.5rem × 2 sides = 48px) is
    // uniform on all four sides, so the same constant applies to height too.
    const availableWidth = containerWidth - SCROLL_CONTAINER_PADDING_X_PX;
    const availableHeight = containerHeight - SCROLL_CONTAINER_PADDING_X_PX;
    if (availableWidth <= 0 || availableHeight <= 0) return 1;
    // Web閲覧用's canonical page is tall (768×1024) relative to how short a
    // real browser window's preview pane often is once the editor toolbar,
    // header, and settings rows are subtracted — e.g. a real ~1061×651
    // Chrome window measured availableHeight down to ~280px, which alone
    // (via the old width/height min()) forced the page down to 210px wide
    // even though ~430px of width was available. The vertical extent of a
    // single page was never something users needed to see all at once (this
    // pane already scrolls vertically for multi-page manuscripts), so for
    // Web閲覧用 specifically the fit is width-only: legible page width first,
    // vertical overflow always handled by the pane's existing scroll rather
    // than by shrinking the page to fit the window's height. Print presets
    // (文庫/A6/...) keep the width+height fit unchanged — their canonical
    // pages are already close to a normal window's proportions, so height
    // rarely binds for them the way it does for Web閲覧用's very tall page.
    const referenceFitScale = isWebPreset
      ? availableWidth / fitUnitWidthPx
      : Math.min(availableWidth / fitUnitWidthPx, availableHeight / fitUnitHeightPx);
    return referenceFitScale * webPreviewBaseScale;
  }, [containerWidth, containerHeight, fitUnitWidthPx, fitUnitHeightPx, webPreviewBaseScale, isWebPreset]);

  // Presentation scale actually applied to the preview: toolbar 100% means
  // userZoom(=zoomScale) 1.0 on top of the paper-size-dependent
  // baseAutoFitScale baseline — never a literal canonical-CSS-px 1:1 view.
  const presentationScale = zoomScale * baseAutoFitScale;

  // Reference paper for editor-chrome sizing: A5 is the size the user
  // already found comfortable before any of this scaling existed, so chrome
  // is pinned to "how big it would be if A5 were the current preset in this
  // exact pane" rather than to a literal frozen pixel constant (which would
  // stop adapting if the pane were resized) or to 1 (which was tried first
  // and made chrome uniformly *smaller* than that liked A5 baseline — e.g.
  // A5 100% checkbox 17.91px → 14px — solving "Web too small" by shrinking
  // A5 too, not by bringing Web up to match it). Deriving it from A5's own
  // real mm dimensions via the *same* fit formula as any other preset means
  // there's no magic number to keep in sync by hand: if A5's own template
  // ever changes, this reference changes with it automatically.
  const CHROME_REFERENCE_WIDTH_MM = PAPER_SIZE_TEMPLATES["A5"].width;
  const CHROME_REFERENCE_HEIGHT_MM = PAPER_SIZE_TEMPLATES["A5"].height;
  const chromeReferenceWidthPx = CHROME_REFERENCE_WIDTH_MM * PX_PER_MM;
  const chromeReferenceHeightPx = CHROME_REFERENCE_HEIGHT_MM * PX_PER_MM;
  const chromeReferenceFitScale = useMemo(() => {
    if (!containerWidth || !containerHeight) return 1;
    const availableWidth = containerWidth - SCROLL_CONTAINER_PADDING_X_PX;
    const availableHeight = containerHeight - SCROLL_CONTAINER_PADDING_X_PX;
    if (availableWidth <= 0 || availableHeight <= 0) return 1;
    return Math.min(availableWidth / chromeReferenceWidthPx, availableHeight / chromeReferenceHeightPx);
  }, [containerWidth, containerHeight, chromeReferenceWidthPx, chromeReferenceHeightPx]);

  // Counter-scale passed down to PageCard for its editor-only chrome
  // (selection checkbox, insert-image/hide-nombre controls, "Nページ"
  // caption) — everything OUTSIDE `.page-card` itself. Those elements sit
  // inside the same `transform: scale(presentationScale)` ancestor as the
  // paper surface below, so without this they shrink/grow by
  // baseAutoFitScale right along with it — and since baseAutoFitScale
  // varies hugely by preset (e.g. ~1.28 for A5 vs ~0.81 for Web閲覧用 in the
  // same pane, both at "100%"/userZoom=1), that chrome read as comparably
  // fine on A5 but illegibly tiny on Web閲覧用. Net chrome scale here =
  // presentationScale × (chromeReferenceFitScale / baseAutoFitScale) =
  // userZoom × chromeReferenceFitScale — when A5 is the selected preset,
  // baseAutoFitScale *is* chromeReferenceFitScale (identical formula, same
  // inputs), so this is exactly 1 and A5's own chrome is completely
  // unaffected; for every other preset it instead renders at "the size A5's
  // chrome would be in this pane," which is what actually needs to change.
  const chromeScale = baseAutoFitScale > 0 ? chromeReferenceFitScale / baseAutoFitScale : 1;

  // `data-export-scale-root` (below) holds every spread stacked at its
  // *natural*, untransformed size — for a canonical-px-heavy preset like
  // Web閲覧用 (768×1024) that natural box can vastly exceed the pane, and
  // CSS `transform: scale()` never changes the box's own layout size (only
  // how it paints), so the flex `m-auto` centering on that box resolves its
  // auto margins against the *unscaled* size vs. the pane — went negative
  // and collapsed to 0, pinning the (visually shrunk) page to the pane's
  // top-left corner instead of centering it, which read as the page being
  // "tiny" in a sea of empty scrollable space even though its rendered
  // pixel size was comparable to other presets. Measuring that untransformed
  // size here and giving *this* wrapper explicit dimensions equal to
  // natural size × presentationScale gives `m-auto` the correct (already
  // scaled) footprint to center against, regardless of preset or page count.
  const scaleContentRef = useRef<HTMLDivElement | null>(null);
  const [naturalContentSize, setNaturalContentSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    const content = scaleContentRef.current;
    if (!content) return;
    const update = () => {
      setNaturalContentSize({ width: content.offsetWidth, height: content.offsetHeight });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

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
      // Web閲覧用（isPx）はcanonicalなpx外形(768×1024)をそのまま出力するため
      // scale=1。印刷用presetは既存どおり高画質化のscale=3を維持する。
      await exportPageToJpg(el, "tatespun_page.jpg", layout.paper.isPx ? 1 : 3);
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
      await exportAllPagesToZip(
        elements,
        "tatespun_all_pages.zip",
        (current, total) => {
          setExportProgress({ current, total });
        },
        layout.paper.isPx ? 1 : 3
      );
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
    const totalPages = pages.length;
    // 最終ページ（総ページ数)が奇数の場合の入稿チェック
    if (totalPages % 2 !== 0) {
      const isConfirmed = window.confirm(
        `最終ページが奇数（全 ${totalPages} ページ）ですが大丈夫ですか？\n※冊子印刷では白ページの挿入が必要になる場合があります。`
      );
      if (!isConfirmed) {
        return; // 処理中断
      }
    }
    const elements = pages
      .map((_, i) => pageElementsRef.current.get(i))
      .filter((el): el is HTMLDivElement => el != null);
    if (elements.length === 0) return;
    setIsExporting(true);
    setExportLabel("PDF");
    setExportProgress({ current: 0, total: elements.length });
    try {
      // Web閲覧用（isPx）はmm実寸表(exportPdf.tsのPAPER_SIZES)に載っておらず、
      // customWidth/customHeightを渡さないとA5へフォールバックしてしまう。
      // 768×1024pxのcanonical外形を96dpi換算した実寸mmを明示的に渡し、
      // 3:4比率を保ったcustom PDFページを使う。
      const isWebPreset = layout.paper.isPx;
      const customWidth =
        isWebPreset && layout.paper.widthPx != null
          ? cssPxToPhysicalMm(layout.paper.widthPx)
          : undefined;
      const customHeight =
        isWebPreset && layout.paper.heightPx != null
          ? cssPxToPhysicalMm(layout.paper.heightPx)
          : undefined;
      await exportCustomPdf(elements, {
        mode: pdfMode,
        paperSizeName: layout.paper.label,
        customWidth,
        customHeight,
        bleed: 3,
        scale: isWebPreset ? 1 : 4,
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

  // Rebuilds document text for a reordered page sequence. Runs of pages that
  // were already consecutive in the original order are copied verbatim from
  // `content` (preserving any 【改ページ】 marker or other separator between
  // them exactly); everywhere the reorder makes two originally-non-adjacent
  // pages neighbors, a marker is inserted so their text isn't silently fused
  // into one run-on paragraph at the new seam.
  const buildReorderedContent = (nextPages: TategakiPage[]): string => {
    const segments: string[] = [];
    let runStart: number | null = null;
    let runEnd: number | null = null;

    const flushRun = () => {
      if (runStart === null || runEnd === null) return;
      if (segments.length > 0) segments.push(PAGE_BREAK_MARKER);
      segments.push(content.slice(pageSourceRanges[runStart].start, pageSourceRanges[runEnd].end));
      runStart = null;
      runEnd = null;
    };

    for (const page of nextPages) {
      const origIndex = pageOriginalIndex.get(page);
      if (origIndex == null) {
        flushRun();
        if (segments.length > 0) segments.push(PAGE_BREAK_MARKER);
        segments.push(detokenizeTategaki(page.tokens));
        continue;
      }
      if (runStart !== null && runEnd !== null && origIndex === runEnd + 1) {
        runEnd = origIndex;
      } else {
        flushRun();
        runStart = origIndex;
        runEnd = origIndex;
      }
    }
    flushRun();
    return segments.join("");
  };

  const applyReorder = (nextPages: TategakiPage[], nextSelected: Set<number>) => {
    if (!onContentChange) return;
    onContentChange(buildReorderedContent(nextPages));
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

  // Replaces just the affected page's own source range within `content`
  // (per `pageSourceRanges`), leaving every other page's text — including
  // any 【改ページ】 markers between pages — completely untouched. Also
  // sidesteps any `tokens`/`columns` mismatch: since no TategakiPage object
  // is mutated or copied here, there's nothing that could disagree.
  const replacePageContent = (index: number, tokens: TategakiPage["tokens"]) => {
    const range = pageSourceRanges[index];
    onContentChange?.(content.slice(0, range.start) + detokenizeTategaki(tokens) + content.slice(range.end));
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
      replacePageContent(index, [
        ...pages[index].tokens,
        { type: "image" as const, id, widthMm, heightMm, position: "center" as const },
      ]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "画像の挿入に失敗しました。");
    } finally {
      setInsertingImageIndex(null);
    }
  };

  const handleImagePositionChange =
    (index: number) => (imageId: string, position: ImagePosition) => {
      if (!onContentChange) return;
      replacePageContent(
        index,
        pages[index].tokens.map((token) =>
          token.type === "image" && token.id === imageId ? { ...token, position } : token
        )
      );
    };

  const handleImageDelete = (index: number) => (imageId: string) => {
    if (!onContentChange) return;
    replacePageContent(
      index,
      pages[index].tokens.filter((token) => !(token.type === "image" && token.id === imageId))
    );
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
    <div className="relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-y-auto max-h-[85vh] md:max-h-none md:overflow-y-visible md:overflow-hidden rounded-2xl border border-ink/10 bg-base shadow-sm">
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
          className="m-auto"
          style={{
            width: naturalContentSize ? naturalContentSize.width * presentationScale : undefined,
            height: naturalContentSize ? naturalContentSize.height * presentationScale : undefined,
          }}
        >
        <div
          ref={scaleContentRef}
          data-export-scale-root="true"
          className="flex w-max h-max flex-col gap-6"
          style={{
            transform: `scale(${presentationScale})`,
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
                // A lone page always reserves the full 2-up spread width and
                // sits at its conventional side (page 1 / odd → left, even →
                // right) — an overview of the book, not a single maximized
                // page, so a still-empty verso/recto slot stays visually
                // present even before that page exists. This is independent
                // of the fit-scale math above (single-page-basis regardless
                // of page count): reserving this box never changes how big
                // the *page itself* renders, only how much empty space sits
                // beside it, so a 1-page manuscript still gets the
                // single-page-basis scale while showing "page 1 beside an
                // empty slot" instead of page 1 centered alone with no
                // spread context.
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
                    page={pages[index]}
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
                    chromeScale={chromeScale}
                  />
                </div>
              ))}
            </div>
          );
        })}
        {/* A manuscript that's still just page 1 would otherwise have the
            scrollable canvas end flush at its bottom edge, reading as if
            there's nothing more to the document. Reserving one more row's
            worth of height (no page content, so never a real DOM page or
            export element — html-to-image's capture target is `.page-card`,
            which this has none of) hints that the next spread row (page 3
            beside page 2) will land there once typed, without page 1's own
            position or scale shifting when it does. */}
        {spreadGroups.length === 1 && (
          <div aria-hidden="true" style={{ height: canonicalPageHeightPx }} />
        )}
        </div>
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
