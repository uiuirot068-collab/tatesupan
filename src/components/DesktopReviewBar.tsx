"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { ReviewHubTrigger } from "./ReviewHub";
import { ReadAloudDockCard, ReadAloudInlineBar } from "./ReadAloudDockCard";
import { type ReadAloudViewProps } from "./ReadAloudControls";
import { DescriptionCheckDockCard, DescriptionCheckFooterPill, type DescriptionDockCardProps } from "./DescriptionCheckControls";

/**
 * TSP-Review-UI (Revision 4): the desktop Review Bar lives at the BOTTOM of the Preview pane
 * (one compact row: 見直し / 描写・修飾 status / 音読 status) instead of Revision 3's dedicated
 * third-column Review Rail -- Human QA rejected the Rail (editor and Review felt too far apart,
 * it ate into Preview's own width, and the extra column made the whole editor feel crowded).
 *
 * This is only the static shell + portal mount point (mirrors `ReviewRail`'s old role) --
 * `TategakiEditor` renders it at the bottom of the Preview `<section>`; `EditorPane` still owns
 * every tool's state/logic and portals the actual interactive `<DesktopReviewBar>` into `mountRef`'s
 * node, so none of that state has to move out of EditorPane.
 */
export function DesktopReviewBarMount({ mountRef }: { mountRef: (node: HTMLDivElement | null) => void }) {
  return <div ref={mountRef} data-desktop-review-bar-mount="" className="relative flex-none" />;
}

interface DesktopReviewBarProps {
  /** So this component's own popovers count as "inside" for the Hub's outside-press close (see useReviewHubDisclosure). */
  wrapperRef: RefObject<HTMLDivElement | null>;
  reviewHubOpen: boolean;
  onToggleReviewHub: () => void;
  /** The already-built `<ReviewHubPanel open sheet={false} .../>` element -- rendered by EditorPane, which owns every section's content. */
  reviewHubPanel: ReactNode;
  readAloudPinned: boolean;
  readAloud: ReadAloudViewProps;
  descriptionPinned: boolean;
  description: Omit<DescriptionDockCardProps, "onPrev" | "onNext"> & { onPrev: () => void; onNext: () => void };
  writingCheckPinned?: boolean;
  writingCheckEnabled?: boolean;
  writingCheckCount?: number;
  onOpenWritingCheck?: () => void;
  writingCheckHost?: ReactNode;
  workSessionPinned?: boolean;
  workSessionPill?: ReactNode;
}

/**
 * The interactive bar: one compact row plus, at most, one open popover above it at a time
 * (見直し / 音読β quick controls / 描写・修飾チェックβ quick controls). Popovers are absolutely
 * positioned INSIDE this component's own `relative` root, so they overlay Preview without ever
 * resizing it or the Editor -- Escape and an outside press close whichever one is open, and
 * selecting a different tool switches content instead of stacking a second popover.
 */
export function DesktopReviewBar({
  wrapperRef,
  reviewHubOpen,
  onToggleReviewHub,
  reviewHubPanel,
  readAloudPinned,
  readAloud,
  descriptionPinned,
  description,
  writingCheckPinned = false,
  writingCheckEnabled = false,
  writingCheckCount = 0,
  onOpenWritingCheck,
  writingCheckHost = null,
  workSessionPinned = false,
  workSessionPill = null,
}: DesktopReviewBarProps) {
  const [quickPopover, setQuickPopover] = useState<"read-aloud" | "description-check" | null>(null);
  const activePopover = reviewHubOpen ? "hub" : quickPopover;

  const openHub = () => {
    setQuickPopover(null);
    onToggleReviewHub();
  };
  const selectQuick = (id: "read-aloud" | "description-check") => {
    if (reviewHubOpen) onToggleReviewHub();
    setQuickPopover((current) => (current === id ? null : id));
  };
  const closeQuick = () => setQuickPopover(null);

  // Escape / outside-press for the two QUICK popovers only -- the Hub popover already gets both
  // from `useReviewHubDisclosure` (its outside-press check includes `wrapperRef` via `extraContainmentRefs`).
  useEffect(() => {
    if (!quickPopover) return;
    const onPointerDown = (event: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) closeQuick();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeQuick();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [quickPopover, wrapperRef]);

  const readAloudActive = readAloud.state.status !== "idle";
  const showReadAloud = readAloudPinned || readAloudActive;

  return (
    <div ref={wrapperRef} data-desktop-review-bar="" className="@container relative flex min-w-0 items-center gap-1.5 border-t border-ink/10 bg-base px-2 py-1.5">
      {activePopover === "read-aloud" && (
        <div data-desktop-review-popover="read-aloud" className="absolute bottom-full left-0 z-20 mb-1.5 w-[19rem] max-w-[calc(100vw-2rem)]">
          <ReadAloudDockCard {...readAloud} />
        </div>
      )}
      {activePopover === "description-check" && (
        <div
          data-desktop-review-popover="description-check"
          className="pointer-events-none absolute inset-x-0 bottom-full z-20 mb-1.5"
        >
          <div
            data-desktop-review-popover-card="description-check"
            className="pointer-events-auto w-full max-w-[24rem]"
          >
            <DescriptionCheckDockCard {...description} />
          </div>
        </div>
      )}
      {/* The Hub popover is `<ReviewHubPanel>` itself (EditorPane's single instance, portalled here
          instead of the manuscript footer on this surface) -- its own "anchored" variant already
          renders `absolute bottom-full ...`, so it needs no extra positioning wrapper here. */}
      {reviewHubPanel}
      {writingCheckHost ? (
        <div data-desktop-writing-check-host="" className="pointer-events-none absolute inset-x-0 bottom-0 h-0 z-30">
          <div className="pointer-events-auto relative w-full">{writingCheckHost}</div>
        </div>
      ) : null}

      <ReviewHubTrigger open={reviewHubOpen} onToggle={openHub} />
      {writingCheckPinned && (
        <button
          type="button"
          data-desktop-writing-check-pill=""
          onClick={() => {
            if (writingCheckEnabled && writingCheckCount > 0) onOpenWritingCheck?.();
            else openHub();
          }}
          className="shrink-0 whitespace-nowrap rounded-full border border-red-300/70 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {writingCheckEnabled ? `文章β ${writingCheckCount.toLocaleString("ja-JP")}件` : "文章β OFF"}
        </button>
      )}
      {descriptionPinned && (
        <DescriptionCheckFooterPill
          enabled={description.enabled}
          current={description.current}
          count={description.marks.length}
          onOpen={() => selectQuick("description-check")}
        />
      )}
      {workSessionPinned && workSessionPill}
      {showReadAloud && (
        <div className="min-w-0">
          <ReadAloudInlineBar {...readAloud} />
        </div>
      )}
    </div>
  );
}
