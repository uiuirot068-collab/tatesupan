"use client";

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { buildMarkSegments } from "@/lib/descriptionMarkSegments";

interface Range {
  start: number;
  end: number;
}

interface DescriptionMarkOverlayProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** The exact current textarea value: the mirror must match it 1:1 so wrapping lines up. */
  text: string;
  /** Candidate ranges in `text`'s coordinates. ONE yellow family for A / B / C (the category is in the detail, not the colour). */
  marks: readonly Range[];
}

/**
 * TSP-B5 描写語・修飾表現チェックβ marker layer: the same "highlight behind a transparent
 * textarea" mirror as WritingCheckOverlay, painting a single yellow highlight. Read-only and
 * `pointer-events: none`; never passed to Preview / export.
 */
function DescriptionMarkOverlay({ textareaRef, text, marks }: DescriptionMarkOverlayProps) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [mirrorWidth, setMirrorWidth] = useState<number | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const syncScroll = () => {
      const backdrop = backdropRef.current;
      if (!backdrop) return;
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

  useEffect(() => {
    if (marks.length === 0) return;
    const textarea = textareaRef.current;
    const backdrop = backdropRef.current;
    if (!textarea || !backdrop) return;
    backdrop.scrollTop = textarea.scrollTop;
    backdrop.scrollLeft = textarea.scrollLeft;
  }, [marks, text, textareaRef]);

  const segments = useMemo(() => (marks.length === 0 ? [] : buildMarkSegments(text, marks)), [text, marks]);

  return (
    <div ref={backdropRef} aria-hidden data-description-mark-overlay="" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-transparent"
        style={{ width: mirrorWidth ?? "100%" }}
      >
        {segments.map((segment, index) =>
          segment.marked ? (
            <span key={index} data-description-mark="" className="tsp-description-mark">
              {segment.text}
            </span>
          ) : (
            <span key={index}>{segment.text}</span>
          ),
        )}
      </div>
    </div>
  );
}

export default memo(DescriptionMarkOverlay);
