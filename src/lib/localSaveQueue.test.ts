import { describe, expect, it } from "vitest";
import type { AutosaveJob } from "./pendingAutosave";
import { LocalSaveQueue, rescueCopyTitle, type LocalSaveEvent, type LocalSaveStore, type LocalWriteResult } from "./localSaveQueue";

/**
 * TSP-SAFE-001 (TSP-REVIEW-001 3の3・3の7): the rules of the tab's save queue,
 * against an in-memory store that behaves like IndexedDB (revision per work).
 * localSaveSafety.test.ts runs the same scenes against the real lib/db.ts.
 */
type Job = AutosaveJob<null>;

interface Row {
  title: string;
  content: string;
  revision: number;
}

function memoryStore() {
  const rows = new Map<number, Row>();
  let nextId = 1000;
  let failNext = 0;
  const store: LocalSaveStore<null> = {
    async write(job, expected): Promise<LocalWriteResult> {
      if (failNext > 0) {
        failNext -= 1;
        throw new Error("QuotaExceededError");
      }
      const current = rows.get(job.docId);
      if (!current) return { kind: "deleted" };
      if (expected !== undefined && current.revision !== expected) return { kind: "changed" };
      const revision = current.revision + 1;
      rows.set(job.docId, { title: job.title, content: job.content, revision });
      return { kind: "saved", revision };
    },
    async createCopy(job, title) {
      const id = nextId++;
      rows.set(id, { title, content: job.content, revision: 1 });
      return { id, revision: 1 };
    },
  };
  return {
    rows,
    store,
    failWrites(count: number) {
      failNext = count;
    },
  };
}

function manualTimers() {
  const pending: { callback: () => void; ms: number }[] = [];
  return {
    pending,
    setTimer: (callback: () => void, ms: number) => {
      const entry = { callback, ms };
      pending.push(entry);
      return entry;
    },
    clearTimer: (timer: unknown) => {
      const index = pending.indexOf(timer as (typeof pending)[number]);
      if (index >= 0) pending.splice(index, 1);
    },
    fire() {
      const entry = pending.shift();
      entry?.callback();
    },
  };
}

const job = (docId: number, content: string, title = "題名"): Job => ({ docId, title, content, settings: null, plotNote: "" });

function tab(store: LocalSaveStore<null>, timers = manualTimers()) {
  const queue = new LocalSaveQueue<null>(store, { setTimer: timers.setTimer, clearTimer: timers.clearTimer });
  const events: LocalSaveEvent<null>[] = [];
  queue.subscribe((event) => events.push(event));
  return { queue, events, timers };
}

describe("two tabs on the same work (3の3)", () => {
  it("the later writer does not overwrite: both texts are kept as separate works", async () => {
    const m = memoryStore();
    m.rows.set(1, { title: "題名", content: "はじめ", revision: 3 });
    const a = tab(m.store);
    const b = tab(m.store);
    a.queue.setBase(1, 3);
    b.queue.setBase(1, 3);

    await a.queue.submit(job(1, "はじめ＋Aで書いた分"));
    await b.queue.submit(job(1, "はじめ＋Bで書いた分"));

    expect(m.rows.get(1)?.content).toBe("はじめ＋Aで書いた分");
    const rescued = b.events.find((event) => event.type === "rescued");
    expect(rescued).toMatchObject({ type: "rescued", docId: 1, copyTitle: rescueCopyTitle("題名") });
    const copyId = rescued && rescued.type === "rescued" ? rescued.copyId : -1;
    expect(m.rows.get(copyId)?.content).toBe("はじめ＋Bで書いた分");
  });

  it("after the split, the second tab keeps writing to its own copy, never back into the work", async () => {
    const m = memoryStore();
    m.rows.set(1, { title: "題名", content: "はじめ", revision: 0 });
    const a = tab(m.store);
    const b = tab(m.store);
    a.queue.setBase(1, 0);
    b.queue.setBase(1, 0);
    await a.queue.submit(job(1, "A"));
    await b.queue.submit(job(1, "B"));
    await b.queue.submit(job(1, "B さらに"));
    await a.queue.submit(job(1, "A さらに"));

    const copyId = b.queue.targetOf(1);
    expect(copyId).not.toBe(1);
    expect(m.rows.get(1)?.content).toBe("A さらに");
    expect(m.rows.get(copyId)?.content).toBe("B さらに");
    expect(b.events.filter((event) => event.type === "rescued")).toHaveLength(1);
  });

  it("a work deleted in another tab is not brought back by this tab's autosave", async () => {
    const m = memoryStore();
    m.rows.set(1, { title: "題名", content: "はじめ", revision: 2 });
    const b = tab(m.store);
    b.queue.setBase(1, 2);
    m.rows.delete(1); // deleted from the bookshelf in tab A

    await b.queue.submit(job(1, "Bで書いた分"));
    await b.queue.submit(job(1, "Bでさらに書いた分"));

    expect(m.rows.has(1)).toBe(false);
    expect(b.events.filter((event) => event.type === "deleted")).toHaveLength(2);
    expect(b.queue.hasUnsaved).toBe(false);

    // The person chose 「新しい作品として残す」: the text becomes a new work.
    const kept = await b.queue.keepAsCopy(job(1, "Bでさらに書いた分"), "題名");
    expect(m.rows.get(kept.id)?.content).toBe("Bでさらに書いた分");
    expect(m.rows.has(1)).toBe(false);
  });

  it("the same tab saving again and again never conflicts with itself", async () => {
    const m = memoryStore();
    m.rows.set(1, { title: "題名", content: "", revision: 0 });
    const a = tab(m.store);
    a.queue.setBase(1, 0);
    await Promise.all([a.queue.submit(job(1, "1")), a.queue.submit(job(1, "12")), a.queue.flush()]);
    await a.queue.submit(job(1, "123"));
    expect(m.rows.get(1)).toMatchObject({ content: "123" });
    expect(a.events.some((event) => event.type === "rescued")).toBe(false);
  });
});

describe("a failed write is kept and retried (3の7)", () => {
  it("retries with a back-off until it is written; nothing typed is lost", async () => {
    const m = memoryStore();
    m.rows.set(1, { title: "題名", content: "前", revision: 0 });
    const a = tab(m.store);
    a.queue.setBase(1, 0);
    m.failWrites(2);

    await a.queue.submit(job(1, "前＋書いた分"));
    expect(a.events.at(-1)?.type).toBe("error");
    expect(a.queue.hasUnsaved).toBe(true);
    expect(a.timers.pending.map((timer) => timer.ms)).toEqual([2000]);

    a.timers.fire();
    await a.queue.whenIdle();
    expect(a.events.at(-1)?.type).toBe("error");
    expect(a.timers.pending.map((timer) => timer.ms)).toEqual([5000]);

    a.timers.fire();
    await a.queue.whenIdle();
    expect(m.rows.get(1)?.content).toBe("前＋書いた分");
    expect(a.queue.hasUnsaved).toBe(false);
    expect(a.events.at(-1)?.type).toBe("saved");
    expect(a.timers.pending).toHaveLength(0);
  });

  it("text typed while a retry is waiting replaces the failed one: the older text is never written last", async () => {
    const m = memoryStore();
    m.rows.set(1, { title: "題名", content: "", revision: 0 });
    const a = tab(m.store);
    a.queue.setBase(1, 0);
    const written: string[] = [];
    const write = m.store.write;
    m.store.write = async (j, expected) => {
      const result = await write(j, expected);
      if (result.kind === "saved") written.push(j.content);
      return result;
    };
    m.failWrites(1);

    await a.queue.submit(job(1, "古い"));
    expect(a.queue.hasUnsaved).toBe(true);
    await a.queue.submit(job(1, "新しい"));
    a.timers.fire();
    await a.queue.whenIdle();

    expect(m.rows.get(1)?.content).toBe("新しい");
    expect(written).toEqual(["新しい"]);
  });

  it("a failed write of a work left behind is still retried after opening another one", async () => {
    const m = memoryStore();
    m.rows.set(1, { title: "A", content: "", revision: 0 });
    m.rows.set(2, { title: "B", content: "", revision: 0 });
    const a = tab(m.store);
    a.queue.setBase(1, 0);
    a.queue.setBase(2, 0);
    m.failWrites(1);

    await a.queue.submit(job(1, "Aの書きかけ", "A"));
    await a.queue.submit(job(2, "Bの書きかけ", "B"));
    expect(m.rows.get(2)?.content).toBe("Bの書きかけ");
    a.timers.fire();
    await a.queue.whenIdle();
    expect(m.rows.get(1)?.content).toBe("Aの書きかけ");
  });
});
