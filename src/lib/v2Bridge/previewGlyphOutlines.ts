import { useEffect, useState } from "react";
import { parse as parseOpenTypeFont, type Font as OpenTypeFont } from "opentype.js";
import { asFontBinary } from "../../../typesetting-v2/renderer/publication/fontBinary";
import { deriveBaselineRatioFromFontBinary } from "../../../typesetting-v2/renderer/publication/pdfGenerator";
import type { PreviewGlyphOutline, PreviewGlyphOutlines } from "../../../typesetting-v2/renderer/preview/PreviewRenderer";
import { loadV2FontBytes, publicationFontAssetFor } from "../v2BrowserExport";

/**
 * TSP-PRINT-001: Preview body glyphs drawn as outlines from the font file PDF
 * embeds. A browser snaps every text glyph to whole screen pixels, so a cell
 * pitch of e.g. 10.5px came out as gaps of 10, 10, 12, 10, 11 … px — the
 * characters visibly bunched up and drifted apart along the line. An
 * outline path keeps its exact fractional position (anti-aliased), the same
 * way JPG and PDF place it.
 *
 * Only plain kanji and kana go this way. Characters that PDF / JPG paint
 * with a special rule (punctuation and brackets, small kana, ー, Latin, 縦中横)
 * stay browser text, so nothing here re-derives those rules.
 */
const OUTLINED_GRAPHEME =
  /^(?:\p{Script=Han}|[ぁ-ゖゝゞァ-ヺヽヾ々〆])$/u;
const SMALL_KANA = /^[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ]$/u;

export function isPreviewOutlinedGrapheme(grapheme: string): boolean {
  return OUTLINED_GRAPHEME.test(grapheme) && !SMALL_KANA.test(grapheme);
}

// One hidden <defs> holds each glyph's path once; every occurrence on every
// page is a <use> of it (a kanji path is ~1.5KB, a page has ~600 glyphs).
let defsElement: SVGDefsElement | null = null;
function glyphDefs(): SVGDefsElement | null {
  if (typeof document === "undefined") return null;
  if (defsElement?.isConnected) return defsElement;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("data-preview-glyph-defs", "");
  svg.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
  defsElement = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  svg.appendChild(defsElement);
  document.body.appendChild(svg);
  return defsElement;
}

let nextFontKey = 0;

export function createPreviewGlyphOutlines(bytes: Uint8Array): PreviewGlyphOutlines {
  const fontKey = `tsg${nextFontKey++}`;
  const font: OpenTypeFont = parseOpenTypeFont(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const unitsPerEm = font.unitsPerEm;
  const baselineRatio = deriveBaselineRatioFromFontBinary(asFontBinary(bytes));
  const cache = new Map<string, PreviewGlyphOutline | null>();
  return {
    unitsPerEm,
    baselineRatio,
    outline(grapheme) {
      const cached = cache.get(grapheme);
      if (cached !== undefined) return cached ?? undefined;
      let result: PreviewGlyphOutline | null = null;
      if (isPreviewOutlinedGrapheme(grapheme)) {
        const glyph = font.charToGlyph(grapheme);
        // .notdef (index 0): the font lacks the character — keep browser text.
        if (glyph.index !== 0) {
          // Font units, y down, horizontal baseline at 0.
          const d = glyph.getPath(0, 0, unitsPerEm).toPathData(1);
          if (d) {
            const defs = glyphDefs();
            const id = `${fontKey}-${glyph.index}`;
            if (defs && !defs.querySelector(`#${id}`)) {
              const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
              path.setAttribute("id", id);
              path.setAttribute("d", d);
              defs.appendChild(path);
            }
            result = { d, id: defs ? id : undefined, advance: glyph.advanceWidth ?? unitsPerEm };
          }
        }
      }
      cache.set(grapheme, result);
      return result ?? undefined;
    },
  };
}

const sources = new Map<string, Promise<PreviewGlyphOutlines>>();
const loaded = new Map<string, PreviewGlyphOutlines>();

/** Outlines for the Editor's body font (fetched and parsed once per font file). */
export function loadPreviewGlyphOutlines(cssFamily: string | undefined): Promise<PreviewGlyphOutlines> {
  const asset = publicationFontAssetFor(cssFamily);
  let pending = sources.get(asset.path);
  if (!pending) {
    pending = loadV2FontBytes(asset).then((bytes) => {
      const outlines = createPreviewGlyphOutlines(bytes);
      loaded.set(asset.path, outlines);
      return outlines;
    });
    pending.catch(() => sources.delete(asset.path));
    sources.set(asset.path, pending);
  }
  return pending;
}

/**
 * The outlines once loaded; `undefined` until then (and when `enabled` is
 * false or the file cannot be read — the Preview then keeps browser text).
 */
export function usePreviewGlyphOutlines(cssFamily: string | undefined, enabled: boolean): PreviewGlyphOutlines | undefined {
  const path = publicationFontAssetFor(cssFamily).path;
  const [state, setState] = useState<{ path: string; outlines: PreviewGlyphOutlines } | undefined>(undefined);
  useEffect(() => {
    if (!enabled || loaded.has(path)) return;
    let cancelled = false;
    loadPreviewGlyphOutlines(cssFamily)
      .then((outlines) => {
        if (!cancelled) setState({ path, outlines });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cssFamily, enabled, path]);
  if (!enabled) return undefined;
  return loaded.get(path) ?? (state?.path === path ? state.outlines : undefined);
}
