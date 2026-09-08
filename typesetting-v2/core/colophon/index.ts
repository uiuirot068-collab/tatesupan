// Colophon (奥付) as a distinct CanonicalDocument-level element (Core
// Contract §15, Master HD-006). A ColophonBlock has its own page(s) and is
// never threaded through body CanonicalColumn/CanonicalLine — this is
// enforced by construction here: composeColophon takes only pages already
// produced by an entirely separate compose/page.ts run over the colophon's
// own SourceBlock, and nothing in this module's signature can accept or
// return a body CanonicalColumn/CanonicalLine at all. Mirrors, rather than
// undoes, the existing TSP-LOOP-005 colophon flow-isolation precedent.

import type { BlockId } from "../source/span";
import type { CanonicalPage, ColophonBlock } from "../layout/schema";

export function composeColophon(sourceBlockId: BlockId, pages: CanonicalPage[]): ColophonBlock {
  return { sourceBlockId, pages };
}

// Human Visual QA HOLD round 27 (P3-O08 final-page completion, Step 2B):
// ports the REAL, shipped legacy content-compilation logic
// (`src/lib/colophon.ts`'s own `colophonRenderModel`) — never
// re-derived or redesigned. Core does not import from `src/` (a
// production-only, distinct layer), so this is a fresh v2-owned
// function with the SAME field shape/filtering/ordering semantics,
// not a copy-paste of the Production module. Legacy's own 4 templates
// (`standard`/`center`/`minimal`/`classic`) are confirmed, by direct
// read of `ColophonPageCard.tsx`, to render the EXACT SAME
// `{rows, freeText}` data — templates are a VISUAL/placement concern
// only (`ColophonTemplate` component), never a content-filtering
// concern — so this compiler does not need a template parameter at
// all to be faithful.
export interface ColophonFieldInput {
  label: string;
  value: string;
  visible: boolean;
}

export interface ColophonContentSettings {
  fields: ColophonFieldInput[];
  freeText: string;
}

export interface ColophonCompiledRow {
  label: string;
  value: string;
}

export interface ColophonCompiledContent {
  rows: ColophonCompiledRow[];
  freeText: string;
}

/**
 * Ported verbatim from legacy `colophonRenderModel`
 * (`src/lib/colophon.ts:400-405`): a field is included only when
 * `visible` AND (`label` OR `value` has non-whitespace content) —
 * both-empty fields are silently excluded (legacy's own "blank field"
 * behavior, not invented here). Order is preserved exactly as
 * supplied (legacy never re-sorts). `freeText` is passed through
 * unfiltered — legacy's own `FreeText` component (not this function)
 * decides whether to render it, based on the SAME
 * `text.trim() !== ""` check, which callers can apply identically.
 */
export function compileColophonContent(settings: ColophonContentSettings): ColophonCompiledContent {
  const rows = settings.fields
    .filter((f) => f.visible && (f.label.trim() !== "" || f.value.trim() !== ""))
    .map((f) => ({ label: f.label, value: f.value }));
  return { rows, freeText: settings.freeText };
}

// Human Visual QA HOLD round 27: pagePosition (WHERE the colophon's own
// pages land relative to the body) is a distinct concept from placement
// (WHERE content sits within a colophon page) -- legacy's own doc
// comment at `src/lib/colophon.ts:55` states this explicitly ("B. BLOCK
// PLACEMENT... とは完全に別概念"). This function ports ONLY the
// pagePosition DECISION (verbatim from `resolveColophonInsertion`,
// `src/lib/colophon.ts:266-277`): given a requested position and the
// real body page count, it decides how many body pages precede the
// colophon and whether the request fell back. Ported as a pure
// decision function so its real fallback semantics (never crash, never
// lose the colophon, silently fall back to "end" when the requested
// body page does not exist) are provable in isolation.
//
// DISCLOSED GAP (round 27): this function's OUTPUT is not yet wired
// into `core/layout/assemble.ts`'s actual page composition. Executing
// `{mode:"after-body-page"}` for real would require re-interleaving
// `CanonicalDocument.pages` itself and re-deriving every subsequent
// body page's own folio/header pageIndex -- materially larger than
// this round's scope. Only `{mode:"end"}` (precedingBodyPages === all
// body pages) is actually wired end-to-end this round; see
// qa/evidence/P3_O08_STRUCTURAL_COLOPHON_REAL_PRODUCT_PORT.md.
export type ColophonPagePosition = { mode: "end" } | { mode: "after-body-page"; afterBodyPage: number };

export interface ColophonInsertion {
  precedingBodyPages: number;
  fallback: boolean;
  requestedPage: number | null;
}

export function resolveColophonInsertion(position: ColophonPagePosition, bodyPageCount: number): ColophonInsertion {
  const n = Math.max(0, Math.floor(bodyPageCount));
  if (position.mode === "after-body-page") {
    const req = position.afterBodyPage;
    if (req <= n) return { precedingBodyPages: req, fallback: false, requestedPage: req };
    return { precedingBodyPages: n, fallback: true, requestedPage: req };
  }
  return { precedingBodyPages: n, fallback: false, requestedPage: null };
}
