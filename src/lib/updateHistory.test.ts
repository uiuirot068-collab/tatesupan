import { describe, expect, it } from "vitest";
import { parseUpdateHistory } from "./updateHistory";

describe("parseUpdateHistory", () => {
  it("keeps valid public history entries in source order", () => {
    const result = parseUpdateHistory([
      {
        date: "26/09/18",
        title: "PDF書き出しを改善しました",
        detail: "出力形式の説明を追加しました。",
        type: "improvement",
      },
      {
        date: "26/09/17",
        title: "不具合を修正しました",
        detail: "入力時の問題を修正しました。",
        type: "fix",
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]?.date).toBe("26/09/18");
    expect(result[1]?.type).toBe("fix");
  });

  it("drops malformed entries instead of breaking the Home page", () => {
    const result = parseUpdateHistory([
      null,
      { date: "2026-09-18", title: "bad date", detail: "x" },
      { date: "26/09/18", title: "", detail: "x" },
      { date: "26/09/18", title: "x", detail: "", type: "fix" },
      { date: "26/09/18", title: "x", detail: "x", type: "unknown" },
      { date: "26/09/18", title: "ok", detail: "ok" },
    ]);

    expect(result).toEqual([
      { date: "26/09/18", title: "ok", detail: "ok" },
    ]);
  });

  it("returns an empty list for a non-array JSON root", () => {
    expect(parseUpdateHistory({ entries: [] })).toEqual([]);
  });
});
