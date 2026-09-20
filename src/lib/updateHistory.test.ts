import { readFileSync } from "node:fs";
import { join } from "node:path";
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

describe("the shipped public/data/tatespun-update-history.json", () => {
  const raw: unknown = JSON.parse(
    readFileSync(join(__dirname, "..", "..", "public", "data", "tatespun-update-history.json"), "utf8")
  );
  const entries = parseUpdateHistory(raw);

  it("has no entry the Home parser would silently drop", () => {
    expect(Array.isArray(raw)).toBe(true);
    expect(entries).toHaveLength((raw as unknown[]).length);
  });

  it("keeps two entries on the same date valid, newest first (source order is display order)", () => {
    expect(entries.slice(0, 3).map((entry) => entry.date)).toEqual(["26/09/20", "26/09/20", "26/09/18"]);
  });

  it("records UX v3 Loop 3 (mobile export without visiting the Preview) for users", () => {
    const loop3 = entries[0];
    expect(loop3.title).toContain("スマホ");
    expect(loop3.title).toContain("プレビューへ切り替えずに");
    expect(loop3.detail).toContain("書き出し ▾");
    expect(loop3.type).toBe("improvement");
  });

  it("records UX v3 Loop 2 as the confirm-dialog -> explanatory warning change, not as a bare 'confirm'", () => {
    const loop2 = entries[1];
    expect(loop2.title).toContain("奇数ページ");
    expect(loop2.detail).toContain("従来の");
    expect(loop2.detail).toContain("意味と注意点を説明する警告画面");
    expect(loop2.detail).toContain("戻って確認する");
    expect(loop2.detail).toContain("このままPDFを書き出す");
    expect(loop2.detail).toContain("印刷所や本の仕様によっては白ページの追加が必要");
    expect(loop2.detail).not.toContain("window.confirm");
    expect(loop2.type).toBe("improvement");
  });
});
