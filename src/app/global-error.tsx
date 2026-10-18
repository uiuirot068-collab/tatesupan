"use client";

import "./globals.css";
import EditorCrashScreen from "@/components/EditorCrashScreen";

// TSP-SAFE-003: errors above every page (the root layout) still offer the
// text the editor last showed. This replaces the root layout, so it brings
// its own <html>, <body> and styles.
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="ja" data-theme="light">
      <body className="flex min-h-full flex-col bg-white">
        <title>エラー | タテスパン</title>
        <EditorCrashScreen error={error} retry={retry} />
      </body>
    </html>
  );
}
