"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TategakiEditor from "@/components/TategakiEditor";
import type { PaperSizeKey } from "@/lib/pageLayout";

const START_PAPER_PARAMS: Record<string, PaperSizeKey | undefined> = {
  "sns-square": "SNS用 正方形",
  "sns-45": "SNS用 4:5",
};

function EditorPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const documentId = id ? Number(id) : undefined;
  const cloudProjectId = searchParams.get("cloudId") ?? undefined;
  // TSP-LOOP-024: `/editor?demo=1` runs the real editor with a disposable
  // in-memory document + the 10-step guide. Never persists anything.
  const demoMode = searchParams.get("demo") === "1";
  // SPN-XFIX-002: links from X posts open a new work on the SNS paper.
  const startPaperSize = START_PAPER_PARAMS[searchParams.get("paper") ?? ""];

  return (
    <TategakiEditor
      documentId={documentId}
      cloudProjectId={cloudProjectId}
      demoMode={demoMode}
      startPaperSize={startPaperSize}
    />
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorPageContent />
    </Suspense>
  );
}
