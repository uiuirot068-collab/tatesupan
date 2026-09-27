import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyReferencedCloudImages,
  mergeCloudRestoreWithLocalOriginals,
  referencedImageIds,
  technicallyUnresolvedImages,
} from "./cloudImageSync";
import {
  affectedExportPageNumbers,
  blockedExportPageIndices,
  dismissImageWarnings,
  EMPTY_IMAGE_WARNING_STATE,
  imageWarningPages,
  imageWarningStatus,
  reconcileImageWarnings,
  type ImageWarningState,
} from "./imageWarningLifecycle";
import { findImageTokenRange, formatImageMarker } from "./tategaki";

// Phase 4 — cloud-image recovery + broken-image warning contract, all
// deterministic: manifest rows and `now` are fixtures (no 72h waiting, no
// Supabase), local originals are plain maps.

const NOW = Date.parse("2026-09-26T12:00:00Z");
const HOUR = 3_600_000;
const row = (id: string, expiresInHours: number, missing = false) => ({
  local_image_id: id,
  expires_at: new Date(NOW + expiresInHours * HOUR).toISOString(),
  missing,
});

describe("manifest / local-original state (cloudImageSync.ts)", () => {
  it("A. valid cloud manifest + no local original → resolves through the cloud path, no warning", () => {
    const status = classifyReferencedCloudImages(["a"], [row("a", 48)], NOW);
    expect(status).toEqual({ missing: [], unmanifested: [] });
    expect(technicallyUnresolvedImages(status, {})).toBeNull();
  });

  it("B. expired cloud manifest + local original in this browser → NOT a broken image", () => {
    const status = classifyReferencedCloudImages(["a"], [row("a", -1)], NOW);
    expect(status.missing).toEqual(["a"]); // the cloud copy really is expired ...
    expect(technicallyUnresolvedImages(status, { a: "data:image/png;base64,AA" })).toBeNull(); // ... but this browser can render it
  });

  it("B'. opening a cloud project: an expired/missing cloud copy falls back to the local IndexedDB original", () => {
    const opened = mergeCloudRestoreWithLocalOriginals(
      { images: { fresh: "cloud-bytes" }, missing: ["expired"], unmanifested: ["unsynced"] },
      { expired: "local-bytes", other: "unrelated" }
    );
    expect(opened.images).toEqual({ fresh: "cloud-bytes", expired: "local-bytes" });
    expect(opened.unresolved).toEqual({ missing: [], unmanifested: ["unsynced"] });
  });

  it("B''. a same-ID cloud copy (e.g. replaced on another device) wins over the local original", () => {
    const opened = mergeCloudRestoreWithLocalOriginals({ images: { a: "cloud-new" }, missing: [], unmanifested: [] }, { a: "local-old" });
    expect(opened.images.a).toBe("cloud-new");
  });

  it("C. expired manifest + no local original → broken", () => {
    const status = classifyReferencedCloudImages(["a"], [row("a", -0.01)], NOW);
    expect(technicallyUnresolvedImages(status, {})).toEqual({ missing: ["a"], unmanifested: [] });
  });

  it("the 72h boundary is the manifest time itself (expires_at == now is expired)", () => {
    expect(classifyReferencedCloudImages(["a"], [row("a", 0)], NOW).missing).toEqual(["a"]);
    expect(classifyReferencedCloudImages(["a"], [{ ...row("a", 0), expires_at: "not a date" }], NOW).missing).toEqual(["a"]);
  });

  it("D. tombstone (missing=true) + no local original → broken, even before expires_at", () => {
    const status = classifyReferencedCloudImages(["a"], [row("a", 48, true)], NOW);
    expect(technicallyUnresolvedImages(status, {})).toEqual({ missing: ["a"], unmanifested: [] });
  });

  it("E. referenced image with no manifest row + no local original → unmanifested (preserved)", () => {
    const status = classifyReferencedCloudImages(["a", "b"], [row("b", 10)], NOW);
    expect(technicallyUnresolvedImages(status, {})).toEqual({ missing: [], unmanifested: ["a"] });
  });

  it("F. same-ID replacement restores data without touching the marker (id, size, position, page source)", () => {
    const marker = formatImageMarker({ type: "image", id: "img-1", widthMm: 40, heightMm: 30, position: "top" });
    const content = `前の本文。\n${marker}\n後の本文。`;
    const before = findImageTokenRange(content, "img-1");
    const images: Record<string, string> = {};
    const repaired = { ...images, "img-1": "data:image/png;base64,BB" }; // handleImageReplace: same id
    expect(findImageTokenRange(content, "img-1")).toEqual(before);
    expect(referencedImageIds(content)).toEqual(["img-1"]);
    expect(technicallyUnresolvedImages({ missing: ["img-1"], unmanifested: [] }, repaired)).toBeNull();
  });

  it("G. a successful cloud resync (fresh expires_at, tombstone cleared) clears the technical state", () => {
    const before = technicallyUnresolvedImages(classifyReferencedCloudImages(["a"], [row("a", -5, true)], NOW), {});
    const after = technicallyUnresolvedImages(classifyReferencedCloudImages(["a"], [row("a", 72)], NOW), {});
    expect(before).not.toBeNull();
    expect(after).toBeNull();
  });
});

// --- warning lifecycle -------------------------------------------------------

const marks = (entries: Record<string, number[]>) => new Map(Object.entries(entries));
const ids = (...list: string[]) => new Set(list);
function step(state: ImageWarningState, unresolved: Set<string>, pages: Map<string, number[]>, silent?: Set<string>) {
  return reconcileImageWarnings(state, { unresolvedIds: unresolved, pageIndicesById: pages, silentIds: silent });
}

describe("warning lifecycle (imageWarningLifecycle.ts)", () => {
  it("NEW BREAK → pending warning + one announcement", () => {
    const { state, newlyBrokenIds } = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [11] }));
    expect(state.pending).toEqual({ a: [11] });
    expect(newlyBrokenIds).toEqual(["a"]);
  });

  it("REPEATED POLL → same state object, no duplicate modal", () => {
    const first = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [11] })).state;
    const again = step(first, ids("a"), marks({ a: [11] }));
    expect(again.state).toBe(first);
    expect(again.newlyBrokenIds).toEqual([]);
  });

  it("a break whose page is not known yet (debounced page list) is recorded — and announced — once the page arrives", () => {
    const waiting = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({}));
    expect(waiting.state).toBe(EMPTY_IMAGE_WARNING_STATE);
    const arrived = step(waiting.state, ids("a"), marks({ a: [3] }));
    expect(arrived.newlyBrokenIds).toEqual(["a"]);
  });

  it("broken when the document was opened → footer warning, no interruption modal", () => {
    const opened = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [0] }), ids("a"));
    expect(opened.state.pending).toEqual({ a: [0] });
    expect(opened.newlyBrokenIds).toEqual([]);
  });

  it("REPAIR → technical state clears but the warning stays pending (and keeps blocking)", () => {
    const broken = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [11] })).state;
    const repaired = step(broken, ids(), marks({ a: [11] }));
    expect(repaired.state).toBe(broken);
    expect(blockedExportPageIndices(repaired.state)).toEqual(new Set([11]));
  });

  it("DELETE MARKER → warning stays pending with its last-known page", () => {
    const broken = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [11] })).state;
    const deleted = step(broken, ids(), marks({}));
    expect(deleted.state.pending).toEqual({ a: [11] });
  });

  it("page mapping follows the marker while it exists (edits reflow pages)", () => {
    const broken = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [11] })).state;
    expect(step(broken, ids("a"), marks({ a: [12] })).state.pending).toEqual({ a: [12] });
  });

  it("DISMISS BEFORE REPAIR → refused, nothing cleared", () => {
    const broken = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [11] })).state;
    const result = dismissImageWarnings(broken, ["a"], () => true);
    expect(result.refused).toEqual(["a"]);
    expect(result.state).toBe(broken);
  });

  it("DISMISS AFTER REPAIR / AFTER MARKER DELETE → accepted, block lifted", () => {
    const broken = step(EMPTY_IMAGE_WARNING_STATE, ids("a", "b"), marks({ a: [11], b: [4] })).state;
    const afterRepair = dismissImageWarnings(broken, ["a"], () => false);
    expect(afterRepair.refused).toEqual([]);
    expect(afterRepair.state.pending).toEqual({ b: [4] }); // dismissing one leaves the other
    const afterDelete = dismissImageWarnings(afterRepair.state, ["b"], () => false);
    expect(afterDelete.state.pending).toEqual({});
    expect(blockedExportPageIndices(afterDelete.state).size).toBe(0);
  });

  it("BREAK → REPAIR → DISMISS → BREAK AGAIN → re-armed and announced again (even if first seen at open)", () => {
    let state = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [2] }), ids("a")).state; // broken at open: silent
    state = step(state, ids(), marks({ a: [2] })).state; // repaired
    state = dismissImageWarnings(state, ["a"], () => false).state; // acknowledged
    const again = step(state, ids("a"), marks({ a: [2] }), ids("a"));
    expect(again.newlyBrokenIds).toEqual(["a"]);
    expect(again.state.pending).toEqual({ a: [2] });
  });

  it("multiple broken images: independent ids on multiple pages, grouped per page for the footer", () => {
    const { state, newlyBrokenIds } = step(EMPTY_IMAGE_WARNING_STATE, ids("a", "b", "c"), marks({ a: [11], b: [4], c: [11] }));
    expect(newlyBrokenIds.sort()).toEqual(["a", "b", "c"]);
    expect(imageWarningPages(state)).toEqual([
      { pageIndex: 4, pageNumber: 5, imageIds: ["b"] },
      { pageIndex: 11, pageNumber: 12, imageIds: ["a", "c"] },
    ]);
  });

  it("footer status per image: broken → repaired (renders again) / deleted", () => {
    expect(imageWarningStatus({ technicallyUnresolved: true, locallyAvailable: false, markerExists: true })).toBe("broken");
    expect(imageWarningStatus({ technicallyUnresolved: false, locallyAvailable: true, markerExists: true })).toBe("repaired");
    // repaired locally while the cloud poll still says unresolved: renders, so it is not "broken"
    expect(imageWarningStatus({ technicallyUnresolved: true, locallyAvailable: true, markerExists: true })).toBe("repaired");
    expect(imageWarningStatus({ technicallyUnresolved: true, locallyAvailable: false, markerExists: false })).toBe("deleted");
  });
});

// --- page-scoped export blocking (body indices: page 5 = 4, page 12 = 11) ------

describe("page-scoped export blocking", () => {
  const P5 = 4;
  const P12 = 11;
  const ALL = Array.from({ length: 20 }, (_, i) => i);
  const blockedBy = (state: ImageWarningState) => (targets: number[]) => affectedExportPageNumbers(targets, blockedExportPageIndices(state));

  const broken = step(EMPTY_IMAGE_WARNING_STATE, ids("a"), marks({ a: [P12] })).state;
  const repairedNotAcknowledged = step(broken, ids(), marks({ a: [P12] })).state;
  const deletedNotAcknowledged = step(broken, ids(), marks({})).state;
  const acknowledged = dismissImageWarnings(repairedNotAcknowledged, ["a"], () => false).state;

  it.each([
    ["broken", broken],
    ["repaired, before 通知解除", repairedNotAcknowledged],
    ["marker deleted, before 通知解除 (last-known page)", deletedNotAcknowledged],
  ])("%s: 5P JPG allowed; 12P JPG / 5P+12P batch / ZIP with 12P / all-page PDF blocked", (_label, state) => {
    const check = blockedBy(state);
    expect(check([P5])).toEqual([]);
    expect(check([P12])).toEqual([12]);
    expect(check([P5, P12])).toEqual([12]);
    expect(check([P12, P5, P12])).toEqual([12]);
    expect(check(ALL)).toEqual([12]);
    // colophon JPG checks no body page at all
    expect(check([])).toEqual([]);
  });

  it("after 通知解除 the same exports are allowed", () => {
    const check = blockedBy(acknowledged);
    for (const targets of [[P12], [P5, P12], ALL]) expect(check(targets)).toEqual([]);
  });
});

// --- placeholder / export safety ----------------------------------------------

describe("expired-image placeholder is UI-only and never reaches publication output", () => {
  const pageCard = readFileSync(resolve("src/components/PageCard.tsx"), "utf8");
  const previewPane = readFileSync(resolve("src/components/PreviewPane.tsx"), "utf8");

  it("the placeholders render only for an image that has no data AND is technically unresolved", () => {
    expect(pageCard).toMatch(/if \(!src\) \{\s*if \(!unresolvedImageIds\.has\(token\.id\)\) return null;/);
    expect(pageCard.match(/if \(!src\) \{\s*if \(!unresolvedImageIds\.has\(token\.id\)\) return null;/g)).toHaveLength(2);
  });

  it("both placeholder surfaces are marked no-print UI", () => {
    const blocks = pageCard.split("data-no-print=\"true\"").length - 1;
    expect(blocks).toBeGreaterThanOrEqual(2);
    expect(pageCard).toContain("⚠️ 画像の保存期限が切れています");
  });

  it("the V2 export path builds pixels from the canonical PaintPlan, not from Preview DOM", () => {
    const jpg = previewPane.slice(previewPane.indexOf("const exportV2JpgPages"), previewPane.indexOf("const handleExportJpg = async"));
    // Phase 9: pages are built by the export worker from the publication model.
    expect(jpg).toContain("readPagesAhead(pages, physicalIndices)");
    expect(jpg).not.toMatch(/pageElementsRef|capturePage|html-to-image|ensureExportMount/);
  });

  it("footer, modal and export block read the acknowledgment state; 通知解除 goes through the refusal rule", () => {
    expect(previewPane).toContain("imageWarningEntries.length === 1 ? \"⚠️ 画像切れ\" : \"⚠️ 複数ページ画像切れ\"");
    expect(previewPane).toContain("onClick={() => handleDismissImageWarningEntry(entry.imageIds)}");
    expect(previewPane).toContain("affectedExportPageNumbers(targetPageIndices, blockedExportPageSet)");
    expect(previewPane).toContain("onClick={() => requestImageReplacement(imageId)}");
  });
});
