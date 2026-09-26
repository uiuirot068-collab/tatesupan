import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { findPageIndexForCharIndex, insertPageBreakMarker, tokenizeTategaki } from "../tategaki";
import { composeV2Layout } from "./composeV2Document";
import { buildV2PreviewPageModel } from "./previewPageModel";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";

// Phase 5 — the canonical V2 Preview page model. Deterministic (fake
// measurement: one em per character).

const MEASUREMENT = createFakeMeasurementProvider();
const settings = (charsPerLine: number, linesPerColumn: number, extra: Partial<PageSettings> = {}): PageSettings => ({
  ...DEFAULT_PAGE_SETTINGS,
  charsPerLine,
  linesPerColumn,
  columnCount: 1,
  ...extra,
});
const model = (content: string, pageSettings: PageSettings) =>
  buildV2PreviewPageModel(composeV2Layout({ title: "T", content, settings: pageSettings, measurement: MEASUREMENT }), content);

/** The characters a page shows, straight from the model's raw range (notation stripped). */
const visible = (content: string, range: { start: number; end: number }) =>
  tokenizeTategaki(content.slice(range.start, range.end))
    .map((t) => (t.type === "text" || t.type === "tcy" ? t.value : t.type === "ruby" ? t.base : t.type === "image" ? "▣" : ""))
    .join("")
    .replace(/\n/g, "");

describe("V2 Preview page model: identity and order", () => {
  const withColophon = (mode: PageSettings["colophon"]["pagePosition"]) =>
    settings(20, 6, { colophon: { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true, pagePosition: mode } });
  // 4 short paragraphs, one per page (【改ページ】 closes each page).
  const text = Array.from({ length: 4 }, (_, i) => `「第${i}頁の本文」`).join("\n【改ページ】\n");

  it("colophon at the end: body 1..4 then colophon, physical numbers follow publication order", () => {
    const m = model(text, withColophon({ mode: "end" }));
    expect(m.pages.map((p) => `${p.kind}:${p.physicalPageNumber}:${p.bodyPageNumber ?? "-"}`)).toEqual([
      "body:1:1", "body:2:2", "body:3:3", "body:4:4", "colophon:5:-",
    ]);
    expect(m.bodyPageCount).toBe(4);
  });

  it("colophon mid-book: body numbering is NOT shifted, physical numbering is", () => {
    const m = model(text, withColophon({ mode: "after-body-page", afterBodyPage: 1 }));
    expect(m.pages.map((p) => `${p.kind}:${p.physicalPageNumber}:${p.bodyPageNumber ?? "-"}`)).toEqual([
      "body:1:1", "colophon:2:-", "body:3:2", "body:4:3", "body:5:4",
    ]);
    expect(m.bodyPages.map((p) => p.bodyIndex)).toEqual([0, 1, 2, 3]);
  });

  it("an empty manuscript keeps one blank Preview card but reports zero canonical body pages", () => {
    const m = model("", settings(10, 5));
    expect(m.bodyPageCount).toBe(0);
    expect(m.listLength).toBe(1);
    expect(m.overlayPages).toHaveLength(1);
  });
});

describe("V2 Preview page model: raw source ranges", () => {
  const content = [
    "「漢字の｜ルビ《るび》と第12話の縦中横、",
    "《《傍点》》と――ダッシュ、……三点リーダー。",
    "【改ページ】",
    "改ページ後の本文です。",
    "【IMG:pic:30:20:center】",
    "画像の後の本文。",
  ].join("\n");
  const m = model(content, settings(8, 3));

  it("pages cover the manuscript in order without overlap; gaps hold only notation (page breaks / newlines)", () => {
    const ranges = m.bodySourceRanges;
    for (let i = 1; i < ranges.length; i++) expect(ranges[i].start).toBeGreaterThanOrEqual(ranges[i - 1].end);
    const gaps = ranges.slice(1).map((r, i) => content.slice(ranges[i].end, r.start));
    expect(gaps.join("").replace(/【改ページ】|\n/g, "")).toBe("");
    expect(ranges[0].start).toBe(0);
  });

  it("each page's source slice shows exactly the text Core placed on it (ruby / TCY / bouten / dash / ellipsis / image)", () => {
    const joined = m.bodySourceRanges.map((r) => visible(content, r)).join("");
    expect(joined).toBe(visible(content, { start: 0, end: content.length }));
    expect(joined).toContain("ルビ");
    expect(joined).toContain("傍点");
    expect(joined).toContain("――");
    expect(joined).toContain("……");
  });

  it("傍点 markers stay inside the page that shows the emphasised text", () => {
    const owner = m.bodySourceRanges.find((r) => content.slice(r.start, r.end).includes("傍点"))!;
    const slice = content.slice(owner.start, owner.end);
    expect(slice.split("《《").length).toBe(slice.split("》》").length);
  });

  it("caret → page: every character offset maps to the page that renders it", () => {
    const probes = ["漢", "ル", "1", "傍", "―", "…", "改ページ後", "画像の後"];
    for (const probe of probes) {
      const at = content.indexOf(probe);
      const page = findPageIndexForCharIndex(m.bodySourceRanges, at);
      expect(content.slice(m.bodySourceRanges[page].start, m.bodySourceRanges[page].end)).toContain(probe);
    }
  });

  it("a manual page break starts a new page", () => {
    const after = findPageIndexForCharIndex(m.bodySourceRanges, content.indexOf("改ページ後"));
    const before = findPageIndexForCharIndex(m.bodySourceRanges, content.indexOf("三点"));
    expect(after).toBeGreaterThan(before);
    expect(content.slice(m.bodySourceRanges[after].start).startsWith("改ページ後")).toBe(true);
  });

  it("the page owning an image lists its id and carries its IMG token for the overlay", () => {
    const owner = m.imagePageIndicesById.get("pic")!;
    expect(owner).toHaveLength(1);
    expect(m.overlayPages[owner[0]].tokens).toEqual([{ type: "image", id: "pic", widthMm: 30, heightMm: 20, position: "center" }]);
    expect(content.slice(m.bodySourceRanges[owner[0]].start, m.bodySourceRanges[owner[0]].end)).toContain("【IMG:pic:");
  });
});

describe("image boundary ownership follows V2 flow (Phase 5 decision)", () => {
  it("an image right after a full page belongs to the NEXT page (not the LEGACY previous page)", () => {
    // 2 lines × 4 chars per page: page 1 is full after two 「-led lines (no 一字下げ), then the image.
    const content = "「あいう\n「かきく\n【IMG:edge:20:10:center】\nさしす";
    const m = model(content, settings(4, 2));
    const owner = m.imagePageIndicesById.get("edge")!;
    expect(owner).toEqual([1]);
    expect(m.bodyPages[1].imageIds).toEqual(["edge"]);
    expect(m.bodyPages[0].imageIds).toEqual([]);
  });

  it("an image that fits stays on the current page", () => {
    const m = model("あいう\n【IMG:fits:20:10:center】\nかきく", settings(4, 4));
    expect(m.imagePageIndicesById.get("fits")).toEqual([0]);
  });
});

describe("page reorder on V2 ranges preserves every character", () => {
  it("swapping two pages via their source ranges keeps all text and notation", () => {
    const content = "第一頁の本文。\n【改ページ】\n第二頁の｜本文《ほんぶん》。\n【改ページ】\n第三頁の《《本文》》。";
    const m = model(content, settings(10, 5));
    expect(m.bodyPageCount).toBe(3);
    const [a, b, c] = m.bodySourceRanges;
    // same algorithm as PreviewPane.buildReorderedContent: runs of originally-adjacent pages copied verbatim, a break marker at new seams
    const segments = [content.slice(b.start, b.end), content.slice(a.start, a.end), content.slice(c.start, c.end)];
    const rebuilt = segments.reduce((out, segment, i) => (i === 0 ? segment : out + insertPageBreakMarker(out, segment) + segment), "");
    const remodel = model(rebuilt, settings(10, 5));
    expect(remodel.bodyPages.map((p) => visible(rebuilt, p.sourceRange!))).toEqual(["第二頁の本文。", "第一頁の本文。", "第三頁の本文。"]);
    expect(rebuilt).toContain("｜本文《ほんぶん》");
    expect(rebuilt).toContain("《《本文》》");
  });
});
