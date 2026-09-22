"use client";

/**
 * TSP-Review-UI (Revision 3) desktop Review Rail: a dedicated vertical sidebar beside the
 * manuscript for the pinned Review tools (音読β / 描写・修飾チェックβ), so their daily controls no
 * longer cost the manuscript any HEIGHT (Revision 2's horizontal Review Dock did, and that was
 * rejected in Human QA). Only mounted by `TategakiEditor` when `useReviewSurface` measures enough
 * width (see that hook's own doc) and at least one dock-eligible tool is pinned.
 *
 * This component is only the static shell + the portal mount point — EditorPane still owns every
 * card's state/logic and portals the actual card elements into `mountRef`'s node
 * (`ReactDOM.createPortal`), so none of that state has to move out of EditorPane.
 */
interface ReviewRailProps {
  mountRef: (node: HTMLDivElement | null) => void;
}

export default function ReviewRail({ mountRef }: ReviewRailProps) {
  return (
    <aside
      data-review-rail=""
      aria-label="見直しツール"
      className="flex h-full min-h-0 w-[17rem] flex-none flex-col overflow-hidden border-l border-ink/10 pl-4"
    >
      <div ref={mountRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1" />
    </aside>
  );
}
