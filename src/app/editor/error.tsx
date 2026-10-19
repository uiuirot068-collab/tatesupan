"use client";

import EditorCrashScreen from "@/components/EditorCrashScreen";

// TSP-SAFE-003: a crash while drawing the editor shows a way out (the text
// the screen last showed) instead of a white page.
export default function EditorError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <EditorCrashScreen error={error} retry={retry} />;
}
