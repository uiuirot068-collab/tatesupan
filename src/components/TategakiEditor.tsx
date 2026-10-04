"use client";

import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  createDocument,
  deleteImage,
  listDocuments,
  listStoredImageIds,
  loadDocument,
  loadImagesByIds,
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
import { useMobileSharedExport } from "@/hooks/useMobileSharedExport";
import { PREVIEW_EXPORT_STAGE_CLASS } from "@/lib/previewExportStage";
import { useMobileFocusMode } from "@/hooks/useMobileFocusMode";
import { mobileShellHeightStyle, useMobileKeyboardViewport } from "@/hooks/useMobileKeyboardViewport";
import { useShortcuts } from "@/hooks/useShortcuts";
import { createProject, updateProject, getCloudProjectCount, getProjectById } from "@/lib/supabase/projects";
import { getCloudPlan, CLOUD_PROJECT_LIMITS, CLOUD_PROJECT_LIMIT_ERROR, type CloudPlan } from "@/lib/supabase/plans";
import { syncManuscriptImages, restoreManuscriptImages, getUnresolvedManuscriptImages } from "@/lib/supabase/manuscriptImages";
import { contentHasImages, openedCloudProjectImageState, referencedImageIds, referencedImageSignature, technicallyUnresolvedImages, withoutUnresolvedImageIds } from "@/lib/cloudImageSync";
import { DocumentEpoch } from "@/lib/documentScope";
import { flushPendingAutosave, PendingAutosave } from "@/lib/pendingAutosave";
import { lockUserSelect } from "@/lib/bodyUserSelect";
import { imageIdsToTopUp, imageStateFromRecords } from "@/lib/documentImages";
import { imageMarkerIds } from "@/lib/tategaki";
import { imageOriginalDeletable, imageUsedByOtherWorks } from "@/lib/imageCenter";
import type { Project } from "@/types/database";
import { cloudCompareLocalCopyTitle, isCloudVersionChanged, type CloudVersionBase } from "@/lib/cloudVersionCompare";
import CloudVersionCompareModal from "./CloudVersionCompareModal";
import { clearCloudLink, readCloudLink, writeCloudLink } from "@/lib/cloudLink";
import EditorPane, { type EditorPaneHandle } from "./EditorPane";
import { DesktopReviewBarMount } from "./DesktopReviewBar";
import { useReviewSurface } from "@/hooks/useReviewSurface";
import PreviewPane from "./PreviewPane";
import SearchReplaceModal from "./SearchReplaceModal";
import { BookPartsModal, type BookPartTab } from "./BookPartsModal";
import ColophonModal from "./ColophonModal";
import CoverModal from "./cover/CoverModal";
import CoverExportDialog from "./cover/CoverExportDialog";
import { coverImageIds, type CoverFaceSide, type CoverSettings } from "@/lib/cover/coverModel";
import { keepCover, settingsWithoutCover } from "@/lib/cover/coverSettingsSync";
import HelpModal from "./HelpModal";
import PdfExportNoticeModal from "./PdfExportNoticeModal";
import { useShowPdfFilenameNotice } from "@/hooks/useShowPdfFilenameNotice";
import BetaFeedbackModal from "./BetaFeedbackModal";
import { BETA_FEEDBACK_ENABLED } from "@/lib/betaFeedback";
import { Header } from "./Header";
import MobileEditorNav from "./MobileEditorNav";
import ExportSupportLine from "./ExportSupportLine";
import { rememberExportSupportLineDismissed } from "@/lib/exportSupportLineSession";
import {
  DEMO_PROJECT,
  DEMO_SEED_CONTENT,
  DEMO_SEED_CONTENT_MOBILE,
  isEphemeralDocId,
} from "@/constants/demoData";
import { useAuth } from "./AuthProvider";
import DemoTour from "./DemoTour";
import { useEditorSessionActivity } from "@/hooks/useEditorSessionActivity";
import { downloadLocalTxt, readLocalTxtFile, serializeReadableTxt } from "@/lib/txtTransfer";
import { readDocxFile } from "@/lib/docxImport";
import ChecklistPanel from "./ChecklistPanel";
import EditorSettingsDrawer from "./EditorSettingsDrawer";
import EditorOptionsDrawer from "./EditorOptionsDrawer";
import { memoDraftStorageKey } from "@/lib/memoDraft";
import { headingAtCursor, manuscriptHeadings, plotPanelStorageKey } from "@/lib/plotPanel";
import { resolveExportFilenameStem } from "@/utils/exportFilename";
import { createDefaultTocSettings } from "@/lib/tocSettings";

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
  // Phase 3 stale-layout export guard: export must refer to the LIVE text, not
  // the debounced `previewContent` snapshot. Synced after commit; read only
  // from event handlers (export clicks), never during render.
  const liveContentRef = useRef(content);
  useEffect(() => {
    liveContentRef.current = content;
  }, [content]);
  const getLatestContent = useCallback(() => liveContentRef.current, []);
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
  // CST-PORT-011: 表紙画像（IndexedDB の id → dataUrl）。本文の挿絵とは別に持つ
  // （本文の組版・画像管理センターには入れない）。
  const [coverImages, setCoverImages] = useState<Record<string, string>>({});
  const [coverModalSide, setCoverModalSide] = useState<CoverFaceSide | null>(null);
  const [isCoverExportOpen, setIsCoverExportOpen] = useState(false);
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
  // CST-PORT-012: 3D のノド注意 →「ノドを調整する」で開いたときだけ、設定のノド欄を示す
  const [settingsFocus, setSettingsFocus] = useState<"gutter" | null>(null);
  const openGutterSetting = useCallback(() => {
    setSettingsFocus("gutter");
    setActiveDrawer("settings");
  }, []);
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
  // 検索・置換: the whole-manuscript search lives in SearchReplaceModal; the
  // editor surface (FULL or WINDOWED) only reveals / replaces the range.
  const revealSearchMatch = useCallback((start: number, end: number) => {
    editorPaneRef.current?.revealSearchMatch(start, end);
  }, []);
  const replaceSearchMatch = useCallback((start: number, end: number, text: string) => {
    editorPaneRef.current?.replaceSearchMatch(start, end, text);
  }, []);
  const markSearchReplaced = useCallback((range: { start: number; end: number } | null) => {
    editorPaneRef.current?.setSearchMark(range);
  }, []);
  // すべて置換 goes through the editor too, so it is ONE undoable body edit
  // (Ctrl+Z / 元に戻す) on both surfaces instead of a history-wiping setContent.
  const replaceWholeText = useCallback((next: string) => {
    if (editorPaneRef.current) editorPaneRef.current.replaceWholeText(next);
    else setContent(next);
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
  // TSP-UX-V3-LOOP3-MOBILE-SHARED-EXPORT: phone Editor-view access to the
  // Preview's own 書き出し menu (state only -- see the hook's doc).
  const sharedExport = useMobileSharedExport({ mobileView, isPreviewCollapsed, setIsPreviewCollapsed });
  // SPN-SUPPORT-003: a phone export started from the 編集 view runs in the
  // off-screen Preview, so its after-export support line is mirrored here.
  const [isExportSupportLineVisible, setIsExportSupportLineVisible] = useState(false);
  const dismissEditorExportSupportLine = useCallback(() => {
    setIsExportSupportLineVisible(false);
    rememberExportSupportLineDismissed();
  }, []);
  const [toast, setToast] = useState<string | null>(null);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  // CST-PORT-014: the cloud version this screen last opened or saved
  // (updated_at + title + content). A save first checks the cloud; if it was
  // saved there since (other device / tab), the compare dialog asks which
  // version to keep.
  const cloudBaseRef = useRef<CloudVersionBase | null>(null);
  const [cloudCompare, setCloudCompare] = useState<{ cloud: Project; base: string | null } | null>(null);
  const [cloudCompareBusy, setCloudCompareBusy] = useState(false);
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
  // Phase 4: ids already broken when this document was OPENED. They get the
  // persistent footer warning but not the interruption modal, which is for a
  // link that breaks while the editor is open (see imageWarningLifecycle.ts).
  const [imageWarningBaselineIds, setImageWarningBaselineIds] = useState<ReadonlySet<string>>(() => new Set());
  // Phase 6.1: true while an opened cloud project's images are being restored.
  // The manifest poll waits for it: until then `images` is still the previous
  // document's pool, so the poll would report this project's images as broken.
  const [cloudImagesRestoring, setCloudImagesRestoring] = useState(false);
  // 参照安定な Set（PageCard の memo を壊さない）。エクスポートブロック判定にも使う。
  const unresolvedImageIdSet = useMemo(
    () =>
      new Set<string>([
        ...(unresolvedCloudImages?.missing ?? []),
        ...(unresolvedCloudImages?.unmanifested ?? []),
      ]),
    [unresolvedCloudImages]
  );
  // Cloud editor stays aware of 72h expiry while it is open. Manifest-only polling is
  // intentionally light (60s); it does not download image blobs and local-only documents never poll.
  // Phase 7: the check depends on the SET of referenced image ids, not on the
  // text — before, every keystroke re-ran this effect, sent a request and
  // restarted the 60 s interval. It still re-runs when a marker is added or
  // removed, the image pool changes, or another document/project opens.
  const referencedImageKey = useMemo(() => referencedImageSignature(content), [content]);
  useEffect(() => {
    if (!currentProjectId || cloudImagesRestoring || referencedImageKey === "") return;
    let cancelled = false;
    const refresh = async () => {
      // Only the referenced ids are used; the live text has exactly this set (or a newer one).
      const status = await getUnresolvedManuscriptImages(currentProjectId, liveContentRef.current);
      if (cancelled || status.error) return;
      // 72hはクラウド一時コピーだけの期限。今のブラウザに元画像が残っているIDは
      // 実際には表示・出力可能なので「画像切れ」にはしない。
      setUnresolvedCloudImages(technicallyUnresolvedImages(status, images));
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [cloudImagesRestoring, currentProjectId, images, referencedImageKey]);
  const memoStorageKey = useMemo(
    () => memoDraftStorageKey(currentProjectId ? `cloud:${currentProjectId}` : `local:${docId ?? "new"}`),
    [currentProjectId, docId]
  );
  // PLT-LOOP-003: the plot read beside the manuscript lives in its own drawer,
  // per work, next to (never inside) the memo and the manuscript.
  const plotStorageKey = useMemo(
    () => plotPanelStorageKey(currentProjectId ? `cloud:${currentProjectId}` : `local:${docId ?? "new"}`),
    [currentProjectId, docId]
  );
  // Headings are only read while the panel is open, and from a deferred copy
  // of the manuscript so typing never waits on them.
  const deferredContentForPlot = useDeferredValue(isMemoOpen ? content : "");
  const plotHeadings = useMemo(() => manuscriptHeadings(deferredContentForPlot), [deferredContentForPlot]);
  const plotCurrentHeading = headingAtCursor(plotHeadings, cursorIndex);
  const [cloudLimitPlan, setCloudLimitPlan] = useState<CloudPlan | null>(null);
  // プレビューで選択中のページ（0-based index into PreviewPane's `pages`）。
  // 「ノンブル・柱」タブの選択ページパネル（PageSettingsPanel、EditorPane側）
  // がPreviewPaneと同じ選択状態を参照できるよう、ここに持ち上げてcontrolledにする。
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  // Phase 6: this component is not remounted when the open document changes
  // (see lib/documentScope.ts). `beginDocumentSwitch` is the ONE place that
  // invalidates in-flight handler work for the previous document and clears
  // the state that only ever describes the previous document: its technical
  // image breaks (a document without images never re-polls, so they would
  // otherwise stay on screen) and its page selection (indices into ITS pages).
  const [documentEpoch] = useState(() => new DocumentEpoch());
  const beginDocumentSwitch = useCallback(() => {
    documentEpoch.advance();
    setUnresolvedCloudImages(null);
    setImageWarningBaselineIds(new Set());
    setCloudImagesRestoring(false);
    setSelectedPages(new Set());
  }, [documentEpoch]);

  const hasLoadedRef = useRef(false);
  // Tracks which document's data is currently reflected in state, so the
  // autosave effect can refuse to write if a document switch is in flight.
  const loadedDocIdRef = useRef<number | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Phase 6.1 autosave flush contract (lib/pendingAutosave.ts): the debounced
  // save is a JOB holding its own docId and the committed state to write. A
  // document switch, unmount or pagehide writes it now instead of dropping it,
  // and it is always written to ITS document, never the one open at flush time.
  const [pendingAutosave] = useState(() => new PendingAutosave<PageSettings>());
  const isMountedRef = useRef(false);
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const flushAutosave = useCallback((): Promise<void> => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    return flushPendingAutosave(pendingAutosave, (job) =>
      saveDocument(job.docId, job.title, job.content, job.settings, job.plotNote)
    ).then(
      (job) => {
        if (job && isMountedRef.current && loadedDocIdRef.current === job.docId && !pendingAutosave.hasPending) {
          setSaveStatus("saved");
        }
      },
      (error: unknown) => {
        console.error("TateSpun: autosave flush failed", error);
        if (isMountedRef.current) setSaveStatus("error");
      }
    );
  }, [pendingAutosave]);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const releaseDividerUserSelectRef = useRef<(() => void) | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  // TSP-Review-UI (Revision 3): the editor/preview split's own container -- see the matching comment
  // in the JSX below. The divider drag math must measure THIS element's width, not <main>'s.
  const editorSplitRef = useRef<HTMLDivElement | null>(null);
  // TSP-Review-UI (Revision 4): whether pinned Review tools (音読β / 描写・修飾チェックβ) get the
  // Desktop Review Bar (bottom of Preview) or the compact mini-bar + Bottom Sheet -- see
  // useReviewSurface's own doc for why this measures <main>'s width rather than a viewport media query.
  const reviewSurface = useReviewSurface(mainRef);
  // Revision 4: the Desktop Review Bar always shows a 見直し entry point (it replaces the manuscript
  // footer's own trigger on this surface -- see EditorPane), regardless of pins; only its per-tool
  // quick-status pills are pin-gated. So the bar mounts whenever the surface/focus state allows it,
  // not only when a dock-eligible tool happens to be pinned (Revision 3's Rail was pin-gated because
  // an EMPTY rail had no reason to exist; an empty bar still needs to carry 見直し).
  const reviewBarEligible = reviewSurface === "desktop" && !focusMode && !isPreviewCollapsed;
  const [reviewBarNode, setReviewBarNode] = useState<HTMLDivElement | null>(null);
  const txtInputRef = useRef<HTMLInputElement | null>(null);
  const docxInputRef = useRef<HTMLInputElement | null>(null);

  // CST-PORT-011: 表紙（settings.cover）は本文の組版に関係しない。プレビュー・
  // 組版には cover を除いた settings を渡し、表紙をいじっても本文の組み直しや
  // プレビューの再描画が起きないようにする（中身が同じなら同じオブジェクト）。
  const layoutSettingsKey = useMemo(() => JSON.stringify(settingsWithoutCover(settings)), [settings]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const layoutSettings = useMemo(() => settingsWithoutCover(settings), [layoutSettingsKey]);
  const layout = useMemo(() => computePageLayout(layoutSettings), [layoutSettings]);
  const isSampleDocument = demoMode || isEphemeralDocId(docId);
  // プレビューから戻ってくる settings には cover がないので、いまの表紙を引き継ぐ
  const handleLayoutSettingsChange = useCallback(
    (next: PageSettings) => setSettings((previous) => keepCover(previous, next)),
    [setSettings]
  );
  const handleCoverChange = useCallback(
    (cover: CoverSettings) => setSettings((previous) => ({ ...previous, cover })),
    [setSettings]
  );
  const handleCoverImageAdd = useCallback(
    async (id: string, dataUrl: string) => {
      setCoverImages((previous) => ({ ...previous, [id]: dataUrl }));
      if (isSampleDocument) return;
      await saveImage({ id, dataUrl, createdAt: Date.now() });
    },
    [isSampleDocument]
  );
  const openCoverExport = useCallback(() => setIsCoverExportOpen(true), []);
  const coverImageKey = coverImageIds(settings.cover).join("\n");
  useEffect(() => {
    const ids = coverImageKey ? coverImageKey.split("\n") : [];
    const missing = ids.filter((id) => coverImages[id] === undefined);
    if (missing.length === 0) return;
    let cancelled = false;
    loadImagesByIds(missing)
      .then((records) => {
        if (cancelled || records.length === 0) return;
        setCoverImages((previous) => ({
          ...Object.fromEntries(records.map((record) => [record.id, record.dataUrl])),
          ...previous,
        }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [coverImageKey, coverImages]);

  // Phase 7 (lib/documentImages.ts): a local document holds only the images
  // its manuscript referenced when opened. A marker added later that is not in
  // the pool (pasted from another document) is fetched from IndexedDB once, as
  // the old all-images pool resolved it implicitly. Cloud projects keep their
  // restore-only pool, as before.
  const imageTopUpAttemptedRef = useRef<Set<string>>(new Set());
  const imageMarkerKey = useMemo(() => Array.from(new Set(imageMarkerIds(content))).sort().join("\n"), [content]);
  useEffect(() => {
    if (docId === null || currentProjectId || isSampleDocument || !hasLoadedRef.current || loadedDocIdRef.current !== docId) return;
    const missing = imageIdsToTopUp(imageMarkerKey.split("\n"), images, imageTopUpAttemptedRef.current);
    if (missing.length === 0) return;
    for (const id of missing) imageTopUpAttemptedRef.current.add(id);
    const isSameDocument = documentEpoch.capture();
    loadImagesByIds(missing)
      .then((records) => {
        if (!isSameDocument() || records.length === 0) return;
        const found = imageStateFromRecords(records);
        setImages((prev) => ({ ...found.images, ...prev }));
        setImageLayerOrder((prev) => ({ ...found.imageLayerOrder, ...prev }));
      })
      .catch(() => undefined);
  }, [currentProjectId, docId, documentEpoch, imageMarkerKey, images, isSampleDocument]);

  // pageOverrides は1始まりの印刷ページ番号でキーされる一方、selectedPages
  // （PreviewPaneの選択状態）は0-basedなインデックス——ここで一度だけ変換する。
  const selectedPageNumbers = useMemo(
    () => Array.from(selectedPages, (index) => index + 1).sort((a, b) => a - b),
    [selectedPages]
  );

  const exportSourceTxt = () => {
    downloadLocalTxt(resolveExportFilenameStem(settings.exportFilenameStem), content, { bom: false, newlines: "lf" });
    setToast("原稿データTXTを書き出しました（UTF-8・BOMなし・LF）。");
  };

  const exportReadableTxt = () => {
    downloadLocalTxt(`${resolveExportFilenameStem(settings.exportFilenameStem)}_readable`, serializeReadableTxt(content), { bom: false, newlines: "lf" });
    setToast("整形本文TXTを書き出しました（記法・画像情報なし）。");
  };

  const importTxt = async (file: File) => {
    const isSameDocument = documentEpoch.capture();
    const replacement = await readLocalTxtFile(file, { newlines: "lf" });
    if (!isSameDocument()) return;
    if (content.length > 0 && !window.confirm("現在の原稿をTXTの内容で置き換えます。続けますか？")) return;
    const imageIds = Array.from(replacement.matchAll(/【IMG:([^:：】]+):/g), (match) => match[1]);
    setContent(replacement);
    setImages({});
    setImageLayerOrder({});
    // A TXT carries no image data: its markers stay broken (never topped up
    // from IndexedDB behind the user's back — same result as before Phase 7).
    imageTopUpAttemptedRef.current = new Set(imageIds);
    setUnresolvedCloudImages(imageIds.length > 0 ? { missing: imageIds, unmanifested: [] } : null);
    setToast(imageIds.length > 0
      ? "TXTを読み込みました。画像データはTXTに含まれないため、画像を再設定してください。"
      : "TXTを読み込みました。");
  };

  const importDocx = async (file: File) => {
    const isSameDocument = documentEpoch.capture();
    const result = await readDocxFile(file);
    if (!isSameDocument()) return;
    if (content.length > 0 && !window.confirm("現在の原稿をDOCXから取り込んだ本文で置き換えます。元のDOCXは変更されません。続けますか？")) return;
    setContent(result.text);
    setImages({});
    setImageLayerOrder({});
    setUnresolvedCloudImages(null);
    setToast(
      result.notices.length > 0
        ? `DOCXを読み込みました。${result.notices[0]}。対応範囲はヘルプをご確認ください。`
        : "DOCXを読み込みました。"
    );
  };

  const applyCloudProject = useCallback((project: Project) => {
    setCurrentProjectId(project.id);
    cloudBaseRef.current = { updatedAt: project.updated_at ?? null, title: project.title, content: project.content };
    setTitle(project.title);
    setContent(project.content);
    setSettings(
      withColophonDefaults((project.settings as PageSettings) ?? DEFAULT_PAGE_SETTINGS, project.title)
    );
    setPlotNote("");
    loadedDocIdRef.current = null;
    setDocId(null);
  }, [setSettings]);

  // Phase 6.1: ONE image restore for both cloud-open paths — the `?cloudId=`
  // route and 保存作品一覧 (which used to swap only text and settings, leaving
  // the previous document's images and no restore). `isCurrent` is the
  // caller's document-scope guard; nothing is written once it turns false.
  const openCloudProjectImages = useCallback(async (project: Project, isCurrent: () => boolean) => {
    setImageLayerOrder({});
    setUnresolvedCloudImages(null);
    setImageWarningBaselineIds(new Set());
    if (!contentHasImages(project.content)) {
      setImages({});
      return;
    }
    setCloudImagesRestoring(true);
    // 別端末でも挿絵を復元する（元の image id を維持）。クラウドの一時コピーが
    // 期限切れ・欠損でも、このブラウザに元画像（IndexedDB）が残っていれば
    // それで表示・出力できるので「画像切れ」にはしない（72hはクラウド側だけの期限）。
    const [restored, localRecords] = await Promise.all([
      restoreManuscriptImages(project.id, project.content).catch(() => ({
        images: {},
        missing: [],
        unmanifested: referencedImageIds(project.content),
      })),
      loadImagesByIds(imageMarkerIds(project.content)).catch(() => []),
    ]);
    if (!isCurrent()) return;
    const opened = openedCloudProjectImageState(project.content, restored, localRecords);
    setImages(opened.images);
    setImageLayerOrder(opened.imageLayerOrder);
    setUnresolvedCloudImages(opened.unresolved);
    setImageWarningBaselineIds(opened.baselineIds);
    setCloudImagesRestoring(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Phase 6.1: write the previous document's pending edits (to ITS docId)
    // before any of its state is replaced.
    const previousDocumentFlushed = flushAutosave();
    // Block the autosave effect from firing with a mismatched
    // docId/content pair while this document switch is in flight.
    hasLoadedRef.current = false;
    setSaveStatus("loading");
    beginDocumentSwitch();
    // 保存作品一覧 can open another document while this load is in flight.
    const isCurrentDocument = documentEpoch.capture();
    const isStale = () => cancelled || !isCurrentDocument();

    async function run() {
      if (demoMode) {
        // TSP-LOOP-024: seed the disposable demo entirely in memory. No
        // loadDocument, no createDocument — nothing is read from or written
        // to IndexedDB, so the demo can never become a bookshelf project.
        setTitle("");
        // SPN-XFIX-001: phones get the seed worded for their 「プレビュー」 tab.
        setContent(window.matchMedia("(max-width: 767px)").matches ? DEMO_SEED_CONTENT_MOBILE : DEMO_SEED_CONTENT);
        setSettings(DEFAULT_PAGE_SETTINGS);
        setPlotNote("");
        setImages({});
        setImageLayerOrder({});
        setUnresolvedCloudImages(null);
        setImageWarningBaselineIds(new Set());
        setCurrentProjectId(null);
        cloudBaseRef.current = null;
        loadedDocIdRef.current = DEMO_PROJECT.id;
        setDocId(DEMO_PROJECT.id);
        hasLoadedRef.current = true;
        setSaveStatus("saved");
        return;
      }

      if (cloudProjectId) {
        const project = await getProjectById(cloudProjectId);
        if (isStale()) return;
        if (!project) {
          setSaveStatus("error");
          return;
        }
        applyCloudProject(project);
        await openCloudProjectImages(project, () => !isStale());
        if (isStale()) return;
        hasLoadedRef.current = true;
        setSaveStatus("saved");
        return;
      }

      let id = documentId && Number.isFinite(documentId) ? documentId : null;
      // A → B → A: reopening a document must read the edits flushed above.
      await previousDocumentFlushed;
      const doc = id ? await loadDocument(id) : undefined;

      if (!doc) {
        id = await createDocument();
        router.replace(`/editor?id=${id}`);
      }

      // Phase 7: only this manuscript's images (lib/documentImages.ts).
      const imageRecords = await loadImagesByIds(imageMarkerIds(doc?.content ?? ""));
      if (isStale()) return;
      imageTopUpAttemptedRef.current = new Set();
      // A local document is never linked to a cloud project or image manifest
      // when it is opened (same as a fresh mount): drop the previous cloud
      // project's id — クラウドに保存 would otherwise overwrite THAT project
      // with this document — and any technical break its manifest poll
      // reported while this load was in flight.
      setCurrentProjectId(null);
      cloudBaseRef.current = null;
      setUnresolvedCloudImages(null);
      setImageWarningBaselineIds(new Set());

      // Reset every field to the newly-loaded document's data (or blank
      // defaults for a brand-new document) so no state from the
      // previously-open document can leak into this one.
      setTitle(doc?.title ?? "");
      setContent(doc?.content ?? "");
      setPlotNote(doc?.plotNote ?? "");
      if (doc) {
        setSettings(doc.settings ?? DEFAULT_PAGE_SETTINGS);
      }
      const opened = imageStateFromRecords(imageRecords);
      setImages(opened.images);
      setImageLayerOrder(opened.imageLayerOrder);

      loadedDocIdRef.current = id;
      setDocId(id);
      hasLoadedRef.current = true;
      setSaveStatus("saved");
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [applyCloudProject, beginDocumentSwitch, cloudProjectId, demoMode, documentEpoch, documentId, flushAutosave, openCloudProjectImages, router, setSettings]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !editorSplitRef.current) return;
      const rect = editorSplitRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(80, Math.max(20, percent));
      setEditorWidthPercent(clamped);
    };

    const releaseDividerUserSelect = () => {
      releaseDividerUserSelectRef.current?.();
      releaseDividerUserSelectRef.current = null;
    };
    const handleMouseUp = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      releaseDividerUserSelect();
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      // Phase 6.1: unmounted mid-drag — mouseup will never reach us.
      isDraggingRef.current = false;
      releaseDividerUserSelect();
    };
  }, []);

  const handleDividerMouseDown = () => {
    isDraggingRef.current = true;
    releaseDividerUserSelectRef.current?.();
    releaseDividerUserSelectRef.current = lockUserSelect(document.body.style);
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
  const showToast = (message: string, durationMs = 2400) => {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), durationMs);
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleImageAdd = useCallback((record: ImageRecord) => {
    setImages((prev) => ({ ...prev, [record.id]: record.dataUrl }));
    if (isSampleDocument) return;
    saveImage(record).catch(() => setSaveStatus("error"));
  }, [isSampleDocument]);

  // Called once the LAST marker of `id` is gone from this work (PreviewPane
  // splices markers and keeps the image while another spot still places it). The
  // IndexedDB pool is shared by every work in this browser, so the original
  // is removed only when no OTHER local work still references the same id
  // (Phase 12: deleting from one work never breaks another). The cloud copy
  // of THIS work is dropped by its next クラウドに保存 (unreferenced rows are
  // removed by syncManuscriptImages); other works' cloud copies are untouched.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const handleImageDelete = useCallback((id: string) => {
    setImages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (isSampleDocument) return;
    const currentDocId = loadedDocIdRef.current;
    listDocuments()
      .then((documents) => {
        const others = documents.filter((document) => document.id !== currentDocId).map((document) => document.content);
        return imageOriginalDeletable(id, others) ? deleteImage(id) : undefined;
      })
      .catch(() => setSaveStatus("error"));
  }, [isSampleDocument]);

  // Phase 12 画像管理センター: which referenced images still have their
  // original in this browser's IndexedDB (primary keys only).
  const handleCheckImageOriginals = useCallback((ids: readonly string[]) => listStoredImageIds(ids), []);

  // Phase 12 画像管理センター「再同期」: restores broken images from this
  // browser's IndexedDB originals under the SAME id (marker, size, position and
  // layer order untouched). A cloud work then re-syncs, which re-uploads them
  // and extends the 72h for every referenced image (IndexedDB itself has no
  // TTL). Ids without an original are reported back for 選び直す / 削除.
  const handleImageResync = useCallback(async (ids: readonly string[]): Promise<{ restored: string[]; withoutOriginal: string[] }> => {
    const isSameDocument = documentEpoch.capture();
    const content = liveContentRef.current;
    const records = await loadImagesByIds(ids);
    const restoredImages: Record<string, string> = {};
    for (const record of records) restoredImages[record.id] = record.dataUrl;
    const restored = Object.keys(restoredImages);
    const withoutOriginal = ids.filter((id) => !restoredImages[id]);
    if (!isSameDocument() || restored.length === 0) return { restored: [], withoutOriginal };
    const nextImages = { ...images, ...restoredImages };
    setImages((prev) => ({ ...prev, ...restoredImages }));

    if (currentProjectId) {
      const sync = await syncManuscriptImages({ projectId: currentProjectId, content, localImages: nextImages });
      if (sync.ok || sync.noImages) {
        const status = await getUnresolvedManuscriptImages(currentProjectId, content);
        if (!isSameDocument()) return { restored, withoutOriginal };
        setUnresolvedCloudImages(technicallyUnresolvedImages(status, nextImages));
        showToast("画像を再同期し、クラウドの保存期限を更新しました");
      } else {
        if (isSameDocument()) setUnresolvedCloudImages(technicallyUnresolvedImages({ missing: [], unmanifested: sync.unresolved }, nextImages));
        alert("画像はこのブラウザに復元しましたが、クラウド同期に失敗しました。もう一度「クラウドに保存」をお試しください。");
      }
    } else {
      setUnresolvedCloudImages((prev) => withoutUnresolvedImageIds(prev, new Set(restored)));
      showToast("画像を再同期しました");
    }
    return { restored, withoutOriginal };
  }, [currentProjectId, documentEpoch, images]);

  // Broken cloud images are restored under the SAME image id. This keeps the IMG marker,
  // page placement, size/position metadata and layer order intact.
  const handleImageReplace = useCallback(async (id: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください。");
      return;
    }
    // Phase 6: the image pool and IndexedDB are shared by every document, so
    // the repaired image itself is always kept; only THIS document's technical
    // state and toast are skipped if another document was opened meanwhile.
    const isSameDocument = documentEpoch.capture();
    // Phase 12: replacing a HEALTHY image rewrites the shared IndexedDB pool
    // under the same id, which would silently change another local work that
    // places the same image. Repairing a broken image stays allowed (it is
    // broken for every work alike).
    if (images[id] && !isSampleDocument) {
      const currentDocId = loadedDocIdRef.current;
      const documents = await listDocuments();
      const others = documents.filter((document) => document.id !== currentDocId).map((document) => document.content);
      if (imageUsedByOtherWorks(id, others)) {
        alert("この画像は他の作品でも使われているため、ここでは差し替えできません。新しい画像として挿入し直してください。");
        return;
      }
    }
    // Phase 7: the live text at call time, not a dependency — a `content`
    // dependency gave this PreviewPane prop a new identity on every keystroke,
    // which defeated PreviewPane's React.memo.
    const content = liveContentRef.current;
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("画像を読み込めませんでした"));
      reader.readAsDataURL(file);
    });
    const record: ImageRecord = {
      id,
      dataUrl,
      createdAt: Date.now(),
      layerOrder: imageLayerOrder[id],
    };
    const nextImages = { ...images, [id]: dataUrl };
    // Functional update: `images` above is this handler's render-time snapshot,
    // and another image may have been added while the file was being read.
    setImages((prev) => ({ ...prev, [id]: dataUrl }));
    if (!isSampleDocument) await saveImage(record);

    if (currentProjectId) {
      const sync = await syncManuscriptImages({ projectId: currentProjectId, content, localImages: nextImages });
      if (sync.ok || sync.noImages) {
        const status = await getUnresolvedManuscriptImages(currentProjectId, content);
        if (!isSameDocument()) return;
        setUnresolvedCloudImages(technicallyUnresolvedImages(status, nextImages));
        showToast("画像を再配置し、クラウドの保存期限を更新しました");
      } else {
        if (isSameDocument()) setUnresolvedCloudImages({ missing: [], unmanifested: sync.unresolved });
        alert("画像はこのブラウザに再配置しましたが、クラウド同期に失敗しました。もう一度「クラウドに保存」をお試しください。");
      }
    } else {
      if (!isSameDocument()) return;
      setUnresolvedCloudImages((prev) => withoutUnresolvedImageIds(prev, new Set([id])));
      showToast("画像を再配置しました");
    }
  }, [currentProjectId, documentEpoch, imageLayerOrder, images, isSampleDocument]);

  // Phase 4: called after the user's 通知解除 was accepted (PreviewPane refuses
  // it while an image is still broken). Clears only TECHNICAL state that is no
  // longer really broken — the image is available in this browser, or its
  // marker is gone — e.g. a manual recovery the 60s poll has not seen yet.
  const handleDismissResolvedImageWarnings = useCallback((ids: string[]) => {
    const referenced = new Set(referencedImageIds(liveContentRef.current)); // Phase 7: see handleImageReplace
    const clearable = new Set(ids.filter((id) => images[id] || !referenced.has(id)));
    if (clearable.size === 0) return;
    setUnresolvedCloudImages((prev) => withoutUnresolvedImageIds(prev, clearable));
  }, [images]);

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

    // The job is this commit's state for THIS docId (see flushAutosave). The
    // cleanup below only cancels the timer: the job stays pending until the
    // next change replaces it, the timer takes it, or a flush writes it.
    pendingAutosave.schedule({ docId, title, content, settings, plotNote });
    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = null;
      const job = pendingAutosave.take();
      if (!job) return;
      saveDocument(job.docId, job.title, job.content, job.settings, job.plotNote)
        .then(() => { if (!pendingAutosave.hasPending) setSaveStatus("saved"); })
        .catch(() => { setSaveStatus("error"); });
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [docId, title, content, settings, plotNote, isSampleDocument, pendingAutosave]);

  // Phase 6.1: leaving the editor (client navigation unmounts it) or the page
  // writes the pending job to IndexedDB. pagehide / visibilitychange=hidden are
  // best effort: the local write is async, and nothing is sent to the cloud.
  useEffect(() => {
    isMountedRef.current = true;
    const flushOnPageHide = () => void flushAutosave();
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") void flushAutosave();
    };
    window.addEventListener("pagehide", flushOnPageHide);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushOnPageHide);
      document.removeEventListener("visibilitychange", flushWhenHidden);
      isMountedRef.current = false;
      void flushAutosave();
    };
  }, [flushAutosave]);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  const saveNow = () => {
    if (docId === null || loadedDocIdRef.current !== docId) return;
    if (isSampleDocument) {
      showToast("使い方ガイドでの編集内容は保存されません");
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    // The pending job holds this same committed state; this write replaces it.
    pendingAutosave.clear();
    setSaveStatus("saving");
    saveDocument(docId, title, content, settings, plotNote)
      .then(() => {
        setSaveStatus("saved");
        showToast("下書きを保存しました");
      })
      .catch(() => setSaveStatus("error"));
  };

  useShortcuts([{ key: "s", handler: saveNow }]);

  const handleSave = () => saveToCloud(false);

  const saveToCloud = async (skipNewerCheck: boolean) => {
    if (isSampleDocument) return;
    // Phase 6: 保存作品一覧 stays usable while this save is in flight. The save
    // itself (this document's title/content, sent to this document's project)
    // still completes, but if another document was opened meanwhile its result
    // must not re-link the NEW document to this project id or overwrite its
    // technical image state.
    const isSameDocument = documentEpoch.capture();
    setIsSaving(true);
    try {
      // Existing cloud projects can always be overwritten regardless of the
      // plan's count limit -- the limit only ever blocks brand-new saves.
      // CST-PORT-014: a local work saves to the cloud work it was saved to
      // before in this browser (lib/cloudLink.ts), not a new one each time.
      let projectId = currentProjectId;
      let linkedOnly = false;
      if (!projectId && docId !== null) {
        const linked = readCloudLink(docId);
        if (linked) {
          projectId = linked;
          linkedOnly = true;
        }
      }

      // CST-PORT-014: never overwrite a newer cloud version silently. If the
      // cloud cannot be read, save as before (the check must not block saving).
      if (projectId && (linkedOnly || !skipNewerCheck)) {
        const cloudNow = await getProjectById(projectId);
        if (!isSameDocument()) return;
        if (linkedOnly) {
          if (!cloudNow) {
            // The linked cloud work is gone (deleted): save as a new one.
            if (docId !== null) clearCloudLink(docId);
            projectId = null;
          } else {
            setCurrentProjectId(cloudNow.id);
          }
        }
        // A screen that never saw the linked cloud version compares it with
        // what it shows now.
        const base = cloudBaseRef.current ?? (linkedOnly ? { updatedAt: null, title, content } : null);
        if (cloudNow && projectId && !skipNewerCheck && isCloudVersionChanged(cloudNow, base)) {
          setCloudCompare({ cloud: cloudNow, base: base?.updatedAt ?? null });
          return;
        }
      }

      const isNewCloudSave = !projectId;
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

      const result = projectId
        ? await updateProject(projectId, { title, content, settings })
        : await createProject({ title, content, settings });

      if (result.error === CLOUD_PROJECT_LIMIT_ERROR) {
        setCloudLimitPlan(knownPlan ?? 'resident');
        return;
      }

      if (result.error || !result.data) {
        alert("クラウドへの保存に失敗しました: " + (result.error || "原因不明のエラー"));
        return;
      }

      if (!currentProjectId && isSameDocument()) setCurrentProjectId(result.data.id);
      if (isSameDocument()) cloudBaseRef.current = { updatedAt: result.data.updated_at ?? null, title: result.data.title, content: result.data.content };
      if (docId !== null) writeCloudLink(docId, result.data.id);

      // TSP-LOOP-007: 本文・設定は保存済み。続けて挿絵を private Storage へ
      // 72h 同期する。画像期限（expires_at）は *完全成功時のみ* +72h される。
      const sync = await syncManuscriptImages({
        projectId: result.data.id,
        content,
        localImages: images,
      });
      if (sync.ok || sync.noImages) {
        if (isSameDocument()) setUnresolvedCloudImages(null);
        alert(
          sync.noImages
            ? "クラウドに保存しました！"
            : "クラウドに保存しました！（挿絵もクラウドへ同期しました）"
        );
      } else {
        // 本文は保存済みだが画像同期は未完了。既存の有効なクラウド画像・期限は
        // 壊していない。ユーザーへ明示し、再保存を促す（サイレント欠損を防ぐ）。
        if (isSameDocument()) setUnresolvedCloudImages({ missing: [], unmanifested: sync.unresolved });
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

  const handleCloudCompareOverwrite = () => {
    setCloudCompare(null);
    void saveToCloud(true);
  };

  // 「クラウド版を開く」: the screen's version is never thrown away. A local
  // work linked to the cloud already holds it (autosave, flushed here); a
  // work opened from the cloud lives only on this screen, so it is kept as a
  // new local work 「…（この端末の控え）」 before the cloud version replaces it.
  const handleCloudCompareOpenCloud = async () => {
    const cloudProject = cloudCompare?.cloud;
    if (!cloudProject) return;
    const isSameDocument = documentEpoch.capture();
    setCloudCompareBusy(true);
    try {
      let keptTitle: string | null = null;
      if (docId === null) {
        keptTitle = cloudCompareLocalCopyTitle(title);
        const copyId = await createDocument();
        await saveDocument(copyId, keptTitle, content, settings, plotNote);
      } else {
        await flushAutosave();
      }
      if (!isSameDocument()) return;
      setCloudCompare(null);
      beginDocumentSwitch();
      applyCloudProject(cloudProject);
      void openCloudProjectImages(cloudProject, documentEpoch.capture());
      showToast(
        keptTitle
          ? `クラウド版を開きました。この画面の版は本棚に「${keptTitle}」として残しました。`
          : "クラウド版を開きました。この画面の版は本棚のこの作品に残っています。"
      );
    } catch (error) {
      console.error("TateSpun: open cloud version failed", error);
      alert("クラウド版を開けませんでした。この画面の版はそのままです。");
    } finally {
      setCloudCompareBusy(false);
    }
  };

  const handleSelectProject = (project: Project) => {
    // Phase 6.1: the open document's pending edits are written to ITS docId
    // first; then the project's text, settings AND images replace it.
    void flushAutosave();
    beginDocumentSwitch();
    applyCloudProject(project);
    void openCloudProjectImages(project, documentEpoch.capture());
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
      // TSP-FQ04-SHELL-VISIBLE-HEIGHT-FIX-006: a plain inline `height`
      // (always wins over the `h-[100dvh]`/`md:h-screen` classes below with
      // zero cascade ambiguity), not a CSS custom property consumed via a
      // separate stylesheet `var()` rule -- that indirection was the
      // confirmed-broken boundary (see useMobileKeyboardViewport.ts). Unset
      // (desktop, unsupported browsers) it falls back to those classes
      // untouched.
      style={mobileShellHeightStyle(visibleHeight)}
      className="box-border flex h-[100dvh] min-h-0 w-full flex-col gap-2 overflow-hidden bg-canvas px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] md:h-screen md:min-h-[100dvh] md:w-screen md:gap-6 md:pl-8 md:pr-10 md:pt-6 md:pb-10"
    >
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
      <input
        ref={docxInputRef}
        type="file"
        accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void importDocx(file).catch((cause: unknown) => setToast(cause instanceof Error ? cause.message : String(cause)));
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
        onOpenExport={sharedExport.openMobileExport}
        exportBusy={sharedExport.isExporting}
      />

      {isExportSupportLineVisible && mobileView === "editor" && !sharedExport.isExporting && (
        <div className="px-3 md:hidden" data-editor-export-support-line="">
          <ExportSupportLine onClose={dismissEditorExportSupportLine} />
        </div>
      )}

      <main
        ref={mainRef}
        data-review-surface={reviewSurface}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden md:flex-row md:pr-6 md:pb-6"
      >
        {/* TSP-Review-UI (Revision 3): the editor/preview split's percentage widths (--editor-w / --preview-w)
            must resolve against THIS wrapper's own width, not <main>'s full width -- otherwise a 50/50 split
            already consumes 100% of <main> and the Review Rail (a flex-none THIRD sibling, below) would be
            pushed outside the viewport instead of sharing the space. Introducing this inner flex-row container
            is the whole fix: the rail eats from ITS flex-basis, and the browser naturally recomputes the split's
            percentages against the wrapper's now-smaller actual width. */}
        <div ref={editorSplitRef} className="flex min-h-0 min-w-0 flex-1 flex-col gap-2 overflow-hidden md:overflow-visible md:flex-row">
        {/* TSP-Review-UI (Revision 3): `@container` here, paired with EditorPane's `md:@max-[905px]:`
            action-row classes, is what keeps the manuscript's HEIGHT stable when the Rail toggles on/off
            (see manuscriptHeightUnaffectedByRail in reviewLayout.e2e.mjs). Those classes used to be plain
            `md:max-[905px]:` viewport media queries -- correct for a narrow split-screen VIEWPORT, but blind
            to the Rail claiming width at an unchanged viewport size, so at 1180px the action row's last
            button silently wrapped to a second line and ate 34px of the manuscript's own height. Querying
            this section's actual rendered width fixes both cases with one rule. */}
        <section
          id="tsp-manuscript"
          style={
            {
              "--editor-w": isPreviewCollapsed ? "auto" : `${editorWidthPercent}%`,
            } as React.CSSProperties
          }
          className={`@container flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-ink/10 md:border-t-[3px] md:border-t-ink bg-base shadow-sm md:flex-none ${mobileView !== "editor" ? "max-md:hidden" : ""} ${focusMode || isPreviewCollapsed ? "md:w-auto md:grow" : "md:w-[var(--editor-w)]"}`}
        >
          <EditorPane
            ref={editorPaneRef}
            title={title}
            onTitleChange={setTitle}
            exportFilenameStem={settings.exportFilenameStem ?? ""}
            onExportFilenameStemChange={(stem) =>
              setSettings((previous) => ({ ...previous, exportFilenameStem: stem }))
            }
            toc={settings.toc ?? createDefaultTocSettings()}
            onEditToc={() => {
              setBookPartsInitialTab("toc");
              setIsBookPartsModalOpen(true);
            }}
            onDeleteToc={() =>
              setSettings((previous) => ({
                ...previous,
                toc: createDefaultTocSettings(),
              }))
            }
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
            plotStorageKey={plotStorageKey}
            currentHeading={plotCurrentHeading}
            onOpenSettingsDrawer={() => setActiveDrawer("settings")}
            onOpenHelp={() => { setActiveDrawer(null); setIsHelpOpen(true); }}
            onCursorIndexChange={setCursorIndex}
            focusMode={focusMode}
            onExitFocus={exitFocusMode}
            keyboardActive={keyboardActive}
            reviewSurface={reviewSurface}
            reviewBarNode={reviewBarEligible ? reviewBarNode : null}
          />
        </section>

        {!isPreviewCollapsed && !focusMode && (
          <div
            onMouseDown={handleDividerMouseDown}
            className="hidden w-1 shrink-0 cursor-col-resize bg-ink/10 transition-all hover:w-2 hover:bg-accent/60 active:bg-accent md:block"
          />
        )}

        <section
          data-preview-frame={reviewBarEligible ? "integrated" : "standalone"}
          style={{ "--preview-w": `${100 - editorWidthPercent}%` } as React.CSSProperties}
          // Narrow: fills the remaining dynamic viewport; PreviewPane owns the
          // single inner scroll/pan surface. Wide keeps the existing split.
          // TSP-LOOP-023: in desktop focus mode an *expanded* Preview is a
          // capped-width side panel (`md:flex-none`, ~38% up to 480px) so the
          // manuscript editor stays dominant; collapsed it is the same thin
          // rail as the normal desktop collapse. Outside focus mode the normal
          // split (`--preview-w` / `md:flex-1`) is unchanged.
          // TSP-Review-UI (Revision 4): `md:flex-col` (added) stacks PreviewPane above the Desktop
          // Review Bar; `overflow-hidden` moved to the inner wrapper below PreviewPane's own content
          // so the bar's popovers (absolutely positioned, opening upward) are never clipped by it.
          className={`min-h-0 min-w-0 transition-all duration-200 md:flex md:h-full md:flex-none md:flex-col ${
            isPreviewCollapsed
              ? "md:w-12"
              : focusMode
                ? "md:w-[38%] md:max-w-[480px]"
                : "md:w-[var(--preview-w)] md:flex-1"
          } ${reviewBarEligible ? "md:overflow-visible md:rounded-lg md:border md:border-ink/10 md:bg-base md:shadow-sm" : ""} ${mobileView === "preview" ? "flex h-full flex-1 flex-col" : sharedExport.previewExportStaged ? PREVIEW_EXPORT_STAGE_CLASS : "max-md:hidden"} ${reviewBarEligible ? "md:rounded-lg md:border md:border-ink/10 md:bg-base md:shadow-sm" : ""}`}
        >
          <div className={`relative min-h-0 min-w-0 flex-1 overflow-hidden ${reviewBarEligible ? "md:rounded-t-lg md:[&>div]:rounded-none md:[&>div]:border-0 md:[&>div]:shadow-none" : ""}`}>
            <PreviewPane
              // SPN-XFIX-001: every phone preview (not only the demo) opens one
              // page at a time, fitted to the screen width; the saved 1P/見開き
              // choice is not rewritten.
              startSinglePageOnNarrow
              content={previewContent}
              documentKey={workSessionScope}
              getLatestContent={getLatestContent}
              title={title}
              exportFilenameStem={settings.exportFilenameStem ?? ""}
              settings={layoutSettings}
              layout={layout}
              images={images}
              imageLayerOrder={imageLayerOrder}
              unresolvedImageIds={unresolvedImageIdSet}
              blockExportForUnresolvedImages={unresolvedImageIdSet.size > 0}
              onContentChange={setContent}
              onSettingsChange={handleLayoutSettingsChange}
              onOpenCoverExport={openCoverExport}
              cover={settings.cover}
              coverImageDataUrls={coverImages}
              onAdjustGutter={openGutterSetting}
              onImageAdd={handleImageAdd}
              onImageDelete={handleImageDelete}
              onImageReplace={handleImageReplace}
              onImageResync={handleImageResync}
              onCheckImageOriginals={handleCheckImageOriginals}
              unresolvedImages={unresolvedCloudImages}
              onDismissImageWarnings={handleDismissResolvedImageWarnings}
              imageWarningScope={workSessionScope ?? "editor"}
              silentImageWarningIds={imageWarningBaselineIds}
              onImageLayerChange={handleImageLayerChange}
              cursorIndex={previewCursorIndex}
              onNavigateToSource={navigateEditorToGlobalOffset}
              onBodyPageCountChange={setBodyPageCount}
              onPdfExportSuccess={handlePreviewPdfExportSuccess}
              onExportSupportLineChange={setIsExportSupportLineVisible}
              onExportNotice={(message) => showToast(message, 5000)}
              mobileExportOpen={sharedExport.mobileExportOpen}
              onMobileExportClose={sharedExport.closeMobileExport}
              onExportActiveChange={sharedExport.onExportActiveChange}
              // On a phone showing the プレビュー workspace the preview is always
              // full — the collapse rail is a desktop-only affordance.
              isCollapsed={isPreviewCollapsed && mobileView !== "preview"}
              integratedFrame={reviewBarEligible}
              onToggleCollapse={handleTogglePreviewCollapse}
              selected={selectedPages}
              onSelectedChange={setSelectedPages}
            />
            {isSearchOpen && (
              <div className="hidden md:block">
                <SearchReplaceModal
                  placement="preview"
                  content={content}
                  onFind={revealSearchMatch}
                  onReplaceOne={replaceSearchMatch}
                  onReplace={(next) => replaceWholeText(next)}
                  onMarkChange={markSearchReplaced}
                  onClose={() => setIsSearchOpen(false)}
                />
              </div>
            )}
          </div>
          {reviewBarEligible && (
            <div className="hidden md:block">
              <DesktopReviewBarMount mountRef={setReviewBarNode} />
            </div>
          )}
        </section>
        </div>
      </main>

      {isSearchOpen && (
        <div className="md:hidden">
          <SearchReplaceModal
            placement="screen"
            content={content}
            onFind={revealSearchMatch}
            onReplaceOne={replaceSearchMatch}
            onReplace={(next) => replaceWholeText(next)}
            onMarkChange={markSearchReplaced}
            onClose={() => setIsSearchOpen(false)}
          />
        </div>
      )}

      {isChecklistOpen && <ChecklistPanel onClose={() => setIsChecklistOpen(false)} />}

      {activeDrawer === "settings" && <EditorSettingsDrawer settings={settings} layout={layout} onChange={setSettings} selectedPageNumbers={selectedPageNumbers} focusSetting={settingsFocus} getManuscript={getLatestContent} onClose={() => { setActiveDrawer(null); setSettingsFocus(null); }} />}

      {activeDrawer === "options" && (
        <EditorOptionsDrawer
          onOpenCover={() => setCoverModalSide("front")}
          onOpenVerticalColophon={() => { setBookPartsInitialTab("colophon"); setIsBookPartsModalOpen(true); }}
          onOpenHorizontalColophon={() => setIsColophonModalOpen(true)}
          onOpenToc={() => { setBookPartsInitialTab("toc"); setIsBookPartsModalOpen(true); }}
          onOpenChecklist={() => setIsChecklistOpen(true)}
          onImportSourceTxt={() => txtInputRef.current?.click()}
          onImportDocx={() => docxInputRef.current?.click()}
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
          onTocChange={(toc) => setSettings((previous) => ({ ...previous, toc }))}
          onOpenColophonModal={() => {
            setIsBookPartsModalOpen(false);
            setIsColophonModalOpen(true);
          }}
          currentTitle={title}
          content={content}
          layout={layout}
          settings={layoutSettings}
          images={images}
          initialTab={bookPartsInitialTab}
        />
      )}

      {coverModalSide && (
        <CoverModal
          cover={settings.cover}
          paperSize={settings.paperSize}
          imageDataUrls={coverImages}
          initialSide={coverModalSide}
          onChange={handleCoverChange}
          onImageAdd={handleCoverImageAdd}
          onOpenExport={() => {
            setCoverModalSide(null);
            setIsCoverExportOpen(true);
          }}
          onClose={() => setCoverModalSide(null)}
        />
      )}

      {isCoverExportOpen && (
        <CoverExportDialog
          cover={settings.cover}
          paperSize={settings.paperSize}
          stem={resolveExportFilenameStem(settings.exportFilenameStem)}
          imageDataUrls={coverImages}
          onOpenCover={() => {
            setIsCoverExportOpen(false);
            setCoverModalSide("front");
          }}
          onClose={() => setIsCoverExportOpen(false)}
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
        <div role="status" aria-live="polite" className="pointer-events-none fixed left-4 right-4 top-4 z-[70] rounded-lg md:left-auto md:top-auto md:bottom-4 md:right-4 md:max-w-md border border-ink/10 bg-ink px-4 py-2 text-sm text-base shadow-lg">
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

      {cloudCompare && (
        <CloudVersionCompareModal
          screen={{ title, content, updatedAt: cloudCompare.base }}
          cloud={{ title: cloudCompare.cloud.title, content: cloudCompare.cloud.content, updatedAt: cloudCompare.cloud.updated_at }}
          busy={cloudCompareBusy}
          onOverwrite={handleCloudCompareOverwrite}
          onOpenCloud={() => void handleCloudCompareOpenCloud()}
          onCancel={() => setCloudCompare(null)}
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
