/**
 * TSP-B4 音読β — the playback controller around the browser's SpeechSynthesis.
 *
 * Framework-free and environment-injected so it runs (and is tested) in Node
 * against a stub synth. The React hook `useReadAloud` is a thin
 * `useSyncExternalStore` binding over `subscribe` / `getSnapshot`.
 *
 * Contract:
 *  - text only ever goes to the injected `synth` (the device / browser speech
 *    engine); there is no fetch, XHR, beacon or audio upload anywhere;
 *  - only an on-device Japanese voice is used unless the writer explicitly picked
 *    an online one (`chooseReadAloudVoice`); with neither, nothing is spoken;
 *  - one run at a time: every start / stop / speed change bumps a run id, so the
 *    `end` / `error` events that `cancel()` itself produces can never advance or
 *    fail the NEW run (no duplicate / overlapping speech);
 *  - reading is never started by anything but an explicit `start()` call.
 */
import {
  READ_ALOUD_EMPTY_NOTICES,
  READ_ALOUD_RATE_DEFAULT,
  buildReadAloudChunks,
  chooseReadAloudVoice,
  clampReadAloudRate,
  type ReadAloudMode,
  type ReadAloudRange,
  type ReadAloudVoiceLike,
} from "./readAloud";

export const READ_ALOUD_STORAGE_KEY = "tatespun.readAloud.v1";
/** Some browsers never fire `voiceschanged`; stop showing "loading" after this long. */
export const READ_ALOUD_VOICE_WAIT_MS = 1500;

export type ReadAloudStatus = "idle" | "speaking" | "paused";
export type ReadAloudSupport = "checking" | "supported" | "unsupported";
export type ReadAloudFailure = "no-voice" | "speech-error";

export type ReadAloudVoiceInfo = ReadAloudVoiceLike;

export interface ReadAloudUtteranceLike {
  text: string;
  lang: string;
  rate: number;
  voice: unknown;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
}

export interface ReadAloudSynthLike {
  speak(utterance: never): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  getVoices(): ReadAloudVoiceInfo[];
  addEventListener?(type: "voiceschanged", listener: () => void): void;
  removeEventListener?(type: "voiceschanged", listener: () => void): void;
}

export interface ReadAloudStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface ReadAloudEnv {
  /** `window.speechSynthesis`, or null where the browser has none. */
  synth: ReadAloudSynthLike | null;
  /** `(text) => new SpeechSynthesisUtterance(text)`, or null where unsupported. */
  createUtterance: ((text: string) => ReadAloudUtteranceLike) | null;
  storage: ReadAloudStorageLike | null;
  setTimeout: (callback: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface ReadAloudState {
  readonly support: ReadAloudSupport;
  /** False only until the browser reported its voices (or the wait elapsed). */
  readonly voicesReady: boolean;
  readonly status: ReadAloudStatus;
  readonly mode: ReadAloudMode | null;
  /** 0-based sentence being spoken; meaningful while status !== "idle". */
  readonly chunkIndex: number;
  readonly chunkCount: number;
  readonly rate: number;
  readonly localVoices: readonly ReadAloudVoiceInfo[];
  readonly onlineVoices: readonly ReadAloudVoiceInfo[];
  /** URI the next reading will use (the explicit choice, else the first on-device Japanese voice). */
  readonly selectedVoiceURI: string | null;
  readonly selectedIsOnline: boolean;
  /** The writer's explicit choice, if any (null = automatic on-device voice). */
  readonly preferredVoiceURI: string | null;
  /** Why a `start` did nothing (empty range) — shown as guidance, cleared on the next start. */
  readonly emptyNotice: string | null;
  readonly failure: ReadAloudFailure | null;
}

export const READ_ALOUD_SERVER_STATE: ReadAloudState = {
  support: "checking",
  voicesReady: false,
  status: "idle",
  mode: null,
  chunkIndex: 0,
  chunkCount: 0,
  rate: READ_ALOUD_RATE_DEFAULT,
  localVoices: [],
  onlineVoices: [],
  selectedVoiceURI: null,
  selectedIsOnline: false,
  preferredVoiceURI: null,
  emptyNotice: null,
  failure: null,
};

export interface ReadAloudSource {
  content: string;
  selection: ReadAloudRange;
}

export interface ReadAloudController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): ReadAloudState;
  start(mode: ReadAloudMode, source: ReadAloudSource): void;
  pause(): void;
  resume(): void;
  stop(): void;
  setRate(rate: number): void;
  setPreferredVoice(voiceURI: string | null): void;
  /** Cancels speech and detaches browser listeners; the controller stays reusable (StrictMode remounts). */
  dispose(): void;
}

const isCancelError = (error: string | undefined) => error === "canceled" || error === "interrupted";

function readPrefs(storage: ReadAloudStorageLike | null): { rate: number; voiceURI: string | null } {
  try {
    const raw = storage?.getItem(READ_ALOUD_STORAGE_KEY);
    if (!raw) return { rate: READ_ALOUD_RATE_DEFAULT, voiceURI: null };
    const parsed = JSON.parse(raw) as { rate?: unknown; voiceURI?: unknown };
    return {
      rate: clampReadAloudRate(parsed.rate),
      voiceURI: typeof parsed.voiceURI === "string" ? parsed.voiceURI : null,
    };
  } catch {
    return { rate: READ_ALOUD_RATE_DEFAULT, voiceURI: null };
  }
}

export function createReadAloudController(env: ReadAloudEnv): ReadAloudController {
  const { synth, createUtterance } = env;
  const supported = !!synth && !!createUtterance;
  const prefs = readPrefs(env.storage);

  const listeners = new Set<() => void>();
  let run = 0;
  let chunks: string[] = [];
  let restartOnResume = false;
  let voiceWait: unknown = null;
  let voicesAttached = false;
  let voices: ReadAloudVoiceInfo[] = [];

  const derive = (): Pick<ReadAloudState, "localVoices" | "onlineVoices" | "selectedVoiceURI" | "selectedIsOnline"> => {
    const choice = chooseReadAloudVoice(voices, state.preferredVoiceURI);
    return {
      localVoices: choice.local,
      onlineVoices: choice.online,
      selectedVoiceURI: choice.selected?.voiceURI ?? null,
      selectedIsOnline: choice.selectedIsOnline,
    };
  };

  let state: ReadAloudState = {
    ...READ_ALOUD_SERVER_STATE,
    support: supported ? "supported" : "unsupported",
    voicesReady: !supported,
    rate: prefs.rate,
    preferredVoiceURI: prefs.voiceURI,
  };

  const set = (patch: Partial<ReadAloudState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  const currentVoice = (): ReadAloudVoiceInfo | null =>
    chooseReadAloudVoice(voices, state.preferredVoiceURI).selected;

  const refreshVoices = () => {
    if (!synth) return;
    voices = synth.getVoices();
    state = { ...state, ...derive() };
    if (voices.length > 0 && voiceWait !== null) {
      env.clearTimeout(voiceWait);
      voiceWait = null;
    }
    set({ voicesReady: voices.length > 0 || state.voicesReady });
  };

  const attachVoices = () => {
    if (!synth || voicesAttached) return;
    voicesAttached = true;
    synth.addEventListener?.("voiceschanged", refreshVoices);
    voices = synth.getVoices();
    state = { ...state, ...derive(), voicesReady: voices.length > 0 };
    if (voices.length === 0) {
      voiceWait = env.setTimeout(() => {
        voiceWait = null;
        set({ voicesReady: true });
      }, READ_ALOUD_VOICE_WAIT_MS);
    }
  };

  const detachVoices = () => {
    if (!synth || !voicesAttached) return;
    voicesAttached = false;
    synth.removeEventListener?.("voiceschanged", refreshVoices);
    if (voiceWait !== null) {
      env.clearTimeout(voiceWait);
      voiceWait = null;
    }
  };

  const savePrefs = () => {
    try {
      env.storage?.setItem(
        READ_ALOUD_STORAGE_KEY,
        JSON.stringify({ rate: state.rate, voiceURI: state.preferredVoiceURI }),
      );
    } catch {
      // Best-effort browser-local preference.
    }
  };

  const finish = (patch: Partial<ReadAloudState> = {}) => {
    chunks = [];
    restartOnResume = false;
    set({ status: "idle", mode: null, chunkIndex: 0, chunkCount: 0, ...patch });
  };

  const speakChunk = (index: number) => {
    const voice = currentVoice();
    if (!synth || !createUtterance || !voice) {
      run += 1;
      finish({ failure: "no-voice" });
      return;
    }
    const thisRun = run;
    const utterance = createUtterance(chunks[index]);
    utterance.lang = voice.lang || "ja-JP";
    utterance.voice = voice;
    utterance.rate = state.rate;
    utterance.onend = () => {
      if (thisRun !== run) return; // an event from a cancelled utterance
      const next = index + 1;
      if (next >= chunks.length) {
        finish();
        return;
      }
      set({ chunkIndex: next });
      speakChunk(next);
    };
    utterance.onerror = (event) => {
      if (thisRun !== run || isCancelError(event.error)) return;
      run += 1;
      finish({ failure: "speech-error" });
    };
    synth.speak(utterance as never);
  };

  /** Cancels whatever is queued/speaking so a new run starts from a clean synth. */
  const cancelSynth = () => {
    if (!synth) return;
    synth.cancel();
    synth.resume(); // a cancel while paused can leave Chrome's queue paused
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      attachVoices();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) detachVoices();
      };
    },
    getSnapshot: () => state,

    start(mode, source) {
      if (!supported) return;
      const nextChunks = buildReadAloudChunks(mode, source.content, source.selection);
      run += 1;
      cancelSynth();
      restartOnResume = false;
      if (nextChunks.length === 0) {
        chunks = [];
        set({ status: "idle", mode: null, chunkIndex: 0, chunkCount: 0, failure: null, emptyNotice: READ_ALOUD_EMPTY_NOTICES[mode] });
        return;
      }
      chunks = nextChunks;
      set({ status: "speaking", mode, chunkIndex: 0, chunkCount: nextChunks.length, failure: null, emptyNotice: null });
      speakChunk(0);
    },

    pause() {
      if (!synth || state.status !== "speaking") return;
      synth.pause();
      set({ status: "paused" });
    },

    resume() {
      if (!synth || state.status !== "paused") return;
      if (restartOnResume) {
        // The speed changed while paused: re-speak the current sentence at the new speed.
        restartOnResume = false;
        run += 1;
        cancelSynth();
        set({ status: "speaking" });
        speakChunk(state.chunkIndex);
        return;
      }
      synth.resume();
      set({ status: "speaking" });
    },

    stop() {
      if (!synth || (state.status === "idle" && chunks.length === 0)) return;
      run += 1;
      cancelSynth();
      finish();
    },

    setRate(rate) {
      const next = clampReadAloudRate(rate);
      if (next === state.rate) return;
      set({ rate: next });
      savePrefs();
      if (state.status === "speaking") {
        run += 1;
        cancelSynth();
        speakChunk(state.chunkIndex);
      } else if (state.status === "paused") {
        restartOnResume = true;
      }
    },

    setPreferredVoice(voiceURI) {
      if (voiceURI === state.preferredVoiceURI) return;
      state = { ...state, preferredVoiceURI: voiceURI };
      state = { ...state, ...derive() };
      savePrefs();
      set({ failure: null });
      if (state.status === "speaking") {
        run += 1;
        cancelSynth();
        speakChunk(state.chunkIndex);
      } else if (state.status === "paused") {
        restartOnResume = true;
      }
    },

    dispose() {
      if (synth && (state.status !== "idle" || chunks.length > 0)) {
        run += 1;
        cancelSynth();
        finish();
      }
      detachVoices();
    },
  };
}

/** The real browser environment; on the server (no `window`) every part is null and the controller reports "unsupported". */
export function createBrowserReadAloudEnv(): ReadAloudEnv {
  if (typeof window === "undefined") {
    return { synth: null, createUtterance: null, storage: null, setTimeout: () => null, clearTimeout: () => {} };
  }
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  const Utterance = "SpeechSynthesisUtterance" in window ? window.SpeechSynthesisUtterance : null;
  let storage: ReadAloudStorageLike | null = null;
  try {
    storage = window.localStorage;
  } catch {
    storage = null;
  }
  return {
    synth: synth as unknown as ReadAloudSynthLike | null,
    createUtterance: Utterance ? (text) => new Utterance(text) as unknown as ReadAloudUtteranceLike : null,
    storage,
    setTimeout: (callback, ms) => window.setTimeout(callback, ms),
    clearTimeout: (handle) => window.clearTimeout(handle as number),
  };
}
