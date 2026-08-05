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

  const sheetStyle: CSSProperties = {
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
      </div>
      <span className="text-xs text-ink/60">{pageNumber} ページ</span>
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
