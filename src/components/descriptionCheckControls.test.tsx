import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_CLICK_HINT,
  DESCRIPTION_LIST_LIMIT,
  DescriptionCheckDockCard,
  DescriptionCheckFooterPill,
  DescriptionCheckReviewSection,
  DescriptionMarkDetailCard,
  formatDescriptionCount,
  type DescriptionCheckViewProps,
  type DescriptionDockCardProps,
} from "./DescriptionCheckControls";
import type { DescriptionMark } from "@/lib/descriptionCheckManuscript";
import type { DescriptionCategorySet } from "@/lib/descriptionCheck";
import { REVIEW_HUB_TOOLS } from "@/lib/reviewHub";

const noop = () => {};
const read = (path: string) => readFileSync(resolve(path), "utf8");
const pane = read("src/components/EditorPane.tsx");
const paged = read("src/components/PagedEditor.tsx");
const hook = read("src/hooks/useDescriptionCheck.ts");
const A_ONLY: DescriptionCategorySet = { A: true, B: false, C: false };

const mark = (start: number, text: string, category: "A" | "B" | "C" = "A"): DescriptionMark => ({
  start,
  end: start + text.length,
  text,
  category,
  ruleId: `r-${category}`,
  label: category === "A" ? "形容表現候補" : category === "B" ? "連体修飾候補" : "連体修飾候補（時間）",
  reason: `理由${category}`,
});

const base: DescriptionCheckViewProps = {
  enabled: true,
  categories: A_ONLY,
  onToggle: noop,
  onToggleCategory: noop,
  marks: [mark(0, "美しい"), mark(10, "泣いている", "B")],
  current: true,
  activeMark: null,
  onJump: noop,
};
const section = (over: Partial<DescriptionCheckViewProps> = {}) =>
  renderToStaticMarkup(createElement(DescriptionCheckReviewSection, { ...base, ...over }));
const card = (over: Partial<DescriptionDockCardProps> = {}) =>
  renderToStaticMarkup(createElement(DescriptionCheckDockCard, { ...base, currentMark: null, onPrev: noop, onNext: noop, ...over }));

describe("B5 Hub section (full settings + explanation + full list)", () => {
  it("is OFF by default in the model: unchecked toggle, a plain 'nothing is analysed' note, no category boxes / list", () => {
    const html = section({ enabled: false, marks: [] });
    expect(html).toContain("描写語・修飾表現チェックβを使う");
    expect(html).not.toMatch(/data-description-check-toggle=""[^>]*checked/);
    expect(html).toContain("OFFのあいだは何も解析しません");
    expect(html).not.toContain("data-description-category-toggle");
    expect(html).not.toContain("data-description-list");
  });

  it("when ON shows three INDEPENDENT checkboxes A / B / C, each with its meaning; first enable = A only", () => {
    const html = section();
    expect(html.match(/type="checkbox"/g)).toHaveLength(4); // the feature toggle + A + B + C
    for (const category of ["A", "B", "C"]) expect(html).toContain(`data-description-category-toggle="${category}"`);
    expect(html).toContain("確認する表現");
    for (const summary of ["直接的な説明", "描写的な", "時間・場所・用途など広い修飾", "時間・場所・用途・識別など広い修飾"]) {
      if (summary === "時間・場所・用途など広い修飾") continue; // wording variants: only the canonical one is required
      expect(html).toContain(summary);
    }
    expect(html).toMatch(/data-description-category-toggle="A"[^>]*checked/);
    expect(html).not.toMatch(/data-description-category-toggle="B"[^>]*checked/);
    expect(html).not.toMatch(/data-description-category-toggle="C"[^>]*checked/);
    expect(html).not.toContain("role=\"radio\""); // the staged A / A+B / A+B+C control is gone
    expect(html).not.toContain("A+B+C");
    expect(html).toContain("候補 2件");
  });

  it.each([
    [{ A: false, B: true, C: false }, "B"],
    [{ A: false, B: false, C: true }, "C"],
    [{ A: true, B: false, C: true }, "A"],
    [{ A: false, B: true, C: true }, "B"],
    [{ A: true, B: true, C: true }, "A"],
  ] as [DescriptionCategorySet, string][])("renders the checked state of %j faithfully", (categories) => {
    const html = section({ categories });
    for (const category of ["A", "B", "C"] as const) {
      const checked = new RegExp(`data-description-category-toggle="${category}"[^>]*checked`).test(html);
      expect(checked, category).toBe(categories[category]);
    }
  });

  it("zero categories selected is a calm, explained state (not an error) and shows no count or list", () => {
    const html = section({ categories: { A: false, B: false, C: false }, marks: [] });
    expect(html).toContain("data-description-none-selected");
    expect(html).toContain("確認する種類が選ばれていません");
    expect(html).not.toContain("data-description-check-status");
    expect(html).not.toContain("data-description-empty");
    expect(html).not.toMatch(/エラー|失敗|できません/);
  });

  it("states that it is not a judgement, that keeping the phrase is fine, and that colour means the kind only", () => {
    const html = section();
    expect(html).toContain("文章の良し悪しを判定する機能ではありません");
    expect(html).toContain("残してよい表現も含まれます");
    expect(html).toContain("色は種類だけ");
  });

  it("tells the writer that a coloured phrase can be clicked / tapped to see the reason", () => {
    expect(DESCRIPTION_CLICK_HINT).toContain("クリック（タップ）");
    expect(DESCRIPTION_CLICK_HINT).toContain("理由");
    expect(DESCRIPTION_CLICK_HINT).not.toMatch(/ダブル|二回|2回/);
    expect(section()).toContain("data-description-hint");
  });

  it("lists candidates with a TEXT category tag (never colour alone) + reason, capped at a sample with an exact total", () => {
    const html = section();
    expect(html.match(/data-description-item=""/g)).toHaveLength(2);
    expect(html).toContain("A｜直接的な説明");
    expect(html).toContain("B｜描写的な修飾");
    expect(html).toContain("理由A");
    const many = Array.from({ length: DESCRIPTION_LIST_LIMIT + 25 }, (_, i) => mark(i * 10, "美しい"));
    const capped = section({ marks: many });
    expect(capped.match(/data-description-item=""/g)).toHaveLength(DESCRIPTION_LIST_LIMIT);
    expect(capped).toContain(`全${many.length}件`);
  });

  it("shows the category, phrase, reason and guidance of the candidate under the caret", () => {
    const html = section({ activeMark: mark(10, "泣いている", "B") });
    expect(html).toContain("data-description-active");
    expect(html).toContain("B｜描写的な修飾");
    expect(html).toContain("「泣いている」");
    expect(html).toContain("理由B");
    expect(html).toContain("そのまま残してください");
  });

  it("says so when the analysis lags the text, and when the chosen kinds find nothing", () => {
    expect(section({ current: false })).toContain("確認中…");
    expect(section({ marks: [] })).toContain("選んだ種類では候補が見つかりませんでした");
  });

  it("wires every control (feature toggle, each category, jump) to its handler in source", () => {
    const source = read("src/components/DescriptionCheckControls.tsx");
    expect(source).toContain("props.onToggle(event.target.checked)");
    expect(source).toContain("props.onToggleCategory(category)");
    expect(source).toContain("props.onJump(mark)");
    expect(source).toContain("props.onPrev");
    expect(source).toContain("props.onNext");
  });
});

describe("B5 pinned Review Dock card (daily operation + current candidate)", () => {
  it("OFF: a switch, the state, and a one-line explanation — nothing to operate", () => {
    const html = card({ enabled: false });
    expect(html).toContain('data-review-dock-card="description-check"');
    expect(html).toContain('role="switch"');
    expect(html).toMatch(/aria-checked="false"[^>]*data-description-card-toggle|data-description-card-toggle=""[^>]*aria-checked="false"|aria-checked="false"/);
    expect(html).toContain("OFF");
    expect(html).toContain("data-description-card-off");
    expect(html).not.toContain("data-description-card-category");
    expect(html).not.toContain("data-description-card-next");
  });

  it("ON: ON/OFF switch, A/B/C quick toggles (pressed state), the candidate count, previous / next and the position", () => {
    const html = card({ currentMark: null });
    expect(html).toContain("ON");
    for (const category of ["A", "B", "C"]) expect(html).toContain(`data-description-card-category="${category}"`);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1); // only A
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).toContain("候補 2件");
    expect(html).toContain("data-description-card-prev");
    expect(html).toContain("data-description-card-next");
    expect(html).toContain("– / 2");
  });

  it("shows the CURRENT candidate: the phrase, its A/B/C text tag, and a 理由を見る control (reason itself starts collapsed)", () => {
    const current = mark(10, "泣いている", "B");
    const html = card({ marks: [mark(0, "美しい"), current], currentMark: current, categories: { A: true, B: true, C: false } });
    expect(html).toContain("data-description-card-current");
    expect(html).toContain("「泣いている」");
    expect(html).toContain("B｜描写的な修飾");
    expect(html).toContain("2 / 2");
    expect(html).toContain("理由を見る");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("data-description-card-reason=");
    expect(read("src/components/DescriptionCheckControls.tsx")).toContain("data-description-card-reason");
    expect(read("src/components/DescriptionCheckControls.tsx")).toContain("setReasonOpen((open) => !open)");
  });

  it("with no candidate yet it says how to start (次へ / click a coloured phrase) instead of showing an empty box", () => {
    const html = card({ currentMark: null });
    expect(html).toContain("data-description-card-hint");
    expect(html).toContain("「次へ」で最初の候補へ移動します");
    expect(html).toContain("クリック（タップ）");
  });

  it("navigation is disabled with nothing to visit or while the analysis lags", () => {
    expect(card({ marks: [] })).toMatch(/data-description-card-next=""[^>]*disabled=""|disabled=""[^>]*data-description-card-next/);
    expect(card({ current: false })).toMatch(/data-description-card-prev=""[^>]*disabled=""|disabled=""[^>]*data-description-card-prev/);
    expect(card()).not.toMatch(/data-description-card-next=""[^>]*disabled=""/);
  });

  it("zero categories: shows 未選択 and the calm explanation, with no navigation", () => {
    const html = card({ categories: { A: false, B: false, C: false }, marks: [] });
    expect(html).toContain("未選択");
    expect(html).toContain("data-description-card-none");
    expect(html).not.toContain("data-description-card-next");
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3);
  });

  it("does not reproduce the Hub's full candidate list", () => {
    expect(card()).not.toContain("data-description-item");
    expect(card()).not.toContain("data-description-list");
  });
});

describe("B5 compact one-line pill and detail card", () => {
  it("formats `描写・修飾 N件` / `描写・修飾 OFF` / checking", () => {
    expect(formatDescriptionCount(false, true, 0)).toBe("描写・修飾 OFF");
    expect(formatDescriptionCount(true, true, 18)).toBe("描写・修飾 18件");
    expect(formatDescriptionCount(true, true, 12843)).toBe("描写・修飾 12,843件");
    expect(formatDescriptionCount(true, false, 18)).toBe("描写・修飾 確認中");
    const html = renderToStaticMarkup(createElement(DescriptionCheckFooterPill, { enabled: true, current: true, count: 18, onOpen: noop }));
    expect(html).toContain("描写・修飾 18件");
    expect(html).toContain("<button");
  });

  it("the detail card is a status region with a category TEXT tag, reason, guidance and a dismiss control", () => {
    const html = renderToStaticMarkup(createElement(DescriptionMarkDetailCard, { mark: mark(0, "美しい"), onDismiss: noop }));
    expect(html).toContain('role="status"');
    expect(html).toContain("A｜直接的な説明");
    expect(html).toContain("理由A");
    expect(html).toContain("そのまま残してください");
    expect(html).toContain('aria-label="候補の説明を閉じる"');
  });
});

describe("B5 marker colours: three tints of ONE yellow family, meaning category only", () => {
  const css = read("src/app/globals.css");
  const rule = (name: string) => css.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? "";

  it("has exactly A / B / C tints, all the same RGB (250, 204, 21), with strictly decreasing alpha A > B > C", () => {
    const alphas = ["a", "b", "c"].map((letter) => {
      const body = rule(`tsp-description-mark-${letter}`);
      const match = body.match(/rgba\(\s*250,\s*204,\s*21,\s*([0-9.]+)\s*\)/);
      expect(match, `tint ${letter}`).not.toBeNull();
      return Number(match![1]);
    });
    expect(alphas[0]).toBeGreaterThan(alphas[1]);
    expect(alphas[1]).toBeGreaterThan(alphas[2]);
    expect(alphas[2]).toBeGreaterThan(0.1); // still visible
    expect(css.match(/\.tsp-description-mark-[a-z0-9-]+\s*\{/g)).toHaveLength(3); // no fourth / severity class
  });

  it("uses no traffic-light colours anywhere in the B5 code (no red / green / severity semantics)", () => {
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    const code = strip(read("src/components/DescriptionCheckControls.tsx")) + strip(read("src/components/DescriptionMarkOverlay.tsx"));
    expect(code).not.toMatch(/bg-red|bg-green|text-red|text-green|severity|priority|danger/i);
    expect(code).not.toMatch(/#dc2626|#16a34a/);
  });

  it("every candidate view carries the category as text as well (dock card, Hub list, detail, card)", () => {
    const source = read("src/components/DescriptionCheckControls.tsx");
    expect(source.match(/describeDescriptionCategory\(/g)!.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain("data-description-badge");
  });
});

describe("B5 registry, EditorPane and PagedEditor wiring", () => {
  it("is Review Hub tool #4 (registry order), not a new top-menu item", () => {
    expect(REVIEW_HUB_TOOLS[3]).toMatchObject({ id: "description-check", title: "描写語・修飾表現チェックβ" });
    expect(read("src/components/Header.tsx")).not.toMatch(/描写|DescriptionCheck/);
    expect(pane).toContain('"description-check": (');
    expect(pane).toContain("<DescriptionCheckReviewSection");
    expect(pane).toContain("<DescriptionCheckDockCard");
  });

  it("pinned = a Review Dock card (not a status-row pill); the Hub keeps the full list; the mobile collapsed row keeps the compact pill", () => {
    expect(pane).toContain("<ReviewDock");
    expect(pane).toContain("onPrev={() => stepDescription(-1)}");
    expect(pane).toContain("onNext={() => stepDescription(1)}");
    expect(pane).toContain('footerPins.includes("description-check") && (\n            <DescriptionCheckFooterPill');
    expect(read("src/components/ReviewHubFooterPinnedTools.tsx")).not.toMatch(/description|readAloud|read-aloud/i);
  });

  it("markers render on BOTH editor surfaces (legacy textarea and the paged / WINDOWED editor)", () => {
    expect(pane).toContain("<DescriptionMarkOverlay");
    expect(pane).toContain("descriptionMarks={descriptionPagedProps}");
    expect(paged).toContain("<DescriptionMarkOverlay");
    expect(paged).toContain("marksForPage(descriptionMarks.marks, currentPage.start, currentPage.end)");
    expect(paged).toContain("descriptionMarks.analysisText === content"); // no stale offsets
  });

  it("is OFF by default, stored browser-locally with independent categories, and analyses nothing while OFF or with nothing selected", () => {
    expect(hook).toContain('"tatespun.descriptionCheck.v1"');
    expect(hook).toMatch(/createJsonLocalStorageHook<unknown>\(DESCRIPTION_CHECK_STORAGE_KEY, \{\s*enabled: false,\s*categories: DEFAULT_DESCRIPTION_CATEGORIES,/);
    expect(hook).toContain("if (!enabled || !anyCategory || isComposing()) return;");
    expect(hook).toContain("migrateDescriptionPrefs(prefs)");
    expect(hook).toContain("filterCandidatesByCategories(analysis.marks, categories)");
    expect(hook).not.toMatch(/DescriptionMode|setMode/);
    expect(pane).toContain("if (descriptionEnabled) setDescriptionCaret(index);");
  });

  it("is debounced, cached and yields to the browser; IME composition defers it", () => {
    expect(hook).toContain("DESCRIPTION_CHECK_DEBOUNCE_MS");
    expect(hook).toContain("analyzeDescriptionSourceAsync(content, { cache,");
    expect(hook).toContain("isCancelled: () => cancelled");
    expect(pane).toContain("useDescriptionCheck(content, () => isComposingRef.current, recheckNonce)");
    expect(pane).toContain("setRecheckNonce((value) => value + 1)");
  });

  it("the floating detail card only serves the UNPINNED tool (a pinned dock card shows the same detail) and hides while the Hub is open, in 集中モード and with the keyboard", () => {
    expect(pane).toContain('!footerPins.includes("description-check") && descriptionActiveMark !== descriptionDismissed && !reviewHubOpen && !focusMode && !keyboardActive');
  });

  it("a single click / tap reports the caret (no double-click): click, select, keyup handlers all feed the detail", () => {
    expect(pane).toContain("onSelect={reportCursorIndex}");
    expect(pane).toContain("onClick={reportCursorIndex}");
    expect(pane).toContain("onKeyUp={reportCursorIndex}");
    expect(paged).toContain("onSelect={handleSelect}");
    expect(paged).toContain("onClick={handleSelect}");
    expect(pane + paged + read("src/components/DescriptionCheckControls.tsx")).not.toMatch(/onDoubleClick|dblclick/i);
  });
});

describe("B5 markers never reach Preview / JPG / PDF (editor-only decoration)", () => {
  it("no preview, export or typesetting-v2 module references the description-check code or its highlight classes", () => {
    const targets = [
      "src/components/PreviewPane.tsx",
      "src/components/PageCard.tsx",
      "src/utils/exportCapture.ts",
      "src/lib/v2BrowserExport.ts",
      "src/lib/txtTransfer.ts",
    ];
    for (const file of targets) {
      expect(read(file), file).not.toMatch(/descriptionCheck|DescriptionMark|tsp-description-mark|tsp-held-selection/);
    }
  });

  it("the highlight lives only in the editor overlay, and the manuscript string is never modified by the analysis", () => {
    expect(hook).not.toMatch(/onContentChange|setContent/);
    expect(read("src/lib/descriptionCheckManuscript.ts")).not.toMatch(/\.replace\(|onContentChange/);
  });

  it("B5 markers, the held-selection ghost and 文章チェックβ underlines are independent layers (no shared state, distinct classes)", () => {
    const css = read("src/app/globals.css");
    for (const cls of ["tsp-description-mark-a", "tsp-held-selection", "tsp-writing-wavy", "tsp-writing-wavy-review"]) expect(css).toContain(`.${cls}`);
    expect(read("src/components/WritingCheckOverlay.tsx")).not.toMatch(/description|held/i);
  });
});
