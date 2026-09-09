// TYPOGRAPHY PARITY Round 9 -- localizes the two real non-1em advance
// events found by Round 8 (both immediately after "、", magnitude
// 250/1000 em) and determines what they physically represent.
//
// Self-contained (test files are not importable as modules under this
// project's vitest config, so the corrected extractor is duplicated here
// rather than imported -- same pattern already established across
// Rounds 7/7A/8's own independent extraction files).
//
// Round 8's own extractor had a real matrix-concatenation bug (fixed
// here): it pre-scaled each glyph's unscaled 1-unit advance by the font
// size BEFORE concatenating through Tm (whose own scale already applies
// that same font size), producing 9x-too-large steps for every glyph
// beyond the first in a multi-glyph Tj/TJ run. This made Round 8's own
// reported Y positions run off the physical page (down to -1651pt on an
// A5 page only 595pt tall), which Round 8 mis-read as evidence of a
// multi-column merge. This round confirms via the PDF's own real page
// tree (below) that the document has exactly ONE page and ONE content
// stream, so no merge was ever possible -- the implausible values were
// purely the bug. With the bug fixed, the same "54 characters in one
// same-X run" is a real, single, physically plausible column.
//
// This round also corrects a SIGN interpretation error from Round 8: per
// PDF 32000-1 SS9.4.3, a TJ array's numeric adjustment has OPPOSITE effect
// for vertical vs. horizontal writing -- positive EXPANDS (moves the next
// glyph further down) in vertical mode, not tightens as in horizontal
// mode. Round 8's evidence doc called -250 an "extra gap"; it is in fact
// a COMPRESSION (glyph pulled 0.25em closer, net 0.75em), the opposite
// conclusion. Verified computationally below, not asserted from memory.

import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import zlib from "zlib";
import { describe, expect, it } from "vitest";

const REFERENCE_PDF_PATH = join(__dirname, "..", "..", "qa", "reference", "indesign", "molsui-indesign-reference.pdf");
const EXPECTED_SHA256 = "0029bf7008093105069717c1f72e9e3bf333054a2089003f81487dea4c1c7a12";
const EM_PT = 9;

function loadPdf(): { bytes: Buffer; latin1: string } {
  const bytes = readFileSync(REFERENCE_PDF_PATH);
  return { bytes, latin1: bytes.toString("latin1") };
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

type Token = { kind: "num" | "hex" | "str" | "name" | "arrayOpen" | "arrayClose" | "dict" | "op"; text: string };

function tokenize(s: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const isDelim = (ch: string) => /[\s<>\[\]()/%]/.test(ch);
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "%") { while (i < s.length && s[i] !== "\n") i++; continue; }
    if (c === "<" && s[i + 1] === "<") {
      let depth = 1; let j = i + 2;
      while (j < s.length && depth > 0) {
        if (s[j] === "<" && s[j + 1] === "<") { depth++; j += 2; }
        else if (s[j] === ">" && s[j + 1] === ">") { depth--; j += 2; }
        else j++;
      }
      tokens.push({ kind: "dict", text: s.slice(i, j) });
      i = j;
      continue;
    }
    if (c === "<") {
      let j = i + 1;
      while (j < s.length && s[j] !== ">") j++;
      tokens.push({ kind: "hex", text: s.slice(i + 1, j) });
      i = j + 1;
      continue;
    }
    if (c === "(") {
      let depth = 1; let j = i + 1;
      while (j < s.length && depth > 0) {
        if (s[j] === "\\") { j += 2; continue; }
        if (s[j] === "(") depth++;
        else if (s[j] === ")") depth--;
        j++;
      }
      tokens.push({ kind: "str", text: s.slice(i + 1, j - 1) });
      i = j;
      continue;
    }
    if (c === "[") { tokens.push({ kind: "arrayOpen", text: "[" }); i++; continue; }
    if (c === "]") { tokens.push({ kind: "arrayClose", text: "]" }); i++; continue; }
    if (c === "/") {
      let j = i + 1;
      while (j < s.length && !isDelim(s[j])) j++;
      tokens.push({ kind: "name", text: s.slice(i, j) });
      i = j;
      continue;
    }
    let j = i;
    while (j < s.length && !isDelim(s[j])) j++;
    const text = s.slice(i, j);
    i = j;
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(text)) tokens.push({ kind: "num", text });
    else tokens.push({ kind: "op", text });
  }
  return tokens;
}

interface Mat { a: number; b: number; c: number; d: number; e: number; f: number }
const IDENTITY: Mat = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
function multiply(m1: Mat, m2: Mat): Mat {
  return {
    a: m1.a * m2.a + m1.b * m2.c,
    b: m1.a * m2.b + m1.b * m2.d,
    c: m1.c * m2.a + m1.d * m2.c,
    d: m1.c * m2.b + m1.d * m2.d,
    e: m1.e * m2.a + m1.f * m2.c + m2.e,
    f: m1.e * m2.b + m1.f * m2.d + m2.f,
  };
}

interface Glyph { char: string; cid: string; xPt: number; yPt: number; opIndex: number; fontSizeFromTm: number }

const SAFE_NON_TEXT_OPS = new Set([
  "q", "Q", "cm", "gs", "re", "W", "W*", "n", "f", "f*", "F", "S", "s", "B", "B*", "b", "b*",
  "m", "l", "c", "v", "y", "h", "rg", "RG", "g", "G", "k", "K", "cs", "CS", "sc", "scn", "SC", "SCN",
  "Do", "BDC", "BMC", "EMC", "MP", "DP", "w", "J", "j", "M", "d", "ri", "i", "BI", "ID", "EI", "sh",
]);

interface ExtractResult { glyphs: Glyph[]; unsupportedOps: string[]; fullText: string }

function extractTextState(decoded: string, cidToUnicode: Map<string, string>): ExtractResult {
  const tokens = tokenize(decoded);
  let Tm: Mat = IDENTITY;
  let Tlm: Mat = IDENTITY;
  let TL = 0;
  let fontSizeFromTm = EM_PT;
  const glyphs: Glyph[] = [];
  const unsupportedOps: string[] = [];
  let opIndex = 0;
  let fullText = "";
  const operands: Token[] = [];
  const nums = (): number[] => operands.filter((t) => t.kind === "num").map((t) => Number(t.text));

  function showHexString(hex: string) {
    for (let i = 0; i < hex.length; i += 4) {
      const cid = hex.slice(i, i + 4).toUpperCase();
      const ch = cidToUnicode.get(cid) ?? `[CID:${cid}]`;
      glyphs.push({ char: ch, cid, xPt: Tm.e, yPt: Tm.f, opIndex, fontSizeFromTm });
      fullText += ch;
      // FIXED (was the Round 8 bug): unscaled 1-unit advance; Tm's own
      // scale (a=9,d=9 in this document) applies the font size once,
      // via concatenation below.
      Tm = multiply({ a: 1, b: 0, c: 0, d: 1, e: 0, f: -1 }, Tm);
    }
  }

  for (const tok of tokens) {
    if (tok.kind === "num" || tok.kind === "hex" || tok.kind === "str" || tok.kind === "name" || tok.kind === "dict") { operands.push(tok); continue; }
    if (tok.kind === "arrayOpen") { operands.push(tok); continue; }
    if (tok.kind === "arrayClose") { operands.push(tok); continue; }
    const opName = tok.text;
    opIndex += 1;
    if (opName === "BT") { Tm = IDENTITY; Tlm = IDENTITY; operands.length = 0; continue; }
    if (opName === "ET") { operands.length = 0; continue; }
    if (opName === "Tf") { operands.length = 0; continue; }
    if (opName === "Tm") {
      const n = nums();
      if (n.length !== 6) { unsupportedOps.push(`Tm with ${n.length} operands`); operands.length = 0; continue; }
      const [a, b, c, d, e, f] = n;
      Tm = { a, b, c, d, e, f };
      Tlm = { a, b, c, d, e, f };
      fontSizeFromTm = Math.abs(d) || Math.abs(a) || EM_PT;
      operands.length = 0;
      continue;
    }
    if (opName === "Td" || opName === "TD") {
      const n = nums();
      if (n.length !== 2) { unsupportedOps.push(`${opName} with ${n.length} operands`); operands.length = 0; continue; }
      const [tx, ty] = n;
      if (opName === "TD") TL = -ty;
      Tlm = multiply({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty }, Tlm);
      Tm = Tlm;
      operands.length = 0;
      continue;
    }
    if (opName === "T*") {
      Tlm = multiply({ a: 1, b: 0, c: 0, d: 1, e: 0, f: -TL }, Tlm);
      Tm = Tlm;
      operands.length = 0;
      continue;
    }
    if (opName === "Tj") {
      const hexTok = [...operands].reverse().find((t) => t.kind === "hex" || t.kind === "str");
      if (!hexTok || hexTok.kind !== "hex") { unsupportedOps.push("Tj with non-hex string"); operands.length = 0; continue; }
      showHexString(hexTok.text);
      operands.length = 0;
      continue;
    }
    if (opName === "TJ") {
      const openIdx = operands.findIndex((t) => t.kind === "arrayOpen");
      if (openIdx === -1) { unsupportedOps.push("TJ with no array"); operands.length = 0; continue; }
      for (let k = openIdx + 1; k < operands.length; k++) {
        const t = operands[k];
        if (t.kind === "hex") showHexString(t.text);
        else if (t.kind === "num") {
          const adj = Number(t.text);
          if (adj !== 0) {
            // PDF 32000-1 SS9.4.3: for vertical writing, positive adj
            // expands (moves next glyph further down); negative compresses.
            Tm = multiply({ a: 1, b: 0, c: 0, d: 1, e: 0, f: -(adj / 1000) }, Tm);
          }
        } else if (t.kind === "arrayClose") break;
        else if (t.kind === "str") unsupportedOps.push("TJ with literal string operand");
      }
      operands.length = 0;
      continue;
    }
    if (opName === "Tc" || opName === "Tz" || opName === "TL" || opName === "Tr" || opName === "Ts") {
      const n = nums();
      const value = n[0] ?? 0;
      const isDefault = (opName === "Tz" && value === 100) || (opName !== "Tz" && value === 0);
      if (opName === "TL") { TL = value; operands.length = 0; continue; }
      if (!isDefault) unsupportedOps.push(`${opName} set to non-default value ${value}`);
      operands.length = 0;
      continue;
    }
    if (opName === "'" || opName === '"') { unsupportedOps.push(`${opName} quote operator`); operands.length = 0; continue; }
    if (SAFE_NON_TEXT_OPS.has(opName)) { operands.length = 0; continue; }
    unsupportedOps.push(`unrecognized operator: ${opName}`);
    operands.length = 0;
  }
  return { glyphs, unsupportedOps, fullText };
}

describe("Typography Parity Round 9 -- comma quarter-em localization", () => {
  it("STEP 1: reference SHA lock re-check (STOP condition)", () => {
    const bytes = readFileSync(REFERENCE_PDF_PATH);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    expect(sha256).toBe(EXPECTED_SHA256);
  });

  it("STEP 2: page-tree confirms exactly ONE page and ONE /Contents stream -- rules out the multi-page-merge hypothesis outright", () => {
    const bytes = readFileSync(REFERENCE_PDF_PATH);
    const latin1 = bytes.toString("latin1");
    const objectHeaderRe = /(\d+)\s+0\s+obj\b/g;
    let m: RegExpExecArray | null;
    let pageCount = 0;
    let contentsRef = "";
    let mediaBox = "";
    while ((m = objectHeaderRe.exec(latin1)) !== null) {
      const searchStart = m.index;
      const endObjIdx = latin1.indexOf("endobj", searchStart);
      if (endObjIdx === -1) continue;
      const objSlice = latin1.slice(searchStart, endObjIdx);
      if (/\/Type\s*\/Page\b/.test(objSlice) && !/\/Type\s*\/Pages\b/.test(objSlice)) {
        pageCount += 1;
        const contentsMatch = objSlice.match(/\/Contents\s+(\d+\s+0\s+R)/);
        if (contentsMatch) contentsRef = contentsMatch[1];
        const mediaBoxMatch = objSlice.match(/\/MediaBox\s*\[([^\]]+)\]/);
        if (mediaBoxMatch) mediaBox = mediaBoxMatch[1];
      }
    }
    // eslint-disable-next-line no-console
    console.log("ROUND9_PAGE_COUNT", pageCount, "CONTENTS_REF", contentsRef, "MEDIABOX_PT", mediaBox);
    expect(pageCount).toBe(1);
    expect(contentsRef).toBe("35 0 R");
    expect(mediaBox.trim()).toBe("0.0 0.0 419.528 595.276");
  });

  it("STEP 3-4: decodes the two exceptional TJ events exactly and verifies the corrected physical result computationally", () => {
    const { bytes, latin1 } = loadPdf();
    const streams = decompressAllFlateStreams(bytes, latin1);
    const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
    const cidToUnicode = parseToUnicodeCMap(cmapStream!.decoded);
    const bodyStream = streams.find((s) => /\bBT\b/.test(s.decoded) && /\bTj\b|\bTJ\b/.test(s.decoded));
    const result = extractTextState(bodyStream!.decoded, cidToUnicode);
    expect(result.unsupportedOps).toEqual([]);
    const glyphs = result.glyphs;

    let found = 0;
    for (let i = 0; i < glyphs.length; i++) {
      if (glyphs[i].char !== "、") continue;
      const next = glyphs[i + 1];
      if (!next || (next.char !== "と" && next.char !== "ど")) continue;
      const prev = glyphs[i - 1];
      const actualDeltaPt = glyphs[i].yPt - next.yPt;
      const actualDeltaEm = actualDeltaPt / EM_PT;
      const context = glyphs.slice(Math.max(0, i - 10), Math.min(glyphs.length, i + 11)).map((g) => g.char).join("");
      // eslint-disable-next-line no-console
      console.log("ROUND9_EXCEPTION_DECODED", JSON.stringify({
        prevChar: prev?.char, char: glyphs[i].char, nextChar: next.char,
        beforeYPt: glyphs[i].yPt, afterYPt: next.yPt, actualDeltaPt, actualDeltaEm, context,
      }));
      expect(actualDeltaEm).toBeCloseTo(0.75, 5);
      found += 1;
    }
    expect(found).toBe(2);
  });

  it("STEP 5-6: builds the full 22-comma table and confirms both exceptions sit mid-run, not at a run edge", () => {
    const { bytes, latin1 } = loadPdf();
    const streams = decompressAllFlateStreams(bytes, latin1);
    const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
    const cidToUnicode = parseToUnicodeCMap(cmapStream!.decoded);
    const bodyStream = streams.find((s) => /\bBT\b/.test(s.decoded) && /\bTj\b|\bTJ\b/.test(s.decoded));
    const result = extractTextState(bodyStream!.decoded, cidToUnicode);
    const glyphs = result.glyphs;

    const table: { index: number; prevChar: string; char: string; nextChar: string; xPt: number; yPt: number; deltaToNextEm: number | null; runLength: number; positionInRun: number; positionFromRunEnd: number }[] = [];
    let commaOrdinal = 0;
    for (let i = 0; i < glyphs.length; i++) {
      if (glyphs[i].char !== "、") continue;
      commaOrdinal += 1;
      const next = glyphs[i + 1];
      const prev = glyphs[i - 1];
      let runStart = i;
      while (runStart > 0 && glyphs[runStart - 1].xPt === glyphs[i].xPt) runStart--;
      let runEnd = i;
      while (runEnd < glyphs.length - 1 && glyphs[runEnd + 1].xPt === glyphs[i].xPt) runEnd++;
      table.push({
        index: commaOrdinal, prevChar: prev?.char ?? "", char: "、", nextChar: next?.char ?? "",
        xPt: glyphs[i].xPt, yPt: glyphs[i].yPt,
        deltaToNextEm: next ? (glyphs[i].yPt - next.yPt) / EM_PT : null,
        runLength: runEnd - runStart + 1, positionInRun: i - runStart, positionFromRunEnd: runEnd - i,
      });
    }
    // eslint-disable-next-line no-console
    console.log("ROUND9_ALL_COMMAS_TABLE", JSON.stringify(table));

    expect(table.length).toBe(22);
    // Two significance tiers: the negligible +0.01em noise (same as
    // Round 8's 49 non-punctuation-correlated occurrences, which happen
    // to touch 2 of these 22 commas purely by chance since they sit
    // within that same noisy TJ run) vs. the real -0.25em compression.
    const negligible = table.filter((r) => r.deltaToNextEm !== null && Math.abs(r.deltaToNextEm - 1) > 0.001 && Math.abs(r.deltaToNextEm - 1) < 0.05);
    const significant = table.filter((r) => r.deltaToNextEm !== null && Math.abs(r.deltaToNextEm - 1) >= 0.05);
    // eslint-disable-next-line no-console
    console.log("ROUND9_NEGLIGIBLE_NOISE_COMMAS", JSON.stringify(negligible));
    // eslint-disable-next-line no-console
    console.log("ROUND9_SIGNIFICANT_COMMAS", JSON.stringify(significant));
    expect(negligible.length).toBe(2);
    expect(significant.length).toBe(2);
    for (const r of significant) {
      expect(r.positionInRun).toBeGreaterThan(2);
      expect(r.positionFromRunEnd).toBeGreaterThan(2);
    }
  });
});
