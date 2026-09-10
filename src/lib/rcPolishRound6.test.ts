import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("Round 6 bookshelf layering", () => {
  const spine = source("src/components/bookshelf/BookSpine.tsx");
  const css = source("src/components/bookshelf/Bookshelf.module.css");

  it("moves the spine and badges as one unit behind a local shelf foreground", () => {
    const motionStart = spine.indexOf("styles.bookMotion");
    const motionEnd = spine.indexOf("styles.bookShelfForeground");
    expect(motionStart).toBeGreaterThanOrEqual(0);
    expect(spine.indexOf("styles.bookButton", motionStart)).toBeLessThan(motionEnd);
    expect(spine.indexOf("styles.spineStatusLayer", motionStart)).toBeLessThan(motionEnd);
    expect(css).toMatch(/\.bookMotion\s*\{[\s\S]*?z-index: 2/);
    expect(css).toMatch(/\.bookShelfForeground\s*\{[\s\S]*?z-index: 3/);
    expect(css).toMatch(/\.bookMenu\s*\{[\s\S]*?z-index: 30/);
    expect(css).toContain(".bookMotion:hover");
  });

  it("does not restore the removed full-width shelf-front lip", () => {
    expect(spine).not.toContain("shelfFrontLip");
    expect(css).not.toContain(".shelfFrontLip {");
  });
});

describe("Round 6 mobile toolbar", () => {
  const pane = source("src/components/EditorPane.tsx");
  const row = pane.slice(
    pane.indexOf('data-editor-action-row=""'),
    pane.indexOf('<div className={focusMode ? "max-md:hidden" : ""}')
  );

  it.each([320, 375, 390, 430])("uses compact content-width tracks without overflow at %ipx", () => {
    expect(row).toContain("grid-cols-[44px_44px_max-content_max-content]");
    expect(row).toContain("justify-center");
    expect(row).not.toContain("minmax(0,1fr)");
    expect(row).not.toMatch(/\sflex-wrap(?:\s|")/);
  });

  it("shortens the row while widening Undo and Redo", () => {
    expect(row.match(/min-h-9 min-w-11/g)).toHaveLength(2);
    expect(row.match(/min-h-9/g)).toHaveLength(4);
    expect(row).not.toContain("min-h-10");
  });
});

describe("Round 6 Demo Step 9", () => {
  const data = source("src/constants/demoData.ts");
  const tour = source("src/components/DemoTour.tsx");

  it("targets Export at step 9 and requests lower safe placement only", () => {
    const targets = Array.from(data.matchAll(/target: "([^"]+)"/g), (match) => match[1]);
    expect(targets[8]).toBe("export");
    expect(tour).toContain('step.target === "export" ? "lower-safe" : "auto"');
    expect(tour).not.toMatch(/setExport|openExport|onOpenExport/);
  });
});
