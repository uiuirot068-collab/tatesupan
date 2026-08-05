import { useRef, type CSSProperties, type DragEvent, type MouseEvent } from "react";
import type { ImagePosition, TategakiToken } from "@/lib/tategaki";
import { PX_PER_MM, type PageLayout, type PageSettings } from "@/lib/pageLayout";

type ImageToken = Extract<TategakiToken, { type: "image" }>;

const IMAGE_POSITION_LABELS: Record<ImagePosition, string> = {
  top: "天側（上部）",
  center: "中央",
  bottom: "地側（下部）",
  full: "ページ全体",
};

interface PageCardProps {
  pageNumber: number;
  tokens: TategakiToken[];
  settings: PageSettings;
  layout: PageLayout;
  images: Record<string, string>;
  selected?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onToggleSelect?: (event: MouseEvent) => void;
  onDragStart?: (event: DragEvent) => void;
  onDragOver?: (event: DragEvent) => void;
  onDrop?: (event: DragEvent) => void;
  onDragEnd?: (event: DragEvent) => void;
  onInsertImage?: (file: File) => void;
  onImagePositionChange?: (imageId: string, position: ImagePosition) => void;
  onImageDelete?: (imageId: string) => void;
}

export default function PageCard({
  pageNumber,
  tokens,
  settings,
  layout,
  images,
  selected = false,
  isDragging = false,
  isDropTarget = false,
  onToggleSelect,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onInsertImage,
  onImagePositionChange,
  onImageDelete,
}: PageCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { paper } = layout;
  const { masterPage } = settings;

  // 右綴じ（縦書き）を前提とした物理的なページの左右:
  // 奇数(recto)ページは見開きの左側、偶数(verso)ページは右側に来る。
  const isOddPage = pageNumber % 2 === 1;
  const isFirstPage = pageNumber === 1;

  const sheetStyle: CSSProperties = {
    position: "relative",
    writingMode: "vertical-rl",
    width: paper.widthMm * PX_PER_MM,
    height: paper.heightMm * PX_PER_MM,
    paddingTop: settings.marginTop * PX_PER_MM,
    paddingBottom: settings.marginBottom * PX_PER_MM,
    // ノド(gutter) always faces the spine at the center of a 見開き spread,
    // 小口(outer) always faces the book's outer edge. On a recto (odd, left
    // page of a 右綴じ spread) the spine is on the right, so gutter goes
    // right; on a verso (even, right page) the spine is on the left, so it
    // mirrors.
    paddingLeft: (isOddPage ? settings.marginOuter : settings.marginGutter) * PX_PER_MM,
    paddingRight: (isOddPage ? settings.marginGutter : settings.marginOuter) * PX_PER_MM,
  };

  // Font size must be scaled by the same PX_PER_MM factor as the page box
  // (sheetStyle above): the box's mm dimensions are drawn at a preview
  // scale, not true physical size, so rendering the font at its raw pt
  // size (true physical size) makes glyphs too large for the box and
  // overflows the page — hence the reported horizontal-scroll text overflow.
  const fontSizePx = layout.fontSizeMm * PX_PER_MM;
  const textAreaWidthPx = layout.textAreaWidthMm * PX_PER_MM;
  const textAreaHeightPx = layout.textAreaHeightMm * PX_PER_MM;

  const textStyle: CSSProperties = {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    width: textAreaWidthPx,
    height: textAreaHeightPx,
    overflow: "hidden",
    fontSize: `${fontSizePx}px`,
    lineHeight: settings.lineHeightRatio,
    ...(settings.columnCount === 2
      ? {
          columnCount: 2,
          columnGap: `${settings.columnGapMm * PX_PER_MM}px`,
          columnFill: "auto",
        }
      : {}),
  };

  const nombrePosition = masterPage.nombrePosition;
  const showNombre =
    nombrePosition !== "hidden" &&
    !(masterPage.hideNombreOnFirstPage && isFirstPage);
  const nombreValue = masterPage.nombreStart + pageNumber - 1;

  const hashiraText = isOddPage ? masterPage.hashiraOdd : masterPage.hashiraEven;

  const isInteractive = Boolean(onToggleSelect);

  // 挿絵 tokens are page-level decorations positioned via 天/中央/地/ページ全体
  // rather than inline members of the text flow, so they're pulled out of
  // `tokens` here and rendered separately by position.
  const flowTokens = tokens.filter((token) => token.type !== "image");
  const imageTokens = tokens.filter((token): token is ImageToken => token.type === "image");
  const fullImage = imageTokens.find((token) => token.position === "full");
  const topImages = imageTokens.filter((token) => token.position === "top");
  const centerImages = imageTokens.filter((token) => token.position === "center");
  const bottomImages = imageTokens.filter((token) => token.position === "bottom");

  return (
    <div
      className={`flex shrink-0 flex-col items-center gap-2 rounded-md p-1 transition-colors ${
        isDropTarget ? "bg-accent/10 ring-2 ring-accent" : ""
      } ${isDragging ? "opacity-40" : ""}`}
      draggable={isInteractive}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {isInteractive && (
        <div className="flex w-full items-center justify-between px-1">
          <label
            className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/60"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={selected}
              onChange={() => {}}
              onClick={onToggleSelect}
              className="h-3.5 w-3.5 cursor-pointer accent-accent"
            />
            選択
          </label>
          <div className="flex items-center gap-2">
            {onInsertImage && (
              <>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  className="rounded border border-ink/20 px-1.5 py-0.5 text-[10px] text-ink/60 hover:bg-ink/5"
                  title="このページに画像を挿入"
                >
                  画像挿入
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
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
      {isInteractive && imageTokens.length > 0 && (
        <div className="flex w-full flex-col gap-1 px-1" onClick={(event) => event.stopPropagation()}>
          {imageTokens.map((token) => (
            <div
              key={token.id}
              className="flex items-center gap-1.5 text-[10px] text-ink/60"
              draggable={false}
              onDragStart={(event) => event.stopPropagation()}
            >
              <span className="shrink-0">挿絵</span>
              <select
                value={token.position}
                onChange={(event) =>
                  onImagePositionChange?.(token.id, event.target.value as ImagePosition)
                }
                className="rounded border border-ink/20 bg-transparent px-1 py-0.5 text-[10px]"
              >
                {(Object.keys(IMAGE_POSITION_LABELS) as ImagePosition[]).map((position) => (
                  <option key={position} value={position}>
                    {IMAGE_POSITION_LABELS[position]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onImageDelete?.(token.id)}
                className="rounded border border-ink/20 px-1 py-0.5 text-[10px] text-red-500 hover:bg-red-500/10"
                title="この画像を削除"
              >
                削除
              </button>
            </div>
          ))}
        </div>
      )}
      <div
        className={`shrink-0 overflow-hidden border bg-paper shadow-sm dark:shadow-[0_0_0_1px_rgba(170,180,212,0.15),0_12px_36px_-8px_rgba(0,0,0,0.85)] ${
          selected
            ? "border-accent ring-2 ring-accent dark:border-accent"
            : "border-paper-ink/15 dark:border-paper-ink/5"
        }`}
        style={sheetStyle}
      >
        {fullImage ? (
          <FullPageImage token={fullImage} images={images} />
        ) : (
          <>
            <div className="text-paper-ink" style={textStyle}>
              {flowTokens.length === 0 ? (
                <span className="text-paper-ink/40">
                  （本文を入力すると、ここに縦書きで表示されます）
                </span>
              ) : (
                flowTokens.map((token, index) => <TokenView key={index} token={token} />)
              )}
            </div>

            {topImages.length > 0 && (
              <ImagePositionOverlay tokens={topImages} images={images} position="top" />
            )}
            {centerImages.length > 0 && (
              <ImagePositionOverlay tokens={centerImages} images={images} position="center" />
            )}
            {bottomImages.length > 0 && (
              <ImagePositionOverlay tokens={bottomImages} images={images} position="bottom" />
            )}
          </>
        )}

        {hashiraText && (
          <HashiraOverlay
            text={hashiraText}
            position={masterPage.hashiraPosition}
            marginMm={
              masterPage.hashiraPosition === "top"
                ? settings.marginTop
                : settings.marginBottom
            }
          />
        )}

        {showNombre && (
          <NombreOverlay
            value={nombreValue}
            position={nombrePosition as "center" | "outer"}
            isOddPage={isOddPage}
            marginBottomMm={settings.marginBottom}
          />
        )}
      </div>
      <span className="text-xs text-ink/60">{pageNumber} ページ</span>
    </div>
  );
}

function NombreOverlay({
  value,
  position,
  isOddPage,
  marginBottomMm,
}: {
  value: number;
  position: "center" | "outer";
  isOddPage: boolean;
  marginBottomMm: number;
}) {
  // 小口側: 奇数ページ(左)は左寄せ、偶数ページ(右)は右寄せに交互配置する。
  const justifyContent =
    position === "center" ? "center" : isOddPage ? "flex-start" : "flex-end";

  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: marginBottomMm * PX_PER_MM,
    display: "flex",
    alignItems: "center",
    justifyContent,
    writingMode: "horizontal-tb",
    padding: `0 ${2 * PX_PER_MM}px`,
  };

  return (
    <div style={style} className="pointer-events-none select-none text-[10px] text-paper-ink/70">
      {value}
    </div>
  );
}

function HashiraOverlay({
  text,
  position,
  marginMm,
}: {
  text: string;
  position: "top" | "bottom";
  marginMm: number;
}) {
  const style: CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: position === "top" ? 0 : undefined,
    bottom: position === "bottom" ? 0 : undefined,
    height: marginMm * PX_PER_MM,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    writingMode: "vertical-rl",
  };

  return (
    <div style={style} className="pointer-events-none select-none text-[10px] text-paper-ink/60">
      {text}
    </div>
  );
}

function TokenView({ token }: { token: Exclude<TategakiToken, { type: "image" }> }) {
  if (token.type === "ruby") {
    return (
      <ruby>
        {token.base}
        <rt>{token.rt}</rt>
      </ruby>
    );
  }
  if (token.type === "tcy") {
    return <span style={{ textCombineUpright: "all" }}>{token.value}</span>;
  }
  if (token.type === "pageBreak") {
    return null;
  }
  return <>{token.value}</>;
}

/** Renders 挿絵 anchored to 天 (top) / 中央 (center) / 地 (bottom) of the page. */
function ImagePositionOverlay({
  tokens,
  images,
  position,
}: {
  tokens: ImageToken[];
  images: Record<string, string>;
  position: "top" | "center" | "bottom";
}) {
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
        return (
          <img
            key={token.id}
            src={src}
            alt=""
            style={{ width: token.widthMm * PX_PER_MM, height: token.heightMm * PX_PER_MM }}
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
        objectFit: "cover",
      }}
    />
  );
}
