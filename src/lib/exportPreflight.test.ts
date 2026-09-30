import { describe, expect, it } from "vitest";
import {
  buildExportPreflightReport,
  canContinueExportAfterPreflight,
  exportPreflightFingerprint,
} from "./exportPreflight";

describe("export preflight foundation", () => {
  it("summarizes blocker and warning counts", () => {
    const report = buildExportPreflightReport([
      { id: "broken", severity: "blocker", title: "画像リンク切れ", pageNumbers: [5, 2, 5] },
      { id: "odd", severity: "warning", title: "奇数ページ" },
    ]);
    expect(report.blockerCount).toBe(1);
    expect(report.warningCount).toBe(1);
    expect(report.ok).toBe(false);
    expect(report.issues[0].pageNumbers).toEqual([2, 5]);
  });

  it("requires opening/review even when there are no problems", () => {
    const report = buildExportPreflightReport([]);
    expect(report.ok).toBe(true);
    expect(canContinueExportAfterPreflight(report, false)).toBe(false);
    expect(canContinueExportAfterPreflight(report, true)).toBe(true);
  });

  it("allows reviewed warnings but never reviewed blockers", () => {
    const warning = buildExportPreflightReport([
      { id: "odd", severity: "warning", title: "奇数ページ" },
    ]);
    const blocker = buildExportPreflightReport([
      { id: "broken", severity: "blocker", title: "画像リンク切れ" },
    ]);
    expect(canContinueExportAfterPreflight(warning, true)).toBe(true);
    expect(canContinueExportAfterPreflight(blocker, true)).toBe(false);
  });

  it("changes the review fingerprint when the current target issues change", () => {
    const a = buildExportPreflightReport([
      { id: "broken", severity: "blocker", title: "画像リンク切れ", pageNumbers: [3] },
    ]);
    const b = buildExportPreflightReport([
      { id: "broken", severity: "blocker", title: "画像リンク切れ", pageNumbers: [4] },
    ]);
    expect(exportPreflightFingerprint(a)).not.toBe(exportPreflightFingerprint(b));
  });
});
