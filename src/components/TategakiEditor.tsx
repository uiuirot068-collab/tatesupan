"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createDocument,
  deleteImage,
  loadAllImages,
  loadDocument,
  saveDocument,
  saveImage,
  type ImageRecord,
} from "@/lib/db";
import { computePageLayout, DEFAULT_PAGE_SETTINGS, type PageSettings } from "@/lib/pageLayout";
import { computeInsertedPartPageRange } from "@/utils/tocGenerator";
import { useEditorSettings } from "@/hooks/useEditorSettings";
import { useShortcuts } from "@/hooks/useShortcuts";
import { createProject, updateProject, getCloudProjectCount, getProjectById } from "@/lib/supabase/projects";
import { getCloudPlan, CLOUD_PROJECT_LIMITS, CLOUD_PROJECT_LIMIT_ERROR, type CloudPlan } from "@/lib/supabase/plans";
import type { Project } from "@/types/database";
import EditorPane from "./EditorPane";
import PreviewPane from "./PreviewPane";
import SearchReplaceModal from "./SearchReplaceModal";
import { BookPartsModal } from "./BookPartsModal";
import HelpModal from "./HelpModal";
import { Header } from "./Header";
import { SAMPLE_PROJECT } from "@/constants/sampleData";

type SaveStatus = "loading" | "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 1500;

export default function TategakiEditor({
  documentId,
  cloudProjectId,
}: {
  documentId?: number;
  cloudProjectId?: string;
}) {
  const router = useRouter();
  const [docId, setDocId] = useState<number | null>(
    documentId && Number.isFinite(documentId) ? documentId : null
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [plotNote, setPlotNote] = useState("");
  const isSampleRoute = documentId === SAMPLE_PROJECT.id;
  const [settings, setSettings] = useEditorSettings({ persist: !isSampleRoute });
  const [images, setImages] = useState<Record<string, string>>({});
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookPartsModalOpen, setIsBookPartsModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(50);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [cloudLimitPlan, setCloudLimitPlan] = useState<CloudPlan | null>(null);

  const hasLoadedRef = useRef(false);
  // Tracks which document's data is currently reflected in state, so the
  // autosave effect can refuse to write if a document switch is in flight.
  const loadedDocIdRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const layout = useMemo(() => computePageLayout(settings), [settings]);
  const isSampleDocument = docId === SAMPLE_PROJECT.id;

  const applyCloudProject = useCallback((project: Project) => {
    setCurrentProjectId(project.id);
    setTitle(project.title);
    setContent(project.content);
    setSettings((project.settings as PageSettings) ?? DEFAULT_PAGE_SETTINGS);
    setPlotNote("");
    loadedDocIdRef.current = null;
    setDocId(null);
  }, [setSettings]);

  useEffect(() => {
    let cancelled = false;

    // Block the autosave effect from firing with a mismatched
    // docId/content pair while this document switch is in flight.
    hasLoadedRef.current = false;
    setSaveStatus("loading");

    async function run() {
      if (cloudProjectId) {
        const project = await getProjectById(cloudProjectId);
        if (cancelled) return;
        if (!project) {
          setSaveStatus("error");
          return;
        }
        applyCloudProject(project);
        setImages({});
        hasLoadedRef.current = true;
        setSaveStatus("saved");
        return;
      }

      let id = documentId && Number.isFinite(documentId) ? documentId : null;
      const doc = id ? await loadDocument(id) : undefined;

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
  }, [applyCloudProject, cloudProjectId, documentId, router, setSettings]);

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
    if (isSampleDocument) return;
    saveImage(record).catch(() => setSaveStatus("error"));
  };

  const handleImageDelete = (id: string) => {
    setImages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (isSampleDocument) return;
    deleteImage(id).catch(() => setSaveStatus("error"));
  };

  useEffect(() => {
    if (!hasLoadedRef.current || docId === null) return;
    // Guard against saving while a document switch is mid-flight: state may
    // still hold the previous document's fields for one tick after docId
    // changes but before the new document's data has fully loaded.
    if (loadedDocIdRef.current !== docId) return;
    if (docId === SAMPLE_PROJECT.id) return;

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
    if (isSampleDocument) {
      showToast("使い方ガイドでの編集内容は保存されません");
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaveStatus("saving");
    saveDocument(docId, title, content, settings, plotNote)
      .then(() => {
        setSaveStatus("saved");
        showToast("下書きを保存しました");
      })
      .catch(() => setSaveStatus("error"));
  };

  useShortcuts([{ key: "s", handler: saveNow }]);

  const handleSave = async () => {
    if (isSampleDocument) return;
    setIsSaving(true);
    try {
      // Existing cloud projects can always be overwritten regardless of the
      // plan's count limit -- the limit only ever blocks brand-new saves.
      const isNewCloudSave = !currentProjectId;
      let knownPlan: CloudPlan | null = null;

      if (isNewCloudSave) {
        // UX-only early check: lets us show the "cloud bookshelf is full"
        // guidance before attempting the write. The DB trigger below is the
        // real enforcement and still runs even if this check is skipped due
        // to a network/plan-lookup error.
        const [{ plan, error: planError }, { count, error: countError }] = await Promise.all([
          getCloudPlan(),
          getCloudProjectCount(),
        ]);
        knownPlan = plan;

        if (!planError && !countError && plan && count !== null) {
          const limit = CLOUD_PROJECT_LIMITS[plan];
          if (limit !== null && count >= limit) {
            setCloudLimitPlan(plan);
            return;
          }
        }
      }

      const result = currentProjectId
        ? await updateProject(currentProjectId, { title, content, settings })
        : await createProject({ title, content, settings });

      if (result.error === CLOUD_PROJECT_LIMIT_ERROR) {
        setCloudLimitPlan(knownPlan ?? 'resident');
        return;
      }

      if (result.error || !result.data) {
        alert("クラウドへの保存に失敗しました: " + (result.error || "原因不明のエラー"));
        return;
      }

      if (!currentProjectId) setCurrentProjectId(result.data.id);
      alert("クラウドに保存しました！");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectProject = (project: Project) => {
    applyCloudProject(project);
  };

  const handleBookPartsInsert = (textToInsert: string, position: "start" | "end") => {
    const nextContent = position === "start" ? textToInsert + content : content + textToInsert;

    // 扉・目次・奥付は本文と異なりノンブル（柱含む）を表示しないのが慣例
    // なので、挿入した瞬間にそのパーツが占めるページへ自動でノンブル非表示
    // を設定する。ユーザーは挿入後もページ単位のチェックボックスで上書き可能。
    const range = computeInsertedPartPageRange(nextContent, textToInsert, position, {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
    });
    if (range) {
      setSettings((prev) => {
        const nextOverrides = { ...prev.pageOverrides };
        for (let pageNumber = range.startPage; pageNumber <= range.endPage; pageNumber++) {
          nextOverrides[pageNumber] = { ...nextOverrides[pageNumber], hideNombre: true };
        }
        return { ...prev, pageOverrides: nextOverrides };
      });
    }

    setContent(nextContent);
  };

  return (
    <div className="box-border flex h-screen w-screen flex-col gap-6 overflow-hidden bg-canvas px-6 pb-6 pt-4 md:pl-8 md:pr-10 md:pb-10 md:pt-6">
      <Header
        onSave={isSampleDocument ? undefined : handleSave}
        onSelectProject={isSampleDocument ? undefined : handleSelectProject}
        isSaving={isSaving}
        saveStatus={isSampleDocument ? undefined : saveStatus}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {isSampleDocument && (
        <p className="mx-auto -my-3 rounded-full bg-[#c5a059]/15 px-3 py-1 text-xs font-medium text-[#6f5727]">
          使い方ガイドでの編集内容は保存されません
        </p>
      )}

      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

      <main
        ref={mainRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden pr-4 pb-4 md:flex-row md:gap-2 md:pr-6 md:pb-6"
      >
        <section
          style={
            {
              "--editor-w": isPreviewCollapsed ? "auto" : `${editorWidthPercent}%`,
            } as React.CSSProperties
          }
          className={`flex min-h-[40vh] min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-base shadow-lg md:h-full md:min-h-full md:flex-none ${
            isPreviewCollapsed ? "md:w-auto md:grow" : "md:w-[var(--editor-w)]"
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

        <button
          type="button"
          onClick={() => setIsMobilePreviewOpen((prev) => !prev)}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-ink/10 bg-base px-4 py-2.5 text-sm font-medium text-ink/70 shadow-lg md:hidden"
        >
          <span aria-hidden>👁️</span>
          {isMobilePreviewOpen ? "プレビューを閉じる" : "プレビューを見る"}
        </button>

        {!isPreviewCollapsed && (
          <div
            onMouseDown={handleDividerMouseDown}
            className="hidden w-1 shrink-0 cursor-col-resize bg-ink/10 transition-all hover:w-2 hover:bg-accent/60 active:bg-accent md:block"
          />
        )}

        <section
          style={{ "--preview-w": `${100 - editorWidthPercent}%` } as React.CSSProperties}
          className={`min-h-0 min-w-0 transition-all duration-200 md:flex md:h-full md:flex-none ${
            isPreviewCollapsed ? "md:w-12" : "md:w-[var(--preview-w)] md:flex-1"
          } ${isMobilePreviewOpen ? "flex max-h-[85vh] shrink-0 flex-col overflow-y-auto" : "hidden"}`}
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
            isCollapsed={isPreviewCollapsed}
            onToggleCollapse={() => setIsPreviewCollapsed((prev) => !prev)}
          />
        </section>
      </main>

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

      {cloudLimitPlan && cloudLimitPlan !== "unlimited" && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setCloudLimitPlan(null)}
        >
          <div
            className="w-full max-w-sm rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-ink">クラウド本棚がいっぱいです</h3>
            <p className="mt-2 text-sm text-ink/70">
              {cloudLimitPlan === "light"
                ? `Lightプランではクラウドに最大${CLOUD_PROJECT_LIMITS.light}作品まで保存できます。すでに保存している作品は、引き続き編集できます。`
                : `無料会員ではクラウドに最大${CLOUD_PROJECT_LIMITS.resident}作品まで保存できます。すでに保存している作品は、引き続き編集できます。`}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setCloudLimitPlan(null)}
                className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-base hover:opacity-90"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
