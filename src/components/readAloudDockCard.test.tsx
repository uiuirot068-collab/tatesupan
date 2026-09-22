import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReadAloudDockCard } from "./ReadAloudDockCard";
import { ReadAloudFooterControl, type ReadAloudViewProps } from "./ReadAloudControls";
import ReviewRail from "./ReviewRail";
import { READ_ALOUD_SERVER_STATE, type ReadAloudState } from "@/lib/readAloudEngine";
import { captureHeldSelection } from "@/lib/readAloudHeldSelection";
import { REVIEW_HUB_FOOTER_MAX } from "@/lib/reviewHubFooterPins";
import { REVIEW_RAIL_MIN_MAIN_WIDTH_PX, reviewSurfaceForMainWidth } from "@/hooks/useReviewSurface";

const noop = () => {};
const read = (path: string) => readFileSync(resolve(path), "utf8");
const pane = read("src/components/EditorPane.tsx");

const jaLocal = { voiceURI: "ja-local", name: "Haruka", lang: "ja-JP", localService: true };
const ready: ReadAloudState = { ...READ_ALOUD_SERVER_STATE, support: "supported", voicesReady: true, localVoices: [jaLocal], selectedVoiceURI: "ja-local" };
const HELD = captureHeldSelection("最初の文。読みたい範囲の文章です。", { start: 5, end: 16 }, "doc")!;
const props = (over: Partial<ReadAloudViewProps> = {}, state: Partial<ReadAloudState> = {}): ReadAloudViewProps => ({
  state: { ...ready, ...state },
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
  ...over,
});
const dock = (over: Partial<ReadAloudViewProps> = {}, state: Partial<ReadAloudState> = {}) => renderToStaticMarkup(createElement(ReadAloudDockCard, props(over, state)));

describe("B4 Review Dock card: the reading target is chosen in the footer", () => {
  it("shows 音読範囲 as a radiogroup of 選択範囲 / 現在の段落 / 全文 with the chosen one obvious", () => {
    for (const target of ["selection", "paragraph", "full"] as const) {
      const html = dock({ target, held: target === "selection" ? HELD : null });
      expect(html).toContain('role="radiogroup"');
      expect(html.match(/role="radio"/g)).toHaveLength(3);
      for (const label of ["選択範囲", "現在の段落", "全文"]) expect(html).toContain(label);
      expect(html.match(/aria-checked="true"/g), target).toHaveLength(1);
      expect(html).toMatch(new RegExp(`aria-checked="true"[^>]*data-read-aloud-target="${target}"`));
    }
  });

  it("wires each target button to onTargetChange and play to onStartTarget (no need to open 見直し)", () => {
    const source = read("src/components/ReadAloudDockCard.tsx");
    expect(source).toContain("props.onTargetChange(mode)");
    expect(source).toContain("onClick={props.onStartTarget}");
    expect(source).toContain("onClick={props.onPause}");
    expect(source).toContain("onClick={props.onResume}");
    expect(source).toContain("onClick={props.onStop}");
  });

  it("idle: one play button named after the target; playing: pause + stop + n / N; paused: resume + stop", () => {
    expect(dock({ target: "full" })).toContain("▶ 全文を読む");
    expect(dock({ target: "paragraph" })).toContain("▶ 現在の段落を読む");
    const speaking = dock({}, { status: "speaking", chunkIndex: 2, chunkCount: 9, mode: "full" });
    expect(speaking).toContain("data-read-aloud-card-pause");
    expect(speaking).toContain("data-read-aloud-card-stop");
    expect(speaking).toContain("読み上げ中 3 / 9");
    expect(speaking).not.toContain("data-read-aloud-card-play");
    const paused = dock({}, { status: "paused", chunkIndex: 0, chunkCount: 4, mode: "full" });
    expect(paused).toContain("data-read-aloud-card-resume");
    expect(paused).toContain("一時停止中 1 / 4");
    expect(dock()).toContain("待機中");
  });

  it("keeps showing the speed (adjusted in 見直し) so the writer knows what will play", () => {
    expect(dock({}, { rate: 1.5 })).toContain("速度 ×1.5");
  });
});

describe("B4 Review Dock card: stored selection is understandable and never phantom", () => {
  it("target 選択範囲 + a valid held selection -> 「選択範囲を保持中（N文字）」 and play is enabled", () => {
    const html = dock({ target: "selection", held: HELD });
    expect(html).toContain("data-read-aloud-card-held");
    expect(html).toContain("選択範囲を保持中（11文字）");
    expect(html).not.toMatch(/data-read-aloud-card-play=""[^>]*disabled=""/);
  });

  it("target 選択範囲 + nothing held -> explains that text must be selected first, NEVER says 保持中, play disabled", () => {
    const html = dock({ target: "selection", held: null });
    expect(html).toContain("data-read-aloud-card-need-selection");
    expect(html).toContain("本文の読みたい文字を選ぶと、選択範囲を読めます");
    expect(html).not.toContain("保持中");
    expect(html).toMatch(/data-read-aloud-card-play=""[^>]*disabled=""/);
  });

  it("other targets never mention a held selection even if one exists (it is only the 選択範囲 target's business)", () => {
    for (const target of ["paragraph", "full"] as const) {
      const html = dock({ target, held: HELD });
      expect(html).not.toContain("保持中");
      expect(html).not.toContain("data-read-aloud-card-held");
      expect(html).not.toMatch(/data-read-aloud-card-play=""[^>]*disabled=""/);
    }
  });

  it("unsupported browser / no on-device voice / empty-range notice / device error each get one clear line and disable play", () => {
    expect(dock({}, { support: "unsupported" })).toContain("このブラウザでは音読機能を使えません");
    expect(dock({}, { support: "unsupported" })).toMatch(/data-read-aloud-card-play=""[^>]*disabled=""/);
    expect(dock({}, { localVoices: [], selectedVoiceURI: null })).toContain("日本語の音声が見つかりません");
    expect(dock({}, { emptyNotice: "原稿がまだ空です。" })).toContain("原稿がまだ空です。");
    expect(dock({}, { failure: "speech-error" })).toContain("読み上げが途中で止まりました");
  });

  it("the collapsed mobile ▶ 音読 follows the chosen target and is disabled for 選択範囲 without a held selection", () => {
    const footer = (over: Partial<ReadAloudViewProps>) => renderToStaticMarkup(createElement(ReadAloudFooterControl, props(over)));
    expect(footer({ target: "full" })).toContain("音読（全文）");
    expect(footer({ target: "selection", held: null })).toMatch(/data-read-aloud-footer-start=""[^>]*disabled=""/);
    expect(footer({ target: "selection", held: HELD })).not.toMatch(/data-read-aloud-footer-start=""[^>]*disabled=""/);
  });
});

describe("B4 held-selection wiring in EditorPane (lifecycle)", () => {
  it("holds the selection on select / click / keyup and at the first pointer contact with the footer or Hub", () => {
    expect(pane).toContain("const held = useMemo(() => validHeldSelection(heldRaw, content, memoStorageKey), [heldRaw, content, memoStorageKey]);");
    expect(pane).toContain("refreshHeldSelection();\n      onCursorIndexChange?.(index);");
    expect(pane).toContain("onPointerDownCapture={refreshHeldSelection}");
  });

  it("validity is DERIVED from (document key, content): a switched document or edited text never shows a stale hold (no effect-driven phantom state)", () => {
    expect(pane).not.toMatch(/setHeldRaw\(null\)/);
    expect(read("src/lib/readAloudHeldSelection.ts")).toContain("held.docKey !== docKey");
    expect(read("src/lib/readAloudHeldSelection.ts")).toContain("content.slice(held.start, held.end) !== held.text");
  });

  it("paints a ghost highlight for the held selection only while 選択範囲 is the target, on both editor surfaces, under the other layers", () => {
    expect(pane).toContain('if (readAloud.target === "selection" && held) ranges.push({ start: held.start, end: held.end });');
    expect(pane).toContain('<DescriptionMarkOverlay variant="held"');
    expect(pane).toContain("ghostRanges={ghostRanges}");
    expect(read("src/components/PagedEditor.tsx")).toContain('variant="held"');
    expect(pane.indexOf('variant="held"')).toBeLessThan(pane.indexOf("<DescriptionMarkOverlay\n              textareaRef")); // ghost is drawn first (underneath)
  });

  it("the ghost is presentation only: pointer-events none, never in the manuscript, never in exports", () => {
    expect(read("src/components/DescriptionMarkOverlay.tsx")).toContain("pointer-events-none");
    for (const file of ["src/components/PreviewPane.tsx", "src/components/PageCard.tsx", "src/utils/exportCapture.ts"]) {
      expect(read(file)).not.toMatch(/tsp-held-selection|HeldSelection/);
    }
  });

  it("switching the target does not read, clear or move the selection; the document key change and unmount end the reading and the hold", () => {
    const hook = read("src/hooks/useReadAloud.ts");
    expect(hook).toContain("[controller, documentKey]"); // stop on document change
    expect(hook).toContain("controller.dispose()"); // unmount
    expect(hook).toContain("const [target, setTarget] = useState<ReadAloudMode>(\"paragraph\");");
  });
});

describe("Review Rail (desktop) — Revision 3", () => {
  it("is a dedicated sidebar shell: a portal mount point, a left border, comfortable width, its own scroll", () => {
    const html = renderToStaticMarkup(createElement(ReviewRail, { mountRef: noop }));
    expect(html).toContain('data-review-rail=""');
    expect(html).toContain('aria-label="見直しツール"');
    for (const cls of ["border-l", "w-[17rem]", "flex-col", "gap-3", "overflow-y-auto"]) expect(html).toContain(cls);
    // no horizontal scroll / wrap concern: the rail is a single vertical column, not a horizontal row
    expect(html).not.toMatch(/overflow-x|whitespace-nowrap|flex-wrap/);
  });

  it("cards keep a sane minimum width so they are never squeezed illegibly inside the rail", () => {
    expect(read("src/components/ReadAloudDockCard.tsx")).toContain("min-w-[15rem] flex-1");
    expect(read("src/components/DescriptionCheckControls.tsx")).toContain("min-w-[15rem] flex-1");
  });

  it("TategakiEditor mounts the rail beside the manuscript only on the measured 'rail' surface, with a pinned dock tool, and not in 集中モード", () => {
    const tge = read("src/components/TategakiEditor.tsx");
    expect(tge).toContain("useReviewSurface(mainRef)");
    expect(tge).toContain('reviewSurface === "rail" &&\n    !focusMode &&\n    (reviewFooterPins.includes("read-aloud") || reviewFooterPins.includes("description-check"))');
    expect(tge).toContain("<ReviewRail mountRef={setReviewRailNode} />");
  });

  it("exposes the measured surface on <main> regardless of pin state (a plain observability hook, not layout-affecting), so it can be told apart from 'is the rail mounted' (which also needs a pin)", () => {
    expect(read("src/components/TategakiEditor.tsx")).toContain("data-review-surface={reviewSurface}");
  });

  it("the rail breakpoint is measured (main element width), not a plain viewport media query, and matches the documented measurements", () => {
    expect(reviewSurfaceForMainWidth(REVIEW_RAIL_MIN_MAIN_WIDTH_PX - 1)).toBe("compact");
    expect(reviewSurfaceForMainWidth(REVIEW_RAIL_MIN_MAIN_WIDTH_PX)).toBe("rail");
    // measured real <main> widths (see the hook's own doc): 1024/1100 viewport -> compact, 1180/1280 -> rail
    expect(reviewSurfaceForMainWidth(952)).toBe("compact"); // 1024px viewport
    expect(reviewSurfaceForMainWidth(1028)).toBe("compact"); // 1100px viewport
    expect(reviewSurfaceForMainWidth(1108)).toBe("rail"); // 1180px viewport
    expect(reviewSurfaceForMainWidth(1208)).toBe("rail"); // 1280px viewport
  });

  it("EditorPane portals the pinned cards into the rail node -- costing the manuscript's HEIGHT nothing -- in pin order, up to the B2 maximum of two", () => {
    expect(REVIEW_HUB_FOOTER_MAX).toBe(2);
    expect(pane).toContain('reviewSurface === "rail" &&\n        reviewRailNode &&\n        !focusMode &&');
    expect(pane).toContain("createPortal(");
    expect(pane).toContain("footerPins.map((id) =>");
    expect(pane).toContain("reviewRailNode,");
  });
});

describe("Compact surface (phone + narrower desktop) mini bar — Revision 3", () => {
  it("shows a one-line mini control per pinned dock tool in the footer status row instead of a permanent card, only on the compact surface", () => {
    expect(pane).toContain('reviewSurface === "compact" && (footerPins.includes("read-aloud") || readAloud.state.status !== "idle")');
    expect(pane).toContain('reviewSurface === "compact" && footerPins.includes("description-check")');
  });

  it("keeps 音読β controllable even while UNPINNED, as long as it is actually speaking/paused (closing the sheet must not strand playback)", () => {
    expect(pane.match(/readAloud\.state\.status !== "idle"/g)?.length).toBeGreaterThanOrEqual(2); // expanded row + collapsed one-line row
  });

  it("the mobile collapsed one-line row (< md, always within the compact surface) carries the same rule", () => {
    expect(pane).toContain('{(footerPins.includes("read-aloud") || readAloud.state.status !== "idle") && <ReadAloudFooterControl {...readAloudViewProps} />}');
  });
});
