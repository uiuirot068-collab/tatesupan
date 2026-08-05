import { countVisualLength } from "@/lib/tategaki";
import type { PageLayout, PageSettings } from "@/lib/pageLayout";
import PageSettingsPanel from "./PageSettingsPanel";

interface EditorPaneProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  onOpenSearchReplace: () => void;
  settings: PageSettings;
  layout: PageLayout;
  onSettingsChange: (settings: PageSettings) => void;
}

export default function EditorPane({
  title,
  onTitleChange,
  content,
  onContentChange,
  onOpenSearchReplace,
  settings,
  layout,
  onSettingsChange,
}: EditorPaneProps) {
  return (
    <div className="flex h-full flex-col bg-base">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-2">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="無題のドキュメント"
          className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-ink/40"
        />
        <button
          type="button"
          onClick={onOpenSearchReplace}
          className="shrink-0 rounded border border-ink/20 px-3 py-1 text-xs text-ink/70 hover:bg-ink/5"
        >
          検索・置換
        </button>
      </div>

      <PageSettingsPanel
        settings={settings}
        layout={layout}
        onChange={onSettingsChange}
      />

      <textarea
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="ここに本文を入力してください&#10;&#10;ルビ: ｜漢字《かんじ》&#10;縦中横: 数字2桁や !! ？？ などを自動検知します"
        spellCheck={false}
        className="flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-ink outline-none placeholder:text-ink/40"
      />

      <div className="flex items-center justify-between border-t border-ink/10 px-4 py-2 text-xs text-ink/60">
        <span>
          ルビ記法: <code>｜漢字《かんじ》</code>／縦中横: 半角数字2桁・
          <code>!!</code>
          <code>??</code> を自動検知
        </span>
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-paper-ink">
          {countVisualLength(content)} 文字
        </span>
      </div>
    </div>
  );
}
