"use client";

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { buildCategorySegments, buildMarkSegments, type MarkCategory } from "@/lib/descriptionMarkSegments";

interface Range {
  start: number;
  end: number;
  /** B5 candidates carry their category (each gets its own subtle tint of the SAME yellow family). */
  category?: MarkCategory;
}

interface DescriptionMarkOverlayProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** The exact current textarea value: the mirror must match it 1:1 so wrapping lines up. */
  text: string;
  /** Ranges in `text`'s coordinates. */
  marks: readonly Range[];
  /**
   * "description" (default): B5 candidates — one class per category, all in the same yellow family (colour means
   * CATEGORY ONLY, never severity; the category is also always written out in the detail).
   * "held": B4's ghost highlight of the stored 選択範囲 while the editor is not painting its native selection.
   */
  variant?: "description" | "held";
}

/**
 * TSP-B5 描写語・修飾表現チェックβ marker layer: the same "highlight behind a transparent
 * textarea" mirror as WritingCheckOverlay, painting a single yellow highlight. Read-only and
 * `pointer-events: none`; never passed to Preview / export.
 */
function DescriptionMarkOverlay({ textareaRef, text, marks, variant = "description" }: DescriptionMarkOverlayProps) {
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

  const segments = useMemo(() => {
    if (marks.length === 0) return [];
    if (variant === "held") return buildMarkSegments(text, marks).map((segment) => ({ text: segment.text, category: segment.marked ? ("A" as const) : undefined }));
    return buildCategorySegments(
      text,
      marks.map((mark) => ({ start: mark.start, end: mark.end, category: mark.category ?? "A" })),
    );
  }, [text, marks, variant]);
  const held = variant === "held";

  return (
    <div ref={backdropRef} aria-hidden {...(held ? { "data-held-selection-overlay": "" } : { "data-description-mark-overlay": "" })} className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="whitespace-pre-wrap break-words p-4 font-mono text-sm leading-relaxed text-transparent"
        style={{ width: mirrorWidth ?? "100%" }}
      >
        {segments.map((segment, index) =>
          segment.category === undefined ? (
            <span key={index}>{segment.text}</span>
          ) : held ? (
            <span key={index} data-held-selection="" className="tsp-held-selection">
              {segment.text}
            </span>
          ) : (
            <span
              key={index}
              data-description-mark={segment.category}
              className={`tsp-description-mark tsp-description-mark-${segment.category.toLowerCase()}`}
            >
              {segment.text}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

export default memo(DescriptionMarkOverlay);
