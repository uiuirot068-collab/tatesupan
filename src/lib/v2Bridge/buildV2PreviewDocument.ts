import { PX_PER_MM } from "../pageLayout";
import { mmToTicks } from "../../../typesetting-v2/core/geometry/tick";
import {
  buildColophonPaintPages,
  buildPaintDocument,
  type PaintDocument,
  type PreviewRenderContext,
} from "../../../typesetting-v2/renderer/preview/paintModel";
import type { V2BridgeResult } from "./composeV2Document";

/**
 * `PreviewRenderer` converts canonical millimeters at standard CSS density
 * (96dpi), while the established editor `PageCard` paper surface uses the
 * product's preview-only `PX_PER_MM`. Match that host coordinate system here.
 */
export const PAGE_CARD_PREVIEW_SCALE_MULTIPLIER = PX_PER_MM / (96 / 25.4);

/** Pure preview projection shared by the browser worker and parity tests. */
export function buildV2PreviewDocument(
  bridge: V2BridgeResult,
  images: Record<string, string>
): PaintDocument {
  const context: PreviewRenderContext = {
    scaleMultiplier: PAGE_CARD_PREVIEW_SCALE_MULTIPLIER,
    linePitchTicks: bridge.layoutSettings.linePitchTicks,
    lineExtentTicks: bridge.layoutSettings.lineExtentTicks,
    columnExtentTicks: bridge.layoutSettings.columnExtentTicks,
    columnsPerPage: bridge.layoutSettings.columnsPerPage,
    nominalCellTicks: mmToTicks((bridge.layoutSettings.bodyFontSizePt * 25.4) / 72),
    measurementIdentity: bridge.document.version.measurementIdentity,
    paintFontIdentity: bridge.document.version.measurementIdentity,
    bodyFontSizeTick: mmToTicks((bridge.layoutSettings.bodyFontSizePt * 25.4) / 72),
    imageResolver: (id) => images[id] ? { kind: "RESOLVED", url: images[id] } : { kind: "PLACEHOLDER" },
  };
  const body = buildPaintDocument(
    "editor-v2",
    "Canonical Preview",
    bridge.document,
    bridge.units,
    bridge.source,
    context
  );
  if (!bridge.document.colophon || !bridge.colophonUnits || bridge.colophonSource === undefined) {
    return body;
  }

  const colophonPages = buildColophonPaintPages(
    bridge.document.colophon,
    bridge.colophonUnits,
    bridge.colophonSource,
    context
  );
  body.pages = bridge.document.pageSequence.map((page) =>
    page.kind === "body" ? body.pages[page.index] : colophonPages[page.index]
  );
  body.totalPageCount = body.pages.length;
  body.renderedPageCount = body.pages.length;
  return body;
}
