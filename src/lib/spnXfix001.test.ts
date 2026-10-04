import { describe, expect, it } from "vitest";
import { centerShortPiece, measureShortPiece } from "./centerShortPiece";
import { computePageLayout, DEFAULT_PAGE_SETTINGS, resolvePaperSize } from "./pageLayout";
import { applyDestinationPaperPreset } from "./paperPresets";
import { parsePlotFile, plotToManuscriptTemplate, plotToSceneMemo, manuscriptHeadings, chapterIndexForHeading } from "./plotPanel";
import { subtitleText } from "./cover/coverPaint";
import { computeDemoCardPlacement } from "./demoPlacement";
import { PAPER_SIZE_TEMPLATES } from "@/constants/paperSizes";

const TANKA = "白鳥は哀しからずや空の青海のあをにも染まずただよふ";

describe("SPN-XFIX-001 本文を用紙の中央に置く", () => {
  it("counts the longest line (with the automatic indent) and the line count, per page", () => {
    expect(measureShortPiece(`\n${TANKA}\n\n`)).toEqual({ longestLine: TANKA.length + 1, lineCount: 1 });
    expect(measureShortPiece("「あ」\nいいい\n【改ページ】\nう\nええ\nお")).toEqual({ longestLine: 4, lineCount: 3 });
    expect(measureShortPiece("｜漢字《かんじ》")).toEqual({ longestLine: 3, lineCount: 1 });
    expect(measureShortPiece("  \n\n")).toBeNull();
  });

  it("centres one tanka on A6 with equal 天地 and ノド・小口, keeping the whole line on one column", () => {
    const base = applyDestinationPaperPreset(DEFAULT_PAGE_SETTINGS, "A6");
    const result = centerShortPiece({ ...base, fontSizePt: 16 }, TANKA, { vertical: true, horizontal: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.settings;
    expect(s.layoutMode).toBe("capacity");
    expect(Math.abs(s.marginTop - s.marginBottom)).toBeLessThan(0.01);
    expect(Math.abs(s.marginGutter - s.marginOuter)).toBeLessThan(0.01);
    const layout = computePageLayout(s);
    expect(layout.charsPerLine).toBeGreaterThanOrEqual(TANKA.length + 1);
    expect(layout.linesPerColumn).toBe(1);
  });

  it("keeps the current 天 when only the horizontal centre is chosen", () => {
    const base = applyDestinationPaperPreset(DEFAULT_PAGE_SETTINGS, "文庫");
    const result = centerShortPiece(base, "あいう\nえお", { vertical: false, horizontal: true });
    expect(result.ok && result.settings.marginTop).toBe(base.marginTop);
  });

  it("explains instead of changing anything when it cannot fit or the text is empty", () => {
    const base = applyDestinationPaperPreset(DEFAULT_PAGE_SETTINGS, "A6");
    expect(centerShortPiece(base, "", { vertical: true, horizontal: true }).ok).toBe(false);
    const long = centerShortPiece({ ...base, fontSizePt: 30 }, TANKA, { vertical: true, horizontal: true });
    expect(long.ok).toBe(false);
    const twoColumns = centerShortPiece({ ...base, columnCount: 2 }, TANKA, { vertical: true, horizontal: true });
    expect(twoColumns.ok).toBe(false);
  });
});

describe("SPN-XFIX-001 SNS用の用紙", () => {
  it("adds square and 4:5 px papers (JPG only, no folio by default, 1 column)", () => {
    const square = resolvePaperSize("SNS用 正方形");
    const portrait = resolvePaperSize("SNS用 4:5");
    expect(square.isPx && square.widthPx === 1080 && square.heightPx === 1080).toBe(true);
    expect(portrait.isPx && portrait.widthPx === 1080 && portrait.heightPx === 1350).toBe(true);
    const applied = applyDestinationPaperPreset({ ...DEFAULT_PAGE_SETTINGS, columnCount: 2 }, "SNS用 正方形");
    expect(applied.columnCount).toBe(1);
    expect(applied.masterPage.nombrePosition).toBe("hidden");
    expect(computePageLayout(applied).charsPerLine).toBeGreaterThan(20);
  });

  it("keeps 文庫 and A6 the same size (the label tells 文庫 is A6判)", () => {
    expect(PAPER_SIZE_TEMPLATES["文庫"].width).toBe(PAPER_SIZE_TEMPLATES["A6"].width);
    expect(PAPER_SIZE_TEMPLATES["文庫"].height).toBe(PAPER_SIZE_TEMPLATES["A6"].height);
  });
});

describe("SPN-XFIX-001 表紙のサブタイトル", () => {
  it("shows nothing for an empty or blank subtitle", () => {
    expect(subtitleText("")).toBeNull();
    expect(subtitleText(" 　")).toBeNull();
    expect(subtitleText("夏の話")).toBe("夏の話");
  });
});

describe("SPN-XFIX-001 プロット帳から本文のひな形", () => {
  const file = JSON.stringify({
    format: "spuntales-plot",
    version: 1,
    exportedAt: "2026-10-04T00:00:00.000Z",
    plot: {
      id: "p1",
      title: "夏の終わり",
      logline: "",
      chapters: [
        {
          id: "c1",
          title: "出会い",
          summary: "駅で再会する",
          scenes: [
            { id: "s1", title: "ホーム", summary: "雨のホーム", characters: "ミナ、ソウ", timePlace: "夕方", memo: "", status: "todo" },
            { id: "s2", title: "", summary: "", characters: "", timePlace: "", memo: "", status: "todo" },
          ],
        },
        { id: "c2", title: "第二章　帰郷", summary: "", scenes: [] },
      ],
      fragments: [],
      createdAt: 0,
      updatedAt: 0,
    },
  });

  it("writes chapter headings and scene names, and the headings still follow the plot panel", () => {
    const parsed = parsePlotFile(file);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const body = plotToManuscriptTemplate(parsed.plot);
    expect(body).toBe("# 第1章　出会い\n\n◇ ホーム\n\n◇ 場面2\n\n# 第二章　帰郷\n");
    const headings = manuscriptHeadings(body).map((h) => h.title);
    expect(headings).toEqual(["第1章　出会い", "第二章　帰郷"]);
    expect(headings.map((h) => chapterIndexForHeading(parsed.plot, h))).toEqual([0, 1]);
  });

  it("puts each scene's plot in the memo text, skipping empty scenes", () => {
    const parsed = parsePlotFile(file);
    if (!parsed.ok) throw new Error(parsed.error);
    const memo = plotToSceneMemo(parsed.plot);
    expect(memo).toContain("プロット帳「夏の終わり」より");
    expect(memo).toContain("【第1章　出会い】\n  駅で再会する\n・ホーム\n  雨のホーム\n  人物：ミナ、ソウ\n  時と場所：夕方");
    expect(memo).not.toContain("場面2");
    expect(memo).not.toContain("帰郷");
  });
});

describe("SPN-XFIX-001 デモの案内カード", () => {
  it("docks at the bottom over a tall target instead of covering the toolbar and title above it", () => {
    const phone = { width: 390, height: 844 };
    const editor = { top: 320, bottom: 805, left: 8, right: 382, width: 374, height: 485 };
    const placement = computeDemoCardPlacement(editor, { width: 366, height: 240 }, phone, "lower-safe", { maxCardHeight: 300, largeTargetDock: "bottom" });
    expect(placement.top).toBe(844 - 240 - 12);
    expect(placement.top).toBeGreaterThan(editor.top + 150);
  });

  it("sits beside the preview on a wide screen", () => {
    const pc = { width: 1366, height: 800 };
    const preview = { top: 140, bottom: 240, left: 688, right: 1320, width: 632, height: 100 };
    const placement = computeDemoCardPlacement(preview, { width: 380, height: 180 }, pc, "beside");
    expect(placement.left + 380).toBeLessThanOrEqual(preview.left);
  });
});
