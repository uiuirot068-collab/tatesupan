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

  resetPageCardTransforms(clonedDoc);
  fixVerticalWritingModeLayout(clonedDoc);
  fixExportedImageAspectRatio(clonedDoc);
  sanitizeUnsupportedColorFunctions(clonedDoc);
  applyExportOutputCleanup(clonedDoc);
}

/**
 * `.page-card`/`[data-page-card]` (and their ancestors) can carry an
 * on-screen `transform: scale(...)` or `zoom` from responsive/manual
 * preview zoom. html2canvas computes vertical-rl glyph positions from the
 * clone's post-transform box, so a lingering scale/zoom makes tategaki text
 * overlap in the captured output. Force every page card and its ancestor
 * chain back to an unscaled, 100% layout before capture.
 */
function resetPageCardTransforms(clonedDoc: Document): void {
  const pageElements = clonedDoc.querySelectorAll<HTMLElement>('.page-card, [data-page-card]');
  pageElements.forEach((el) => {
    let current: HTMLElement | null = el;
    while (current) {
      current.style.setProperty('transform', 'none', 'important');
      current.style.setProperty('zoom', '1', 'important');
      current = current.parentElement;
    }
  });
}

/**
 * Keeps vertical-rl (tategaki) text blocks from shifting or clipping in the
 * clone: forces visible overflow and a stable positioning context so glyph
 * placement matches what's on screen instead of being recomputed against a
 * collapsed/scrolled box.
 */
function fixVerticalWritingModeLayout(clonedDoc: Document): void {
  clonedDoc.querySelectorAll<HTMLElement>('div, p, span').forEach((el) => {
    const writingMode = clonedDoc.defaultView?.getComputedStyle(el).writingMode;
    if (!writingMode || !writingMode.includes('vertical-rl')) return;

    el.style.setProperty('writing-mode', 'vertical-rl', 'important');
    el.style.setProperty('overflow', 'visible', 'important');
    if (clonedDoc.defaultView?.getComputedStyle(el).position === 'static') {
      el.style.setProperty('position', 'relative', 'important');
    }
  });
}

/**
 * Locks inserted `<img>` tags to their natural aspect ratio during capture
 * so cover/crop CSS applied for the live layout doesn't stretch or distort
 * them in the exported image.
 */
function fixExportedImageAspectRatio(clonedDoc: Document): void {
  clonedDoc.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    img.style.setProperty('object-fit', 'contain', 'important');
    img.style.setProperty('width', '100%', 'important');
    img.style.setProperty('height', 'auto', 'important');
  });
}

/**
 * Final output cleanup for the exported capture: forces a pure white page
 * background (no off-white/cream tint), strips editor-only UI (checkboxes,
 * controls) that must never appear in the exported image, and hides the
 * bleed/guide dashed borders that are only meant for on-screen alignment.
 */
function applyExportOutputCleanup(clonedDoc: Document): void {
  clonedDoc.querySelectorAll<HTMLElement>('.page-card, [data-page-card], body').forEach((el) => {
    el.style.setProperty('background-color', '#ffffff', 'important');
    el.style.setProperty('background', '#ffffff', 'important');
  });

  clonedDoc
    .querySelectorAll<HTMLElement>('input[type="checkbox"], .no-print, [data-no-print]')
    .forEach((el) => {
      el.style.setProperty('display', 'none', 'important');
    });

  clonedDoc.querySelectorAll<HTMLElement>('.border-dashed, [data-bleed-guide]').forEach((el) => {
    el.style.setProperty('border-color', 'transparent', 'important');
  });
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
const UNSUPPORTED_COLOR_DETECTOR = /lab\(|oklch|color-mix/i;

/**
 * Replaces every balanced `name(...)` call in `text` for which `predicate`
 * returns true. Unlike a `[^)]+` regex, this tracks paren depth, so it
 * correctly consumes calls with nested parens — e.g.
 * `color-mix(in oklab, var(--tw-color), oklch(0.7 0.1 200))` — without
 * truncating at the first inner `)`.
 */
function replaceBalancedCalls(
  text: string,
  name: string,
  predicate: (fullMatch: string) => boolean,
  replacement: string
): string {
  const needle = `${name}(`;
  const lowerText = text.toLowerCase();
  let result = '';
  let i = 0;

  while (i < text.length) {
    const idx = lowerText.indexOf(needle, i);
    if (idx === -1) {
      result += text.slice(i);
      break;
    }
    result += text.slice(i, idx);

    let depth = 0;
    let j = idx + name.length;
    for (; j < text.length; j += 1) {
      if (text[j] === '(') depth += 1;
      else if (text[j] === ')') {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }

    const fullMatch = text.slice(idx, j);
    result += predicate(fullMatch) ? replacement : fullMatch;
    i = j;
  }

  return result;
}

/**
 * Strips `color-mix(in oklab|oklch, ...)` (Tailwind v4's default palette
 * mixing) and any bare `oklab()`/`oklch()` calls, replacing them with a
 * plain, html2canvas-safe color. `color-mix` is handled first, while its
 * contents still contain the `oklab`/`oklch` keyword/nested-call that marks
 * it as unsupported — otherwise the later oklab/oklch pass would consume the
 * nested calls first and erase that signal.
 */
function sanitizeColorText(text: string): string {
  let result = replaceBalancedCalls(
    text,
    'color-mix',
    (match) => /lab\(|oklch/i.test(match),
    'transparent'
  );
  // `oklch`/`oklab` must be stripped before the bare `lab` pass below —
  // `oklab(` itself contains the literal substring `lab(`, so running the
  // `lab` pass first would match inside it and leave a stray `ok` prefix.
  result = replaceBalancedCalls(result, 'oklch', () => true, 'transparent');
  result = replaceBalancedCalls(result, 'oklab', () => true, 'transparent');
  result = replaceBalancedCalls(result, 'lab', () => true, 'transparent');
  return result;
}

/**
 * Properties whose resolved color most commonly leaks Tailwind v4's
 * oklab/oklch palette into html2canvas's parser.
 */
const COLOR_PROPERTIES = [
  'color',
  'backgroundColor',
  'borderTopColor',
  'borderRightColor',
  'borderBottomColor',
  'borderLeftColor',
  'outlineColor',
  'fill',
  'stroke',
] as const;

// `boxShadow` isn't a plain color — it's a shadow list (offsets/blur/spread
// plus a color). `transparent` alone is not a valid `box-shadow` value, so
// an unsupported color inside it is neutralized by dropping the shadow
// entirely rather than by the blanket `transparent` used for color props.
const SHADOW_PROPERTY = 'boxShadow' as const;

function sanitizeUnsupportedColorFunctions(clonedDoc: Document): void {
  clonedDoc.querySelectorAll('style').forEach((style) => {
    const cssText = style.innerHTML;
    if (UNSUPPORTED_COLOR_DETECTOR.test(cssText)) {
      const newStyle = clonedDoc.createElement('style');
      newStyle.innerHTML = sanitizeColorText(cssText);
      style.replaceWith(newStyle);
    }
  });

  clonedDoc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const attr = el.getAttribute('style');
    if (attr && UNSUPPORTED_COLOR_DETECTOR.test(attr)) {
      el.setAttribute('style', sanitizeColorText(attr));
    }

    const cssText = el.style?.cssText;
    if (cssText && UNSUPPORTED_COLOR_DETECTOR.test(cssText)) {
      el.style.cssText = sanitizeColorText(cssText);
    }
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
      if (UNSUPPORTED_COLOR_DETECTOR.test(rule.cssText)) {
        try {
          sheet.deleteRule(i);
          sheet.insertRule(sanitizeColorText(rule.cssText), i);
        } catch {
          // Rule can't be safely rewritten in place; leave it and rely on
          // the style-attribute/inline-style/computed-style passes to mask
          // its effect on the rendered elements instead.
        }
      }
    }
  });

  // `getComputedStyle()` on the clone can still resolve to an oklab/oklch
  // serialization even after the passes above — e.g. a cross-origin
  // stylesheet whose `cssRules` threw above, or a browser that serializes
  // `color-mix` results as `oklab(...)`. html2canvas reads computed style
  // directly, so force those specific properties to a safe inline value
  // whenever the computed result still contains an unsupported function.
  clonedDoc.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const computed = clonedDoc.defaultView?.getComputedStyle(el);
    if (!computed) return;

    for (const prop of COLOR_PROPERTIES) {
      const value = computed[prop];
      if (value && UNSUPPORTED_COLOR_DETECTOR.test(value)) {
        el.style.setProperty(prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), 'transparent', 'important');
      }
    }

    const shadow = computed[SHADOW_PROPERTY];
    if (shadow && UNSUPPORTED_COLOR_DETECTOR.test(shadow)) {
      el.style.setProperty('box-shadow', 'none', 'important');
    }
  });
}
