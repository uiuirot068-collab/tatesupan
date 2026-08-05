import { useMemo, useState } from "react";

interface SearchReplaceModalProps {
  content: string;
  onReplace: (nextContent: string) => void;
  onClose: () => void;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function SearchReplaceModal({
  content,
  onReplace,
  onClose,
}: SearchReplaceModalProps) {
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");

  const matchCount = useMemo(() => {
    if (searchText === "") return 0;
    return content.split(searchText).length - 1;
  }, [content, searchText]);

  const handleReplaceAll = () => {
    if (searchText === "") return;
    const pattern = new RegExp(escapeRegExp(searchText), "g");
    onReplace(content.replace(pattern, replaceText));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg bg-white p-5 shadow-lg dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-zinc-800 dark:text-zinc-100">
          検索・置換
        </h2>

        <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
          検索する文字列
        </label>
        <input
          autoFocus
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="mb-3 w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="例: 山田"
        />

        <label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
          置換後の文字列
        </label>
        <input
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          className="mb-3 w-full rounded border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          placeholder="例: 田中"
        />

        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          {searchText === ""
            ? "検索文字列を入力してください"
            : `${matchCount} 件見つかりました`}
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={searchText === "" || matchCount === 0}
            className="rounded bg-zinc-800 px-3 py-1.5 text-sm text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            すべて置換
          </button>
        </div>
      </div>
    </div>
  );
}
