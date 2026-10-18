// TSP-PRINT-002 (P4-4): 本づくりの差しこみ（扉・縦の奥付）で柱・ノンブルを隠す
// ページを、プレビュー・書き出しと同じ V2 のページで数える。
import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS, computePageLayout, type PageSettings } from "../pageLayout";
import { formatImageMarker } from "../tategaki";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import { generateColophonText, generateTitlePageText } from "@/utils/bookStructure";
import { computeInsertedPartPageRange } from "@/utils/tocGenerator";
import { composeV2Layout } from "./composeV2Document";
import { buildV2PreviewPageModel } from "./previewPageModel";
import { insertedPartBodyPagesFromV2 } from "./insertedPartPages";

const MEASUREMENT = createFakeMeasurementProvider();
const pngBytes = encode({ width: 2, height: 3, channels: 4, data: new Uint8Array(24).fill(200) });
const IMAGE_ID = "9976b325-fd67-4832-b0e1-2d2250a47e68";
const LINE = "あいうえおかきくけこさしすせそたちつてと".repeat(2);
const COLOPHON = generateColophonText({
  title: "作品",
  author: "著者",
  publisher: "",
  printedBy: "",
  publishedAt: "2026年10月18日",
  contact: "",
  notice: "",
});

function body(lines: number): string {
  return Array.from({ length: lines }, () => LINE).join("\n") + "\n";
}

function fullImage(): string {
  return formatImageMarker({ type: "image", id: IMAGE_ID, widthMm: 60, heightMm: 90, position: "full" });
}

function v2Pages(content: string, inserted: string, position: "start" | "end", settings: PageSettings = DEFAULT_PAGE_SETTINGS) {
  const finalContent = position === "start" ? inserted + content : content + inserted;
  const layout = composeV2Layout({
    title: "T",
    content: finalContent,
    settings,
    measurement: MEASUREMENT,
    imageResolver: () => ({ kind: "RESOLVED", url: "data:image/png;base64,qa", bytes: pngBytes, format: "PNG", pixelWidth: 2, pixelHeight: 3 }),
  });
  const model = buildV2PreviewPageModel(layout, finalContent);
  return { pages: insertedPartBodyPagesFromV2(model, finalContent, inserted, position), model, finalContent };
}

function legacyPages(finalContent: string, inserted: string, position: "start" | "end"): number[] {
  const layout = computePageLayout(DEFAULT_PAGE_SETTINGS);
  const range = computeInsertedPartPageRange(finalContent, inserted, position, {
    charsPerLine: layout.charsPerLine,
    linesPerPage: layout.linesPerPage,
  });
  if (!range) return [];
  return Array.from({ length: range.endPage - range.startPage + 1 }, (_, i) => range.startPage + i);
}

describe("本づくりの差しこみで隠すページ（V2 で数える）", () => {
  it("縦の奥付を末尾に入れると、最後の本文ページの次の1ページだけ", () => {
    const { pages, model } = v2Pages(body(40), COLOPHON, "end");
    expect(pages).toEqual([model.bodyPages.length]);
    expect(model.bodyPages.length).toBeGreaterThan(1);
  });

  it("全面の挿絵で終わる原稿でも、奥付のページを数える（前の数え方はずれていた）", () => {
    const { pages, model, finalContent } = v2Pages(body(10) + fullImage() + "\n", COLOPHON, "end");
    const last = model.bodyPages.length;
    expect(pages).toEqual([last]);
    // 奥付のページには奥付の文字が入っている
    const range = model.bodyPages[last - 1].sourceRange!;
    expect(finalContent.slice(range.start, range.end)).toContain("【著者】著者");
    // これまでの文字数での数え方は、挿絵のぶんだけ手前のページを隠していた
    expect(legacyPages(finalContent, COLOPHON, "end")[0]).toBeLessThan(last);
  });

  it("扉を先頭に入れると1ページ目だけ", () => {
    const title = generateTitlePageText("作品", "著者");
    const { pages } = v2Pages(body(40), title, "start");
    expect(pages).toEqual([1]);
  });

  it("目次ページ（作品の設定で入るもの）は数に入れない：本文のページ番号で返す", () => {
    const withToc: PageSettings = {
      ...DEFAULT_PAGE_SETTINGS,
      toc: { enabled: true, items: [{ title: "一", pageNumber: 1 }], position: { mode: "start" }, leader: "dots", updatedAt: null },
    };
    const content = "# 一\n" + body(40);
    const plain = v2Pages(content, COLOPHON, "end");
    const toc = v2Pages(content, COLOPHON, "end", withToc);
    expect(toc.model.pages.some((page) => page.kind === "toc")).toBe(true);
    expect(toc.pages).toEqual(plain.pages);
  });

  it("中身のないパーツは null", () => {
    expect(insertedPartBodyPagesFromV2({ bodyPages: [] }, "本文【改ページ】", "【改ページ】", "end")).toBeNull();
  });
});
