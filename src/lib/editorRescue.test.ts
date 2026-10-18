import { afterEach, describe, expect, it } from "vitest";
import {
  classifyLoadError,
  clearEditorRescue,
  hasRescuableText,
  loadFailureMessage,
  noteEditorScreen,
  readEditorRescue,
  rescueFilename,
  rescueText,
  rescueTitle,
} from "./editorRescue";

// TSP-SAFE-003 (TSP-REVIEW-001 3の10): the way out when the editor crashes or
// a work cannot be opened.

afterEach(() => clearEditorRescue());

describe("rescue buffer", () => {
  it("keeps the last screen the editor showed", () => {
    noteEditorScreen({ docId: 1, title: "一", content: "古い", plotNote: "", settings: null, sample: false });
    noteEditorScreen({ docId: 1, title: "一", content: "新しい", plotNote: "", settings: null, sample: false });
    expect(readEditorRescue()?.content).toBe("新しい");
  });

  it("nothing to hand back for an empty screen", () => {
    expect(hasRescuableText(null)).toBe(false);
    expect(hasRescuableText({ docId: 1, title: "題", content: "  \n", plotNote: "", settings: null, sample: false })).toBe(false);
    expect(hasRescuableText({ docId: 1, title: "", content: "", plotNote: "メモだけ", settings: null, sample: false })).toBe(true);
  });

  it("TXT holds the manuscript and the memo; names are safe for Windows and phones", () => {
    expect(rescueText({ title: "題", content: "本文", plotNote: "" })).toBe("本文");
    expect(rescueText({ title: "題", content: "本文", plotNote: "メモ" })).toBe("本文\n\n――― 作品のメモ ―――\n\nメモ");
    expect(rescueFilename('第1話: "海"/前編?')).toBe("第1話_ _海__前編__救出.txt");
    expect(rescueFilename("  ")).toBe("無題_救出.txt");
    expect(rescueTitle("")).toBe("無題（救出した控え）");
  });
});

describe("why a work did not open", () => {
  it("this browser's storage being unusable is told apart from other errors", () => {
    expect(classifyLoadError(Object.assign(new Error("x"), { name: "MissingAPIError" })).kind).toBe("storage");
    expect(classifyLoadError(Object.assign(new Error("x"), { name: "OpenFailedError", inner: { name: "InvalidStateError" } })).kind).toBe("storage");
    expect(classifyLoadError(new TypeError("boom")).kind).toBe("other");
  });

  it("every failure has a message for the person", () => {
    for (const failure of [
      { kind: "storage", detail: "" },
      { kind: "cloud-unreachable", detail: "", deviceCopyId: null },
      { kind: "cloud-signed-out", deviceCopyId: 3 },
      { kind: "cloud-missing", deviceCopyId: null },
      { kind: "other", detail: "" },
    ] as const) {
      expect(loadFailureMessage(failure).length).toBeGreaterThan(10);
    }
  });
});
