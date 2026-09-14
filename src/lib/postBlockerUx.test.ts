import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("Pause modal UI contract", () => {
  const tracker = source("src/components/WorkSessionTracker.tsx");
  const modal = source("src/components/ViewportModal.tsx");

  it("pauses through the canonical callback before opening one UI-only panel", () => {
    const pause = tracker.slice(
      tracker.indexOf("const pause = () =>"),
      tracker.indexOf("const resume = () =>")
    );

    expect(pause.indexOf("onPause();")).toBeGreaterThanOrEqual(0);
    expect(pause.indexOf('setPanel("pause")')).toBeGreaterThan(pause.indexOf("onPause();"));
    expect(tracker.match(/setInterval/g)).toHaveLength(1);
    expect(tracker).not.toContain("pauseBanner");
  });

  it("offers close-only, canonical Resume, and the existing End flow", () => {
    expect(tracker).toContain('title="一時停止中"');
    expect(tracker).toContain("作業時間のカウントを停止しています。");
    expect(tracker).toContain("一時停止の窓を閉じる");
    expect(tracker).toContain("作業を再開する");
    expect(tracker).toContain("今日の作業を終了する");
    expect(tracker).toContain("onResume={resume}");
    expect(tracker).toContain("onEnd={end}");
  });

  it("routes X, Escape, backdrop, and the explicit close action to close-only", () => {
    expect(tracker).toContain("onClose={closePanel}");
    expect(tracker).toContain('data-work-session-pause-action="close"');
    expect(modal).toContain("onClick={onClose}");
    expect(modal).toContain('event.key !== "Escape"');
    expect(modal).not.toContain("onResume");
  });
});

describe("Desktop Focus Mode visibility contract", () => {
  const pane = source("src/components/EditorPane.tsx");
  const editor = source("src/components/TategakiEditor.tsx");

  it.each(["settings", "options", "help"])(
    "hides %s at md+ from the canonical focusMode flag",
    (control) => {
      const start = pane.indexOf(`data-editor-secondary="${control}"`);
      const button = pane.slice(start, pane.indexOf("</button>", start));
      expect(button).toContain('focusMode ? "md:hidden" : ""');
    }
  );

  it("suppresses Writing Check, ruby help, work counter, and manuscript count together", () => {
    const writingSurface = pane.slice(
      pane.indexOf('data-writing-check-surface=""'),
      pane.indexOf("<WritingCheckBar")
    );
    const statusSurface = pane.slice(
      pane.indexOf('data-editor-status-surfaces=""'),
      pane.indexOf("</div>\n    </div>\n  );")
    );

    expect(writingSurface).toContain('focusMode ? "max-md:hidden md:hidden" : ""');
    expect(statusSurface).toContain('focusMode ? "max-md:hidden md:hidden" : ""');
    expect(statusSurface).toContain('data-ruby-tcy-status=""');
    expect(statusSurface).toContain("<WorkSessionTracker");
    expect(statusSurface).toContain('title="現在の原稿文字数"');
  });

  it("keeps the established mobile suppression and Preview collapse behavior", () => {
    const secondaryWrapper = pane.slice(
      pane.lastIndexOf('<div className={focusMode ? "hidden" : ""}', pane.indexOf('data-editor-secondary="settings"')),
      pane.indexOf('data-editor-secondary="settings"')
    );

    expect(secondaryWrapper).toContain('focusMode ? "hidden" : ""');
    expect(editor).toContain("setIsPreviewCollapsed(true);");
    expect(editor).toContain("setIsPreviewCollapsed(preFocusPreviewCollapsedRef.current);");
    expect(editor).toContain("focusMode={focusMode}");
  });
});
