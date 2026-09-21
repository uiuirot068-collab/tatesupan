import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DESCRIPTION_LIST_LIMIT,
  DescriptionCheckFooterPill,
  DescriptionCheckReviewSection,
  DescriptionMarkDetailCard,
  formatDescriptionCount,
  type DescriptionCheckViewProps,
} from "./DescriptionCheckControls";
import type { DescriptionMark } from "@/lib/descriptionCheckManuscript";
import { REVIEW_HUB_TOOLS } from "@/lib/reviewHub";

const noop = () => {};
const read = (path: string) => readFileSync(resolve(path), "utf8");
const pane = read("src/components/EditorPane.tsx");
const paged = read("src/components/PagedEditor.tsx");
const hook = read("src/hooks/useDescriptionCheck.ts");

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
  mode: "A",
  onToggle: noop,
  onModeChange: noop,
  marks: [mark(0, "美しい"), mark(10, "泣いている", "B")],
  current: true,
  activeMark: null,
  onJump: noop,
};
const section = (over: Partial<DescriptionCheckViewProps> = {}) =>
  renderToStaticMarkup(createElement(DescriptionCheckReviewSection, { ...base, ...over }));

describe("B5 Hub section", () => {
  it("is OFF by default in the model: unchecked toggle, a plain 'nothing is analysed' note, no modes / list", () => {
    const html = section({ enabled: false, marks: [] });
    expect(html).toContain("描写語・修飾表現チェックβを使う");
    expect(html).not.toMatch(/data-description-check-toggle=""[^>]*checked/);
    expect(html).toContain("OFFのあいだは何も解析しません");
    expect(html).not.toContain("radiogroup");
    expect(html).not.toContain("data-description-list");
  });

  it("when ON shows the three detection breadths A / A+B / A+B+C, with A selected first, and the candidate count", () => {
    const html = section();
    expect(html).toMatch(/data-description-check-toggle=""[^>]*checked/);
    expect(html.match(/role="radio"/g)).toHaveLength(3);
    for (const mode of ["A", "AB", "ABC"]) expect(html).toContain(`data-description-mode="${mode}"`);
    expect(html).toMatch(/aria-checked="true"[^>]*data-description-mode="A"/);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(1);
    expect(html).toContain(">A+B+C<");
    expect(html).toContain("候補 2件");
    expect(html).toContain("いちばん絞って確認");
  });

  it("shows the mode summary for the selected breadth and states that A/B/C are breadth, not quality", () => {
    expect(section({ mode: "ABC" })).toContain("広く観察");
    expect(section({ mode: "AB" })).toContain("少し広げる");
    const html = section();
    expect(html).toContain("良し悪しではなく");
    expect(html).toContain("見直し候補");
    expect(html).toContain("残してよい表現もあります");
  });

  it("lists candidates (category tag + reason, click to jump), capped at a sample with an exact total", () => {
    const html = section();
    expect(html).toContain("data-description-list");
    expect(html.match(/data-description-item=""/g)).toHaveLength(2);
    expect(html).toContain("A｜形容表現候補");
    expect(html).toContain("B｜連体修飾候補");
    expect(html).toContain("理由A");
    const many = Array.from({ length: DESCRIPTION_LIST_LIMIT + 25 }, (_, i) => mark(i * 10, "美しい"));
    const capped = section({ marks: many });
    expect(capped.match(/data-description-item=""/g)).toHaveLength(DESCRIPTION_LIST_LIMIT);
    expect(capped).toContain(`全${many.length}件`);
  });

  it("shows the category and reason of the candidate under the caret, with the 'keeping it may be right' guidance", () => {
    const html = section({ activeMark: mark(10, "泣いている", "B") });
    expect(html).toContain("data-description-active");
    expect(html).toContain("B｜連体修飾候補");
    expect(html).toContain("「泣いている」");
    expect(html).toContain("理由B");
    expect(html).toContain("そのまま残してください");
    expect(html).toMatch(/情景・動作・感覚・たとえ/);
  });

  it("says so when the analysis lags the text, and when a breadth finds nothing", () => {
    expect(section({ current: false })).toContain("確認中…");
    expect(section({ marks: [] })).toContain("候補が見つかりませんでした");
  });

  it("wires every control (toggle, modes, jump) to its handler in source", () => {
    const source = read("src/components/DescriptionCheckControls.tsx");
    expect(source).toContain("props.onToggle(event.target.checked)");
    expect(source).toContain("props.onModeChange(option)");
    expect(source).toContain("props.onJump(mark)");
  });
});

describe("B5 compact footer representation and detail card", () => {
  it("formats `描写・修飾 N件` / `描写・修飾 OFF` / checking", () => {
    expect(formatDescriptionCount(false, true, 0)).toBe("描写・修飾 OFF");
    expect(formatDescriptionCount(true, true, 18)).toBe("描写・修飾 18件");
    expect(formatDescriptionCount(true, true, 12843)).toBe("描写・修飾 12,843件");
    expect(formatDescriptionCount(true, false, 18)).toBe("描写・修飾 確認中");
    const html = renderToStaticMarkup(createElement(DescriptionCheckFooterPill, { enabled: true, current: true, count: 18, onOpen: noop }));
    expect(html).toContain("描写・修飾 18件");
    expect(html).toContain("data-description-check-footer");
    expect(html).toContain("<button");
  });

  it("the detail card is a status region with category, reason, guidance and a dismiss control", () => {
    const html = renderToStaticMarkup(createElement(DescriptionMarkDetailCard, { mark: mark(0, "美しい"), onDismiss: noop }));
    expect(html).toContain('role="status"');
    expect(html).toContain("A｜形容表現候補");
    expect(html).toContain("理由A");
    expect(html).toContain("そのまま残してください");
    expect(html).toContain('aria-label="候補の説明を閉じる"');
  });

  it("uses one yellow family for every category: no per-category colour class exists", () => {
    const css = read("src/app/globals.css");
    expect(css).toContain(".tsp-description-mark");
    expect(css.match(/\.tsp-description-mark[\w-]*\s*\{/g)).toHaveLength(1); // a single class; nothing like -a / -b / -c
    const overlay = read("src/components/DescriptionMarkOverlay.tsx");
    expect(overlay.match(/tsp-description-mark/g)).toHaveLength(1);
    const overlayCode = overlay.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
    expect(overlayCode).not.toMatch(/category|severity/);
  });
});

describe("B5 registry, EditorPane and PagedEditor wiring", () => {
  it("is Review Hub tool #4 (registry order), not a new top-menu item", () => {
    expect(REVIEW_HUB_TOOLS[3]).toMatchObject({ id: "description-check", title: "描写語・修飾表現チェックβ" });
    expect(read("src/components/Header.tsx")).not.toMatch(/描写|DescriptionCheck/);
    expect(pane).toContain('"description-check": (');
    expect(pane).toContain("<DescriptionCheckReviewSection");
    expect(pane).toContain('footerPins.includes("description-check")');
    expect(pane).toContain("descriptionCheck={");
  });

  it("markers render on BOTH editor surfaces (legacy textarea and the paged / WINDOWED editor)", () => {
    expect(pane).toContain("<DescriptionMarkOverlay");
    expect(pane).toContain("descriptionMarks={descriptionPagedProps}");
    expect(paged).toContain("<DescriptionMarkOverlay");
    expect(paged).toContain("marksForPage(descriptionMarks.marks, currentPage.start, currentPage.end)");
    // drawn only while the analysis matches the exact text (no stale offsets), like 文章チェックβ
    expect(paged).toContain("descriptionMarks.analysisText === content");
  });

  it("is OFF by default, stored browser-locally, and analyses nothing while OFF", () => {
    expect(hook).toContain('"tatespun.descriptionCheck.v1"');
    expect(hook).toMatch(/createJsonLocalStorageHook<StoredPrefs>\(DESCRIPTION_CHECK_STORAGE_KEY, \{\s*enabled: false,\s*mode: DEFAULT_DESCRIPTION_MODE,/);
    expect(hook).toContain("if (!enabled || isComposing()) return;"); // OFF → the effect returns before scheduling anything
    expect(hook).toContain("const enabled = prefs?.enabled === true;");
    // caret tracking (extra renders) is also gated on the flag
    expect(pane).toContain("if (descriptionEnabled) setDescriptionCaret(index);");
  });

  it("is debounced, cached and yields to the browser; IME composition defers it", () => {
    expect(hook).toContain("DESCRIPTION_CHECK_DEBOUNCE_MS");
    expect(hook).toContain("analyzeDescriptionSourceAsync(content, { cache,");
    expect(hook).toContain("isCancelled: () => cancelled");
    expect(pane).toContain("useDescriptionCheck(content, () => isComposingRef.current, recheckNonce)");
    expect(pane).toContain("setRecheckNonce((value) => value + 1)"); // bumped on compositionend
  });

  it("the detail card hides while the Hub is open (the Hub shows the same detail) and in 集中モード / keyboard-open", () => {
    expect(pane).toContain("!reviewHubOpen && !focusMode && !keyboardActive && (");
    expect(pane).toContain("descriptionActiveMark !== descriptionDismissed");
  });
});

describe("B5 markers never reach Preview / JPG / PDF (editor-only decoration)", () => {
  it("no preview, export or typesetting-v2 module references the description-check code or its highlight class", () => {
    const targets = [
      "src/components/PreviewPane.tsx",
      "src/components/PageCard.tsx",
      "src/utils/exportCapture.ts",
      "src/lib/v2BrowserExport.ts",
      "src/lib/txtTransfer.ts",
    ];
    for (const file of targets) {
      expect(read(file), file).not.toMatch(/descriptionCheck|DescriptionMark|tsp-description-mark/);
    }
  });

  it("the highlight lives only in the editor overlay, and the manuscript string is never modified by the analysis", () => {
    const hookSource = read("src/hooks/useDescriptionCheck.ts");
    expect(hookSource).not.toMatch(/onContentChange|setContent/);
    expect(read("src/lib/descriptionCheckManuscript.ts")).not.toMatch(/\.replace\(|onContentChange/);
  });
});
