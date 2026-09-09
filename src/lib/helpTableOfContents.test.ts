import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { HELP_SECTION_IDS, helpSectionDomId } from "./helpSections";
import { parseHelpMarkdown, scrollToHelpSection } from "./helpTableOfContents";

const ROOT = join(__dirname, "..", "..");

describe("Help top table of contents", () => {
  it("derives ordered entries from every existing marked Help section", () => {
    const help = readFileSync(join(ROOT, "public", "docs", "help.md"), "utf8");
    const parsed = parseHelpMarkdown(help);

    expect(parsed.sections.map((section) => section.id)).toEqual([...HELP_SECTION_IDS]);
    expect(parsed.sections.every((section) => section.title.length > 0)).toBe(true);
    expect(parsed.markdown).not.toContain("<!-- help-id:");
  });

  it("moves and focuses the requested existing section", () => {
    const focus = vi.fn();
    const heading = { offsetTop: 240, focus };
    const container = {
      scrollTop: 0,
      querySelector: vi.fn(() => heading),
    } as unknown as HTMLElement;

    expect(scrollToHelpSection(container, "export", true)).toBe(true);
    expect(container.querySelector).toHaveBeenCalledWith(
      `[id="${helpSectionDomId("export")}"]`,
    );
    expect(container.scrollTop).toBe(232);
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("uses native buttons so pointer, Enter, and Space activation share one path", () => {
    const modal = readFileSync(join(ROOT, "src", "components", "HelpModal.tsx"), "utf8");
    expect(modal).toContain('data-help-table-of-contents=""');
    expect(modal).toMatch(/sections\.map[\s\S]{0,500}<button[\s\S]{0,120}type="button"/);
    expect(modal).toContain("activateTableOfContentsItem(section.id)");
    expect(modal).toContain("tabIndex={id ? -1 : undefined}");
    expect(modal).toContain("grid-cols-1");
    expect(modal).toContain("min-[420px]:grid-cols-2");
    expect(modal).toContain("overflow-y-auto overscroll-contain");
  });

  it("keeps TOC-dialog detection semantics and left-aligns its informational UI", () => {
    const dialog = readFileSync(join(ROOT, "src", "components", "BookPartsModal.tsx"), "utf8");
    expect(dialog).toContain("computeTocItemsWithOffset(");
    expect(dialog).toContain("generateTocText(tocItems)");
    expect(dialog).toMatch(/className="text-left"[\s\S]{0,500}mt-2 block[\s\S]{0,250}再検出/);
    expect(dialog).toContain('className="py-4 text-left text-gray-400"');
  });
});
