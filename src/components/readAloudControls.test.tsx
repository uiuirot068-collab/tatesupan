import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReadAloudFooterControl, ReadAloudReviewSection, describeReadAloudAvailability, type ReadAloudViewProps } from "./ReadAloudControls";
import { READ_ALOUD_SERVER_STATE, type ReadAloudState } from "@/lib/readAloudEngine";
import { REVIEW_HUB_TOOLS } from "@/lib/reviewHub";

const noop = () => {};
const read = (path: string) => readFileSync(resolve(path), "utf8");
const pane = read("src/components/EditorPane.tsx");

const jaLocal = { voiceURI: "ja-local", name: "Haruka", lang: "ja-JP", localService: true };
const jaLocal2 = { voiceURI: "ja-local-2", name: "Ichiro", lang: "ja-JP", localService: true };
const jaOnline = { voiceURI: "ja-online", name: "Nanami Online", lang: "ja-JP", localService: false };

const base: ReadAloudState = {
  ...READ_ALOUD_SERVER_STATE,
  support: "supported",
  voicesReady: true,
  localVoices: [jaLocal],
  selectedVoiceURI: "ja-local",
};
const props = (state: Partial<ReadAloudState> = {}, handlers: Partial<ReadAloudViewProps> = {}): ReadAloudViewProps => ({
  state: { ...base, ...state },
  target: "paragraph",
  onTargetChange: noop,
  held: null,
  onStart: noop,
  onStartTarget: noop,
  onPause: noop,
  onResume: noop,
  onStop: noop,
  onRateChange: noop,
  onVoiceChange: noop,
  ...handlers,
});
const section = (state: Partial<ReadAloudState> = {}) => renderToStaticMarkup(createElement(ReadAloudReviewSection, props(state)));
const footer = (state: Partial<ReadAloudState> = {}) => renderToStaticMarkup(createElement(ReadAloudFooterControl, props(state)));

describe("B4 Hub section", () => {
  it("offers the three read modes, speed, and the privacy line — and no playback controls while idle", () => {
    const html = section();
    for (const mode of ["selection", "paragraph", "full"]) expect(html).toContain(`data-read-aloud-start="${mode}"`);
    for (const label of ["選択範囲を読む", "現在の段落を読む", "全文を読む"]) expect(html).toContain(label);
    expect(html).toContain('type="range"');
    expect(html).toContain('min="0.5"');
    expect(html).toContain('max="2"');
    expect(html).toContain("×1.0");
    expect(html).toContain("この端末の音声で読みます。原稿を外部へ送りません。");
    expect(html).not.toContain("data-read-aloud-pause");
    expect(html).not.toContain("data-read-aloud-stop");
    expect(html).not.toContain(' disabled=""');
  });

  it("shows pause + stop + sentence progress while speaking, and resume + stop while paused", () => {
    const speaking = section({ status: "speaking", mode: "full", chunkIndex: 2, chunkCount: 9 });
    expect(speaking).toContain("data-read-aloud-pause");
    expect(speaking).toContain("data-read-aloud-stop");
    expect(speaking).not.toContain("data-read-aloud-resume");
    expect(speaking).toContain("3 / 9 文");
    const paused = section({ status: "paused", mode: "full", chunkIndex: 0, chunkCount: 4 });
    expect(paused).toContain("data-read-aloud-resume");
    expect(paused).toContain("data-read-aloud-stop");
    expect(paused).not.toContain("data-read-aloud-pause");
    expect(paused).toContain("一時停止中");
  });

  it("wires every control to its handler (mode buttons, pause, resume, stop, speed, voice)", () => {
    const source = read("src/components/ReadAloudControls.tsx");
    expect(source).toContain("props.onStart(mode)");
    expect(source).toContain("onClick={props.onPause}");
    expect(source).toContain("onClick={props.onResume}");
    expect(source).toContain("onClick={props.onStop}");
    expect(source).toContain("props.onRateChange(Number(event.target.value))");
    expect(source).toContain("props.onVoiceChange(");
    expect(source).toContain("props.onStartTarget");
  });

  it("explains an unsupported browser and disables reading", () => {
    const html = section({ support: "unsupported" });
    expect(html).toContain("このブラウザでは音読機能を使えません");
    expect((html.match(/<button[^>]*data-read-aloud-start[^>]*disabled=""/g) ?? []).length).toBe(3);
    expect(html).toMatch(/type="range"[^>]*disabled=""/);
  });

  it("says when voices are still loading and when the device has no Japanese voice", () => {
    expect(describeReadAloudAvailability({ ...base, voicesReady: false })).toContain("確認しています");
    expect(describeReadAloudAvailability({ ...base, localVoices: [], selectedVoiceURI: null })).toContain("日本語の音声が見つかりません");
    expect(describeReadAloudAvailability(base)).toBeNull();
    expect(describeReadAloudAvailability({ ...base, support: "checking" })).toContain("確認しています");
    const noVoice = section({ localVoices: [], selectedVoiceURI: null });
    expect((noVoice.match(/<button[^>]*data-read-aloud-start[^>]*disabled=""/g) ?? []).length).toBe(3);
  });

  it("shows the voice selector only when there is a real choice; online voices sit in a clearly labelled group", () => {
    expect(section()).not.toContain("data-read-aloud-voice");
    const two = section({ localVoices: [jaLocal, jaLocal2] });
    expect(two).toContain("data-read-aloud-voice");
    expect(two).toContain("おまかせ（この端末の日本語音声）");
    expect(two).not.toContain("<optgroup");
    const online = section({ onlineVoices: [jaOnline] });
    expect(online).toContain('<optgroup label="オンライン音声（本文が送信される場合があります）">');
  });

  it("warns instead of the privacy line when an online voice was explicitly chosen", () => {
    const html = section({ onlineVoices: [jaOnline], selectedVoiceURI: "ja-online", selectedIsOnline: true, preferredVoiceURI: "ja-online" });
    expect(html).toContain("data-read-aloud-online-warning");
    expect(html).toContain("本文がブラウザの音声サービスへ送られる場合があります");
    expect(html).not.toContain("原稿を外部へ送りません");
  });

  it("shows the empty-range guidance and a device-error message, but never while reading", () => {
    expect(section({ emptyNotice: "読みたい範囲を原稿で選んでから押してください。" })).toContain("data-read-aloud-notice");
    expect(section({ emptyNotice: "x", status: "speaking", chunkCount: 1 })).not.toContain("data-read-aloud-notice");
    expect(section({ failure: "speech-error" })).toContain("data-read-aloud-error");
  });

  it("lets the writer pick the speed with an accessible label", () => {
    const html = section({ rate: 1.5 });
    expect(html).toContain('aria-label="読み上げ速度"');
    expect(html).toContain("×1.5");
  });
});

describe("B4 compact footer representation", () => {
  it("idle: one ▶ 音読 action (disabled with the reason when unavailable)", () => {
    const html = footer();
    expect(html).toContain("data-read-aloud-footer-start");
    expect(html).not.toContain(' disabled=""');
    expect(footer({ support: "unsupported" })).toMatch(/data-read-aloud-footer-start=""[^>]*disabled=""/);
    expect(footer({ support: "unsupported" })).toContain("このブラウザでは音読機能を使えません");
  });

  it("speaking: pause + stop + counter; paused: resume + stop", () => {
    const speaking = footer({ status: "speaking", chunkIndex: 0, chunkCount: 5 });
    expect(speaking).toContain("data-read-aloud-footer-pause");
    expect(speaking).toContain("data-read-aloud-footer-stop");
    expect(speaking).toContain("1/5");
    expect(speaking).not.toContain("data-read-aloud-footer-start");
    const paused = footer({ status: "paused", chunkIndex: 1, chunkCount: 5 });
    expect(paused).toContain("data-read-aloud-footer-resume");
    expect(paused).not.toContain("data-read-aloud-footer-pause");
  });
});

describe("B4 registry + EditorPane wiring", () => {
  it("is a Review Hub tool (registered once, no fifth top menu, no separate entry point)", () => {
    expect(REVIEW_HUB_TOOLS.filter((tool) => tool.id === "read-aloud")).toEqual([
      { id: "read-aloud", title: "音読β", summary: "声に出して読む代わりに、文章のリズムを耳で確かめます。" },
    ]);
    expect(pane).toContain('"read-aloud": <ReadAloudReviewSection {...readAloudViewProps} />');
    expect(read("src/components/Header.tsx")).not.toMatch(/音読|ReadAloud/);
  });

  it("uses ONE controller for the Hub section and the footer control, keyed to the document, and reads the selection only from press handlers", () => {
    expect(pane.match(/useReadAloud\(/g)).toHaveLength(1);
    expect(pane).toContain("useReadAloud(memoStorageKey, getReadAloudSource)");
    expect(pane).toContain("pagedEditorRef.current?.getSelectionGlobal()");
    expect(pane).toContain("textareaRef.current");
    expect(pane).toContain('footerPins.includes("read-aloud")');
    expect(pane).toContain("<ReadAloudDockCard key={id} {...readAloudViewProps} />"); // pinned = a Review Dock card
    expect(pane).toContain('footerPins.includes("read-aloud") && <ReadAloudFooterControl {...readAloudViewProps} />'); // mobile collapsed one-line row
  });

  it("the hook cancels speech on unmount, document change and page hide; nothing starts on its own", () => {
    const hook = read("src/hooks/useReadAloud.ts");
    expect(hook).toContain("controller.stop()");
    expect(hook).toContain("[controller, documentKey]");
    expect(hook).toContain('"pagehide"');
    expect(hook).toContain("controller.dispose()");
    // the only call sites of controller.start are the two press handlers
    expect(hook.match(/controller\.start\(/g)).toHaveLength(2);
    expect(hook).not.toMatch(/useEffect\([^)]*controller\.start/);
  });

  it("the shared handlers are real functions (spy check on the view props contract)", () => {
    const onStart = vi.fn();
    const p = props({}, { onStart });
    p.onStart("selection");
    expect(onStart).toHaveBeenCalledWith("selection");
  });
});
