import {
  memo,
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
  findImageTokenRange,
  findPageIndexForCharIndex,
  formatImageMarker,
  paginateTokens,
  tokenizeTategaki,
  type ImagePosition,
  type TategakiPage,
} from "@/lib/tategaki";
import { computeSpreadGroups, moveSelected, rangeIndices, reorderByDrag } from "@/lib/pageOrder";
import { PAPER_SIZE_TEMPLATES } from "@/constants/paperSizes";
import { fitImageToMm, readFileAsDataUrl } from "@/lib/image";
import { convertPsdToPngDataUrl } from "@/utils/psdConverter";
import {
  exportPagesAsIndividualJpgs,
  exportPagesToZip,
  exportPageToJpg,
  type ExportPageItem,
  type PrintJpgGeometry,
} from "@/utils/exportImage";
import { exportCustomPdf, type PdfExportMode } from "@/utils/exportPdf";
import {
  measureCaptureSize,
  measureTrimGuideRatioRect,
  prewarmExportFonts,
} from "@/utils/exportCapture";
import {
  buildPageJpgFileName,
  buildPdfFileName,
  buildZipFileName,
} from "@/utils/exportFilename";
import type { ImageRecord } from "@/lib/db";
import {
  PX_PER_MM,
  BLEED_MM,
  PDF_EXPORT_DPI,
  PRINT_JPG_LONG_SIDE_PX,
  computePrintJpgPixelRatio,
  pixelRatioForDpi,
  updatePageOverrides,
  type PageLayout,
  type PageSettings,
} from "@/lib/pageLayout";
import { useShortcuts } from "@/hooks/useShortcuts";
import ExportProgressModal from "./ExportProgressModal";
import PageCard from "./PageCard";

/** Visual seam width (px) between the two pages of a spread. */
const SPREAD_GAP_PX = 4;

/** Padding (px) of the scroll container per axis (`p-6` = 1.5rem × 2 sides, uniform on all four sides). */
const SCROLL_CONTAINER_PADDING_X_PX = 48;

// [TateSpun perf] preview performance Phase P1: PageCardはReact.memo化した
// (PageCard.tsx参照)が、per-page callback（onToggleSelect等）は元々
// `(index) => (event) => {...}` という毎render新規生成されるcurry関数の
// 呼び出し結果だったため、propsの参照が毎回変わりmemoを素通りしてしまう。
// これら2つのhookは、呼び出し元のhandler本体（selected/dragIndex等の
// 最新値を読む閉包ロジック）は一切変更せず、「最新のhandlerへ委譲するだけの
// 安定した参照を1度だけ作ってキャッシュする」薄いラッパーを提供する
// （React未公式のuseEvent的パターン）。ref経由で常に最新のhandlerへ
// 委譲するため、キャッシュされた参照を呼び出しても古いselected/dragIndex
// 等を使って動作することはない（stale closure化しない）。
/** page indexを取らない単一callbackを、参照だけ安定させて返す。 */
function useStableCallback<Args extends unknown[], R>(fn: (...args: Args) => R): (...args: Args) => R {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const stableRef = useRef<((...args: Args) => R) | undefined>(undefined);
  if (!stableRef.current) {
    stableRef.current = (...args: Args) => fnRef.current(...args);
  }
  return stableRef.current;
}

/** `(index) => (...args) => R` 形のcurry factoryを、index単位で参照が安定するよう包む。 */
function useStableIndexedCallback<Args extends unknown[], R>(
  factory: (index: number) => (...args: Args) => R
): (index: number) => (...args: Args) => R {
  const factoryRef = useRef(factory);
  factoryRef.current = factory;
  const cacheRef = useRef<Map<number, (...args: Args) => R> | undefined>(undefined);
  if (!cacheRef.current) cacheRef.current = new Map();
  const getRef = useRef<((index: number) => (...args: Args) => R) | undefined>(undefined);
  if (!getRef.current) {
    getRef.current = (index: number) => {
      const cache = cacheRef.current!;
      let wrapper = cache.get(index);
      if (!wrapper) {
        wrapper = (...args: Args) => factoryRef.current(index)(...args);
        cache.set(index, wrapper);
      }
      return wrapper;
    };
  }
  return getRef.current;
}

// [TateSpun perf] drag調査で判明: dragIndex/dropIndexはPreviewPane自身の
// stateのため、どちらかが変わるたびPreviewPane関数本体が再実行され、
// spreadGroups.map(...)内で最大365ページぶんの<PageCard>要素生成＋memo
// comparator呼び出しが毎回走っていた（PageCard自身のDOM再描画は既存の
// React.memoで正しく抑えられていたが、その手前のJSX構築自体は防げていな
// かった）。1ページぶんの<div ref><PageCard/></div>をこのPageSlotへ機械的
// に切り出し、React.memo（デフォルトのshallow比較、custom comparatorなし）
// で包むことで、実際に値が変わった行だけがPageCard要素を作り直すように
// する。isDragging/isDropTarget/isSelectedを生のdragIndex/dropIndex/
// selected Setではなくpage単位のbooleanとして渡しているのが要——生の
// dragIndex/dropIndexをそのまま渡すと、値が変わるたび全PageSlotのshallow
// 比較が「不一致」になり意味がなくなる。他のprops（page/settings/layout/
// stable化済みcallback等）は元のJSXと同じ式をそのまま呼び出し元で評価して
// 渡しているだけで、値・挙動は変えていない。
interface PageSlotProps {
  index: number;
  registerRef: (el: HTMLDivElement | null) => void;
  page: TategakiPage;
  pageSignature: string;
  startsNewParagraph: boolean;
  settings: PageSettings;
  layout: PageLayout;
  images: Record<string, string>;
  imageLayerOrder: Record<string, number>;
  isSelected: boolean;
  isDragging: boolean;
  isDropTarget: boolean;
  /** isDropTargetがfalseの間は常にnull（呼び出し側でそう揃えている）——無関係な
   * ページのPageSlot propsをdragoverごとに変化させないため。 */
  dropPosition: "before" | "after" | null;
  onToggleSelect?: (event: MouseEvent) => void;
  onToggleCheckbox?: () => void;
  onDragStart?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
  onInsertImage?: (file: File) => void;
  insertingImage: boolean;
  onImagePositionChange?: (imageId: string, position: ImagePosition) => void;
  onImageDelete?: (imageId: string) => void;
  onImageLayerChange?: (updates: { id: string; layerOrder: number }[]) => void;
  hideNombre: boolean;
  onHideNombreChange?: (hideNombre: boolean) => void;
  hideHashira: boolean;
  onHideHashiraChange?: (hideHashira: boolean) => void;
  hashiraOverride?: string;
  chromeScale: number;
}

const PageSlot = memo(function PageSlot({
  index,
  registerRef,
  page,
  pageSignature,
  startsNewParagraph,
  settings,
  layout,
  images,
  imageLayerOrder,
  isSelected,
  isDragging,
  isDropTarget,
  dropPosition,
  onToggleSelect,
  onToggleCheckbox,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onInsertImage,
  insertingImage,
  onImagePositionChange,
  onImageDelete,
  onImageLayerChange,
  hideNombre,
  onHideNombreChange,
  hideHashira,
  onHideHashiraChange,
  hashiraOverride,
  chromeScale,
}: PageSlotProps) {
  return (
    <div ref={registerRef} className="relative flex shrink-0">
      {/* ページ間drop挿入ガイド: PageCard.tsx自体は変更せず、その兄弟として
          hover中のページ1枚だけに細い縦線を重ねる。見開きはRTL表示——
          このページの右半分をhoverしたとき("before"、このページの手前へ
          挿入)は右端に、左半分("after"、このページの後ろへ挿入)は左端に
          出す。dropPositionはisDropTargetがtrueの行だけ非nullになるよう
          呼び出し側で揃えているため、無関係な行では常にnullで再描画されない。 */}
      {dropPosition && (
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 z-10 w-1 rounded-full bg-accent ${
            dropPosition === "before" ? "right-0" : "left-0"
          }`}
        />
      )}
      <PageCard
        pageNumber={index + 1}
        page={page}
        pageSignature={pageSignature}
        startsNewParagraph={startsNewParagraph}
        settings={settings}
        layout={layout}
        images={images}
        imageLayerOrder={imageLayerOrder}
        selected={isSelected}
        isDragging={isDragging}
        isDropTarget={isDropTarget}
        onToggleSelect={onToggleSelect}
        onToggleCheckbox={onToggleCheckbox}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onInsertImage={onInsertImage}
        insertingImage={insertingImage}
        onImagePositionChange={onImagePositionChange}
        onImageDelete={onImageDelete}
        onImageLayerChange={onImageLayerChange}
        hideNombre={hideNombre}
        onHideNombreChange={onHideNombreChange}
        hideHashira={hideHashira}
        onHideHashiraChange={onHideHashiraChange}
        hashiraOverride={hashiraOverride}
        chromeScale={chromeScale}
      />
    </div>
  );
});

interface PreviewPaneProps {
  content: string;
  /** 作品タイトル。書き出しファイル名の生成に使う（空なら既定のフォールバック名）。 */
  title?: string;
  settings: PageSettings;
  layout: PageLayout;
  images: Record<string, string>;
  /** Front/back stacking rank per image id (ImageRecord.layerOrder) — see PageCard.tsx's layering controls. */
  imageLayerOrder: Record<string, number>;
  onContentChange?: (content: string) => void;
  onSettingsChange?: (settings: PageSettings) => void;
  onImageAdd?: (record: ImageRecord) => void;
  onImageDelete?: (imageId: string) => void;
  onImageLayerChange?: (updates: { id: string; layerOrder: number }[]) => void;
  /** Character index of the editor caret into `content`; when it changes, the matching page scrolls into view. */
  cursorIndex?: number | null;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  /** 0-based indices into `pages` currently selected — lifted to the parent so PageSettingsPanel's 「選択ページ」panel can read/apply against the same selection. */
  selected: Set<number>;
  onSelectedChange: (next: Set<number>) => void;
}

export default function PreviewPane({
  content,
  title = "",
  settings,
  layout,
  images,
  imageLayerOrder,
  onContentChange,
  onSettingsChange,
  onImageAdd,
  onImageDelete,
  onImageLayerChange,
  cursorIndex,
  isCollapsed = false,
  onToggleCollapse,
  selected,
  onSelectedChange: setSelected,
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

  // [TateSpun perf] PageCard.tsx側のReact.memoコンパレータへ渡す、ページ
  // ごとの軽量content signature。`pages`の各要素はpaginateTokensが呼ばれる
  // たび（＝`pages`自体のuseMemoが再計算されるたび）に新しいオブジェクト
  // 参照になる（tokenizeTategakiが文書全体を毎回再構築するため）ので、
  // `page`オブジェクトの参照一致では「このページの内容は本当に変わって
  // いないか」を判定できない。detokenizeTategaki(page.tokens)は既存の
  // token→原文復元ロジックをそのまま再利用した軽量な文字列化（深い
  // JSON.stringify等は行わない）で、ページ内容（ruby/tcy/画像markerを
  // 含む）が実質同一かどうかの比較に十分な信号になる。`pages`自体と同じ
  // cadence（useDeferredValue経由）でしか再計算されないため、1文字入力
  // ごとに毎回計算されるわけではない。
  const pageSignatures = useMemo(
    () => pages.map((page) => detokenizeTategaki(page.tokens)),
    [pages]
  );

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

  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // "このページの前" か "このページの後" か。dropIndexだけでは見開きの
  // 「ページとページの間」を区別できないため、dragover時のpointer位置
  // (ページ自身の横方向の中点との比較)から独立に決定する。
  const [dropPosition, setDropPosition] = useState<"before" | "after" | null>(null);
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

  // Export用fontEmbedCSSのバックグラウンド先読み: exportCapture.tsの
  // キャッシュ済みPromiseを、ユーザーが実際にexportボタンを押すより前に
  // 一度だけ起動しておく（初回export時に約26秒かかっていたGoogle Fonts
  // 埋め込み生成を、editorを開いている間に前倒しで終わらせておくため）。
  // ブラウザが空いたタイミングで開始したいのでrequestIdleCallbackを使い、
  // 未対応環境（Safari等）はsetTimeoutへfallbackする。マウント時に1回
  // だけでよく、描画・ユーザー操作は一切blockしない（呼び出し先は
  // 即returnする同期関数）。
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) prewarmExportFonts();
    };
    const hasIdleCallback = typeof window.requestIdleCallback === "function";
    const handle = hasIdleCallback ? window.requestIdleCallback(run) : window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      if (hasIdleCallback && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(handle as number);
      } else {
        window.clearTimeout(handle as number);
      }
    };
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
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  /** 選択中ページを物理ページ順（昇順）の0-basedインデックス配列で返す。画面上の選択順ではなく本のページ順。 */
  const getOrderedSelectedIndices = (): number[] => Array.from(selected).sort((a, b) => a - b);

  /** 指定インデックス群を、実在するDOM要素だけの {element, fileName} 配列に解決する。JPG一括・ZIPで共通。 */
  const buildSelectedPageItems = (indices: number[]): ExportPageItem[] =>
    indices
      .map((index): ExportPageItem | null => {
        const el = pageElementsRef.current.get(index);
        return el ? { element: el, fileName: buildPageJpgFileName(title, index + 1) } : null;
      })
      .filter((item): item is ExportPageItem => item != null);

  /**
   * 正式仕様A: 印刷用紙JPG（JPG/JPG一括/JPG ZIP共通）の最終出力は
   * 「プレビューのTrimGuide（仕上がり線）内側をそのまま切り出した画像」。
   * crop位置は3mmという理論値から逆算するのではなく、実際にpreviewへ
   * 描画されているTrimGuideのcanonical位置を`measureTrimGuideRatioRect`
   * で実測した比率をそのまま使う——`.page-card`のborder有無・
   * box-sizing・見開き内の`marginTop:auto`など、どんな見た目上のズレ
   * 要因があっても、TrimGuideとcapture後のcanvasはどちらも同じ
   * `.page-card`のcanonical widthを分母にした比率なので自動的に追従する
   * （固定mm値で逆算する旧方式は、この比率とわずかにズレていた）。
   * crop後は仕上がり物理比率（例: A5なら148:210）を保った最終px
   * （長辺1600px固定）へ1回だけresizeし、html-to-image/crop双方の丸め
   * 誤差を吸収する。Web閲覧用はTrimGuideを持たないため未指定
   * （cropもresizeもしない）。
   */
  const resolvePrintJpgGeometry = (element: HTMLElement): PrintJpgGeometry | undefined => {
    if (layout.paper.isPx) return undefined;
    const cropRatio = measureTrimGuideRatioRect(element);
    if (!cropRatio) {
      console.warn("TrimGuideが見つからないため、印刷用紙JPGのcrop/resizeをスキップします。");
      return undefined;
    }
    const { width: pageWidthPx, height: pageHeightPx } = measureCaptureSize(element);
    const trimWidthMm = layout.paper.widthMm;
    const trimHeightMm = layout.paper.heightMm;
    // 他用紙も仕上がり物理比率を維持したまま長辺1600pxで算出する（正式仕様6）。
    const isPortrait = trimHeightMm >= trimWidthMm;
    const finalHeightPx = isPortrait
      ? PRINT_JPG_LONG_SIDE_PX
      : Math.round((PRINT_JPG_LONG_SIDE_PX * trimHeightMm) / trimWidthMm);
    const finalWidthPx = isPortrait
      ? Math.round((PRINT_JPG_LONG_SIDE_PX * trimWidthMm) / trimHeightMm)
      : PRINT_JPG_LONG_SIDE_PX;
    return { pageWidthPx, pageHeightPx, cropRatio, finalWidthPx, finalHeightPx };
  };

  /**
   * 正式仕様: 印刷用紙presetのJPGはdpiではなく「アスペクト比維持・長辺
   * 1600px固定」。長辺1600pxは塗り足し込みのcapture surfaceではなく、
   * cropで塗り足しを除いた後の「仕上がり(trim)」比率で測る——capture
   * surfaceのcanonical px寸法を実測し、trim/bleed比（BLEED_MMベースの
   * 概算）を掛けて「cropした後にできるはずの」canonical px寸法へ変換
   * してから、既存のcomputePrintJpgPixelRatio（1600px/長辺）へ渡す。
   * ここは「captureする解像度をどれだけ確保するか」の見積りに過ぎず、
   * 実際のcrop位置・最終pxはresolvePrintJpgGeometryのTrimGuide実測が
   * 決める——多少の見積り誤差があっても、crop後の最終resizeで吸収される。
   * （Web閲覧用は既存どおりcanonical px外形をそのままscale=1で出力し、
   * この計算の対象外）。バッチ処理は文書全体で用紙サイズが共通なため、
   * 先頭の1要素を実測すれば全ページ分のscaleとして使い回せる。
   */
  const resolveJpgScale = (element: HTMLElement): number => {
    if (layout.paper.isPx) return 1;
    const { width, height } = measureCaptureSize(element);
    const bleedWidthMm = layout.paper.widthMm + BLEED_MM * 2;
    const bleedHeightMm = layout.paper.heightMm + BLEED_MM * 2;
    const trimEquivalentWidth = width * (layout.paper.widthMm / bleedWidthMm);
    const trimEquivalentHeight = height * (layout.paper.heightMm / bleedHeightMm);
    return computePrintJpgPixelRatio(trimEquivalentWidth, trimEquivalentHeight);
  };

  const handleExportJpg = async () => {
    if (pages.length === 0) return;
    let index: number;
    if (selected.size === 1) {
      index = Array.from(selected)[0];
    } else if (selected.size > 1) {
      // 複数選択中に最小番号ページを勝手に選ばない——1ページに絞ってもらう。
      alert("JPGは1ページ用です。\n1ページだけ選択してください。");
      return;
    } else {
      index = activePageIndex ?? 0;
    }
    const el = pageElementsRef.current.get(index);
    if (!el) return;
    setIsExporting(true);
    setExportLabel("画像");
    try {
      await exportPageToJpg(
        el,
        buildPageJpgFileName(title, index + 1),
        resolveJpgScale(el),
        resolvePrintJpgGeometry(el)
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "JPG書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJpgBatch = async () => {
    if (selected.size === 0) {
      alert("書き出すページを選択してください。");
      return;
    }
    const items = buildSelectedPageItems(getOrderedSelectedIndices());
    if (items.length === 0) return;
    setIsExporting(true);
    setExportLabel("画像");
    setExportProgress({ current: 0, total: items.length });
    try {
      await exportPagesAsIndividualJpgs(
        items,
        (current, total) => setExportProgress({ current, total }),
        resolveJpgScale(items[0].element),
        resolvePrintJpgGeometry(items[0].element)
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "JPG一括書き出しに失敗しました。");
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleExportZip = async () => {
    if (selected.size === 0) {
      alert("書き出すページを選択してください。");
      return;
    }
    const items = buildSelectedPageItems(getOrderedSelectedIndices());
    if (items.length === 0) return;
    setIsExporting(true);
    setExportLabel("画像");
    setExportProgress({ current: 0, total: items.length });
    try {
      await exportPagesToZip(
        items,
        buildZipFileName(title),
        (current, total) => setExportProgress({ current, total }),
        resolveJpgScale(items[0].element),
        resolvePrintJpgGeometry(items[0].element)
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
  const [pdfScope, setPdfScope] = useState<"all" | "selected">("all");

  const handleOpenPdfModal = () => {
    if (layout.paper.isPx) return; // Web閲覧用はPDF非対応（呼び出し元のUIでも選択不可にする）
    setIsPdfModalOpen(true);
  };

  const handleDownloadPdf = async () => {
    if (layout.paper.isPx) return;
    const indices = pdfScope === "all" ? pages.map((_, i) => i) : getOrderedSelectedIndices();
    if (pdfScope === "selected" && indices.length === 0) {
      alert("書き出すページを選択してください。");
      return;
    }
    if (pdfScope === "all") {
      // この警告は本全体（製本対象）の総ページ数の奇数/偶数を指す——選択ページ
      // だけを出力する場合は本全体の製本可否とは無関係になるため出さない。
      const totalPages = pages.length;
      if (totalPages % 2 !== 0) {
        const isConfirmed = window.confirm(
          `最終ページが奇数（全 ${totalPages} ページ）ですが大丈夫ですか？\n※冊子印刷では白ページの挿入が必要になる場合があります。`
        );
        if (!isConfirmed) {
          return; // 処理中断
        }
      }
    }
    const elements = indices
      .map((i) => pageElementsRef.current.get(i))
      .filter((el): el is HTMLDivElement => el != null);
    if (elements.length === 0) return;
    setIsExporting(true);
    setExportLabel("PDF");
    setExportProgress({ current: 0, total: elements.length });
    try {
      // PDFは正式仕様で常に印刷用紙preset・600dpi固定（Web閲覧用はUI側で
      // 選択不可のためここに到達しない）。
      await exportCustomPdf(elements, {
        mode: pdfMode,
        paperSizeName: layout.paper.label,
        bleed: BLEED_MM,
        fileName: buildPdfFileName(title, pdfMode, pdfScope),
        scale: pixelRatioForDpi(PDF_EXPORT_DPI),
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

  /**
   * 正式仕様: 「選択」checkboxはmodifier(Ctrl/Cmd/Shift)を一切見ず、常に
   * そのページ単独をtoggleする——checkbox操作とページ本体クリック
   * （handleToggleSelect、単一選択/Ctrl-Cmdトグル/Shift範囲選択を維持）を
   * 分離するための専用handler。スマホでmodifierキーを使えなくても、
   * 複数ページのcheckboxを順にONにしていくだけで積み上げ選択できる。
   */
  const handleToggleCheckbox = (index: number) => () => {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
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
    // ページ間dropの狙いやすさ改善: hover中のページ1枚だけ（event.currentTarget、
    // 他のページのrectは読まない）の横方向中点とpointerを比較し、「このページの
    // 前」か「後」かを決める。見開きは右綴じ(RTL)——displayGroupが並び替えている
    // 通り、DOM上は奇数(higher番号)ページが左、偶数(lower番号)ページが右に来る
    // ため、ページ自身の右半分は「番号が小さい方向＝前」、左半分は「番号が
    // 大きい方向＝後」に対応する。
    const rect = event.currentTarget.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const position: "before" | "after" = event.clientX > midX ? "before" : "after";
    setDropIndex(index);
    setDropPosition(position);
  };

  const handleDrop = (index: number) => (event: DragEvent) => {
    event.preventDefault();
    if (dragIndex === null) return;
    const movingSet = selected.has(dragIndex) ? selected : new Set([dragIndex]);
    // reorderByDragが期待する「この元indexの要素の直前に挿入」semanticsに
    // 合わせて、before/afterを単一の挿入位置へ変換する。関数本体は無変更。
    const insertionIndex = dropPosition === "after" ? index + 1 : index;
    const nextPages = reorderByDrag(pages, movingSet, insertionIndex);

    // Re-derive selection: which final positions hold the moved pages.
    const movedCount = movingSet.size;
    const restIndices = pages
      .map((_, i) => i)
      .filter((i) => !movingSet.has(i));
    let insertAt = restIndices.findIndex((i) => i >= insertionIndex);
    if (insertAt === -1) insertAt = restIndices.length;
    const nextSelected = new Set<number>();
    for (let k = 0; k < movedCount; k++) nextSelected.add(insertAt + k);

    applyReorder(nextPages, nextSelected);
    setDragIndex(null);
    setDropIndex(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropIndex(null);
    setDropPosition(null);
  };

  // Every image-editing operation below splices `content` (the sole source
  // of truth — see PreviewPane's `content` prop) directly, locating the
  // target marker via `findImageTokenRange` and replacing/inserting/
  // deleting only that marker's own span. None of them detokenize a whole
  // page's tokens: `pages[index].tokens` is pagination's display-oriented
  // token stream, which intentionally drops characters that don't
  // round-trip (e.g. a "\n" redundant with an auto-wrapped line — see
  // `paginateTokensByLines`), so rewriting a page from it would silently
  // eat unrelated newlines/ruby/【改ページ】 markers elsewhere on that page.
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
      // Appended at this page's own source-range end (before any trailing
      // 【改ページ】 marker, per `computePageSourceRanges`) — the same
      // insertion point the old tokens-append + detokenize approach
      // produced, just without reconstructing the rest of the page's text.
      const insertAt = pageSourceRanges[index].end;
      const marker = formatImageMarker({ type: "image", id, widthMm, heightMm, position: "center" });
      onContentChange(content.slice(0, insertAt) + marker + content.slice(insertAt));
    } catch (err) {
      alert(err instanceof Error ? err.message : "画像の挿入に失敗しました。");
    } finally {
      setInsertingImageIndex(null);
    }
  };

  // Images keep their own fixed widthMm/heightMm across paper/margin changes
  // — those numbers are the "基準配置サイズ" (base placement size), the
  // source of truth for the IMG marker, and are never rewritten by a paper
  // switch alone. When the current page's usable area is smaller than that
  // base size, PageCard scales the image down for *display only* (see
  // `getDisplayImageSize` in PageCard.tsx); switching back to a paper with
  // more room restores the original base size automatically since nothing
  // was ever persisted. This keeps paper-size round-trips byte-for-byte
  // reversible on the IMG marker / document content.
  const handleImagePositionChange = () => (imageId: string, position: ImagePosition) => {
    if (!onContentChange) return;
    const match = findImageTokenRange(content, imageId);
    if (!match) return;
    const marker = formatImageMarker({ ...match.token, position });
    onContentChange(content.slice(0, match.start) + marker + content.slice(match.end));
  };

  const handleImageDelete = () => (imageId: string) => {
    if (!onContentChange) return;
    const match = findImageTokenRange(content, imageId);
    if (!match) return;
    onContentChange(content.slice(0, match.start) + content.slice(match.end));
    onImageDelete?.(imageId);
  };

  // [TateSpun perf] layerOrderは(上記の挿絵handlerと違い)contentへ一切
  // 書き戻さない単純な委譲のため、他のhandlerのような`content`スプライスを
  // 持つローカルhandlerが存在しなかった。他callbackと同じくuseStableCallback
  // で安定化するには、ラップ対象のfunction参照自体が必要なため、ここに
  // 委譲するだけのローカルhandlerを追加する。
  const handleImageLayerChange = (updates: { id: string; layerOrder: number }[]) => {
    onImageLayerChange?.(updates);
  };

  const handleHideNombreChange = (pageNumber: number) => (hideNombre: boolean) => {
    if (!onSettingsChange) return;
    onSettingsChange({
      ...settings,
      pageOverrides: updatePageOverrides(settings.pageOverrides, [pageNumber], (prev) => ({
        ...prev,
        hideNombre,
      })),
    });
  };

  const handleHideHashiraChange = (pageNumber: number) => (hideHashira: boolean) => {
    if (!onSettingsChange) return;
    onSettingsChange({
      ...settings,
      pageOverrides: updatePageOverrides(settings.pageOverrides, [pageNumber], (prev) => ({
        ...prev,
        hideHashira,
      })),
    });
  };

  // [TateSpun perf] drag調査で判明: registerPageElementも上記と同じ
  // `(index) => (el) => {...}`のcurry factoryで、element ref propへ
  // `registerPageElement(index)`をそのまま渡していたため毎render新しい
  // ref callbackになり、365ページぶんのref detach(null呼び出し)/attach
  // (新callbackへの再登録)がdragover起因の再render毎に発生していた。
  // 他のindexed callbackと同じuseStableIndexedCallbackで包み、page index
  // ごとに参照を安定させる（登録先Map・attach/detachの意味は変更なし）。
  const stableRegisterPageElement = useStableIndexedCallback(registerPageElement);

  // [TateSpun perf] 上記の各handlerは毎render新規に作られるcurry関数の
  // ままにしておき（挙動の重複実装を避けるため本体は書き換えない）、
  // PageCardへ実際に渡す参照だけをuseStable(Indexed)Callbackで安定させる。
  // PageCard.tsx側のReact.memoコンパレータがcallback propsを参照比較する
  // ため、ここを安定させないと通常の1文字入力でも全PageCardのmemoが
  // 素通りしてしまう。
  const stableToggleSelect = useStableIndexedCallback(handleToggleSelect);
  const stableToggleCheckbox = useStableIndexedCallback(handleToggleCheckbox);
  const stableDragStart = useStableIndexedCallback(handleDragStart);
  const stableDragOver = useStableIndexedCallback(handleDragOver);
  const stableDrop = useStableIndexedCallback(handleDrop);
  const stableDragEnd = useStableCallback(handleDragEnd);
  const stableInsertImage = useStableIndexedCallback(handleInsertImage);
  const stableImagePositionChange = useStableCallback(handleImagePositionChange());
  const stableImageDelete = useStableCallback(handleImageDelete());
  const stableImageLayerChange = useStableCallback(handleImageLayerChange);
  const stableHideNombreChange = useStableIndexedCallback(handleHideNombreChange);
  const stableHideHashiraChange = useStableIndexedCallback(handleHideHashiraChange);

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
          <span className="relative flex flex-shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsExportMenuOpen((prev) => !prev)}
              disabled={isExporting || pages.length === 0}
              className="flex-shrink-0 whitespace-nowrap rounded border border-ink/20 px-2 py-1 text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isExporting && exportProgress
                ? `書き出し中 (${exportProgress.current}/${exportProgress.total})...`
                : "書き出し ▾"}
            </button>
            {isExportMenuOpen && (
              <>
                {/* 背景クリックでメニューを閉じるための透明オーバーレイ。既存のPDFモーダルと同じパターン。 */}
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsExportMenuOpen(false)}
                />
                <div className="absolute left-0 top-full z-50 mt-1 flex w-48 flex-col gap-0.5 rounded-lg border border-ink/10 bg-base p-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportJpg();
                    }}
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-ink/5"
                  >
                    JPG
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportJpgBatch();
                    }}
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-ink/5"
                  >
                    JPG一括（個別ダウンロード）
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleExportZip();
                    }}
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-ink/5"
                  >
                    JPG ZIP
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsExportMenuOpen(false);
                      handleOpenPdfModal();
                    }}
                    disabled={layout.paper.isPx}
                    title={
                      layout.paper.isPx
                        ? "PDF書き出しは印刷用の用紙サイズで利用できます。Web閲覧用はJPGで書き出してください。"
                        : undefined
                    }
                    className="rounded px-2 py-1.5 text-left text-xs hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    PDF
                  </button>
                  {layout.paper.isPx && (
                    <p className="px-2 pb-1 pt-0.5 text-[11px] leading-snug text-ink/50">
                      PDF書き出しは印刷用の用紙サイズで利用できます。
                      Web閲覧用はJPGで書き出してください。
                    </p>
                  )}
                </div>
              </>
            )}
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
              // `items-stretch` (the flexbox default, made explicit here)
              // makes both per-page wrapper columns in a spread exactly as
              // tall as the taller one — whichever page has the 挿絵
              // operation panel (divider + panel, 1+ wrapped lines) above
              // its `.page-card`. Each wrapper's own child (`<PageCard>`)
              // then inherits that same stretched height. Inside PageCard,
              // the normal toolbar row stays at the top of that height
              // (unchanged), while `.page-card` itself gets `margin-top:
              // auto` (see PageCard.tsx) — an auto margin absorbs *all*
              // leftover space above it, so it (and the page-number label
              // right after it) gets pushed down to the shared bottom of
              // the now-equal-height columns. Net effect: the normal
              // toolbar top-aligns between spread pages, while the paper
              // surface (`.page-card`) bottom- (and, when both sides are
              // equally tall, top-) aligns — instead of the whole wrapper
              // (toolbar included) shifting down together, which is what a
              // simple `items-end` on this row did before. A lone page in a
              // spread (page 1 + empty slot) is the row's only flex item,
              // so stretching is a no-op there — its height already *is*
              // the row's height, and its own `margin-top:auto` resolves
              // to 0 (no leftover space to absorb).
              className="flex flex-row items-stretch"
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
              {displayGroup.map((index) => {
                // isDropTarget算出をここで一度だけ行い、PageCardへ渡す
                // isDropTargetと、挿入ガイド用dropPositionの両方で使い回す
                // ——無関係なページ（dropIndex !== index）ではdropPositionが
                // 常にnullのままになるようにするのが目的（dragoverごとの
                // PageSlot props不変を保つため）。
                const isPageDropTarget = dropIndex === index && dragIndex !== index;
                return (
                  <PageSlot
                    key={index}
                    index={index}
                    registerRef={stableRegisterPageElement(index)}
                    page={pages[index]}
                    pageSignature={pageSignatures[index]}
                    startsNewParagraph={paragraphStarts[index]}
                    settings={settings}
                    layout={layout}
                    images={images}
                    imageLayerOrder={imageLayerOrder}
                    isSelected={selected.has(index)}
                    isDragging={dragIndex === index}
                    isDropTarget={isPageDropTarget}
                    dropPosition={isPageDropTarget ? dropPosition : null}
                    onToggleSelect={canReorder ? stableToggleSelect(index) : undefined}
                    onToggleCheckbox={canReorder ? stableToggleCheckbox(index) : undefined}
                    onDragStart={canReorder ? stableDragStart(index) : undefined}
                    onDragOver={canReorder ? stableDragOver(index) : undefined}
                    onDrop={canReorder ? stableDrop(index) : undefined}
                    onDragEnd={canReorder ? stableDragEnd : undefined}
                    onInsertImage={canReorder ? stableInsertImage(index) : undefined}
                    insertingImage={insertingImageIndex === index}
                    onImagePositionChange={canReorder ? stableImagePositionChange : undefined}
                    onImageDelete={canReorder ? stableImageDelete : undefined}
                    onImageLayerChange={canReorder ? stableImageLayerChange : undefined}
                    hideNombre={Boolean(settings.pageOverrides[index + 1]?.hideNombre)}
                    onHideNombreChange={
                      onSettingsChange ? stableHideNombreChange(index + 1) : undefined
                    }
                    hideHashira={Boolean(settings.pageOverrides[index + 1]?.hideHashira)}
                    onHideHashiraChange={
                      onSettingsChange ? stableHideHashiraChange(index + 1) : undefined
                    }
                    hashiraOverride={settings.pageOverrides[index + 1]?.hashiraOverride}
                    chromeScale={chromeScale}
                  />
                );
              })}
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
            <p className="mb-1 text-xs font-medium text-ink/70">対象</p>
            <div className="mb-3 flex flex-col gap-2">
              {(
                [
                  { value: "all", label: `全ページ（全 ${pages.length} ページ）` },
                  { value: "selected", label: `選択ページ（${selected.size} ページ選択中）` },
                ] as { value: "all" | "selected"; label: string }[]
              ).map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-2 rounded border border-ink/10 px-3 py-2 text-sm hover:bg-ink/5"
                >
                  <input
                    type="radio"
                    name="pdf-export-scope"
                    value={option.value}
                    checked={pdfScope === option.value}
                    onChange={() => setPdfScope(option.value)}
                    className="mt-0.5"
                  />
                  <span className="text-ink">{option.label}</span>
                </label>
              ))}
            </div>
            <p className="mb-1 text-xs font-medium text-ink/70">出力</p>
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
            {pdfScope === "selected" && selected.size === 0 && (
              <p className="mt-2 text-xs text-red-600">書き出すページを選択してください。</p>
            )}
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
                disabled={isExporting || (pdfScope === "selected" && selected.size === 0)}
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
