/**
 * Editor per-page overrides → V2 page furniture (Phase 3 export hardening).
 *
 * The Editor stores `PageSettings.pageOverrides` keyed by BODY page number
 * (`bodyIndex + 1`: PreviewPane → PageCard `hideNombre`/`hideHashira`/
 * `hashiraOverride`). Core's `composeCanonicalDocument` applies
 * `headerPageOverrides` by PHYSICAL page number (`assemble.ts`,
 * `overrides[physicalIndex + 1]`), and has no per-page `hideNombre` at all.
 * With a colophon placed after a body page, every override after it therefore
 * landed one page off in export (and the colophon inherited a body page's
 * override), and a page whose ノンブル the user hid still printed one.
 *
 * This re-resolves furniture once, after composition, from Core's own
 * `pageSequence` using Core's own per-page composer: body pages get the
 * override of THEIR body number, the colophon gets none, and `hideNombre`
 * removes the folio. Pages with no override are byte-identical to Core's
 * result (same `composeHeaderForPage` call, same folio object).
 */
import type { PageOverride } from "../pageLayout";
import type { CanonicalDocument, CanonicalPage } from "../../../typesetting-v2/core/layout/schema";
import { composeHeaderForPage, type HeaderPageOverride, type HeaderSettings } from "../../../typesetting-v2/core/header";

export function headerOverrideFromEditor(override: PageOverride | undefined): HeaderPageOverride | undefined {
  if (!override) return undefined;
  const mapped: HeaderPageOverride = {};
  if (override.hideHashira) mapped.hideHashira = true;
  if (override.hashiraOverride !== undefined) mapped.hashiraOverride = override.hashiraOverride;
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

function withFurniture(page: CanonicalPage, header: CanonicalPage["header"], folio: CanonicalPage["folio"]): CanonicalPage {
  const { header: _header, folio: _folio, ...rest } = page;
  void _header;
  void _folio;
  return { ...rest, ...(folio ? { folio } : {}), ...(header ? { header } : {}) };
}

/**
 * Phase 11 work-owned TOC (`V2TocPlacement` subset): its canonical body pages
 * take a ノンブル like any printed page (Human QA round 2: the TOC is a
 * publication page, its folio is never suppressed) but no 柱 (unchanged
 * Phase 11 contract), and no Editor page override (they are not Editor
 * pages). Editor body pages after the TOC keep THEIR body numbers.
 */
export interface SyntheticTocPages {
  firstCanonicalPage: number;
  pageCount: number;
}

export function applyEditorPageOverrides(
  document: CanonicalDocument,
  headerSettings: HeaderSettings | undefined,
  pageOverrides: Record<number, PageOverride> | undefined,
  toc?: SyntheticTocPages
): CanonicalDocument {
  const bodyPages = document.pages.slice();
  const colophonPages = document.colophon ? document.colophon.pages.slice() : undefined;
  const tocFirst = toc?.firstCanonicalPage ?? 0;
  const tocCount = toc?.pageCount ?? 0;
  document.pageSequence.forEach((ref, physicalIndex) => {
    const pages = ref.kind === "body" ? bodyPages : colophonPages;
    if (!pages) return;
    const page = pages[ref.index];
    const isSyntheticToc = ref.kind === "body" && tocCount > 0 && ref.index >= tocFirst && ref.index < tocFirst + tocCount;
    const editorBodyNumber = ref.index < tocFirst || tocCount === 0 ? ref.index + 1 : ref.index - tocCount + 1;
    const override = ref.kind === "body" && !isSyntheticToc ? pageOverrides?.[editorBodyNumber] : undefined;
    const header = isSyntheticToc
      ? undefined
      : headerSettings
        ? composeHeaderForPage(physicalIndex, headerSettings, headerOverrideFromEditor(override))
        : page.header;
    const folio = override?.hideNombre ? undefined : page.folio;
    pages[ref.index] = withFurniture(page, header, folio);
  });
  return {
    ...document,
    pages: bodyPages,
    ...(document.colophon && colophonPages ? { colophon: { ...document.colophon, pages: colophonPages } } : {}),
  };
}
