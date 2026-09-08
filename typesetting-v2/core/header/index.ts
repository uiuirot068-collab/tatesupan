// 柱 (running header) generation — Contract §15 page-decoration layer.
// Human Visual QA HOLD round 22 (P3-O08 final-page completion, Step 1C).
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
// This module owns WHAT text each page gets (odd/even selection,
// per-page override, suppression) — `position` is passed through as the
// literal legacy enum (`"top" | "bottom"`, no parity resolution needed,
// unlike folio's own gutter/outer — 柱's position axis is vertical, not
// side-of-spread). Physical mm/pt placement remains a Renderer concern.

import type { GeneratedHeader, HeaderPosition } from "../layout/schema";

export interface HeaderSettings {
  // Matches legacy `MasterPageSettings.hashiraOdd` exactly.
  hashiraOdd: string;
  // Matches legacy `MasterPageSettings.hashiraEven` exactly.
  hashiraEven: string;
  // Matches legacy `MasterPageSettings.hashiraPosition` exactly.
  position: HeaderPosition;
}

// Matches legacy `DEFAULT_MASTER_PAGE_SETTINGS`'s own 柱-relevant fields
// exactly (`hashiraOdd: ""`, `hashiraEven: ""`, `hashiraPosition: "top"`).
export const DEFAULT_HEADER_SETTINGS: HeaderSettings = {
  hashiraOdd: "",
  hashiraEven: "",
  position: "top",
};

// Matches legacy `PageOverride` exactly (`hideHashira`/`hashiraOverride`
// — `hashiraOverride` undefined means "use the odd/even master text";
// legacy's own comment records that an EXPLICIT empty string is a
// real, distinct override value from "not overridden," not "hidden"
// (`hideHashira` is the dedicated suppression flag for that).
export interface HeaderPageOverride {
  hideHashira?: boolean;
  hashiraOverride?: string;
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
  return { text, position: settings.position };
}
