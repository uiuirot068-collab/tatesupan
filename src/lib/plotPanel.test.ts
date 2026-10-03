import { describe, expect, it } from "vitest";
import {
  chapterHeading,
  chapterIndexForHeading,
  headingAtCursor,
  manuscriptHeadings,
  parsePlotFile,
  PLOT_LIMITS,
  plotPanelStorageKey,
  readMemoPanelTab,
  readStoredPlot,
  removeStoredPlot,
  serializePlotFile,
  writeMemoPanelTab,
  writeStoredPlot,
  type Plot,
  type PlotPanelStorage,
} from "./plotPanel";
import { memoDraftStorageKey } from "./memoDraft";

function scene(id: string, extra: Record<string, unknown> = {}) {
  return { id, title: "", summary: "", characters: "", timePlace: "", memo: "", status: "todo", ...extra };
}

/** The shape プロット帳 writes (plotbook serializePlotFile). */
function sampleFile() {
  return {
    format: "spuntales-plot",
    version: 1,
    exportedAt: "2026-10-03T00:00:00.000Z",
    plot: {
      id: "p1",
      title: "夏の終わり",
      logline: "",
      chapters: [
        { id: "c1", title: "第一章　出会い", summary: "駅で再会する", scenes: [scene("s1", { summary: "ホーム", characters: "ミナ、ソウ" })] },
        { id: "c2", title: "帰郷", summary: "", scenes: [scene("s2", { status: "writing" }), scene("s3")] },
        { id: "c3", title: "", summary: "", scenes: [] },
      ],
      fragments: [{ id: "f1", text: "雨の匂い", tag: "情景", x: 10, y: 20, usedIn: { chapterId: "c1", sceneId: "s1" }, createdAt: 1 }],
      createdAt: 1,
      updatedAt: 2,
    },
  };
}

function samplePlot(): Plot {
  const parsed = parsePlotFile(JSON.stringify(sampleFile()));
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.plot;
}

class MemoryStorage implements PlotPanelStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("PLT-LOOP-003 plot file reader", () => {
  it("reads a プロット帳 file, with or without a BOM, and round-trips it", () => {
    const plot = samplePlot();
    expect(plot.chapters.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    expect(plot.fragments[0].tag).toBe("情景");
    expect(parsePlotFile("﻿" + JSON.stringify(sampleFile())).ok).toBe(true);
    expect(parsePlotFile(serializePlotFile(plot))).toEqual({ ok: true, plot });
  });

  it.each([
    ["not json", "{"],
    ["another app's json", JSON.stringify({ hello: 1 })],
    ["a TateSpun backup", JSON.stringify({ title: "x", content: "# 第1章" })],
    ["newer version", JSON.stringify({ ...sampleFile(), version: 2 })],
    ["no chapters", JSON.stringify({ ...sampleFile(), plot: { ...sampleFile().plot, chapters: [] } })],
  ])("rejects %s", (_label, text) => {
    expect(parsePlotFile(text).ok).toBe(false);
  });

  it("rejects bad fields instead of half-loading", () => {
    const status = sampleFile();
    (status.plot.chapters[1].scenes[0] as Record<string, unknown>).status = "maybe";
    expect(parsePlotFile(JSON.stringify(status))).toEqual({ ok: false, error: expect.stringContaining("2番目の章の1番目の場面") });

    const dup = sampleFile();
    dup.plot.chapters[1].scenes[0].id = "s1";
    expect(parsePlotFile(JSON.stringify(dup)).ok).toBe(false);

    const long = sampleFile();
    long.plot.logline = "あ".repeat(PLOT_LIMITS.textLength + 1);
    expect(parsePlotFile(JSON.stringify(long)).ok).toBe(false);

    const notText = sampleFile() as unknown as { plot: Record<string, unknown> };
    notText.plot.title = { toString: "x" };
    expect(parsePlotFile(JSON.stringify(notText)).ok).toBe(false);
  });
});

describe("PLT-LOOP-003 following the manuscript", () => {
  it("writes and matches the same headings as プロット帳", () => {
    const plot = samplePlot();
    expect(plot.chapters.map((c, i) => chapterHeading(c, i))).toEqual(["第一章　出会い", "第2章　帰郷", "第3章"]);
    expect(chapterIndexForHeading(plot, "第一章 出会い")).toBe(0);
    expect(chapterIndexForHeading(plot, "第2章　帰郷")).toBe(1);
    expect(chapterIndexForHeading(plot, "帰郷")).toBe(1);
    expect(chapterIndexForHeading(plot, "第３章")).toBe(2);
    expect(chapterIndexForHeading(plot, "エピローグ")).toBe(-1);
    expect(chapterIndexForHeading(plot, "  ")).toBe(-1);
  });

  it("never guesses between two chapters with the same heading", () => {
    const file = sampleFile();
    file.plot.chapters[1].title = "第一章出会い";
    const parsed = parsePlotFile(JSON.stringify(file));
    expect(parsed.ok && chapterIndexForHeading(parsed.plot, "第一章 出会い")).toBe(-1);
  });

  it("finds the heading the cursor is under", () => {
    const content = "まえがき\n# 第一章　出会い\n本文A\n\n  # 第2章　帰郷\n本文B\n■ 第3章\n本文C";
    const headings = manuscriptHeadings(content);
    expect(headings.map((h) => h.title)).toEqual(["第一章　出会い", "第2章　帰郷", "第3章"]);
    expect(headingAtCursor(headings, 0)).toBeNull();
    expect(headingAtCursor(headings, content.indexOf("本文A"))).toBe("第一章　出会い");
    expect(headingAtCursor(headings, content.indexOf("# 第2章"))).toBe("第2章　帰郷");
    expect(headingAtCursor(headings, content.length)).toBe("第3章");
    expect(headingAtCursor(headings, null)).toBeNull();
    expect(headingAtCursor([], 5)).toBeNull();
  });
});

describe("PLT-LOOP-003 the plot's own drawer", () => {
  it("keeps the plot apart from the memo draft, per work", () => {
    const key = plotPanelStorageKey("cloud:abc");
    expect(key).not.toBe(memoDraftStorageKey("cloud:abc"));
    expect(plotPanelStorageKey("local:1")).not.toBe(plotPanelStorageKey("local:2"));
  });

  it("stores, re-checks and removes the plot", () => {
    const storage = new MemoryStorage();
    const key = plotPanelStorageKey("local:1");
    expect(readStoredPlot(storage, key)).toBeNull();
    expect(writeStoredPlot(storage, key, samplePlot())).toBe(true);
    expect(readStoredPlot(storage, key)).toEqual(samplePlot());
    storage.setItem(key, "{broken");
    expect(readStoredPlot(storage, key)).toBeNull();
    removeStoredPlot(storage, key);
    expect(storage.values.has(key)).toBe(false);
  });

  it("reports a full or blocked browser storage instead of throwing", () => {
    const full: PlotPanelStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("QuotaExceededError"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(writeStoredPlot(full, "k", samplePlot())).toBe(false);
    expect(readStoredPlot(full, "k")).toBeNull();
    expect(() => removeStoredPlot(full, "k")).not.toThrow();
    expect(readMemoPanelTab(full)).toBe("memo");
    expect(() => writeMemoPanelTab(full, "plot")).not.toThrow();
  });

  it("remembers the last tab", () => {
    const storage = new MemoryStorage();
    expect(readMemoPanelTab(storage)).toBe("memo");
    writeMemoPanelTab(storage, "plot");
    expect(readMemoPanelTab(storage)).toBe("plot");
  });
});

describe("PLT-LOOP-003 the panel stays read-only", () => {
  it("never writes to the manuscript, settings, memo or cloud from the plot side", async () => {
    const { readFileSync } = await import("node:fs");
    const view = readFileSync("src/components/PlotPanelView.tsx", "utf8");
    for (const forbidden of ["onContentChange", "setContent", "onConfirm", "writeMemoDraft", "supabase", "dangerouslySetInnerHTML", "updateProject"]) {
      expect(view).not.toContain(forbidden);
    }
  });
});

describe("PLT-LOOP-003 QA: the plot side says it is view-only", () => {
  it("tells writers the plot cannot be written here and points them to the memo", async () => {
    const { readFileSync } = await import("node:fs");
    const view = readFileSync("src/components/PlotPanelView.tsx", "utf8");
    const memo = readFileSync("src/components/InlineMemoAccordion.tsx", "utf8");
    const pane = readFileSync("src/components/EditorPane.tsx", "utf8");
    expect(view).toContain("プロットを書くことはできません");
    expect(view).toContain("プロット帳で直して、読み込み直してください");
    expect(view).toContain("メモを開く");
    expect(memo).toContain('data-plot-view-only=""');
    expect(memo).toContain('onOpenMemo={() => chooseTab("memo")}');
    expect(view + pane).not.toContain("原稿の横");
  });
});
