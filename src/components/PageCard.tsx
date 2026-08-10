import { Fragment, useRef, useState, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode } from "react";
import {
  computeParagraphStartFlags,
  tokenLength,
  type ImagePosition,
  type TategakiPage,
  type TategakiToken,
} from "@/lib/tategaki";
import { BLEED_MM, PX_PER_MM, type PageLayout, type PageSettings } from "@/lib/pageLayout";

// 会話文（かぎ括弧などで始まる段落）は一字下げを行わない、という組版慣行の
// 対象となる開き括弧類。地文の段落先頭にはここに含まれない場合のみ、
// 全角スペース1文字ぶんの字下げを描画時に補う（元テキストは変更しない）。
const OPENING_BRACKETS = "「『（〈《【〔［｛“‘";
const INDENT_SPACE = "　";

// 縦書きの行末で分断されると読みにくくなる、2文字以上連続するダッシュ
// （――）・三点リーダー（……）等を検出して改行させないためのパターン。
const NOWRAP_RUN_PATTERN = /([―—]{2,}|[…‥]{2,})/g;
const NOWRAP_RUN_TEST = /^(?:[―—]{2,}|[…‥]{2,})$/;

type ImageToken = Extract<TategakiToken, { type: "image" }>;
type FlowToken = Exclude<TategakiToken, { type: "image" }>;

const IMAGE_POSITION_LABELS: Record<ImagePosition, string> = {
  top: "天側（上部）",
  center: "中央",
  bottom: "地側（下部）",
  // "全体を表示": FullPageImage below uses objectFit:"contain", not "cover" —
  // this mode shows the whole image (letterboxed if needed), never crops it,
  // so the label should promise that rather than implying a crop-to-fill.
  full: "全体を表示",
};

interface PageCardProps {
  pageNumber: number;
  page: TategakiPage;
  /** Whether this page's first content token begins a genuine new paragraph (vs. a mid-sentence page break). Defaults to true. */
  startsNewParagraph?: boolean;
  settings: PageSettings;
  layout: PageLayout;
  images: Record<string, string>;
  /** Front/back stacking rank per image id (ImageRecord.layerOrder), independent of IMG marker/token order. */
  imageLayerOrder: Record<string, number>;
  selected?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onToggleSelect?: (event: MouseEvent) => void;
  onDragStart?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
  onInsertImage?: (file: File) => void;
  insertingImage?: boolean;
  onImagePositionChange?: (imageId: string, position: ImagePosition) => void;
  onImageDelete?: (imageId: string) => void;
  onImageLayerChange?: (updates: { id: string; layerOrder: number }[]) => void;
  hideNombre?: boolean;
  onHideNombreChange?: (hideNombre: boolean) => void;
  /**
   * Counter-scale for editor-only chrome (selection checkbox, insert-image/
   * hide-nombre controls, the "Nページ" caption) that sits as a sibling of
   * `.page-card`, not inside it. PreviewPane's ancestor `data-export-scale-root`
   * already applies `transform: scale(presentationScale)` to this whole
   * PageCard for the *paper surface's* benefit (so different paper presets'
   * wildly different canonical px magnitudes still read at a comparable
   * size) — but that same transform, left unchecked, shrinks/grows this
   * chrome by the exact same factor, which is what made it read as
   * illegibly tiny for presets whose canonical size forces a small
   * presentationScale (e.g. Web閲覧用's 768×1024). Passing
   * `1 / baseAutoFitScale` here (see PreviewPane.tsx) cancels exactly that
   * preset-dependent portion out of the chrome's rendered size while still
   * leaving it responsive to the user's manual zoom (userZoom), matching
   * how it already behaved for presets close to baseAutoFitScale≈1.
   * Defaults to 1 (no correction) so any caller that doesn't pass it keeps
   * today's behavior unchanged.
   */
  chromeScale?: number;
}

export default function PageCard({
  pageNumber,
  page,
  startsNewParagraph = true,
  settings,
  layout,
  images,
  imageLayerOrder,
  selected = false,
  isDragging = false,
  isDropTarget = false,
  onToggleSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onInsertImage,
  insertingImage = false,
  onImagePositionChange,
  onImageDelete,
  onImageLayerChange,
  hideNombre = false,
  onHideNombreChange,
  chromeScale = 1,
}: PageCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which of this page's inserted images the 挿絵 control bar below currently
  // operates on. UI-only (not persisted) — deliberately not lifted to
  // PreviewPane/document state, since a page's own image list already fully
  // determines what's selectable, and keeping it page-local means it's
  // trivially "cleaned up" for free (see the derivation below) whenever an
  // image is deleted or pagination moves images on/off this page, without a
  // separate effect to prune a stale id.
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const { paper } = layout;
  const { masterPage } = settings;

  // 右綴じ（縦書き）を前提とした物理的なページの左右:
  // 奇数(recto)ページは見開きの左側、偶数(verso)ページは右側に来る。
  const isOddPage = pageNumber % 2 === 1;
  const isFirstPage = pageNumber === 1;

  // isPx（Web閲覧用等）ページは印刷を想定しないため、塗り足し・仕上がり線を
  // 持たない。bleedMm を0にすることで、カード外形が paper.widthMm/heightMm
  // からPX_PER_MMで再乗算した値（例: 768×1024px）とぴったり一致する。
  const bleedMm = paper.isPx ? 0 : BLEED_MM;

  // 印刷用の塗り足し(3mm)を天地左右に確保するため、カード外形は仕上がり
  // サイズ(paper)より一回り大きく描画する。本文・柱・ノンブルは仕上がり線
  // (内側 bleedMm) を基準に配置したいので、各余白に bleedMm を足して
  // 仕上がり線からの距離を維持する。
  const sheetStyle: CSSProperties = {
    position: "relative",
    writingMode: "vertical-rl",
    WebkitWritingMode: "vertical-rl",
    textOrientation: "upright",
    WebkitTextOrientation: "upright",
    width: (paper.widthMm + bleedMm * 2) * PX_PER_MM,
    height: (paper.heightMm + bleedMm * 2) * PX_PER_MM,
    paddingTop: (settings.marginTop + bleedMm) * PX_PER_MM,
    paddingBottom: (settings.marginBottom + bleedMm) * PX_PER_MM,
    // ノド(gutter) always faces the spine at the center of a 見開き spread,
    // 小口(outer) always faces the book's outer edge. On a recto (odd, left
    // page of a 右綴じ spread) the spine is on the right, so gutter goes
    // right; on a verso (even, right page) the spine is on the left, so it
    // mirrors.
    paddingLeft: ((isOddPage ? settings.marginOuter : settings.marginGutter) + bleedMm) * PX_PER_MM,
    paddingRight: ((isOddPage ? settings.marginGutter : settings.marginOuter) + bleedMm) * PX_PER_MM,
  };

  // Font size must be scaled by the same PX_PER_MM factor as the page box
  // (sheetStyle above): the box's mm dimensions are drawn at a preview
  // scale, not true physical size, so rendering the font at its raw pt
  // size (true physical size) makes glyphs too large for the box and
  // overflows the page — hence the reported horizontal-scroll text overflow.
  const fontSizePx = layout.fontSizeMm * PX_PER_MM;
  const textAreaWidthPx = layout.textAreaWidthMm * PX_PER_MM;
  const textAreaHeightPx = layout.textAreaHeightMm * PX_PER_MM;
  const columnHeightPx = layout.columnHeightMm * PX_PER_MM;

  const isTwoColumn = settings.columnCount === 2;

  // 1行の高さ(px)に対し、指定した文字数がちょうど収まるよう文字間隔(letter-spacing)を
  // 均等配分する。満杯行（天〜地いっぱいまで文字が続く行）だけに適用し、
  // 地のラインへ正確に吸着させるための理論値。
  const computeMicroSpacingPx = (availableHeightPx: number, charCount: number): number => {
    const totalTextHeightPx = charCount * fontSizePx;
    const spaceDiffPx = Math.max(0, availableHeightPx - totalTextHeightPx);
    // 文字間の数（N文字ならN-1箇所）で割ることで、最終文字も含めて地のラインへ正確に吸着させる
    const gapCount = Math.max(1, charCount - 1);
    return charCount > 1 ? spaceDiffPx / gapCount : 0;
  };
  const microSpacingPx = computeMicroSpacingPx(textAreaHeightPx, layout.charsPerLine);
  const columnMicroSpacingPx = computeMicroSpacingPx(columnHeightPx, layout.charsPerLine);

  // 行が「（見た目上）満杯」かどうかは、行内トークン数ではなく実際に描画される
  // 可視文字セル数で判定する必要がある。text/ruby トークンは複数文字を1トー
  // クンにまとめて持つことがあり（例: value.slice(i, j)）、逆に tcy トークン
  // は2文字で1セル分しか占めないため、トークン数と文字セル数は一致しない。
  //
  // tategaki.ts の tokenLength() をそのまま使わないのは、"\n" を1セルとして
  // 数えてしまうため（pagination がその行末の \n 分の空きを charsPerLine
  // 予算へ正しく計上するのに必要な値であり、そちらの仕様は変更しない）。
  // しかし \n は TokenView で可視文字として描画されない（ゼロ幅スペースの
  // み）ため、字間補正の「見た目上埋まっているか」判定にはこの1セル分を
  // 含めてはならない。そのため PageCard 側だけで使う、可視セル数専用の
  // 計算をここに持つ。
  const lineVisualCellCount = (line: FlowToken[]): number =>
    line.reduce((sum, token) => {
      if (token.type === "text") {
        return sum + token.value.replace(/\n/g, "").length;
      }
      // ruby/tcy/pageBreak は \n を含み得ないので tokenLength() と同じ重みでよい
      return sum + tokenLength(token);
    }, 0);

  // 本文全体を囲むコンテナ。行境界の判定はここでは行わず（ブラウザの自動
  // 折り返しに委ねず）、tategaki.ts が確定した論理行を下記 lineStyle の
  // 行要素として個別に描画する。高さは許容バッファなしの厳密値。
  const textContainerStyle: CSSProperties = {
    whiteSpace: "pre-wrap",
    width: textAreaWidthPx,
    height: textAreaHeightPx,
    overflow: "hidden",
  };

  const lineStyle: CSSProperties = {
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    height: textAreaHeightPx,
    overflow: "hidden",
    fontSize: `${fontSizePx}px`,
    fontFamily: settings.fontFamily || "'Shippori Mincho', serif",
    lineHeight: settings.lineHeightRatio,
    color: "#000000",
    letterSpacing: "normal", // 短行・段落末尾は上詰め固定（既定ピッチのまま）
    // 縦書き・横書き双方のプロポーショナル詰め（vpal/vhal/palt/vkrn等）をすべて完全オフ
    fontFeatureSettings: '"vpal" 0, "vhal" 0, "palt" 0, "vkrn" 0, "pkna" 0',
    // 東アジア文字を完全全角に固定
    fontVariantEastAsian: "full-width",
    // 原稿用紙的な均等割り付け（行末・約物調整）
    textAlign: "justify", // 満杯行のみ均等割り付け
    textJustify: "inter-character", // 文字間均等割り
    textAlignLast: "start", // 改行で終わる短行（見出しや段落末尾）は上詰め固定
  };

  // 満杯行（charsPerLine いっぱいまで文字が続く行）だけ、天〜地の利用可能高さに
  // 対して文字間隔を均等配分し、地のラインまで正確に届かせる。
  const fullLineStyle: CSSProperties = { ...lineStyle, letterSpacing: `${microSpacingPx}px` };

  // 2段組: 1行の天地方向の長さは段（column）の高さ基準になる。
  const columnLineStyle: CSSProperties = { ...lineStyle, height: columnHeightPx };
  const fullColumnLineStyle: CSSProperties = {
    ...columnLineStyle,
    letterSpacing: `${columnMicroSpacingPx}px`,
  };

  // 扉・目次・奥付ページやユーザーがノンブル非表示に指定したページでは、
  // ノンブルだけでなく柱（作品名・章名の running header）も併せて隠すのが
  // 組版の慣例。隠しノンブル（製本用の極小表記）はこの抑制と独立して、
  // masterPage.showHiddenNombre の設定どおりに常時トグル連動して表示する。
  const isChromeSuppressed = hideNombre || (masterPage.hideNombreOnFirstPage && isFirstPage);

  const nombrePosition = masterPage.nombrePosition;
  const showNombre = nombrePosition !== "hidden" && !isChromeSuppressed;
  const nombreValue = masterPage.nombreStart + pageNumber - 1;

  const hashiraText = isOddPage ? masterPage.hashiraOdd : masterPage.hashiraEven;
  const showHashira = Boolean(hashiraText) && !isChromeSuppressed;

  const showWebFooter = settings.paperSize === "Web閲覧用";

  const isInteractive = Boolean(onToggleSelect);

  // 挿絵 tokens are page-level decorations positioned via 天/中央/地/ページ全体
  // rather than inline members of the text flow, so they're pulled out of
  // `page.tokens` here and rendered separately by position.
  const flowTokens = page.tokens.filter((token) => token.type !== "image");
  const paragraphStarts = computeParagraphStartFlags(flowTokens, startsNewParagraph);
  const imageTokens = page.tokens.filter((token): token is ImageToken => token.type === "image");
  // Falls back to the first image whenever `selectedImageId` doesn't match
  // any image actually on this page — covers "nothing explicitly selected
  // yet", "the selected image was just deleted", and "pagination moved the
  // selected image to a different page" alike, with no explicit reset effect
  // needed. With exactly one image this always resolves to that one image,
  // satisfying "1枚なら自動的にその画像を対象にする" for free.
  const selectedImage = imageTokens.find((token) => token.id === selectedImageId) ?? imageTokens[0];
  const fullImage = imageTokens.find((token) => token.position === "full");
  const topImages = imageTokens.filter((token) => token.position === "top");
  const centerImages = imageTokens.filter((token) => token.position === "center");
  const bottomImages = imageTokens.filter((token) => token.position === "bottom");
  const fullImages = imageTokens.filter((token) => token.position === "full");

  // The group of images that front/back layering moves `selectedImage`
  // within — always just the images sharing its own 天/中央/地/全体 position
  // on this same page, never a different page or a different position group.
  const groupForPosition = (position: ImagePosition): ImageToken[] => {
    switch (position) {
      case "top":
        return topImages;
      case "center":
        return centerImages;
      case "bottom":
        return bottomImages;
      case "full":
        return fullImages;
    }
  };
  const selectedLayerGroup = selectedImage
    ? orderedByLayer(groupForPosition(selectedImage.position), imageLayerOrder)
    : [];
  const selectedLayerIndex = selectedImage
    ? selectedLayerGroup.findIndex((token) => token.id === selectedImage.id)
    : -1;
  const isBackmost = selectedLayerIndex <= 0;
  const isFrontmost = selectedLayerIndex === selectedLayerGroup.length - 1;

  const handleLayerMove = (direction: "front" | "back") => {
    if (!selectedImage || !onImageLayerChange) return;
    const ordered = selectedLayerGroup;
    const fromIndex = selectedLayerIndex;
    const toIndex = direction === "front" ? fromIndex + 1 : fromIndex - 1;
    if (fromIndex === -1 || toIndex < 0 || toIndex >= ordered.length) return;
    const reordered = [...ordered];
    [reordered[fromIndex], reordered[toIndex]] = [reordered[toIndex], reordered[fromIndex]];
    onImageLayerChange(reordered.map((token, index) => ({ id: token.id, layerOrder: index })));
  };

  // Render-only fit bounds for 天/中央/地 images, matching the bounds used at
  // insertion time (see PreviewPane.tsx's handleInsertImage). token.widthMm/
  // heightMm are the image's fixed "基準配置サイズ" (base placement size) —
  // the source of truth persisted in the IMG marker — and are never mutated
  // here. `getDisplayImageSize` only ever shrinks for display when the
  // current page's usable area is smaller than that base size; switching to
  // a paper with more room again naturally displays the base size, with
  // nothing ever written back to content.
  const maxImageWidthMm = layout.textAreaWidthMm * 0.9;
  const maxImageHeightMm = layout.textAreaHeightMm * 0.6;

  // tategaki.ts が確定した論理行（各 <= charsPerLine 文字）をそのまま行要素
  // として描画する。ページ側で二重に linesPerPage/linesPerColumn を超えて
  // 切り詰めることで、想定行数を超える行要素自体が生成されないようにする。
  const flowLines = page.lines
    .map((line) => line.filter((token) => token.type !== "image"))
    .slice(0, layout.linesPerPage);

  // 2段組の上段・下段の行は tategaki.ts のページ分割ループが行単位で直接
  // 振り分け済み。ここでは挿絵トークンを取り除いて描画するだけでよく、
  // 独自に行の再計算を行う必要はない。
  const columnFlowLines = page.columnLines
    ? (page.columnLines.map((column) =>
        column
          .map((line) => line.filter((token) => token.type !== "image"))
          .slice(0, layout.linesPerColumn)
      ) as [FlowToken[][], FlowToken[][]])
    : null;

  // flowLines/columnFlowLines の各トークンを、paragraphStarts（flowTokens の
  // フラットな並びに対応するインデックス配列）へ対応づけるための行頭オフセット。
  // レンダー中の再代入を避けるため、JSX 構築前にここで一括計算しておく。
  let flowOffsetCursor = 0;
  const flowLineOffsets = flowLines.map((line) => {
    const start = flowOffsetCursor;
    flowOffsetCursor += line.length;
    return start;
  });

  let columnFlowOffsetCursor = 0;
  const columnFlowLineOffsets = columnFlowLines
    ? columnFlowLines.map((columnLines) =>
        columnLines.map((line) => {
          const start = columnFlowOffsetCursor;
          columnFlowOffsetCursor += line.length;
          return start;
        })
      )
    : null;

  return (
    <div
      className={`flex shrink-0 flex-col items-center gap-2 rounded-md p-1 transition-colors ${
        isDropTarget ? "bg-accent/10 ring-2 ring-accent" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      // Without an explicit width here, this flex-col's auto width would
      // normally just shrink-wrap to its widest child (`.page-card` below).
      // But its `w-full` toolbar/image-bar rows contain children with
      // `transform: scale(chromeScale)` — transform never affects layout
      // size, so those rows' own max-content width is computed from their
      // *pre*-scale (visually larger, when chromeScale<1) content. A
      // percentage width (`w-full`) inside an auto-sized container resolves
      // against that pre-scale content size instead of `.page-card`'s own
      // (post-scale) width, so this column silently grew wider than one
      // page — spilling the toolbar/image-bar into the neighboring page's
      // slot in a spread. Pinning width to the exact same canonical value
      // `.page-card` uses (`sheetStyle.width`, before the shared ancestor
      // `presentationScale` transform) makes every `w-full` row resolve
      // against the true one-page width, so `flex-wrap` wraps overflowing
      // controls onto more lines instead of growing the column sideways.
      style={{ width: sheetStyle.width }}
      draggable={isInteractive}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {isInteractive && (
        <div data-no-print="true" className="no-print flex w-full items-center justify-between px-1">
          <label
            className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/60"
            style={{ transform: `scale(${chromeScale})`, transformOrigin: "left center" }}
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              data-no-print="true"
              checked={selected}
              onChange={() => {}}
              onClick={onToggleSelect}
              className="no-print h-3.5 w-3.5 cursor-pointer accent-accent"
            />
            選択
          </label>
          <div
            className="flex items-center gap-2"
            style={{ transform: `scale(${chromeScale})`, transformOrigin: "right center" }}
          >
            {onHideNombreChange && (
              <label
                className="flex cursor-pointer items-center gap-1 text-[10px] text-ink/60"
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  data-no-print="true"
                  checked={hideNombre}
                  onChange={(event) => onHideNombreChange(event.target.checked)}
                  className="no-print h-3.5 w-3.5 cursor-pointer accent-accent"
                />
                ノンブル非表示
              </label>
            )}
            {onInsertImage && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  disabled={insertingImage}
                  className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] text-ink/60 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                  title="このページに画像を挿入"
                >
                  {insertingImage ? "PSDを変換中…" : "画像挿入"}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.psd"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onInsertImage(file);
                    event.target.value = "";
                  }}
                />
              </>
            )}
            <span className="cursor-grab select-none text-ink/40 active:cursor-grabbing" title="ドラッグで並べ替え">
              ⠿
            </span>
          </div>
        </div>
      )}
      {isInteractive && imageTokens.length > 0 && selectedImage && (
        <>
          {/* Separates the normal per-page toolbar above (選択/ノンブル非表示/画像挿入)
              from the 挿絵 operation panel below, so the two don't read as one
              blended control group. */}
          <div className="my-0.5 w-full border-t border-ink/10" aria-hidden="true" />
          <div
            className="flex flex-wrap items-end gap-x-2 gap-y-1.5 rounded-md border border-ink/10 bg-ink/5 px-1.5 py-1 text-[10px] text-ink/60"
            style={{
              // `width:100%` would resolve against the (fixed-width, see the
              // root wrapper's own `style` above) parent — one page's width —
              // *before* `zoom` below is applied. Budgeting the pre-zoom
              // width as pageWidth/chromeScale means the zoomed result always
              // lands back at exactly one page's width, whether chromeScale
              // shrinks (<1) or enlarges (>1) it, so wrapped/enlarged content
              // never spills into a neighboring page.
              //
              // This uses CSS `zoom`, not `transform: scale()`: transform
              // never affects layout size, so when this panel's content
              // wraps onto a 2nd line (e.g. all 8 controls at once on a
              // narrow budget), a transform-scaled box's *painted* height
              // still only reserves its *pre*-scale (1-line) height in the
              // surrounding flex-col flow — the enlarged 2nd line then
              // visually overlaps and paints underneath `.page-card`'s own
              // opaque background right below it, making the wrapped
              // controls invisible even though they exist in the DOM. `zoom`
              // scales layout size too, so however many lines this panel
              // wraps onto, the right amount of vertical space is reserved
              // and every control stays visible.
              width: (sheetStyle.width as number) / (chromeScale || 1),
              zoom: chromeScale,
            }}
            onClick={(event) => event.stopPropagation()}
            draggable={false}
            onDragStart={(event) => event.stopPropagation()}
          >
            <div className="flex items-end gap-1.5">
              <span className="shrink-0">挿絵</span>
              {imageTokens.length > 1 && (
                <select
                  value={selectedImage.id}
                  onChange={(event) => setSelectedImageId(event.target.value)}
                  className="rounded border border-ink/20 bg-transparent px-1 py-0.5 text-[10px]"
                  title="操作対象の画像を選択"
                >
                  {imageTokens.map((token, index) => (
                    <option key={token.id} value={token.id}>
                      {index + 1}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex items-end gap-1.5">
              {(Object.keys(IMAGE_POSITION_LABELS) as ImagePosition[]).map((position) => (
                <button
                  key={position}
                  type="button"
                  onClick={() => onImagePositionChange?.(selectedImage.id, position)}
                  className={`rounded border px-1.5 py-0.5 text-[10px] ${
                    selectedImage.position === position
                      ? "border-accent bg-accent text-paper-ink"
                      : "border-ink/20 text-ink/60 hover:bg-ink/5"
                  }`}
                >
                  {IMAGE_POSITION_LABELS[position]}
                </button>
              ))}
            </div>
            <div className="flex items-end gap-1.5">
              {imageTokens.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => handleLayerMove("back")}
                    disabled={isBackmost}
                    className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] text-ink/60 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                    title="背面へ"
                    aria-label="背面へ"
                  >
                    背面へ
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLayerMove("front")}
                    disabled={isFrontmost}
                    className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] text-ink/60 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
                    title="前面へ"
                    aria-label="前面へ"
                  >
                    前面へ
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("この画像を削除しますか？この操作は取り消せません。")) {
                    onImageDelete?.(selectedImage.id);
                  }
                }}
                className="rounded border border-ink/20 px-1 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10"
                title="この画像を削除"
              >
                削除
              </button>
            </div>
          </div>
        </>
      )}
      <div
        data-page-card="true"
        // isPx (Web閲覧用) pages author their outer size directly in target
        // *screen* px (768×1024) — exportCapture.ts reads this to decide
        // whether it must capture at the element's true outer (border
        // included) size rather than its content-box size; see the comment
        // there for why that distinction matters only for isPx pages.
        data-is-px-page={paper.isPx ? "true" : undefined}
        className={`page-card shrink-0 overflow-hidden border bg-paper shadow-md dark:shadow-[0_0_0_1px_rgba(170,180,212,0.15),0_12px_36px_-8px_rgba(0,0,0,0.85)] ${
          selected
            ? "border-accent ring-2 ring-accent dark:border-accent"
            : "border-gray-200 dark:border-gray-700"
        }`}
        // `marginTop: "auto"` on a flex-col child absorbs *all* leftover
        // vertical space above it. PreviewPane's spread row now stretches
        // both per-page columns to equal height (see its own comment) — the
        // normal toolbar row (and, when present, the 挿絵 panel) stay at
        // this column's top at their natural height, and this auto margin
        // pushes `.page-card` (plus the page-number label right after it,
        // via the existing `gap-2`) down to the column's bottom. When both
        // spread pages have the same toolbar/panel height (including the
        // common case of neither having a panel), there's no leftover space
        // and this resolves to 0 — a no-op, matching prior behavior.
        style={{ ...sheetStyle, marginTop: "auto" }}
      >
        {fullImage ? (
          <FullPageImage token={fullImage} images={images} />
        ) : (
          <>
            {isTwoColumn && columnFlowLines && flowTokens.length > 0 ? (
              <div
                style={{
                  width: textAreaWidthPx,
                  height: textAreaHeightPx,
                  overflow: "hidden",
                  writingMode: "horizontal-tb",
                }}
              >
                <div
                  className="w-full h-full flex flex-col"
                  style={{
                    gap: `${settings.columnGapMm * PX_PER_MM}px`,
                    writingMode: "horizontal-tb",
                  }}
                >
                  {columnFlowLines.map((columnLines, segmentIndex) => (
                    <div
                      key={segmentIndex}
                      className="w-full flex-1 min-h-0 overflow-hidden"
                      style={{
                        height: `calc((100% - ${settings.columnGapMm * PX_PER_MM}px) / 2)`,
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                      }}
                    >
                      {columnLines.map((line, lineIndex) => {
                        const isFullLine = lineVisualCellCount(line) === layout.charsPerLine;
                        return (
                          <div
                            key={lineIndex}
                            className="tategaki-line"
                            style={isFullLine ? fullColumnLineStyle : columnLineStyle}
                          >
                            {line.map((token, tokenIndex) => {
                              const flatIndex = columnFlowLineOffsets![segmentIndex][lineIndex] + tokenIndex;
                              return (
                                <TokenView key={flatIndex} token={token} indent={paragraphStarts[flatIndex]} />
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={textContainerStyle}>
                {flowTokens.length === 0 ? (
                  <span className="text-paper-ink/40">
                    （本文を入力すると、ここに縦書きで表示されます）
                  </span>
                ) : (
                  flowLines.map((line, lineIndex) => {
                    const isFullLine = lineVisualCellCount(line) === layout.charsPerLine;
                    return (
                      <div
                        key={lineIndex}
                        className="tategaki-line"
                        style={isFullLine ? fullLineStyle : lineStyle}
                      >
                        {line.map((token, tokenIndex) => {
                          const flatIndex = flowLineOffsets[lineIndex] + tokenIndex;
                          return (
                            <TokenView key={flatIndex} token={token} indent={paragraphStarts[flatIndex]} />
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {topImages.length > 0 && (
              <ImagePositionOverlay
                tokens={topImages}
                images={images}
                position="top"
                maxWidthMm={maxImageWidthMm}
                maxHeightMm={maxImageHeightMm}
                imageLayerOrder={imageLayerOrder}
              />
            )}
            {centerImages.length > 0 && (
              <ImagePositionOverlay
                tokens={centerImages}
                images={images}
                position="center"
                maxWidthMm={maxImageWidthMm}
                maxHeightMm={maxImageHeightMm}
                imageLayerOrder={imageLayerOrder}
              />
            )}
            {bottomImages.length > 0 && (
              <ImagePositionOverlay
                tokens={bottomImages}
                images={images}
                position="bottom"
                maxWidthMm={maxImageWidthMm}
                maxHeightMm={maxImageHeightMm}
                imageLayerOrder={imageLayerOrder}
              />
            )}
          </>
        )}

        {showHashira && (
          <HashiraOverlay
            text={hashiraText}
            position={masterPage.hashiraPosition}
            marginMm={
              masterPage.hashiraPosition === "top"
                ? settings.marginTop
                : settings.marginBottom
            }
            isOddPage={isOddPage}
            insetLeftPx={sheetStyle.paddingLeft as number}
            insetRightPx={sheetStyle.paddingRight as number}
            fontFamily={lineStyle.fontFamily as string}
            fontSize={masterPage.headerFontSize}
            bleedMm={bleedMm}
          />
        )}

        {showNombre && (
          <NombreOverlay
            value={nombreValue}
            // Web閲覧用はフッターが右寄りに表示されるため、ノンブルが重ならないよう
            // 綴じ側/小口側の慣例より優先して左下固定にする。
            position={showWebFooter ? "left" : (nombrePosition as "center" | "gutter" | "outer")}
            isOddPage={isOddPage}
            bottomMarginMm={masterPage.nombreBottomMargin}
            fontSize={masterPage.nombreFontSize}
            bleedMm={bleedMm}
          />
        )}

        {masterPage.showHiddenNombre && (
          <HiddenNombreOverlay value={nombreValue} isOddPage={isOddPage} bleedMm={bleedMm} />
        )}

        {showWebFooter && <WebFooterOverlay bodyFontSizePx={fontSizePx} />}

        {!paper.isPx && <TrimGuide />}
      </div>
      <span
        className="text-xs text-ink/60"
        style={{ transform: `scale(${chromeScale})`, transformOrigin: "center top" }}
      >
        {pageNumber} ページ
      </span>
    </div>
  );
}

/** 仕上がり線（断ち落としガイド）: 塗り足し(BLEED_MM)の内側境界を示す点線枠。 */
function TrimGuide() {
  const style: CSSProperties = {
    position: "absolute",
    top: BLEED_MM * PX_PER_MM,
    bottom: BLEED_MM * PX_PER_MM,
    left: BLEED_MM * PX_PER_MM,
    right: BLEED_MM * PX_PER_MM,
    border: "1px dashed #A0A0A0",
    pointerEvents: "none",
  };

  return <div data-bleed-guide="true" className="border-dashed" style={style} />;
}

function NombreOverlay({
  value,
  position,
  isOddPage,
  bottomMarginMm,
  fontSize,
  bleedMm,
}: {
  value: number;
  position: "center" | "gutter" | "outer" | "left";
  isOddPage: boolean;
  bottomMarginMm: number;
  fontSize?: number;
  bleedMm: number;
}) {
  // Web閲覧用のノンブルは左下に固定表示する。
  if (position === "left") {
    const webStyle: CSSProperties = {
      position: "absolute",
      left: "16px",
      bottom: "15px",
      writingMode: "horizontal-tb",
      color: "#000000",
      fontSize: `${fontSize ?? 8}pt`,
    };

    return (
      <div style={webStyle} className="pointer-events-none select-none">
        {value}
      </div>
    );
  }

  // ノド(綴じ側): 奇数ページ(左)は右寄せ、偶数ページ(右)は左寄せ。
  // 小口(外側): 奇数ページ(左)は左寄せ、偶数ページ(右)は右寄せ。
  const justifyContent =
    position === "center"
      ? "center"
      : position === "gutter"
        ? isOddPage
          ? "flex-end"
          : "flex-start"
        : isOddPage
          ? "flex-start"
          : "flex-end";

  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: (bottomMarginMm + bleedMm) * PX_PER_MM,
    display: "flex",
    alignItems: "center",
    justifyContent,
    writingMode: "horizontal-tb",
    padding: `0 ${2 * PX_PER_MM}px`,
    color: "#000000",
    fontSize: `${fontSize ?? 8}pt`,
  };

  return (
    <div style={style} className="pointer-events-none select-none">
      {value}
    </div>
  );
}

/**
 * 隠しノンブル: 表示・非表示設定に関わらず、製本時の突き合わせ用にノド側の
 * 断ち切り境界付近（余白の外側端）へ小さく薄く常時焼き込む慣行的な表示。
 */
function HiddenNombreOverlay({
  value,
  isOddPage,
  bleedMm,
}: {
  value: number;
  isOddPage: boolean;
  bleedMm: number;
}) {
  // ノドは奇数ページ(左)では右端、偶数ページ(右)では左端に来る。
  const style: CSSProperties = {
    position: "absolute",
    top: "50%",
    transform: "translateY(-50%)",
    left: isOddPage ? undefined : bleedMm * PX_PER_MM,
    right: isOddPage ? bleedMm * PX_PER_MM : undefined,
    writingMode: "vertical-rl",
    WebkitWritingMode: "vertical-rl",
    textOrientation: "upright",
    WebkitTextOrientation: "upright",
    color: "#000000",
    fontSize: "6pt",
    letterSpacing: "1px",
    padding: `${1 * PX_PER_MM}px`,
  };

  return (
    <div style={style} className="pointer-events-none select-none">
      {value}
    </div>
  );
}

/** Web閲覧用ページ下部に表示するTateSpunロゴ・サイト情報フッター。 */
function WebFooterOverlay({ bodyFontSizePx }: { bodyFontSizePx: number }) {
  // 親のsheetStyleが writingMode: vertical-rl を敷いているため、ここで
  // horizontal-tb に強制解除しないとロゴ・文字列が縦書きに巻き込まれて崩れる。
  const containerStyle: CSSProperties = {
    position: "absolute",
    bottom: "15px",
    left: 0,
    width: "100%",
    writingMode: "horizontal-tb",
  };

  const dividerStyle: CSSProperties = {
    borderTop: "1px solid #333",
    width: "100%",
  };

  // このfooterは紙面（export対象）の一部なので、editor chrome（chromeScale）
  // のようにscreen-space固定にはしない——canonical DOM上でpaperと一緒に
  // scaleされる、という既存の挙動はそのまま。ただし固定"9.5px"は、Web閲覧用の
  // 本文フォントがまだ16ptだった頃の値がそのまま残ったもので、本文フォント比
  // 約76%（9.5÷12.42px）で釣り合っていた。今回の正式preset化で本文が36pt
  // （27.9px canonical）へ拡大された一方、この9.5pxだけ取り残されたため、
  // 本文に対して比率にして約1/3まで縮んで見えていた。本文フォントに対する
  // 比率で算出し直すことで、以後どの本文サイズでも同じ見えの強さを保つ。
  const FOOTER_TO_BODY_FONT_RATIO = 0.75;
  const footerFontSizePx = bodyFontSizePx * FOOTER_TO_BODY_FONT_RATIO;

  const contentStyle: CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "6px",
    paddingTop: "4px",
    paddingBottom: "6px",
    paddingLeft: "48px",
    paddingRight: "16px",
    whiteSpace: "nowrap",
    writingMode: "horizontal-tb",
    fontFamily: '"Shippori Mincho", serif',
    fontSize: `${footerFontSizePx}px`,
    color: "#888",
  };

  return (
    <div style={containerStyle} className="pointer-events-none select-none">
      <div style={dividerStyle} />
      <div style={contentStyle}>
        <img
          src="/caroad_main2.png"
          alt="logo"
          data-logo-img="true"
          className="footer-logo"
          style={{ width: "12px", height: "12px", objectFit: "contain" }}
        />
        <span>TateSpun</span>
        <span>https://tatespun.pages.dev/</span>
        <span>#スパンテイル</span>
      </div>
    </div>
  );
}

function HashiraOverlay({
  text,
  position,
  marginMm,
  isOddPage,
  insetLeftPx,
  insetRightPx,
  fontFamily,
  fontSize,
  bleedMm,
}: {
  text: string;
  position: "top" | "bottom";
  marginMm: number;
  isOddPage: boolean;
  insetLeftPx: number;
  insetRightPx: number;
  fontFamily: string;
  fontSize?: number;
  bleedMm: number;
}) {
  // 柱のコンテナは本文領域(小口境界)と同じ左右インセットを持たせ、
  // 小口側の端に文字が吸着するようテキスト側で text-align を指定する。
  const style: CSSProperties = {
    position: "absolute",
    left: insetLeftPx,
    right: insetRightPx,
    top: position === "top" ? bleedMm * PX_PER_MM : undefined,
    bottom: position === "bottom" ? bleedMm * PX_PER_MM : undefined,
    height: marginMm * PX_PER_MM,
    display: "flex",
    alignItems: "center",
    writingMode: "horizontal-tb",
    color: "#000000",
    fontFamily,
    fontSize: `${fontSize ?? 8}pt`,
  };

  const textStyle: CSSProperties = isOddPage
    ? { textAlign: "right", width: "100%" }
    : { textAlign: "left", width: "100%" };

  return (
    <div style={style} className="pointer-events-none select-none">
      <div style={textStyle}>{text}</div>
    </div>
  );
}

/** First visible character of a token, used to detect 会話文（かぎ括弧など始まり）for the indent exemption. */
function firstVisibleChar(token: Exclude<TategakiToken, { type: "image" }>): string {
  if (token.type === "ruby") return token.base.charAt(0);
  if (token.type === "pageBreak") return "";
  return token.value.charAt(0);
}

function TokenView({
  token,
  indent,
}: {
  token: Exclude<TategakiToken, { type: "image" }>;
  indent: boolean;
}) {
  const prefix = indent && OPENING_BRACKETS.includes(firstVisibleChar(token)) ? INDENT_SPACE : "";

  if (token.type === "ruby") {
    return (
      <>
        {prefix}
        <ruby>
          {token.base}
          <rt>{token.rt}</rt>
        </ruby>
      </>
    );
  }
  if (token.type === "tcy") {
    return (
      <>
        {prefix}
        <span style={{ textCombineUpright: "all" }}>{token.value}</span>
      </>
    );
  }
  if (token.type === "pageBreak") {
    return null;
  }
  // paginateTokensByLines はユーザー入力の \n を「行の区切り」として currentLine
  // に積んだ直後に breakLine() している（＝この \n トークンの直後で必ず新しい
  // tategaki-line <div> が始まる）。行境界そのものは既にその div 分割によって
  // 表現済みなので、\n をそのまま文字として描画すると、pre-wrap の tategaki-line
  // 内でブラウザがもう一度改行と解釈し、余分な空の行（空列）が生まれてしまう。
  // そのため \n トークンは可視の改行文字としては描画しない。
  // ただし、段落間の空行（"\n\n"）では2つ目の \n がその行唯一のトークンになり、
  // 中身を完全に空にすると tategaki-line の height(auto) は行ボックスを持たず
  // 0幅に潰れてしまう（＝段落間の空列が消える）。ゼロ幅スペースを描画すること
  // で、可視の空白や二重改行を発生させずに1行分の行ボックス（line-height分の
  // 段の厚み）だけを確保する。
  return (
    <>
      {prefix}
      {token.value === "\n" ? "​" : renderNowrapProtected(token.value)}
    </>
  );
}

/**
 * Wraps 2+ character runs of ――（ダッシュ）/ ……（三点リーダー）in a
 * `white-space: nowrap` inline-block so the vertical-writing line wrap never
 * splits a single dash/leader off onto the next line by itself.
 */
function renderNowrapProtected(value: string): ReactNode {
  const parts = value.split(NOWRAP_RUN_PATTERN);
  if (parts.length <= 1) return value;
  return parts.map((part, index) =>
    NOWRAP_RUN_TEST.test(part) ? (
      <span key={index} style={{ whiteSpace: "nowrap", display: "inline-block" }}>
        {part}
      </span>
    ) : (
      <Fragment key={index}>{part}</Fragment>
    )
  );
}

// Sorts a same-page/same-position group of images back-to-front for layer
// stacking: images with an explicit `layerOrder` (see lib/db.ts's
// ImageRecord.layerOrder, set only by handleLayerMove below) sort by that
// value; images that have never been layer-reordered fall back to their
// position within `tokens` (i.e. document/token order — the pre-existing
// behavior), so a page with no layering activity renders exactly as before.
// Never reads or writes IMG marker/content — purely a display-order helper.
function orderedByLayer(tokens: ImageToken[], layerOrder: Record<string, number>): ImageToken[] {
  return tokens
    .map((token, index) => ({ token, key: layerOrder[token.id] ?? index }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.token);
}

// Computes the render-only display size for a 天/中央/地 image: shrinks
// (never enlarges — `Math.min(1, …)`) the image's fixed base widthMm/
// heightMm to fit within the current page's usable area, using one shared
// scale factor for both dimensions so aspect ratio can never drift. The
// result is never written back to the token/content — it exists purely for
// this render. When there's no usable-area constraint (or the base size is
// degenerate), the base size itself is returned unchanged.
function getDisplayImageSize(
  token: ImageToken,
  maxWidthMm: number,
  maxHeightMm: number
): { widthMm: number; heightMm: number } {
  if (maxWidthMm <= 0 || maxHeightMm <= 0 || token.widthMm <= 0 || token.heightMm <= 0) {
    return { widthMm: token.widthMm, heightMm: token.heightMm };
  }
  const displayScale = Math.min(1, maxWidthMm / token.widthMm, maxHeightMm / token.heightMm);
  return { widthMm: token.widthMm * displayScale, heightMm: token.heightMm * displayScale };
}

/** Renders 挿絵 anchored to 天 (top) / 中央 (center) / 地 (bottom) of the page. */
function ImagePositionOverlay({
  tokens,
  images,
  position,
  maxWidthMm,
  maxHeightMm,
  imageLayerOrder,
}: {
  tokens: ImageToken[];
  images: Record<string, string>;
  position: "top" | "center" | "bottom";
  maxWidthMm: number;
  maxHeightMm: number;
  imageLayerOrder: Record<string, number>;
}) {
  // `tokens` keeps its original (document/token) order here so the flex-wrap
  // left-to-right layout position of each image is never affected by
  // layering — only paint/stacking order (via z-index below) reflects
  // front/back moves. Flex items honor z-index directly (no `position`
  // needed on the child), so images that visually overlap stack according
  // to their layer rank while non-overlapping images keep their normal
  // left-to-right placement.
  const layerRank = new Map(orderedByLayer(tokens, imageLayerOrder).map((token, index) => [token.id, index]));
  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: position === "bottom" ? undefined : position === "center" ? "50%" : 0,
    bottom: position === "bottom" ? 0 : undefined,
    transform: position === "center" ? "translateY(-50%)" : undefined,
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: position === "bottom" ? "flex-end" : "flex-start",
    gap: 4 * PX_PER_MM,
    writingMode: "horizontal-tb",
    pointerEvents: "none",
  };

  return (
    <div style={style}>
      {tokens.map((token) => {
        const src = images[token.id];
        if (!src) return null;
        const { widthMm, heightMm } = getDisplayImageSize(token, maxWidthMm, maxHeightMm);
        return (
          <img
            key={token.id}
            src={src}
            alt=""
            style={{
              width: widthMm * PX_PER_MM,
              height: heightMm * PX_PER_MM,
              zIndex: layerRank.get(token.id),
              filter: "grayscale(100%)",
            }}
          />
        );
      })}
    </div>
  );
}

/** Renders a single 挿絵 that spans the entire page (ページ全体). */
function FullPageImage({ token, images }: { token: ImageToken; images: Record<string, string> }) {
  const src = images[token.id];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        // "全体を表示" means the whole image stays visible, aspect ratio
        // intact — "cover" (crop-to-fill) used to make the visible crop
        // change with every paper preset's own width:height ratio, which
        // read as the image itself distorting when switching papers even
        // though no pixel was ever actually stretched. "contain" letterboxes
        // instead of cropping, so switching papers only ever changes how
        // much of `.page-card`'s own background shows around the image, not
        // what part of the image itself is visible. `.page-card`'s existing
        // background (no override here) shows through the letterbox area.
        objectFit: "contain",
        filter: "grayscale(100%)",
      }}
    />
  );
}
