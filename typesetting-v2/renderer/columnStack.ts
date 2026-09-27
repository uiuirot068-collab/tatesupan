// Shared paint-only placement for TateSpun's Japanese multi-column (段組み) layout.
// Core composes sequential CanonicalColumn blocks; the Editor's 2段 setting
// means those blocks are stacked TOP-to-BOTTOM on the physical page, not
// laid side-by-side horizontally. Preview and Publication use this same
// helper so their geometry cannot drift. The default remains horizontal for
// non-Editor/Core fixtures that never opt into vertical stacking.

export type PaintColumnStackDirection = "horizontal" | "vertical";

export interface PaintColumnStackContext {
  lineExtentTicks: number;
  columnExtentTicks: number;
  columnsPerPage: number;
  columnStackDirection?: PaintColumnStackDirection;
  columnGapTicks?: number;
  /**
   * The 段 frame height (legacy `computeColumnHeightMm`: (text area − 段間) / 2).
   * A 段 always occupies its whole frame even when the line is shorter, so the
   * lower 段 starts where legacy PageCard starts it. Never below the line itself.
   */
  columnFrameTicks?: number;
}

export interface PaintColumnPlacementTicks {
  rightTicks: number;
  topTicks: number;
}

function stackedFrameTicks(ctx: PaintColumnStackContext): number {
  return Math.max(ctx.lineExtentTicks, ctx.columnFrameTicks ?? 0);
}

export function paintColumnPlacementTicks(
  columnIndex: number,
  ctx: PaintColumnStackContext
): PaintColumnPlacementTicks {
  if (ctx.columnStackDirection === "vertical") {
    return {
      rightTicks: 0,
      topTicks: columnIndex * (stackedFrameTicks(ctx) + (ctx.columnGapTicks ?? 0)),
    };
  }
  return {
    rightTicks: columnIndex * ctx.columnExtentTicks,
    topTicks: 0,
  };
}

export function paintBodyExtentTicks(ctx: PaintColumnStackContext): { widthTicks: number; heightTicks: number } {
  if (ctx.columnStackDirection === "vertical") {
    return {
      widthTicks: ctx.columnExtentTicks,
      heightTicks:
        ctx.columnsPerPage * stackedFrameTicks(ctx) +
        Math.max(0, ctx.columnsPerPage - 1) * (ctx.columnGapTicks ?? 0),
    };
  }
  return {
    widthTicks: ctx.columnsPerPage * ctx.columnExtentTicks,
    heightTicks: ctx.lineExtentTicks,
  };
}
