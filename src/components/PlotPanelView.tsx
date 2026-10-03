"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  chapterHeading,
  chapterIndexForHeading,
  parsePlotFile,
  plotDisplayTitle,
  PLOT_LIMITS,
  readStoredPlot,
  removeStoredPlot,
  sceneDisplayTitle,
  SCENE_STATUS_LABELS,
  writeStoredPlot,
  type Plot,
} from "@/lib/plotPanel";

/**
 * PLT-LOOP-003: the プロット side of the メモ・プロット panel. Read-only: it
 * shows one chapter of a プロット帳 plot at a time and follows the `#` heading
 * the cursor is under. It never writes to the manuscript, settings, memo or
 * cloud copy; the plot is kept in its own localStorage drawer (`storageKey`).
 */
export default function PlotPanelView({
  storageKey,
  currentHeading,
  onOpenMemo,
}: {
  storageKey: string;
  /** the manuscript heading the cursor is under, or null */
  currentHeading: string | null;
  /** switches the panel to the メモ tab, for writers who came here to write */
  onOpenMemo: () => void;
}) {
  const [plot, setPlot] = useState<Plot | null>(() =>
    typeof window === "undefined" ? null : readStoredPlot(window.localStorage, storageKey)
  );
  const matchFor = (p: Plot | null, heading: string | null) => (p && heading !== null ? chapterIndexForHeading(p, heading) : -1);
  const [chapterIndex, setChapterIndex] = useState(() => Math.max(0, matchFor(plot, currentHeading)));
  // Follow the manuscript only when the cursor moves under another heading,
  // so 前の章 / 次の章 are not undone on every keystroke.
  const [followedHeading, setFollowedHeading] = useState(currentHeading);
  if (followedHeading !== currentHeading) {
    setFollowedHeading(currentHeading);
    const match = matchFor(plot, currentHeading);
    if (match >= 0) setChapterIndex(match);
  }

  const [mode, setMode] = useState<"view" | "paste" | "confirm-replace" | "confirm-remove">("view");
  const [pasteText, setPasteText] = useState("");
  const [pending, setPending] = useState<Plot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const keep = (next: Plot) => {
    if (!writeStoredPlot(window.localStorage, storageKey, next)) {
      setError("このブラウザに保存できませんでした。空き容量が足りないかもしれません。");
      return;
    }
    setPlot(next);
    setChapterIndex(Math.max(0, matchFor(next, currentHeading)));
    setPending(null);
    setPasteText("");
    setMode("view");
    setError(null);
    setNote(`「${plotDisplayTitle(next)}」を読み込みました。`);
  };
  const offer = (text: string) => {
    const parsed = parsePlotFile(text);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setError(null);
    if (plot) {
      setPending(parsed.plot);
      setMode("confirm-replace");
    } else {
      keep(parsed.plot);
    }
  };
  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setNote(null);
    if (file.size > PLOT_LIMITS.fileBytes) {
      setError("ファイルが大きすぎます。");
      return;
    }
    try {
      offer(await file.text());
    } catch {
      setError("ファイルを読めませんでした。");
    }
  };
  const remove = () => {
    removeStoredPlot(window.localStorage, storageKey);
    setPlot(null);
    setChapterIndex(0);
    setMode("view");
    setNote("プロットを外しました。原稿とメモはそのままです。");
  };

  const linkButton = "rounded px-1.5 py-0.5 text-xs text-ink/65 underline decoration-ink/25 underline-offset-2 hover:text-ink hover:decoration-ink/60";
  const loaders = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <button type="button" onClick={() => { setNote(null); fileRef.current?.click(); }} className="rounded border border-ink/20 px-3 py-1 text-xs text-ink/75 hover:bg-ink/5">
        ファイルを選ぶ
      </button>
      <button type="button" onClick={() => { setNote(null); setError(null); setMode("paste"); }} className={linkButton}>
        貼りつけて読み込む
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        data-plot-file-input=""
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          void readFile(file);
        }}
      />
    </div>
  );

  const messages = (
    <>
      {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
      {note && <p role="status" className="mt-2 text-xs text-ink/55">{note}</p>}
    </>
  );

  if (mode === "paste") {
    return (
      <div data-plot-panel="paste">
        <p className="text-xs leading-relaxed text-ink/65">プロット帳の「書き出す」→「プロットをまるごとコピー」でコピーしたものを貼りつけてください。</p>
        <textarea
          autoFocus
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          className="mt-2 h-24 w-full resize-none rounded border border-ink/20 bg-paper p-2 font-mono text-xs leading-relaxed text-ink outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="プロットを貼りつける"
        />
        <div className="mt-1 flex items-center gap-2">
          <button type="button" onClick={() => offer(pasteText)} disabled={!pasteText.trim()} className="rounded bg-accent px-3 py-1 text-xs font-semibold text-paper-ink disabled:cursor-not-allowed disabled:opacity-40">
            読み込む
          </button>
          <button type="button" onClick={() => { setMode("view"); setError(null); setPasteText(""); }} className={linkButton}>
            やめる
          </button>
        </div>
        {messages}
      </div>
    );
  }

  if (mode === "confirm-replace" && plot && pending) {
    return (
      <div data-plot-panel="confirm-replace" className="text-sm leading-relaxed text-ink/80">
        <p>いまの「{plotDisplayTitle(plot)}」を、「{plotDisplayTitle(pending)}」に置きかえますか？原稿とメモは変わりません。</p>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={() => keep(pending)} className="rounded bg-accent px-3 py-1 text-xs font-semibold text-paper-ink">置きかえる</button>
          <button type="button" onClick={() => { setPending(null); setMode("view"); }} className={linkButton}>やめる</button>
        </div>
      </div>
    );
  }

  if (!plot) {
    return (
      <div data-plot-panel="empty">
        <p className="text-sm leading-relaxed text-ink/75">プロット帳で作ったプロットを読み込むと、この欄で章ごとに見ながら原稿を書けます。</p>
        <p data-plot-read-only-note="" className="mt-1 text-xs leading-relaxed text-ink/65">
          ここはプロットを見るための欄で、プロットを書くことはできません。プロットはプロット帳で書きます。思いついたことを書きとめたいときはメモを使ってください。
          <button type="button" onClick={onOpenMemo} className={`${linkButton} ml-1`}>メモを開く</button>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink/55">カーソルのある章の見出し（例：# 第1章　帰郷）に合わせて、プロットも同じ章を開きます。原稿やメモは変わりません。</p>
        <div className="mt-3">{loaders}</div>
        {messages}
      </div>
    );
  }

  if (mode === "confirm-remove") {
    return (
      <div data-plot-panel="confirm-remove" className="text-sm leading-relaxed text-ink/80">
        <p>「{plotDisplayTitle(plot)}」をこの欄から外しますか？プロット帳のプロット、原稿、メモは消えません。</p>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" onClick={remove} className="rounded border border-ink/25 px-3 py-1 text-xs text-ink/80 hover:bg-ink/5">外す</button>
          <button type="button" onClick={() => setMode("view")} className={linkButton}>やめる</button>
        </div>
      </div>
    );
  }

  const index = Math.min(chapterIndex, plot.chapters.length - 1);
  const chapter = plot.chapters[index];
  const matched = matchFor(plot, currentHeading);
  let follow: ReactNode = null;
  if (currentHeading !== null && matched === index) {
    follow = <>原稿の「{currentHeading}」に合わせています</>;
  } else if (currentHeading !== null && matched >= 0) {
    follow = (
      <>
        原稿は「{currentHeading}」です
        <button type="button" onClick={() => setChapterIndex(matched)} className={`${linkButton} ml-1`}>この章に戻る</button>
      </>
    );
  } else if (currentHeading !== null) {
    follow = <>原稿の「{currentHeading}」はプロットにない見出しです。前の章・次の章で選べます</>;
  }

  return (
    <div data-plot-panel="view" data-plot-chapter-index={index}>
      <div className="flex items-center gap-2 border-b border-ink/10 pb-2">
        <button type="button" onClick={() => setChapterIndex(index - 1)} disabled={index === 0} aria-label="前の章" className="shrink-0 rounded px-2 py-0.5 text-sm text-ink/65 hover:bg-ink/5 disabled:opacity-25">‹</button>
        <h3 className="min-w-0 flex-1 truncate text-center text-sm font-semibold text-ink" title={chapterHeading(chapter, index)}>
          {chapterHeading(chapter, index)}
          <span className="ml-2 text-[11px] font-normal text-ink/45">{index + 1}/{plot.chapters.length}</span>
        </h3>
        <button type="button" onClick={() => setChapterIndex(index + 1)} disabled={index >= plot.chapters.length - 1} aria-label="次の章" className="shrink-0 rounded px-2 py-0.5 text-sm text-ink/65 hover:bg-ink/5 disabled:opacity-25">›</button>
      </div>
      {follow && <p data-plot-follow="" className="mt-1.5 text-[11px] leading-relaxed text-ink/50">{follow}</p>}
      {chapter.summary.trim() && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/80">{chapter.summary}</p>}
      <ol className="mt-2">
        {chapter.scenes.map((scene, si) => (
          <li key={scene.id} className="border-t border-ink/10 py-2 first:border-t-0">
            <p className="text-sm text-ink">
              <span className="font-medium">{sceneDisplayTitle(scene, si)}</span>
              <span className="ml-2 text-[11px] text-ink/45">{SCENE_STATUS_LABELS[scene.status]}</span>
            </p>
            {scene.summary.trim() && <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink/75">{scene.summary}</p>}
            {scene.characters.trim() && <p className="mt-0.5 text-xs text-ink/60">人物：{scene.characters}</p>}
            {scene.timePlace.trim() && <p className="mt-0.5 text-xs text-ink/60">時と場所：{scene.timePlace}</p>}
            {scene.memo.trim() && <p className="mt-0.5 whitespace-pre-wrap text-xs leading-relaxed text-ink/60">メモ：{scene.memo}</p>}
          </li>
        ))}
      </ol>
      <p data-plot-read-only-note="" className="mt-2 text-[11px] leading-relaxed text-ink/50">
        プロットはここでは直せません。直すときはプロット帳で直して、読み込み直してください。
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-ink/10 pt-2 text-xs text-ink/50">
        <span className="min-w-0 truncate">{plotDisplayTitle(plot)}</span>
        <span aria-hidden="true">·</span>
        <button type="button" onClick={() => { setNote(null); fileRef.current?.click(); }} className={linkButton}>ファイルから読み込み直す</button>
        <button type="button" onClick={() => { setNote(null); setError(null); setMode("paste"); }} className={linkButton}>貼りつけて読み込む</button>
        <button type="button" onClick={() => setMode("confirm-remove")} className={linkButton}>外す</button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-plot-file-input=""
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void readFile(file);
          }}
        />
      </div>
      {messages}
    </div>
  );
}
