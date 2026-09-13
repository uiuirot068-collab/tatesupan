"use client";

import { startTransition, useEffect, useState } from "react";
import type { PageSettings } from "../pageLayout";
import type { V2BridgeResult } from "./composeV2Document";
import type { PaintDocument } from "../../../typesetting-v2/renderer/preview/paintModel";

export {
  buildV2PreviewDocument,
  PAGE_CARD_PREVIEW_SCALE_MULTIPLIER,
} from "./buildV2PreviewDocument";

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
    let worker: Worker | null = null;
    const timer = window.setTimeout(() => {
      worker = new Worker(new URL("../../workers/v2Preview.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{
        type: "complete" | "error";
        bridge?: V2BridgeResult;
        preview?: PaintDocument;
        message?: string;
      }>) => {
        if (cancelled) return;
        if (event.data.type === "complete" && event.data.bridge && event.data.preview) {
          startTransition(() => {
            setState({ bridge: event.data.bridge!, preview: event.data.preview!, error: null, loading: false });
          });
        } else {
          setState({ bridge: null, preview: null, error: `V2 HOLD: ${event.data.message ?? "Preview worker failed"}`, loading: false });
        }
        worker?.terminate();
        worker = null;
      };
      worker.onerror = (event) => {
        if (!cancelled) {
          setState({ bridge: null, preview: null, error: `V2 HOLD: ${event.message || "Preview worker failed"}`, loading: false });
        }
        worker?.terminate();
        worker = null;
      };
      worker.postMessage({ type: "compose", input });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      worker?.terminate();
    };
  }, [enabled, input.content, input.images, input.settings, input.title]);

  return enabled ? state : DISABLED_STATE;
}
