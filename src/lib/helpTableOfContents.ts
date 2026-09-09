import {
  helpSectionDomId,
  isHelpSectionId,
  type HelpSectionId,
} from "./helpSections";

const HEADING_MARKER_RE =
  /^(#{1,6})[ \t]+(.*?)[ \t]*<!--[ \t]*help-id:[ \t]*([a-z0-9-]+)[ \t]*-->[ \t]*$/;
const MARKER_STRIP_RE = /[ \t]*<!--[ \t]*help-id:[ \t]*[a-z0-9-]+[ \t]*-->/g;

export interface HelpTableOfContentsItem {
  id: HelpSectionId;
  title: string;
}

export interface ParsedHelpMarkdown {
  markdown: string;
  headingIds: Map<string, HelpSectionId>;
  sections: HelpTableOfContentsItem[];
}

/** Parses the existing marked Help headings without deriving unstable ids. */
export function parseHelpMarkdown(rawInput: string): ParsedHelpMarkdown {
  const raw = rawInput.replace(/\r\n?/g, "\n");
  const headingIds = new Map<string, HelpSectionId>();
  const sections: HelpTableOfContentsItem[] = [];
  for (const line of raw.split("\n")) {
    const match = line.match(HEADING_MARKER_RE);
    if (!match || !isHelpSectionId(match[3])) continue;
    const title = match[2].trim();
    const id = match[3];
    headingIds.set(title, id);
    sections.push({ id, title });
  }
  return { markdown: raw.replace(MARKER_STRIP_RE, ""), headingIds, sections };
}

/** Scrolls the Help body to an existing section and optionally moves focus. */
export function scrollToHelpSection(
  container: HTMLElement,
  sectionId: HelpSectionId,
  focus = false,
): boolean {
  const heading = container.querySelector<HTMLElement>(
    `[id="${helpSectionDomId(sectionId)}"]`,
  );
  if (!heading) return false;
  container.scrollTop = Math.max(0, heading.offsetTop - 8);
  if (focus) heading.focus({ preventScroll: true });
  return true;
}
