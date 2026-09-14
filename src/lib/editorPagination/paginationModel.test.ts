import { describe, expect, it } from "vitest";
import {
  EDITOR_PAGE_TARGET_SIZE,
  EDITOR_PAGE_HARD_MAXIMUM_SIZE,
  adjustForcedBoundaries,
  chooseSafeEditorPageBoundary,
  computeEditorPages,
  editorPageForGlobalOffset,
  editorPageLocalToGlobal,
  globalToEditorPageLocal,
  snapToSafeEditorPageBoundary,
  type EditorPage,
} from "./paginationModel";
import { createUndoHistory, pushEdit, undo } from "../windowedEditor/undoModel";

/** Deterministic filler with no newlines (pathological "no paragraph nearby" case). */
function flatText(length: number): string {
  return "あ".repeat(length);
}

/** `length` code units of paragraphs, each `paraLength` chars of body + one "\n". */
function paragraphs(count: number, paraLength: number): string {
  return Array.from({ length: count }, () => "あ".repeat(paraLength) + "\n").join("");
}

function concatPages(content: string, pages: EditorPage[]): string {
  return pages.map((p) => content.slice(p.start, p.end)).join("");
}

describe("computeEditorPages — splitting", () => {
  it("returns a single empty page for empty content", () => {
    const pages = computeEditorPages("");
    expect(pages).toEqual([{ index: 0, start: 0, end: 0, length: 0 }]);
  });

  it("returns a single page when content is well below the target size", () => {
    const content = flatText(1_000);
    const pages = computeEditorPages(content);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual({ index: 0, start: 0, end: 1_000, length: 1_000 });
  });

  it("splits around the ~50k target with no nearby paragraph boundary (hard cut)", () => {
    const content = flatText(120_000);
    const pages = computeEditorPages(content);
    expect(pages.length).toBeGreaterThan(1);
    // No newlines anywhere: every split is a hard cut at the ideal offset.
    expect(pages[0].start).toBe(0);
    expect(pages[0].end).toBe(EDITOR_PAGE_TARGET_SIZE);
    expect(pages[1].start).toBe(EDITOR_PAGE_TARGET_SIZE);
  });

  it("splits a 100k-char manuscript into pages that reconstruct exactly", () => {
    const content = flatText(100_000);
    const pages = computeEditorPages(content);
    expect(concatPages(content, pages)).toBe(content);
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i].start).toBe(pages[i - 1].end);
      expect(pages[i].index).toBe(i);
    }
  });

  it("splits a 300k+ manuscript into pages that reconstruct exactly", () => {
    const content = paragraphs(1000, 300); // ~301,000 chars, paragraph every 301 chars
    const pages = computeEditorPages(content);
    expect(content.length).toBeGreaterThan(300_000);
    expect(concatPages(content, pages)).toBe(content);
    expect(pages.length).toBeGreaterThan(4);
  });

  it("prefers a nearby paragraph boundary over a hard cut", () => {
    // A single newline sits just inside the preferred 45k-55k search range.
    const before = flatText(49_500);
    const after = flatText(70_000);
    const content = before + "\n" + after;
    const pages = computeEditorPages(content);
    expect(pages[0].end).toBe(before.length + 1); // split right after the "\n"
    expect(content[pages[0].end - 1]).toBe("\n");
  });

  it("prefers the closest paragraph boundary when several are in range", () => {
    // Newlines at 47k and 52k from the page start; 52k (2k from the 50k
    // ideal offset) is closer than 47k (3k away).
    const content = flatText(47_000) + "\n" + flatText(4_999) + "\n" + flatText(50_000);
    const pages = computeEditorPages(content);
    const secondNewlineIndex = 47_000 + 1 + 4_999; // position of the second "\n"
    expect(pages[0].end).toBe(secondNewlineIndex + 1);
  });

  it("falls back to the extended search radius when nothing is in the preferred range", () => {
    // Newline at +12,000 from the ideal offset: outside the 5k preferred
    // radius but inside the 15k extended radius.
    const content = flatText(50_000 + 12_000) + "\n" + flatText(60_000);
    const pages = computeEditorPages(content);
    expect(pages[0].end).toBe(62_001);
  });

  it("never splits a surrogate pair when hard-cutting", () => {
    // An astral character (surrogate pair) straddles the exact ideal offset,
    // with no newline anywhere nearby.
    const astral = "\u{1F600}"; // U+1F600, a surrogate pair in UTF-16
    const content = flatText(49_999) + astral + flatText(70_000);
    const pages = computeEditorPages(content);
    const highSurrogateIndex = 49_999;
    // The boundary must land on one side of the pair or the other, never inside it.
    expect(pages[0].end === highSurrogateIndex || pages[0].end === highSurrogateIndex + 2).toBe(true);
    expect(concatPages(content, pages)).toBe(content);
  });

  it("absorbs a small trailing remainder instead of creating a near-empty final page", () => {
    // Remainder after the ideal cut is far under the 10% minTrailing threshold.
    const content = flatText(50_000 + 200);
    const pages = computeEditorPages(content);
    expect(pages).toHaveLength(1);
    expect(pages[0].end).toBe(content.length);
  });

  it("supports a custom target size", () => {
    const content = flatText(30_000);
    const pages = computeEditorPages(content, { targetSize: 10_000, minTrailingSize: 100 });
    expect(pages.length).toBeGreaterThanOrEqual(3);
    expect(concatPages(content, pages)).toBe(content);
  });
});

describe("chooseSafeEditorPageBoundary", () => {
  it("returns text.length when the ideal offset already reaches the end", () => {
    const content = flatText(1_000);
    expect(chooseSafeEditorPageBoundary(content, 0, 50_000)).toBe(1_000);
  });

  it("always makes forward progress from pageStart", () => {
    const content = flatText(200_000);
    const end = chooseSafeEditorPageBoundary(content, 50_000, EDITOR_PAGE_TARGET_SIZE);
    expect(end).toBeGreaterThan(50_000);
  });
});

describe("snapToSafeEditorPageBoundary", () => {
  it("clamps into [0, length]", () => {
    const content = "abc";
    expect(snapToSafeEditorPageBoundary(content, -5, 1)).toBe(0);
    expect(snapToSafeEditorPageBoundary(content, 50, 1)).toBe(3);
  });

  it("nudges out of a surrogate pair in the requested direction", () => {
    const astral = "\u{1F600}";
    const content = "a" + astral + "b";
    // Index 2 sits between the astral char's two code units.
    expect(snapToSafeEditorPageBoundary(content, 2, 1)).toBe(3);
    expect(snapToSafeEditorPageBoundary(content, 2, -1)).toBe(1);
  });
});

describe("offset mapping", () => {
  const content = flatText(150_000);
  const pages = computeEditorPages(content);

  it("maps the very start, middle, and end of the manuscript to the correct page", () => {
    expect(editorPageForGlobalOffset(pages, 0)).toBe(0);
    const middle = Math.floor(content.length / 2);
    const middlePageIndex = editorPageForGlobalOffset(pages, middle);
    const middlePage = pages[middlePageIndex];
    expect(middle).toBeGreaterThanOrEqual(middlePage.start);
    expect(middle).toBeLessThan(middlePage.end);
    expect(editorPageForGlobalOffset(pages, content.length)).toBe(pages.length - 1);
  });

  it("is exact at page boundaries (offset belongs to the page it opens)", () => {
    const boundary = pages[0].end;
    expect(editorPageForGlobalOffset(pages, boundary)).toBe(1);
    expect(editorPageForGlobalOffset(pages, boundary - 1)).toBe(0);
  });

  it("round-trips local <-> global offsets", () => {
    const page = pages[1];
    const global = editorPageLocalToGlobal(page, 123);
    expect(global).toBe(page.start + 123);
    expect(globalToEditorPageLocal(page, global)).toBe(123);
  });

  it("clamps globalToEditorPageLocal to the page's own bounds", () => {
    const page = pages[1];
    expect(globalToEditorPageLocal(page, page.start - 500)).toBe(0);
    expect(globalToEditorPageLocal(page, page.end + 500)).toBe(page.length);
  });

  it("half-open range: B-1 belongs to the previous page, B and B+1 belong to the next", () => {
    const boundary = pages[0].end;
    expect(editorPageForGlobalOffset(pages, boundary - 1)).toBe(0);
    expect(editorPageForGlobalOffset(pages, boundary)).toBe(1);
    expect(editorPageForGlobalOffset(pages, boundary + 1)).toBe(1);
  });

  it("uses explicit backward affinity only at an exact boundary", () => {
    const boundary = pages[0].end;
    expect(editorPageForGlobalOffset(pages, boundary, "forward")).toBe(1);
    expect(editorPageForGlobalOffset(pages, boundary, "backward")).toBe(0);
    expect(globalToEditorPageLocal(pages[0], boundary)).toBe(pages[0].length);
    expect(editorPageForGlobalOffset(pages, boundary + 1, "backward")).toBe(1);
  });
});

// TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §L "BOUNDARY MODEL": the
// task's own explicit boundary-value checklist, spelled out one by one
// (rather than only exercised indirectly by the property tests above) so a
// regression at any one of these exact values fails legibly.
describe("exact boundary-value checklist (TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 §L)", () => {
  it.each([44_999, 45_000, 49_999, 50_000, 50_001])(
    "content of exactly %i chars (no nearby newline) stays a single page -- all under the minTrailing-adjusted hard-cut threshold",
    (length) => {
      const content = flatText(length);
      const pages = computeEditorPages(content);
      expect(concatPages(content, pages)).toBe(content);
      expect(pages).toHaveLength(1);
    }
  );

  it("a natural newline at 47k from page start splits there (within the 45k-50k preferred range)", () => {
    const content = flatText(47_000) + "\n" + flatText(20_000);
    const pages = computeEditorPages(content);
    expect(pages[0].end).toBe(47_001);
  });

  it("a natural newline at 50k from page start splits there (exactly the ideal offset)", () => {
    const content = flatText(50_000) + "\n" + flatText(20_000);
    const pages = computeEditorPages(content);
    expect(pages[0].end).toBe(50_001);
  });

  it("a natural newline at 53k from page start splits there (within the 50k-55k preferred lookahead)", () => {
    const content = flatText(53_000) + "\n" + flatText(20_000);
    const pages = computeEditorPages(content);
    expect(pages[0].end).toBe(53_001);
  });

  it("no newline anywhere through the hard maximum forces a split at the ideal offset once minTrailing is reached", () => {
    const content = flatText(70_000); // no newlines anywhere
    const pages = computeEditorPages(content);
    expect(pages[0].end).toBe(EDITOR_PAGE_TARGET_SIZE);
    expect(pages[0].length).toBeLessThanOrEqual(55_000);
  });

  it("never splits a surrogate pair sitting exactly at the hard-cut split point", () => {
    const astral = "\u{1F600}";
    const content = flatText(EDITOR_PAGE_TARGET_SIZE) + astral + flatText(20_000);
    const pages = computeEditorPages(content);
    expect(
      pages[0].end === EDITOR_PAGE_TARGET_SIZE || pages[0].end === EDITOR_PAGE_TARGET_SIZE + 2
    ).toBe(true);
    expect(concatPages(content, pages)).toBe(content);
  });
});

describe("Preview -> Editor landing offset (TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §A)", () => {
  // A Preview publication page's own source-range start is the exact
  // GLOBAL offset PagedEditor.tsx's `moveSelectionToGlobal` is asked to
  // land on; this is the page-selection + local-offset half of that flow
  // (the DOM-selection half has no automated coverage -- see the module's
  // own comment in PagedEditor.tsx for why it was fixed structurally).
  const content = flatText(220_000);
  const pages = computeEditorPages(content);

  it("maps a source target near an editor page's own start to a small local offset (not 0 unless it truly is the start)", () => {
    const page = pages[1];
    const sourceStart = page.start + 37; // a few chars into the page, not page.start itself
    const targetIndex = editorPageForGlobalOffset(pages, sourceStart);
    expect(targetIndex).toBe(1);
    expect(globalToEditorPageLocal(pages[targetIndex], sourceStart)).toBe(37);
  });

  it("maps a source target in the middle of an editor page to the correct mid-page local offset", () => {
    const page = pages[2];
    const sourceStart = page.start + Math.floor(page.length / 2);
    const targetIndex = editorPageForGlobalOffset(pages, sourceStart);
    expect(targetIndex).toBe(2);
    const local = globalToEditorPageLocal(pages[targetIndex], sourceStart);
    expect(local).toBe(sourceStart - page.start);
    expect(local).toBeGreaterThan(0);
    expect(local).toBeLessThan(page.length);
  });

  it("maps a source target near an editor page's own end to a local offset near that page's length, not the next page's start", () => {
    const page = pages[1];
    const sourceStart = page.end - 5;
    const targetIndex = editorPageForGlobalOffset(pages, sourceStart);
    expect(targetIndex).toBe(1);
    expect(globalToEditorPageLocal(pages[targetIndex], sourceStart)).toBe(page.length - 5);
  });

  it("switches to the correct editor page (not merely offset 0 on the current one) when the target is on a different page", () => {
    const currentPageIndex = 0;
    const sourceStart = pages[3].start + 12_345;
    const targetIndex = editorPageForGlobalOffset(pages, sourceStart);
    expect(targetIndex).not.toBe(currentPageIndex);
    expect(targetIndex).toBe(3);
    expect(globalToEditorPageLocal(pages[targetIndex], sourceStart)).toBe(12_345);
  });
});

describe("editor-page-boundary typing lands near the new page's start, not its end (TSP-PAGED-EDITOR-QA-FIXES-AND-DEMO-010 §B)", () => {
  it("maps the caret right after a boundary-crossing keystroke to a small local offset on the NEW page", () => {
    // A page long enough that adding one more character (past a paragraph
    // break within the preferred search radius of the ~50k target) actually
    // splits it -- simulates "type at the end of the current page until it
    // splits". (A page merely just-under-target would simply absorb the
    // single extra char as its own trailing remainder -- see
    // `computeEditorPages`'s `minTrailingSize` -- and never split at all.)
    const before = flatText(54_999);
    const afterTyping = before + "\n" + flatText(1); // the boundary-crossing keystroke
    const pages = computeEditorPages(afterTyping);
    const globalCaret = afterTyping.length; // caret right after the just-typed char

    const targetIndex = editorPageForGlobalOffset(pages, globalCaret);
    const targetPage = pages[targetIndex];
    const localCaret = globalToEditorPageLocal(targetPage, globalCaret);

    // The caret must land near the START of whatever page it's now on, not
    // pinned to that page's own end (the reported bug) -- for this
    // single-extra-character keystroke the new/last page is only 1 char long,
    // so "near the start" and "at the end" coincide at this exact boundary;
    // the meaningful assertion is that it's the page's OWN small length, not
    // some stale/larger value from the page it used to be on.
    expect(localCaret).toBe(targetPage.length);
    expect(targetPage.length).toBeLessThan(10);
  });

  it("keeps the caret at a small, correctly-mapped local offset when several more characters follow the boundary crossing", () => {
    const before = flatText(54_998);
    const afterTyping = before + "\n" + flatText(200); // composition/typing continues past the boundary
    const pages = computeEditorPages(afterTyping);
    const globalCaret = afterTyping.length;

    const targetIndex = editorPageForGlobalOffset(pages, globalCaret);
    const targetPage = pages[targetIndex];
    const localCaret = globalToEditorPageLocal(targetPage, globalCaret);

    expect(localCaret).toBe(200);
    expect(targetPage.start).toBe(before.length + 1);
  });
});

describe("continuous manuscript growth (0 -> 300k+)", () => {
  it("grows through every editor-page threshold without losing or duplicating text, preserving the caret's page", () => {
    const steps = [0, 10_000, 49_000, 51_000, 60_000, 100_000, 150_000, 200_000, 250_000, 300_000, 320_000];
    let previousPageCount = 0;
    let crossedAThreshold = false;

    for (const targetLength of steps) {
      const content = flatText(targetLength);
      const pages = computeEditorPages(content);

      // No loss / duplication: pages always reconstruct the manuscript exactly.
      expect(concatPages(content, pages)).toBe(content);
      // Pages are contiguous and index-ordered.
      for (let i = 0; i < pages.length; i++) {
        expect(pages[i].index).toBe(i);
        if (i > 0) expect(pages[i].start).toBe(pages[i - 1].end);
      }

      // The caret at the manuscript's own end always resolves to the last page.
      const caretPage = editorPageForGlobalOffset(pages, content.length);
      expect(caretPage).toBe(pages.length - 1);

      if (pages.length > previousPageCount) crossedAThreshold = true;
      previousPageCount = pages.length;
    }

    expect(crossedAThreshold).toBe(true);
    expect(previousPageCount).toBeGreaterThan(1);
  });

  it("keeps every earlier page byte-identical when the manuscript grows past a new threshold (page stability)", () => {
    const before = flatText(120_000);
    const pagesBefore = computeEditorPages(before);

    // Simulate the user continuing to type at the very end of the manuscript.
    const after = before + flatText(40_000);
    const pagesAfter = computeEditorPages(after);

    // Every page fully contained in the untouched prefix is identical.
    for (let i = 0; i < pagesBefore.length - 1; i++) {
      expect(pagesAfter[i]).toEqual(pagesBefore[i]);
    }
  });

  it("simulates 10+ incremental editor-page transitions while typing forward from 0 chars", () => {
    // A smaller target size than production keeps this loop fast while
    // comfortably exercising 10+ threshold crossings, per the task's own
    // "test at least 10 editor-page transitions" requirement.
    const options = { targetSize: 20_000, minTrailingSize: 1_000 };
    let content = "";
    let transitions = 0;
    let lastPageCount = 1;

    for (let i = 0; i < 320; i++) {
      content += flatText(1_000); // simulate a 1,000-char burst of typing
      const pages = computeEditorPages(content, options);
      if (pages.length !== lastPageCount) {
        transitions += 1;
        lastPageCount = pages.length;
      }
    }

    expect(transitions).toBeGreaterThanOrEqual(10);
    expect(concatPages(content, computeEditorPages(content, options))).toBe(content);
  });
});

// TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §A/§L: the hard maximum is real and
// enforced automatically, and the "waiting" window between target and hard
// maximum (which does NOT search for a natural boundary at all -- see
// `chooseSafeEditorPageBoundary`'s own doc) is exactly the confirmed root
// cause of "shows 区切り待ち but nothing happens" -- these pin the exact
// checklist the task asked for.
describe("hard maximum invariant (TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §A)", () => {
  it("EDITOR_PAGE_HARD_MAXIMUM_SIZE is 55,000 at the default target/minTrailing settings", () => {
    expect(EDITOR_PAGE_HARD_MAXIMUM_SIZE).toBe(55_000);
  });

  it("49,999 chars (no newline): stays a single page, no waiting", () => {
    const content = flatText(49_999);
    const pages = computeEditorPages(content);
    expect(pages).toHaveLength(1);
    expect(pages[0].length).toBeLessThan(EDITOR_PAGE_TARGET_SIZE);
  });

  it("50,000 chars (no newline): the active page has reached target -- this is the waiting window's own start", () => {
    const content = flatText(50_000);
    const pages = computeEditorPages(content);
    expect(pages).toHaveLength(1);
    expect(pages[0].length).toBe(EDITOR_PAGE_TARGET_SIZE);
  });

  it("52,000 chars, no natural break anywhere: still a single page (the confirmed 'waiting but not actually searching yet' window)", () => {
    const content = flatText(52_000);
    const pages = computeEditorPages(content);
    expect(pages).toHaveLength(1);
    expect(pages[0].length).toBe(52_000);
    expect(pages[0].length).toBeLessThan(EDITOR_PAGE_HARD_MAXIMUM_SIZE);
  });

  it("54,999 chars, no natural break anywhere: still a single page, one char under the hard maximum", () => {
    const content = flatText(54_999);
    const pages = computeEditorPages(content);
    expect(pages).toHaveLength(1);
    expect(pages[0].length).toBe(EDITOR_PAGE_HARD_MAXIMUM_SIZE - 1);
  });

  it("reaching the hard maximum forces a split even with no natural boundary anywhere", () => {
    const content = flatText(EDITOR_PAGE_HARD_MAXIMUM_SIZE);
    const pages = computeEditorPages(content);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].length).toBeLessThanOrEqual(EDITOR_PAGE_HARD_MAXIMUM_SIZE);
  });

  it("no computed Editor Page ever exceeds the hard maximum for content well beyond it", () => {
    const content = flatText(300_000);
    const pages = computeEditorPages(content);
    for (const page of pages) {
      expect(page.length).toBeLessThanOrEqual(EDITOR_PAGE_HARD_MAXIMUM_SIZE);
    }
  });

  it("content already past the hard maximum always has 2+ pages, regardless of newlines", () => {
    for (const length of [EDITOR_PAGE_HARD_MAXIMUM_SIZE + 1, EDITOR_PAGE_HARD_MAXIMUM_SIZE + 5_000, 80_000]) {
      const pages = computeEditorPages(flatText(length));
      expect(pages.length).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("manual Editor Page split via forcedBoundaries (TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §C/§D/§E)", () => {
  it("a forced boundary inside the waiting window (50k-55k) splits immediately even with no natural break", () => {
    const content = flatText(53_000); // squarely inside the confirmed dead zone
    const before = computeEditorPages(content);
    expect(before).toHaveLength(1); // confirms it's actually stuck, per the audit

    // Mirrors what the "今すぐ区切る" action itself computes: the ordinary
    // boundary chooser with minTrailingSize disabled.
    const forcedOffset = chooseSafeEditorPageBoundary(content, 0, EDITOR_PAGE_TARGET_SIZE, { minTrailingSize: 0 });
    const pages = computeEditorPages(content, { forcedBoundaries: [forcedOffset] });
    expect(pages).toHaveLength(2);
    expect(pages[0].end).toBe(forcedOffset);
    expect(pages[1].start).toBe(forcedOffset);
    expect(concatPages(content, pages)).toBe(content);
  });

  it("does not alter canonical text -- forcedBoundaries only changes where pages split, never the content", () => {
    const content = flatText(30_000) + "\n" + flatText(23_000);
    const forced = computeEditorPages(content, { forcedBoundaries: [40_000] });
    expect(concatPages(content, forced)).toBe(content);
  });

  it("a caret after the forced split maps to the new next page at the correct local offset", () => {
    const content = flatText(53_000);
    const forcedOffset = chooseSafeEditorPageBoundary(content, 0, EDITOR_PAGE_TARGET_SIZE, { minTrailingSize: 0 });
    const pages = computeEditorPages(content, { forcedBoundaries: [forcedOffset] });
    const globalCaret = content.length; // caret was at the very end when the split was forced
    const targetIndex = editorPageForGlobalOffset(pages, globalCaret);
    expect(targetIndex).toBe(1);
    expect(globalToEditorPageLocal(pages[targetIndex], globalCaret)).toBe(content.length - forcedOffset);
  });

  it("a caret before the forced split stays on the previous page", () => {
    const content = flatText(53_000);
    const forcedOffset = chooseSafeEditorPageBoundary(content, 0, EDITOR_PAGE_TARGET_SIZE, { minTrailingSize: 0 });
    const pages = computeEditorPages(content, { forcedBoundaries: [forcedOffset] });
    const targetIndex = editorPageForGlobalOffset(pages, forcedOffset - 10);
    expect(targetIndex).toBe(0);
  });

  it("never splits a surrogate pair sitting at the target offset when forcing with no natural boundary", () => {
    const astral = "\u{1F600}";
    const content = flatText(EDITOR_PAGE_TARGET_SIZE) + astral + flatText(3_000);
    const forcedOffset = chooseSafeEditorPageBoundary(content, 0, EDITOR_PAGE_TARGET_SIZE, { minTrailingSize: 0 });
    expect(forcedOffset === EDITOR_PAGE_TARGET_SIZE || forcedOffset === EDITOR_PAGE_TARGET_SIZE + 2).toBe(true);
    const pages = computeEditorPages(content, { forcedBoundaries: [forcedOffset] });
    expect(concatPages(content, pages)).toBe(content);
  });

  it("a forced split survives subsequent typing appended after it", () => {
    const content = flatText(53_000);
    const forcedOffset = chooseSafeEditorPageBoundary(content, 0, EDITOR_PAGE_TARGET_SIZE, { minTrailingSize: 0 });
    const grown = content + flatText(500);
    const pages = computeEditorPages(grown, { forcedBoundaries: [forcedOffset] });
    expect(pages[0].end).toBe(forcedOffset);
    expect(pages[pages.length - 1].end).toBe(grown.length);
  });
});

describe("adjustForcedBoundaries (TSP-EDITOR-PAGE-WAITING-UX-HOTFIX-012A §E)", () => {
  it("leaves a boundary before the edited range untouched", () => {
    expect(adjustForcedBoundaries([100], 500, 510, 3)).toEqual([100]);
  });

  it("shifts a boundary after the edited range by the length delta (insertion)", () => {
    expect(adjustForcedBoundaries([1_000], 100, 100, 50)).toEqual([1_050]);
  });

  it("shifts a boundary after the edited range by the length delta (deletion)", () => {
    expect(adjustForcedBoundaries([1_000], 100, 150, 0)).toEqual([950]);
  });

  it("drops a boundary that fell strictly inside the edited/replaced range", () => {
    expect(adjustForcedBoundaries([120], 100, 150, 0)).toEqual([]);
  });

  it("a boundary exactly at the edit's own start is kept; one exactly at its end shifts to meet it (both edges of a pure deletion collapse to the same point)", () => {
    expect(adjustForcedBoundaries([100, 150], 100, 150, 0)).toEqual([100, 100]);
  });

  it("handles several boundaries at once, each independently", () => {
    expect(adjustForcedBoundaries([50, 120, 300], 100, 150, 10)).toEqual([50, 260]);
  });
});

describe("arbitrary manual Editor Page splits (TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B)", () => {
  it.each([10_000, 27_345, 49_999])("splits at the exact caret offset %i", (caret) => {
    const content = flatText(120_000);
    const pages = computeEditorPages(content, { forcedBoundaries: [caret] });
    expect(pages[0].end).toBe(caret);
    expect(pages[1].start).toBe(caret);
    expect(concatPages(content, pages)).toBe(content);
    const caretPage = pages[editorPageForGlobalOffset(pages, caret)];
    expect(caretPage.start).toBe(caret);
    expect(globalToEditorPageLocal(caretPage, caret)).toBe(0);
  });

  it("splits inside Editor Page 2 without replacing Page 1's automatic boundary", () => {
    const content = flatText(150_000);
    const automatic = computeEditorPages(content);
    const page2Caret = automatic[1].start + 27_345;
    const pages = computeEditorPages(content, { forcedBoundaries: [page2Caret] });
    expect(pages[0].end).toBe(automatic[0].end);
    expect(pages[1].start).toBe(automatic[0].end);
    expect(pages[1].end).toBe(page2Caret);
    expect(pages[2].start).toBe(page2Caret);
  });

  it("keeps multiple manual boundaries ordered and coexisting", () => {
    const content = flatText(140_000);
    const boundaries = [10_000, 27_345, 49_999, 77_777];
    const pages = computeEditorPages(content, { forcedBoundaries: boundaries });
    expect(pages.slice(0, boundaries.length).map((page) => page.end)).toEqual(boundaries);
    expect(concatPages(content, pages)).toBe(content);
  });

  it("deduplicates boundaries and ignores document endpoints", () => {
    const content = flatText(30_000);
    const pages = computeEditorPages(content, { forcedBoundaries: [0, 10_000, 10_000, content.length] });
    expect(pages).toHaveLength(2);
    expect(pages[0].end).toBe(10_000);
  });

  it("rejects a forced offset inside a surrogate pair instead of moving or splitting it", () => {
    const content = flatText(9_999) + "\u{1F600}" + flatText(20_000);
    const insidePair = 10_000;
    const pages = computeEditorPages(content, { forcedBoundaries: [insidePair] });
    expect(pages).toHaveLength(1);
    expect(concatPages(content, pages)).toBe(content);
  });

  it("keeps a boundary stable after typing/editing after it", () => {
    const boundary = 10_000;
    const content = flatText(30_000);
    const grown = content + "追記";
    const pages = computeEditorPages(grown, { forcedBoundaries: [boundary] });
    expect(pages[0].end).toBe(boundary);
    expect(adjustForcedBoundaries([boundary], 20_000, 20_000, 2)).toEqual([boundary]);
  });

  it("shifts a boundary by the exact delta when editing before it", () => {
    const shifted = adjustForcedBoundaries([10_000, 27_345], 5_000, 5_000, 3);
    expect(shifted).toEqual([10_003, 27_348]);
    const pages = computeEditorPages(flatText(40_003), { forcedBoundaries: shifted });
    expect(pages[0].end).toBe(10_003);
    expect(pages[1].end).toBe(27_348);
  });
});

describe("cross-boundary Backspace integration (TSP-EDITOR-MANUAL-SPLIT-AND-BACKSPACE-HOTFIX-012B)", () => {
  function backspaceFromPage2Start(content: string, initialForced: number[] = []) {
    const beforePages = computeEditorPages(content, { forcedBoundaries: initialForced });
    const boundary = beforePages[1].start;
    const low = content.charCodeAt(boundary - 1);
    const deleteFrom =
      low >= 0xdc00 && low <= 0xdfff && content.charCodeAt(boundary - 2) >= 0xd800 && content.charCodeAt(boundary - 2) <= 0xdbff
        ? boundary - 2
        : boundary - 1;
    const removedText = content.slice(deleteFrom, boundary);
    const nextContent = content.slice(0, deleteFrom) + content.slice(boundary);
    let nextForced = adjustForcedBoundaries(initialForced, deleteFrom, boundary, 0);
    if (deleteFrom > 0 && !nextForced.includes(deleteFrom)) nextForced = [...nextForced, deleteFrom].sort((a, b) => a - b);
    const pages = computeEditorPages(nextContent, { forcedBoundaries: nextForced });
    const pageIndex = editorPageForGlobalOffset(pages, deleteFrom, "backward");
    return { boundary, deleteFrom, removedText, nextContent, nextForced, pages, pageIndex };
  }

  it.each([
    { label: "automatic", forced: [] as number[] },
    { label: "manual", forced: [10_000] },
  ])("lands at the previous page end across a $label boundary", ({ forced }) => {
    const result = backspaceFromPage2Start(flatText(70_000), forced);
    expect(result.pageIndex).toBe(0);
    expect(globalToEditorPageLocal(result.pages[0], result.deleteFrom)).toBe(result.pages[0].length);
    expect(result.nextContent.length).toBe(69_999);
  });

  it("deletes exactly one newline before the boundary", () => {
    const content = flatText(49_999) + "\n" + flatText(20_000);
    const result = backspaceFromPage2Start(content);
    expect(result.removedText).toBe("\n");
    expect(result.nextContent).toBe(flatText(69_999));
    expect(globalToEditorPageLocal(result.pages[0], result.deleteFrom)).toBe(result.pages[0].length);
  });

  it("deletes a complete surrogate pair and never half of it", () => {
    const content = flatText(9_998) + "\u{1F600}" + flatText(20_000);
    const result = backspaceFromPage2Start(content, [10_000]);
    expect(result.removedText).toBe("\u{1F600}");
    expect(result.nextContent).toBe(flatText(29_998));
    expect(globalToEditorPageLocal(result.pages[0], result.deleteFrom)).toBe(result.pages[0].length);
  });

  it("keeps repeated Backspace on the previous page instead of bouncing to next-page local 0", () => {
    const first = backspaceFromPage2Start(flatText(70_000));
    const boundary = first.pages[0].end;
    const deleteFrom = boundary - 1;
    const nextContent = first.nextContent.slice(0, deleteFrom) + first.nextContent.slice(boundary);
    const nextForced = adjustForcedBoundaries(first.nextForced, deleteFrom, boundary, 0);
    const pages = computeEditorPages(nextContent, { forcedBoundaries: nextForced });
    const pageIndex = editorPageForGlobalOffset(pages, deleteFrom, "backward");
    expect(pageIndex).toBe(0);
    expect(globalToEditorPageLocal(pages[pageIndex], deleteFrom)).toBe(pages[pageIndex].length);
  });

  it("restores the canonical manuscript through undo after crossing the boundary", () => {
    const content = flatText(70_000);
    const result = backspaceFromPage2Start(content);
    const history = pushEdit(createUndoHistory(), {
      rangeStart: result.deleteFrom,
      removedText: result.removedText,
      insertedText: "",
    });
    const restored = undo(history, result.nextContent);
    expect(restored?.canonicalText).toBe(content);
  });
});
