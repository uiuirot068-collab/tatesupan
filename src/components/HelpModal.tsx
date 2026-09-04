"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { withBasePath } from "@/lib/basePath";
import {
  helpSectionDomId,
  isHelpSectionId,
  type HelpSectionId,
} from "@/lib/helpSections";

interface HelpModalProps {
  onClose: () => void;
  /**
   * TSP-LOOP-027 — open Help positioned at a stable section (see
   * `src/lib/helpSections.ts`). Omitted for the normal Header / mobile-nav
   * Help button, which always opens at the top with no target.
   */
  initialSectionId?: HelpSectionId;
}

/**
 * Heading marker syntax in help.md: `## 見出し <!-- help-id: preview -->`.
 * The comment is parsed here for the anchor id, then stripped so it never
 * renders. Matching a heading to its id is done on the plain heading text
 * (marker removed) — an explicit lookup, not heading order.
 */
const HEADING_MARKER_RE =
  /^(#{1,6})[ \t]+(.*?)[ \t]*<!--[ \t]*help-id:[ \t]*([a-z0-9-]+)[ \t]*-->[ \t]*$/;
const MARKER_STRIP_RE = /[ \t]*<!--[ \t]*help-id:[ \t]*[a-z0-9-]+[ \t]*-->/g;

function parseHelpMarkdown(rawInput: string): {
  markdown: string;
  headingIds: Map<string, HelpSectionId>;
} {
  const raw = rawInput.replace(/\r\n?/g, "\n");
  const headingIds = new Map<string, HelpSectionId>();
  for (const line of raw.split("\n")) {
    const m = line.match(HEADING_MARKER_RE);
    if (m && isHelpSectionId(m[3])) {
      headingIds.set(m[2].trim(), m[3]);
    }
  }
  return { markdown: raw.replace(MARKER_STRIP_RE, ""), headingIds };
}

function flattenText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join("");
  if (typeof node === "object" && "props" in node) {
    return flattenText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export default function HelpModal({ onClose, initialSectionId }: HelpModalProps) {
  const [raw, setRaw] = useState("");
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const scrollRef = useRef<HTMLDivElement>(null);
  const openedAtRef = useRef<number | null>(null);
  useEffect(() => {
    openedAtRef.current = Date.now();
  }, []);

  const { markdown, headingIds } = useMemo(() => parseHelpMarkdown(raw), [raw]);

  useEffect(() => {
    let cancelled = false;
    fetch(withBasePath("/docs/help.md"))
      .then((res) => {
        if (!res.ok) throw new Error("failed to load help.md");
        return res.text();
      })
      .then((text) => {
        if (cancelled) return;
        setRaw(text);
        setStatus("loaded");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // On /guide the page is an ordinary scrolling document; freeze it while the
  // modal is open so closing Help returns the reader to the exact same spot.
  // On the editor / bookshelf the body is already `overflow:hidden` — no-op.
  useEffect(() => {
    document.body.style.setProperty("overflow", "hidden", "important");
    return () => {
      document.body.style.removeProperty("overflow");
    };
  }, []);

  const scrollToTarget = useCallback(() => {
    if (!initialSectionId) return;
    const container = scrollRef.current;
    if (!container) return;
    const el = container.querySelector<HTMLElement>(
      `[id="${helpSectionDomId(initialSectionId)}"]`,
    );
    if (!el) return;
    // offsetTop is relative to the positioned scroll container — a computed
    // destination, not a guessed pixel offset. 8px keeps the heading clear
    // of the container's top edge.
    container.scrollTop = Math.max(0, el.offsetTop - 8);
  }, [initialSectionId]);

  // Re-run the scroll for a short window after opening: help.md images have
  // no intrinsic height, so a lazy image loading above the target would
  // otherwise leave the initial scroll short. After ~1.2s the reader owns
  // the scroll position.
  useEffect(() => {
    if (status !== "loaded" || !initialSectionId) return;
    const raf = requestAnimationFrame(scrollToTarget);
    const container = scrollRef.current;
    const onLoad = (e: Event) => {
      const openedAt = openedAtRef.current;
      if (
        (e.target as HTMLElement)?.tagName === "IMG" &&
        openedAt !== null &&
        Date.now() - openedAt < 1200
      ) {
        scrollToTarget();
      }
    };
    container?.addEventListener("load", onLoad, true);
    return () => {
      cancelAnimationFrame(raf);
      container?.removeEventListener("load", onLoad, true);
    };
  }, [status, initialSectionId, scrollToTarget]);

  const headingComponent = useCallback(
    (Tag: "h2" | "h3") =>
      function Heading({ children }: { children?: ReactNode }) {
        const id = headingIds.get(flattenText(children).trim());
        return <Tag id={id ? helpSectionDomId(id) : undefined}>{children}</Tag>;
      },
    [headingIds],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg border border-ink/10 bg-base p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">使い方ガイド</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="rounded p-1 text-ink/60 hover:bg-ink/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div
          ref={scrollRef}
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 text-sm text-ink"
        >
          {status === "loading" && <p className="text-ink/60">読み込み中…</p>}
          {status === "error" && (
            <p className="text-ink/60">ガイドの読み込みに失敗しました。</p>
          )}
          {status === "loaded" && (
            <div
              className="space-y-3 text-ink
                [&_h1]:mb-1 [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-ink
                [&_h2]:mt-6 [&_h2]:scroll-mt-2 [&_h2]:border-b [&_h2]:border-ink/15 [&_h2]:pb-1
                  [&_h2]:text-[15px] [&_h2]:font-bold [&_h2]:text-ink
                [&_h3]:mt-4 [&_h3]:scroll-mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink/80
                [&_p]:leading-relaxed
                [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5
                [&_li]:leading-relaxed
                [&_strong]:font-semibold
                [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-accent [&_blockquote]:bg-ink/[0.04] [&_blockquote]:py-2 [&_blockquote]:pl-3 [&_blockquote]:pr-2 [&_blockquote]:text-[13px]
                [&_img]:my-2 [&_img]:block [&_img]:h-auto [&_img]:rounded
                [&_code]:rounded [&_code]:bg-ink/10 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs
                [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-ink/10 [&_pre]:p-2 [&_pre]:text-xs"
            >
              <ReactMarkdown
                components={{
                  h2: headingComponent("h2"),
                  h3: headingComponent("h3"),
                  // help.md asset paths are written root-absolute (/help/…);
                  // prepend the deploy basePath so they resolve under /tatespun/.
                  img: ({ src, alt }) => {
                    const resolved =
                      typeof src === "string" ? withBasePath(src) : src;
                    // Instructional animation fills the help column; small
                    // supporting illustrations (e.g. backup-caroad) stay compact.
                    const isWide =
                      typeof src === "string" && /preview-drag\.gif(\?|$)/.test(src);
                    return (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolved}
                        alt={alt ?? ""}
                        loading="lazy"
                        className={
                          isWide
                            ? "w-full max-w-full"
                            : "mx-auto w-full max-w-[220px]"
                        }
                      />
                    );
                  },
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-ink/20 px-3 py-1.5 text-sm text-ink/70 hover:bg-ink/5"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
