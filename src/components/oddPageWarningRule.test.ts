import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { shouldWarnOddPageExport } from "./oddPageWarningRule";

describe("shouldWarnOddPageExport -- the exact condition window.confirm used to gate", () => {
  it("1. even total page count -> bypasses the warning (null)", () => {
    expect(
      shouldWarnOddPageExport({ scope: "all", bodyPageCount: 10, includeColophon: false })
    ).toBeNull();
  });

  it("2. odd total page count on a whole-book export -> opens the warning", () => {
    expect(
      shouldWarnOddPageExport({ scope: "all", bodyPageCount: 11, includeColophon: false })
    ).toEqual({ totalPages: 11 });
  });

  it("includes the colophon page in the total (the original 奥付 ON も物理的な1枚 rule)", () => {
    // 10 body pages + colophon = 11 (odd) -> warns
    expect(
      shouldWarnOddPageExport({ scope: "all", bodyPageCount: 10, includeColophon: true })
    ).toEqual({ totalPages: 11 });
    // 9 body pages + colophon = 10 (even) -> bypasses
    expect(
      shouldWarnOddPageExport({ scope: "all", bodyPageCount: 9, includeColophon: true })
    ).toBeNull();
  });

  it("never warns for a selected-page export, odd or even -- preserves the original scope-'all'-only condition", () => {
    expect(
      shouldWarnOddPageExport({ scope: "selected", bodyPageCount: 11, includeColophon: false })
    ).toBeNull();
    expect(
      shouldWarnOddPageExport({ scope: "selected", bodyPageCount: 10, includeColophon: false })
    ).toBeNull();
  });
});

describe("PreviewPane.tsx source guards (TSP-UX-V3-LOOP2-ODD-PAGE-012)", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./PreviewPane.tsx", import.meta.url)),
    "utf-8"
  );

  it("10. no window.confirm remains in the export flow", () => {
    expect(source).not.toContain("window.confirm(");
  });

  it("primary action resumes the SAME pending export via runPdfExport, not a second export path", () => {
    expect(source).toContain("void runPdfExport(pending);");
  });

  it("11. no blank/synthetic page is ever pushed into the manuscript to fix odd-page count", () => {
    // The odd-page path only ever calls setOddPageWarning -- it must never
    // touch page count state (setPages / page insertion helpers).
    expect(source).not.toMatch(/setOddPageWarning[\s\S]{0,400}(setPages|insertPage|addBlankPage)/);
  });
});
