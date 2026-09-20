import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  CharacterCountReviewSection,
  ReviewHubPanel,
  ReviewHubTrigger,
  WritingCheckReviewSection,
} from "./ReviewHub";
import {
  REVIEW_HUB_HEADING_ID,
  REVIEW_HUB_MAX_HEIGHT_PX,
  REVIEW_HUB_PANEL_ID,
  REVIEW_HUB_TOOLS,
  computeReviewHubMaxHeight,
  formatReviewHubCharacterCount,
  isReviewHubVisible,
  shouldCloseReviewHubOnKey,
} from "@/lib/reviewHub";
import {
  WRITING_CHECK_NO_CANDIDATES_LABEL,
  describeWritingIssueSummary,
  summarizeWritingIssues,
} from "@/lib/writingCheckSummary";

/**
 * TSP-B1 Review Hub. This repo's vitest runs in Node with no jsdom, so
 * (a) the presentational components are rendered with `renderToStaticMarkup`
 * (they touch no `document` while rendering), (b) pure behaviour lives in
 * `src/lib/reviewHub.ts` and is tested as data, and (c) wiring into
 * EditorPane is source-checked — the same technique the existing footer /
 * Focus-mode contract tests use. Real open/close, Escape, outside-press,
 * focus and pixel-overflow behaviour is covered by
 * `tests/e2e/reviewHub.e2e.mjs` (real Chrome).
 */
const read = (path: string) => readFileSync(resolve(path), "utf8");
/** Comments may legitimately name what is NOT built (e.g. "no pin preference"); scan the code only. */
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
const pane = read("src/components/EditorPane.tsx");
const hubView = codeOnly(read("src/components/ReviewHub.tsx"));
const hubHook = codeOnly(read("src/hooks/useReviewHubDisclosure.ts"));
const hubModel = codeOnly(read("src/lib/reviewHub.ts"));
const noop = () => {};

const sections = {
  "writing-check": createElement("span", { "data-test-section": "wc" }, "wc"),
  "character-count": createElement("span", { "data-test-section": "cc" }, "cc"),
};
const panelMarkup = (open: boolean) =>
  renderToStaticMarkup(createElement(ReviewHubPanel, { open, onClose: noop, sections }));

/** The JSX between two markers of EditorPane (first occurrence after `from`). */
const paneBetween = (from: string, to: string) => {
  const start = pane.indexOf(from);
  expect(start, `${from} must exist in EditorPane`).toBeGreaterThan(-1);
  const end = pane.indexOf(to, start);
  expect(end, `${to} must follow ${from}`).toBeGreaterThan(start);
  return pane.slice(start, end);
};

describe("B1 top toolbar is unchanged", () => {
  it("still exposes exactly 設定・オプション・メモ・ヘルプ and no Review Hub entry", () => {
    const secondary = paneBetween('data-editor-secondary-row=""', "</nav>");
    expect(Array.from(secondary.matchAll(/data-editor-secondary="([^"]+)"/g), (m) => m[1])).toEqual([
      "settings",
      "options",
      "memo",
      "help",
    ]);
    expect(secondary).not.toMatch(/ReviewHub|見直し/);
  });

  it("never mentions the Review Hub in the global Header or the phone nav", () => {
    for (const file of ["src/components/Header.tsx", "src/components/MobileEditorNav.tsx"]) {
      expect(read(file), file).not.toMatch(/ReviewHub|見直し/);
    }
  });
});

describe("B1 footer trigger", () => {
  it("is a real button labelled ▶ 見直し with the aria contract (closed)", () => {
    const html = renderToStaticMarkup(createElement(ReviewHubTrigger, { open: false, onToggle: noop }));
    expect(html).toMatch(/^<button /);
    expect(html).toContain('type="button"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain(`aria-controls="${REVIEW_HUB_PANEL_ID}"`);
    expect(html).toContain("data-editor-review-hub-trigger");
    expect(html.replace(/<[^>]+>/g, "")).toBe("▶ 見直し");
    // The arrow is decoration; the accessible name is just 見直し.
    expect(html).toMatch(/<span aria-hidden="true"[^>]*>▶<\/span>/);
  });

  it("reports aria-expanded=true and turns the arrow upward when open", () => {
    const html = renderToStaticMarkup(createElement(ReviewHubTrigger, { open: true, onToggle: noop }));
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("-rotate-90");
  });

  it("is rendered in BOTH footer forms (expanded status row + mobile one-line row), inside the footer wrapper", () => {
    expect(pane.match(/<ReviewHubTrigger /g)).toHaveLength(2);
    const collapsedRow = paneBetween('data-editor-footer-collapsed=""', 'data-writing-check-surface=""');
    expect(collapsedRow).toContain("<ReviewHubTrigger");
    expect(collapsedRow).toContain("compact");
    const statusRow = paneBetween('data-editor-status-surfaces=""', "<ReviewHubPanel");
    expect(statusRow).toContain("<ReviewHubTrigger");

    const wrapperStart = pane.indexOf('data-editor-footer=""');
    expect(wrapperStart).toBeGreaterThan(-1);
    for (const marker of ["<ReviewHubTrigger", "<ReviewHubPanel", 'data-editor-status-surfaces=""']) {
      expect(pane.indexOf(marker), marker).toBeGreaterThan(wrapperStart);
    }
    expect(paneBetween('data-editor-footer=""', "{/* TSP-RC-LATIN")).toContain("relative");
  });
});

describe("B1 panel structure", () => {
  it("is anchored upward from the footer (bottom-full of the relative wrapper) and never sizes the textarea", () => {
    const html = panelMarkup(true);
    expect(html).toContain("absolute bottom-full");
    expect(html).not.toContain(" hidden");
    expect(html).toContain(`id="${REVIEW_HUB_PANEL_ID}"`);
    // The panel is an overlay: it must not be a flex participant that takes height from the manuscript.
    expect(html).not.toMatch(/class="[^"]*\b(flex-none|flex-1|static|relative)\b/);
  });

  it("has an identifiable heading and is labelled by it", () => {
    const html = panelMarkup(true);
    expect(html).toContain(`aria-labelledby="${REVIEW_HUB_HEADING_ID}"`);
    expect(html).toMatch(new RegExp(`<h2 id="${REVIEW_HUB_HEADING_ID}"[^>]*>見直し</h2>`));
    expect(html).toContain('aria-label="見直しを閉じる"');
  });

  it("stays in the DOM but hidden while closed, so aria-controls always resolves", () => {
    expect(panelMarkup(false)).toMatch(/<section[^>]* hidden=""/);
    expect(panelMarkup(true)).not.toMatch(/<section[^>]* hidden=""/);
  });

  it("renders exactly the registered tools, in registry order", () => {
    const html = panelMarkup(true);
    expect(Array.from(html.matchAll(/data-review-hub-tool="([^"]+)"/g), (m) => m[1])).toEqual([
      "writing-check",
      "character-count",
    ]);
    expect(html.indexOf("文章チェックβ")).toBeLessThan(html.indexOf("文字数カウント"));
  });

  it("keeps a narrow-viewport contract: inset 8px, capped height, own scroll, fixed width only from md up", () => {
    const html = panelMarkup(true);
    expect(html).toContain("left-2 right-2");
    expect(html).toContain("max-h-[min(22rem,45vh)]");
    expect(html).toContain("overflow-y-auto");
    // md+ panes can be narrower than 22rem (the 768px split gives ~334px): the width must yield to the pane.
    expect(html).toContain("md:left-auto md:w-[22rem] md:max-w-[calc(100%-1rem)]");
    expect(html).not.toMatch(/[\s"]w-\[\d+(rem|px)\]/); // no unconditional fixed width (md:w-[…] is fine)
  });
});

describe("B1 only exposes tools that exist today", () => {
  it("registers exactly 文章チェックβ and 文字数カウント", () => {
    expect(REVIEW_HUB_TOOLS.map((tool) => tool.id)).toEqual(["writing-check", "character-count"]);
    expect(REVIEW_HUB_TOOLS.map((tool) => tool.title)).toEqual(["文章チェックβ", "文字数カウント"]);
  });

  it("shows no unreleased B4/B5 tool anywhere the user can see (registry data + rendered UI + view/hook source)", () => {
    const unreleased = /描写|修飾|音読|リズム|VOICEVOX|傍点|coming soon|近日|準備中|Coming/i;
    const visible = [
      JSON.stringify(REVIEW_HUB_TOOLS),
      panelMarkup(true),
      renderToStaticMarkup(createElement(ReviewHubTrigger, { open: true, onToggle: noop })),
      hubView,
      hubHook,
    ].join("\n");
    expect(visible).not.toMatch(unreleased);
  });

  it("has no clickable placeholder: every button in the rendered panel is a real, wired control", () => {
    const html =
      panelMarkup(true) +
      renderToStaticMarkup(
        createElement(WritingCheckReviewSection, {
          enabled: true,
          onToggle: noop,
          summary: { total: 1, red: 1, yellow: 0 },
          onShowResults: noop,
          onOpenSettings: noop,
        })
      );
    const labels = Array.from(html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g), (m) => m[1].replace(/<[^>]+>/g, "").trim());
    expect(labels.sort()).toEqual(["⚙ 設定", "確認候補を見る", "✕"].sort());
  });
});

describe("B1 does not implement B2 (no pinning, favourites, slots or persisted preference)", () => {
  it("has no pin / favourite / フッターに表示 controls or copy in the Hub", () => {
    const html = panelMarkup(true) + renderToStaticMarkup(createElement(ReviewHubTrigger, { open: true, onToggle: noop }));
    expect(html + hubView + hubHook + hubModel).not.toMatch(
      /フッターに表示|ピン|pin|favorite|favourite|お気に入り|slot|スロット/i
    );
  });

  it("persists nothing: session-only state, no storage access in the Hub hook/view/model", () => {
    for (const source of [hubHook, hubView, hubModel]) {
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|useSyncExternalStore/);
    }
    expect(hubHook).toContain("useState(false)");
  });

  it("adds no new B3 feedback/report question", () => {
    expect(hubView + hubHook + hubModel).not.toMatch(/足りている|もう1枠|BetaFeedback|報告/);
  });
});

describe("B1 reuses the existing 文章チェックβ behaviour", () => {
  const hubBlock = paneBetween("<ReviewHubPanel", "</div>\n    </div>\n  );");

  it("the Hub toggle is the very same setter the footer checkbox uses", () => {
    expect(hubBlock).toContain("onToggle={setWritingCheckEnabled}");
    expect(hubBlock).toContain("enabled={writingCheckEnabled}");
    expect(paneBetween("<WritingCheckBar", "onOpenSettings")).toContain("onToggle={setWritingCheckEnabled}");
  });

  it("issue counts come from the same filtered issue list, via ONE shared summariser", () => {
    expect(hubBlock).toContain("summarizeWritingIssues(writingIssuesForContent)");
    expect(paneBetween("<WritingCheckBar", "/>")).toContain("issues={writingIssuesForContent}");
    expect(read("src/components/WritingCheckBar.tsx")).toContain("summarizeWritingIssues(issues)");
    expect(hubView + hubHook).not.toMatch(/runWritingCheck|applyFix|applyBulkFix|filterIgnored|writingCheckEngine/);
  });

  it("「設定」 opens the existing settings panel state and 「確認候補を見る」 asks the existing result list to open", () => {
    expect(pane).toMatch(/handleReviewHubOpenSettings = \(\) => \{[\s\S]*?setSettingsOpen\(true\);/);
    expect(pane).toMatch(/handleReviewHubShowResults = \(\) => \{[\s\S]*?setWritingCheckResultsRequest\(/);
    expect(paneBetween("<WritingCheckBar", "/>")).toContain("resultsRequestNonce={writingCheckResultsRequest}");
    expect(pane.match(/<WritingCheckSettingsPanel/g)).toHaveLength(1); // no second settings surface
    // mobile one-line footer hides the result list + settings host: expand first, then reveal.
    expect(pane).toMatch(/revealWritingCheckSurface = \(\) => \{[\s\S]*?closeReviewHub\(\);[\s\S]*?setFooterCollapsed\(false\)/);
  });

  it("renders the toggle state, the same wording as the bar, and only offers actions that can act", () => {
    const view = (props: Partial<Parameters<typeof WritingCheckReviewSection>[0]>) =>
      renderToStaticMarkup(
        createElement(WritingCheckReviewSection, {
          enabled: true,
          onToggle: noop,
          summary: { total: 0, red: 0, yellow: 0 },
          onShowResults: noop,
          onOpenSettings: noop,
          ...props,
        })
      );
    const off = view({ enabled: false });
    expect(off).toContain("data-review-hub-writing-check-toggle");
    expect(off).not.toContain("checked");
    expect(off).not.toContain("data-review-hub-writing-check-status");
    expect(off).not.toContain("data-review-hub-writing-check-settings");

    const none = view({});
    expect(none).toContain("checked");
    expect(none).toContain(WRITING_CHECK_NO_CANDIDATES_LABEL);
    expect(none).not.toContain("data-review-hub-writing-check-results"); // nothing to show

    const some = view({ summary: { total: 5, red: 2, yellow: 3 } });
    expect(some).toContain("事故確認 2件 ／ 確認推奨 3件");
    expect(some).toContain("data-review-hub-writing-check-results");
    expect(some).toContain("data-review-hub-writing-check-settings");
  });
});

describe("shared 文章チェックβ summary", () => {
  it("counts severities and words them like the footer bar", () => {
    const issues = [
      { severity: "HIGH_CONFIDENCE" },
      { severity: "HIGH_CONFIDENCE" },
      { severity: "REVIEW" },
    ] as never[];
    expect(summarizeWritingIssues(issues)).toEqual({ total: 3, red: 2, yellow: 1 });
    expect(describeWritingIssueSummary({ total: 3, red: 2, yellow: 1 })).toBe("事故確認 2件 ／ 確認推奨 1件");
    expect(describeWritingIssueSummary({ total: 1, red: 0, yellow: 1 })).toBe("確認推奨 1件");
    expect(describeWritingIssueSummary({ total: 0, red: 0, yellow: 0 })).toBe("確認候補なし");
  });
});

describe("B1 文字数カウント uses the canonical count", () => {
  it("shows the value it is given, grouped like the footer's compact line", () => {
    expect(formatReviewHubCharacterCount(12843)).toBe("12,843文字");
    const html = renderToStaticMarkup(createElement(CharacterCountReviewSection, { count: 12843 }));
    expect(html).toContain("現在の原稿文字数");
    expect(html).toContain("12,843文字");
  });

  it("is fed EditorPane's debounced visualLength and adds no second counter", () => {
    expect(pane).toContain('"character-count": <CharacterCountReviewSection count={visualLength} />');
    expect(pane.match(/countVisualLength\(/g)).toHaveLength(1); // the one canonical source
    expect(pane).toContain("現在の原稿文字数 {visualLength}文字"); // footer pill unchanged
    expect(hubView + hubHook + hubModel).not.toMatch(/countVisualLength|tategaki|\.length\b/);
  });
});

describe("B1 follows the existing footer chrome rules (focus mode / mobile keyboard)", () => {
  it("is visible only when the footer itself is", () => {
    expect(isReviewHubVisible(true, { focusMode: false, keyboardActive: false })).toBe(true);
    expect(isReviewHubVisible(true, { focusMode: true, keyboardActive: false })).toBe(false);
    expect(isReviewHubVisible(true, { focusMode: false, keyboardActive: true })).toBe(false);
    expect(isReviewHubVisible(true, { focusMode: true, keyboardActive: true })).toBe(false);
    expect(isReviewHubVisible(false, { focusMode: false, keyboardActive: false })).toBe(false);
  });

  it("drives the state from the canonical focusMode / keyboardActive props and resets when the footer hides", () => {
    expect(pane).toContain("useReviewHubDisclosure({ focusMode, keyboardActive }, paneRef)");
    expect(hubHook).toContain("if (suppressed) setRequestedOpen(false);");
    expect(hubHook).toContain("isReviewHubVisible(requestedOpen, chrome)");
  });

  it("introduces no focus-mode exception: the trigger lives inside the surfaces the existing contract already hides", () => {
    // Existing pins (postBlockerUx / rcPolishRound4/5) keep both surfaces on focusMode ? "max-md:hidden md:hidden".
    expect(pane).toMatch(/data-editor-status-surfaces=""[\s\S]{0,180}focusMode \? "max-md:hidden md:hidden"/);
    expect(pane).toContain("footerCollapsed && !focusMode && !keyboardActive");
    const wrapperOpen = paneBetween('data-editor-footer=""', "{/* TSP-RC-LATIN");
    expect(wrapperOpen).not.toMatch(/focusMode|keyboardActive/); // wrapper adds no chrome of its own
  });
});

describe("B1 keyboard / focus behaviour (pure parts)", () => {
  it("Escape closes, but never mid-IME and never for other keys", () => {
    expect(shouldCloseReviewHubOnKey("Escape", false)).toBe(true);
    expect(shouldCloseReviewHubOnKey("Escape", true)).toBe(false);
    for (const key of ["Enter", " ", "Tab", "a", "Esc"]) expect(shouldCloseReviewHubOnKey(key, false)).toBe(false);
  });

  it("never steals focus on open, has no global key listener, and only handles Escape on its own wrapper", () => {
    expect(hubHook).not.toMatch(/addEventListener\("keydown"/);
    // The only .focus() is the Escape-from-inside-the-panel return to the trigger.
    expect(hubHook.match(/\.focus\(\)/g)).toHaveLength(1);
    const toggleBody = hubHook.slice(hubHook.indexOf("const toggle"), hubHook.indexOf("\n", hubHook.indexOf("const toggle")));
    expect(toggleBody).not.toContain("focus");
    expect(pane).toContain("onKeyDown={handleReviewHubKeyDown}");
    expect(hubView).not.toMatch(/autoFocus|aria-modal|role="dialog"/); // a disclosure panel, not a modal
  });

  it("closes on an outside press like the existing 文章チェックβ popover", () => {
    expect(hubHook).toContain('document.addEventListener("pointerdown"');
    expect(hubHook).toContain("wrapperRef.current.contains(event.target as Node)");
  });

  it("does not throw when the trigger is toggled with the noop handler (smoke)", () => {
    const onToggle = vi.fn();
    renderToStaticMarkup(createElement(ReviewHubTrigger, { open: false, onToggle }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("B1 panel height is bounded by the space between the Editor pane's top and the footer", () => {
  it("never exceeds that space (minus a small gap) nor the 22rem ceiling, with a small floor", () => {
    expect(computeReviewHubMaxHeight(233)).toBe(225); // 320x568 expanded footer: space above footer - 8
    expect(computeReviewHubMaxHeight(220)).toBe(212);
    expect(computeReviewHubMaxHeight(500)).toBe(352); // tall: capped at 22rem
    expect(computeReviewHubMaxHeight(360)).toBe(352);
    expect(computeReviewHubMaxHeight(300.9)).toBe(292);
    expect(computeReviewHubMaxHeight(40)).toBe(72); // degenerate area: small usable floor, still scrolls
    expect(REVIEW_HUB_MAX_HEIGHT_PX).toBe(352);
  });

  it("applies the measured cap as an inline max-height, falling back to the CSS cap before it is measured", () => {
    const measured = renderToStaticMarkup(createElement(ReviewHubPanel, { open: true, onClose: noop, sections, maxHeightPx: 212 }));
    expect(measured).toContain('style="max-height:212px"');
    expect(panelMarkup(true)).not.toContain("style=");
  });

  it("measures the pane root and the footer wrapper and hands the cap to the panel", () => {
    expect(pane).toContain("useReviewHubDisclosure({ focusMode, keyboardActive }, paneRef)");
    expect(pane).toContain('<div ref={paneRef} className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-base">');
    expect(pane).toContain("maxHeightPx={reviewHubMaxHeightPx}");
    expect(hubHook).toContain("new ResizeObserver(");
    expect(hubHook).toContain("footer.getBoundingClientRect().top - pane.getBoundingClientRect().top");
    expect(hubHook).toContain("observer.observe(pane);");
    expect(hubHook).toContain("observer.observe(footer);");
    expect(hubHook).toContain("observer.disconnect()");
  });

  it("keeps the panel compact: no lead paragraph — heading, ✕, then one title + one summary line per tool", () => {
    const html = panelMarkup(true);
    expect(html.match(/<h2\b/g)).toHaveLength(1);
    expect(html.match(/<p\b/g)).toHaveLength(REVIEW_HUB_TOOLS.length * 2); // title + summary per tool, nothing else
    expect(html.indexOf("</h2>")).toBeLessThan(html.indexOf("<ul"));
    expect(html.slice(html.indexOf("</h2>"), html.indexOf("<ul"))).not.toMatch(/<p\b/);
  });
});

describe("B1 narrow-footer overflow contract (source; pixel proof is the real-browser E2E)", () => {
  it("the mobile one-line footer keeps clipping + a shrinkable count while the trigger cannot shrink", () => {
    const collapsedRow = paneBetween('data-editor-footer-collapsed=""', 'data-writing-check-surface=""');
    expect(collapsedRow).toContain("overflow-hidden");
    expect(collapsedRow).toContain("min-w-0 shrink truncate whitespace-nowrap tabular-nums");
    expect(hubView).toContain("inline-flex shrink-0 items-center whitespace-nowrap");
    // tighter padding in the one-line form so the existing count keeps its room at 320-360px
    expect(hubView).toContain('compact ? "gap-0 px-1" : "gap-1 px-2"');
    // the decorative ｜ dividers give way below 360px for the same reason
    expect(pane.match(/text-ink\/25 max-\[359px\]:hidden">｜/g)).toHaveLength(2);
  });

  it("the desktop trigger shares the syntax-hint row, NOT the controls row (770px density: no extra footer line)", () => {
    // Controls row = 作業カウンター + 現在の原稿文字数 only. A third item there wrapped in the ~335px split-screen Editor column.
    const controlsRow = paneBetween("data-editor-footer-controls", "<ReviewHubPanel");
    expect(controlsRow).not.toContain("<ReviewHubTrigger");
    const hintRow = paneBetween('data-editor-status-surfaces=""', "data-editor-footer-controls");
    expect(hintRow).toContain("<ReviewHubTrigger");
    expect(hintRow).toContain("<EditorSyntaxHelp />");
    expect(hintRow).toContain("flush");
    // the hint keeps the shrinking role (min-w-0 flex-1) so the trigger never forces the row wider
    expect(hintRow).toContain('data-ruby-tcy-status="" className="min-w-0 flex-1"');
    // "flush" trims only vertical padding so the ~20px hint row does not grow
    expect(hubView).toContain('flush ? "py-px" : "py-0.5"');
  });

  it("the expanded footer row still wraps instead of overflowing", () => {
    expect(paneBetween('data-editor-footer-controls', "<WorkSessionTracker")).toContain("flex-wrap");
    expect(paneBetween('data-editor-footer=""', "{/* TSP-RC-LATIN")).toContain("min-w-0");
  });
});
