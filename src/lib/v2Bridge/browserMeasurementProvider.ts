import { loadV2FontBytes, V2_PUBLICATION_FONT_PATH } from "../v2BrowserExport";
import { createShipporiMinchoMeasurementProviderFromBytes } from "../../../typesetting-v2/core/measurement/shipporiMinchoProviderCore";

export const V2_BROWSER_MEASUREMENT_PROVIDER_ID = "tatespun-shippori-mincho-real-measurement-provider";

let providerPromise: ReturnType<typeof createProvider> | null = null;

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function createProvider() {
  const bytes = await loadV2FontBytes();
  if (!globalThis.crypto?.subtle) {
    throw new Error("Shippori Mincho measurement unavailable: Web Crypto SHA-256 is required.");
  }
  const digestInput = bytes.slice().buffer as ArrayBuffer;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", digestInput);
  return createShipporiMinchoMeasurementProviderFromBytes(bytes, hex(digest), V2_PUBLICATION_FONT_PATH);
}

/** No fake fallback: failures reject and a later call may retry. */
export function loadV2BrowserMeasurementProvider() {
  providerPromise ??= createProvider().catch((error: unknown) => {
    providerPromise = null;
    throw error;
  });
  return providerPromise;
}
