'use client';

/**
 * html2canvas recomputes its crop bounds from the *cloned* document after
 * `onclone` runs (see html2canvas's renderElement: `parseBounds` is called
 * on `clonedElement` post-clone). PreviewPane applies a responsive
 * `transform: scale(...)` (mobile auto-fit / manual zoom) to the page
 * container, so without this the clone's bounding rect — and therefore the
 * captured resolution and crop — reflects the shrunk on-screen size instead
 * of the manuscript's true dimensions. Stripping the transform on the clone
 * only (never the live, visible DOM) restores full-resolution, correctly
 * aligned capture regardless of current zoom/viewport.
 */
export function resetScaleTransformOnClone(clonedDoc: Document): void {
  clonedDoc.querySelectorAll<HTMLElement>('[data-export-scale-root]').forEach((el) => {
    el.style.transform = 'none';
    el.style.transition = 'none';
  });

  sanitizeUnsupportedColorFunctions(clonedDoc);
}

/**
 * html2canvas's color parser doesn't understand `oklab()`/`oklch()` (used by
 * Tailwind v4's default palette), and throws instead of rendering. Replace
 * them in the clone only, right before capture.
 */
function sanitizeUnsupportedColorFunctions(clonedDoc: Document): void {
  const pattern = /oklab\([^)]+\)|oklch\([^)]+\)/gi;

  clonedDoc.querySelectorAll('style').forEach((style) => {
    if (pattern.test(style.innerHTML)) {
      pattern.lastIndex = 0;
      style.innerHTML = style.innerHTML.replace(pattern, 'rgba(0, 0, 0, 0.1)');
    }
  });

  clonedDoc.querySelectorAll<HTMLElement>('[style]').forEach((el) => {
    const attr = el.getAttribute('style');
    if (attr && pattern.test(attr)) {
      el.setAttribute('style', attr.replace(pattern, 'rgba(0, 0, 0, 0.1)'));
    }
    pattern.lastIndex = 0;
  });
}
