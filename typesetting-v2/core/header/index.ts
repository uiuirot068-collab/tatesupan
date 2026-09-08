// 柱 (running header) generation — Contract §15 page-decoration layer.
// Human Visual QA HOLD round 22/24/25 (P3-O08 final-page completion,
// Steps 1C/1D and its own correction).
//
// Ported field names/defaults/semantics VERBATIM from the already-shipped
// legacy `src/lib/pageLayout.ts`'s `MasterPageSettings`
// (`hashiraOdd`/`hashiraEven`/`hashiraPosition`) and `PageOverride`
// (`hideHashira`/`hashiraOverride`), and `src/components/PageCard.tsx`'s
// own `defaultHashiraText = isOddPage ? masterPage.hashiraOdd :
// masterPage.hashiraEven` (:515) — never re-derived or guessed. Content
// is arbitrary user-authored text; this module never invents
// title/author auto-population (legacy does not do this either,
// confirmed by direct audit — see
// qa/evidence/P3_O08_FOLIO_HEADER_COMPLETE_CONTRACT.md).
//
// Round 24 (Human Product Decision): a v2-native ENHANCEMENT — legacy
// only ever anchored 柱 to the 小口 (outer) edge, confirmed by direct
// read of `PageCard.tsx`'s own `HashiraOverlay` (its own comment:
// "コンテナの「小口側の端」は奇数=左端・偶数=右端になる...NombreOverlayの
// 「小口」判定と同じ規約"; `textStyle` aligns odd->left, even->right —
// exactly `resolveFolioPhysicalSide("outer", isOddPage)`, never
// configurable, never "gutter"). `headerSettingsFromLegacy` below
// recovers this exact legacy default for old documents/settings.
//
// Round 25 (correction, Human QA-caught product-model error): round
// 24's own "vertical CENTER" reading was wrong — "CENTER" was never
// meant as vertical page-center. The corrected model: `HeaderBand`
// ("top"|"bottom", the ONLY vertical axis, matching legacy's own real
// `HashiraPosition` exactly) crossed with `FolioPosition` itself,
// reused DIRECTLY as the horizontal axis (小口/ノド/center is literally
// the same concept folio already models — not a lookalike copy).
// Side/horizontal resolution reuses `core/folio/index.ts`'s own
// `resolveFolioPhysicalSide` UNCHANGED — the SAME odd/even parity
// logic, not a second implementation.
//
// This module owns WHAT text each page gets (odd/even selection,
// per-page override, suppression) and resolves `position` (band
// pass-through, horizontal parity-resolved). Physical mm/pt placement
// remains a Renderer concern.

import type { FolioPosition, GeneratedHeader, HeaderBand, HeaderPositionSetting, ResolvedHeaderPosition } from "../layout/schema";
import { resolveFolioPhysicalSide } from "../folio";

export interface HeaderSettings {
  // Matches legacy `MasterPageSettings.hashiraOdd` exactly.
  hashiraOdd: string;
  // Matches legacy `MasterPageSettings.hashiraEven` exactly.
  hashiraEven: string;
  // v2-native 2-axis position (round 25) — see this file's own header
  // comment. Use `headerSettingsFromLegacy` to construct this from an
  // old document's own bare `hashiraPosition: "top"|"bottom"` value.
  position: HeaderPositionSetting;
}

// Matches legacy `DEFAULT_MASTER_PAGE_SETTINGS`'s own 柱-relevant fields
// exactly (`hashiraOdd: ""`, `hashiraEven: ""`, `hashiraPosition: "top"`),
// with `horizontal` recovered from legacy's own real, always-outer
// behavior (see this file's own header comment).
export const DEFAULT_HEADER_SETTINGS: HeaderSettings = {
  hashiraOdd: "",
  hashiraEven: "",
  position: { band: "top", horizontal: "outer" },
};

/**
 * Legacy compatibility: recovers a v2 `HeaderSettings.position` from an
 * old document's own bare `hashiraPosition: "top" | "bottom"` value —
 * `horizontal` is always `"outer"`, matching legacy's own real,
 * unconfigurable behavior exactly (never `"gutter"`, never `"center"` —
 * those are genuinely new v2-only capabilities with no legacy
 * equivalent to recover).
 */
export function headerSettingsFromLegacy(hashiraOdd: string, hashiraEven: string, hashiraPosition: HeaderBand): HeaderSettings {
  return { hashiraOdd, hashiraEven, position: { band: hashiraPosition, horizontal: "outer" } };
}

// Matches legacy `PageOverride` exactly (`hideHashira`/`hashiraOverride`
// — `hashiraOverride` undefined means "use the odd/even master text";
// legacy's own comment records that an EXPLICIT empty string is a
// real, distinct override value from "not overridden," not "hidden"
// (`hideHashira` is the dedicated suppression flag for that).
export interface HeaderPageOverride {
  hideHashira?: boolean;
  hashiraOverride?: string;
}

function resolveHeaderPosition(setting: HeaderPositionSetting, isOddPage: boolean): ResolvedHeaderPosition {
  return { band: setting.band, horizontal: resolveFolioPhysicalSide(setting.horizontal, isOddPage) };
}

/**
 * `pageIndex` is 0-based (matches `CanonicalPage.order`'s own
 * convention, and `core/folio/index.ts`'s own `composeFolioForPage`).
 * Returns `undefined` when suppressed (`hideHashira`) or when the
 * resolved text is empty (legacy's own default `hashiraOdd`/
 * `hashiraEven: ""` produces no visible 柱 — an empty string is not a
 * real, paintable header, matching `NombreOverlay`'s own "nothing to
 * paint" convention for empty content).
 */
export function composeHeaderForPage(pageIndex: number, settings: HeaderSettings, override?: HeaderPageOverride): GeneratedHeader | undefined {
  if (override?.hideHashira) return undefined;
  const pageNumber = pageIndex + 1;
  const isOddPage = pageNumber % 2 === 1;
  const text = override?.hashiraOverride ?? (isOddPage ? settings.hashiraOdd : settings.hashiraEven);
  if (text.length === 0) return undefined;
  return { text, position: resolveHeaderPosition(settings.position, isOddPage) };
}

export type { HeaderBand, FolioPosition as HeaderHorizontalPosition };
