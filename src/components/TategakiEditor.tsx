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
import { computePageLayout, DEFAULT_PAGE_SETTINGS } from "@/lib/pageLayout";
import { useEditorSettings } from "@/hooks/useEditorSettings";
import { useShortcuts } from "@/hooks/useShortcuts";
import EditorPane from "./EditorPane";
import PreviewPane from "./PreviewPane";
import SearchReplaceModal from "./SearchReplaceModal";
import { BookPartsModal } from "./BookPartsModal";
import MobileTabBar, { type MobileTab } from "./MobileTabBar";
import ThemeToggle from "./ThemeToggle";
import HelpModal from "./HelpModal";
import Logo from "./Logo";

type SaveStatus = "loading" | "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 1500;

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
  const [isBookPartsModalOpen, setIsBookPartsModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(50);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);
  // Tracks which document's data is currently reflected in state, so the
  // autosave effect can refuse to write if a document switch is in flight.
  const loadedDocIdRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const layout = useMemo(() => computePageLayout(settings), [settings]);

  useEffect(() => {
    let cancelled = false;

    // Block the autosave effect from firing with a mismatched
    // docId/content pair while this document switch is in flight.
    hasLoadedRef.current = false;
    setSaveStatus("loading");

    async function run() {
      let id = documentId && Number.isFinite(documentId) ? documentId : null;
      let doc = id ? await loadDocument(id) : undefined;

      if (!doc) {
        id = await createDocument();
        router.replace(`/editor?id=${id}`);
      }

      const imageRecords = await loadAllImages();
      if (cancelled) return;

      // Reset every field to the newly-loaded document's data (or blank
      // defaults for a brand-new document) so no state from the
      // previously-open document can leak into this one.
      setTitle(doc?.title ?? "");
      setContent(doc?.content ?? "");
      setPlotNote(doc?.plotNote ?? "");
      if (doc) {
        setSettings(doc.settings ?? DEFAULT_PAGE_SETTINGS);
      }
      setImages(Object.fromEntries(imageRecords.map((record) => [record.id, record.dataUrl])));

      loadedDocIdRef.current = id;
      setDocId(id);
      hasLoadedRef.current = true;
      setSaveStatus("saved");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [documentId, router]);

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
    // Guard against saving while a document switch is mid-flight: state may
    // still hold the previous document's fields for one tick after docId
    // changes but before the new document's data has fully loaded.
    if (loadedDocIdRef.current !== docId) return;

    setSaveStatus("saving");
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    const targetDocId = docId;
    saveTimeoutRef.current = setTimeout(() => {
      // Re-check immediately before writing in case the user switched
      // documents again during the debounce window.
      if (loadedDocIdRef.current !== targetDocId) return;
      saveDocument(targetDocId, title, content, settings, plotNote)
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
    if (docId === null || loadedDocIdRef.current !== docId) return;
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

  const handleBookPartsInsert = (textToInsert: string, position: "start" | "end") => {
    setContent((prev) => (position === "start" ? textToInsert + prev : prev + textToInsert));
  };

  return (
    <div className="box-border flex h-screen w-screen flex-col gap-6 overflow-hidden bg-canvas px-6 pb-6 pt-4 md:pl-8 md:pr-10 md:pb-10 md:pt-6">
      <header className="relative z-10 flex shrink-0 items-center justify-between rounded-xl border border-ink/10 bg-base px-4 py-2 shadow-lg">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="text-xs font-medium text-ink/60 hover:text-ink hover:underline"
          >
            ← 作品一覧
          </Link>
          <h1 className="flex items-center gap-2">
            <Logo />
            <span className="font-normal text-sm text-ink/50">縦書きWebエディタ</span>
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
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden pr-4 pb-4 md:flex-row md:gap-2 md:pr-6 md:pb-6"
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
            onOpenBookParts={() => setIsBookPartsModalOpen(true)}
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
          className="hidden w-1 shrink-0 cursor-col-resize bg-ink/10 transition-all hover:w-2 hover:bg-accent/60 active:bg-accent md:block"
        />

        <section
          style={{ "--preview-w": `${100 - editorWidthPercent}%` } as React.CSSProperties}
          className={`h-full min-h-0 min-w-0 flex-1 md:flex md:w-[var(--preview-w)] md:flex-none ${
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

      {isBookPartsModalOpen && (
        <BookPartsModal
          isOpen={isBookPartsModalOpen}
          onClose={() => setIsBookPartsModalOpen(false)}
          onInsert={handleBookPartsInsert}
          currentTitle={title}
          content={content}
          layout={layout}
          settings={settings}
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
