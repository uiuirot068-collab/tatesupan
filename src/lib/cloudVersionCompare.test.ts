import { describe, expect, it } from "vitest";
import {
  CLOUD_COMPARE_COPY,
  isCloudVersionChanged,
  cloudCompareLocalCopyTitle,
  formatCloudVersionTime,
  isCloudVersionNewer,
} from "./cloudVersionCompare";

describe("CST-PORT-014 isCloudVersionNewer", () => {
  const base = "2026-10-03T07:00:00.123456+00:00";

  it("same updated_at is not newer", () => {
    expect(isCloudVersionNewer(base, base)).toBe(false);
  });

  it("a later save elsewhere is newer", () => {
    expect(isCloudVersionNewer("2026-10-03T07:05:00.000001+00:00", base)).toBe(true);
  });

  it("an older cloud value is not newer", () => {
    expect(isCloudVersionNewer("2026-10-03T06:59:59+00:00", base)).toBe(false);
  });

  it("compares instants, not strings (different zone notation)", () => {
    expect(isCloudVersionNewer("2026-10-03T16:00:00.123+09:00", "2026-10-03T07:00:00.123Z")).toBe(false);
    expect(isCloudVersionNewer("2026-10-03T16:00:01+09:00", "2026-10-03T07:00:00Z")).toBe(true);
  });

  it("missing or unreadable values never block saving", () => {
    expect(isCloudVersionNewer(null, base)).toBe(false);
    expect(isCloudVersionNewer(base, null)).toBe(false);
    expect(isCloudVersionNewer(undefined, undefined)).toBe(false);
    expect(isCloudVersionNewer("not a date", base)).toBe(false);
  });
});

describe("CST-PORT-014 copy helpers", () => {
  it("formats the time as M/D HH:MM in local time", () => {
    const iso = new Date(2026, 9, 3, 9, 5).toISOString();
    expect(formatCloudVersionTime(iso)).toBe("10/3 09:05");
    expect(formatCloudVersionTime(null)).toBe("—");
    expect(formatCloudVersionTime("x")).toBe("—");
  });

  it("names the kept copy after the title", () => {
    expect(cloudCompareLocalCopyTitle("夜の港")).toBe("夜の港（この端末の控え）");
    expect(cloudCompareLocalCopyTitle("  ")).toBe("無題（この端末の控え）");
  });

  it("the screen offers exactly overwrite / open cloud / cancel", () => {
    expect(CLOUD_COMPARE_COPY.overwrite).toBe("この画面の版で上書き保存");
    expect(CLOUD_COMPARE_COPY.openCloud).toBe("クラウド版を開く");
    expect(CLOUD_COMPARE_COPY.cancel).toBe("やめる");
  });
});

describe("CST-PORT-014 isCloudVersionChanged", () => {
  const base = { updatedAt: "2026-10-03T07:00:00+00:00", title: "夜の港", content: "本文" };

  it("unchanged cloud version is not changed", () => {
    expect(isCloudVersionChanged({ updated_at: base.updatedAt, title: "夜の港", content: "本文" }, base)).toBe(false);
  });

  it("a newer updated_at is changed", () => {
    expect(isCloudVersionChanged({ updated_at: "2026-10-03T07:01:00+00:00", title: "夜の港", content: "本文" }, base)).toBe(true);
  });

  it("different content with the same updated_at is still changed (time not bumped)", () => {
    expect(isCloudVersionChanged({ updated_at: base.updatedAt, title: "夜の港", content: "本文。書き足し" }, base)).toBe(true);
    expect(isCloudVersionChanged({ updated_at: base.updatedAt, title: "朝の港", content: "本文" }, base)).toBe(true);
  });

  it("no base (never opened or saved here) never blocks saving", () => {
    expect(isCloudVersionChanged({ updated_at: base.updatedAt, title: "x", content: "y" }, null)).toBe(false);
  });
});
