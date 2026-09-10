/// <reference lib="webworker" />

import {
  renderPaintPlanToPdfAsync,
  type PaintPlan,
  type PublicationFontResource,
} from "../../typesetting-v2/renderer/publication/pdfGenerator";

type StartMessage = { type: "start"; plan: PaintPlan; font: PublicationFontResource };
type ControlMessage = { type: "pause" } | { type: "resume" } | { type: "cancel" };

let paused = false;
let cancelled = false;
let resumeWaiters: Array<() => void> = [];

function releaseWaiters(): void {
  const waiters = resumeWaiters;
  resumeWaiters = [];
  for (const resolve of waiters) resolve();
}

async function waitForPermission(): Promise<void> {
  if (cancelled) throw new DOMException("Export cancelled", "AbortError");
  if (paused) await new Promise<void>((resolve) => resumeWaiters.push(resolve));
  if (cancelled) throw new DOMException("Export cancelled", "AbortError");
}

self.onmessage = (event: MessageEvent<StartMessage | ControlMessage>) => {
  const message = event.data;
  if (message.type === "pause") {
    paused = true;
    return;
  }
  if (message.type === "resume") {
    paused = false;
    releaseWaiters();
    return;
  }
  if (message.type === "cancel") {
    cancelled = true;
    paused = false;
    releaseWaiters();
    return;
  }

  paused = false;
  cancelled = false;
  void renderPaintPlanToPdfAsync(message.plan, message.font, {
    beforePage: waitForPermission,
    onProgress: (current, total) => self.postMessage({ type: "progress", current, total }),
  })
    .then((result) => {
      if (cancelled) return;
      self.postMessage(
        { type: "complete", bytes: result.bytes, pageCount: result.pageCount },
        { transfer: [result.bytes.buffer] }
      );
    })
    .catch((error: unknown) => {
      if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
        self.postMessage({ type: "cancelled" });
        return;
      }
      self.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
    });
};

export {};
