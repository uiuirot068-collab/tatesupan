// TSP-PRINT-003: the capture sees each glyph <use>'s definition (3D book, screen-capture JPG).
import { describe, expect, it } from "vitest";
import { exposeGlyphUsesForCapture } from "./exportCapture";

const XLINK = "http://www.w3.org/1999/xlink";

/** The few Element methods the function uses (this config has no DOM). */
function fakeUse(href: string, xlinkHref?: string) {
  const attrs = new Map<string, string>([["href", href]]);
  if (xlinkHref !== undefined) attrs.set("xlink:href", xlinkHref);
  return {
    attrs,
    getAttribute: (name: string) => attrs.get(name) ?? null,
    hasAttributeNS: (ns: string, name: string) => ns === XLINK && attrs.has(`xlink:${name}`),
    setAttributeNS: (ns: string, qualified: string, value: string) => {
      expect(ns).toBe(XLINK);
      attrs.set(qualified, value);
    },
    removeAttributeNS: (ns: string, name: string) => {
      if (ns === XLINK) attrs.delete(`xlink:${name}`);
    },
  };
}

describe("exposeGlyphUsesForCapture", () => {
  it("mirrors href into xlink:href for the capture and removes it afterwards", () => {
    const glyph = fakeUse("#tsg0-12");
    const own = fakeUse("#a", "#a");
    const card = { querySelectorAll: (selector: string) => (expect(selector).toBe("use[href]"), [glyph, own]) };

    const restore = exposeGlyphUsesForCapture(card as unknown as Element);
    // html-to-image reads exactly this attribute name.
    expect(glyph.getAttribute("xlink:href")).toBe("#tsg0-12");
    restore();
    expect(glyph.attrs.has("xlink:href")).toBe(false);
    expect(glyph.getAttribute("href")).toBe("#tsg0-12");
    // One that already had xlink:href keeps it.
    expect(own.getAttribute("xlink:href")).toBe("#a");
  });
});
