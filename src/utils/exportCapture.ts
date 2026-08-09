'use client';

import { toCanvas } from 'html-to-image';

/**
 * `pageElementsRef` in PreviewPane registers the wrapper div around each
 * `PageCard` (which also holds the editor-only toolbar row and the
 * "N ページ" label), not the `.page-card`/`[data-page-card]` element itself.
 * Exporting that wrapper verbatim pulls that editor chrome into the
 * captured image. `capturePageToCanvas` below resolves down to it first —
 * the toolbar row and page-number label are siblings of `.page-card`, not
 * descendants, so this excludes them without touching PageCard.tsx.
 */
export function resolvePageCardElement(root: HTMLElement): HTMLElement {
  if (root.matches('.page-card, [data-page-card]')) return root;
  return root.querySelector<HTMLElement>('.page-card, [data-page-card]') ?? root;
}

export interface CapturePageOptions {
  /** Output canvas resolution multiplier relative to the captured page's canonical CSS px size. */
  pixelRatio: number;
}

/**
 * Shared capture entry point used by JPG/ZIP/PDF export alike (see
 * exportImage.ts / exportPdf.ts) so all three formats rasterize the same
 * page the same way.
 *
 * This used to go through html2canvas, which reimplements CSS box/text
 * layout in JS rather than using the browser's real renderer — it has no
 * real support for `writing-mode: vertical-rl`, which is exactly why
 * tategaki body text came out scattered/collapsed in JPG/ZIP/PDF while the
 * live preview (real browser layout) stayed correct. html-to-image instead
 * serializes the target's *computed* styles into an SVG `<foreignObject>`
 * and lets the browser itself rasterize that via an `<img>` load — the same
 * rendering engine that already draws the (correct) on-screen preview, so
 * vertical-rl, ruby, oklch colors, image object-fit, etc. all come from real
 * browser behavior instead of a reimplementation that has to be individually
 * patched for each CSS feature it doesn't support.
 */
export async function capturePageToCanvas(
  root: HTMLElement,
  { pixelRatio }: CapturePageOptions
): Promise<HTMLCanvasElement> {
  const target = resolvePageCardElement(root);

  // PreviewPane applies a responsive `transform: scale(...)` (mobile
  // auto-fit / manual zoom / fit-to-pane presentation scale, see
  // PreviewPane.tsx's `autoFitScale`) several ancestors up, on the
  // `[data-export-scale-root]` wrapper. Unlike html2canvas's clone-then-fix
  // approach, html-to-image renders the *live* node's current on-screen
  // geometry, so that presentation-only transform must be neutralized on
  // the real DOM for the moment of capture (and restored right after) —
  // otherwise the exported canvas would reflect whatever zoom level the
  // editor happened to be showing instead of the page's true canonical
  // size. The brief flicker this causes is limited to an explicit export
  // action.
  const scaleRoot = target.closest<HTMLElement>('[data-export-scale-root]');
  const previousTransform = scaleRoot?.style.transform ?? '';
  const previousTransition = scaleRoot?.style.transition ?? '';
  if (scaleRoot) {
    scaleRoot.style.setProperty('transform', 'none');
    scaleRoot.style.setProperty('transition', 'none');
  }

  try {
    // Rasterizing mid-swap (e.g. before a webfont like Shippori Mincho has
    // finished loading) would bake in the fallback face instead of the
    // intended one.
    await document.fonts.ready;

    // `.page-card` is `box-sizing: border-box` with a 1px border on every
    // side (Tailwind's `border`), so `clientWidth`/`clientHeight` (content
    // box, border excluded) read 2px narrower/shorter than the element's
    // true outer size — e.g. Web閲覧用's canonical 768×1024 (set directly as
    // its inline `width`/`height`, confirmed via `offsetWidth`/`offsetHeight`
    // matching that inline style exactly) exported at 766×1024 clientWidth-
    // measured. `offsetWidth`/`offsetHeight` include the border and so match
    // the canonical size Web閲覧用 promises callers (768×1024 exactly, not
    // "about" 768×1024) — used only for isPx pages here since print presets'
    // existing capture pixel counts (already derived from clientWidth today)
    // must stay exactly as they are this round.
    const isPxPage = target.dataset.isPxPage === "true";
    const width = isPxPage ? target.offsetWidth : target.clientWidth;
    const height = isPxPage ? target.offsetHeight : target.clientHeight;

    return await toCanvas(target, {
      pixelRatio,
      width,
      height,
      backgroundColor: '#ffffff',
      cacheBust: true,
      // Excludes editor-only chrome that can appear *inside* `.page-card`
      // (currently just the print-only trim/bleed guide, `[data-bleed-guide]`
      // — checkboxes/toolbar/page-number label are siblings of `.page-card`,
      // already excluded by resolvePageCardElement above). `node` can be a
      // non-Element (e.g. a text node) at runtime despite the declared
      // HTMLElement type, so guard with `instanceof Element` before calling
      // `.matches`.
      filter: (node) =>
        !(node instanceof Element) ||
        !node.matches('.no-print, [data-no-print], [data-bleed-guide]'),
      // Root-only overrides: PageCard.tsx applies `border-accent`/`ring-2
      // ring-accent` (a warm-gold accent color) to `.page-card` when the
      // page is selected in the editor — purely an editor affordance that
      // must never appear in an export regardless of the page's selection
      // state. Tailwind's `ring-*` utilities composite into `box-shadow`,
      // so clearing box-shadow/outline and resetting the border color
      // removes both. The background override forces a pure white page
      // (no off-white/cream `bg-paper` tint) independent of theme.
      style: {
        boxShadow: 'none',
        outline: 'none',
        borderColor: '#e5e7eb',
        backgroundColor: '#ffffff',
        background: '#ffffff',
      },
    });
  } finally {
    if (scaleRoot) {
      scaleRoot.style.transform = previousTransform;
      scaleRoot.style.transition = previousTransition;
    }
  }
}
