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
 * top targets prefer below. The fallback is always viewport-contained.
 */
export function computeDemoCardPlacement(
  target: DemoRect | null,
  card: { width: number; height: number },
  viewport: DemoViewport
): DemoCardPlacement {
  const maxHeight = Math.max(0, viewport.height - EDGE_MARGIN * 2);
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

  if (target) {
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
      return {
        top: EDGE_MARGIN,
        left,
        maxHeight: availableAbove,
        side: "above",
      };
    }
    if (availableBelow > 0) {
      return {
        top: target.bottom + TARGET_GAP,
        left,
        maxHeight: availableBelow,
        side: "below",
      };
    }
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
