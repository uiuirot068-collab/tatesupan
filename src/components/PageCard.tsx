import type { CSSProperties } from "react";
import type { TategakiToken } from "@/lib/tategaki";
import { PX_PER_MM, type PageLayout, type PageSettings } from "@/lib/pageLayout";

interface PageCardProps {
  pageNumber: number;
  tokens: TategakiToken[];
  settings: PageSettings;
  layout: PageLayout;
}

export default function PageCard({
  pageNumber,
  tokens,
  settings,
  layout,
}: PageCardProps) {
  const { paper } = layout;
  const { masterPage } = settings;

  // 物理的なページの左右（奇数=右/小口が右側、偶数=左/小口が左側）。
  const isOddPage = pageNumber % 2 === 1;
  const isFirstPage = pageNumber === 1;

  const sheetStyle: CSSProperties = {
    position: "relative",
    writingMode: "vertical-rl",
    width: paper.widthMm * PX_PER_MM,
    height: paper.heightMm * PX_PER_MM,
    paddingTop: settings.marginTop * PX_PER_MM,
    paddingBottom: settings.marginBottom * PX_PER_MM,
    // ノド(gutter) sits on the left, 小口(outer) on the right: tategaki
    // reading starts at the top-right and proceeds toward the spine.
    paddingLeft: settings.marginGutter * PX_PER_MM,
    paddingRight: settings.marginOuter * PX_PER_MM,
  };

  const textStyle: CSSProperties = {
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    fontSize: `${settings.fontSizePt}pt`,
    lineHeight: settings.lineHeightRatio,
  };

  const nombrePosition = masterPage.nombrePosition;
  const showNombre =
    nombrePosition !== "hidden" &&
    !(masterPage.hideNombreOnFirstPage && isFirstPage);
  const nombreValue = masterPage.nombreStart + pageNumber - 1;

  const hashiraText = isOddPage ? masterPage.hashiraOdd : masterPage.hashiraEven;

  return (
    <div className="flex shrink-0 flex-col items-center gap-2">
      <div
        className="shrink-0 overflow-x-auto overflow-y-hidden border border-paper-ink/15 bg-paper shadow-sm dark:border-paper-ink/5 dark:shadow-[0_0_0_1px_rgba(170,180,212,0.15),0_12px_36px_-8px_rgba(0,0,0,0.85)]"
        style={sheetStyle}
      >
        <div className="h-full text-paper-ink" style={textStyle}>
          {tokens.length === 0 ? (
            <span className="text-paper-ink/40">
              （本文を入力すると、ここに縦書きで表示されます）
            </span>
          ) : (
            tokens.map((token, index) => (
              <TokenView key={index} token={token} />
            ))
          )}
        </div>

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
  // 小口側: 奇数ページ(右)は右寄せ、偶数ページ(左)は左寄せに交互配置する。
  const justifyContent =
    position === "center" ? "center" : isOddPage ? "flex-end" : "flex-start";

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

function TokenView({ token }: { token: TategakiToken }) {
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
  return <>{token.value}</>;
}
