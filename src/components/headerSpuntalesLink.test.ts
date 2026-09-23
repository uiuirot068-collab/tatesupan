import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// TSP-B4-B6-TOPPAGE-001 -- the TOP PAGE (Home header, `variant="home"`) shows a
// "SpunTales" text label next to the TateSpun logo. It must be a real, accessible,
// same-tab link out to the sibling portal (https://spuntales.net/) -- not a styled
// span, not a new-tab link, and not something that also changes the (unrelated)
// editor-route header. Source-string checks, matching this file's existing
// headerTabletCompact.test.ts pattern (no jsdom in this scoped vitest config).
const header = readFileSync(resolve("src/components/Header.tsx"), "utf8");

describe("Home header SpunTales label links to the portal (TSP-B4-B6-TOPPAGE-001)", () => {
  it("defines one shared portal URL constant, used (not duplicated as a literal)", () => {
    expect(header).toContain("const SPUNTALES_PORTAL_URL = 'https://spuntales.net/';");
    expect(header.match(/https:\/\/spuntales\.net\//g)?.length).toBe(1);
  });

  it("both SpunTales occurrences (mobile-home block and desktop-home block) are real anchors to the constant", () => {
    const anchors = [...header.matchAll(/<a\s+([^>]*)>\s*SpunTales\s*<\/a>/g)];
    expect(anchors).toHaveLength(2);
    for (const [, attrs] of anchors) {
      expect(attrs).toContain("href={SPUNTALES_PORTAL_URL}");
      // same tab: no target/rel escape hatch was added
      expect(attrs).not.toContain("target=");
      expect(attrs).not.toContain("rel=");
    }
  });

  it("the label text itself is never a bare span/div (no dead click handler, no non-link element)", () => {
    expect(header).not.toMatch(/<span[^>]*>\s*SpunTales\s*<\/span>/);
    expect(header).not.toMatch(/<div[^>]*>\s*SpunTales\s*<\/div>/);
  });

  it("only renders inside the isHome branches -- the editor-variant header is untouched", () => {
    const bodyStart = header.indexOf("return (");
    const beforeFirstIsHome = header.slice(bodyStart, header.indexOf("isHome &&"));
    expect(bodyStart).toBeGreaterThan(-1);
    expect(beforeFirstIsHome).not.toContain("SpunTales");
  });
});
