import { describe, expect, it } from "vitest";
import { contentHash, decideDeviceCopy } from "./cloudDeviceCopy";

// TSP-SAFE-001: when a cloud work is opened, what happens to its device copy.
describe("decideDeviceCopy", () => {
  const cloud = { updatedAt: "2026-10-13T00:00:00Z", hash: contentHash("題", "クラウド") };
  const synced = { projectId: "p", updatedAt: cloud.updatedAt, hash: cloud.hash };

  it("makes a copy the first time", () => {
    expect(decideDeviceCopy(null, cloud)).toBe("create");
  });

  it("follows the cloud when the copy has nothing unsent", () => {
    const newer = { updatedAt: "2026-10-13T05:00:00Z", hash: contentHash("題", "新しい") };
    expect(decideDeviceCopy({ hash: synced.hash, sync: synced }, newer)).toBe("replace");
  });

  it("opens the copy as it is when only the copy changed", () => {
    expect(decideDeviceCopy({ hash: contentHash("題", "クラウド＋書き足し"), sync: synced }, cloud)).toBe("keep-local");
  });

  it("keeps the copy's text separately when both changed", () => {
    const newer = { updatedAt: "2026-10-13T05:00:00Z", hash: contentHash("題", "新しい") };
    expect(decideDeviceCopy({ hash: contentHash("題", "クラウド＋書き足し"), sync: synced }, newer)).toBe("rescue-then-replace");
  });

  it("never overwrites a copy whose last matched version is unknown", () => {
    expect(decideDeviceCopy({ hash: contentHash("題", "どこかで書いた"), sync: null }, cloud)).toBe("rescue-then-replace");
    expect(decideDeviceCopy({ hash: cloud.hash, sync: null }, cloud)).toBe("replace");
  });

  it("tells texts apart by title and content", () => {
    expect(contentHash("a", "bc")).not.toBe(contentHash("ab", "c"));
    expect(contentHash("題", "本文")).toBe(contentHash("題", "本文"));
  });
});
