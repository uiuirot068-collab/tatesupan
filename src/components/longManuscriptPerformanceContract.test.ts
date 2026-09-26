import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 7 performance WIRING contract. Semantics live in
 * src/lib/longManuscriptPerformance.test.ts and
 * src/lib/v2Bridge/previewWorkerClient.test.ts; this config has no DOM, so
 * where the editor uses them is locked at source level (guard points only).
 */
const editor = readFileSync(resolve("src/components/TategakiEditor.tsx"), "utf8");
const preview = readFileSync(resolve("src/components/PreviewPane.tsx"), "utf8");
const adapter = readFileSync(resolve("src/lib/v2Bridge/useV2PreviewAdapter.ts"), "utf8");
const worker = readFileSync(resolve("src/workers/v2Preview.worker.ts"), "utf8");
const sharedExport = readFileSync(resolve("src/hooks/useMobileSharedExport.ts"), "utf8");

function body(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, startMarker).toBeGreaterThanOrEqual(0);
  expect(end, endMarker).toBeGreaterThan(start);
  return source.slice(start, end + endMarker.length);
}

describe("manifest check depends on referenced image ids, not text", () => {
  it("the poll effect is keyed on referencedImageKey and never on live content", () => {
    const poll = body(editor, "const referencedImageKey = useMemo(", "}, [cloudImagesRestoring, currentProjectId, images, referencedImageKey]);");
    expect(poll).toContain("referencedImageSignature(content)");
    expect(poll).toContain('if (!currentProjectId || cloudImagesRestoring || referencedImageKey === "") return;');
    expect(poll).toContain("getUnresolvedManuscriptImages(currentProjectId, liveContentRef.current)");
    expect(poll).toContain("window.setInterval(() => void refresh(), 60_000)");
  });
});

describe("V2 layout worker: reused, trimmed payload, one debounce", () => {
  it("the adapter owns one ReusablePreviewWorker, disposes it on unmount, and sends only referenced images", () => {
    expect(adapter).toContain("new ReusablePreviewWorker(");
    expect(adapter).toContain("useEffect(() => () => workerClient.dispose(), [workerClient]);");
    expect(adapter).toContain("images: referencedImages(composing.images, composing.content)");
    expect(adapter).toContain("gate.complete(composing, bridge);"); // gate keeps the FULL input (export freshness)
    expect(adapter).not.toContain("new Worker(new URL(\"../../workers/v2Preview.worker.ts\", import.meta.url), { type: \"module\" });\n      worker.onmessage");
    expect(adapter.match(/window\.setTimeout\(/g)).toHaveLength(1);
  });

  it("the worker echoes the request id and keeps a decode cache", () => {
    expect(worker).toContain('self.postMessage({ type: "complete", requestId, bridge, preview });');
    expect(worker).toMatch(/type: "error",\s*requestId,/);
    expect(worker).toContain("prepareImageResolver(input.images, imageCache)");
  });

  it("PreviewPane has no second content debounce", () => {
    expect(preview).not.toContain("PREVIEW_CONTENT_DEBOUNCE_MS");
    expect(preview).not.toContain("setDeferredContent");
    expect(preview).toContain("const deferredContent = content;");
  });
});

describe("LEGACY pagination only while something reads it", () => {
  it("tokenize/paginate and source ranges are gated on LEGACY mode or no V2 layout", () => {
    expect(preview).toContain("const legacyPaginationNeeded = !useV2Engine || v2PageModel === null;");
    const pages = body(preview, "const pages = useMemo(() => {", "]);");
    expect(pages.indexOf("if (!legacyPaginationNeeded) return NO_LEGACY_PAGES;")).toBeLessThan(pages.indexOf("tokenizeTategaki("));
    const ranges = body(preview, "const pageSourceRanges = useMemo(() => {", "]);");
    expect(ranges.indexOf("if (!legacyPaginationNeeded) return NO_LEGACY_SOURCE_RANGES;")).toBeLessThan(ranges.indexOf("computePageSourceRanges("));
    // V2-mode consumers read the V2 list whenever it exists.
    expect(preview).toContain("const listPages: TategakiPage[] = v2PageModel ? v2PageModel.overlayPages : pages;");
    expect(preview).toContain("const listSourceRanges = v2PageModel ? v2PageModel.bodySourceRanges : pageSourceRanges;");
  });
});

describe("document-scoped image loading", () => {
  it("the editor never loads every stored image", () => {
    expect(editor).not.toContain("loadAllImages");
    expect(editor).toContain("await loadImagesByIds(imageMarkerIds(doc?.content ?? \"\"))");
    expect(editor).toContain("loadImagesByIds(imageMarkerIds(project.content))");
  });

  it("pasted markers are topped up once per document for local documents only; TXT import stays broken", () => {
    const topUp = body(editor, "const imageTopUpAttemptedRef = useRef", "}, [currentProjectId, docId, documentEpoch, imageMarkerKey, images, isSampleDocument]);");
    expect(topUp).toContain("if (docId === null || currentProjectId || isSampleDocument");
    expect(topUp).toContain("const isSameDocument = documentEpoch.capture();");
    expect(topUp).toContain("if (!isSameDocument() || records.length === 0) return;");
    expect(body(editor, "const importTxt = async", "setToast(")).toContain("imageTopUpAttemptedRef.current = new Set(imageIds);");
  });
});

describe("PreviewPane (React.memo) props stay stable while typing", () => {
  it("image callbacks read the live text at call time instead of depending on it", () => {
    expect(body(editor, "const handleImageReplace = useCallback(", "}, [currentProjectId, documentEpoch, imageLayerOrder, images, isSampleDocument]);")).toContain("const content = liveContentRef.current;");
    expect(body(editor, "const handleDismissResolvedImageWarnings = useCallback(", "}, [images]);")).toContain("referencedImageIds(liveContentRef.current)");
  });

  it("the phone export close handler is stable", () => {
    expect(sharedExport).toContain("const closeMobileExport = useCallback(() => setIsOpen(false), []);");
  });
});
