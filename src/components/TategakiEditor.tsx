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
import { useMobileKeyboardViewport } from "@/hooks/useMobileKeyboardViewport";
import { useShortcuts } from "@/hooks/useShortcuts";
import { createProject, updateProject, getCloudProjectCount, getProjectById } from "@/lib/supabase/projects";
import { getCloudPlan, CLOUD_PROJECT_LIMITS, CLOUD_PROJECT_LIMIT_ERROR, type CloudPlan } from "@/lib/supabase/plans";
import { syncManuscriptImages, restoreManuscriptImages } from "@/lib/supabase/manuscriptImages";
import { contentHasImages } from "@/lib/cloudImageSync";
import type { Project } from "@/types/database";
import EditorPane, { type EditorPaneHandle } from "./EditorPane";
import PreviewPane from "./PreviewPane";
import ViewportDebugPanel from "./ViewportDebugPanel";
import SearchReplaceModal from "./SearchReplaceModal";
import { BookPartsModal, type BookPartTab } from "./BookPartsModal";
import ColophonModal from "./ColophonModal";
import HelpModal from "./HelpModal";
import PdfExportNoticeModal from "./PdfExportNoticeModal";
import { useShowPdfFilenameNotice } from "@/hooks/useShowPdfFilenameNotice";
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
import { useEditorSessionActivity } from "@/hooks/useEditorSessionActivity";
import { downloadLocalTxt, readLocalTxtFile, serializeReadableTxt } from "@/lib/txtTransfer";
import ChecklistPanel from "./ChecklistPanel";
import EditorSettingsDrawer from "./EditorSettingsDrawer";
import EditorOptionsDrawer from "./EditorOptionsDrawer";
import { memoDraftStorageKey } from "@/lib/memoDraft";

type SaveStatus = "loading" | "saved" | "saving" | "error";

const AUTOSAVE_DELAY_MS = 1500;

/**
 * TSP-PDF-GLOBAL-MODAL-AND-POST-NOTICE-CLEANUP-014B: the post-export
 * 「PDFを書き出しました」reminder is superseded by the pre-export safe
 * filename field now in the PDF setup modal. Disabled via this one flag
 * rather than deleted -- PdfExportNoticeModal, useShowPdfFilenameNotice, and
 * the isPdfNoticeOpen state below are kept intact for possible future reuse,
 * and the existing `今後も表示する` localStorage preference is left as-is.
 */
const PDF_POST_EXPORT_NOTICE_ENABLED = false;

export default function TategakiEditor({
  documentId,
  cloudProjectId,
  demoMode = false,
  viewportDebugEnabled = false,
}: {
  documentId?: number;
  cloudProjectId?: string;
  /** TSP-LOOP-024: run the real editor as the disposable おためしデモ. */
  demoMode?: boolean;
  /**
   * TSP-FQ04-PRODUCTION-RUNTIME-DIAGNOSTIC-004: mounts the read-only
   * `ViewportDebugPanel` (`?viewportDebug=1` only, see `EditorPageContent`).
   * Never true for an ordinary user; no behavior/layout side effects when false.
   */
  viewportDebugEnabled?: boolean;
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
  // TSP-EDITOR-LIVE-INPUT-LATENCY-002: PreviewPane is wrapped in React.memo,
  // but a *live* `content` prop changes every keystroke, so memo can never
  // bail and React still has to reconcile the entire (in LEGACY/non-V2
  // rendering, unvirtualized) page-list subtree on every keystroke -- real
  // CPU profiling on a 260k-char manuscript showed this costing ~300ms per
  // keystroke even after PreviewPane's own internal content debounce, purely
  // from React re-visiting hundreds of PageCard fibers to confirm nothing
  // changed. Feeding PreviewPane a debounced snapshot instead lets memo
  // actually skip that whole subtree during a typing burst; PreviewPane's
  // own internal debounce (for pagination) still governs how fresh the
  // rendered pages are, unchanged from before. PDF/JPG export already
  // captures whatever is currently rendered (html2canvas-style DOM capture),
  // so this doesn't add any new staleness window beyond what already existed.
  const PREVIEW_PROP_DEBOUNCE_MS = 180;
  const [previewContent, setPreviewContent] = useState(content);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPreviewContent(content);
    }, PREVIEW_PROP_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [content]);
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
  const [mobileView, setMobileView] = useState<"editor" | "preview">(
    "editor"
  );
  // 「集中モード」— a per-device localStorage-only UI preference (never
  // Supabase / manuscript data; default OFF). TSP-LOOP-012 introduced it for
  // narrow viewports; TSP-LOOP-023 extends the SAME flag to desktop:
  //  - `< md`  : secondary/status surfaces hide while the compact manuscript
  //              action row remains; MobileEditorNav keeps 通常表示に戻す.
  //  - `md+`   : the desktop inline settings strip hides, the manuscript
  //              editor grows to (near) full width, and Preview is tucked to
  //              the right rail (kept one click away — same collapse
  //              affordance as the normal desktop preview-collapse), with the
  //              centre resize divider removed. The user's normal split width
  //              (`editorWidthPercent`) is never written by focus mode, so
  //              exiting restores it exactly.
  const [focusMode, setFocusMode] = useMobileFocusMode();
  // TSP-FRIEND-QA-MOBILE-VISUAL-VIEWPORT-001: mobile-only (see the hook's
  // own doc) visible-viewport tracking so the shell height below follows the
  // real visible area instead of the pre-keyboard `100dvh`, and secondary
  // Editor chrome can step aside temporarily while the keyboard is open.
  const { visibleHeight, keyboardActive } = useMobileKeyboardViewport();
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isBookPartsModalOpen, setIsBookPartsModalOpen] = useState(false);
  const [bookPartsInitialTab, setBookPartsInitialTab] = useState<BookPartTab>("colophon");
  const [isColophonModalOpen, setIsColophonModalOpen] = useState(false);
  const [isBetaFeedbackOpen, setIsBetaFeedbackOpen] = useState(false);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [activeDrawer, setActiveDrawer] = useState<"settings" | "options" | null>(null);
  // 本文の総ページ数（PreviewPane の pagination 結果）。奥付編集ポップアップの
  // 「本文の何ページ後」入力の目安・範囲外警告に使う。
  const [bodyPageCount, setBodyPageCount] = useState(0);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // TSP-LOOP-028: post-export filename reminder. The notice is app-level (not
  // scoped to the preview pane) so it stays visible whatever the phone
  // workspace does after export. `showPdfFilenameNotice` is a per-device
  // localStorage preference — default ON, never manuscript / cloud data.
  const [showPdfFilenameNotice, setShowPdfFilenameNotice] =
    useShowPdfFilenameNotice();
  const [isPdfNoticeOpen, setIsPdfNoticeOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");
  const [editorWidthPercent, setEditorWidthPercent] = useState<number>(50);
  const [cursorIndex, setCursorIndex] = useState<number | null>(null);
  // TSP-PREVIEW-SYNC-STABILITY-011: navigation-origin guard for the
  // PREVIEW_TO_EDITOR transaction. `navigateEditorToGlobalOffset` below moves
  // the Editor caret as a SIDE EFFECT of landing at the Preview-requested
  // offset; that caret change must not echo back into ANOTHER (unrelated-
  // looking) Preview auto-scroll away from the page the user just navigated
  // FROM -- Preview is already showing the right place, having just
  // initiated this jump itself. Storing the exact expected post-jump global
  // offset (rather than a plain boolean) keeps this self-correcting: it only
  // ever suppresses the ONE cursorIndex value this specific transaction
  // produces, so a same-offset no-op jump can never wrongly swallow a LATER,
  // unrelated caret move, and ordinary typing/caret movement (which never
  // sets this ref) is completely unaffected and keeps driving Preview follow
  // exactly as before.
  const suppressPreviewFollowForRef = useRef<number | null>(null);
  // TSP-EDITOR-PAGINATION-AND-PREVIEW-NAVIGATION-009 Phase 6: lets a Preview
  // page click drive the Editor to that page's source location, regardless
  // of which editor surface (FULL textarea or PagedEditor) is mounted.
  const editorPaneRef = useRef<EditorPaneHandle>(null);
  const navigateEditorToGlobalOffset = useCallback((start: number, end: number) => {
    // `end` is always a valid offset into the CURRENT canonical manuscript
    // here (callers derive it from `pageSourceRanges`/issue offsets computed
    // against that same manuscript) -- no clamping needed, and reading
    // `content` directly would make this callback's identity change on every
    // keystroke, defeating PreviewPane's memo (see its own prop's doc).
    suppressPreviewFollowForRef.current = end;
    setMobileView("editor");
    editorPaneRef.current?.navigateToGlobalOffset(start, end);
  }, []);
  // TSP-EDITOR-LIVE-INPUT-LATENCY-002: cursorIndex advances on every
  // keystroke same as content, so it must be debounced the same way before
  // reaching PreviewPane -- otherwise React.memo's prop comparison would
  // still see a change every keystroke (via this prop alone) and re-render/
  // reconcile the whole page-list subtree even with `previewContent` stable.
  const [previewCursorIndex, setPreviewCursorIndex] = useState(cursorIndex);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      // PREVIEW_TO_EDITOR transaction completing: this is the caret echo the
      // jump itself produced -- consume the guard and skip re-driving
      // Preview's own cursor-follow with it (see suppressPreviewFollowForRef
      // above). Any OTHER cursorIndex value (ordinary caret movement,
      // Editor Page switch, Writing Check jump) is unaffected.
      if (suppressPreviewFollowForRef.current !== null && suppressPreviewFollowForRef.current === cursorIndex) {
        suppressPreviewFollowForRef.current = null;
        return;
      }
      setPreviewCursorIndex(cursorIndex);
    }, PREVIEW_PROP_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [cursorIndex]);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const workSessionScope = useMemo(() => {
    if (demoMode) return `demo:${DEMO_PROJECT.id}`;
    const projectId = cloudProjectId ?? currentProjectId;
    if (projectId) return `cloud:${projectId}`;
    return docId === null ? null : `local:${docId}`;
  }, [cloudProjectId, currentProjectId, demoMode, docId]);
  const {
    workSession,
    recordActivity,
    startWorkSession,
    pauseWorkSession,
    resumeWorkSession,
    endWorkSession,
  } = useEditorSessionActivity(workSessionScope);
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
  const memoStorageKey = useMemo(
    () => memoDraftStorageKey(currentProjectId ? `cloud:${currentProjectId}` : `local:${docId ?? "new"}`),
    [currentProjectId, docId]
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
  const txtInputRef = useRef<HTMLInputElement | null>(null);

  const layout = useMemo(() => computePageLayout(settings), [settings]);
  const isSampleDocument = demoMode || isEphemeralDocId(docId);

  // pageOverrides は1始まりの印刷ページ番号でキーされる一方、selectedPages
  // （PreviewPaneの選択状態）は0-basedなインデックス——ここで一度だけ変換する。
  const selectedPageNumbers = useMemo(
    () => Array.from(selectedPages, (index) => index + 1).sort((a, b) => a - b),
    [selectedPages]
  );

  const exportSourceTxt = () => {
    downloadLocalTxt(title || "TateSpun", content, { bom: false, newlines: "lf" });
    setToast("原稿データTXTを書き出しました（UTF-8・BOMなし・LF）。");
  };

  const exportReadableTxt = () => {
    downloadLocalTxt(`${title || "TateSpun"}_整形本文`, serializeReadableTxt(content), { bom: false, newlines: "lf" });
    setToast("整形本文TXTを書き出しました（記法・画像情報なし）。");
  };

  const importTxt = async (file: File) => {
    const replacement = await readLocalTxtFile(file, { newlines: "lf" });
    if (content.length > 0 && !window.confirm("現在の原稿をTXTの内容で置き換えます。続けますか？")) return;
    const imageIds = Array.from(replacement.matchAll(/【IMG:([^:：】]+):/g), (match) => match[1]);
    setContent(replacement);
    setImages({});
    setImageLayerOrder({});
    setUnresolvedCloudImages(imageIds.length > 0 ? { missing: imageIds, unmanifested: [] } : null);
    setToast(imageIds.length > 0
      ? "TXTを読み込みました。画像データはTXTに含まれないため、画像を再設定してください。"
      : "TXTを読み込みました。");
  };

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

  // TSP-EDITOR-LIVE-INPUT-LATENCY-002: these 5 callbacks are PreviewPane
  // props, and PreviewPane is wrapped in React.memo specifically so a
  // typing burst (which only changes `previewContent`/`previewCursorIndex`
  // on a debounce, not every keystroke) can skip reconciling its large
  // page-list subtree. A plain function declaration is a NEW reference on
  // every TategakiEditor render, which defeats that memo on its own --
  // this codebase's `react-hooks/preserve-manual-memoization` ESLint rule
  // assumes the React Compiler auto-memoizes these instead, but the
  // compiler is not actually enabled (no `experimental.reactCompiler` in
  // next.config.ts), so nothing does. useCallback with the real reactive
  // dependencies (excluding the always-stable useState setters, per the
  // ordinary react-hooks/exhaustive-deps convention) is correct for the
  // runtime that actually ships; the lint rule is suppressed accordingly.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleImageAdd = useCallback((record: ImageRecord) => {
    setImages((prev) => ({ ...prev, [record.id]: record.dataUrl }));
    if (isSampleDocument) return;
    saveImage(record).catch(() => setSaveStatus("error"));
  }, [isSampleDocument]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleImageDelete = useCallback((id: string) => {
    setImages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (isSampleDocument) return;
    deleteImage(id).catch(() => setSaveStatus("error"));
  }, [isSampleDocument]);

  // Persists a front/back stacking swap for a small group of images (see
  // PageCard.tsx's handleLayerMove) — never touches `content`/IMG markers,
  // so pagination/tokenLength are unaffected.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleImageLayerChange = useCallback((updates: { id: string; layerOrder: number }[]) => {
    setImageLayerOrder((prev) => {
      const next = { ...prev };
      for (const update of updates) next[update.id] = update.layerOrder;
      return next;
    });
    if (isSampleDocument) return;
    for (const update of updates) {
      updateImageLayerOrder(update.id, update.layerOrder).catch(() => setSaveStatus("error"));
    }
  }, [isSampleDocument]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handlePreviewPdfExportSuccess = useCallback(() => {
    if (PDF_POST_EXPORT_NOTICE_ENABLED && showPdfFilenameNotice) setIsPdfNoticeOpen(true);
  }, [showPdfFilenameNotice]);

  const handleTogglePreviewCollapse = useCallback(() => {
    setIsPreviewCollapsed((prev) => !prev);
  }, []);

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
        .then(() => { setSaveStatus("saved"); })
        .catch(() => { setSaveStatus("error"); });
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

    // Generated book-part prose is programmatic and excluded from the
    // Human-written character count together with its structural markers.

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
    // Round 2: the route shell owns one dynamic viewport on narrow screens.
    // Each active manuscript/preview/drawer surface scrolls internally; no
    // global body lock is introduced, so other routes retain normal scrolling.
    <div
      data-editor-shell
      data-demo-mode={demoMode ? "" : undefined}
      data-editor-save-status={saveStatus}
      data-keyboard-active={keyboardActive ? "" : undefined}
      // `--tsp-visible-vh` is consumed only by the mobile-scoped override in
      // globals.css; unset (desktop, unsupported browsers) it falls back to
      // the existing `100dvh` utility below untouched.
      style={
        {
          "--tsp-visible-vh": visibleHeight != null ? `${visibleHeight}px` : undefined,
        } as React.CSSProperties
      }
      className="box-border flex h-[100dvh] min-h-0 w-full flex-col gap-2 overflow-hidden bg-canvas px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:h-screen md:min-h-[100dvh] md:w-screen md:gap-6 md:pl-8 md:pr-10 md:pt-6 md:pb-10"
    >
      {/* TSP-FQ04-PRODUCTION-RUNTIME-DIAGNOSTIC-004: `?viewportDebug=1` only
          -- `position: fixed`, so its own presence cannot perturb this
          shell's own flex layout or measured height. */}
      {viewportDebugEnabled && <ViewportDebugPanel />}
      <input
        ref={txtInputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importTxt(file).catch((cause: unknown) => setToast(cause instanceof Error ? cause.message : String(cause)));
        }}
      />
      {/* Focus mode collapses the full header at every viewport width, so the
          vertical space it occupied is reclaimed by the manuscript/preview
          workspace. `hidden` (display:none) removes it from layout and tab
          order without unmounting it, so its state and Focus-mode toggle are
          intact the instant focus mode exits and the header returns. Desktop
          exit uses `onExitFocus` surfaced beside 報告 in EditorPane's action
          row instead; on a phone MobileEditorNav (rendered outside this slot)
          already owns enter/exit, unaffected by this change. */}
      <div data-editor-header-slot="" className={focusMode ? "hidden" : "flex-none"}>
        <Header
          onSave={isSampleDocument ? undefined : handleSave}
          onSelectProject={isSampleDocument ? undefined : handleSelectProject}
          isSaving={isSaving}
          saveStatus={isSampleDocument ? undefined : saveStatus}
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

      {/* Phone-only navigation remains a fixed flex row in the viewport shell;
          manuscript and preview own their independent scrolling surfaces. */}
      <MobileEditorNav
        mobileView={mobileView}
        onShowEditor={showEditorView}
        onShowPreview={showPreviewView}
        focusMode={focusMode}
        onEnterFocus={enterFocusMode}
        onExitFocus={exitFocusMode}
        saveStatus={isSampleDocument ? undefined : saveStatus}
        onSave={isSampleDocument ? undefined : handleSave}
        isSaving={isSaving}
      />

      <main
        ref={mainRef}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden md:flex-row md:pr-6 md:pb-6"
      >
        <section
          id="tsp-manuscript"
          style={
            {
              "--editor-w": isPreviewCollapsed ? "auto" : `${editorWidthPercent}%`,
            } as React.CSSProperties
          }
          className={`flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink/10 bg-base shadow-lg md:flex-none ${mobileView !== "editor" ? "max-md:hidden" : ""} ${focusMode || isPreviewCollapsed ? "md:w-auto md:grow" : "md:w-[var(--editor-w)]"}`}
        >
          <EditorPane
            ref={editorPaneRef}
            title={title}
            onTitleChange={setTitle}
            content={content}
            onContentChange={setContent}
            workSession={workSession}
            onRecordActivity={recordActivity}
            onStartWorkSession={startWorkSession}
            onPauseWorkSession={pauseWorkSession}
            onResumeWorkSession={resumeWorkSession}
            onEndWorkSession={endWorkSession}
            onOpenSearchReplace={() => setIsSearchOpen(true)}
            onOpenBetaFeedback={BETA_FEEDBACK_ENABLED ? () => setIsBetaFeedbackOpen(true) : undefined}
            onOpenOptions={() => setActiveDrawer("options")}
            onToggleMemo={() => { setActiveDrawer(null); setIsMemoOpen((open) => !open); }}
            memoOpen={isMemoOpen}
            memoStorageKey={memoStorageKey}
            confirmedMemo={plotNote}
            onConfirmMemo={setPlotNote}
            onCloseMemo={() => setIsMemoOpen(false)}
            onOpenSettingsDrawer={() => setActiveDrawer("settings")}
            onOpenHelp={() => { setActiveDrawer(null); setIsHelpOpen(true); }}
            onCursorIndexChange={setCursorIndex}
            focusMode={focusMode}
            onExitFocus={exitFocusMode}
            keyboardActive={keyboardActive}
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
          // Narrow: fills the remaining dynamic viewport; PreviewPane owns the
          // single inner scroll/pan surface. Wide keeps the existing split.
          // TSP-LOOP-023: in desktop focus mode an *expanded* Preview is a
          // capped-width side panel (`md:flex-none`, ~38% up to 480px) so the
          // manuscript editor stays dominant; collapsed it is the same thin
          // rail as the normal desktop collapse. Outside focus mode the normal
          // split (`--preview-w` / `md:flex-1`) is unchanged.
          className={`min-h-0 min-w-0 transition-all duration-200 overflow-hidden md:flex md:h-full md:flex-none ${
            isPreviewCollapsed
              ? "md:w-12"
              : focusMode
                ? "md:w-[38%] md:max-w-[480px]"
                : "md:w-[var(--preview-w)] md:flex-1"
          } ${mobileView === "preview" ? "flex h-full flex-1 flex-col" : "max-md:hidden"}`}
        >
          <PreviewPane
            content={previewContent}
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
            cursorIndex={previewCursorIndex}
            onNavigateToSource={navigateEditorToGlobalOffset}
            onBodyPageCountChange={setBodyPageCount}
            onPdfExportSuccess={handlePreviewPdfExportSuccess}
            // On a phone showing the プレビュー workspace the preview is always
            // full — the collapse rail is a desktop-only affordance.
            isCollapsed={isPreviewCollapsed && mobileView !== "preview"}
            onToggleCollapse={handleTogglePreviewCollapse}
            selected={selectedPages}
            onSelectedChange={setSelectedPages}
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

      {isChecklistOpen && <ChecklistPanel onClose={() => setIsChecklistOpen(false)} />}

      {activeDrawer === "settings" && <EditorSettingsDrawer settings={settings} layout={layout} onChange={setSettings} selectedPageNumbers={selectedPageNumbers} onClose={() => setActiveDrawer(null)} />}

      {activeDrawer === "options" && (
        <EditorOptionsDrawer
          onOpenVerticalColophon={() => { setBookPartsInitialTab("colophon"); setIsBookPartsModalOpen(true); }}
          onOpenHorizontalColophon={() => setIsColophonModalOpen(true)}
          onOpenToc={() => { setBookPartsInitialTab("toc"); setIsBookPartsModalOpen(true); }}
          onOpenChecklist={() => setIsChecklistOpen(true)}
          onImportSourceTxt={() => txtInputRef.current?.click()}
          onExportSourceTxt={exportSourceTxt}
          onExportReadableTxt={exportReadableTxt}
          onClose={() => setActiveDrawer(null)}
        />
      )}

      {isPdfNoticeOpen && (
        <PdfExportNoticeModal
          initialKeepShowing={showPdfFilenameNotice}
          onClose={(keepShowing) => {
            // Every dismiss path (閉じる / ✕ / Escape / backdrop) commits the
            // checkbox exactly as it stands — a toggle alone never persists.
            setShowPdfFilenameNotice(keepShowing);
            setIsPdfNoticeOpen(false);
          }}
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
          initialTab={bookPartsInitialTab}
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
