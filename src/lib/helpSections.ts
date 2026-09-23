/**
 * TSP-LOOP-027 — stable Help section identifiers.
 *
 * Single source of truth for the anchors that connect the /guide feature
 * catalogue ("TateSpun でできること") to the real Help (`public/docs/help.md`,
 * rendered by `HelpModal`).
 *
 * Contract:
 *   - IDs are explicit and semantic — never ordinal (no `section-1`), never
 *     derived from the displayed Japanese heading copy, so a small wording
 *     edit to a Help heading never breaks a link.
 *   - Every ID here MUST have a matching marker in `public/docs/help.md`:
 *         ## 見出し <!-- help-id: preview -->
 *     `HelpModal` parses those markers, strips them from the rendered text,
 *     and puts `id="help-section-<id>"` on the heading element.
 *   - `scripts/verify-tsp027-help-navigation.mjs` enforces both directions
 *     (every ID has a marker; every marker is a known ID).
 */

export const HELP_SECTION_IDS = [
  "preview",
  "vertical-typesetting",
  "ruby",
  "tcy",
  "page-break",
  "replace",
  "writing-check",
  "manuscript-transfer",
  "export",
  "page-settings",
  "preview-navigation",
  "trim-line",
  "page-selection",
  "table-of-contents",
  "colophon",
  "review-tools",
  "beta-feedback",
  "images",
  "psd-images",
  "image-storage",
  "shortcuts",
] as const;

export type HelpSectionId = (typeof HELP_SECTION_IDS)[number];

/** DOM id put on the target Help heading, and the scroll destination. */
export function helpSectionDomId(id: HelpSectionId): string {
  return `help-section-${id}`;
}

export function isHelpSectionId(value: string): value is HelpSectionId {
  return (HELP_SECTION_IDS as readonly string[]).includes(value);
}
