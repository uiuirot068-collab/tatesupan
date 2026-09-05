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
