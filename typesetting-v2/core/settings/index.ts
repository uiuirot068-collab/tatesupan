// LayoutSettings (Core Contract §16). Product-facing input, authored in mm
// (the documentation/display unit, §21) — the Core converts these to
// GeometryTicks once, at ingestion (ingestSettings(), P3-L09), before any
// canonical computation begins. This file declares the type only; ingestion
// is implemented when P3-L09 wires it into the line composer.

export interface LayoutSettings {
  presetId: string;
  pageWidthMm: number;
  pageHeightMm: number;
  writingOrientation: "VERTICAL"; // Editor's horizontal/vertical mode is out of Core scope (P3-O10)
  bodyFontRef: string;
  bodyFontSizePt: number;
  headerFooterFontRef?: string; // 柱/奥付, independently overridable — Master HD-005
  columns: number;
  marginsMm: { top: number; right: number; bottom: number; left: number };
  hangingPunctuationEnabled: boolean;
  rubyEnabled: boolean;
  rubyScale: number;
  naturalPitch: true; // Contract §18 — always true for the default composition mode
}

// Human/Product decision (2026-09-07, P3-O08 Publication ruby-scale
// re-audit): TateSpun v2's canonical ruby reading advance/font-size is
// FROZEN at 50% of the body em — a genuine typography setting, not a
// Publication-only workaround. The single authoritative source of this
// number: every consumer (Core's own `rubyReadingExtentTick` measurement
// call, Preview's `.ruby-annotation` paint size, Publication's own
// annotation paint size) must derive from THIS constant, never keep an
// independently-hardcoded value (the prior state — Core measuring at
// full body-em with no scale applied at all, Preview painting at a
// separately-chosen 0.55em, Publication independently choosing another
// 0.55 — is exactly the inconsistency this decision resolves).
export const DEFAULT_RUBY_SCALE = 0.5;
