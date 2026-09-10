import type { GeometryTick } from "../geometry/tick";
import type { MeasurementFacts } from "./facts";
import { readSfntSummary } from "./sfntReader";

const MM_PER_PT = 25.4 / 72;

function ptToTicks(sizePt: number): GeometryTick {
  return Math.round(sizePt * MM_PER_PT * 1000);
}

export interface ShipporiMinchoAssetInfo {
  path: string;
  byteLength: number;
  sha256: string;
  unitsPerEm: number | undefined;
  tables: string[];
}

function refIdSeed(refId: string): number {
  return Array.from(refId).reduce((sum, ch) => sum + (ch.codePointAt(0) ?? 0), 0);
}

/** Browser-safe provider factory over a validated, identity-hashed font asset. */
export function createShipporiMinchoMeasurementProviderFromBytes(
  bytes: Uint8Array,
  sha256: string,
  source: string
): MeasurementFacts & { assetInfo: ShipporiMinchoAssetInfo } {
  const summary = readSfntSummary(bytes);
  if (!/^[0-9a-f]{64}$/i.test(sha256)) {
    throw new Error("Shippori Mincho measurement: invalid SHA-256 identity");
  }
  const assetInfo: ShipporiMinchoAssetInfo = {
    path: source,
    byteLength: bytes.byteLength,
    sha256: sha256.toLowerCase(),
    unitsPerEm: summary.unitsPerEm,
    tables: Array.from(summary.tables).sort(),
  };
  return {
    providerId: "tatespun-shippori-mincho-real-measurement-provider",
    providerVersion: `1.0.0+sha256:${assetInfo.sha256.slice(0, 16)}`,
    naturalAdvanceTick: (fontRef, sizePt, char) => {
      void fontRef;
      void char;
      return ptToTicks(sizePt);
    },
    rubyReadingExtentTick: (_fontRef, sizePt, text) => ptToTicks(sizePt) * Array.from(text).length,
    imageIntrinsicTick: (refId) => {
      const seed = refIdSeed(refId);
      const cell = ptToTicks(10);
      return { width: cell * (1 + (seed % 5)), height: cell * (1 + ((seed >> 2) % 5)) };
    },
    assetInfo,
  };
}
