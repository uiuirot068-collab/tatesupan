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
        className="w-full max-w-sm rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-ink">検索・置換</h2>

        <label className="mb-1 block text-xs text-ink/60">
          検索する文字列
        </label>
        <input
          autoFocus
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="mb-3 w-full rounded border border-ink/20 bg-base px-3 py-2 text-sm text-ink outline-none focus:border-ink/60"
          placeholder="例: 山田"
        />

        <label className="mb-1 block text-xs text-ink/60">
          置換後の文字列
        </label>
        <input
          value={replaceText}
          onChange={(e) => setReplaceText(e.target.value)}
          className="mb-3 w-full rounded border border-ink/20 bg-base px-3 py-2 text-sm text-ink outline-none focus:border-ink/60"
          placeholder="例: 田中"
        />

        <p className="mb-4 text-xs text-ink/60">
          {searchText === "" ? (
            "検索文字列を入力してください"
          ) : (
            <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-paper-ink">
              {matchCount} 件見つかりました
            </span>
          )}
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5"
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={searchText === "" || matchCount === 0}
            className="rounded bg-ink px-3 py-1.5 text-sm text-base hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            すべて置換
          </button>
        </div>
      </div>
    </div>
  );
}
