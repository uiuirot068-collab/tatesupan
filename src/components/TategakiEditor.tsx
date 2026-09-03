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
  updateImageLayerOrder,
  type ImageRecord,
} from "@/lib/db";
import {
  computePageLayout,
  DEFAULT_PAGE_SETTINGS,
  updatePageOverrides,
  type PageSettings,
} from "@/lib/pageLayout";
import { computeInsertedPartPageRange } from "@/utils/tocGenerator";
import { withColophonDefaults } from "@/lib/colophon";
import { useEditorSettings } from "@/hooks/useEditorSettings";
import { useMobileFocusMode } from "@/hooks/useMobileFocusMode";
import { useShortcuts } from "@/hooks/useShortcuts";
import { createProject, updateProject, getCloudProjectCount, getProjectById } from "@/lib/supabase/projects";
import { getCloudPlan, CLOUD_PROJECT_LIMITS, CLOUD_PROJECT_LIMIT_ERROR, type CloudPlan } from "@/lib/supabase/plans";
import { syncManuscriptImages, restoreManuscriptImages } from "@/lib/supabase/manuscriptImages";
import { contentHasImages } from "@/lib/cloudImageSync";
import type { Project } from "@/types/database";
import EditorPane from "./EditorPane";
import PageSettingsPanel from "./PageSettingsPanel";
import PreviewPane from "./PreviewPane";
import SearchReplaceModal from "./SearchReplaceModal";
import { BookPartsModal } from "./BookPartsModal";
import ColophonModal from "./ColophonModal";
import HelpModal from "./HelpModal";
import BetaFeedbackModal from "./BetaFeedbackModal";
import { BETA_FEEDBACK_ENABLED } from "@/lib/betaFeedback";
import { Header } from "./Header";
import MobileEditorNav from "./MobileEditorNav";
import {
  DEMO_PROJECT,
  DEMO_SEED_CONTENT,
  isEphemeralDocId,
} from "@/constants/demoData";
import { useAuth } from "./AuthProvider";
import DemoTour from "./DemoTour";

type SaveStatus = "loading" | "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 1500;

export default function TategakiEditor({
  documentId,
  cloudProjectId,
  demoMode = false,
}: {
  documentId?: number;
  cloudProjectId?: string;
  /** TSP-LOOP-024: run the real editor as the disposable おためしデモ. */
  demoMode?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [docId, setDocId] = useState<number | null>(
    demoMode
      ? DEMO_PROJECT.id
      : documentId && Number.isFinite(documentId)
        ? documentId
        : null
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [plotNote, setPlotNote] = useState("");
  // The 使い方ガイド (SAMPLE_PROJECT) and the おためしデモ both run the real
  // editor with a document that lives only in memory — every persistence path
  // below is a no-op for them.
  const isEphemeralRoute = demoMode || isEphemeralDocId(documentId);
  const [settings, setSettings] = useEditorSettings({ persist: !isEphemeralRoute });
  const [images, setImages] = useState<Record<string, string>>({});
  // Front/back stacking rank per image id, sourced from ImageRecord.layerOrder
  // (see lib/db.ts) — kept entirely separate from `content`/IMG markers so
  // reordering layers never touches document text, tokenLength, or
  // pagination. Images with no entry here fall back to document/token order.
  const [imageLayerOrder, setImageLayerOrder] = useState<Record<string, number>>({});
  // TSP-LOOP-020 / TSP-LOOP-022: which primary workspace the phone (`< md`)
  // layout shows. On a phone the three main activities — 本文 / プレビュー /
  // 設定 — are mutually exclusive full-width surfaces (no scrolling past one
  // pane to reach another). TSP-022 promoted 設定 from "scroll to a strip
  // inside the editor" to a first-class workspace of its own. At `md+` this
  // is ignored: the editor+preview split and the inline settings strip render
  // exactly as before.
  const [mobileView, setMobileView] = useState<"editor" | "preview" | "settings">(
    "editor"
  );
  // 「集中モード」— a per-device localStorage-only UI preference (never
  // Supabase / manuscript data; default OFF). TSP-LOOP-012 introduced it for
  // narrow viewports; TSP-LOOP-023 extends the SAME flag to desktop:
  //  - `< md`  : the existing behaviour — header + editor toolbar strip hide,
  //              MobileEditorNav keeps 通常表示に戻す.
  //  - `md+`   : the desktop inline settings strip hides, the manuscript
  //              editor grows to (near) full width, and Preview is tucked to
  //              the right rail (kept one click away — same collapse
  //              affordance as the normal desktop preview-collapse), with the
  //              centre resize divider removed. The user's normal split width
  //              (`editorWidthPercent`) is never written by focus mode, so
  //              exiting restores it exactly.
  const [focusMode, setFocusMode] = useMobileFocusMode();
  // Whether Preview was collapsed *before* focus mode tucked it, so exiting
  // focus mode puts it back exactly as the user left it (not force-open).
  const preFocusPreviewCollapsedRef = useRef<boolean | null>(null);
  const enterFocusMode = () => {
    if (preFocusPreviewCollapsedRef.current === null) {
      preFocusPreviewCollapsedRef.current = isPreviewCollapsed;
    }
    setIsPreviewCollapsed(true);
    setFocusMode(true);
    setMobileView("editor");
  };
  const exitFocusMode = () => {
    setFocusMode(false);
    if (preFocusPreviewCollapsedRef.current !== null) {
      setIsPreviewCollapsed(preFocusPreviewCollapsedRef.current);
      preFocusPreviewCollapsedRef.current = null;
    }
  };

  // ---- TSP-LOOP-020 phone navigation (all no-ops of the DOM at md+) ----
  const scrollMobileTo = (id: string) => {
    // Double rAF so React has committed the view switch (the target may have
    // been `display:none` a moment ago) and layout is settled before we
    // scroll. `scroll-mt-28` on the targets keeps them clear of the sticky nav.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      })
    );
  };
  const scrollWindowTop = () =>
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
  const showEditorView = () => {
    setMobileView("editor");
    scrollMobileTo("tsp-manuscript");
  };
  const showPreviewView = () => {
    setMobileView("preview");
    // Jump to the top of the preview workspace rather than wherever the
    // document was scrolled to under the previous workspace.
    scrollWindowTop();
  };
  const showSettingsView = () => {
    // TSP-LOOP-022: 設定 is its own workspace now — no longer "switch to the
    // editor and scroll down to a strip".
    setMobileView("settings");
    scrollWindowTop();
  };
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookPartsModalOpen, setIsBookPartsModalOpen] = useState(false);
  const [isColophonModalOpen, setIsColophonModalOpen] = useState(false);
  const [isBetaFeedbackOpen, setIsBetaFeedbackOpen] = useState(false);
  // 本文の総ページ数（PreviewPane の pagination 結果）。奥付編集ポップアップの
  // 「本文の何ページ後」入力の目安・範囲外警告に使う。
  const [bodyPageCount, setBodyPageCount] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(50);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // TSP-LOOP-007: クラウド作品を開いた際、本文が参照するのに復元できなかった
  // 挿絵（missing = manifest にあるが Storage 取得不可 / unmanifested = 未同期）。
  // 非 null かつ配列が空でなければエディタ／エクスポートに警告を出す。
  const [unresolvedCloudImages, setUnresolvedCloudImages] = useState<{
    missing: string[];
    unmanifested: string[];
  } | null>(null);
  // 参照安定な Set（PageCard の memo を壊さない）。エクスポートブロック判定にも使う。
  const unresolvedImageIdSet = useMemo(
    () =>
      new Set<string>([
        ...(unresolvedCloudImages?.missing ?? []),
        ...(unresolvedCloudImages?.unmanifested ?? []),
      ]),
    [unresolvedCloudImages]
  );
  const [cloudLimitPlan, setCloudLimitPlan] = useState<CloudPlan | null>(null);
  // プレビューで選択中のページ（0-based index into PreviewPane's `pages`）。
  // 「ノンブル・柱」タブの選択ページパネル（PageSettingsPanel、EditorPane側）
  // がPreviewPaneと同じ選択状態を参照できるよう、ここに持ち上げてcontrolledにする。
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  const hasLoadedRef = useRef(false);
  // Tracks which document's data is currently reflected in state, so the
  // autosave effect can refuse to write if a document switch is in flight.
  const loadedDocIdRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const mainRef = useRef<HTMLElement | null>(null);

  const layout = useMemo(() => computePageLayout(settings), [settings]);
  const isSampleDocument = demoMode || isEphemeralDocId(docId);

  // pageOverrides は1始まりの印刷ページ番号でキーされる一方、selectedPages
  // （PreviewPaneの選択状態）は0-basedなインデックス——ここで一度だけ変換する。
  const selectedPageNumbers = useMemo(
    () => Array.from(selectedPages, (index) => index + 1).sort((a, b) => a - b),
    [selectedPages]
  );

  const applyCloudProject = useCallback((project: Project) => {
    setCurrentProjectId(project.id);
    setTitle(project.title);
    setContent(project.content);
    setSettings(
      withColophonDefaults((project.settings as PageSettings) ?? DEFAULT_PAGE_SETTINGS, project.title)
    );
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
      if (demoMode) {
        // TSP-LOOP-024: seed the disposable demo entirely in memory. No
        // loadDocument, no createDocument — nothing is read from or written
        // to IndexedDB, so the demo can never become a bookshelf project.
        setTitle("");
        setContent(DEMO_SEED_CONTENT);
        setSettings(DEFAULT_PAGE_SETTINGS);
        setPlotNote("");
        setImages({});
        setImageLayerOrder({});
        setUnresolvedCloudImages(null);
        setCurrentProjectId(null);
        loadedDocIdRef.current = DEMO_PROJECT.id;
        setDocId(DEMO_PROJECT.id);
        hasLoadedRef.current = true;
        setSaveStatus("saved");
        return;
      }

      if (cloudProjectId) {
        const project = await getProjectById(cloudProjectId);
        if (cancelled) return;
        if (!project) {
          setSaveStatus("error");
          return;
        }
        applyCloudProject(project);
        setImageLayerOrder({});
        setUnresolvedCloudImages(null);
        if (contentHasImages(project.content)) {
          // 別端末でも挿絵を復元する（元の image id を維持）。
          const restored = await restoreManuscriptImages(project.id, project.content);
          if (cancelled) return;
          setImages(restored.images);
          const unresolved = [...restored.missing, ...restored.unmanifested];
          setUnresolvedCloudImages(
            unresolved.length > 0
              ? { missing: restored.missing, unmanifested: restored.unmanifested }
              : null
          );
        } else {
          setImages({});
        }
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
      setImageLayerOrder(
        Object.fromEntries(
          imageRecords
            .filter((record) => record.layerOrder !== undefined)
            .map((record) => [record.id, record.layerOrder as number])
        )
      );

      loadedDocIdRef.current = id;
      setDocId(id);
      hasLoadedRef.current = true;
      setSaveStatus("saved");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [applyCloudProject, cloudProjectId, demoMode, documentId, router, setSettings]);

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

  // Persists a front/back stacking swap for a small group of images (see
  // PageCard.tsx's handleLayerMove) — never touches `content`/IMG markers,
  // so pagination/tokenLength are unaffected.
  const handleImageLayerChange = (updates: { id: string; layerOrder: number }[]) => {
    setImageLayerOrder((prev) => {
      const next = { ...prev };
      for (const update of updates) next[update.id] = update.layerOrder;
      return next;
    });
    if (isSampleDocument) return;
    for (const update of updates) {
      updateImageLayerOrder(update.id, update.layerOrder).catch(() => setSaveStatus("error"));
    }
  };

  useEffect(() => {
    if (!hasLoadedRef.current || docId === null) return;
    // Guard against saving while a document switch is mid-flight: state may
    // still hold the previous document's fields for one tick after docId
    // changes but before the new document's data has fully loaded.
    if (loadedDocIdRef.current !== docId) return;
    if (isSampleDocument) return;

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

      // TSP-LOOP-007: 本文・設定は保存済み。続けて挿絵を private Storage へ
      // 72h 同期する。画像期限（expires_at）は *完全成功時のみ* +72h される。
      const sync = await syncManuscriptImages({
        projectId: result.data.id,
        content,
        localImages: images,
      });
      if (sync.ok || sync.noImages) {
        setUnresolvedCloudImages(null);
        alert(
          sync.noImages
            ? "クラウドに保存しました！"
            : "クラウドに保存しました！（挿絵もクラウドへ同期しました）"
        );
      } else {
        // 本文は保存済みだが画像同期は未完了。既存の有効なクラウド画像・期限は
        // 壊していない。ユーザーへ明示し、再保存を促す（サイレント欠損を防ぐ）。
        setUnresolvedCloudImages({ missing: [], unmanifested: sync.unresolved });
        alert(
          "本文は保存しましたが、挿絵の一部をクラウドへ同期できませんでした。\n" +
            "元の画像がこの端末にあることを確認して、もう一度「クラウドに保存」してください。\n" +
            "（同期できるまで、別端末では該当画像が表示されません）"
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectProject = (project: Project) => {
    applyCloudProject(project);
  };

  const handleBookPartsInsert = (textToInsert: string, position: "start" | "end") => {
    const nextContent = position === "start" ? textToInsert + content : content + textToInsert;

    // 扉・目次・奥付は本文と異なりノンブルも柱も表示しないのが慣例なので、
    // 挿入した瞬間にそのパーツが占めるページへ自動でノンブル非表示・柱非表示
    // を設定する（両者は独立したフラグ——正式仕様上「柱は消さない」のは
    // ユーザーが個別に指定したページ単位のノンブル非表示のみで、この扉等の
    // 自動挿入は「柱も含めて表示しない」という別の既存意図を持つため、
    // ここでは明示的に両方をtrueにする）。ユーザーは挿入後もページ単位の
    // チェックボックスで一方だけ上書き可能。
    const range = computeInsertedPartPageRange(nextContent, textToInsert, position, {
      charsPerLine: layout.charsPerLine,
      linesPerPage: layout.linesPerPage,
    });
    if (range) {
      const pageNumbers: number[] = [];
      for (let pageNumber = range.startPage; pageNumber <= range.endPage; pageNumber++) {
        pageNumbers.push(pageNumber);
      }
      setSettings((prev) => ({
        ...prev,
        pageOverrides: updatePageOverrides(prev.pageOverrides, pageNumbers, (override) => ({
          ...override,
          hideNombre: true,
          hideHashira: true,
        })),
      }));
    }

    setContent(nextContent);
  };

  return (
    // TSP-LOOP-020 — `data-editor-shell` opts this route out of the global
    // `html/body { overflow:hidden; height:100vh }` viewport lock **only at
    // `< 768px`** (see globals.css), so a phone gets an ordinary scrolling
    // document. At `md+` every `md:` class below restores the original
    // viewport-locked, internally-scrolled workspace unchanged.
    <div
      data-editor-shell
      className="box-border flex w-full min-h-[100dvh] flex-col gap-3 bg-canvas px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+5rem)] md:h-screen md:w-screen md:gap-6 md:overflow-hidden md:pl-8 md:pr-10 md:pt-6 md:pb-10"
    >
      {/* Focus mode collapses the full header on narrow viewports only; at md+
          the wrapper is `display:contents`, so the header lays out exactly as
          before on desktop / tablet-wide. TSP-LOOP-022: on a phone the Header
          keeps only identity + account / theme / 保存作品一覧 — its 一覧 link,
          save button and ？ (all duplicated by the sticky MobileEditorNav) are
          `md+` only, so the phone header stops being a tall wrapped block. */}
      <div className={focusMode ? "hidden md:contents" : "contents"}>
        <Header
          onSave={isSampleDocument ? undefined : handleSave}
          onSelectProject={isSampleDocument ? undefined : handleSelectProject}
          isSaving={isSaving}
          saveStatus={isSampleDocument ? undefined : saveStatus}
          onOpenHelp={() => setIsHelpOpen(true)}
          focusMode={focusMode}
          onEnterFocus={enterFocusMode}
          onExitFocus={exitFocusMode}
        />
      </div>

      {isSampleDocument && (
        <p className="mx-auto -my-3 rounded-full bg-[#c5a059]/15 px-3 py-1 text-xs font-medium text-[#6f5727]">
          {demoMode
            ? "おためしデモの内容は保存されません（本棚にも残りません）"
            : "使い方ガイドでの編集内容は保存されません"}
        </p>
      )}

      {unresolvedCloudImages &&
        (unresolvedCloudImages.missing.length > 0 ||
          unresolvedCloudImages.unmanifested.length > 0) && (
          <p
            role="alert"
            className="mx-auto -my-3 max-w-2xl rounded-md bg-amber-100 px-3 py-1.5 text-center text-xs font-medium text-amber-800"
          >
            ⚠️ この作品の挿絵
            {unresolvedCloudImages.missing.length + unresolvedCloudImages.unmanifested.length}
            点は保存期限切れ、または取得できませんでした。プレビューでは期限切れの表示になり、JPG・PDF の書き出しはできません。画像を再度配置してください。
          </p>
        )}

      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}

      {BETA_FEEDBACK_ENABLED && isBetaFeedbackOpen && (
        <BetaFeedbackModal onClose={() => setIsBetaFeedbackOpen(false)} />
      )}

      {/* Phone-only sticky nav. A direct shell child (not inside <main>) so its
          only scroll ancestor is the document — `position:sticky; top:0`
          therefore pins it to the VIEWPORT and it stays reachable no matter
          which inner surface (textarea, preview canvas) owns a touch gesture.
          `md:hidden`, so desktop layout is untouched. */}
      <MobileEditorNav
        mobileView={mobileView}
        onShowEditor={showEditorView}
        onShowPreview={showPreviewView}
        onShowSettings={showSettingsView}
        focusMode={focusMode}
        onEnterFocus={enterFocusMode}
        onExitFocus={exitFocusMode}
        saveStatus={isSampleDocument ? undefined : saveStatus}
        onSave={isSampleDocument ? undefined : handleSave}
        isSaving={isSaving}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenFeedback={
          BETA_FEEDBACK_ENABLED ? () => setIsBetaFeedbackOpen(true) : undefined
        }
      />

      <main
        ref={mainRef}
        // Narrow (< md): an ordinary block in the scrolling document with NO
        // overflow of its own (the body's `overflow-x: clip` from globals.css
        // handles horizontal), so the page — not a nested container —
        // scrolls. Editor / Preview are mutually exclusive here (mobileView).
        // Wide (md+): unchanged — side-by-side, viewport-locked, panes scroll
        // internally.
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 md:flex-row md:gap-2 md:overflow-hidden md:pr-6 md:pb-6"
      >
        <section
          id="tsp-manuscript"
          style={
            {
              "--editor-w": isPreviewCollapsed ? "auto" : `${editorWidthPercent}%`,
            } as React.CSSProperties
          }
          // Narrow: a natural-height block in the scrolling document; the
          // textarea inside owns an intentional manuscript scroll (see
          // EditorPane). Hidden whenever the phone is showing another
          // workspace (プレビュー or 設定). Wide: md overrides restore the
          // fitted, viewport-locked pane unchanged.
          className={`flex min-w-0 shrink-0 scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-base shadow-lg md:scroll-mt-0 md:h-full md:min-h-full md:flex-none ${mobileView !== "editor" ? "max-md:hidden" : ""} ${focusMode || isPreviewCollapsed ? "md:w-auto md:grow" : "md:w-[var(--editor-w)]"}`}
        >
          <EditorPane
            title={title}
            onTitleChange={setTitle}
            content={content}
            onContentChange={setContent}
            onOpenSearchReplace={() => setIsSearchOpen(true)}
            onOpenBookParts={() => setIsBookPartsModalOpen(true)}
            onOpenBetaFeedback={() => setIsBetaFeedbackOpen(true)}
            settings={settings}
            layout={layout}
            onSettingsChange={setSettings}
            plotNote={plotNote}
            onPlotNoteChange={setPlotNote}
            onOpenHelp={() => setIsHelpOpen(true)}
            onCursorIndexChange={setCursorIndex}
            selectedPageNumbers={selectedPageNumbers}
            focusMode={focusMode}
          />
        </section>

        {!isPreviewCollapsed && !focusMode && (
          <div
            onMouseDown={handleDividerMouseDown}
            className="hidden w-1 shrink-0 cursor-col-resize bg-ink/10 transition-all hover:w-2 hover:bg-accent/60 active:bg-accent md:block"
          />
        )}

        <section
          style={{ "--preview-w": `${100 - editorWidthPercent}%` } as React.CSSProperties}
          // Narrow: a viewport-tall pane shown only when mobileView==="preview".
          // `max-md:overflow-hidden` on a fixed-height box clips any transient
          // spread overflow before the width-fit lands — PreviewPane owns the
          // single inner scroll/pan surface. Wide: md overrides restore the
          // side-by-side pane unchanged.
          // TSP-LOOP-023: in desktop focus mode an *expanded* Preview is a
          // capped-width side panel (`md:flex-none`, ~38% up to 480px) so the
          // manuscript editor stays dominant; collapsed it is the same thin
          // rail as the normal desktop collapse. Outside focus mode the normal
          // split (`--preview-w` / `md:flex-1`) is unchanged.
          className={`min-h-0 min-w-0 transition-all duration-200 max-md:overflow-hidden md:flex md:h-full md:flex-none ${
            isPreviewCollapsed
              ? "md:w-12"
              : focusMode
                ? "md:w-[38%] md:max-w-[480px]"
                : "md:w-[var(--preview-w)] md:flex-1"
          } ${mobileView === "preview" ? "flex h-[calc(100dvh-9rem)] shrink-0 flex-col" : "max-md:hidden"}`}
        >
          <PreviewPane
            content={content}
            title={title}
            settings={settings}
            layout={layout}
            images={images}
            imageLayerOrder={imageLayerOrder}
            unresolvedImageIds={unresolvedImageIdSet}
            blockExportForUnresolvedImages={unresolvedImageIdSet.size > 0}
            onContentChange={setContent}
            onSettingsChange={setSettings}
            onImageAdd={handleImageAdd}
            onImageDelete={handleImageDelete}
            onImageLayerChange={handleImageLayerChange}
            cursorIndex={cursorIndex}
            onBodyPageCountChange={setBodyPageCount}
            // On a phone showing the プレビュー workspace the preview is always
            // full — the collapse rail is a desktop-only affordance.
            isCollapsed={isPreviewCollapsed && mobileView !== "preview"}
            onToggleCollapse={() => setIsPreviewCollapsed((prev) => !prev)}
            selected={selectedPages}
            onSelectedChange={setSelectedPages}
          />
        </section>

        {/* TSP-LOOP-022 — dedicated phone 設定 workspace. `md:hidden`, so the
            desktop side-by-side layout (which keeps its settings strip inside
            EditorPane) is untouched. A natural-height block in the scrolling
            document, exactly like the phone 本文 surface — it uses the same
            controlled PageSettingsPanel as desktop (shared settings + onChange,
            no duplicated logic), just composed as its own full-width surface
            instead of a strip the user scrolls past. Kept mounted (only
            `hidden` toggles) so an in-progress settings draft / open tab
            survives switching to 本文 or プレビュー and back. */}
        <section
          id="tsp-settings-view"
          aria-label="設定"
          className={`scroll-mt-28 overflow-hidden rounded-2xl border border-ink/10 bg-base shadow-lg md:hidden ${
            mobileView === "settings" ? "" : "hidden"
          }`}
        >
          <PageSettingsPanel
            settings={settings}
            layout={layout}
            onChange={setSettings}
            plotNote={plotNote}
            onPlotNoteChange={setPlotNote}
            onOpenHelp={() => setIsHelpOpen(true)}
            selectedPageNumbers={selectedPageNumbers}
            mobileSurface
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
          onOpenColophonModal={() => {
            setIsBookPartsModalOpen(false);
            setIsColophonModalOpen(true);
          }}
          currentTitle={title}
          content={content}
          layout={layout}
          settings={settings}
        />
      )}

      {isColophonModalOpen && (
        <ColophonModal
          colophon={settings.colophon}
          bodyPageCount={bodyPageCount}
          onChange={(colophon) => setSettings((prev) => ({ ...prev, colophon }))}
          onClose={() => setIsColophonModalOpen(false)}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-lg border border-ink/10 bg-ink px-4 py-2 text-sm text-base shadow-lg">
          {toast}
        </div>
      )}

      {demoMode && (
        <DemoTour
          isMember={!!user}
          onPrepare={(view) => setMobileView(view)}
          onExit={() => router.push("/")}
          onExitToBookshelf={() => router.push("/")}
          onExitToNewProject={async () => {
            const id = await createDocument();
            router.push(`/editor?id=${id}`);
          }}
          onOpenFeatureGuide={() => router.push("/guide")}
        />
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
