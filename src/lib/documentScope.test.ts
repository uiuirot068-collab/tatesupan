import { describe, expect, it } from "vitest";
import { withoutUnresolvedImageIds } from "./cloudImageSync";
import { DocumentEpoch } from "./documentScope";
import {
  EMPTY_IMAGE_WARNING_STATE,
  imageWarningsForScope,
  reconcileImageWarnings,
} from "./imageWarningLifecycle";
import { CompositionGate, StaleCompositionError, type V2CompositionInput } from "./v2Bridge/compositionRevision";
import { DEFAULT_PAGE_SETTINGS } from "./pageLayout";

/**
 * Phase 6 editor state audit: document-scoped async state.
 * docs/TATESPUN_EDITOR_STATE_ARCHITECTURE.md §7–§8.
 */

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

describe("DocumentEpoch: an async flow of document A cannot write into document B", () => {
  it("a capture stays current until the open document changes", () => {
    const epoch = new DocumentEpoch();
    const isSameDocument = epoch.capture();
    expect(isSameDocument()).toBe(true);
    epoch.advance();
    expect(isSameDocument()).toBe(false);
    expect(epoch.capture()()).toBe(true);
  });

  it("a result that resolves after a switch is recognised as stale, one that resolves before is not", async () => {
    const epoch = new DocumentEpoch();
    const writes: string[] = [];
    const run = async (result: Promise<string>) => {
      const isSameDocument = epoch.capture(); // before the first await, as in TategakiEditor
      const value = await result;
      if (isSameDocument()) writes.push(value);
    };

    const early = deferred<string>();
    const earlyRun = run(early.promise);
    early.resolve("project-A-before-switch");
    await earlyRun;

    const late = deferred<string>();
    const lateRun = run(late.promise);
    epoch.advance(); // 保存作品一覧 opened project B while A's cloud save was in flight
    late.resolve("project-A-after-switch");
    await lateRun;

    expect(writes).toEqual(["project-A-before-switch"]);
  });

  it("switching away and back does not revive a stale capture", () => {
    const epoch = new DocumentEpoch();
    const fromA = epoch.capture();
    epoch.advance(); // → B
    epoch.advance(); // → A again (a new load: A's state was re-read)
    expect(fromA()).toBe(false);
  });
});

describe("withoutUnresolvedImageIds: the one technical-state removal rule", () => {
  const state = { missing: ["a", "b"], unmanifested: ["c"] };

  it("removes the given ids from both lists", () => {
    expect(withoutUnresolvedImageIds(state, new Set(["a", "c"]))).toEqual({ missing: ["b"], unmanifested: [] });
  });

  it("returns null once nothing is unresolved (the editor's no-warning state)", () => {
    expect(withoutUnresolvedImageIds(state, new Set(["a", "b", "c"]))).toBeNull();
    expect(withoutUnresolvedImageIds(null, new Set(["a"]))).toBeNull();
  });

  it("returns the same object when nothing changed, so memoized id sets stay stable", () => {
    expect(withoutUnresolvedImageIds(state, new Set(["zzz"]))).toBe(state);
  });
});

describe("imageWarningsForScope: acknowledgment state never leaks between documents", () => {
  const pendingInA = reconcileImageWarnings(EMPTY_IMAGE_WARNING_STATE, {
    unresolvedIds: new Set(["img-1"]),
    pageIndicesById: new Map([["img-1", [2]]]),
  }).state;
  const store = { scope: "local:1", state: pendingInA };

  it("returns the stored warnings for the document they were recorded in", () => {
    expect(imageWarningsForScope(store, "local:1").pending).toEqual({ "img-1": [2] });
  });

  it("reads as empty for any other document, including one using the same image id", () => {
    expect(imageWarningsForScope(store, "cloud:p-2")).toBe(EMPTY_IMAGE_WARNING_STATE);
    expect(imageWarningsForScope(store, "local:2")).toBe(EMPTY_IMAGE_WARNING_STATE);
  });
});

describe("export wait across a project switch (CompositionGate)", () => {
  const input = (content: string): V2CompositionInput => ({ content, settings: DEFAULT_PAGE_SETTINGS, title: "", images: {} });

  it("document B's source supersedes an export still waiting for document A's layout", async () => {
    const gate = new CompositionGate<string>();
    const exportOfA = gate.waitFor(input("document A"));
    gate.supersede(input("document B")); // PreviewPane's supersede effect after the switch
    await expect(exportOfA).rejects.toBeInstanceOf(StaleCompositionError);
    expect(gate.pendingCount).toBe(0);
  });

  it("document B's finished layout never satisfies a wait for document A", async () => {
    const gate = new CompositionGate<string>();
    let settled = false;
    void gate.waitFor(input("document A")).then(() => { settled = true; }, () => { settled = true; });
    gate.complete(input("document B"), "layout-B");
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(gate.currentFor(input("document A"))).toBeNull();
    expect(gate.currentFor(input("document B"))).toBe("layout-B");
  });
});
