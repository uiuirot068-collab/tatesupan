import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReviewHubFeedbackTab, { type ReviewHubSurveyAnswers } from "./ReviewHubFeedbackTab";
import { REVIEW_HUB_TOOLS, type ReviewHubToolId } from "@/lib/reviewHub";
import { buildReviewHubSurveyMessage, toggleReviewHubFavorite } from "@/lib/reviewHubFeedback";

/**
 * TSP-B3: the 見直し tab of the beta report modal. Node-only vitest (no jsdom):
 * the presentational tab is rendered with `renderToStaticMarkup`; modal /
 * editor / hook wiring is source-checked (same technique as reviewHub.test.tsx
 * and reportRestoration.test.ts). Real clicking, sending against a stubbed
 * transport, and 320/390/770/1280 layout are covered by
 * `tests/e2e/reviewHubFeedback.e2e.mjs` (real Chrome).
 */
const read = (path: string) => readFileSync(resolve(path), "utf8");
const codeOnly = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

const modal = read("src/components/BetaFeedbackModal.tsx");
const modalCode = codeOnly(modal);
const surveySend = () => {
  const start = modalCode.indexOf("const handleSendSurvey");
  expect(start).toBeGreaterThan(-1);
  return modalCode.slice(start, modalCode.indexOf("return (", start));
};
const tabSource = codeOnly(read("src/components/ReviewHubFeedbackTab.tsx"));
const modelSource = codeOnly(read("src/lib/reviewHubFeedback.ts"));
const editor = read("src/components/TategakiEditor.tsx");

const noop = () => {};
const empty: ReviewHubSurveyAnswers = { slotAnswer: null, favorites: [], note: "" };
const usageRows = buildReviewHubSurveyMessage({
  slotAnswer: null,
  favorites: [],
  note: "",
  footerTools: ["writing-check", "character-count"],
  usage: { hubOpens: 0, pinChanges: 0 },
}).usageRows;
const render = (answers: ReviewHubSurveyAnswers = empty) =>
  renderToStaticMarkup(createElement(ReviewHubFeedbackTab, { answers, onChange: noop, usageRows }));

describe("B3 見直し tab: structure", () => {
  it("shows Q1 as four single-choice options and Q2 as one checkbox per released Hub tool", () => {
    const html = render();
    expect(html.match(/type="radio"/g)).toHaveLength(4);
    for (const label of ["足りている", "もう1枠ほしい", "もっとほしい", "常時表示は不要"]) expect(html).toContain(label);
    expect(html).toContain("見直しのフッター表示は最大2枠で足りていますか？");
    expect(html.match(/type="checkbox"/g)).toHaveLength(REVIEW_HUB_TOOLS.length);
    for (const tool of REVIEW_HUB_TOOLS) expect(html).toContain(tool.title);
  });

  it("preselects nothing (an unanswered question stays unanswered) and does not steer to an answer", () => {
    const html = render();
    expect(html).not.toMatch(/checked/);
    expect(html).not.toMatch(/おすすめ|推奨|ちょうどよい/);
  });

  it("marks the selected Q1 answer and the selected Q2 tools", () => {
    const html = render({ slotAnswer: "more", favorites: ["character-count"], note: "" });
    expect(html.match(/checked=""/g)).toHaveLength(2);
    expect(html).toMatch(/value="more"[^>]*checked=""|checked=""[^>]*value="more"/);
  });

  it("caps Q2 at 2: a third selection is refused by the shared rule and unchecked options are disabled once two are chosen", () => {
    const [a, b, c] = ["writing-check", "character-count", "third-tool"] as unknown as ReviewHubToolId[];
    expect(toggleReviewHubFavorite([], a)).toEqual([a]);
    expect(toggleReviewHubFavorite([a], b)).toEqual([a, b]);
    expect(toggleReviewHubFavorite([a, b], c)).toEqual([a, b]); // refused
    expect(toggleReviewHubFavorite([a, b], a)).toEqual([b]); // un-checking always works
    expect(tabSource).toMatch(/disabled=\{!checked && favoritesFull\}/);
    expect(tabSource).toMatch(/toggleReviewHubFavorite\(answers\.favorites, choice\.id\)/);
  });

  it("has an optional free-text note with a length cap and the 'do not paste manuscript text' warning", () => {
    const html = render();
    expect(html).toContain("自由記述（任意）");
    expect(html).toMatch(/<textarea[^>]*maxLength="1000"|<textarea[^>]*maxlength="1000"/i);
    expect(html).toContain("原稿の文章・作品名・ファイル名は書かないでください");
  });

  it("lists, before sending, what travels with the answers (footer pins + the two session counters) — and nothing else", () => {
    const html = render();
    expect(html).toContain("回答と一緒に送られる情報");
    expect(html).toContain("フッターに表示中");
    expect(html).toContain("文章チェックβ → 文字数カウント（2/2）");
    expect(html).toContain("フッター表示を変えた回数");
    expect(html).toContain("見直しを開いた回数");
    expect(html.match(/<dt/g)).toHaveLength(3);
  });

  it("offers no unreleased tool, no image input and no file input", () => {
    const html = render();
    expect(html + tabSource + modelSource).not.toMatch(/描写語|修飾表現|音読|VOICEVOX|type="file"/);
  });

  it("is presentational: no storage, no network, no editor/manuscript access", () => {
    for (const source of [tabSource, modelSource]) {
      expect(source).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon/);
      expect(source).not.toMatch(/EditorPane|TategakiEditor|document\.|window\.|selection|getSelection|textarea\.value/i);
    }
  });
});

describe("B3 modal wiring: the existing report modal, one extra tab, the existing transport", () => {
  it("keeps 気になる事 as the default tab and keeps both existing tabs, adding 見直し as a third", () => {
    expect(modalCode).toMatch(/useState<TabId>\("feedback"\)/);
    expect(modalCode).toMatch(/type TabId = "feedback" \| "review" \| "review-hub"/);
    expect(modal).toContain("気になる事");
    expect(modalCode).toMatch(/tab === "review-hub"/);
    expect(modalCode).toContain("REVIEW_HUB_SURVEY_TAB_LABEL");
    expect(modalCode.match(/<TabButton/g)).toHaveLength(3);
  });

  it("sends the survey through submitBetaFeedback as a plain `feedback` submission with no images", () => {
    const send = surveySend();
    expect(send).toMatch(/type: "feedback" as const/);
    expect(send).toMatch(/message: survey\.message/);
    expect(send).toMatch(/images: \[\] as File\[\]/);
    expect(send).toMatch(/submitBetaFeedback\(submission,/);
    expect(send).toMatch(/turnstileToken/);
    expect(send).toMatch(/resetTurnstile\(\)/);
    // No second transport.
    expect(modalCode).not.toMatch(/fetch\(|sendBeacon|XMLHttpRequest/);
    expect(modalCode.match(/submitBetaFeedback\(/g)).toHaveLength(3); // feedback, review, 見直し
  });

  it("keeps Turnstile + double-send guard + failure keeps the answers", () => {
    const send = surveySend();
    expect(send).toMatch(/surveySendingRef\.current \|\| !canSendSurvey \|\| !turnstileReady \|\| !environment/);
    expect(send).toMatch(/setSurveyState\("error"\)/);
    expect(send.slice(send.indexOf("if (ok)"), send.indexOf("} else"))).toContain("setSurveyAnswers");
    expect(send.slice(send.indexOf("} else"))).not.toContain("setSurveyAnswers"); // failure path leaves answers untouched
  });

  it("reads only the browser-local footer pins and the in-memory counters — never the manuscript", () => {
    expect(modalCode).toMatch(/useReviewHubFooterPins\(\)/);
    expect(modalCode).toMatch(/useState\(getReviewHubSessionUsage\)/);
    // The look-arounds skip CSS tokens such as `max-content` / `contents`.
    expect(modalCode).not.toMatch(/EditorPane|TategakiEditor|(?<![-\w])content(?![-\w])|manuscript|documentId|selectedText/i);
    expect(modal).toMatch(/interface BetaFeedbackModalProps \{\s*onClose: \(\) => void;\s*\}/); // still no manuscript props
  });

  it("the modal remains user-opened only: closed by default, opened solely by the 報告 button's handler", () => {
    expect(editor).toMatch(/const \[isBetaFeedbackOpen, setIsBetaFeedbackOpen\] = useState\(false\)/);
    expect(editor.match(/setIsBetaFeedbackOpen\(true\)/g)).toHaveLength(1);
    expect(editor).toMatch(/onOpenBetaFeedback=\{BETA_FEEDBACK_ENABLED \? \(\) => setIsBetaFeedbackOpen\(true\) : undefined\}/);
  });

  it("B3 adds no entry to the top toolbar, the Review Hub panel or the footer (the 報告 button stays the one entry)", () => {
    const hubSources = ["src/components/ReviewHub.tsx", "src/hooks/useReviewHubDisclosure.ts", "src/lib/reviewHub.ts"].map((p) => codeOnly(read(p))).join("\n");
    expect(hubSources).not.toMatch(/BetaFeedback|報告|アンケート|Survey|足りている|もう1枠/);
    expect(codeOnly(read("src/components/ReviewHubFooterPinSettings.tsx"))).not.toMatch(/BetaFeedback|報告|アンケート|Survey/);
    expect(codeOnly(read("src/components/Header.tsx"))).not.toMatch(/見直しアンケート|ReviewHubFeedback/);
  });
});

describe("B3 counters are fed only by real Hub actions", () => {
  it("counts a Hub open only on a closed -> open toggle, never on close", () => {
    const hook = codeOnly(read("src/hooks/useReviewHubDisclosure.ts"));
    expect(hook).toMatch(/if \(!open\) recordReviewHubOpen\(\);\s*setRequestedOpen\(\(value\) => !value\);/);
    expect(hook.match(/recordReviewHubOpen\(\)/g)).toHaveLength(1);
  });

  it("counts a pin change only when the selection really changed", () => {
    const hook = codeOnly(read("src/hooks/useReviewHubFooterPins.ts"));
    expect(hook).toMatch(/if \(next\.join\(\) !== pins\.join\(\)\) recordFooterPinChange\(\);\s*persist\(next\);/);
    expect(hook.match(/recordFooterPinChange\(\)/g)).toHaveLength(1);
    expect(hook).toMatch(/togglePin[\s\S]*commit\(toggleReviewHubFooterTool/);
    expect(hook).toMatch(/movePin[\s\S]*commit\(moveReviewHubFooterTool/);
  });
});
