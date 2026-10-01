import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 6.1 document-safety WIRING contract. Semantics are tested on the pure
 * pieces (src/lib/pendingAutosave.test.ts, documentSafetyHelpers.test.ts,
 * exportUnmount.test.ts); this config has no DOM, so where TategakiEditor /
 * PreviewPane call them is locked as a source contract, like
 * editorDocumentScope.test.ts. Only the guard points are asserted.
 */

const editor = readFileSync(resolve("src/components/TategakiEditor.tsx"), "utf8");
const preview = readFileSync(resolve("src/components/PreviewPane.tsx"), "utf8");

function body(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  expect(start, startMarker).toBeGreaterThanOrEqual(0);
  expect(end, endMarker).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe("TategakiEditor: autosave is flushed, not dropped", () => {
  it("the debounced save is a job with its own docId; the timer writes the job, not render-time values", () => {
    const autosave = body(editor, "pendingAutosave.schedule(", "}, [docId, title, content, settings, plotNote");
    expect(autosave).toContain("pendingAutosave.schedule({ docId, title, content, settings, plotNote });");
    expect(autosave).toContain("const job = pendingAutosave.take();");
    expect(autosave).toContain("saveDocument(job.docId, job.title, job.content, job.settings, job.plotNote)");
  });

  it("flushAutosave writes the job to ITS document", () => {
    const flush = body(editor, "const flushAutosave = useCallback(", "}, [pendingAutosave]);");
    expect(flush).toContain("flushPendingAutosave(pendingAutosave, (job) =>");
    expect(flush).toContain("saveDocument(job.docId, job.title, job.content, job.settings, job.plotNote)");
  });

  it("a route-driven document switch flushes BEFORE resetting, and a reload awaits the flush", () => {
    const load = body(editor, "const previousDocumentFlushed = flushAutosave();", "async function run()");
    expect(load.indexOf("flushAutosave()")).toBeLessThan(load.indexOf("beginDocumentSwitch();"));
    const run = body(editor, "async function run()", "run();");
    expect(run.indexOf("await previousDocumentFlushed;")).toBeLessThan(run.indexOf("await loadDocument(id)"));
  });

  it("保存作品一覧 flushes before switching and restores the project's images", () => {
    const select = body(editor, "const handleSelectProject = ", "const handleBookPartsInsert");
    expect(select).toMatch(/void flushAutosave\(\);\s*beginDocumentSwitch\(\);\s*applyCloudProject\(project\);\s*void openCloudProjectImages\(project, documentEpoch\.capture\(\)\);/);
  });

  it("unmount and pagehide flush; Ctrl+S drops the job it replaces", () => {
    const lifecycle = body(editor, "isMountedRef.current = true;", "}, [flushAutosave]);");
    expect(lifecycle).toContain('window.addEventListener("pagehide", flushOnPageHide);');
    expect(lifecycle).toContain('document.addEventListener("visibilitychange", flushWhenHidden);');
    expect(lifecycle).toMatch(/isMountedRef\.current = false;\s*void flushAutosave\(\);/);
    expect(body(editor, "const saveNow = () => {", "useShortcuts(")).toContain("pendingAutosave.clear();");
  });
});

describe("TategakiEditor: cloud project images", () => {
  it("both open paths share one restore, and the manifest poll waits for it", () => {
    const route = body(editor, "applyCloudProject(project);\n        await openCloudProjectImages(", "hasLoadedRef.current = true;");
    expect(route).toContain("() => !isStale()");
    const restore = body(editor, "const openCloudProjectImages = useCallback(", "}, []);");
    expect(restore).toContain("if (!isCurrent()) return;");
    expect(restore).toContain("openedCloudProjectImageState(project.content, restored, localRecords)");
    expect(restore).toContain("setImageLayerOrder(opened.imageLayerOrder);");
    // Phase 7 keys the poll on the referenced image set (longManuscriptPerformanceContract.test.ts).
    expect(editor).toContain('if (!currentProjectId || cloudImagesRestoring || referencedImageKey === "") return;');
    expect(body(editor, "const beginDocumentSwitch = useCallback(", "}, [documentEpoch]);")).toContain("setCloudImagesRestoring(false);");
  });
});

describe("unmount cleanup", () => {
  it("the divider drag restores body userSelect on mouseup AND on unmount", () => {
    const drag = body(editor, "const releaseDividerUserSelect = () => {", "const handleDividerMouseDown");
    expect(drag).toMatch(/Phase 6\.1: unmounted mid-drag[^\n]*\n\s*isDraggingRef\.current = false;\s*releaseDividerUserSelect\(\);/);
    expect(editor).toContain("releaseDividerUserSelectRef.current = lockUserSelect(document.body.style);");
    expect(editor).not.toContain('document.body.style.userSelect = "');
  });

  it("the Preview pan restores body userSelect on stop AND on unmount", () => {
    expect(preview).toContain("releasePanUserSelectRef.current = lockUserSelect(document.body.style);");
    expect(preview).toMatch(/useEffect\(\(\) => \(\) => \{\s*releasePanUserSelectRef\.current\?\.\(\);/);
    expect(preview).not.toContain('document.body.style.userSelect = "');
  });

  it("PreviewPane disposes its export coordinator on unmount; V2 PDF checks before starting a worker", () => {
    expect(preview).toMatch(/exportCancellation\.activate\(\);\s*return \(\) => \{\s*exportCancellation\.dispose\(\);\s*v2PdfHandleRef\.current\?\.cancel\(\);\s*v2ExportWorker\.dispose\(\);/);
    const pdf = body(preview, 'signal = beginExport("PDF", uniqueIndices.length);', "downloadBytes(bytes");
    expect(pdf.indexOf("throwIfExportCancelled(signal);")).toBeGreaterThan(-1);
    expect(pdf.indexOf("throwIfExportCancelled(signal);")).toBeLessThan(pdf.indexOf("v2ExportWorker.startPdf("));
    expect(pdf).toContain("await waitForExportPermission(signal);");
  });
});

describe("PreviewPane: selection pruning", () => {
  it("prunes against the canonical list only (never the LEGACY fallback in V2 mode)", () => {
    // Phase 11 残件④: the canonical/provisional decision lives in
    // lib/v2Bridge/previewListAuthority.ts (V2 without a page model = provisional).
    expect(preview).toContain("const v2SourceContent = v2PageModel ? v2PageModel.sourceContent : null;");
    expect(preview).toContain("() => resolvePreviewListAuthority({ useV2Engine, v2SourceContent, content }),");
    expect(preview).toContain("const pageListIsCanonical = listAuthority.canonical;");
    const prune = body(preview, "useEffect(() => {\n    if (!pageListIsCanonical) return;", "}, [pageListIsCanonical");
    expect(prune).toContain("pruneSelectedPages(selected, listPages.length)");
    expect(prune).toContain("if (pruned !== selected) setSelected(new Set(pruned));");
  });
});
