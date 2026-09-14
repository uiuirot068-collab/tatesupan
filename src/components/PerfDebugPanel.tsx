"use client";

/**
 * TSP-REAL-MANUSCRIPT-END-INPUT-FORENSIC-004 — temporary, local-only debug
 * panel. Renders NOTHING unless the page was opened with `?perfDebug=1`.
 * Shows only counts/timestamps collected by `@/lib/perfDebug`; the report
 * text it produces never includes manuscript content (see that module's
 * own contract). Not part of any permanent product UI — safe to delete
 * once the end-of-document stall investigation is done.
 */

import { useState } from "react";
import { isPerfDebugEnabled, getEditorProbeMode, getPerfReport, clearPerfMarks, perfMarkCount, type PerfMarkDetail } from "@/lib/perfDebug";

interface PerfDebugPanelProps {
  /** Character count only -- never the manuscript text itself. */
  contentLength: number;
  renderer: "LEGACY" | "V2_BETA";
  pageCount: number | null;
  cursorIndex: number | null;
}

export default function PerfDebugPanel({ contentLength, renderer, pageCount, cursorIndex }: PerfDebugPanelProps) {
  const [report, setReport] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [, forceRerender] = useState(0);

  if (!isPerfDebugEnabled()) return null;

  const probeMode = getEditorProbeMode();
  const meta: PerfMarkDetail = {
    contentLength,
    renderer,
    pageCount,
    cursorIndex,
    editorProbeMode: probeMode,
    domElementCount: typeof document !== "undefined" ? document.querySelectorAll("*").length : null,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  };

  const handleGenerate = async () => {
    const text = getPerfReport(meta);
    setReport(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
    setTimeout(() => setCopyStatus("idle"), 3000);
  };

  const handleClear = () => {
    clearPerfMarks();
    setReport(null);
    forceRerender((n) => n + 1);
  };

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        right: 8,
        zIndex: 999999,
        background: "#111",
        color: "#7CFC7C",
        padding: "8px 10px",
        fontSize: 11,
        fontFamily: "ui-monospace, monospace",
        borderRadius: 6,
        width: 320,
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ marginBottom: 4, color: "#fff" }}>
        TSP perf debug — {perfMarkCount()} marks — renderer: {renderer}
      </div>
      <div style={{ marginBottom: 6, color: probeMode === "normal" ? "#7CFC7C" : "#ffcc66", fontWeight: "bold" }}>
        editor probe: {probeMode}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <button
          type="button"
          onClick={handleGenerate}
          style={{ background: "#2a2", color: "#000", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}
        >
          {copyStatus === "copied" ? "Copied!" : copyStatus === "failed" ? "Copy failed — select below" : "Copy timing report"}
        </button>
        <button
          type="button"
          onClick={handleClear}
          style={{ background: "#444", color: "#fff", border: "none", borderRadius: 4, padding: "3px 8px", cursor: "pointer" }}
        >
          Clear timing
        </button>
      </div>
      {report && (
        <textarea
          readOnly
          value={report}
          onFocus={(e) => e.currentTarget.select()}
          style={{ width: "100%", height: 140, background: "#000", color: "#7CFC7C", fontSize: 10, fontFamily: "ui-monospace, monospace" }}
        />
      )}
    </div>
  );
}
