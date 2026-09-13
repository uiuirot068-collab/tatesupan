/// <reference lib="webworker" />

import type { PageSettings } from "../lib/pageLayout";
import { buildV2PreviewDocument } from "../lib/v2Bridge/buildV2PreviewDocument";
import { loadV2BrowserMeasurementProvider } from "../lib/v2Bridge/browserMeasurementProvider";
import { composeV2Document } from "../lib/v2Bridge/composeV2Document";
import { prepareImageResolver } from "../lib/v2Bridge/imageResolverAdapter";

interface ComposeMessage {
  type: "compose";
  input: {
    content: string;
    settings: PageSettings;
    title: string;
    images: Record<string, string>;
  };
}

self.onmessage = (event: MessageEvent<ComposeMessage>) => {
  if (event.data.type !== "compose") return;
  const input = event.data.input;
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
    const preview = buildV2PreviewDocument(bridge, input.images);
    self.postMessage({ type: "complete", bridge, preview });
  }).catch((cause: unknown) => {
    self.postMessage({
      type: "error",
      message: cause instanceof Error ? cause.message : String(cause),
    });
  });
};

export {};
