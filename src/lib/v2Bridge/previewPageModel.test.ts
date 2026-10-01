import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, type PageSettings } from "../pageLayout";
import { findPageIndexForCharIndex, insertPageBreakMarker, tokenizeTategaki } from "../tategaki";
import { composeV2Layout } from "./composeV2Document";
import { buildV2PreviewDocument } from "./buildV2PreviewDocument";
import { buildV2PreviewPageModel, type V2PreviewPage } from "./previewPageModel";
import { colophonPhysicalIndex, physicalPageNumber } from "./pageIndex";
import type { TocPosition, TocSettings } from "../tocSettings";
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

describe("Phase 11: work-owned TOC (settings.toc) — composition-only synthetic pages", () => {
  const chapters = ["第一章", "第二章", "第三章"];
  const content = chapters.map((title) => `# ${title}\n「${title}の本文です。」`).join("\n【改ページ】\n");
  const tocOff = (): TocSettings => ({ enabled: false, items: [], position: { mode: "start" }, leader: "dots", updatedAt: null });
  const tocAt = (position: TocPosition): TocSettings => ({
    enabled: true,
    items: chapters.map((title, index) => ({ title, pageNumber: index + 2 })),
    position,
    leader: "dots",
    updatedAt: 1,
  });
  const tocOn = (extra: Partial<PageSettings> = {}, position: TocPosition = { mode: "start" }): PageSettings =>
    settings(20, 10, { toc: tocAt(position), ...extra });
  const layoutOf = (pageSettings: PageSettings) =>
    composeV2Layout({ title: "T", content, settings: pageSettings, measurement: MEASUREMENT });
  const summary = (pages: V2PreviewPage[]) => pages.map((p) => `${p.kind}:${p.physicalPageNumber}:${p.bodyPageNumber ?? "-"}`);

  it("old works (no toc field) and a disabled/deleted TOC compose exactly like before", () => {
    const legacy: PageSettings = { ...settings(20, 10) };
    delete (legacy as { toc?: unknown }).toc;
    const base = model(content, legacy);
    expect(base.tocPages).toEqual([]);
    expect(model(content, settings(20, 10, { toc: tocOff() }))).toEqual(base);
    // 削除 = settings only: the same body content composes the same model.
    expect(model(content, { ...tocOn(), toc: tocOff() })).toEqual(base);
  });

  it("本文の前: TOC pages lead; Editor body pages, ranges and numbering stay body-only", () => {
    const base = model(content, settings(20, 10));
    const m = model(content, tocOn());
    const tocCount = m.tocPages.length;
    expect(tocCount).toBeGreaterThanOrEqual(1);
    expect(m.pages.slice(0, tocCount).every((page) => page.kind === "toc")).toBe(true);
    expect(m.pages.slice(tocCount).some((page) => page.kind === "toc")).toBe(false);
    expect(m.bodyPageCount).toBe(base.bodyPageCount);
    expect(m.bodySourceRanges).toEqual(base.bodySourceRanges);
    expect(m.bodyPages.map((page) => visible(content, page.sourceRange!))).toEqual(
      base.bodyPages.map((page) => visible(content, page.sourceRange!))
    );
    expect(m.bodyPages.map((page) => page.physicalPageNumber)).toEqual(
      base.bodyPages.map((page) => page.physicalPageNumber + tocCount)
    );
  });

  it("「見出し」の前: the TOC enters the canonical sequence between body pages, Editor ranges unchanged", () => {
    const base = model(content, settings(20, 10));
    const m = model(content, tocOn({}, { mode: "before-heading", headingIndex: 1, headingTitle: "第二章" }));
    const tocCount = m.tocPages.length;
    expect(tocCount).toBeGreaterThanOrEqual(1);
    const expected = ["body:1:1", ...Array.from({ length: tocCount }, (_, i) => `toc:${2 + i}:-`), `body:${2 + tocCount}:2`, `body:${3 + tocCount}:3`];
    expect(summary(m.pages)).toEqual(expected);
    // Search / caret / undo offsets: body ranges are the Editor's own, TOC text never counted.
    expect(m.bodySourceRanges).toEqual(base.bodySourceRanges);
    expect(m.bodyPages.map((page) => visible(content, page.sourceRange!))).toEqual(
      base.bodyPages.map((page) => visible(content, page.sourceRange!))
    );
  });

  it("a heading anchor follows its heading by title even when the stored index is stale", () => {
    const m = model(content, tocOn({}, { mode: "before-heading", headingIndex: 0, headingTitle: "第三章" }));
    const tocCount = m.tocPages.length;
    expect(summary(m.pages).slice(0, 2)).toEqual(["body:1:1", "body:2:2"]);
    expect(m.pages[2].kind).toBe("toc");
    expect(m.pages[2 + tocCount].bodyPageNumber).toBe(3);
  });

  it("本文の後: the TOC follows the last body page", () => {
    const m = model(content, tocOn({}, { mode: "end" }));
    const tocCount = m.tocPages.length;
    expect(tocCount).toBeGreaterThanOrEqual(1);
    expect(summary(m.pages).slice(0, 3)).toEqual(["body:1:1", "body:2:2", "body:3:3"]);
    expect(m.pages.slice(3).every((page) => page.kind === "toc")).toBe(true);
  });

  it("TOC pages print their ノンブル like any publication page (no 柱); folios follow the physical sequence", () => {
    for (const position of [{ mode: "start" } as const, { mode: "before-heading", headingIndex: 1, headingTitle: "第二章" } as const]) {
      const layout = layoutOf(tocOn({}, position));
      const toc = layout.toc!;
      expect(toc.pageCount).toBeGreaterThanOrEqual(1);
      layout.document.pageSequence.forEach((ref, physicalIndex) => {
        if (ref.kind !== "body") return;
        const page = layout.document.pages[ref.index];
        const isToc = ref.index >= toc.firstCanonicalPage && ref.index < toc.firstCanonicalPage + toc.pageCount;
        if (isToc) expect(page.header).toBeUndefined();
        const expectedFolio = DEFAULT_PAGE_SETTINGS.masterPage.nombreStart + physicalIndex;
        if (isToc || page.folio) expect(page.folio?.text).toBe(String(expectedFolio));
      });
    }
  });

  it("every TOC item's page number is placed exactly once on the TOC pages, at one shared cell (all leader styles)", () => {
    const many = ["序章", "第一章　はじまりの朝", "第二章", "第三章　とても長い章題をつけた場合", "終章"];
    const manyContent = many.map((title) => `# ${title}\n本文。`).join("\n【改ページ】\n");
    for (const leader of ["dots", "dash", "none"] as const) {
      const toc: TocSettings = {
        enabled: true,
        items: many.map((title, index) => ({ title, pageNumber: [2, 9, 98, 123, 1004][index] })),
        position: { mode: "start" },
        leader,
        updatedAt: 1,
      };
      const layout = composeV2Layout({ title: "T", content: manyContent, settings: settings(37, 16, { toc }), measurement: MEASUREMENT });
      const placement = layout.toc!;
      const tcyByStart = new Map(
        layout.units.filter((unit) => unit.kind === "TCY").map((unit) => [unit.span.start, unit] as const)
      );
      const placed: Array<{ text: string; yTick: number }> = [];
      for (let index = placement.firstCanonicalPage; index < placement.firstCanonicalPage + placement.pageCount; index += 1) {
        for (const column of layout.document.pages[index].columns) {
          for (const line of column.lines) {
            for (const unit of line.placedUnits) {
              const tcy = tcyByStart.get(unit.sourceSpan.start);
              if (tcy && tcy.kind === "TCY") placed.push({ text: tcy.displayText, yTick: unit.yTick + (line.indentTick ?? 0) });
            }
          }
        }
      }
      expect(placed.map((entry) => entry.text)).toEqual(toc.items.map((item) => String(item.pageNumber)));
      expect(new Set(placed.map((entry) => entry.yTick)).size).toBe(1);
    }
  });

  it("本文の後 TOC: every page number paints in the same cell with a one-cell box (Preview paint = PDF/JPG estimate)", () => {
    // Human QA: 「1」「3」 aligned but the document-final 「4」 dropped ~2 cells
    // (its line-final box borrowed the 5-cell leader run's extent).
    const shortContent = "# あ\n本文あ。\n【改ページ】\n本文続き。\n【改ページ】\n# い\n本文い。\n【改ページ】\n# う\n本文う。";
    for (const leader of ["dots", "dash", "none"] as const) {
      const toc: TocSettings = {
        enabled: true,
        items: [{ title: "あ", pageNumber: 1 }, { title: "い", pageNumber: 3 }, { title: "う", pageNumber: 4 }],
        position: { mode: "end" },
        leader,
        updatedAt: 1,
      };
      const layout = composeV2Layout({ title: "T", content: shortContent, settings: settings(37, 16, { toc }), measurement: MEASUREMENT });
      const paint = buildV2PreviewDocument(layout, {});
      const tocPhysical = layout.document.pageSequence.findIndex((ref) => ref.kind === "body" && ref.index === layout.toc!.firstCanonicalPage);
      const numbers = paint.pages[tocPhysical].columns
        .flatMap((column) => column.lines)
        .flatMap((line) => line.units)
        .filter((unit) => unit.kind === "TCY");
      expect(numbers.map((unit) => unit.text)).toEqual(["1", "3", "4"]);
      expect(new Set(numbers.map((unit) => unit.topPx.toFixed(3))).size).toBe(1);
      expect(new Set(numbers.map((unit) => unit.heightPx.toFixed(3))).size).toBe(1);
    }
  });

  it("page overrides stay keyed by Editor body page number around a TOC", () => {
    const position = { mode: "before-heading", headingIndex: 1, headingTitle: "第二章" } as const;
    const layout = layoutOf(tocOn({ pageOverrides: { 2: { hideNombre: true } } }, position));
    const plain = layoutOf(tocOn({}, position));
    const toc = layout.toc!;
    // Editor body page 2 = the first canonical page after the TOC.
    const afterToc = toc.firstCanonicalPage + toc.pageCount;
    expect(layout.document.pages[afterToc].folio).toBeUndefined();
    expect(layout.document.pages[0].folio).toEqual(plain.document.pages[0].folio);
    expect(layout.document.pages[toc.firstCanonicalPage].folio).toEqual(plain.document.pages[toc.firstCanonicalPage].folio);
  });

  it("「Nページ目の後に奥付」 counts Editor body pages, not the TOC (horizontal colophon + TOC)", () => {
    const colophon = { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true, pagePosition: { mode: "after-body-page" as const, afterBodyPage: 1 } };
    const withoutToc = model(content, settings(20, 10, { colophon }));
    const m = model(content, tocOn({ colophon }));
    const tocCount = m.tocPages.length;
    expect(summary(withoutToc.pages)).toEqual(["body:1:1", "colophon:2:-", "body:3:2", "body:4:3"]);
    expect(summary(m.pages.slice(tocCount))).toEqual(
      ["body:1:1", "colophon:2:-", "body:3:2", "body:4:3"].map((entry) => {
        const [kind, physical, body] = entry.split(":");
        return `${kind}:${Number(physical) + tocCount}:${body}`;
      })
    );
    // A TOC placed AFTER the colophon point does not move the colophon.
    const later = model(content, tocOn({ colophon }, { mode: "before-heading", headingIndex: 2, headingTitle: "第三章" }));
    expect(summary(later.pages).slice(0, 3)).toEqual(["body:1:1", "colophon:2:-", "body:3:2"]);
    expect(later.pages[3].kind).toBe("toc");
  });

  it("colophon JPG export resolves the colophon from the canonical pageSequence (TOC pages included)", () => {
    const colophon = { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true, pagePosition: { mode: "after-body-page" as const, afterBodyPage: 1 } };
    const layout = layoutOf(tocOn({ colophon }));
    const m = buildV2PreviewPageModel(layout, content);
    const tocCount = m.tocPages.length;
    const physicalIndex = colophonPhysicalIndex(layout.document.pageSequence);
    expect(physicalIndex).toBe(tocCount + 1);
    expect(m.pages[physicalIndex].kind).toBe("colophon");
    expect(physicalPageNumber(physicalIndex)).toBe(m.pages[physicalIndex].physicalPageNumber);
  });

  it("colophon at the end + TOC at the start: physical order is TOC, body…, colophon", () => {
    const colophon = { ...DEFAULT_PAGE_SETTINGS.colophon, enabled: true, pagePosition: { mode: "end" as const } };
    const m = model(content, tocOn({ colophon }));
    const kinds = m.pages.map((page) => page.kind);
    expect(kinds[0]).toBe("toc");
    expect(kinds[kinds.length - 1]).toBe("colophon");
    expect(m.pages.map((page) => page.physicalPageNumber)).toEqual(m.pages.map((_, index) => index + 1));
  });
});
