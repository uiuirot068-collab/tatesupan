/** Node filesystem adapter for the shared, browser-safe Shippori provider. */
import { createHash } from "crypto";
import { readFileSync } from "fs";
import type { MeasurementFacts } from "./facts";
import {
  createShipporiMinchoMeasurementProviderFromBytes,
  type ShipporiMinchoAssetInfo,
} from "./shipporiMinchoProviderCore";

export type { ShipporiMinchoAssetInfo } from "./shipporiMinchoProviderCore";

export function createShipporiMinchoMeasurementProvider(
  fontPath: string
): MeasurementFacts & { assetInfo: ShipporiMinchoAssetInfo } {
  const bytes = readFileSync(fontPath);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return createShipporiMinchoMeasurementProviderFromBytes(bytes, sha256, fontPath);
}
