"use client";

import ColophonPageCard, { type ColophonPageCardProps } from "./ColophonPageCard";

/**
 * Canonical V2 preview entry point for a colophon page.
 *
 * Page order / physical page number come from the V2 pageSequence in
 * PreviewPane. The visual surface is shared with the fallback renderer so
 * Phase 11 can remove the old "V2 order + LEGACY appearance" split without
 * forking another copy of the four colophon templates.
 */
export default function V2ColophonPageCard(props: ColophonPageCardProps) {
  return <ColophonPageCard {...props} rendererSource="v2" />;
}
