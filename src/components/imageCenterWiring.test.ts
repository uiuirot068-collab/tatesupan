import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 12 画像管理センター WIRING contract (this config has no DOM). The
 * semantics are tested on the pure model (src/lib/imageCenter.test.ts); here
 * the entry points and the reuse of the existing actions are locked.
 */

const editor = readFileSync(resolve("src/components/TategakiEditor.tsx"), "utf8");
const preview = readFileSync(resolve("src/components/PreviewPane.tsx"), "utf8");
const modal = readFileSync(resolve("src/components/ImageCenterModal.tsx"), "utf8");

function body(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, startMarker).toBeGreaterThanOrEqual(0);
  expect(end, endMarker).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("entry points", () => {
  it("opens from the footer 画像 button (with or without warnings) and from the ⚠️画像切れ popover", () => {
    expect(preview.match(/data-image-center-open=""/g)?.length).toBe(2);
    expect(preview).toContain('data-image-warning-open-center=""');
    expect(preview.match(/onClick=\{openImageCenter\}/g)?.length).toBe(3);
  });

  it("the plain footer appears only when the manuscript has images (no permanent panel)", () => {
    expect(preview).toContain("{imageWarningEntries.length === 0 && referencedImageCount > 0 && (");
  });
});

describe("actions reuse the existing ones", () => {
  it("差し替え goes through the existing same-id replacement input, which now exists without a warning footer", () => {
    expect(preview).toContain("onReplace={requestImageReplacement}");
    const input = body(preview, "<input\n        ref={replacementInputRef}", "/>");
    expect(input).toContain("onImageReplace?.(pendingReplacementId, file)");
  });

  it("削除 splices only the markers of the LIVE manuscript, then calls the editor's delete", () => {
    const remove = body(preview, "const handleImageCenterDelete = (imageId: string) => {", "};");
    expect(remove).toContain("const source = readLiveContent();");
    expect(remove).toContain("removeImageMarkers(source, imageId)");
    expect(remove).toContain("onImageDelete?.(imageId);");
  });

  it("移動 uses the Preview's own page navigation", () => {
    expect(body(preview, "const handleImageCenterNavigate = (bodyIndex: number) => {", "};")).toContain("scrollToPreviewPage(bodyIndex);");
  });

  it("通知解除 is the footer's own dismissal (one warning state)", () => {
    expect(preview).toContain("onDismissWarning={(imageId) => handleDismissImageWarningEntry([imageId])}");
  });

  it("page numbers come from the canonical list only (provisional pre-V2 list hides them)", () => {
    expect(preview).toContain("pageIndicesById: warningPageIndices(listAuthority, imagePageIndicesById),");
    expect(preview).toContain("pagesKnown={listAuthority.canonical}");
  });
});

describe("editor side", () => {
  it("IndexedDB original is deleted only when no other local work references the image", () => {
    const remove = body(editor, "const handleImageDelete = useCallback((id: string) => {", "}, [isSampleDocument]);");
    expect(remove).toContain("listDocuments()");
    expect(remove).toContain("document.id !== currentDocId");
    expect(remove).toContain("imageOriginalDeletable(id, others) ? deleteImage(id) : undefined");
  });

  it("再同期 restores from IndexedDB under the same id; a cloud work re-syncs (72h extension) and recomputes the technical state", () => {
    const resync = body(editor, "const handleImageResync = useCallback(", "}, [currentProjectId, documentEpoch, images]);");
    expect(resync).toContain("await loadImagesByIds(ids)");
    expect(resync).toContain("syncManuscriptImages({ projectId: currentProjectId, content, localImages: nextImages })");
    expect(resync).toContain("setUnresolvedCloudImages(technicallyUnresolvedImages(status, nextImages));");
    expect(resync).toContain("withoutUnresolvedImageIds(prev, new Set(restored))");
    // never touches the manuscript text
    expect(resync).not.toContain("setContent(");
  });

  it("PreviewPane receives the resync / originals / technical-state props", () => {
    expect(editor).toContain("onImageResync={handleImageResync}");
    expect(editor).toContain("onCheckImageOriginals={handleCheckImageOriginals}");
    expect(editor).toContain("unresolvedImages={unresolvedCloudImages}");
  });
});

describe("modal", () => {
  it("is the shared ViewportModal (centered, scrollable body on narrow screens) and adds no lint suppressions", () => {
    expect(modal).toContain('import ViewportModal from "./ViewportModal";');
    expect(modal).not.toContain("eslint-disable");
  });
});
