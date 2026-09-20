import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { describeExportMenu, PDF_UNAVAILABLE_NOTE } from "./exportMenuEntries";
import { shouldWarnOddPageExport } from "./oddPageWarningRule";

/**
 * TSP-UX-V3-LOOP3-MOBILE-SHARED-EXPORT. This repo's vitest environments are
 * Node-only (no jsdom), so -- like keyboardCompactLayout.test.ts and
 * oddPageWarningRule.test.ts -- structure is asserted against the source files
 * and pure logic is asserted directly. The real-browser behavior is covered by
 * `npm run test:e2e:mobile-shared-export`.
 */
const SRC = join(__dirname, "..");
const read = (...parts: string[]) => readFileSync(join(SRC, ...parts), "utf8");
const preview = read("components", "PreviewPane.tsx");
const nav = read("components", "MobileEditorNav.tsx");
const editor = read("components", "TategakiEditor.tsx");
const sharedHook = read("hooks", "useMobileSharedExport.ts");

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe("A. desktop regression -- the Preview's own 書き出し ▾ is intact", () => {
  it("keeps the header 書き出し ▾ button, its label, disabled rule and fixed-position dropdown", () => {
    expect(preview).toContain('data-demo-target="export"');
    expect(preview).toContain('"書き出し ▾"');
    expect(preview).toContain("disabled={isExporting || pages.length === 0}");
    expect(preview).toContain("isExportMenuOpen && exportMenuPos");
    expect(preview).toContain('position: "fixed", top: exportMenuPos.top, left: exportMenuPos.left');
  });

  it("closes the dropdown and then runs the entry's handler (same order as before)", () => {
    expect(preview).toMatch(/setIsExportMenuOpen\(false\);\s*void entry\.run\(\);/);
  });

  it("lists the same entries, in the same order, as before Loop 3", () => {
    const labels = (colophon: boolean) => describeExportMenu({ showColophon: colophon, pdfUnavailable: false }).map((e) => e.label);
    expect(labels(false)).toEqual(["JPG", "JPG一括（個別ダウンロード）", "JPG ZIP", "PDF"]);
    expect(labels(true)).toEqual(["JPG", "JPG一括（個別ダウンロード）", "JPG ZIP", "奥付ページ（JPG）", "PDF"]);
  });

  it("still disables PDF (with the same explanation) for Web閲覧用 paper presets", () => {
    const pdf = describeExportMenu({ showColophon: false, pdfUnavailable: true }).find((e) => e.id === "pdf");
    expect(pdf?.disabled).toBe(true);
    expect(pdf?.disabledReason).toContain("Web閲覧用はJPGで書き出してください");
    expect(PDF_UNAVAILABLE_NOTE).toContain("PDF書き出しは印刷用の用紙サイズで利用できます。");
    expect(describeExportMenu({ showColophon: false, pdfUnavailable: false }).some((e) => e.disabled)).toBe(false);
  });
});

describe("B. mobile accessibility -- reachable from the phone Editor view without visiting the Preview", () => {
  it("MobileEditorNav renders a 書き出し ▾ entry with the shared label", () => {
    expect(nav).toContain("data-mobile-export-trigger");
    expect(nav).toContain("書き出し ▾");
    expect(nav).toContain('aria-haspopup="dialog"');
  });

  it("the entry is not tied to which workspace is showing (Editor OR Preview) -- only 集中モード hides it", () => {
    const start = nav.indexOf("{onOpenExport &&");
    const entry = nav.slice(start, nav.indexOf("</button>", start));
    expect(entry).toContain("!focusMode");
    expect(entry).not.toContain("mobileView");
  });

  it("stays inside the phone-only sticky nav (md:hidden) and does not add a row to it", () => {
    expect(nav).toMatch(/sticky top-0 z-40[^"]*md:hidden/);
    expect(nav).toContain('<div className="flex items-center gap-2 text-xs">'); // 2nd row unchanged from before Loop 3
  });

  it("opening the export UI never switches the workspace to the Preview", () => {
    expect(sharedHook).not.toContain("setMobileView");
    expect(sharedHook).not.toContain("showPreviewView");
    expect(sharedHook).not.toContain("mobileView ="); // never assigns the workspace
    expect(editor).toContain("onOpenExport={sharedExport.openMobileExport}");
    expect(editor).not.toMatch(/openMobileExport[^;]*showPreviewView/);
  });

  it("export availability does not depend on the Preview being visible: the Preview is staged off-screen for the export", () => {
    expect(editor).toContain("sharedExport.previewExportStaged ? PREVIEW_EXPORT_STAGE_CLASS");
    expect(sharedHook).toContain("shouldStagePreviewForExport");
    // begin/finish are reported from the shared begin/finish helpers every handler already uses
    expect(preview).toMatch(/onExportActiveChangeRef\.current\?\.\(true\)/);
    expect(preview).toMatch(/onExportActiveChangeRef\.current\?\.\(false\)/);
  });

  it("uses the existing ViewportModal contract (portal, Escape, focus restore) for the sheet", () => {
    const sheet = preview.slice(preview.indexOf("{mobileExportOpen && ("), preview.indexOf("{oddPageWarning && ("));
    expect(sheet).toContain("<ViewportModal");
    expect(sheet).toContain('"data-editor-export-sheet"');
    expect(sheet).toContain('title="書き出し"');
    expect(sheet).toContain("onClose={() => onMobileExportClose?.()}");
  });
});

describe("C. shared contract -- one export implementation, two entry points", () => {
  it("both the desktop dropdown and the phone sheet render the SAME entries list", () => {
    expect(count(preview, "exportMenuEntries.map(")).toBe(2);
    expect(count(preview, "const exportMenuEntries =")).toBe(1);
  });

  it("ids are bound to PreviewPane's own handlers in exactly one place", () => {
    const binding = preview.slice(preview.indexOf("const exportMenuHandlers"), preview.indexOf("const exportMenuEntries ="));
    for (const handler of ["handleExportJpg", "handleExportJpgBatch", "handleExportZip", "handleExportColophonJpg", "handleOpenPdfModal"]) {
      expect(binding).toContain(`: ${handler}`);
      expect(count(preview, `const ${handler} = `)).toBe(1); // still defined exactly once
    }
  });

  it("the phone sheet does not add its own export logic (no capture/encode/save calls outside PreviewPane's handlers)", () => {
    for (const source of [nav, editor, sharedHook]) {
      for (const forbidden of ["saveAs", "exportCustomPdf", "exportPageToJpg", "exportPagesToZip", "exportV2", "jsPDF", "capturePageToCanvas", "html-to-image"]) {
        expect(source).not.toContain(forbidden);
      }
    }
    const sheet = preview.slice(preview.indexOf("{mobileExportOpen && ("), preview.indexOf("{oddPageWarning && ("));
    expect(sheet).toMatch(/onMobileExportClose\?\.\(\);\s*void entry\.run\(\);/);
    for (const forbidden of ["exportPageToJpg", "exportCustomPdf", "exportPagesToZip", "beginExport", "saveAs"]) {
      expect(sheet).not.toContain(forbidden);
    }
  });

  it("does not duplicate page/selection state on the phone (uses the canonical selected pages and content)", () => {
    expect(sharedHook).not.toMatch(/useState<Set</);
    expect(sharedHook).not.toContain("selectedPages");
    expect(sharedHook).not.toContain("content");
    expect(count(editor, "selected={selectedPages}")).toBe(1);
  });

  it("the phone nav opens the menu but never decides what to export", () => {
    expect(nav).not.toContain("pdf");
    expect(nav).not.toContain("jpg");
  });
});

describe("D. PDF Loop 2 contract is untouched", () => {
  it("still routes every PDF through the odd-page rule and runPdfExport (no second path)", () => {
    expect(preview).toContain("shouldWarnOddPageExport({");
    expect(preview).toMatch(/scope: pdfScope,\s*bodyPageCount: pages\.length,\s*includeColophon: includeColophonInPdf/);
    expect(preview).toContain("await runPdfExport(pending)");
    expect(preview).toContain("void runPdfExport(pending)");
  });

  it("never brings window.confirm back into the export flow", () => {
    // (TategakiEditor keeps its own unrelated, pre-existing confirm for TXT import.)
    for (const source of [preview, nav, sharedHook]) expect(source).not.toContain("window.confirm(");
  });

  it("all-pages PDF: odd (body + colophon) warns, even does not", () => {
    expect(shouldWarnOddPageExport({ scope: "all", bodyPageCount: 1, includeColophon: false })).toEqual({ totalPages: 1 });
    expect(shouldWarnOddPageExport({ scope: "all", bodyPageCount: 2, includeColophon: false })).toBeNull();
    expect(shouldWarnOddPageExport({ scope: "all", bodyPageCount: 3, includeColophon: false })).toEqual({ totalPages: 3 });
    expect(shouldWarnOddPageExport({ scope: "all", bodyPageCount: 4, includeColophon: false })).toBeNull();
  });

  it("colophon parity: the 奥付 page counts as one physical page", () => {
    expect(shouldWarnOddPageExport({ scope: "all", bodyPageCount: 2, includeColophon: true })).toEqual({ totalPages: 3 });
    expect(shouldWarnOddPageExport({ scope: "all", bodyPageCount: 3, includeColophon: true })).toBeNull();
  });

  it("selected-page PDF is never a warning target, odd or even", () => {
    for (const bodyPageCount of [1, 2, 3, 4]) {
      for (const includeColophon of [false, true]) {
        expect(shouldWarnOddPageExport({ scope: "selected", bodyPageCount, includeColophon })).toBeNull();
      }
    }
  });
});

describe("E. modals reused as-is by the phone entry", () => {
  it("PDF setup, odd-page warning (Return / Continue) and progress all live in PreviewPane and are not re-implemented", () => {
    expect(count(preview, "<OddPageExportWarning")).toBe(1);
    expect(count(preview, 'titleId="pdf-export-setup-title"')).toBe(1);
    expect(preview).toContain("onReturn={handleOddPageWarningReturn}");
    expect(preview).toContain("onContinue={handleOddPageWarningContinue}");
    expect(preview).toContain("<ExportProgressModal");
    for (const source of [nav, editor, sharedHook]) {
      expect(source).not.toContain("OddPageExportWarning");
      expect(source).not.toContain("ExportProgressModal");
      expect(source).not.toContain("pdf-export-setup");
    }
  });
});

describe("F. guardrails: FQ-04 keyboard chrome, 集中モード and mobile view are untouched", () => {
  it("the keyboard-compact rule is unchanged (still hides only header slot, secondary row and title)", () => {
    const css = read("app", "globals.css");
    expect(css).toContain("[data-editor-shell][data-keyboard-active] [data-editor-header-slot]");
    expect(css).toContain("[data-editor-shell][data-keyboard-active] [data-editor-secondary-row]");
    expect(css).toContain('[data-editor-shell][data-keyboard-active] [data-demo-target="title"]');
    expect(css).not.toMatch(/data-keyboard-active[^{]*data-mobile-export/);
    expect(editor).toContain('data-keyboard-active={keyboardActive ? "" : undefined}');
    expect(editor).toContain("mobileShellHeightStyle(visibleHeight)");
  });

  it("the nav takes no keyboard/focus props of its own (focus mode still only swaps its own label)", () => {
    expect(nav).not.toContain("keyboardActive");
    expect(nav).toContain('focusMode ? "通常表示に戻す" : "⤢ 集中モード"');
  });

  it("Preview collapse/focus-mode state is only re-expanded on an explicit export request", () => {
    expect(sharedHook).toMatch(/if \(isPreviewCollapsed\) setIsPreviewCollapsed\(false\);\s*setIsOpen\(true\);/);
    expect(editor).toContain("isCollapsed={isPreviewCollapsed && mobileView !== \"preview\"}");
  });
});
