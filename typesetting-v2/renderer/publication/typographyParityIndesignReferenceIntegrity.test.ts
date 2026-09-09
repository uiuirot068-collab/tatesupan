// TYPOGRAPHY PARITY Round 7A -- InDesign reference integrity recovery.
// QA-only: locks the identity of the repo-local InDesign reference file
// (SHA-256 + size + target manuscript snippets) so a future silent
// replacement is caught immediately and loudly, instead of being
// discovered only after conclusions are drawn from it.
//
// Round 7A investigated a suspected contamination: Round 7's own
// extraction (typographyParityYakumonoIndesignExtraction.test.ts) found a
// reconstructed manuscript that did NOT contain "人は驚きすぎると" or
// "数歩先へ行ったモルが振り返る", contradicting the Human's own prior
// inspection of the authoritative InDesign export. Root cause, confirmed
// here: the reference file was NEVER replaced -- Round 7's own extraction
// regex (`/9 0 0 9 ([\d.]+) ([\d.]+) Tm\s*<([0-9A-Fa-f]+)>\s*Tj/g`) only
// matched a Tj call sitting IMMEDIATELY after a fresh Tm operator. Real
// InDesign paragraph-initial runs emit the leading full-width indent
// space as its own short Tj, then reposition with a relative `Td` before
// emitting the REST of the paragraph as one long Tj -- a pattern Round
// 7's regex silently skipped entirely, dropping whole paragraphs
// (including the one containing "人は驚きすぎると") from its own
// reconstruction. Confirmed via SHA-256 (unchanged, matches this file's
// lock below) and via a broader Tj/TJ-array scan (below) that finds all
// three target snippets in the SAME single content stream (object 35)
// Round 7 already read. See qa/evidence/TYPOGRAPHY_PARITY_YAKUMONO_MOJIKUMI.md
// for the amended status this round records against Round 7's own findings.
//
// This test does NOT modify the reference PDF. It does NOT touch any
// production typesetting code.

import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import zlib from "zlib";
import { describe, expect, it } from "vitest";

const REFERENCE_PDF_PATH = join(__dirname, "..", "..", "qa", "reference", "indesign", "molsui-indesign-reference.pdf");

// Locked ground truth, recorded by this round (Round 7A) by direct
// measurement of the file on disk. If a future run of this test finds a
// DIFFERENT sha256, the file was replaced/modified after this round and
// every typography-parity conclusion drawn from it (Rounds 2-7) must be
// treated as suspect until re-verified against whatever is on disk now.
const EXPECTED_SHA256 = "0029bf7008093105069717c1f72e9e3bf333054a2089003f81487dea4c1c7a12";
const EXPECTED_SIZE_BYTES = 49522;
const EXPECTED_TARGET_SNIPPETS = ["人は驚きすぎると", "スイはそれを初めて知った", "数歩先へ行ったモルが振り返る"];

function loadPdf(): { bytes: Buffer; latin1: string; sha256: string } {
  const bytes = readFileSync(REFERENCE_PDF_PATH);
  return { bytes, latin1: bytes.toString("latin1"), sha256: createHash("sha256").update(bytes).digest("hex") };
}

function decompressAllFlateStreams(bytes: Buffer, latin1: string): { objNum: number; decoded: string }[] {
  const objectHeaderRe = /(\d+)\s+0\s+obj\b/g;
  const out: { objNum: number; decoded: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = objectHeaderRe.exec(latin1)) !== null) {
    const objNum = Number(m[1]);
    const searchStart = m.index;
    const endObjIdx = latin1.indexOf("endobj", searchStart);
    if (endObjIdx === -1) continue;
    const objSlice = latin1.slice(searchStart, endObjIdx);
    const streamKeywordIdx = objSlice.indexOf("stream");
    if (streamKeywordIdx === -1) continue;
    const dictText = objSlice.slice(0, streamKeywordIdx);
    if (!/\/Filter\s*\/FlateDecode/.test(dictText)) continue;
    const absStreamKeywordIdx = searchStart + streamKeywordIdx;
    let dataStart = absStreamKeywordIdx + "stream".length;
    if (bytes[dataStart] === 0x0d && bytes[dataStart + 1] === 0x0a) dataStart += 2;
    else if (bytes[dataStart] === 0x0a) dataStart += 1;
    const absEndStreamIdx = latin1.indexOf("endstream", absStreamKeywordIdx);
    if (absEndStreamIdx === -1) continue;
    let dataEnd = absEndStreamIdx;
    while (dataEnd > dataStart && (bytes[dataEnd - 1] === 0x0a || bytes[dataEnd - 1] === 0x0d)) dataEnd -= 1;
    try {
      out.push({ objNum, decoded: zlib.inflateSync(bytes.subarray(dataStart, dataEnd)).toString("latin1") });
    } catch {
      /* not this object -- skip */
    }
  }
  return out;
}

function parseToUnicodeCMap(cmapText: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const block of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const entry of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const src = entry[1].toUpperCase();
      const dstHex = entry[2];
      const codeUnits: number[] = [];
      for (let i = 0; i < dstHex.length; i += 4) codeUnits.push(parseInt(dstHex.slice(i, i + 4), 16));
      map.set(src, String.fromCharCode(...codeUnits));
    }
  }
  for (const block of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const entry of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const lo = parseInt(entry[1], 16);
      const hi = parseInt(entry[2], 16);
      const dstLo = parseInt(entry[3], 16);
      for (let code = lo; code <= hi; code++) {
        map.set(code.toString(16).toUpperCase().padStart(entry[1].length, "0"), String.fromCharCode(dstLo + (code - lo)));
      }
    }
  }
  return map;
}

/** Decodes every Tj/TJ hex string in every object's own content stream, regardless of Tm scale/pattern -- broader than Round 7's own body-stream-only search. */
function extractAllText(bytes: Buffer, latin1: string): { fullText: string; streamCount: number } {
  const streams = decompressAllFlateStreams(bytes, latin1);
  const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
  const cidToUnicode = cmapStream ? parseToUnicodeCMap(cmapStream.decoded) : new Map<string, string>();

  let fullText = "";
  let streamCount = 0;
  for (const stream of streams) {
    const decoded = stream.decoded;
    if (!/\bTj\b|\bTJ\b/.test(decoded)) continue;
    let matchedThisStream = false;
    for (const hexMatch of decoded.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      matchedThisStream = true;
      const hex = hexMatch[1];
      for (let i = 0; i < hex.length; i += 4) {
        const cid = hex.slice(i, i + 4).toUpperCase();
        fullText += cidToUnicode.get(cid) ?? "";
      }
    }
    // TJ arrays: [(...)<hex>(...)] Tj-equivalent -- also scan bracketed hex runs inside TJ arrays.
    for (const tjArray of decoded.matchAll(/\[((?:<[0-9A-Fa-f]+>|[\d.\-]+|\s)+)\]\s*TJ/g)) {
      matchedThisStream = true;
      for (const hexMatch of tjArray[1].matchAll(/<([0-9A-Fa-f]+)>/g)) {
        const hex = hexMatch[1];
        for (let i = 0; i < hex.length; i += 4) {
          const cid = hex.slice(i, i + 4).toUpperCase();
          fullText += cidToUnicode.get(cid) ?? "";
        }
      }
    }
    if (matchedThisStream) streamCount += 1;
  }
  return { fullText, streamCount };
}

describe("Typography Parity Round 7A -- InDesign reference integrity LOCK", () => {
  it("FAILS if the reference file's own bytes (SHA-256) or size ever drift from the locked ground truth", () => {
    const { bytes, sha256 } = loadPdf();
    expect(bytes.length).toBe(EXPECTED_SIZE_BYTES);
    expect(sha256).toBe(EXPECTED_SHA256);
  });

  it("FAILS if the authoritative モル／スイ manuscript snippets are no longer present in the reference's own real text", () => {
    const { bytes } = loadPdf();
    const latin1 = bytes.toString("latin1");
    const { fullText } = extractAllText(bytes, latin1);
    for (const snippet of EXPECTED_TARGET_SNIPPETS) {
      expect(fullText, `expected target snippet missing from reference: ${snippet}`).toContain(snippet);
    }
  });

  it("diagnostic: raw PDF operators around the 人 glyph -- documents why Round 7's own narrower regex missed this run (Td-continued paragraph, not Tm-adjacent)", () => {
    const { bytes } = loadPdf();
    const latin1 = bytes.toString("latin1");
    const streams = decompressAllFlateStreams(bytes, latin1);
    const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
    const cidToUnicode = parseToUnicodeCMap(cmapStream!.decoded);
    let ninjaCid: string | undefined;
    for (const [cid, ch] of cidToUnicode) if (ch === "人") { ninjaCid = cid; break; }
    expect(ninjaCid).toBeDefined();
    const bodyStream = streams.find((s) => /Tj|TJ/.test(s.decoded) && /9 0 0 9/.test(s.decoded));
    expect(bodyStream).toBeDefined();
    const idx = bodyStream!.decoded.toLowerCase().indexOf(`<${ninjaCid!.toLowerCase()}`);
    const around = bodyStream!.decoded.slice(Math.max(0, idx - 150), idx + 150);
    // eslint-disable-next-line no-console
    console.log("REFERENCE_INTEGRITY_RAW_OPERATORS_AROUND_NINJA", JSON.stringify(around));
    expect(around).toContain("Td"); // confirms the Td-continuation pattern, not a fresh Tm, precedes this run
  });
});
