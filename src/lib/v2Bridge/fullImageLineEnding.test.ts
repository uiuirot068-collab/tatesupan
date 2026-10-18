// TSP-PRINT-002: the manuscript line ending right after a 全面 (FULL) image
// stays on the image's page. It used to be isolated onto the next page as
// an empty first line (text after the image started one line late), and
// made a blank page before 【改ページ】 and at the end of the book.
import { encode } from "fast-png";
import { describe, expect, it } from "vitest";
import { DEFAULT_PAGE_SETTINGS } from "../pageLayout";
import { formatImageMarker } from "../tategaki";
import { createFakeMeasurementProvider } from "../../../typesetting-v2/core/measurement/fakeProvider";
import { composeV2Layout } from "./composeV2Document";

const MEASUREMENT = createFakeMeasurementProvider();
const pngBytes = encode({ width: 2, height: 3, channels: 4, data: new Uint8Array(24).fill(200) });
const FULL = formatImageMarker({ type: "image", id: "9976b325-fd67-4832-b0e1-2d2250a47e68", widthMm: 60, heightMm: 90, position: "full" });

/** Each page as its lines; each line as its units (text characters, ⏎ line ending, IMG, BRK 改ページ), "+i" when indented. */
function pages(content: string): string[][] {
  const layout = composeV2Layout({
    title: "T",
    content,
    settings: DEFAULT_PAGE_SETTINGS,
    measurement: MEASUREMENT,
    imageResolver: () => ({ kind: "RESOLVED", url: "data:image/png;base64,qa", bytes: pngBytes, format: "PNG", pixelWidth: 2, pixelHeight: 3 }),
  });
  const unitAt = (flowOffset: number) => layout.units.find((unit) => unit.span.start <= flowOffset && flowOffset < unit.span.end)!;
  return layout.document.pages.map((page) =>
    page.columns.flatMap((column) =>
      column.lines.map((line) => {
        const text = line.placedUnits
          .map((placed) => {
            const unit = unitAt(placed.sourceSpan.start);
            if (unit.kind === "TEXT") return unit.text.slice(placed.sourceSpan.start - unit.span.start, placed.sourceSpan.end - unit.span.start);
            return unit.kind === "PARAGRAPH_BREAK" ? "⏎" : unit.kind === "IMAGE" ? "IMG" : unit.kind === "MANUAL_BREAK" ? "BRK" : unit.kind;
          })
          .join("");
        return line.indentTick ? `${text}+i` : text;
      })
    )
  );
}

describe("全面の挿絵のあとの改行", () => {
  it("text after the image starts on the next page's first line, as a new paragraph", () => {
    expect(pages(`本文\n${FULL}\n次の章`)).toEqual([["本文⏎+i"], ["IMG⏎"], ["次の章+i"]]);
  });

  it("no blank page at the end of the book", () => {
    expect(pages(`本文\n${FULL}\n`)).toEqual([["本文⏎+i"], ["IMG⏎"]]);
  });

  it("no blank page before 【改ページ】 (the page after it starts like any 改ページ page)", () => {
    expect(pages(`本文\n${FULL}\n【改ページ】\n次`)).toEqual(pages(`本文\n【改ページ】\n次`).flatMap((page, i) => (i === 0 ? [page, ["IMG⏎"]] : [page])));
  });

  it("an empty line typed after the image is kept", () => {
    expect(pages(`本文\n${FULL}\n\n次の章`)).toEqual([["本文⏎+i"], ["IMG⏎"], ["⏎", "次の章+i"]]);
  });

  it("an image directly followed by text (no line ending) is unchanged: isolated on both sides", () => {
    expect(pages(`本文\n${FULL}次の章`)).toEqual([["本文⏎+i"], ["IMG"], ["次の章"]]);
  });

  it("two full images in a row take one page each", () => {
    expect(pages(`${FULL}\n${FULL}\n次`)).toEqual([["IMG⏎"], ["IMG⏎"], ["次+i"]]);
  });
});
