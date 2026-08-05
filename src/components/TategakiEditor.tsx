"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createDocument,
  deleteImage,
  loadAllImages,
  loadDocument,
  saveDocument,
  saveImage,
  type ImageRecord,
} from "@/lib/db";
import { computePageLayout } from "@/lib/pageLayout";
import { useEditorSettings } from "@/hooks/useEditorSettings";
import { useShortcuts } from "@/hooks/useShortcuts";
import EditorPane from "./EditorPane";
import PreviewPane from "./PreviewPane";
import SearchReplaceModal from "./SearchReplaceModal";
import MobileTabBar, { type MobileTab } from "./MobileTabBar";
import ThemeToggle from "./ThemeToggle";
import HelpModal from "./HelpModal";
import Logo from "./Logo";

type SaveStatus = "loading" | "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 800;

export default function TategakiEditor({ documentId }: { documentId?: number }) {
  const router = useRouter();
  const [docId, setDocId] = useState<number | null>(
    documentId && Number.isFinite(documentId) ? documentId : null
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [plotNote, setPlotNote] = useState("");
  const [settings, setSettings] = useEditorSettings();
  const [images, setImages] = useState<Record<string, string>>({});
  const [mobileTab, setMobileTab] = useState<MobileTab>("edit");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(50);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const layout = useMemo(() => computePageLayout(settings), [settings]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      let id = documentId && Number.isFinite(documentId) ? documentId : null;
      let doc = id ? await loadDocument(id) : undefined;

      if (!doc) {
        id = await createDocument();
        router.replace(`/editor?id=${id}`);
      }

      const imageRecords = await loadAllImages();
      if (cancelled) return;

      setDocId(id);
      if (doc) {
        setTitle(doc.title);
        setContent(doc.content);
        setSettings(doc.settings);
        setPlotNote(doc.plotNote ?? "");
      }
      setImages(Object.fromEntries(imageRecords.map((record) => [record.id, record.dataUrl])));
      hasLoadedRef.current = true;
      setSaveStatus("saved");
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!hasLoadedRef.current || docId === null) return;

    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(docId, title, content, settings, plotNote)
        .then(() => setSaveStatus("saved"))
        .catch(() => setSaveStatus("error"));
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [docId, title, content, settings, plotNote]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 2400);
  };

  const saveNow = () => {
    if (docId === null) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus("saving");
    saveDocument(docId, title, content, settings, plotNote)
      .then(() => {
        setSaveStatus("saved");
        showToast("下書きを自動保存しました");
      })
      .catch(() => setSaveStatus("error"));
  };

  useShortcuts([{ key: "s", handler: saveNow }]);

  return (
    <div className="box-border flex h-screen w-screen flex-col gap-6 overflow-hidden bg-canvas px-6 pb-6 pt-4 md:px-8 md:pb-8 md:pt-6">
      <header className="flex shrink-0 items-center justify-between rounded-xl border border-ink/10 bg-base px-4 py-2 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-medium text-ink/60 hover:text-ink hover:underline"
          >
            ← 作品一覧
          </Link>
          <h1 className="flex items-baseline">
            <Logo />
            <span className="font-normal text-sm text-ink/50 ml-2">縦書きWebエディタ</span>
          </h1>
        </div>
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

      <main
        ref={mainRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-hidden md:flex-row md:gap-8"
      >
        <section
          style={{ "--editor-w": `${editorWidthPercent}%` } as React.CSSProperties}
          className={`h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-ink/10 bg-base shadow-lg md:flex md:w-[var(--editor-w)] md:flex-none ${
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
            onCursorIndexChange={setCursorIndex}
          />
        </section>

        <div
          onMouseDown={handleDividerMouseDown}
          className="hidden w-1.5 shrink-0 cursor-col-resize bg-ink/10 transition-colors hover:bg-accent/60 active:bg-accent md:block"
        />

        <section
          style={{ "--preview-w": `${100 - editorWidthPercent}%` } as React.CSSProperties}
          className={`h-full min-h-0 min-w-0 flex-1 overflow-hidden rounded-2xl border border-ink/10 bg-base shadow-xl md:flex md:w-[var(--preview-w)] md:flex-none ${
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
            cursorIndex={cursorIndex}
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

      {toast && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-lg border border-ink/10 bg-ink px-4 py-2 text-sm text-base shadow-lg">
          {toast}
        </div>
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
