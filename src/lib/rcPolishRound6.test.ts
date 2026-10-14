import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GUIDE_BOOK_WIDTH,
  shelfMetricsForAvailableWidth,
} from "../components/bookshelf/bookshelfLayout";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("Round 6 bookshelf layering", () => {
  const spine = source("src/components/bookshelf/BookSpine.tsx");
  const css = source("src/components/bookshelf/Bookshelf.module.css");

  it("moves the spine and badges as one unit above the shelf background", () => {
    const motionStart = spine.indexOf("styles.bookMotion");
    expect(motionStart).toBeGreaterThanOrEqual(0);
    expect(spine.indexOf("styles.bookButton", motionStart)).toBeGreaterThan(motionStart);
    expect(spine.indexOf("styles.spineStatusLayer", motionStart)).toBeGreaterThan(motionStart);
    expect(css).toMatch(/\.bookMotion\s*\{[\s\S]*?z-index: 2/);
    expect(css).toMatch(/\.rackRow\s*\{[\s\S]*?z-index: 1/);
    expect(css).toMatch(/\.bookMenu\s*\{[\s\S]*?z-index: 30/);
    expect(css).toContain(".bookMotion:hover");
  });

  it("does not render a shelf-wide or per-book underline", () => {
    expect(spine).not.toContain("shelfFrontLip");
    expect(spine).not.toContain("bookShelfForeground");
    expect(css).not.toContain(".shelfFrontLip {");
    expect(css).not.toContain(".bookShelfForeground {");
  });
});

describe("Final zero-work Home polish", () => {
  // TSP-IMPROVE-002: page.tsx only mounts HomeV2Client; the Home markup lives there.
  const home = source("src/app/home-v2/HomeV2Client.tsx");
  const homeCss = source("src/app/home-v2/home-v2.css");
  const css = source("src/components/bookshelf/Bookshelf.module.css");
  const onboarding = home.slice(
    home.indexOf('data-home-brand-panel={mode}'),
    home.indexOf("const homeContent")
  );

  it("modestly widens only the empty shelf and derives a responsive right inset", () => {
    expect(css).toMatch(/\.bookshelfEmpty\s*\{[\s\S]*?max-width: 660px/);
    expect(css).toContain("--empty-shelf-right-inset: clamp(20px, 4vw, 28px)");
    expect(css).toMatch(/\.booksRowEmpty\s*\{[\s\S]*?padding-right: var\(--empty-shelf-right-inset/);
    expect(home).toContain('data-home-empty-bookshelf=""');
    expect(home).toContain('data-home-returning-bookshelf=""');
  });

  it.each([
    [320, 20],
    [600, 24],
    [660, 28],
  ])("keeps the guide right-biased and inside a %ipx shelf container", (available, inset) => {
    const { shelfWidth } = shelfMetricsForAvailableWidth(available);
    const guideRight = shelfWidth - inset;
    const guideLeft = guideRight - GUIDE_BOOK_WIDTH;
    expect(guideRight).toBeLessThan(shelfWidth);
    expect(shelfWidth - guideRight).toBe(inset);
    expect(guideLeft).toBeGreaterThan(shelfWidth / 2);
    expect(guideLeft).toBeGreaterThanOrEqual(0);
  });

  it("enlarges the empty shelf by less than fifteen percent", () => {
    const before = shelfMetricsForAvailableWidth(620).shelfWidth;
    const after = shelfMetricsForAvailableWidth(660).shelfWidth;
    expect(after).toBeGreaterThan(before);
    expect(after / before).toBeLessThan(1.15);
  });

  it("hides only the onboarding cat below the two-column breakpoint", () => {
    // TSP-IMPROVE-002: the two-column breakpoint moved to 900px in the HomeV2 cover;
    // the cat column is hidden below it and shown (end-aligned) at/above it.
    expect(onboarding).toContain("min-[900px]:grid-cols-[minmax(0,1fr)_minmax(200px,260px)]");
    expect(onboarding).toMatch(/className="relative hidden items-end justify-end gap-6 min-\[900px\]:flex"[\s\S]{0,200}caroad_main1\.png/);
  });

  it("keeps the Demo CTA in one compact text flow, now width-constrained by the two-column HOW TO onboarding grid", () => {
    // TSP-HOWTO-BETA-016: the Demo card's own `max-w-md` was dropped when it
    // moved into this `sm:grid-cols-2` wrapper alongside the new HOW TO
    // card (Human QA PASS) -- the grid column now supplies the width
    // constraint the card used to set on itself.
    const twoColumnWrapper = onboarding.slice(
      onboarding.indexOf('data-home-onboarding-actions'),
      onboarding.indexOf('data-home-demo-card=""')
    );
    const card = onboarding.slice(
      onboarding.indexOf('data-home-demo-card=""'),
      onboarding.indexOf("</Link>", onboarding.indexOf('data-home-demo-card=""'))
    );
    expect(twoColumnWrapper).toContain("sm:grid-cols-2");
    expect(card).toContain('data-home-demo-cta=""');
    // TSP-IMPROVE-002: the card's block flow now comes from the `home-p3-ticket` class.
    expect(card).toContain('className="home-p3-ticket group"');
    expect(homeCss).toMatch(/\.home-p3-ticket\s*\{[^}]*display: block;/);
    expect(card).not.toContain("grid-cols-[1fr_auto]");
  });
});

describe("Round 6 mobile toolbar", () => {
  const pane = source("src/components/EditorPane.tsx");
  const row = pane.slice(
    pane.indexOf('data-editor-action-row=""'),
    pane.indexOf('<div className={focusMode ? "hidden" : ""}')
  );

  it.each([320, 375, 390, 430])("uses compact content-width tracks without overflow at %ipx", () => {
    expect(row).toContain("grid-cols-[44px_44px_max-content_max-content_max-content]");
    expect(row).toContain("justify-center");
    expect(row).toContain("gap-0.5");
    expect(row).not.toContain("minmax(0,1fr)");
    expect(row).not.toMatch(/\sflex-wrap(?:\s|")/);
  });

  it("shortens the row while widening Undo and Redo", () => {
    expect(row.match(/min-h-9 min-w-11/g)).toHaveLength(2);
    // 5 always-visible actions plus the focus-mode-only Memo and exit-focus
    // entries (the latter `hidden` below `md`, but still carrying the class
    // in this source-text count).
    // TSP-IMPROVE-002: 9f59c3b added the 保存名 filename control as the row's first
    // item with the same compact min-h-9 height, so the count is now 8.
    expect(row.match(/min-h-9/g)).toHaveLength(8);
    expect(row).not.toContain("min-h-10");
  });
});

describe("Round 6 Demo Step 9", () => {
  const data = source("src/constants/demoData.ts");
  const tour = source("src/components/DemoTour.tsx");

  it("targets Export and requests lower safe placement only", () => {
    // Not pinned to a numeric step index -- TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010
    // §G added a new step, which would otherwise shift every later step's
    // position without changing anything this test actually cares about.
    const targets = Array.from(data.matchAll(/target: "([^"]+)"/g), (match) => match[1]);
    expect(targets).toContain("export");
    // TSP-IMPROVE-002: narrow screens and the preview step got their own placements
    // (79e06dc); Export still asks for lower-safe.
    expect(tour).toContain('step.target === "export" ? "lower-safe" :');
    expect(tour).not.toMatch(/setExport|openExport|onOpenExport/);
  });
});
