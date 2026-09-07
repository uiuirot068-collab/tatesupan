// P3-O08 — Real Shippori Mincho MeasurementFacts.
//
// CENTRAL FINDING (see qa/evidence/P3_O08_REAL_MEASUREMENT_FACTS.md §2/§7
// for the full audit): Natural Pitch is a FROZEN Human Product Decision
// (Master HD-015/HD-018, Core Contract §18) — "natural 1em declared-pitch
// composition": character advance equals the DECLARED point size itself,
// never a per-glyph measurement, and the Core must never stretch pitch to
// fill a page. This is not an approximation `fakeProvider.ts` takes as a
// shortcut — it is the contractually CORRECT formula for both body advance
// and ruby-reading extent (Japanese vertical typesetting's own standard
// uniform per-character cell convention, independently confirmed against
// InDesign's real PDF output during an earlier P3-O loop — see
// qa/evidence/P3_O08_REAL_MEASUREMENT_FACTS.md §2). A "real" provider that
// read Shippori Mincho's own hmtx/vmtx per-glyph advance widths and used
// THEM instead would be a CONTRACT VIOLATION, not an improvement — it
// would silently reintroduce proportional (non-monospaced-cell) Japanese
// body pitch, which Natural Pitch explicitly forbids.
//
// What THIS provider adds over `fakeProvider.ts`, honestly: a REAL
// identity tied to the actual, license-cleared, committed font asset
// (`qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf` — the
// exact file the P3-O08 Font Embedding Gate already Human-QA'd) instead of
// an arbitrary fixed string, so `measurementIdentity` vs `paintFontIdentity`
// comparisons (already wired throughout Preview/Publication) become
// meaningful for the first time, and structural validation that the file
// is a real, well-formed sfnt font (never silently treating a corrupt/
// missing asset as valid). The arithmetic itself is deliberately identical
// to the fake provider's — this is the frozen-contract-correct outcome,
// not an oversight.
//
// I/O BOUNDARY: reading the font file happens ONCE, synchronously, inside
// this factory function — never inside `composeCanonicalDocument`'s own
// deterministic composition loop, which only ever consumes the already-
// built `MeasurementFacts` object it returns (Core Contract §17: Measurement
// Provider is a local, one-time-versioned-input concept, not something Core
// recomputes mid-flow). No network access, ever.

import { createHash } from "crypto";
import { readFileSync } from "fs";
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

// Deterministic, seed-based fixture (identical to fakeProvider.ts's own
// implementation) — imageIntrinsicTick has no relationship to a BODY FONT
// at all (it concerns embedded manuscript images), so a font measurement
// provider legitimately has nothing "more real" to offer here until a real
// image-asset resolution system exists. Disclosed, not silently reused.
function refIdSeed(refId: string): number {
  return Array.from(refId).reduce((sum, ch) => sum + (ch.codePointAt(0) ?? 0), 0);
}

export function createShipporiMinchoMeasurementProvider(fontPath: string): MeasurementFacts & { assetInfo: ShipporiMinchoAssetInfo } {
  const bytes = readFileSync(fontPath);
  const summary = readSfntSummary(bytes); // throws structurally on a malformed/truncated file
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const assetInfo: ShipporiMinchoAssetInfo = {
    path: fontPath,
    byteLength: bytes.byteLength,
    sha256,
    unitsPerEm: summary.unitsPerEm,
    tables: Array.from(summary.tables).sort(),
  };

  return {
    // Real, asset-derived identity — the same font file always produces the
    // same providerVersion; a different file (a different weight, a
    // corrupted download, a font substitution) produces a different one,
    // making `measurementIdentity !== paintFontIdentity` a meaningful,
    // detectable fact rather than a comparison between two fixed strings.
    providerId: "tatespun-shippori-mincho-real-measurement-provider",
    providerVersion: `1.0.0+sha256:${sha256.slice(0, 16)}`,
    // Natural Pitch (Contract §18 / Master HD-015/HD-018): declared point
    // size IS the natural advance, uniformly, regardless of `char` — see
    // this module's own header comment for why this is the contractually
    // correct formula, not a simplification.
    naturalAdvanceTick: (_fontRef, sizePt, _char) => ptToTicks(sizePt),
    // Ruby reading extent: the same uniform per-character convention,
    // applied to the reading text's own code-point count (confirmed
    // against the actual Core consumer, core/compose/line.ts, which
    // currently supplies the BODY font size here — a separate, pre-
    // existing, undisclosed-until-now observation recorded in the evidence
    // doc §9, not fixed by this task, since altering how rubyScale factors
    // into composition is a Core-composition change, not a MeasurementFacts
    // reality question).
    rubyReadingExtentTick: (_fontRef, sizePt, text) => ptToTicks(sizePt) * Array.from(text).length,
    imageIntrinsicTick: (refId) => {
      const seed = refIdSeed(refId);
      const cell = ptToTicks(10);
      return {
        width: cell * (1 + (seed % 5)),
        height: cell * (1 + ((seed >> 2) % 5)),
      };
    },
    assetInfo,
  };
}
