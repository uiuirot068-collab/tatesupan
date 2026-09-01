"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  buildWritingSegments,
  mergeIssueRanges,
  type WritingIssue,
} from "@/lib/writingCheck";

interface WritingCheckOverlayProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** The exact current textarea value — the mirror must match it 1:1 so wrapping lines up. */
  text: string;
  /** Issues computed against `text`. Pass `[]` while a re-check is pending so no underline lands on a stale offset. */
  issues: WritingIssue[];
}

/**
 * TSP-LOOP-004 「文章チェック β」 overlay.
 *
 * A read-only mirror rendered directly behind the editor textarea (the
 * "highlight behind a transparent textarea" pattern). The textarea stays the
 * sole input surface: this element is `pointer-events: none`, its own text is
 * transparent, and only the issue ranges carry a red wavy underline.
 *
 * The mirror copies every box-model property that affects wrapping from the
 * textarea via shared Tailwind classes (`p-4 font-mono text-sm
 * leading-relaxed`, `whitespace-pre-wrap break-words`, `box-sizing:
 * border-box` from preflight) plus a JS-measured content width, and follows
 * the textarea's vertical scroll. Nothing here is ever passed to the preview
 * renderer or an export — see PreviewPane / exportImage / exportPdf, which
 * only ever read the document string.
 */
export default function WritingCheckOverlay({
  textareaRef,
  text,
  issues,
}: WritingCheckOverlayProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  // The textarea's content-box width (px). Set from JS because the textarea's
  // scrollbar narrows its content area — matching it keeps soft-wrap points
  // identical between the two.
  const [mirrorWidth, setMirrorWidth] = useState<number | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const syncScroll = () => {
      const backdrop = backdropRef.current;
      if (!backdrop) return;
      // `overflow: hidden` still honours a programmatic scrollTop when the
      // inner content overflows — the standard sync for this pattern.
      backdrop.scrollTop = textarea.scrollTop;
      backdrop.scrollLeft = textarea.scrollLeft;
    };
    const measure = () => setMirrorWidth(textarea.clientWidth);

    measure();
    syncScroll();
    textarea.addEventListener("scroll", syncScroll, { passive: true });
    const resizeObserver = new ResizeObserver(() => {
      measure();
      syncScroll();
    });
    resizeObserver.observe(textarea);

    return () => {
      textarea.removeEventListener("scroll", syncScroll);
      resizeObserver.disconnect();
    };
  }, [textareaRef]);

  // The content height changes whenever the text (or an underline) changes;
  // re-sync on every render so the mirror can't sit a frame behind after an
  // edit that shifted the scroll position.
  useEffect(() => {
    const textarea = textareaRef.current;
    const backdrop = backdropRef.current;
    if (!textarea || !backdrop) return;
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  });

  const segments = useMemo(
    () => buildWritingSegments(text, mergeIssueRanges(issues)),
    [text, issues]
  );

  return (
    <div
      ref={backdropRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div
        className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-transparent"
        style={{ width: mirrorWidth ?? "100%" }}
      >
        {segments.map((segment, index) =>
          segment.flagged ? (
            <span key={index} className="tsp-writing-wavy">
              {segment.text}
            </span>
          ) : (
            <span key={index}>{segment.text}</span>
          )
        )}
      </div>
    </div>
  );
}
