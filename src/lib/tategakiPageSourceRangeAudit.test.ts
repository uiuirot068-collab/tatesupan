/**
 * TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 Part A: "Preview →
 * Editor: verify the source offset". `computePageSourceRanges` is the ONLY
 * source-range data PreviewPane.tsx's "編集位置へ移動" has to work with (the
 * V2 renderer worker carries no source-range plumbing of its own -- adding
 * any is out of this task's scope per its own non-goals), so its accuracy
 * against what `paginateTokens` actually renders is exactly the mapping to
 * audit. This audits it directly: for a representative range of content
 * shapes, each page's own `[start, end)` slice of the raw source, when
 * re-tokenized, reconstructs the SAME text `paginateTokens` put on that
 * page. It passes cleanly across all of these (see the module's own doc on
 * `computePageSourceRanges` -- it deliberately mirrors `paginateTokensByLines`
 * line-for-line), which is why the actual §B fix for the reported "doesn't
 * land at the true start" bug is a VISUAL scroll-positioning gap in
 * PagedEditor.tsx, not a source-offset error here.
 */
import { describe, it, expect } from "vitest";
import { computePageSourceRanges, paginateTokens, tokenizeTategaki, detokenizeTategaki } from "./tategaki";

function auditContent(label: string, content: string) {
  it(`AUDIT[${label}]: pageSourceRanges[i].start is the true first source-bearing offset of rendered page i`, () => {
    const metrics = { charsPerLine: 20, linesPerPage: 15 };
    const tokens = tokenizeTategaki(content);
    const pages = paginateTokens(tokens, { ...metrics, columnCount: 1, linesPerColumn: metrics.linesPerPage });
    const ranges = computePageSourceRanges(content, metrics);

    expect(ranges.length).toBe(pages.length);

    const mismatches: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      const rendered = detokenizeTategaki(pages[i].tokens);
      if (rendered.length === 0) continue; // nothing to compare (e.g. trailing empty page)
      const range = ranges[i];
      const sourceSlice = content.slice(range.start, range.end);
      // Re-tokenize just this slice and detokenize it back, normalizing away
      // marker-syntax differences (pageBreak markers, etc.) that would
      // otherwise be false mismatches.
      const roundTripped = detokenizeTategaki(tokenizeTategaki(sourceSlice));
      if (roundTripped !== rendered) {
        mismatches.push(
          `page ${i}: rendered=${JSON.stringify(rendered.slice(0, 40))} sourceSlice(${range.start},${range.end})=${JSON.stringify(sourceSlice.slice(0, 40))} roundTripped=${JSON.stringify(roundTripped.slice(0, 40))}`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });
}

describe("computePageSourceRanges audit (TSP-EDITOR-PAGE-BOUNDARY-AND-PREVIEW-LANDING-012 Part A)", () => {
  auditContent("plain paragraphs", Array.from({ length: 40 }, (_, i) => `これはテスト段落その${i}です。`).join("\n"));
  auditContent("long single paragraph no breaks", "あ".repeat(3000));
  auditContent("ruby annotations", Array.from({ length: 30 }, (_, i) => `｜漢字${i}《かんじ》のテストです。`).join("\n"));
  auditContent("mixed with explicit page breaks", Array.from({ length: 20 }, (_, i) => `段落${i}のテキストです。`).join("\n【改ページ】\n"));
  auditContent("dialogue-style short lines", Array.from({ length: 50 }, (_, i) => `「これは会話文${i}です」`).join("\n"));
});
