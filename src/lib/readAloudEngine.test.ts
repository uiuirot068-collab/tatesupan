import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  READ_ALOUD_STORAGE_KEY,
  READ_ALOUD_VOICE_WAIT_MS,
  createReadAloudController,
  type ReadAloudEnv,
  type ReadAloudUtteranceLike,
  type ReadAloudVoiceInfo,
} from "./readAloudEngine";

/** A synth stub that records every call and lets a test fire utterance events by hand. */
function makeStub(initialVoices: ReadAloudVoiceInfo[] = [], options: { storage?: Record<string, string> } = {}) {
  const calls: string[] = [];
  const spoken: ReadAloudUtteranceLike[] = [];
  const listeners = new Set<() => void>();
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  let voices = initialVoices;
  const store = options.storage ?? {};
  const synth = {
    speak(utterance: ReadAloudUtteranceLike) {
      calls.push("speak");
      spoken.push(utterance);
    },
    cancel() {
      calls.push("cancel");
    },
    pause() {
      calls.push("pause");
    },
    resume() {
      calls.push("resume");
    },
    getVoices: () => voices,
    addEventListener: (_type: "voiceschanged", listener: () => void) => void listeners.add(listener),
    removeEventListener: (_type: "voiceschanged", listener: () => void) => void listeners.delete(listener),
  };
  const env: ReadAloudEnv = {
    synth,
    createUtterance: (text) => ({ text, lang: "", rate: 1, voice: null, onend: null, onerror: null }),
    storage: { getItem: (key) => store[key] ?? null, setItem: (key, value) => void (store[key] = value) },
    setTimeout: (fn, ms) => {
      const timer = { fn, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (handle) => void ((handle as { cleared: boolean }).cleared = true),
  };
  return {
    env,
    calls,
    spoken,
    store,
    timers,
    listenerCount: () => listeners.size,
    setVoices(next: ReadAloudVoiceInfo[]) {
      voices = next;
      listeners.forEach((listener) => listener());
    },
    last: () => spoken[spoken.length - 1],
  };
}

const jaLocal: ReadAloudVoiceInfo = { voiceURI: "ja-local", name: "Haruka", lang: "ja-JP", localService: true };
const jaOnline: ReadAloudVoiceInfo = { voiceURI: "ja-online", name: "Nanami Online", lang: "ja-JP", localService: false };
const enLocal: ReadAloudVoiceInfo = { voiceURI: "en-local", name: "Zira", lang: "en-US", localService: true };
const source = { content: "一つ目。二つ目。三つ目。", selection: { start: 0, end: 0 } };

function ready(voices = [jaLocal], opts?: Parameters<typeof makeStub>[1]) {
  const stub = makeStub(voices, opts);
  const controller = createReadAloudController(stub.env);
  controller.subscribe(() => {});
  return { stub, controller };
}

describe("B4 playback: play / next sentence / finish", () => {
  it("does nothing on its own: creating and subscribing never speaks", () => {
    const { stub } = ready();
    expect(stub.calls).toEqual([]);
  });

  it("speaks sentence by sentence with the on-device Japanese voice at the chosen speed, then goes idle", () => {
    const { stub, controller } = ready();
    controller.setRate(1.5);
    controller.start("full", source);
    expect(controller.getSnapshot()).toMatchObject({ status: "speaking", mode: "full", chunkIndex: 0, chunkCount: 3 });
    expect(stub.last()).toMatchObject({ text: "一つ目。", lang: "ja-JP", rate: 1.5, voice: jaLocal });
    stub.last().onend?.();
    expect(stub.last().text).toBe("二つ目。");
    expect(controller.getSnapshot().chunkIndex).toBe(1);
    stub.last().onend?.();
    stub.last().onend?.();
    expect(controller.getSnapshot()).toMatchObject({ status: "idle", mode: null, chunkCount: 0 });
    expect(stub.spoken.map((u) => u.text)).toEqual(["一つ目。", "二つ目。", "三つ目。"]);
  });

  it("reads the selection / the paragraph / the whole manuscript from the same source", () => {
    const { stub, controller } = ready();
    const text = "第一段落です。\n第二段落です。";
    controller.start("selection", { content: text, selection: { start: 8, end: 15 } });
    expect(stub.last().text).toBe("第二段落です。");
    controller.start("paragraph", { content: text, selection: { start: 2, end: 2 } });
    expect(stub.last().text).toBe("第一段落です。");
    controller.start("full", { content: text, selection: { start: 2, end: 2 } });
    expect(controller.getSnapshot().chunkCount).toBe(2);
  });

  it("an empty range starts nothing and explains why; the notice clears on the next successful start", () => {
    const { stub, controller } = ready();
    controller.start("selection", { content: "あ。", selection: { start: 1, end: 1 } });
    expect(stub.spoken).toEqual([]);
    expect(controller.getSnapshot().status).toBe("idle");
    expect(controller.getSnapshot().emptyNotice).toContain("範囲");
    controller.start("full", { content: "あ。", selection: { start: 0, end: 0 } });
    expect(controller.getSnapshot().emptyNotice).toBeNull();
  });
});

describe("B4 pause / resume / stop", () => {
  it("pauses and resumes the current sentence without restarting it", () => {
    const { stub, controller } = ready();
    controller.start("full", source);
    controller.pause();
    expect(controller.getSnapshot().status).toBe("paused");
    expect(stub.calls.at(-1)).toBe("pause");
    const spokenBefore = stub.spoken.length;
    controller.resume();
    expect(controller.getSnapshot().status).toBe("speaking");
    expect(stub.calls.at(-1)).toBe("resume");
    expect(stub.spoken.length).toBe(spokenBefore);
  });

  it("pause/resume are inert in the wrong state", () => {
    const { stub, controller } = ready();
    controller.pause();
    controller.resume();
    expect(stub.calls).toEqual([]);
  });

  it("stop cancels the synth and returns to idle; a late end event from the cancelled sentence does nothing", () => {
    const { stub, controller } = ready();
    controller.start("full", source);
    const first = stub.last();
    controller.stop();
    expect(controller.getSnapshot()).toMatchObject({ status: "idle", chunkCount: 0 });
    expect(stub.calls.at(-2)).toBe("cancel");
    const spokenBefore = stub.spoken.length;
    first.onend?.(); // cancel() makes real engines fire end/error for the old utterance
    first.onerror?.({ error: "interrupted" });
    expect(stub.spoken.length).toBe(spokenBefore);
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("stop while paused also clears the pause so the next reading is audible", () => {
    const { stub, controller } = ready();
    controller.start("full", source);
    controller.pause();
    controller.stop();
    expect(stub.calls.slice(-2)).toEqual(["cancel", "resume"]);
    controller.start("full", source);
    expect(controller.getSnapshot().status).toBe("speaking");
  });
});

describe("B4 duplicate-overlap prevention", () => {
  it("starting again cancels the previous run first, and the old run's events cannot advance the new one", () => {
    const { stub, controller } = ready();
    controller.start("full", source);
    const oldFirst = stub.last();
    controller.start("full", source);
    expect(stub.calls.filter((c) => c === "cancel").length).toBeGreaterThanOrEqual(2); // once per start
    expect(controller.getSnapshot().chunkIndex).toBe(0);
    const spokenBefore = stub.spoken.length;
    oldFirst.onend?.(); // stale
    expect(stub.spoken.length).toBe(spokenBefore);
    expect(controller.getSnapshot().chunkIndex).toBe(0);
    stub.last().onend?.(); // current
    expect(controller.getSnapshot().chunkIndex).toBe(1);
  });

  it("only one utterance is ever outstanding: every speak() is preceded by a cancel() of the previous run", () => {
    const { stub, controller } = ready();
    for (let i = 0; i < 4; i += 1) controller.start("full", source);
    const speakIndexes = stub.calls.flatMap((call, index) => (call === "speak" ? [index] : []));
    for (const index of speakIndexes) expect(stub.calls.slice(0, index)).toContain("cancel");
    // between two start()s there is always a cancel
    let sinceCancel = 0;
    for (const call of stub.calls) {
      if (call === "cancel") sinceCancel = 0;
      if (call === "speak") sinceCancel += 1;
      expect(sinceCancel).toBeLessThanOrEqual(1);
    }
  });
});

describe("B4 speed", () => {
  it("restarts the current sentence at the new speed while speaking, and persists the speed", () => {
    const { stub, controller } = ready();
    controller.start("full", source);
    stub.last().onend?.(); // now on sentence 2
    controller.setRate(1.8);
    expect(stub.last()).toMatchObject({ text: "二つ目。", rate: 1.8 });
    expect(controller.getSnapshot()).toMatchObject({ status: "speaking", chunkIndex: 1, rate: 1.8 });
    expect(JSON.parse(stub.store[READ_ALOUD_STORAGE_KEY])).toMatchObject({ rate: 1.8 });
  });

  it("applies a speed changed while paused when reading resumes (and does not auto-play)", () => {
    const { stub, controller } = ready();
    controller.start("full", source);
    controller.pause();
    const spokenBefore = stub.spoken.length;
    controller.setRate(0.7);
    expect(stub.spoken.length).toBe(spokenBefore);
    expect(controller.getSnapshot().status).toBe("paused");
    controller.resume();
    expect(stub.last()).toMatchObject({ text: "一つ目。", rate: 0.7 });
    expect(controller.getSnapshot().status).toBe("speaking");
  });

  it("restores a saved speed and clamps a corrupted one", () => {
    const saved = ready([jaLocal], { storage: { [READ_ALOUD_STORAGE_KEY]: JSON.stringify({ rate: 1.4 }) } });
    expect(saved.controller.getSnapshot().rate).toBe(1.4);
    const corrupt = ready([jaLocal], { storage: { [READ_ALOUD_STORAGE_KEY]: "not json" } });
    expect(corrupt.controller.getSnapshot().rate).toBe(1);
    const extreme = ready([jaLocal], { storage: { [READ_ALOUD_STORAGE_KEY]: JSON.stringify({ rate: 99 }) } });
    expect(extreme.controller.getSnapshot().rate).toBe(2);
  });
});

describe("B4 voices", () => {
  it("waits for voiceschanged, then becomes ready with the on-device Japanese voice", () => {
    const stub = makeStub([]);
    const controller = createReadAloudController(stub.env);
    controller.subscribe(() => {});
    expect(controller.getSnapshot()).toMatchObject({ voicesReady: false, selectedVoiceURI: null });
    stub.setVoices([enLocal, jaLocal]);
    expect(controller.getSnapshot()).toMatchObject({ voicesReady: true, selectedVoiceURI: "ja-local" });
  });

  it("stops showing 'loading' after the wait when a browser never reports voices", () => {
    const stub = makeStub([]);
    const controller = createReadAloudController(stub.env);
    controller.subscribe(() => {});
    const timer = stub.timers.at(-1)!;
    expect(timer.ms).toBe(READ_ALOUD_VOICE_WAIT_MS);
    timer.fn();
    expect(controller.getSnapshot()).toMatchObject({ voicesReady: true, selectedVoiceURI: null });
  });

  it("refuses to speak (no-voice) when there is no on-device Japanese voice — never falling back to the default/online one", () => {
    const { stub, controller } = ready([enLocal, jaOnline]);
    expect(controller.getSnapshot().selectedVoiceURI).toBeNull();
    controller.start("full", source);
    expect(stub.spoken).toEqual([]);
    expect(controller.getSnapshot()).toMatchObject({ status: "idle", failure: "no-voice" });
  });

  it("speaks with an online voice only after the writer explicitly chose it, and reports that", () => {
    const { stub, controller } = ready([jaLocal, jaOnline]);
    controller.setPreferredVoice("ja-online");
    expect(controller.getSnapshot()).toMatchObject({ selectedVoiceURI: "ja-online", selectedIsOnline: true });
    controller.start("full", source);
    expect(stub.last().voice).toBe(jaOnline);
    expect(JSON.parse(stub.store[READ_ALOUD_STORAGE_KEY])).toMatchObject({ voiceURI: "ja-online" });
    controller.setPreferredVoice(null);
    expect(controller.getSnapshot()).toMatchObject({ selectedVoiceURI: "ja-local", selectedIsOnline: false });
  });

  it("switching voice while speaking re-speaks the current sentence with the new voice", () => {
    const second: ReadAloudVoiceInfo = { voiceURI: "ja-local-2", name: "Ichiro", lang: "ja-JP", localService: true };
    const { stub, controller } = ready([jaLocal, second]);
    controller.start("full", source);
    controller.setPreferredVoice("ja-local-2");
    expect(stub.last()).toMatchObject({ text: "一つ目。", voice: second });
  });

  it("a device error mid-reading ends the run with a message; a 'canceled' error is not an error", () => {
    const { stub, controller } = ready();
    controller.start("full", source);
    stub.last().onerror?.({ error: "canceled" });
    expect(controller.getSnapshot().status).toBe("speaking");
    stub.last().onerror?.({ error: "synthesis-failed" });
    expect(controller.getSnapshot()).toMatchObject({ status: "idle", failure: "speech-error" });
  });
});

describe("B4 unsupported browser and lifecycle", () => {
  it("reports unsupported and every action is a harmless no-op", () => {
    const controller = createReadAloudController({
      synth: null,
      createUtterance: null,
      storage: null,
      setTimeout: () => null,
      clearTimeout: () => {},
    });
    controller.subscribe(() => {})();
    expect(controller.getSnapshot()).toMatchObject({ support: "unsupported", voicesReady: true, status: "idle" });
    controller.start("full", source);
    controller.pause();
    controller.resume();
    controller.stop();
    controller.setRate(1.2);
    controller.dispose();
    expect(controller.getSnapshot().status).toBe("idle");
  });

  it("dispose (unmount / document change) cancels an active reading and detaches the voiceschanged listener", () => {
    const { stub, controller } = ready();
    controller.start("full", source);
    controller.dispose();
    expect(controller.getSnapshot().status).toBe("idle");
    expect(stub.calls).toContain("cancel");
    expect(stub.listenerCount()).toBe(0);
    // a StrictMode-style remount can subscribe again and read again
    controller.subscribe(() => {});
    controller.start("full", source);
    expect(controller.getSnapshot().status).toBe("speaking");
  });

  it("the last unsubscribe detaches the browser listener and pending voice wait", () => {
    const stub = makeStub([]);
    const controller = createReadAloudController(stub.env);
    const off = controller.subscribe(() => {});
    expect(stub.listenerCount()).toBe(1);
    off();
    expect(stub.listenerCount()).toBe(0);
    expect(stub.timers.at(-1)?.cleared).toBe(true);
  });

  it("notifies subscribers on every state change", () => {
    const stub = makeStub([jaLocal]);
    const controller = createReadAloudController(stub.env);
    let notified = 0;
    controller.subscribe(() => (notified += 1));
    controller.start("full", source);
    controller.pause();
    controller.stop();
    expect(notified).toBeGreaterThanOrEqual(3);
  });
});

describe("B4 privacy: no network path exists in the read-aloud code", () => {
  const files = [
    "src/lib/readAloud.ts",
    "src/lib/readAloudEngine.ts",
    "src/hooks/useReadAloud.ts",
    "src/components/ReadAloudControls.tsx",
  ];
  const codeOnly = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

  it.each(files)("%s has no fetch / XHR / beacon / WebSocket / EventSource / audio-upload / external URL", (file) => {
    const code = codeOnly(readFileSync(resolve(file), "utf8"));
    expect(code).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|FormData|MediaRecorder|new Audio\(|AudioContext|https?:\/\//);
  });

  it("names no cloud speech vendor or VOICEVOX dependency", () => {
    const all = files.map((file) => readFileSync(resolve(file), "utf8")).join("\n");
    expect(all).not.toMatch(/azure|polly|elevenlabs|openai|google-cloud|VOICEVOX/i);
  });
});
