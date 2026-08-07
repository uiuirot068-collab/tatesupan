import { Fragment, useRef, type CSSProperties, type DragEvent, type MouseEvent, type ReactNode } from "react";
import {
  computeParagraphStartFlags,
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

const IMAGE_POSITION_LABELS: Record<ImagePosition, string> = {
  top: "天側（上部）",
  center: "中央",
  bottom: "地側（下部）",
  full: "ページ全体",
};

interface PageCardProps {
  pageNumber: number;
  page: TategakiPage;
  /** Whether this page's first content token begins a genuine new paragraph (vs. a mid-sentence page break). Defaults to true. */
  startsNewParagraph?: boolean;
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
  insertingImage?: boolean;
  onImagePositionChange?: (imageId: string, position: ImagePosition) => void;
  onImageDelete?: (imageId: string) => void;
  hideNombre?: boolean;
  onHideNombreChange?: (hideNombre: boolean) => void;
}

export default function PageCard({
  pageNumber,
  page,
  startsNewParagraph = true,
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
  insertingImage = false,
  onImagePositionChange,
  onImageDelete,
  hideNombre = false,
  onHideNombreChange,
}: PageCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const isTwoColumn = settings.columnCount === 2;

  // ブラウザの自動折り返し誤作動を防ぐため 4px の許容バッファを付与
  const renderContainerHeightPx = textAreaHeightPx + 4;

  // 1行の高さ(px) と (文字数 * 1文字サイズ) の差分を計算
  const totalTextHeightPx = layout.charsPerLine * fontSizePx;
  const spaceDiffPx = Math.max(0, textAreaHeightPx - totalTextHeightPx);
  // 文字間の数（N文字ならN-1箇所）で割ることで、最終文字も含めて地のラインへ正確に吸着させる
  const gapCount = Math.max(1, layout.charsPerLine - 1);
  const microSpacingPx = layout.charsPerLine > 1 ? spaceDiffPx / gapCount : 0;

  const textStyle: CSSProperties = {
    whiteSpace: "pre-wrap",
    wordBreak: "break-all",
    width: textAreaWidthPx,
    height: renderContainerHeightPx,
    overflow: "hidden",
    fontSize: `${fontSizePx}px`,
    fontFamily: settings.fontFamily || "'Shippori Mincho', serif",
    lineHeight: settings.lineHeightRatio,
    color: "#000000",
    letterSpacing: `${microSpacingPx}px`, // 微小ピッチ補正で地のラインへ吸着
    // 縦書き・横書き双方のプロポーショナル詰め（vpal/vhal/palt/vkrn等）をすべて完全オフ
    fontFeatureSettings: '"vpal" 0, "vhal" 0, "palt" 0, "vkrn" 0, "pkna" 0',
    // 東アジア文字を完全全角に固定
    fontVariantEastAsian: "full-width",
    // 原稿用紙的な均等割り付け（行末・約物調整）
    textAlign: "justify", // 満杯行のみ均等割り付け
    textJustify: "inter-character", // 文字間均等割り
    textAlignLast: "start", // 改行で終わる短行（見出しや段落末尾）は上詰め固定
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
  const fullImage = imageTokens.find((token) => token.position === "full");
  const topImages = imageTokens.filter((token) => token.position === "top");
  const centerImages = imageTokens.filter((token) => token.position === "center");
  const bottomImages = imageTokens.filter((token) => token.position === "bottom");

  // 2段組の上段・下段トークンは tategaki.ts のページ分割ループが行単位で
  // 直接振り分け済み。ここでは挿絵トークンを取り除いて描画するだけでよく、
  // 独自に配列位置を再計算する必要はない。
  const columnFlowTokens = page.columns
    ? page.columns.map((column) => column.filter((token) => token.type !== "image"))
    : null;

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
        <div data-no-print="true" className="no-print flex w-full items-center justify-between px-1">
          <label
            className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/60"
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
          <div className="flex items-center gap-2">
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
                onClick={() => {
                  if (window.confirm("この画像を削除しますか？この操作は取り消せません。")) {
                    onImageDelete?.(token.id);
                  }
                }}
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
        data-page-card="true"
        className={`page-card shrink-0 overflow-hidden border bg-paper shadow-md dark:shadow-[0_0_0_1px_rgba(170,180,212,0.15),0_12px_36px_-8px_rgba(0,0,0,0.85)] ${
          selected
            ? "border-accent ring-2 ring-accent dark:border-accent"
            : "border-gray-200 dark:border-gray-700"
        }`}
        style={sheetStyle}
      >
        {fullImage ? (
          <FullPageImage token={fullImage} images={images} />
        ) : (
          <>
            {isTwoColumn && columnFlowTokens && flowTokens.length > 0 ? (
              <div
                style={{
                  width: textAreaWidthPx,
                  height: renderContainerHeightPx,
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
                  {columnFlowTokens.map((column, segmentIndex) => {
                    const startOffset = segmentIndex === 0 ? 0 : columnFlowTokens[0].length;
                    return (
                      <div
                        key={segmentIndex}
                        className="w-full flex-1 min-h-0 overflow-hidden"
                        style={{
                          height: `calc((100% - ${settings.columnGapMm * PX_PER_MM}px) / 2)`,
                          writingMode: "vertical-rl",
                          textOrientation: "mixed",
                          whiteSpace: textStyle.whiteSpace,
                          wordBreak: textStyle.wordBreak,
                          fontSize: textStyle.fontSize,
                          fontFamily: textStyle.fontFamily,
                          lineHeight: textStyle.lineHeight,
                          color: textStyle.color,
                          letterSpacing: textStyle.letterSpacing,
                          fontFeatureSettings: textStyle.fontFeatureSettings,
                          fontVariantEastAsian: textStyle.fontVariantEastAsian,
                          textAlign: textStyle.textAlign,
                          textJustify: textStyle.textJustify,
                          textAlignLast: textStyle.textAlignLast,
                        }}
                      >
                        {column.map((token, index) => (
                          <TokenView
                            key={startOffset + index}
                            token={token}
                            indent={paragraphStarts[startOffset + index]}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={textStyle}>
                {flowTokens.length === 0 ? (
                  <span className="text-paper-ink/40">
                    （本文を入力すると、ここに縦書きで表示されます）
                  </span>
                ) : (
                  flowTokens.map((token, index) => (
                    <TokenView key={index} token={token} indent={paragraphStarts[index]} />
                  ))
                )}
              </div>
            )}

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
            fontFamily={textStyle.fontFamily as string}
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

        {showWebFooter && <WebFooterOverlay />}

        {!paper.isPx && <TrimGuide />}
      </div>
      <span className="text-xs text-ink/60">{pageNumber} ページ</span>
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
function WebFooterOverlay() {
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
    fontSize: "9.5px",
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
  return (
    <>
      {prefix}
      {renderNowrapProtected(token.value)}
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
            style={{
              width: token.widthMm * PX_PER_MM,
              height: token.heightMm * PX_PER_MM,
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
        objectFit: "cover",
        filter: "grayscale(100%)",
      }}
    />
  );
}
