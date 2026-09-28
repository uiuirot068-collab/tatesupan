import { describe, expect, it } from "vitest";
import { graphemeRangeAt, resolveTextareaDeletion } from "./editorInputIntegrity";

// Main-thread Preview performance: graphemeRangeAt segments only the line
// around the caret. These tests pin it to the whole-text segmentation it
// replaced, for every caret, both directions, on text built from the
// clusters where UAX #29 depends on context (CR LF, combining marks, ZWJ
// emoji, regional-indicator pairs, variation selectors, surrogate pairs).

/** The pre-optimization implementation: segment the WHOLE text. */
function wholeTextGraphemeRangeAt(text: string, caret: number, direction: "backward" | "forward") {
  const probe = direction === "backward" ? caret - 1 : caret;
  if (probe < 0 || probe >= text.length) return null;
  for (const part of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)) {
    const start = part.index;
    const end = start + part.segment.length;
    if (start <= probe && probe < end) return { start, end };
  }
  return null;
}

const PIECES = [
  "あ", "漢", "「", "」", "。", "a", " ", "\n", "\r\n", "\r", "\t",
  "が", "é̂", "👨‍👩‍👧", "👍🏽", "🇯🇵", "🇯", "🇺🇸🇯🇵", "❤️", "𠮷", "‍", "́",
  "\u{e0100}", "葛\u{e0100}", "#️⃣",
];

function randomText(seed: number, length: number): string {
  let state = seed;
  const next = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state;
  };
  let text = "";
  for (let i = 0; i < length; i++) text += PIECES[next() % PIECES.length];
  return text;
}

describe("graphemeRangeAt (line-bounded segmentation)", () => {
  it("matches whole-text segmentation for every caret and direction", () => {
    const texts = [
      "",
      "\n",
      "\r\n",
      "a\r\nb",
      "🇯🇵🇺🇸🇯",
      "\n🇯🇵🇺\n🇸🇯🇵",
      "改行の直前\n直後",
      ...Array.from({ length: 120 }, (_, seed) => randomText(seed + 1, 40)),
    ];
    let compared = 0;
    for (const text of texts) {
      for (let caret = 0; caret <= text.length; caret++) {
        for (const direction of ["backward", "forward"] as const) {
          expect(graphemeRangeAt(text, caret, direction), JSON.stringify({ text, caret, direction })).toEqual(
            wholeTextGraphemeRangeAt(text, caret, direction)
          );
          compared++;
        }
      }
    }
    expect(compared).toBeGreaterThan(9000);
  });

  it("resolves a Backspace at the end of a 300k-character manuscript identically, without scanning it", () => {
    const line = "　春の宵、窓辺に置いた硝子の瓶が淡い光を返していた。👨‍👩‍👧";
    const text = Array.from({ length: 300_000 / line.length }, () => line).join("\n");
    const cluster = wholeTextGraphemeRangeAt(text, text.length, "backward")!;
    expect(graphemeRangeAt(text, text.length, "backward")).toEqual(cluster);
    const after = text.slice(0, cluster.start);
    expect(resolveTextareaDeletion({ beforeText: text, selectionStart: text.length, selectionEnd: text.length, inputType: "deleteContentBackward" }, after)).toEqual({
      text: after,
      selectionStart: cluster.start,
      selectionEnd: cluster.start,
      repaired: false,
    });
    // Line-bounded: repeated calls stay far below a whole-text walk.
    const started = performance.now();
    for (let i = 0; i < 200; i++) graphemeRangeAt(text, text.length - (i % 7), "backward");
    expect(performance.now() - started).toBeLessThan(200);
  });
});
