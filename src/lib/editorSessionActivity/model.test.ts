import { describe, expect, it } from "vitest";
import {
  applyTextInputChange,
  captureBeforeInput,
  codePointLength,
  createTextInputActivityState,
  finishComposition,
  formatWorkSessionShareText,
  measureBeforeInputCommit,
  measureContiguousMutation,
  measureEditorActivityOperation,
  measureReplacement,
  startComposition,
} from "./model";

describe("11-B written-text input detection and Unicode unit", () => {
  it("detects inserted and deleted operands separately from final manuscript length", () => {
    expect(measureContiguousMutation("あ".repeat(100), "あ".repeat(50))).toEqual({
      insertedCodePoints: 0,
      deletedCodePoints: 50,
    });
    expect(measureContiguousMutation("あ".repeat(50), "あ".repeat(80))).toEqual({
      insertedCodePoints: 30,
      deletedCodePoints: 0,
    });
  });

  it("uses Unicode code points: an astral emoji is one, while base+combining mark is two", () => {
    expect(codePointLength("😀")).toBe(1);
    expect(codePointLength("e\u0301")).toBe(2);
    expect(measureContiguousMutation("", "😀e\u0301")).toEqual({
      insertedCodePoints: 3,
      deletedCodePoints: 0,
    });
  });

  it("insertion adds inserted, deletion adds deleted, replacement adds both full operands", () => {
    expect(measureContiguousMutation("abc", "abc日本")).toEqual({ insertedCodePoints: 2, deletedCodePoints: 0 });
    expect(measureContiguousMutation("abc日本", "abc")).toEqual({ insertedCodePoints: 0, deletedCodePoints: 2 });
    expect(measureReplacement("abc", "abd")).toEqual({ insertedCodePoints: 3, deletedCodePoints: 3 });
  });
});
describe("11-B IME policy", () => {
  it("composition updates/intermediate conversions add zero; compositionend adds the final commit exactly once", () => {
    let state = startComposition(createTextInputActivityState("前後"), "前後", 1, 1);
    let transition = applyTextInputChange(state, "前k後");
    expect(transition.delta).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
    state = transition.state;
    transition = applyTextInputChange(state, "前か後");
    expect(transition.delta).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
    state = transition.state;
    transition = finishComposition(state, "前漢字後");
    expect(transition.delta).toEqual({ insertedCodePoints: 2, deletedCodePoints: 0 });

    const trailingInput = applyTextInputChange(transition.state, "前漢字後");
    expect(trailingInput.delta).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
  });

  it("composition replacing a selection counts deleted selection + final inserted reading", () => {
    const state = startComposition(createTextInputActivityState("旧字"), "旧字", 0, 1);
    const result = finishComposition(state, "新字");
    expect(result.delta).toEqual({ insertedCodePoints: 1, deletedCodePoints: 1 });
  });

  it("cancelled/unchanged composition adds zero", () => {
    const state = startComposition(createTextInputActivityState("本文"), "本文", 1, 1);
    expect(finishComposition(state, "本文").delta).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
  });
});

describe("11-B browser input semantics", () => {
  it("10-11. Undo and Redo both produce zero written-character delta", () => {
    const undo = measureBeforeInputCommit(
      { beforeText: "", selectionStart: 0, selectionEnd: 0, inputType: "historyUndo" },
      "0123456789"
    );
    const redo = measureBeforeInputCommit(
      { beforeText: "0123456789", selectionStart: 10, selectionEnd: 10, inputType: "historyRedo" },
      ""
    );
    expect(undo).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
    expect(redo).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
  });

  it("the generic contiguous diff remains independent of Undo/Redo product meaning", () => {
    expect(measureContiguousMutation("0123456789", "")).toEqual({ insertedCodePoints: 0, deletedCodePoints: 10 });
    expect(measureContiguousMutation("", "0123456789")).toEqual({ insertedCodePoints: 10, deletedCodePoints: 0 });
  });

  it("Delete, Cut, and Select-All Delete count the deleted code points", () => {
    for (const inputType of ["deleteContentBackward", "deleteByCut", "deleteContentForward"]) {
      expect(
        measureBeforeInputCommit(
          { beforeText: "A😀B", selectionStart: 1, selectionEnd: 3, inputType },
          "AB"
        )
      ).toEqual({ insertedCodePoints: 0, deletedCodePoints: 1 });
    }
    expect(
      measureBeforeInputCommit(
        { beforeText: "全選択😀", selectionStart: 0, selectionEnd: 5, inputType: "deleteByCut" },
        ""
      )
    ).toEqual({ insertedCodePoints: 0, deletedCodePoints: 4 });
  });

  it("paste counts inserted code points", () => {
    expect(
      measureBeforeInputCommit(
        { beforeText: "前後", selectionStart: 1, selectionEnd: 1, inputType: "insertFromPaste" },
        "前😀文後"
      )
    ).toEqual({ insertedCodePoints: 2, deletedCodePoints: 0 });
  });

  it("paste-over-selection counts the entire selection deletion + entire paste, even if text overlaps", () => {
    expect(
      measureBeforeInputCommit(
        { beforeText: "abc", selectionStart: 0, selectionEnd: 3, inputType: "insertFromPaste" },
        "abd"
      )
    ).toEqual({ insertedCodePoints: 3, deletedCodePoints: 3 });
  });

  it("the state machine consumes a beforeinput snapshot exactly once", () => {
    let state = createTextInputActivityState("選択文字");
    state = captureBeforeInput(state, {
      beforeText: "選択文字",
      selectionStart: 0,
      selectionEnd: 2,
      inputType: "insertReplacementText",
    });
    const first = applyTextInputChange(state, "変更文字");
    expect(first.delta).toEqual({ insertedCodePoints: 2, deletedCodePoints: 2 });
    expect(applyTextInputChange(first.state, "変更文字").delta).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
  });
});

describe("11-B notation, structural UI, and Writing Check semantics", () => {
  it("direct manual ruby source typing counts normally", () => {
    const ruby = "｜漢字《かんじ》";
    expect(measureEditorActivityOperation({ kind: "manual-text", before: "", after: ruby })).toEqual({
      insertedCodePoints: codePointLength(ruby),
      deletedCodePoints: 0,
    });
  });

  it("Ruby UI retains only user-entered inserted text, not removed text or generated markup", () => {
    expect(
      measureEditorActivityOperation({
        kind: "ruby-ui",
        userEdits: [
          { deletedText: "", insertedText: "漢字" },
          { deletedText: "よみ", insertedText: "かんじ" },
        ],
      })
    ).toEqual({ insertedCodePoints: 5, deletedCodePoints: 0 });
    expect(measureEditorActivityOperation({ kind: "excluded", source: "ruby-structural-transform" })).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
  });

  it("dedicated page-break UI is zero, while literally typing the token counts its code points", () => {
    expect(measureEditorActivityOperation({ kind: "excluded", source: "page-break-ui" })).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
    expect(measureEditorActivityOperation({ kind: "manual-text", before: "", after: "【改ページ】" })).toEqual({ insertedCodePoints: 6, deletedCodePoints: 0 });
  });

  it("image insertion/removal/token changes are zero; manually edited caption text counts", () => {
    expect(measureEditorActivityOperation({ kind: "excluded", source: "image-ui" })).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
    expect(measureEditorActivityOperation({ kind: "manual-text", before: "図", after: "図の説明" })).toEqual({ insertedCodePoints: 3, deletedCodePoints: 0 });
  });

  it("14. programmatic Writing Check replacements add zero", () => {
    expect(
      measureEditorActivityOperation({
        kind: "explicit-replacements",
        replacements: [
          { deletedText: "ｶﾞ", insertedText: "ガ" },
          { deletedText: "  ", insertedText: "" },
        ],
      })
    ).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
  });

  it("ignore/settings/internal analysis are zero", () => {
    for (const source of [
      "writing-check-analysis",
      "writing-check-ignore",
      "writing-check-settings",
    ] as const) {
      expect(measureEditorActivityOperation({ kind: "excluded", source })).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
    }
  });
});

describe("11-B exclusions and work-session sharing", () => {
  it("load/import/normalization/migration/autosave/recomposition/publication all add zero", () => {
    for (const source of [
      "load-existing-manuscript",
      "import",
      "normalization",
      "internal-migration",
      "autosave",
      "preview-recomposition",
      "typesetting-recomposition",
      "publication-generation",
    ] as const) {
      expect(measureEditorActivityOperation({ kind: "excluded", source })).toEqual({ insertedCodePoints: 0, deletedCodePoints: 0 });
    }
  });

  it("16. formats the exact canonical share text with grouped activity", () => {
    expect(formatWorkSessionShareText(4823)).toBe(
      "今日は4,823文字がんばりました！\n#TateSpun\nhttps://spuntales.net/tatespun/"
    );
  });
});
