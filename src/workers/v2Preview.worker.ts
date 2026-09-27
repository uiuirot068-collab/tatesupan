/// <reference lib="webworker" />

import { loadV2BrowserMeasurementProvider } from "../lib/v2Bridge/browserMeasurementProvider";
import { composeV2Layout } from "../lib/v2Bridge/composeV2Document";
import { prepareImageResolver, type ImageResolutionCache } from "../lib/v2Bridge/imageResolverAdapter";
import { PreviewWorkerSession, type PreviewWorkerRequest, type PublicationPortMessage } from "../lib/v2Bridge/previewWorkerProtocol";

// Phase 7: this worker is reused across compositions (previewWorkerClient.ts),
// so decoded images survive between them.
const imageCache: ImageResolutionCache = new Map();

// Phase 8: layout replies carry only what Preview reads; the export-only
// publication model stays here until an export asks for it
// (previewWorkerProtocol.ts).
const session = new PreviewWorkerSession(async (input) => {
  const [measurement, imageResolver] = await Promise.all([
    loadV2BrowserMeasurementProvider(),
    prepareImageResolver(input.images, imageCache),
  ]);
  // Layout only: export builds its own font-aware PaintPlan from the model.
  return composeV2Layout({
    title: input.title.trim() || "TateSpun",
    content: input.content,
    settings: input.settings,
    measurement,
    imageResolver,
  });
});

// Messages are handled strictly in order, so an export request queued behind
// a composition sees that composition's result.
let queue: Promise<void> = Promise.resolve();

self.onmessage = (event: MessageEvent<PreviewWorkerRequest>) => {
  const message = event.data;
  if (message.type !== "compose" && message.type !== "publication") return;
  // Phase 9: a PDF export's model goes straight to the export worker's port;
  // the main thread only hears that it was delivered.
  const port = message.type === "publication" ? message.port : undefined;
  queue = queue
    .then(async () => {
      const reply = await session.handle(message);
      if (port && reply.type === "publication" && reply.publication) {
        const delivered: PublicationPortMessage = { ok: true, publication: reply.publication };
        port.postMessage(delivered);
        port.close();
        self.postMessage({ type: "publication", requestId: reply.requestId, delivered: true });
        return;
      }
      self.postMessage(reply);
    })
    .catch((cause: unknown) => {
      const text = cause instanceof Error ? cause.message : String(cause);
      if (port) {
        const failed: PublicationPortMessage = { ok: false, message: text };
        port.postMessage(failed);
        port.close();
      }
      self.postMessage({ type: "error", requestId: message.requestId, message: text });
    });
};

export {};
