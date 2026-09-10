import { describe, expect, it } from "vitest";
import {
  applyTextInputChange,
  createTextInputActivityState,
  finishComposition,
  startComposition,
  type TextInputActivityState,
} from "./model";
import {
  activeWorkDurationMs,
  createWorkSessionStore,
  WORK_SESSION_STORAGE_KEY,
} from "./store";

class FakeLocalStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function testStore(storage = new FakeLocalStorage()) {
  let id = 0;
  return {
    storage,
    store: createWorkSessionStore(() => storage, () => `pause-work-${++id}`),
  };
}

describe("11-B limited Pause / Resume state and counting", () => {
  it("transitions start → active → paused → active without creating a new session", () => {
    const { store } = testStore();
    const started = store.start(1_000);
    expect(started).toMatchObject({ status: "active", pausedAt: null });
    const paused = store.pause(2_000);
    expect(paused).toMatchObject({ id: started.id, status: "paused", pausedAt: 2_000 });
    const resumed = store.resume(5_000);
    expect(resumed).toMatchObject({
      id: started.id,
      status: "active",
      pausedAt: null,
      accumulatedPausedMs: 3_000,
    });
    expect(store.read().history).toHaveLength(0);
  });

  it.each([
    ["normal typing", { insertedCodePoints: 4, deletedCodePoints: 0 }],
    ["IME commit", { insertedCodePoints: 3, deletedCodePoints: 0 }],
    ["paste", { insertedCodePoints: 20, deletedCodePoints: 0 }],
    ["paste over selection", { insertedCodePoints: 10, deletedCodePoints: 5 }],
    ["replacement", { insertedCodePoints: 7, deletedCodePoints: 3 }],
    ["deletion", { insertedCodePoints: 0, deletedCodePoints: 8 }],
    ["Undo", { insertedCodePoints: 0, deletedCodePoints: 0 }],
    ["Redo", { insertedCodePoints: 0, deletedCodePoints: 0 }],
  ])("ignores %s while paused", (_label, delta) => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 10, deletedCodePoints: 0 });
    store.pause(2_000);
    store.record(delta);
    expect(store.read().active?.writtenCharacterCount).toBe(10);
  });

  it("counts an IME commit before pause and ignores a commit finalized during pause", () => {
    const { store } = testStore();
    store.start(1_000);
    let input = startComposition(createTextInputActivityState(""), "", 0, 0);
    let commit = finishComposition(input, "日本");
    store.record(commit.delta);
    expect(store.read().active?.writtenCharacterCount).toBe(2);

    store.pause(2_000);
    input = startComposition(commit.state, "日本", 2, 2);
    commit = finishComposition(input, "日本語");
    store.record(commit.delta);
    expect(store.read().active?.writtenCharacterCount).toBe(2);
  });

  it("re-baselines the current document so paused changes are never counted on resume", () => {
    const { store } = testStore();
    let manuscript = "";
    let input: TextInputActivityState = createTextInputActivityState(manuscript);
    const apply = (next: string) => {
      const transition = applyTextInputChange(input, next);
      input = transition.state;
      manuscript = next;
      store.record(transition.delta);
    };

    store.start(1_000);
    apply("あ".repeat(100));
    store.pause(2_000);
    apply("あ".repeat(400));
    expect(store.read().active?.writtenCharacterCount).toBe(100);

    input = createTextInputActivityState(manuscript);
    store.resume(5_000);
    expect(store.read().active?.writtenCharacterCount).toBe(100);
    apply(`${manuscript}${"い".repeat(20)}`);
    expect(store.read().active?.writtenCharacterCount).toBe(120);
  });

  it("supports multiple pause cycles and counts only active insertions", () => {
    const { store } = testStore();
    store.start(0);
    store.record({ insertedCodePoints: 5, deletedCodePoints: 0 });
    store.pause(1_000);
    store.record({ insertedCodePoints: 50, deletedCodePoints: 0 });
    store.resume(2_000);
    store.record({ insertedCodePoints: 6, deletedCodePoints: 0 });
    store.pause(3_000);
    store.record({ insertedCodePoints: 60, deletedCodePoints: 0 });
    store.resume(4_000);
    store.record({ insertedCodePoints: 7, deletedCodePoints: 0 });
    expect(store.read().active?.writtenCharacterCount).toBe(18);
  });

  it("keeps the actual manuscript independent from the paused written count", () => {
    const { store } = testStore();
    let manuscript = "本文";
    store.start(0);
    store.pause(1_000);
    manuscript += "は増える";
    store.record({ insertedCodePoints: 4, deletedCodePoints: 0 });
    expect(Array.from(manuscript)).toHaveLength(6);
    expect(store.read().active?.writtenCharacterCount).toBe(0);
  });
});

describe("11-B active-time Pause / Resume semantics", () => {
  it("freezes while paused, resumes from the frozen value, and excludes multiple pauses", () => {
    const { store } = testStore();
    store.start(0);
    expect(activeWorkDurationMs(store.read().active!, 30_000)).toBe(30_000);
    store.pause(30_000);
    expect(activeWorkDurationMs(store.read().active!, 75_000)).toBe(30_000);
    store.resume(75_000);
    expect(activeWorkDurationMs(store.read().active!, 90_000)).toBe(45_000);
    store.pause(90_000);
    expect(activeWorkDurationMs(store.read().active!, 120_000)).toBe(45_000);
    store.resume(120_000);
    expect(activeWorkDurationMs(store.read().active!, 135_000)).toBe(60_000);
  });

  it("ends while paused with the actual end timestamp and active duration only", () => {
    const { store } = testStore();
    store.start(0);
    store.record({ insertedCodePoints: 12, deletedCodePoints: 0 });
    store.pause(30_000);
    const completed = store.end(75_000);
    expect(completed).toEqual({
      id: "pause-work-1",
      startedAt: 0,
      endedAt: 75_000,
      durationMs: 30_000,
      writtenCharacterCount: 12,
    });
  });
});

describe("11-B paused persistence, migration, and history", () => {
  it("restores PAUSED after reload/navigation without adding away time", () => {
    const { store, storage } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 9, deletedCodePoints: 0 });
    store.pause(31_000);

    const restored = createWorkSessionStore(() => storage).read().active!;
    expect(restored).toMatchObject({
      status: "paused",
      pausedAt: 31_000,
      writtenCharacterCount: 9,
    });
    expect(activeWorkDurationMs(restored, 3_631_000)).toBe(30_000);
  });

  it("loads old active sessions without pause fields as active defaults", () => {
    const storage = new FakeLocalStorage();
    storage.setItem(WORK_SESSION_STORAGE_KEY, JSON.stringify({
      active: { id: "old", startedAt: 1_000, writtenCharacterCount: 4 },
      history: [],
    }));
    expect(createWorkSessionStore(() => storage).read().active).toEqual({
      id: "old",
      startedAt: 1_000,
      writtenCharacterCount: 4,
      status: "active",
      pausedAt: null,
      accumulatedPausedMs: 0,
    });
  });

  it("keeps one Start → End history record across pause/resume", () => {
    const { store } = testStore();
    store.start(1_000);
    store.record({ insertedCodePoints: 3, deletedCodePoints: 0 });
    store.pause(2_000);
    store.resume(4_000);
    store.record({ insertedCodePoints: 2, deletedCodePoints: 0 });
    store.end(6_000);
    expect(store.read().history).toEqual([{
      id: "pause-work-1",
      startedAt: 1_000,
      endedAt: 6_000,
      durationMs: 3_000,
      writtenCharacterCount: 5,
    }]);
  });
});
