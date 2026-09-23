import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesktopReviewBarMount } from "./DesktopReviewBar";

/**
 * TSP-Review-UI (Revision 4): the Desktop Review Bar replaces Revision 3's Review Rail (Human QA
 * rejected the third-column sidebar -- see DesktopReviewBar.tsx's own doc comment). This suite
 * follows the repo's established pattern for interactive components with no jsdom available in this
 * vitest config (`environment: "node"`): the static shell is checked via `renderToStaticMarkup`, and
 * the interactive local state (which popover is open, Escape / outside-press, mutual exclusivity) is
 * locked in as a SOURCE contract -- real interaction is proven by the real-browser E2E
 * (`tests/e2e/reviewLayout.e2e.mjs`), same division of labour as every other dock/card component here.
 */

const noop = () => {};
const source = readFileSync(resolve("src/components/DesktopReviewBar.tsx"), "utf8");

describe("DesktopReviewBarMount: the static shell TategakiEditor renders at the bottom of Preview", () => {
  it("is only a relative anchor point + portal target -- no width/border/background opinion (Preview's own box supplies that)", () => {
    const html = renderToStaticMarkup(createElement(DesktopReviewBarMount, { mountRef: noop }));
    expect(html).toContain('data-desktop-review-bar-mount=""');
    expect(html).toContain('class="relative flex-none"');
  });
});

describe("DesktopReviewBar: one popover open at a time", () => {
  it("keeps a single `activePopover` derived from the shared reviewHubOpen state plus its own local quick-popover state", () => {
    expect(source).toContain('useState<"read-aloud" | "description-check" | null>(null)');
    expect(source).toContain("const activePopover = reviewHubOpen ? \"hub\" : quickPopover;");
  });

  it("opening 見直し always clears any open quick popover first (never two popovers at once)", () => {
    expect(source).toMatch(/const openHub = \(\) => \{\s*setQuickPopover\(null\);\s*onToggleReviewHub\(\);\s*\};/);
  });

  it("opening a quick popover closes the Hub first if it was open, and clicking the SAME tool again closes it (toggle, not stack)", () => {
    expect(source).toContain("if (reviewHubOpen) onToggleReviewHub();");
    expect(source).toContain('setQuickPopover((current) => (current === id ? null : id));');
  });

  it("selecting the OTHER quick tool switches content (not additive) -- the same setQuickPopover(id) replaces whatever was open", () => {
    expect(source).toMatch(/const selectQuick = \(id: "read-aloud" \| "description-check"\) => \{/);
  });
});

describe("DesktopReviewBar: Escape and outside-press close whichever quick popover is open", () => {
  it("listens for both while a quick popover is open, and only then", () => {
    expect(source).toContain("useEffect(() => {\n    if (!quickPopover) return;");
    expect(source).toContain('document.addEventListener("pointerdown", onPointerDown);');
    expect(source).toContain('document.addEventListener("keydown", onKeyDown);');
    expect(source).toContain('if (event.key === "Escape") closeQuick();');
  });

  it("the outside-press check is scoped to this component's own wrapperRef (so clicking inside a popover never closes it)", () => {
    expect(source).toContain("if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) closeQuick();");
  });

  it("listeners are removed once no quick popover is open (no leaked global listeners)", () => {
    expect(source).toMatch(/return \(\) => \{\s*document\.removeEventListener\("pointerdown", onPointerDown\);\s*document\.removeEventListener\("keydown", onKeyDown\);\s*\};/);
  });
});

describe("DesktopReviewBar: pin-gated quick indicators, always-present 見直し", () => {
  it("見直し is unconditional -- it is the bar's whole reason to exist even with nothing pinned", () => {
    expect(source).toContain("<ReviewHubTrigger open={reviewHubOpen} onToggle={openHub} />");
    expect(source).not.toMatch(/\{readAloudPinned[^}]*<ReviewHubTrigger/);
  });

  it("音読β's status pill shows while pinned OR actively speaking/paused (closing/switching surfaces must never strand playback -- same rule as the compact mini bar)", () => {
    expect(source).toContain('const readAloudActive = readAloud.state.status !== "idle";');
    expect(source).toContain("const showReadAloud = readAloudPinned || readAloudActive;");
    expect(source).toContain("{showReadAloud && <ReadAloudStatusPill");
  });

  it("描写・修飾チェックβ's pill is pin-gated only (no 'unpinned but active' exception -- it has no comparable in-progress state to strand)", () => {
    expect(source).toContain("{descriptionPinned && (");
    expect(source).toContain("<DescriptionCheckFooterPill");
  });
});

describe("DesktopReviewBar: quick popovers overlay Preview without resizing it", () => {
  it("both quick popovers are absolutely positioned, anchored to the bar's own relative root, opening upward", () => {
    expect(source.match(/className="absolute bottom-full left-0 z-20 mb-1\.5 w-\[19rem\] max-w-\[calc\(100vw-2rem\)\]"/g)).toHaveLength(2);
  });

  it("the Hub popover is the SAME `<ReviewHubPanel>` element EditorPane builds (not a duplicate) -- its own anchored variant already renders `absolute bottom-full`, so it needs no extra wrapper here", () => {
    expect(source).toContain("{reviewHubPanel}");
    expect(source).toContain("reviewHubPanel: ReactNode;"); // received as a prop, never constructed in this file
  });

  it("reuses the existing dock card components unchanged -- no forked B4/B5 popover-only UI", () => {
    expect(source).toContain("<ReadAloudDockCard {...readAloud} />");
    expect(source).toContain("<DescriptionCheckDockCard {...description} />");
  });
});
