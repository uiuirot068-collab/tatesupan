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

  return (
    <TategakiEditor
      documentId={documentId}
      cloudProjectId={cloudProjectId}
      demoMode={demoMode}
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
