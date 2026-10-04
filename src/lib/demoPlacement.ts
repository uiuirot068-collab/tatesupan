export interface DemoRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface DemoViewport {
  width: number;
  height: number;
}

export type DemoPlacementSide = "above" | "below" | "floating";
export type DemoPlacementPreference = "auto" | "lower-safe" | "beside";

export interface DemoPlacementOptions {
  /**
   * TSP-DEMO-001: upper bound for the card's own height. On phones the guide
   * is capped to a part of the screen so it can never hide the whole
   * toolbar or preview; its body scrolls inside the cap.
   */
  maxCardHeight?: number;
  /**
   * Where a card with no visible target sits. "center" is the desktop
   * default; "bottom" (phones) keeps the sticky top bar and the middle of
   * the page uncovered.
   */
  freeDock?: "center" | "bottom";
  /**
   * SPN-XFIX-001: a tall target (the manuscript textarea fills most of the
   * screen) leaves no room above or below it. Instead of squeezing the card
   * into the strip above it — over the toolbar and the title field — dock
   * the card at the bottom of the screen, over the target's own lower part,
   * so the toolbar, the title and the first lines stay visible.
   */
  largeTargetDock?: "bottom";
}

export interface DemoCardPlacement {
  top: number;
  left: number;
  maxHeight: number;
  side: DemoPlacementSide;
}

const EDGE_MARGIN = 12;
const TARGET_GAP = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/**
 * Places a guided-demo card relative to the visible target without assuming
 * which page or control owns it. Bottom targets prefer an above placement;
 * top targets prefer below. `lower-safe` reserves a bottom-aligned guide for
 * an upper target such as Export, while retaining the target-safe fallback.
 */
export function computeDemoCardPlacement(
  target: DemoRect | null,
  card: { width: number; height: number },
  viewport: DemoViewport,
  preference: DemoPlacementPreference = "auto",
  options: DemoPlacementOptions = {}
): DemoCardPlacement {
  const maxHeight = Math.max(
    0,
    Math.min(viewport.height - EDGE_MARGIN * 2, options.maxCardHeight ?? Infinity)
  );
  const visibleCardHeight = Math.min(card.height, maxHeight);
  const left = target
    ? clamp(
      target.left + target.width / 2 - card.width / 2,
      EDGE_MARGIN,
      viewport.width - card.width - EDGE_MARGIN
    )
    : clamp(
      viewport.width - card.width - EDGE_MARGIN,
      EDGE_MARGIN,
      viewport.width - card.width - EDGE_MARGIN
    );

  if (target && preference === "beside") {
    // SPN-XFIX-001: wide screens — put the card next to the target (e.g. over
    // the editor, left of the preview) at the bottom, so the target itself
    // (the preview pages) stays fully visible.
    const besideLeft = target.left - TARGET_GAP - card.width;
    if (besideLeft >= EDGE_MARGIN) {
      return {
        top: Math.max(EDGE_MARGIN, viewport.height - visibleCardHeight - EDGE_MARGIN),
        left: besideLeft,
        maxHeight,
        side: "floating",
      };
    }
  }

  if (target && (preference === "lower-safe" || preference === "beside")) {
    const lowerTop = viewport.height - visibleCardHeight - EDGE_MARGIN;
    if (lowerTop >= target.bottom + TARGET_GAP) {
      return {
        top: lowerTop,
        left,
        maxHeight,
        side: "below",
      };
    }
  }

  if (target) {
    const minVisibleTargetTop = 160;
    if (
      options.largeTargetDock === "bottom" &&
      target.height >= viewport.height * 0.4 &&
      viewport.height - visibleCardHeight - EDGE_MARGIN >= Math.max(target.top, 0) + minVisibleTargetTop
    ) {
      return {
        top: viewport.height - visibleCardHeight - EDGE_MARGIN,
        left,
        maxHeight,
        side: "below",
      };
    }

    const targetCenter = (target.top + target.bottom) / 2;
    const fitsAbove = target.top - TARGET_GAP - visibleCardHeight >= EDGE_MARGIN;
    const fitsBelow = target.bottom + TARGET_GAP + visibleCardHeight <= viewport.height - EDGE_MARGIN;
    const prefersAbove = targetCenter >= viewport.height / 2;

    if ((prefersAbove && fitsAbove) || (!fitsBelow && fitsAbove)) {
      return {
        top: target.top - TARGET_GAP - visibleCardHeight,
        left,
        maxHeight,
        side: "above",
      };
    }
    if ((!prefersAbove && fitsBelow) || (!fitsAbove && fitsBelow)) {
      return {
        top: target.bottom + TARGET_GAP,
        left,
        maxHeight,
        side: "below",
      };
    }

    // If the full card fits on neither side, keep the target uncovered and
    // constrain the card to whichever side has more usable space. The card's
    // own body scrolls while its navigation stays fixed, so Help and other
    // mobile targets remain visible and 次へ／デモ終了 remain reachable.
    const availableAbove = Math.max(0, target.top - TARGET_GAP - EDGE_MARGIN);
    const availableBelow = Math.max(
      0,
      viewport.height - EDGE_MARGIN - target.bottom - TARGET_GAP
    );
    if (availableAbove >= availableBelow && availableAbove > 0) {
      const height = Math.min(availableAbove, maxHeight);
      return {
        top: target.top - TARGET_GAP - height,
        left,
        maxHeight: height,
        side: "above",
      };
    }
    if (availableBelow > 0) {
      return {
        top: target.bottom + TARGET_GAP,
        left,
        maxHeight: Math.min(availableBelow, maxHeight),
        side: "below",
      };
    }
  }

  if (options.freeDock === "bottom") {
    return {
      top: Math.max(EDGE_MARGIN, viewport.height - visibleCardHeight - EDGE_MARGIN),
      left,
      maxHeight,
      side: "floating",
    };
  }

  return {
    top: clamp(
      (viewport.height - visibleCardHeight) / 2,
      EDGE_MARGIN,
      viewport.height - visibleCardHeight - EDGE_MARGIN
    ),
    left,
    maxHeight,
    side: "floating",
  };
}
