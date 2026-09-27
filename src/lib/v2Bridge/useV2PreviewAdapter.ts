"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { PageSettings } from "../pageLayout";
import { CompositionGate, type V2CompositionInput } from "./compositionRevision";
import { referencedImages, ReusablePreviewWorker } from "./previewWorkerClient";
import type { V2PreviewLayout, V2PublicationModel } from "./previewWorkerProtocol";
import type { PaintDocument } from "../../../typesetting-v2/renderer/preview/paintModel";
import { applyPreviewTransfer, type KeptPreview, type PreviewTransfer } from "./previewDelta";

/**
 * The ONE intentional debounce before a V2 composition (Phase 7): it bounds
 * worker work for every input — manuscript text, live title typing, settings
 * sliders. The manuscript already arrives debounced from the Editor (a
 * React.memo boundary for PreviewPane), so there is no third stage.
 */
export const V2_COMPOSITION_DEBOUNCE_MS = 180;

export {
  buildV2PreviewDocument,
  PAGE_CARD_PREVIEW_SCALE_MULTIPLIER,
} from "./buildV2PreviewDocument";

export interface V2PreviewAdapterState {
  /** Phase 8: the compact layout (page sequence + page model); export-only data stays in the worker. */
  layout: V2PreviewLayout | null;
  preview: PaintDocument | null;
  error: string | null;
  loading: boolean;
  /** The exact input `layout`/`preview` were composed from (Phase 3 revision contract). */
  input: V2CompositionInput | null;
}

export interface V2PreviewAdapter extends V2PreviewAdapterState {
  /**
   * Resolves with the layout composed from exactly `input` — immediately when
   * that is the current layout, otherwise when the pipeline finishes it.
   * Rejects if that composition fails or the caller supersedes it.
   */
  awaitComposition: (input: V2CompositionInput) => Promise<V2PreviewLayout>;
  /**
   * Phase 8: the export-only publication model of `layout` — a layout this
   * adapter produced for exactly `input` (from `awaitComposition(input)`).
   */
  publicationModel: (layout: V2PreviewLayout, input: V2CompositionInput) => Promise<V2PublicationModel>;
  /**
   * Phase 9: posts the same model to `port` (the export worker's), so it
   * never crosses the main thread.
   */
  deliverPublication: (layout: V2PreviewLayout, input: V2CompositionInput, port: MessagePort) => Promise<void>;
  /** Rejects pending waits whose input is no longer `current`. */
  supersedePendingCompositions: (current: V2CompositionInput) => void;
}

const DISABLED_STATE: V2PreviewAdapterState = {
  layout: null,
  preview: null,
  error: null,
  loading: false,
  input: null,
};

/** Async browser bridge; it never falls back to fake measurements. */
export function useV2PreviewAdapter(
  enabled: boolean,
  input: {
    content: string;
    settings: PageSettings;
    title: string;
    images: Record<string, string>;
    /**
     * Phase 9: the open document. A different key means a document switch:
     * the next layout is requested as a full Preview snapshot, never a delta.
     */
    documentKey?: string;
  }
): V2PreviewAdapter {
  const [state, setState] = useState<V2PreviewAdapterState>({
    layout: null,
    preview: null,
    error: null,
    loading: enabled,
    input: null,
  });
  const [gate] = useState(() => new CompositionGate<V2PreviewLayout>());
  // Phase 7: one reusable layout worker (lib/v2Bridge/previewWorkerClient.ts).
  const [workerClient] = useState(() => new ReusablePreviewWorker(
    () => new Worker(new URL("../../workers/v2Preview.worker.ts", import.meta.url), { type: "module" })
  ));
  useEffect(() => () => workerClient.dispose(), [workerClient]);
  // Phase 9 (previewDelta.ts): the Preview this adapter applied last — the
  // base the worker may send the next layout's pages against.
  const appliedRef = useRef<(KeptPreview & { documentKey: string | undefined }) | null>(null);
  const documentKey = input.documentKey;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const composing: V2CompositionInput = {
      content: input.content,
      settings: input.settings,
      title: input.title,
      images: input.images,
    };
    // Same manuscript/settings as the layout already on screen (e.g. a new
    // but equal settings object): nothing to recompute.
    if (gate.currentFor(composing)) return;
    let cancelRequest: (() => void) | null = null;
    const fail = (message: string) => {
      appliedRef.current = null;
      const failed: V2PreviewAdapterState = { layout: null, preview: null, error: `V2 HOLD: ${message}`, loading: false, input: null };
      setState(failed);
      gate.fail(composing, new Error(failed.error ?? "V2 HOLD"));
    };
    const timer = window.setTimeout(() => {
      // The layout depends only on the images the manuscript references;
      // the gate/export contract still compares the full `composing` input.
      const payload = workerPayload(composing);
      const send = (allowDelta: boolean) => {
        const applied = appliedRef.current;
        const base = allowDelta && applied && applied.documentKey === documentKey ? applied.layoutId : undefined;
        cancelRequest = workerClient.request(payload, (outcome) => {
          if (!outcome.ok) {
            fail(outcome.message);
            return;
          }
          const layout = outcome.reply.layout as V2PreviewLayout | undefined;
          const transfer = outcome.reply.preview as PreviewTransfer | undefined;
          if (!layout || !transfer) {
            fail("Preview worker failed");
            return;
          }
          const preview = applyPreviewTransfer(transfer, appliedRef.current);
          if (!preview) {
            // A delta against a Preview this adapter does not hold: ask once
            // more for a full snapshot of the same input.
            if (allowDelta) send(false);
            else fail("Preview worker failed");
            return;
          }
          appliedRef.current = { layoutId: layout.layoutId, document: preview, documentKey };
          startTransition(() => {
            setState({ layout, preview, error: null, loading: false, input: composing });
          });
          gate.complete(composing, layout);
        }, base === undefined ? undefined : { basePreviewLayoutId: base });
      };
      send(true);
    }, V2_COMPOSITION_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      cancelRequest?.();
    };
  }, [documentKey, enabled, gate, input.content, input.images, input.settings, input.title, workerClient]);

  const awaitComposition = useCallback((wanted: V2CompositionInput) => gate.waitFor(wanted), [gate]);
  const publicationModel = useCallback(
    (layout: V2PreviewLayout, wanted: V2CompositionInput) => workerClient.requestPublication(layout.layoutId, layout.pageSequence, workerPayload(wanted)),
    [workerClient]
  );
  const deliverPublication = useCallback(
    (layout: V2PreviewLayout, wanted: V2CompositionInput, port: MessagePort) =>
      workerClient.deliverPublication(layout.layoutId, layout.pageSequence, workerPayload(wanted), port),
    [workerClient]
  );
  const supersedePendingCompositions = useCallback((current: V2CompositionInput) => gate.supersede(current), [gate]);

  return enabled
    ? { ...state, awaitComposition, publicationModel, deliverPublication, supersedePendingCompositions }
    : { ...DISABLED_STATE, awaitComposition, publicationModel, deliverPublication, supersedePendingCompositions };
}

/** The layout depends only on the images the manuscript references; the gate still compares the full input. */
function workerPayload(input: V2CompositionInput): V2CompositionInput {
  return { ...input, images: referencedImages(input.images, input.content) };
}
