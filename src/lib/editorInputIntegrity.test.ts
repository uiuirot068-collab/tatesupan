import { describe, expect, it } from "vitest";
import { resolveTextareaDeletion, type TextareaDeletionSnapshot } from "./editorInputIntegrity";

const FIXTURE = "今日は、ゴブリン族の宴に呼ばれて、珍しい酒を振舞ってもらった。";

function resolve(
  selectionStart: number,
  selectionEnd: number,
  inputType: string,
  afterText: string,
  beforeText = FIXTURE
) {
  const snapshot: TextareaDeletionSnapshot = {
    beforeText,
    selectionStart,
    selectionEnd,
    inputType,
  };
  return resolveTextareaDeletion(snapshot, afterText);
}

describe("textarea deletion integrity", () => {
  it("accepts one native Backspace at the manuscript end", () => {
    const after = FIXTURE.slice(0, -1);
    expect(resolve(FIXTURE.length, FIXTURE.length, "deleteContentBackward", after)).toEqual({
      text: after,
      selectionStart: FIXTURE.length - 1,
      selectionEnd: FIXTURE.length - 1,
      repaired: false,
    });
  });

  it("accepts Backspace and Delete at a collapsed caret in the middle", () => {
    const caret = 10;
    expect(resolve(caret, caret, "deleteContentBackward", FIXTURE.slice(0, caret - 1) + FIXTURE.slice(caret)).repaired).toBe(false);
    expect(resolve(caret, caret, "deleteContentForward", FIXTURE.slice(0, caret) + FIXTURE.slice(caret + 1)).repaired).toBe(false);
  });

  it("accepts exactly the selected one-character or multi-character range", () => {
    for (const [start, end] of [[4, 5], [4, 12]]) {
      const after = FIXTURE.slice(0, start) + FIXTURE.slice(end);
      expect(resolve(start, end, "deleteContentBackward", after)).toMatchObject({
        text: after,
        selectionStart: start,
        selectionEnd: start,
        repaired: false,
      });
    }
  });

  it("repairs the reported 28-character collapse to the single intended deletion", () => {
    const result = resolve(
      FIXTURE.length,
      FIXTURE.length,
      "deleteContentBackward",
      "今日は"
    );
    expect(result).toEqual({
      text: FIXTURE.slice(0, -1),
      selectionStart: FIXTURE.length - 1,
      selectionEnd: FIXTURE.length - 1,
      repaired: true,
    });
  });

  it("repairs a deletion outside the selected range to the selection only", () => {
    const result = resolve(4, 5, "deleteContentForward", "今日は");
    expect(result).toEqual({
      text: FIXTURE.slice(0, 4) + FIXTURE.slice(5),
      selectionStart: 4,
      selectionEnd: 4,
      repaired: true,
    });
  });

  it("allows one Unicode code point or one grapheme without splitting emoji", () => {
    const emoji = "A😀";
    expect(resolve(emoji.length, emoji.length, "deleteContentBackward", "A", emoji).repaired).toBe(false);

    const combining = "Ae\u0301";
    expect(resolve(combining.length, combining.length, "deleteContentBackward", "Ae", combining).repaired).toBe(false);
    expect(resolve(combining.length, combining.length, "deleteContentBackward", "A", combining).repaired).toBe(false);

    const family = "A👨‍👩‍👧‍👦";
    expect(resolve(family.length, family.length, "deleteContentBackward", "A", family).repaired).toBe(false);
  });

  it("repairs a browser result that replaces half of a surrogate pair", () => {
    const emoji = "A😀";
    expect(resolve(emoji.length, emoji.length, "deleteContentBackward", "A?", emoji)).toEqual({
      text: "A",
      selectionStart: 1,
      selectionEnd: 1,
      repaired: true,
    });
  });

  it("does not reinterpret composition, history, word deletion, or paste input types", () => {
    for (const inputType of ["insertCompositionText", "historyUndo", "historyRedo", "deleteWordBackward", "insertFromPaste"]) {
      const after = "arbitrary browser-owned result";
      expect(resolve(3, 3, inputType, after)).toEqual({
        text: after,
        selectionStart: 3,
        selectionEnd: 3,
        repaired: false,
      });
    }
  });

  it("keeps each key-repeat transaction limited to its own next character", () => {
    let text = FIXTURE;
    for (let event = 0; event < 8; event += 1) {
      const after = text.slice(0, -1);
      const result = resolveTextareaDeletion(
        {
          beforeText: text,
          selectionStart: text.length,
          selectionEnd: text.length,
          inputType: "deleteContentBackward",
        },
        after
      );
      expect(result.repaired).toBe(false);
      expect(result.text.length).toBe(text.length - 1);
      text = result.text;
    }
    expect(text).toBe(FIXTURE.slice(0, -8));
  });
});
