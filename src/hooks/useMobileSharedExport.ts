"use client";

import { useCallback, useState } from "react";
import { flushSync } from "react-dom";
import { useIsNarrowViewport } from "@/hooks/useIsNarrowViewport";
import { shouldStagePreviewForExport, type MobileWorkspace } from "@/lib/previewExportStage";

/**
 * TSP-UX-V3-LOOP3-MOBILE-SHARED-EXPORT: the small piece of shared state that
 * lets the phone Editor view reach the SAME 書き出し menu the Preview owns
 * without ever showing the Preview.
 *
 * It holds only UI flags. The export entries, handlers, page selection,
 * PDF setup, odd-page warning, progress and cancellation all stay in
 * PreviewPane and the canonical Editor state -- nothing about "what/how to
 * export" is duplicated here.
 */
export function useMobileSharedExport(params: {
  mobileView: MobileWorkspace;
  isPreviewCollapsed: boolean;
  setIsPreviewCollapsed: (collapsed: boolean) => void;
}) {
  const { mobileView, isPreviewCollapsed, setIsPreviewCollapsed } = params;
  const isNarrow = useIsNarrowViewport();
  const [isOpen, setIsOpen] = useState(false);
  // Never leave the sheet "armed" across a resize to the desktop layout (where
  // the nav button that opens it does not exist).
  if (isOpen && !isNarrow) setIsOpen(false);
  const [isExporting, setIsExporting] = useState(false);

  // Synchronous on purpose: PreviewPane reports begin/finish from inside the
  // export handlers, and the off-screen layout stage must be committed before
  // the LEGACY capture reads live page geometry.
  const onExportActiveChange = useCallback((active: boolean) => {
    flushSync(() => setIsExporting(active));
  }, []);

  const previewExportStaged = shouldStagePreviewForExport({
    isNarrowViewport: isNarrow,
    mobileView,
    exporting: isExporting,
  });

  const openMobileExport = () => {
    // Focus mode tucks Preview into its rail (and hides the nav export
    // button). If a resize left it collapsed outside focus mode, the export
    // menu / PDF modal live in the expanded pane, so re-expand on request.
    if (isPreviewCollapsed) setIsPreviewCollapsed(false);
    setIsOpen(true);
  };
  const closeMobileExport = () => setIsOpen(false);

  return {
    mobileExportOpen: isOpen && isNarrow,
    openMobileExport,
    closeMobileExport,
    isExporting,
    onExportActiveChange,
    previewExportStaged,
  };
}
