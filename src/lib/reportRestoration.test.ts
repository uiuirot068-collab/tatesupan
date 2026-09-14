import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("Report action restoration", () => {
  const pane = source("src/components/EditorPane.tsx");
  const shell = source("src/components/TategakiEditor.tsx");
  const options = source("src/components/EditorOptionsDrawer.tsx");
  const row = pane.slice(
    pane.indexOf('data-editor-action-row=""'),
    pane.indexOf('<div className={focusMode ? "hidden" : ""}')
  );
  const report = row.slice(
    row.indexOf('data-editor-action="report"'),
    row.indexOf("</button>", row.indexOf('data-editor-action="report"'))
  );

  it("keeps Report as the last primary action, directly after Replace and the focus-mode-only Memo entry", () => {
    const replaceIndex = row.indexOf('data-editor-action="replace"');
    const memoIndex = row.indexOf('data-editor-action="memo"');
    const reportIndex = row.indexOf('data-editor-action="report"');
    const replaceEnd = row.indexOf("</button>", replaceIndex);
    const memoEnd = row.indexOf("</button>", memoIndex);
    expect(replaceIndex).toBeGreaterThanOrEqual(0);
    expect(memoIndex).toBeGreaterThan(replaceEnd);
    expect(reportIndex).toBeGreaterThan(memoEnd);
    expect(row.slice(replaceEnd, memoIndex)).not.toContain('data-editor-action="');
    expect(row.slice(memoEnd, reportIndex)).not.toContain('data-editor-action="');
    expect(report).toContain("報告");
  });

  it("uses the established yellow beta-feedback action style", () => {
    expect(report).toContain("border-amber-400");
    expect(report).toContain("bg-amber-50");
    expect(report).toContain("text-amber-800");
    expect(report).toContain("hover:bg-amber-100");
    expect(report).toContain("whitespace-nowrap");
  });

  it("opens the existing modal only through the explicit click handler", () => {
    expect(report).toContain("onClick={onOpenBetaFeedback}");
    expect(shell).toContain(
      "onOpenBetaFeedback={BETA_FEEDBACK_ENABLED ? () => setIsBetaFeedbackOpen(true) : undefined}"
    );
    expect(shell).toContain(
      "<BetaFeedbackModal onClose={() => setIsBetaFeedbackOpen(false)} />"
    );
    expect(options).not.toContain("onOpenFeedback");
  });

  it("does not mutate manuscript content or Work Session activity", () => {
    expect(report).not.toContain("onContentChange");
    expect(report).not.toContain("onRecordActivity");
    expect(report).not.toContain("recordActivity");
    expect(shell).toContain("() => setIsBetaFeedbackOpen(true)");
  });
});

describe("Report action responsive contract", () => {
  const pane = source("src/components/EditorPane.tsx");
  const row = pane.slice(
    pane.indexOf('data-editor-action-row=""'),
    pane.indexOf('<div className={focusMode ? "hidden" : ""}')
  );

  it.each([320, 375, 390, 430])(
    "keeps Report visible in the compact five-action row at %ipx",
    (viewportWidth) => {
      const editorHorizontalPadding = 16;
      const fixedTracks = 44 + 44;
      const contentTracks = 88 + 40 + 40;
      const fourGaps = 4 * 2;
      const requiredWidth = fixedTracks + contentTracks + fourGaps;

      expect(requiredWidth).toBeLessThanOrEqual(viewportWidth - editorHorizontalPadding);
      expect(row).toContain(
        "grid-cols-[44px_44px_max-content_max-content_max-content]"
      );
      expect(row).toContain("gap-0.5");
      expect(row).toContain("max-w-full");
      expect(row).not.toMatch(/\sflex-wrap(?:\s|\")/);
      // 3 always-visible nowrap actions (page-break, replace, report) plus
      // the focus-mode-only Memo and exit-focus entries.
      expect(row.match(/whitespace-nowrap/g)).toHaveLength(5);
      expect(row).toContain('data-editor-action="report"');
    }
  );
});
