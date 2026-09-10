import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(path), "utf8");

describe("final drawer visual hierarchy", () => {
  const settings = source("src/components/PageSettingsPanel.tsx");
  const options = source("src/components/EditorOptionsDrawer.tsx");

  it("keeps Settings controls under full-width drawer-only section bars", () => {
    expect(settings).toMatch(
      /data-settings-section="page" className="[^"]*w-full[^"]*bg-ink\/\[0\.045\][^"]*">用紙・本文/,
    );
    expect(settings).toMatch(
      /data-settings-section="master" className="[^"]*w-full[^"]*bg-ink\/\[0\.045\][^"]*">ページ・ノンブル・柱/,
    );
    expect(settings.match(/data-settings-section=/g)).toHaveLength(2);
    expect(settings).toContain("settingsOnly && <h3");
    expect(settings).toContain("設定を反映");
    expect(settings).toContain("柱を反映");
  });

  it("flattens only the four simple Options sections and keeps TXT grouped", () => {
    expect(options).toContain(
      'const flatOptionClass = "border-b border-ink/10 pb-3"',
    );
    expect(options).toContain(
      'const groupedOptionClass = "rounded-xl border border-ink/15 bg-base p-3"',
    );

    for (const id of ["vertical-colophon", "horizontal-colophon", "toc", "checklist"]) {
      expect(options).toContain(
        `data-editor-option="${id}" className={flatOptionClass}`,
      );
    }
    expect(options).toContain(
      'data-editor-option="txt-transfer" className={groupedOptionClass}',
    );
    expect(options.match(/onClick=\{\(\) => open\(/g)).toHaveLength(7);
  });
});

describe("Help TOC readability", () => {
  const help = source("src/components/HelpModal.tsx");

  it("uses a close custom marker and normal secondary-navigation text size", () => {
    expect(help).toContain("!list-none");
    expect(help).toContain("!pl-0");
    expect(help).toContain('className="flex min-w-0 items-start gap-1"');
    expect(help).toContain('aria-hidden="true"');
    expect(help).toContain("min-w-0 flex-1 truncate rounded px-0.5 py-1 text-left text-sm");
    expect(help).not.toContain("px-1.5 py-1 text-left text-xs text-accent");
  });

  it("preserves responsive columns, scrolling, and the existing anchor action", () => {
    expect(help).toContain("grid-cols-1");
    expect(help).toContain("min-[420px]:grid-cols-2");
    expect(help).toContain("overflow-y-auto overscroll-contain");
    expect(help).toContain("activateTableOfContentsItem(section.id)");
  });
});
