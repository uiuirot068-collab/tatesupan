import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildOddPageWarningTitle,
  ODD_PAGE_WARNING_CONTINUE_LABEL,
  ODD_PAGE_WARNING_EXPLANATION,
  ODD_PAGE_WARNING_MEANING,
  ODD_PAGE_WARNING_RETURN_LABEL,
} from "./oddPageWarningCopy";

/**
 * OddPageExportWarning.tsx wraps everything in ViewportModal, which renders
 * null outside a real browser DOM (`typeof document === "undefined"` is
 * always true in Node) -- so `renderToStaticMarkup` can never see this
 * component's output in this repo's Node-only (no jsdom) vitest environment.
 * The copy itself is tested directly as plain data instead (oddPageWarningCopy.ts),
 * and this file source-checks that OddPageExportWarning.tsx actually wires
 * that same data in rather than duplicating/drifting strings.
 */
describe("odd-page warning canonical copy", () => {
  it("3. heading includes the actual total page count", () => {
    expect(buildOddPageWarningTitle(13)).toBe("全体が奇数ページです（全 13 ページ）");
    expect(buildOddPageWarningTitle(13)).toContain("13");
  });

  it("meaning/explanation/button copy matches the canonical text exactly", () => {
    expect(ODD_PAGE_WARNING_MEANING).toBe("冊子にすると、最後の見開きの片側が空く構成です。");
    expect(ODD_PAGE_WARNING_EXPLANATION).toBe(
      "PDFはこのまま書き出せます。ただし、印刷所や本の仕様によっては白ページの追加が必要です。入稿先の指定を確認してください。"
    );
    expect(ODD_PAGE_WARNING_CONTINUE_LABEL).toBe("このままPDFを書き出す");
    expect(ODD_PAGE_WARNING_RETURN_LABEL).toBe("戻って確認する");
  });

  it("does not overclaim -- never says odd pages are always fine, a blank page is always required, or every printer accepts it", () => {
    const allCopy = [
      ODD_PAGE_WARNING_MEANING,
      ODD_PAGE_WARNING_EXPLANATION,
      ODD_PAGE_WARNING_CONTINUE_LABEL,
      ODD_PAGE_WARNING_RETURN_LABEL,
    ].join("\n");
    expect(allCopy).not.toMatch(/問題ありません|常に必要|すべての印刷所/);
  });
});

describe("OddPageExportWarning.tsx wiring", () => {
  const source = readFileSync(
    fileURLToPath(new URL("./OddPageExportWarning.tsx", import.meta.url)),
    "utf-8"
  );

  it("uses the shared canonical copy module, not inline duplicate strings", () => {
    expect(source).toContain("buildOddPageWarningTitle(totalPages)");
    expect(source).toContain("{ODD_PAGE_WARNING_MEANING}");
    expect(source).toContain("{ODD_PAGE_WARNING_EXPLANATION}");
  });

  it("reuses ViewportModal (dialog semantics, Escape-as-safe-return) instead of a bespoke dialog", () => {
    expect(source).toContain('import ViewportModal from "./ViewportModal"');
    expect(source).toContain("<ViewportModal");
  });

  it("primary/secondary actions are distinct data hooks wired to the two distinct callbacks", () => {
    expect(source).toContain('data-pdf-odd-page-warning-action="continue"');
    expect(source).toContain('data-pdf-odd-page-warning-action="return"');
    expect(source).toContain("onClick={onContinue}");
    expect(source).toContain("onClick={onReturn}");
  });
});
