"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TategakiEditor from "@/components/TategakiEditor";

function EditorPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const documentId = id ? Number(id) : undefined;
  const cloudProjectId = searchParams.get("cloudId") ?? undefined;
  // TSP-LOOP-024: `/editor?demo=1` runs the real editor with a disposable
  // in-memory document + the 10-step guide. Never persists anything.
  const demoMode = searchParams.get("demo") === "1";
  // TSP-FQ04-PRODUCTION-RUNTIME-DIAGNOSTIC-004: read-only viewport/keyboard
  // diagnostic panel, gated behind this explicit opt-in query param so it
  // never appears for an ordinary user.
  const viewportDebugEnabled = searchParams.get("viewportDebug") === "1";

  return (
    <TategakiEditor
      documentId={documentId}
      cloudProjectId={cloudProjectId}
      demoMode={demoMode}
      viewportDebugEnabled={viewportDebugEnabled}
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
