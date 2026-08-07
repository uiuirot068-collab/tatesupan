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
 * them in the clone only, right before capture. Covers `<style>` text,
 * inline `style` attributes (including CSS custom properties like `--tw-*`
 * that expand into oklab/oklch elsewhere), and constructed stylesheets whose
 * `cssRules` aren't reflected back into `style.innerHTML`.
 *
 * Mutating `style.innerHTML` in place does not refresh the document's CSSOM
 * (`document.styleSheets`) — the browser keeps the originally-parsed rules,
 * including the oklab/oklch ones, bound to that node. html2canvas reads
 * `clonedDoc.styleSheets`, so it would still see the un-sanitized colors.
 * Replacing the node outright (`replaceWith`) forces the browser to parse a
 * brand-new stylesheet from the cleaned text.
 */
function sanitizeUnsupportedColorFunctions(clonedDoc: Document): void {
  const pattern = /oklab\([^)]+\)|oklch\([^)]+\)/gi;
  const replace = (text: string) => text.replace(pattern, 'rgba(0, 0, 0, 0.1)');

  clonedDoc.querySelectorAll('style').forEach((style) => {
    const cssText = style.innerHTML;
    if (pattern.test(cssText)) {
      pattern.lastIndex = 0;
      const newStyle = clonedDoc.createElement('style');
      newStyle.innerHTML = replace(cssText);
      style.replaceWith(newStyle);
    }
  });

  clonedDoc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const attr = el.getAttribute('style');
    if (attr && pattern.test(attr)) {
      pattern.lastIndex = 0;
      el.setAttribute('style', replace(attr));
    }
    pattern.lastIndex = 0;

    const cssText = el.style?.cssText;
    if (cssText && pattern.test(cssText)) {
      pattern.lastIndex = 0;
      el.style.cssText = replace(cssText);
    }
    pattern.lastIndex = 0;
  });

  Array.from(clonedDoc.styleSheets).forEach((sheet) => {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      return;
    }

    for (let i = rules.length - 1; i >= 0; i -= 1) {
      const rule = rules[i];
      if (pattern.test(rule.cssText)) {
        pattern.lastIndex = 0;
        try {
          sheet.deleteRule(i);
          sheet.insertRule(replace(rule.cssText), i);
        } catch {
          // Rule can't be safely rewritten in place; leave it and rely on
          // the style-attribute/inline-style passes above for elements.
        }
      }
      pattern.lastIndex = 0;
    }
  });
}
