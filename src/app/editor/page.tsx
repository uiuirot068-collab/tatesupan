"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TategakiEditor from "@/components/TategakiEditor";

function EditorPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const documentId = id ? Number(id) : undefined;
  const cloudProjectId = searchParams.get("cloudId") ?? undefined;

  return <TategakiEditor documentId={documentId} cloudProjectId={cloudProjectId} />;
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorPageContent />
    </Suspense>
  );
}
