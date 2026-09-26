/// <reference lib="webworker" />

import type { PageSettings } from "../lib/pageLayout";
import { buildV2PreviewDocument } from "../lib/v2Bridge/buildV2PreviewDocument";
import { loadV2BrowserMeasurementProvider } from "../lib/v2Bridge/browserMeasurementProvider";
import { composeV2Layout } from "../lib/v2Bridge/composeV2Document";
import { prepareImageResolver, type ImageResolutionCache } from "../lib/v2Bridge/imageResolverAdapter";

// Phase 7: this worker is reused across compositions (previewWorkerClient.ts),
// so decoded images survive between them.
const imageCache: ImageResolutionCache = new Map();

interface ComposeMessage {
  type: "compose";
  /** Echoed back so the client can ignore superseded replies (Phase 7 worker reuse). */
  requestId?: number;
  input: {
    content: string;
    settings: PageSettings;
    title: string;
    images: Record<string, string>;
  };
}

self.onmessage = (event: MessageEvent<ComposeMessage>) => {
  if (event.data.type !== "compose") return;
  const { input, requestId } = event.data;
  void Promise.all([
    loadV2BrowserMeasurementProvider(),
    prepareImageResolver(input.images, imageCache),
  ]).then(([measurement, imageResolver]) => {
    // Layout only: export builds its own font-aware PaintPlan from bridge.model.
    const bridge = composeV2Layout({
      title: input.title.trim() || "TateSpun",
      content: input.content,
      settings: input.settings,
      measurement,
      imageResolver,
    });
    const preview = buildV2PreviewDocument(bridge, input.images);
    self.postMessage({ type: "complete", requestId, bridge, preview });
  }).catch((cause: unknown) => {
    self.postMessage({
      type: "error",
      requestId,
      message: cause instanceof Error ? cause.message : String(cause),
    });
  });
};

export {};
