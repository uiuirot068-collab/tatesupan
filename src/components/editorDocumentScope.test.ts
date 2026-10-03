import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Phase 6 editor state audit — WIRING contract for document-scoped async
 * state. The semantics are tested on the pure pieces (src/lib/documentScope.test.ts);
 * this vitest config has no DOM (`environment: "node"`, no jsdom), so which
 * handler uses them is locked as a source contract, the same division of
 * labour as the other component suites here. Only the guard points are
 * asserted — not formatting — so ordinary edits elsewhere do not break it.
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

describe("TategakiEditor: one document-switch owner", () => {
  const switchBody = body(editor, "const beginDocumentSwitch = useCallback(", "}, [documentEpoch]);");

  it("invalidates in-flight handler work and clears the previous document's technical breaks and page selection", () => {
    expect(switchBody).toContain("documentEpoch.advance();");
    expect(switchBody).toContain("setUnresolvedCloudImages(null);");
    expect(switchBody).toContain("setImageWarningBaselineIds(new Set());");
    expect(switchBody).toContain("setSelectedPages(new Set());");
  });

  it("runs on every route-driven load and on 保存作品一覧", () => {
    expect(body(editor, "hasLoadedRef.current = false;", "async function run()")).toContain("beginDocumentSwitch();");
    expect(body(editor, "const handleSelectProject = ", "};")).toMatch(/beginDocumentSwitch\(\);\s*applyCloudProject\(project\);/);
    // Phase 6.1: an in-flight route load cannot overwrite a project opened from 保存作品一覧.
    const load = body(editor, "beginDocumentSwitch();\n    // 保存作品一覧 can open", "async function run()");
    expect(load).toContain("const isStale = () => cancelled || !isCurrentDocument();");
  });

  it("a local document load unlinks the previous cloud project", () => {
    expect(body(editor, "const imageRecords = await loadImagesByIds(", "setTitle(doc?.title")).toContain("setCurrentProjectId(null);");
  });
});

describe("TategakiEditor: async handlers write only into the document they started in", () => {
  it("cloud save captures before its first await and guards the project link and technical state", () => {
    const save = body(editor, "const saveToCloud = async (skipNewerCheck: boolean) => {", "const handleCloudCompareOverwrite");
    expect(save.indexOf("documentEpoch.capture()")).toBeLessThan(save.indexOf("await "));
    expect(save).toContain("if (!currentProjectId && isSameDocument()) setCurrentProjectId(result.data.id);");
    expect(save.match(/setUnresolvedCloudImages\(/g)).toHaveLength(2);
    expect(save.match(/if \(isSameDocument\(\)\) setUnresolvedCloudImages\(/g)).toHaveLength(2);
  });

  it("image replacement guards every technical-state write after its awaits", () => {
    const replace = body(editor, "const handleImageReplace = useCallback(", "const handleDismissResolvedImageWarnings");
    expect(replace.indexOf("documentEpoch.capture()")).toBeLessThan(replace.indexOf("await "));
    expect(replace).toContain("setImages((prev) => ({ ...prev, [id]: dataUrl }));");
    const writes = replace.match(/setUnresolvedCloudImages\(/g) ?? [];
    const guarded = replace.match(/if \(!isSameDocument\(\)\) return;\s*setUnresolvedCloudImages\(|if \(isSameDocument\(\)\) setUnresolvedCloudImages\(/g) ?? [];
    expect(writes.length).toBe(3);
    expect(guarded.length).toBe(writes.length);
  });

  it("TXT/DOCX import drops a file that finished reading after another document was opened", () => {
    for (const name of ["const importTxt = async", "const importDocx = async"]) {
      const handler = body(editor, name, "setContent(");
      expect(handler).toMatch(/documentEpoch\.capture\(\);\s*const \w+ = await [^\n]+\n\s*if \(!isSameDocument\(\)\) return;/);
    }
  });
});

describe("PreviewPane: source splices never start from a stale snapshot", () => {
  it("reorder and image insertion refuse unless the snapshot is still the live manuscript", () => {
    const reorder = body(preview, "const applyReorder = ", "const handleToggleSelect");
    expect(reorder).toContain("if (!listRangesAreCurrent || readLiveContent() !== content) {");
    const insert = body(preview, "const handleInsertImage = ", "const handleImagePositionChange");
    const check = insert.indexOf("if (!listRangesAreCurrent || readLiveContent() !== content) {");
    expect(check).toBeGreaterThan(insert.lastIndexOf("await "));
    expect(check).toBeLessThan(insert.indexOf("onImageAdd?.("));
  });

  it("marker-based image edits splice the live manuscript", () => {
    const edits = body(preview, "const handleImagePositionChange = ", "const handleImageLayerChange = ");
    expect(edits.match(/const source = readLiveContent\(\);/g)).toHaveLength(2);
    expect(edits).not.toContain("content.slice(");
  });
});
