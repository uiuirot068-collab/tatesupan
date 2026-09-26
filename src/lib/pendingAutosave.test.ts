import { describe, expect, it } from "vitest";
import { flushPendingAutosave, PendingAutosave, type AutosaveJob } from "./pendingAutosave";

/**
 * Phase 6.1 autosave flush contract. A small in-memory "IndexedDB" stands in
 * for saveDocument; TategakiEditor wires the same calls (see
 * src/components/editorDocumentSafety.test.ts for the wiring contract).
 */
function harness() {
  const pending = new PendingAutosave<{ fontSize: number }>();
  const rows = new Map<number, AutosaveJob<{ fontSize: number }>>();
  const writes: AutosaveJob<{ fontSize: number }>[] = [];
  const write = async (job: AutosaveJob<{ fontSize: number }>) => {
    writes.push(job);
    rows.set(job.docId, job);
  };
  const edit = (docId: number, content: string, title = `title ${docId}`) =>
    pending.schedule({ docId, title, content, settings: { fontSize: 10 }, plotNote: "" });
  const flush = () => flushPendingAutosave(pending, write);
  return { pending, rows, writes, write, edit, flush };
}

describe("pending autosave survives leaving the document", () => {
  it("a document switch writes the pending edit of the document being left", async () => {
    const h = harness();
    h.edit(1, "A before");
    h.edit(1, "A typed 0.5 s before switching");
    await h.flush(); // load effect / 保存作品一覧, before B replaces the state
    expect(h.rows.get(1)?.content).toBe("A typed 0.5 s before switching");
  });

  it("the unmount path writes the pending edit once; a later pagehide has nothing left", async () => {
    const h = harness();
    h.edit(1, "typed right before leaving /editor");
    expect(await h.flush()).not.toBeNull(); // unmount cleanup
    expect(await h.flush()).toBeNull(); // pagehide after unmount
    expect(h.writes).toHaveLength(1);
  });

  it("writes the LATEST committed state, not an earlier debounced copy", async () => {
    const h = harness();
    h.edit(1, "a");
    h.edit(1, "ab");
    h.edit(1, "abc", "new title");
    await h.flush();
    expect(h.writes).toEqual([expect.objectContaining({ docId: 1, content: "abc", title: "new title" })]);
  });
});

describe("a job is written once, to its own document", () => {
  it("the debounce timer and a flush never both write the same job", async () => {
    const h = harness();
    h.edit(1, "x");
    const timerJob = h.pending.take(); // the 1.5 s timer fired
    expect(timerJob?.content).toBe("x");
    expect(await h.flush()).toBeNull();
  });

  it("nothing pending → no write (no duplicate save when nothing changed)", async () => {
    const h = harness();
    expect(await h.flush()).toBeNull();
    h.edit(1, "saved by Ctrl+S");
    h.pending.clear(); // saveNow wrote the same state itself
    expect(await h.flush()).toBeNull();
    expect(h.writes).toHaveLength(0);
  });

  it("a stale document's job never lands in the new document, and the new document's never in the old", async () => {
    const h = harness();
    h.edit(1, "A text");
    const flushingA = h.flush(); // switch started; A's write still in flight
    h.edit(2, "B text"); // B loaded and edited before A's write resolved
    await flushingA;
    await h.flush();
    expect(h.rows.get(1)?.content).toBe("A text");
    expect(h.rows.get(2)?.content).toBe("B text");
    expect(h.writes.map((job) => [job.docId, job.content])).toEqual([[1, "A text"], [2, "B text"]]);
  });

  it("A → B → A: reopening A after awaiting the flush reads A's last edit", async () => {
    const h = harness();
    h.rows.set(1, { docId: 1, title: "A", content: "old A", settings: { fontSize: 10 }, plotNote: "" });
    h.edit(1, "new A");
    const flushedA = h.flush(); // leaving A
    await flushedA; // the load effect awaits this before loadDocument
    h.edit(2, "B");
    await h.flush(); // leaving B
    expect(h.rows.get(1)?.content).toBe("new A");
  });

  it("a failed write rejects the flush (the editor surfaces it as saveStatus=error)", async () => {
    const pending = new PendingAutosave();
    pending.schedule({ docId: 1, title: "", content: "x", settings: {}, plotNote: "" });
    await expect(flushPendingAutosave(pending, async () => { throw new Error("quota"); })).rejects.toThrow("quota");
    expect(pending.hasPending).toBe(false);
  });
});
