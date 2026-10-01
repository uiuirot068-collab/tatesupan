/**
 * Phase 11 残件④: who may act on the Preview page list.
 *
 * In V2 mode the Preview shows the LEGACY paginator's cards only as a
 * provisional stand-in until the first V2 layout exists (or while V2 is on
 * HOLD) — the cards never go blank, but their page numbers / ranges are not
 * the canonical ones PDF/JPG/ZIP export. Anything that would WRITE something
 * keyed by those page indices (page reorder, image insertion at a page's
 * range, per-page ノンブル/柱 overrides, page selection, image-break
 * warning pages) waits for the canonical list instead of recording a LEGACY
 * page that the V2 layout may number differently.
 *
 * LEGACY mode (rollback) is canonical by definition and unchanged.
 */
export interface PreviewListAuthorityInput {
  useV2Engine: boolean;
  /** The V2 page model's own source text, `null` before the first V2 layout. */
  v2SourceContent: string | null;
  /** The manuscript the Preview currently renders. */
  content: string;
}

export interface PreviewListAuthority {
  /** The visible page list is the one export uses. */
  canonical: boolean;
  /** Source ranges match `content` and may drive content edits (reorder / insert). */
  rangesCurrent: boolean;
  /** Page-keyed writes (selection, overrides, reorder, insertion) are allowed. */
  pageActionsEnabled: boolean;
}

export function resolvePreviewListAuthority(input: PreviewListAuthorityInput): PreviewListAuthority {
  if (!input.useV2Engine) return { canonical: true, rangesCurrent: true, pageActionsEnabled: true };
  const canonical = input.v2SourceContent !== null;
  return {
    canonical,
    rangesCurrent: canonical && input.v2SourceContent === input.content,
    pageActionsEnabled: canonical,
  };
}

const NO_PAGE_INDICES: ReadonlyMap<string, number[]> = new Map();

/**
 * Image-break warnings record the page of each broken image's marker. Before
 * the canonical list exists there is no page to record yet; the warning is
 * recorded (and announced) as soon as it does, with the canonical page.
 */
export function warningPageIndices(
  authority: PreviewListAuthority,
  pageIndicesById: ReadonlyMap<string, number[]>
): ReadonlyMap<string, number[]> {
  return authority.canonical ? pageIndicesById : NO_PAGE_INDICES;
}
