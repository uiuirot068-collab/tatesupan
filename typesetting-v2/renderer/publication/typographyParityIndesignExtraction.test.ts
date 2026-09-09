// TYPOGRAPHY PARITY Round 3 -- Step 1: deterministic, repo-local PDF
// structural inspection of the real InDesign reference file. No new
// dependency -- reuses the SAME technique
// `structuralColophonFreeTextFinalPdfParity.test.ts` already established
// in this directory (raw PDF byte/regex structural reads + Node's own
// built-in `zlib` for FlateDecode content-stream decompression). This is
// audit/extraction only -- writes nothing, changes nothing.

import { readFileSync } from "fs";
import { join } from "path";
import zlib from "zlib";
import { describe, expect, it } from "vitest";

const REFERENCE_PDF_PATH = join(__dirname, "..", "..", "qa", "reference", "indesign", "molsui-indesign-reference.pdf");

function loadReferencePdfText(): { bytes: Buffer; latin1: string } {
  const bytes = readFileSync(REFERENCE_PDF_PATH);
  // PDF's own structural syntax (dict keys, operators, numbers) is always
  // ASCII regardless of content-stream encoding -- latin1 decode is
  // lossless byte-for-byte for regex purposes on the structural parts.
  return { bytes, latin1: bytes.toString("latin1") };
}

describe("Typography Parity Round 3 -- InDesign reference PDF structural extraction", () => {
  it("the authoritative reference file exists at the expected repo-local path", () => {
    expect(() => readFileSync(REFERENCE_PDF_PATH)).not.toThrow();
  });

  it("extracts Creator/Producer, MediaBox, and embedded BaseFont names", () => {
    const { latin1 } = loadReferencePdfText();

    const creatorMatch = latin1.match(/\/Creator\s*\(([^)]*)\)/);
    const producerMatch = latin1.match(/\/Producer\s*\(([^)]*)\)/);
    const mediaBoxMatches = Array.from(latin1.matchAll(/\/MediaBox\s*\[\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*\]/g)).map((m) => ({
      x0: Number(m[1]),
      y0: Number(m[2]),
      x1: Number(m[3]),
      y1: Number(m[4]),
      widthPt: Number(m[3]) - Number(m[1]),
      heightPt: Number(m[4]) - Number(m[2]),
    }));
    const baseFontMatches = Array.from(new Set(Array.from(latin1.matchAll(/\/BaseFont\s*\/([A-Za-z0-9+\-,.]+)/g)).map((m) => m[1])));
    const subtypeMatches = Array.from(new Set(Array.from(latin1.matchAll(/\/Subtype\s*\/(Type0|TrueType|Type1|CIDFontType0|CIDFontType2)\b/g)).map((m) => m[1])));

    // eslint-disable-next-line no-console
    console.log(
      "INDESIGN_REFERENCE_STRUCTURAL_FACTS",
      JSON.stringify(
        {
          creator: creatorMatch?.[1],
          producer: producerMatch?.[1],
          mediaBoxes: mediaBoxMatches,
          baseFonts: baseFontMatches,
          fontSubtypes: subtypeMatches,
        },
        null,
        2
      )
    );

    expect(mediaBoxMatches.length).toBeGreaterThan(0);
    expect(baseFontMatches.length).toBeGreaterThan(0);
  });

  it("locates and FlateDecode-decompresses every content stream, extracting raw text-positioning operators", () => {
    const { bytes, latin1 } = loadReferencePdfText();

    // Every `N 0 obj ... stream\r?\n <binary> \r?\nendstream` block whose
    // OWN dictionary declares FlateDecode -- position-based (not global
    // regex on the whole file, since stream bytes themselves may contain
    // byte sequences that look like PDF syntax and must never be
    // regex-matched as structure).
    const objectHeaderRe = /(\d+)\s+0\s+obj\b/g;
    const streams: { objNum: number; dictText: string; decoded?: string; decodeError?: string }[] = [];

    let headerMatch: RegExpExecArray | null;
    while ((headerMatch = objectHeaderRe.exec(latin1)) !== null) {
      const objNum = Number(headerMatch[1]);
      const searchStart = headerMatch.index;
      const endObjIdx = latin1.indexOf("endobj", searchStart);
      if (endObjIdx === -1) continue;
      const objSlice = latin1.slice(searchStart, endObjIdx);
      const streamKeywordIdx = objSlice.indexOf("stream");
      if (streamKeywordIdx === -1) continue;
      const dictText = objSlice.slice(0, streamKeywordIdx);
      if (!/\/Filter\s*\/FlateDecode/.test(dictText)) continue;

      // Real byte offsets into the ORIGINAL buffer (latin1 string indices
      // map 1:1 to byte offsets since latin1 decode is single-byte).
      const absStreamKeywordIdx = searchStart + streamKeywordIdx;
      // Per PDF spec: "stream" keyword is followed by CRLF or LF (never a
      // bare CR) before the actual binary data begins.
      let dataStart = absStreamKeywordIdx + "stream".length;
      if (bytes[dataStart] === 0x0d && bytes[dataStart + 1] === 0x0a) dataStart += 2;
      else if (bytes[dataStart] === 0x0a) dataStart += 1;
      const absEndStreamIdx = latin1.indexOf("endstream", absStreamKeywordIdx);
      if (absEndStreamIdx === -1) continue;
      // Trailing EOL before "endstream" is part of the spec's own padding,
      // not stream data -- trim defensively.
      let dataEnd = absEndStreamIdx;
      while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0a || bytes[dataEnd - 1] === 0x0d)) dataEnd -= 1;

      const raw = bytes.subarray(dataStart, dataEnd);
      try {
        const decoded = zlib.inflateSync(raw).toString("latin1");
        streams.push({ objNum, dictText, decoded });
      } catch (err) {
        streams.push({ objNum, dictText, decodeError: err instanceof Error ? err.message : String(err) });
      }
    }

    const decodedStreams = streams.filter((s) => s.decoded !== undefined);
    // eslint-disable-next-line no-console
    console.log(
      "INDESIGN_REFERENCE_STREAM_SUMMARY",
      JSON.stringify(
        {
          totalFlateStreamsFound: streams.length,
          successfullyDecoded: decodedStreams.length,
          decodeErrors: streams.filter((s) => s.decodeError).map((s) => ({ objNum: s.objNum, error: s.decodeError })),
        },
        null,
        2
      )
    );

    // Print each decoded stream's own text-operator lines (Tf/Tm/Td/TJ/Tj)
    // for manual/next-step geometry extraction -- the raw evidence.
    for (const s of decodedStreams) {
      const opLines = s.decoded!.match(/[^\r\n]*\b(Tf|Tm|Td|TD|Tj|TJ|BT|ET)\b[^\r\n]*/g) ?? [];
      if (opLines.length === 0) continue;
      // eslint-disable-next-line no-console
      console.log(`INDESIGN_REFERENCE_STREAM_OBJ_${s.objNum}_OPS`, JSON.stringify(opLines.slice(0, 400)));
    }

    expect(streams.length).toBeGreaterThan(0);
  });
});
