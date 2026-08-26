"use client";

/**
 * TateSpun — P2-B: Experimental "New" preview (dev-only A/B against Current).
 *
 * Renders the real Editor `content` through the existing P1 PoC pipeline
 * (tokenizeTategaki → tokensToP1Document → repo外 scratch bridge/Vivliostyle
 * — unmodified, see src/app/renderer-poc/) instead of the production
 * FixedSlot renderer. This file does NOT reimplement export, page reorder,
 * or image-layer editing — those remain Current-only for this A/B pass
 * (see PreviewPane.tsx's P2-B toggle). Image tokens fall back to
 * p1Adapter's existing `.p1-image-placeholder`, unchanged.
 *
 * Settings/layout parity: only page size, 4-side margins (gutter/outer
 * mapped to a single fixed left/right, no recto/verso alternation),
 * font-family, font-size, and line-height are passed through to
 * tokensToP1Document. columnCount (段組み) is NOT supported — see P2-B
 * REPORT.
 */
import { useEffect, useRef, useState } from "react";
import { tokensToP1Document } from "@/app/renderer-poc/p1Adapter";
import type { PageLayout, PageSettings } from "@/lib/pageLayout";

const BRIDGE_ORIGIN = "http://127.0.0.1:13021";
const VIV_VIEWER_ORIGIN = "http://127.0.0.1:13020";
const DEBOUNCE_MS = 400;

type Status = "idle" | "pending" | "ok" | "unavailable";

export interface PreviewPaneNewProps {
  content: string;
  settings: PageSettings;
  layout: PageLayout;
  title?: string;
  /** Called once when the bridge/Vivliostyle preview turns out to be unreachable, so the parent can revert to Current and show a warning. */
  onUnavailable?: () => void;
}

export default function PreviewPaneNew({ content, settings, layout, title, onUnavailable }: PreviewPaneNewProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  // Ref-wrapped so the debounce effect below doesn't need onUnavailable in
  // its dependency array (it's typically a fresh closure every parent render).
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runUpdate(content, settings, layout);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, settings, layout]);

  async function runUpdate(currentContent: string, currentSettings: PageSettings, currentLayout: PageLayout) {
    const seq = ++requestSeqRef.current;
    setStatus("pending");

    let html: string;
    try {
      html = tokensToP1Document(currentContent, {
        fontFamily: currentSettings.fontFamily,
        pageWidthMm: currentLayout.paper.widthMm,
        pageHeightMm: currentLayout.paper.heightMm,
        marginTopMm: currentSettings.marginTop,
        marginBottomMm: currentSettings.marginBottom,
        marginLeftMm: currentSettings.marginGutter,
        marginRightMm: currentSettings.marginOuter,
        fontSizePt: currentSettings.fontSizePt,
        lineHeightRatio: currentSettings.lineHeightRatio,
        grid: false,
      });
    } catch {
      if (seq !== requestSeqRef.current) return;
      setStatus("unavailable");
      onUnavailableRef.current?.();
      return;
    }

    try {
      const res = await fetch(`${BRIDGE_ORIGIN}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html }),
      });
      if (seq !== requestSeqRef.current) return;
      if (!res.ok) {
        setStatus("unavailable");
        onUnavailableRef.current?.();
        return;
      }
      // Response shape: {pages, elapsedMs, timedOut} — not surfaced in this
      // minimal experimental view (see tools/renderer-poc/README.md).
      await res.json();
      setStatus("ok");
      setIframeSrc(
        `${VIV_VIEWER_ORIGIN}/__vivliostyle-viewer/index.html#src=${VIV_VIEWER_ORIGIN}/vivliostyle/current.html?v=${Date.now()}&bookMode=false&renderAllPages=true`
      );
    } catch {
      if (seq !== requestSeqRef.current) return;
      setStatus("unavailable");
      setIframeSrc(null);
      onUnavailableRef.current?.();
    }
  }

  if (status === "unavailable") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-sm text-ink/70">New renderer preview unavailable</p>
        <p className="text-xs text-ink/40">
          bridge (127.0.0.1:13021) / Vivliostyle preview (127.0.0.1:13020) が起動していません。
          <br />
          tools/renderer-poc/README.md を参照してください。
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col p-3">
      {iframeSrc ? (
        <iframe
          key={iframeSrc}
          className="h-full w-full flex-1 rounded-lg border border-ink/10 bg-white"
          src={iframeSrc}
          sandbox="allow-scripts allow-same-origin"
          title={`New Renderer Preview${title ? `: ${title}` : ""}`}
        />
      ) : (
        <div className="flex h-full w-full flex-1 items-center justify-center text-xs text-ink/40">
          {status === "pending" ? "組版中…" : "プレビュー取得中…"}
        </div>
      )}
    </div>
  );
}
