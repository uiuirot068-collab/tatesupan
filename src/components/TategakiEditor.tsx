"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  deleteImage,
  loadAllImages,
  loadDocument,
  saveDocument,
  saveImage,
  type ImageRecord,
} from "@/lib/db";
import { computePageLayout, DEFAULT_PAGE_SETTINGS, type PageSettings } from "@/lib/pageLayout";
import EditorPane from "./EditorPane";
import PreviewPane from "./PreviewPane";
import SearchReplaceModal from "./SearchReplaceModal";
import MobileTabBar, { type MobileTab } from "./MobileTabBar";
import ThemeToggle from "./ThemeToggle";
import HelpModal from "./HelpModal";

type SaveStatus = "loading" | "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 800;

export default function TategakiEditor() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [plotNote, setPlotNote] = useState("");
  const [settings, setSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [images, setImages] = useState<Record<string, string>>({});
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(50);

  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const layout = useMemo(() => computePageLayout(settings), [settings]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadDocument(), loadAllImages()]).then(([doc, imageRecords]) => {
      if (cancelled) return;
      if (doc) {
        setTitle(doc.title);
        setContent(doc.content);
        setSettings(doc.settings);
        setPlotNote(doc.plotNote ?? "");
      }
      setImages(Object.fromEntries(imageRecords.map((record) => [record.id, record.dataUrl])));
      hasLoadedRef.current = true;
      setSaveStatus("saved");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !mainRef.current) return;
      const rect = mainRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(80, Math.max(20, percent));
      setEditorWidthPercent(clamped);
    };

    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const handleDividerMouseDown = () => {
    isDraggingRef.current = true;
    document.body.style.userSelect = "none";
  };

  const handleImageAdd = (record: ImageRecord) => {
    setImages((prev) => ({ ...prev, [record.id]: record.dataUrl }));
    saveImage(record).catch(() => setSaveStatus("error"));
  };

  const handleImageDelete = (id: string) => {
    setImages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    deleteImage(id).catch(() => setSaveStatus("error"));
  };

  useEffect(() => {
    if (!hasLoadedRef.current) return;

    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(title, content, settings, plotNote)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [title, content, settings, plotNote]);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-ink/10 px-4 py-2">
        <h1 className="text-sm font-semibold text-ink">縦書きWebエディタ</h1>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setIsHelpOpen(true)}
            aria-label="使い方"
            title="使い方"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ink/20 text-xs font-semibold text-ink/70 hover:bg-ink/5"
          >
            ？
          </button>
          <SaveStatusLabel status={saveStatus} />
        </div>
      </header>

      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

      <main ref={mainRef} className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section
          style={{ "--editor-w": `${editorWidthPercent}%` } as React.CSSProperties}
          className={`min-h-0 flex-1 md:flex md:w-[var(--editor-w)] md:flex-none ${
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
            plotNote={plotNote}
            onPlotNoteChange={setPlotNote}
            onOpenHelp={() => setIsHelpOpen(true)}
          />
        </section>

        <div
          onMouseDown={handleDividerMouseDown}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-ink/10 transition-colors hover:bg-accent/60 active:bg-accent md:block"
        />

        <section
          style={{ "--preview-w": `${100 - editorWidthPercent}%` } as React.CSSProperties}
          className={`min-h-0 flex-1 md:flex md:w-[var(--preview-w)] md:flex-none ${
            mobileTab === "preview" ? "flex flex-col" : "hidden"
          }`}
        >
          <PreviewPane
            content={content}
            settings={settings}
            layout={layout}
            images={images}
            onContentChange={setContent}
            onSettingsChange={setSettings}
            onImageAdd={handleImageAdd}
            onImageDelete={handleImageDelete}
          />
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
  const dot: Record<SaveStatus, string> = {
    loading: "bg-ink/30",
    saving: "bg-accent animate-pulse",
    saved: "bg-accent",
    error: "bg-red-500",
  };
  const label: Record<SaveStatus, string> = {
    loading: "text-ink/40",
    saving: "text-ink/70",
    saved: "text-ink/70",
    error: "text-red-500",
  };
  return (
    <span className="flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${dot[status]}`} />
      <span className={label[status]}>{text[status]}</span>
    </span>
  );
}
