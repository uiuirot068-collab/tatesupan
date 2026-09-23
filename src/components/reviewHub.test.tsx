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
import WritingCheckBar from "./WritingCheckBar";

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
  "read-aloud": createElement("span", { "data-test-section": "ra" }, "ra"),
  "description-check": createElement("span", { "data-test-section": "dc" }, "dc"),
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

  it("uses the mobile footer trigger inline and the Desktop Review Bar trigger in Preview", () => {
    expect(pane).toContain("<ReviewHubTrigger");
    expect(pane).toContain('data-mobile-review-footer=""');
    expect(pane).toContain("<DesktopReviewBar");
    expect(pane).toContain("onToggleReviewHub={toggleReviewHubAll}");
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

  it("wires the four released Review sections in registry order", () => {
    const ids = ["writing-check", "character-count", "read-aloud", "description-check"];
    const positions = ids.map((id) => pane.indexOf(`"${id}": (`));
    for (const position of positions) expect(position).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("uses the Bottom Sheet contract on compact widths and the portalled panel on desktop", () => {
    expect(pane).toContain('sheet={reviewSurface === "compact"}');
    expect(pane).toContain('reviewSurface !== "desktop" && reviewHubPanelElement');
    expect(pane).toContain('reviewSurface === "desktop" &&');
    expect(pane).toContain("reviewHubPanel={reviewHubPanelElement}");
  });
});

describe("the Hub only exposes tools that exist today", () => {
  it("exposes exactly the four released Review tool ids in EditorPane", () => {
    const ids = ["writing-check", "character-count", "read-aloud", "description-check"];
    for (const id of ids) expect(pane).toContain(`"${id}"`);
    expect(pane).not.toContain('"emphasis-mark"');
    expect(pane).not.toContain("VOICEVOX");
  });

  it("shows no unimplemented tool (B6 傍点 / VOICEVOX / placeholders) anywhere the user can see (registry data + rendered UI + view/hook source)", () => {
    const unreleased = /VOICEVOX|傍点|coming soon|近日|準備中|Coming/i;
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
    // B2 adds exactly one real, wired フッターに表示 toggle per tool (data-review-hub-footer-pin-toggle); B1's controls are unchanged.
    const pinToggles = labels.filter((label) => /フッターに表示$/.test(label));
    const pinMoves = labels.filter((label) => /^[↑↓]$/.test(label)); // with both shown (default) each has one swap arrow
    expect(pinToggles).toHaveLength(REVIEW_HUB_TOOLS.length);
    expect(pinMoves.sort()).toEqual(["↑", "↓"]);
    expect(labels.filter((label) => !pinToggles.includes(label) && !pinMoves.includes(label)).sort()).toEqual(["⚙ 設定", "確認候補を見る", "✕"].sort());
  });
});

describe("B1 Hub keeps no favourites/slots and persists nothing itself (B2 footer display is a separate hook)", () => {
  it("has no favourite / slot controls or copy in the Hub", () => {
    const html = panelMarkup(true) + renderToStaticMarkup(createElement(ReviewHubTrigger, { open: true, onToggle: noop }));
    expect(html + hubView + hubHook + hubModel).not.toMatch(/favorite|favourite|お気に入り|slot|スロット/i);
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

describe("B2: 文章チェックβ footer strip follows フッターに表示, not its ON/OFF state", () => {
  const bar = (props: { enabled: boolean; showBar?: boolean; undoAvailable?: boolean }) =>
    renderToStaticMarkup(
      createElement(WritingCheckBar, {
        enabled: props.enabled,
        showBar: props.showBar,
        onToggle: noop,
        text: "",
        issues: [],
        onSelectIssue: noop,
        onFixIssue: noop,
        onIgnoreIssue: noop,
        onBulkFix: noop,
        onOpenSettings: noop,
        undoAvailable: props.undoAvailable ?? false,
        onUndo: noop,
      })
    );

  it("pinned (the default): the B1 strip is rendered — checkbox, 確認候補なし, ⚙ 設定, note", () => {
    const on = bar({ enabled: true });
    expect(on).toContain('type="checkbox"');
    expect(on).toContain("文章チェック β");
    expect(on).toContain("⚙ 設定");
    expect(bar({ enabled: false })).toContain('type="checkbox"'); // pinned + OFF: checkbox still there, unchecked
  });

  it("unpinned: nothing of 文章チェックβ remains in the footer, whether it is ON or OFF", () => {
    for (const enabled of [true, false]) {
      const html = bar({ enabled, showBar: false });
      expect(html).not.toContain('type="checkbox"');
      expect(html).not.toMatch(/文章チェック|チェックβ|設定|確認候補|波線/);
      expect(html).not.toContain("<button");
      expect(html).not.toContain("border-t"); // no empty bordered strip either
    }
  });

  it("unpinned only hides display: a fix's one-step 元に戻す is still offered while it is available", () => {
    expect(bar({ enabled: true, showBar: false, undoAvailable: true })).toContain("元に戻す");
    expect(bar({ enabled: false, showBar: false, undoAvailable: true })).not.toContain("元に戻す");
  });

  it("keeps writing-check display pin separate from writing-check ON/OFF in the final surfaces", () => {
    expect(pane).toContain('const writingCheckPinned = footerPins.includes("writing-check")');
    expect(pane).toContain("showBar={false}");
    expect(pane).toContain("writingCheckPinned={writingCheckPinned}");
    expect(pane).toContain('data-mobile-writing-check-pill=""');
    expect(pane).toContain("enabled={writingCheckEnabled}");
  });
});

describe("B2 Human QA: the Editor title action row stays ONE row at 768-905px (pixel proof: header-density E2E)", () => {
  const row = paneBetween('data-editor-action-row=""', "{focusMode && (");

  it("tightens gap/padding only in the tablet range and keeps every action", () => {
    // TSP-Review-UI (Revision 3): this range is a CONTAINER query (`@max-[905px]`) on #tsp-manuscript,
    // not a viewport media query -- it now also compacts when the Review Rail narrows the editor column
    // at an unchanged viewport width, not just in a narrow split-screen viewport. See TategakiEditor.tsx's
    // `@container` comment and reviewLayout.e2e.mjs's manuscriptHeightUnaffectedByRail.
    expect(row).toContain("md:gap-2 md:@max-[905px]:gap-1"); // desktop gap unchanged, tablet/rail-narrowed tighter
    for (const action of ["undo", "redo", "page-break", "replace"]) expect(row).toContain(`data-editor-action="${action}"`);
    expect((row.match(/md:px-3 md:py-1 md:@max-\[905px\]:px-2/g) ?? []).length).toBeGreaterThanOrEqual(2); // 改ページ挿入 / 置換
  });

  it("shows 元に戻す / やり直す as icon-only in that range, still labelled for assistive tech and tooltips", () => {
    // the label span keeps its own `hidden md:inline`; the tablet/rail-narrowed range hides it from the button (Round 5 contract untouched)
    expect(row.match(/md:@max-\[905px\]:\[&>span:not\(\[aria-hidden\]\)\]:hidden/g)).toHaveLength(2);
    expect(row).toContain('aria-label="元に戻す"');
    expect(row).toContain('aria-label="やり直す"');
    expect(row).toContain('title="元に戻す（Ctrl/Cmd+Z）"');
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

  it("routes Review writing-check actions to the existing result request and settings state", () => {
    expect(pane).toContain("const handleReviewHubShowResults = () => {");
    expect(pane).toContain("setWritingCheckResultsRequest((value) => value + 1);");
    expect(pane).toContain("const handleReviewHubOpenSettings = () => {");
    expect(pane).toContain("setSettingsOpen(true);");
    expect(pane).toContain("onShowResults={handleReviewHubShowResults}");
    expect(pane).toContain("onOpenSettings={handleReviewHubOpenSettings}");
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

describe("B1 作業カウンター uses the canonical count", () => {
  it("shows the value it is given, grouped like the footer's compact line", () => {
    expect(formatReviewHubCharacterCount(12843)).toBe("12,843文字");
    const html = renderToStaticMarkup(createElement(CharacterCountReviewSection, { count: 12843 }));
    expect(html).toContain("現在の原稿文字数");
    expect(html).toContain("12,843文字");
  });

  it("keeps raw manuscript character count in the title and the Review tool as WorkSessionTracker", () => {
    expect(pane).toContain('data-editor-character-count=""');
    expect(pane).toContain('{visualLength.toLocaleString("ja-JP")}');
    expect(pane).toContain('"character-count": (');
    expect(pane).toContain("<WorkSessionTracker");
    expect(pane).toContain('workSessionPinned={footerPins.includes("character-count")}');
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
    expect(pane).toContain("useReviewHubDisclosure({ focusMode, keyboardActive }, paneRef, [desktopBarWrapperRef]);");
    expect(hubHook).toContain("if (suppressed) setRequestedOpen(false);");
    expect(hubHook).toContain("isReviewHubVisible(requestedOpen, chrome)");
  });

  it("suppresses the compact Review footer with the existing focus-mode / keyboard gates", () => {
    expect(pane).toContain('{reviewSurface === "compact" && !focusMode && !keyboardActive && (');
    expect(pane).toContain('data-mobile-review-footer=""');
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

  it("closes on an outside press like the existing 文章チェックβ popover -- and now also honours extraContainmentRefs, so the Desktop Review Bar's portalled panel does not self-close on open", () => {
    expect(hubHook).toContain('document.addEventListener("pointerdown"');
    expect(hubHook).toContain("wrapperRef.current?.contains(target)");
    expect(hubHook).toContain("extraContainmentRefs?.some((ref) => ref.current?.contains(target))");
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
    expect(pane).toContain("useReviewHubDisclosure({ focusMode, keyboardActive }, paneRef, [desktopBarWrapperRef]);");
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
    expect(html.match(/<p\b/g)).toHaveLength(REVIEW_HUB_TOOLS.length * 2); // title + summary per tool, nothing else (B2's note is a header-row span)
    expect(html.indexOf("</h2>")).toBeLessThan(html.indexOf("<ul"));
    expect(html.slice(html.indexOf("</h2>"), html.indexOf("<ul"))).not.toMatch(/<p\b/);
  });
});

describe("B1 narrow-footer overflow contract (source; pixel proof is the real-browser E2E)", () => {
  it("keeps the mobile one-line Review footer bounded and non-growing", () => {
    const start = pane.indexOf('data-mobile-review-footer=""');
    expect(start).toBeGreaterThan(-1);
    const mobileFooter = pane.slice(start, start + 2200);
    expect(mobileFooter).toContain("overflow-hidden");
    expect(mobileFooter).toContain("<ReviewHubTrigger");
    expect(mobileFooter).toContain("compact");
  });

  it("keeps desktop Review chrome out of the Editor footer and portals it into Preview", () => {
    expect(pane).toContain("<DesktopReviewBar");
    expect(pane).toContain("createPortal(");
    expect(pane).toContain("reviewBarNode");
    expect(pane).toContain('reviewSurface === "desktop" &&');
  });

  it("has no legacy expanded desktop Review footer after the final Review-surface redesign", () => {
    expect(pane).not.toContain('data-editor-footer-controls=""');
    expect(pane).toContain('data-mobile-review-footer=""');
    expect(pane).toContain("<DesktopReviewBar");
  });
});
