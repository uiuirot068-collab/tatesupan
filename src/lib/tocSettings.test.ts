import { describe, expect, it } from "vitest";
import { tokenizeTategaki } from "./tategaki";
import {
  buildTocBlockLines,
  buildTocCompositionInsertion,
  buildTocEntryLines,
  createDefaultTocSettings,
  describeTocPosition,
  normalizeTocLeader,
  normalizeTocSettings,
  resolveTocInsertion,
  TOC_LEADER_CELLS,
  tocTitleAreaCells,
  tocTitleCells,
  type TocLeaderStyle,
  type TocSettings,
} from "./tocSettings";

/** Cells V2 Core charges for a manuscript line (TEXT 1 / ruby base / 縦中横 1). */
function cellsOf(line: string): number {
  return tokenizeTategaki(line).reduce((sum, token) => {
    if (token.type === "text") return sum + Array.from(token.value).length;
    if (token.type === "ruby") return sum + Array.from(token.base).length;
    if (token.type === "tcy") return sum + 1;
    return sum;
  }, 0);
}

/** Cell index (0-based) where the 縦中横 page number sits on a line. */
function numberCellIndex(line: string): number {
  let cells = 0;
  for (const token of tokenizeTategaki(line)) {
    if (token.type === "tcy" && /^\d+$/.test(token.value) && line.endsWith(`[tate]${token.value}[/tate]`)) return cells;
    cells += token.type === "text" ? Array.from(token.value).length : token.type === "ruby" ? Array.from(token.base).length : 1;
  }
  return -1;
}

const toc = (items: Array<{ title: string; pageNumber: number }>, position: TocSettings["position"] = { mode: "start" }): TocSettings => ({
  enabled: true,
  items,
  position,
  leader: "dots",
  updatedAt: 1,
});

describe("Phase 11 TOC settings: old-document migration and normalization", () => {
  it("documents saved before TOC existed open as 「TOCなし」", () => {
    for (const raw of [undefined, null, "", 0, [], "目次"]) {
      expect(normalizeTocSettings(raw)).toEqual(createDefaultTocSettings());
    }
    expect(createDefaultTocSettings()).toEqual({ enabled: false, items: [], position: { mode: "start" }, leader: "dots", updatedAt: null });
  });

  it("a TOC saved before 挿入位置 existed keeps its old place (本文の前)", () => {
    const migrated = normalizeTocSettings({ enabled: true, items: [{ title: "第一章", pageNumber: 2 }], updatedAt: 5 });
    expect(migrated.position).toEqual({ mode: "start" });
    // 従来互換: no saved leader → the dotted leader.
    expect(migrated.leader).toBe("dots");
    expect(migrated.enabled).toBe(true);
  });

  it("keeps a valid saved TOC and drops malformed items / positions", () => {
    const value = normalizeTocSettings({
      enabled: true,
      items: [
        { title: "第一章", pageNumber: 2 },
        { title: "壊れた", pageNumber: "3" },
        null,
        { title: "第二章", pageNumber: 7.9 },
        { title: "第三章", pageNumber: -4 },
      ],
      position: { mode: "before-heading", headingIndex: 1.7, headingTitle: "第二章" },
      updatedAt: 123,
    });
    expect(value).toEqual({
      enabled: true,
      items: [
        { title: "第一章", pageNumber: 2 },
        { title: "第二章", pageNumber: 7 },
        { title: "第三章", pageNumber: 1 },
      ],
      position: { mode: "before-heading", headingIndex: 1, headingTitle: "第二章" },
      leader: "dots",
      updatedAt: 123,
    });
    expect(normalizeTocSettings({ enabled: true, items: [{ title: "章", pageNumber: 2 }], position: { mode: "page-7" } }).position).toEqual({ mode: "start" });
    expect(normalizeTocSettings({ enabled: true, items: [{ title: "章", pageNumber: 2 }], position: { mode: "end" } }).position).toEqual({ mode: "end" });
  });

  it("an enabled TOC with no usable items is treated as off", () => {
    expect(normalizeTocSettings({ enabled: true, items: [], updatedAt: 1 }).enabled).toBe(false);
    expect(normalizeTocSettings({ enabled: "yes", items: [{ title: "章", pageNumber: 2 }] }).enabled).toBe(false);
  });
});

describe("TOC insertion position (manuscript anchor, never a body edit)", () => {
  const content = "扉\n【改ページ】\n# 第一章\n本文一\n# 第二章\n本文二";

  it("resolves start / heading / end anchors to raw offsets in the Editor body", () => {
    expect(resolveTocInsertion(content, { mode: "start" }).offset).toBe(0);
    expect(resolveTocInsertion(content, { mode: "end" }).offset).toBe(content.length);
    expect(resolveTocInsertion(content, { mode: "before-heading", headingIndex: 1, headingTitle: "第二章" }).offset).toBe(content.indexOf("# 第二章"));
  });

  it("a heading anchor follows its title; a vanished heading falls back to 本文の前", () => {
    expect(resolveTocInsertion(content, { mode: "before-heading", headingIndex: 0, headingTitle: "第二章" })).toEqual({
      offset: content.indexOf("# 第二章"),
      resolved: { mode: "before-heading", headingIndex: 1, headingTitle: "第二章" },
    });
    expect(resolveTocInsertion("本文だけ", { mode: "before-heading", headingIndex: 3, headingTitle: "消えた章" })).toEqual({
      offset: 0,
      resolved: { mode: "start" },
    });
    expect(describeTocPosition({ mode: "before-heading", headingIndex: 1, headingTitle: "第二章" })).toBe("「第二章」の前");
    expect(describeTocPosition({ mode: "start" })).toBe("本文の前");
    expect(describeTocPosition({ mode: "end" })).toBe("本文の後");
  });

  it("is composition-only: empty without an enabled TOC, and never contains the body", () => {
    const grid = { cellsPerLine: 20, linesPerColumn: 10, columnsPerPage: 1 };
    expect(buildTocCompositionInsertion(content, undefined, grid)).toBeNull();
    expect(buildTocCompositionInsertion(content, createDefaultTocSettings(), grid)).toBeNull();
    const insertion = buildTocCompositionInsertion(content, toc([{ title: "第一章", pageNumber: 3 }], { mode: "before-heading", headingIndex: 0, headingTitle: "第一章" }), grid)!;
    expect(insertion.offset).toBe(content.indexOf("# 第一章"));
    expect(insertion.text).not.toContain("本文一");
  });

  it("after a page break: no extra leading break; closes with a page break so the next chapter starts a page", () => {
    const grid = { cellsPerLine: 20, linesPerColumn: 10, columnsPerPage: 1 };
    const insertion = buildTocCompositionInsertion(content, toc([{ title: "第一章", pageNumber: 3 }], { mode: "before-heading", headingIndex: 0, headingTitle: "第一章" }), grid)!;
    expect(insertion.text.startsWith("【改ページ】")).toBe(false);
    expect(insertion.text.endsWith("【改ページ】\n")).toBe(true);
  });

  it("mid-page heading: opens with a page break; the body after it stays a paragraph start (page padded to its end)", () => {
    const grid = { cellsPerLine: 20, linesPerColumn: 10, columnsPerPage: 1 };
    const insertion = buildTocCompositionInsertion(content, toc([{ title: "第二章", pageNumber: 4 }], { mode: "before-heading", headingIndex: 1, headingTitle: "第二章" }), grid)!;
    expect(insertion.text.startsWith("【改ページ】\n")).toBe(true);
    const tocLines = insertion.text.slice("【改ページ】\n".length).split("\n");
    // 10 lines on the page + the trailing empty split element.
    expect(tocLines).toHaveLength(11);
    expect(insertion.text.includes("【改ページ】", 1)).toBe(false);
    const fallback = buildTocCompositionInsertion(content, toc([{ title: "第二章", pageNumber: 4 }], { mode: "before-heading", headingIndex: 1, headingTitle: "第二章" }), grid, { padToPageEnd: false })!;
    expect(fallback.text.endsWith("【改ページ】\n")).toBe(true);
  });

  it("本文の後: opens with a page break and needs no closing break", () => {
    const grid = { cellsPerLine: 20, linesPerColumn: 10, columnsPerPage: 1 };
    const insertion = buildTocCompositionInsertion(content, toc([{ title: "第一章", pageNumber: 2 }], { mode: "end" }), grid)!;
    expect(insertion.offset).toBe(content.length);
    expect(insertion.text.startsWith("\n【改ページ】\n")).toBe(true);
    expect(insertion.text.endsWith("【改ページ】\n")).toBe(false);
  });
});

/** Cell index (0-based) where the fixed leader block starts. */
function leaderStartCell(line: string): number {
  return numberCellIndex(line) - TOC_LEADER_CELLS - 1;
}

describe("TOC entry layout: [章タイトル領域][　][リーダー×5][　][ページ番号]", () => {
  const titles = ["序", "第一章　はじまり", "第十二章　とても長い章題", "第3章", "｜漢字《かんじ》の章"];
  const items = titles.map((title, index) => ({ title, pageNumber: [3, 12, 128, 7, 45][index] }));

  it("aligns leader start and page number on every entry, using the longest title as the base", () => {
    const lineCells = 37;
    const toc: TocSettings = { enabled: true, items, position: { mode: "start" }, leader: "dots", updatedAt: 1 };
    const lines = buildTocBlockLines(toc, lineCells).slice(2); // drop heading + blank
    expect(lines).toHaveLength(items.length); // no wrapping: every entry is one line
    const longest = Math.max(...titles.map(tocTitleCells));
    expect(tocTitleAreaCells(items, lineCells)).toBe(longest);
    for (const line of lines) {
      // [　 indent 1][title area = longest][　 gap][leader 5][　 gap][number]
      expect(numberCellIndex(line)).toBe(1 + longest + 1 + TOC_LEADER_CELLS + 1);
      expect(cellsOf(line)).toBe(1 + longest + 1 + TOC_LEADER_CELLS + 1 + 1);
      expect(line).toMatch(/　…{5}　\[tate\]\d+\[\/tate\]$/);
      expect(leaderStartCell(line)).toBe(1 + longest + 1);
      expect(Array.from(line.replace(/　\[tate\]\d+\[\/tate\]$/, "")).slice(-TOC_LEADER_CELLS).join("")).toBe("…".repeat(TOC_LEADER_CELLS));
    }
    // The longest title is followed directly by the single gap space.
    expect(lines[2]).toMatch(/^　第十二章　とても長い章題　…{5}/);
  });

  it("every entry carries exactly one page number", () => {
    const toc: TocSettings = { enabled: true, items, position: { mode: "start" }, leader: "dots", updatedAt: 1 };
    const numbers = buildTocBlockLines(toc, 37)
      .flatMap((line) => tokenizeTategaki(line))
      .filter((token) => token.type === "tcy" && /^\d+$/.test(token.value))
      .map((token) => (token.type === "tcy" ? token.value : ""));
    expect(numbers).toEqual(items.map((item) => String(item.pageNumber)));
  });

  it("a title longer than the line allows wraps inside the title area; numbers stay aligned", () => {
    const longTitle = "あいうえおかきくけこさしすせそたちつてとなにぬねの";
    const lineCells = 16;
    const area = tocTitleAreaCells([{ title: longTitle, pageNumber: 9 }, { title: "短", pageNumber: 10 }], lineCells);
    expect(area).toBe(lineCells - 1 - (1 + TOC_LEADER_CELLS + 1 + 1));
    const wrapped = buildTocEntryLines({ title: longTitle, pageNumber: 9 }, lineCells, "dash", area);
    const short = buildTocEntryLines({ title: "短", pageNumber: 10 }, lineCells, "dash", area);
    expect(wrapped.length).toBeGreaterThan(1);
    wrapped.forEach((line) => expect(cellsOf(line)).toBeLessThanOrEqual(lineCells));
    wrapped.slice(0, -1).forEach((line) => {
      expect(line).not.toContain("―");
      expect(line).not.toContain("[tate]");
    });
    expect(wrapped.slice(1).every((line) => line.startsWith("　　"))).toBe(true);
    expect(numberCellIndex(wrapped[wrapped.length - 1])).toBe(numberCellIndex(short[0]));
    expect(wrapped.map((line) => line.replace(/^　+/, "").replace(/　*―{5}　\[tate\]\d+\[\/tate\]$/, "")).join("")).toBe(longTitle);
  });

  it("keeps ruby / 縦中横 notation atomic inside titles", () => {
    const [line] = buildTocEntryLines({ title: "｜漢字《かんじ》と99", pageNumber: 5 }, 16);
    expect(line).toContain("｜漢字《かんじ》");
    expect(cellsOf(line)).toBe(1 + 4 + 1 + TOC_LEADER_CELLS + 1 + 1);
  });
});

describe("TOC leader block: ……／―――／なし (作品ごと)", () => {
  it("normalizes the saved style; unknown or missing falls back to the dotted leader", () => {
    expect(normalizeTocLeader("dots")).toBe("dots");
    expect(normalizeTocLeader("dash")).toBe("dash");
    expect(normalizeTocLeader("none")).toBe("none");
    expect(normalizeTocLeader(undefined)).toBe("dots");
    expect(normalizeTocLeader("・・・")).toBe("dots");
    expect(normalizeTocSettings({ enabled: true, items: [{ title: "章", pageNumber: 2 }], leader: "dash" }).leader).toBe("dash");
  });

  it("every style is the same 5-cell block, so the page number cell is identical; なし keeps blank cells", () => {
    const fills: Record<TocLeaderStyle, RegExp> = {
      dots: /^　第一章　…{5}　\[tate\]12\[\/tate\]$/,
      dash: /^　第一章　―{5}　\[tate\]12\[\/tate\]$/,
      none: /^　第一章　{7}\[tate\]12\[\/tate\]$/,
    };
    const positions = (["dots", "dash", "none"] as const).map((leader) => {
      const lines = buildTocEntryLines({ title: "第一章", pageNumber: 12 }, 37, leader);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(fills[leader]);
      return numberCellIndex(lines[0]);
    });
    expect(new Set(positions).size).toBe(1);
    expect(positions[0]).toBe(1 + 3 + 1 + TOC_LEADER_CELLS + 1);
  });

  it("the composition-only TOC text uses the work's leader", () => {
    const grid = { cellsPerLine: 20, linesPerColumn: 10, columnsPerPage: 1 };
    const dash = buildTocCompositionInsertion("# 第一章\n本文", { ...toc([{ title: "第一章", pageNumber: 2 }]), leader: "dash" }, grid)!;
    expect(dash.text).toContain("―　[tate]2[/tate]");
    expect(dash.text).not.toContain("…");
    const none = buildTocCompositionInsertion("# 第一章\n本文", { ...toc([{ title: "第一章", pageNumber: 2 }]), leader: "none" }, grid)!;
    expect(none.text).toContain("　　[tate]2[/tate]");
    expect(none.text).not.toContain("…");
  });
});
