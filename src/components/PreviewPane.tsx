import { useMemo } from "react";
import { paginateTokens, tokenizeTategaki } from "@/lib/tategaki";
import type { PageLayout, PageSettings } from "@/lib/pageLayout";
import PageCard from "./PageCard";

interface PreviewPaneProps {
  content: string;
  settings: PageSettings;
  layout: PageLayout;
}

export default function PreviewPane({
  content,
  settings,
  layout,
}: PreviewPaneProps) {
  const pages = useMemo(() => {
    const tokens = tokenizeTategaki(content);
    return paginateTokens(tokens, layout.charsPerPage);
  }, [content, layout.charsPerPage]);

  return (
    <div className="flex h-full flex-col bg-base">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2 text-sm text-ink/60">
        <span>プレビュー</span>
        <span>
          {layout.paper.label} / 全 {pages.length} ページ / 1ページ
          {layout.charsPerPage} 文字（{layout.charsPerLine}字×{layout.linesPerPage}行）
        </span>
      </div>
      <div className="flex flex-1 flex-row-reverse flex-wrap content-start gap-6 overflow-auto p-6">
        {pages.map((tokens, index) => (
          <PageCard
            key={index}
            pageNumber={index + 1}
            tokens={tokens}
            settings={settings}
            layout={layout}
          />
        ))}
      </div>
    </div>
  );
}
