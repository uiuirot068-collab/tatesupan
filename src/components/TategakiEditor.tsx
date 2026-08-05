"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { loadDocument, saveDocument } from "@/lib/db";
import { computePageLayout, DEFAULT_PAGE_SETTINGS, type PageSettings } from "@/lib/pageLayout";
import EditorPane from "./EditorPane";
import PreviewPane from "./PreviewPane";
import SearchReplaceModal from "./SearchReplaceModal";
import MobileTabBar, { type MobileTab } from "./MobileTabBar";

type SaveStatus = "loading" | "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 800;

export default function TategakiEditor() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");

  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layout = useMemo(() => computePageLayout(settings), [settings]);

  useEffect(() => {
    let cancelled = false;
    loadDocument().then((doc) => {
      if (cancelled) return;
      if (doc) {
        setTitle(doc.title);
        setContent(doc.content);
        setSettings(doc.settings);
      }
      hasLoadedRef.current = true;
      setSaveStatus("saved");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) return;

    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(title, content, settings)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, settings]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
        <h1 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          縦書きWebエディタ
        </h1>
        <SaveStatusLabel status={saveStatus} />
      </header>

      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          className={`min-h-0 flex-1 md:flex md:w-1/2 ${
            mobileTab === "edit" ? "flex flex-col" : "hidden"
          }`}
        >
          <EditorPane
            title={title}
            onTitleChange={setTitle}
            content={content}
            onContentChange={setContent}
            onOpenSearchReplace={() => setIsSearchOpen(true)}
            settings={settings}
            layout={layout}
            onSettingsChange={setSettings}
          />
        </section>

        <section
          className={`min-h-0 flex-1 border-zinc-200 md:flex md:w-1/2 md:border-l dark:border-zinc-800 ${
            mobileTab === "preview" ? "flex flex-col" : "hidden"
          }`}
        >
          <PreviewPane content={content} settings={settings} layout={layout} />
        </section>
      </main>

      <MobileTabBar active={mobileTab} onChange={setMobileTab} />

      {isSearchOpen && (
        <SearchReplaceModal
          content={content}
          onReplace={(next) => {
            setContent(next);
            setIsSearchOpen(false);
          }}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </div>
  );
}

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  const text: Record<SaveStatus, string> = {
    loading: "読み込み中…",
    saving: "保存中…",
    saved: "保存済み",
    error: "保存に失敗しました",
  };
  const color: Record<SaveStatus, string> = {
    loading: "text-zinc-400",
    saving: "text-amber-500",
    saved: "text-emerald-600 dark:text-emerald-400",
    error: "text-red-500",
  };
  return <span className={`text-xs ${color[status]}`}>{text[status]}</span>;
}
