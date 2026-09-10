"use client";

import { useEffect, useState } from "react";
import type { PageSettings } from "../pageLayout";
import { loadV2BrowserMeasurementProvider } from "./browserMeasurementProvider";
import { composeV2Document, type V2BridgeResult } from "./composeV2Document";
import { prepareImageResolver } from "./imageResolverAdapter";
import { mmToTicks } from "../../../typesetting-v2/core/geometry/tick";
import {
  buildColophonPaintPages,
  buildPaintDocument,
  type PaintDocument,
  type PreviewRenderContext,
} from "../../../typesetting-v2/renderer/preview/paintModel";

export interface V2PreviewAdapterState {
  bridge: V2BridgeResult | null;
  preview: PaintDocument | null;
  error: string | null;
  loading: boolean;
}

const DISABLED_STATE: V2PreviewAdapterState = {
  bridge: null,
  preview: null,
  error: null,
  loading: false,
};

export function buildV2PreviewDocument(
  bridge: V2BridgeResult,
  images: Record<string, string>
): PaintDocument {
  const context: PreviewRenderContext = {
    scaleMultiplier: 1,
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
  if (!bridge.document.colophon || !bridge.colophonUnits || bridge.colophonSource === undefined) return body;

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

/** Async browser bridge; it never falls back to fake measurements. */
export function useV2PreviewAdapter(
  enabled: boolean,
  input: { content: string; settings: PageSettings; title: string; images: Record<string, string> }
): V2PreviewAdapterState {
  const [state, setState] = useState<V2PreviewAdapterState>({
    bridge: null,
    preview: null,
    error: null,
    loading: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void Promise.all([
        loadV2BrowserMeasurementProvider(),
        prepareImageResolver(input.images),
      ]).then(([measurement, imageResolver]) => {
        const bridge = composeV2Document({
          title: input.title.trim() || "TateSpun",
          content: input.content,
          settings: input.settings,
          measurement,
          imageResolver,
        });
        if (!cancelled) {
          setState({ bridge, preview: buildV2PreviewDocument(bridge, input.images), error: null, loading: false });
        }
      }).catch((cause: unknown) => {
        if (!cancelled) {
          const detail = cause instanceof Error ? cause.message : String(cause);
          setState({ bridge: null, preview: null, error: `V2 HOLD: ${detail}`, loading: false });
        }
      });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled, input.content, input.images, input.settings, input.title]);

  return enabled ? state : DISABLED_STATE;
}
