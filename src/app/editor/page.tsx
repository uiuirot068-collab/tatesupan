"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import TategakiEditor from "@/components/TategakiEditor";

function EditorPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const documentId = id ? Number(id) : undefined;

  return <TategakiEditor documentId={documentId} />;
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorPageContent />
    </Suspense>
  );
}
