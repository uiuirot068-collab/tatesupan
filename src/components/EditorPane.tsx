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
    <div className="flex h-full flex-col bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="無題のドキュメント"
          className="w-full bg-transparent text-sm font-medium text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={onOpenSearchReplace}
          className="shrink-0 rounded border border-zinc-300 px-3 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
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
        className="flex-1 resize-none bg-transparent p-4 font-mono text-sm leading-relaxed text-zinc-800 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
      />

      <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <span>
          ルビ記法: <code>｜漢字《かんじ》</code>／縦中横: 半角数字2桁・
          <code>!!</code>
          <code>??</code> を自動検知
        </span>
        <span>{countVisualLength(content)} 文字</span>
      </div>
    </div>
  );
}
