import { useMemo, useState } from "react";

interface SearchReplaceModalProps {
  content: string;
  /**
   * Phase 9: select a match in the editor (canonical offsets). The windowed
   * editor mounts one 編集ページ, so browser find (Ctrl+F) cannot reach the
   * rest of the manuscript; 前へ / 次へ here searches the whole canonical
   * text on either editor surface.
   */
  onFind?: (start: number, end: number) => void;
  onReplace: (
    nextContent: string,
    replacements: readonly { deletedText: string; insertedText: string }[]
  ) => void;
  onClose: () => void;
  /** Desktop Preview uses a non-blocking pane panel; phone keeps the screen modal. */
  placement?: "screen" | "preview";
}

/** Start offsets of every non-overlapping occurrence (the same matches `split`/replace-all count). */
export function findMatchOffsets(content: string, searchText: string): number[] {
  if (searchText === "") return [];
  const offsets: number[] = [];
  for (let at = content.indexOf(searchText); at !== -1; at = content.indexOf(searchText, at + searchText.length)) {
    offsets.push(at);
  }
  return offsets;
}

/** The match index after `current` in direction `dir`, wrapping around. */
export function stepMatchIndex(current: number, count: number, dir: 1 | -1): number {
  if (count === 0) return -1;
  if (current < 0) return dir === 1 ? 0 : count - 1;
  return (current + dir + count) % count;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default function SearchReplaceModal({
  content,
  onFind,
  onReplace,
  onClose,
  placement = "screen",
}: SearchReplaceModalProps) {
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [matchIndex, setMatchIndex] = useState(-1);

  const matches = useMemo(() => findMatchOffsets(content, searchText), [content, searchText]);
  const matchCount = matches.length;
  const activeOffset = matchIndex >= 0 && matchIndex < matchCount ? matches[matchIndex] : -1;
  const activeContext = activeOffset >= 0
    ? content.slice(Math.max(0, activeOffset - 16), Math.min(content.length, activeOffset + searchText.length + 16)).replace(/\s+/g, " ")
    : "";

  const step = (dir: 1 | -1) => {
    const next = stepMatchIndex(matchIndex, matchCount, dir);
    if (next < 0 || !onFind) return;
    setMatchIndex(next);
    onFind(matches[next], matches[next] + searchText.length);
  };

  const handleReplaceAll = () => {
    if (searchText === "") return;
    const pattern = new RegExp(escapeRegExp(searchText), "g");
    const next = content.replace(pattern, replaceText);
    onReplace(
      next,
      Array.from({ length: matchCount }, () => ({
        deletedText: searchText,
        insertedText: replaceText,
      }))
    );
  };

  const panePlacement = placement === "preview";
  return (
    <div
      data-search-replace-placement={placement}
      className={panePlacement
        ? "pointer-events-none absolute inset-x-0 top-0 z-50 flex justify-center p-4"
        : "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"}
      onClick={panePlacement ? undefined : onClose}
    >
      <div
        className="pointer-events-auto w-full max-w-sm rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-base font-semibold text-ink">置換</h2>

        <label className="mb-1 block text-xs text-ink/60">
          置換する文字列
        </label>
        <input
          autoFocus
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setMatchIndex(-1);
          }}
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
            <span className="inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-paper-ink" data-search-match-status="">
              {matchIndex >= 0 && matchIndex < matchCount ? `${matchIndex + 1} / ${matchCount} 件目` : `${matchCount} 件見つかりました`}
            </span>
          )}
        </p>

        {activeContext && (
          <p data-search-match-context="" className="mb-3 rounded border border-ink/10 bg-ink/[0.03] px-2 py-1.5 text-xs leading-relaxed text-ink/70">
            …{activeContext}…
          </p>
        )}

        {onFind && (
          <div className="mb-4 flex justify-end gap-2">
            <button
              type="button"
              data-search-step="prev"
              onClick={() => step(-1)}
              disabled={matchCount === 0}
              className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              前へ
            </button>
            <button
              type="button"
              data-search-step="next"
              onClick={() => step(1)}
              disabled={matchCount === 0}
              className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              次へ
            </button>
          </div>
        )}

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
