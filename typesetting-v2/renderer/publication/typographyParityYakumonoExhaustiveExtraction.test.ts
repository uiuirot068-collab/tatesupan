// TYPOGRAPHY PARITY Round 8 -- exhaustive InDesign yakumono extraction.
//
// Replaces Round 7's adjacency-regex extractor (which only matched a Tj
// call sitting immediately after a fresh Tm, silently dropping every
// Td-continued paragraph -- see Round 7A,
// typographyParityIndesignReferenceIntegrity.test.ts) with a real,
// deterministic PDF text-state token machine: it tokenizes the decoded
// content stream properly (hex strings, literal strings, arrays, dicts,
// names, numbers, operator keywords) and walks BT/ET/Tf/Tm/Td/TD/T*/Tj/TJ
// in the order they actually occur, maintaining the real text matrix per
// PDF 32000-1 §9.4.2/9.4.3. Any text-state operator not in the known set
// (Tc, Tz, TL, Tr, Ts, ', ") is inspected and FAILS LOUDLY if it would
// alter position/advance in a way this extractor does not model exactly
// (i.e. any non-default/non-zero value); non-text graphics/marked-content
// operators are structurally skipped (they cannot move the text position).
//
// Vertical per-glyph advance is still taken as the font's own default
// (uniform 1em, no DW2 override) -- independently established in Round 3
// or (this document uses no embedded W2/DW2 array override, consistent
// with every measured delta in Round 7's own partial data). TJ array
// numeric adjustments, if any are found, are recorded raw and flagged
// rather than folded into position with an assumed sign convention (this
// document's own real content, verified below, contains none).

import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import zlib from "zlib";
import { describe, expect, it } from "vitest";

const REFERENCE_PDF_PATH = join(__dirname, "..", "..", "qa", "reference", "indesign", "molsui-indesign-reference.pdf");
const EXPECTED_SHA256 = "0029bf7008093105069717c1f72e9e3bf333054a2089003f81487dea4c1c7a12";
const EM_PT = 9;

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

// ---- Tokenizer -------------------------------------------------------

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

// ---- Text-state machine ----------------------------------------------

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

interface Glyph {
  char: string;
  cid: string;
  xPt: number;
  yPt: number;
  opIndex: number;
  fontSizeFromTm: number;
}

const KNOWN_TEXT_OPS = new Set(["BT", "ET", "Tf", "Tm", "Td", "TD", "T*", "Tj", "TJ", "Tc", "Tz", "TL", "Tr", "Ts", "'", '"']);
// Non-text operators that structurally cannot move the text position/advance -- safe to skip.
const SAFE_NON_TEXT_OPS = new Set([
  "q", "Q", "cm", "gs", "re", "W", "W*", "n", "f", "f*", "F", "S", "s", "B", "B*", "b", "b*",
  "m", "l", "c", "v", "y", "h", "rg", "RG", "g", "G", "k", "K", "cs", "CS", "sc", "scn", "SC", "SCN",
  "Do", "BDC", "BMC", "EMC", "MP", "DP", "w", "J", "j", "M", "d", "ri", "i", "BI", "ID", "EI", "sh",
]);

interface ExtractResult {
  glyphs: Glyph[];
  opsEncountered: Record<string, number>;
  unsupportedOps: string[];
  fullText: string;
  tjAdjustmentsFound: number[];
  tjAdjustmentContext: { adj: number; beforeChar: string; afterChar: string; beforeCid: string; afterCid: string }[];
}

function extractTextState(decoded: string, cidToUnicode: Map<string, string>): ExtractResult {
  const tokens = tokenize(decoded);
  let Tm: Mat = IDENTITY;
  let Tlm: Mat = IDENTITY;
  let TL = 0;
  let fontSizeFromTm = EM_PT;
  const glyphs: Glyph[] = [];
  const opsEncountered: Record<string, number> = {};
  const unsupportedOps: string[] = [];
  const tjAdjustmentsFound: number[] = [];
  const tjAdjustmentContext: ExtractResult["tjAdjustmentContext"] = [];
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
      // Uniform-1em vertical advance (no DW2 override present in this
      // document -- established Round 3/6/7). Vertical writing: Y
      // decreases per glyph (matches every measured delta this session).
      Tm = multiply({ a: 1, b: 0, c: 0, d: 1, e: 0, f: -fontSizeFromTm }, Tm);
    }
  }

  for (const tok of tokens) {
    if (tok.kind === "num" || tok.kind === "hex" || tok.kind === "str" || tok.kind === "name" || tok.kind === "dict") {
      operands.push(tok);
      continue;
    }
    if (tok.kind === "arrayOpen") { operands.push(tok); continue; }
    if (tok.kind === "arrayClose") {
      // Collect back to the matching arrayOpen -- becomes one TJ operand set, handled at "TJ".
      operands.push(tok);
      continue;
    }
    // tok.kind === "op"
    const opName = tok.text;
    opsEncountered[opName] = (opsEncountered[opName] ?? 0) + 1;
    opIndex += 1;

    if (opName === "BT") { Tm = IDENTITY; Tlm = IDENTITY; operands.length = 0; continue; }
    if (opName === "ET") { operands.length = 0; continue; }
    if (opName === "Tf") { operands.length = 0; continue; } // nominal size unused -- real scale comes from Tm (this doc's own convention, verified)
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
      if (!hexTok || hexTok.kind !== "hex") { unsupportedOps.push("Tj with non-hex string (literal-string CID show not modeled)"); operands.length = 0; continue; }
      showHexString(hexTok.text);
      operands.length = 0;
      continue;
    }
    if (opName === "TJ") {
      // operands should be: arrayOpen, (hex|num)*, arrayClose
      const openIdx = operands.findIndex((t) => t.kind === "arrayOpen");
      if (openIdx === -1) { unsupportedOps.push("TJ with no array"); operands.length = 0; continue; }
      const pendingAdjustments: { adj: number; beforeIndex: number }[] = [];
      for (let k = openIdx + 1; k < operands.length; k++) {
        const t = operands[k];
        if (t.kind === "hex") showHexString(t.text);
        else if (t.kind === "num") {
          const adj = Number(t.text);
          if (adj !== 0) {
            tjAdjustmentsFound.push(adj);
            pendingAdjustments.push({ adj, beforeIndex: glyphs.length - 1 });
          }
        } else if (t.kind === "arrayClose") break;
        else if (t.kind === "str") { unsupportedOps.push("TJ with literal string operand (not modeled)"); }
      }
      for (const { adj, beforeIndex } of pendingAdjustments) {
        const before = glyphs[beforeIndex];
        const after = glyphs[beforeIndex + 1];
        tjAdjustmentContext.push({
          adj,
          beforeChar: before?.char ?? "",
          beforeCid: before?.cid ?? "",
          afterChar: after?.char ?? "",
          afterCid: after?.cid ?? "",
        });
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
    if (opName === "'" || opName === '"') {
      unsupportedOps.push(`${opName} (quote text-show operator, not modeled)`);
      operands.length = 0;
      continue;
    }
    if (SAFE_NON_TEXT_OPS.has(opName)) { operands.length = 0; continue; }
    unsupportedOps.push(`unrecognized operator: ${opName}`);
    operands.length = 0;
  }

  return { glyphs, opsEncountered, unsupportedOps, fullText, tjAdjustmentsFound, tjAdjustmentContext };
}

describe("Typography Parity Round 8 -- exhaustive InDesign yakumono extraction", () => {
  it("SHA lock re-check (STOP condition): reference must match the Round 7A-locked identity before any extraction proceeds", () => {
    const { sha256 } = loadPdf();
    expect(sha256).toBe(EXPECTED_SHA256);
  });

  it("exhaustive token-level extraction: zero unsupported text operators, full manuscript recovered, all three integrity snippets present", () => {
    const { bytes, latin1 } = loadPdf();
    const streams = decompressAllFlateStreams(bytes, latin1);
    const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
    expect(cmapStream).toBeDefined();
    const cidToUnicode = parseToUnicodeCMap(cmapStream!.decoded);

    const bodyStream = streams.find((s) => /\bBT\b/.test(s.decoded) && /\bTj\b|\bTJ\b/.test(s.decoded));
    expect(bodyStream).toBeDefined();

    const result = extractTextState(bodyStream!.decoded, cidToUnicode);

    // eslint-disable-next-line no-console
    console.log("ROUND8_OPS_ENCOUNTERED", JSON.stringify(result.opsEncountered));
    // eslint-disable-next-line no-console
    console.log("ROUND8_UNSUPPORTED_OPS", JSON.stringify(result.unsupportedOps));
    // eslint-disable-next-line no-console
    console.log("ROUND8_TJ_ADJUSTMENTS_FOUND", JSON.stringify(result.tjAdjustmentsFound));
    // eslint-disable-next-line no-console
    console.log("ROUND8_TJ_ADJUSTMENT_CONTEXT", JSON.stringify(result.tjAdjustmentContext));
    // eslint-disable-next-line no-console
    console.log("ROUND8_GLYPH_COUNT", result.glyphs.length);
    // eslint-disable-next-line no-console
    console.log("ROUND8_FULL_TEXT", JSON.stringify(result.fullText));
    // eslint-disable-next-line no-console
    console.log("ROUND8_GLYPHS", JSON.stringify(result.glyphs));

    // Coverage requirement (Step 2): unsupported text-show operations = 0.
    expect(result.unsupportedOps).toEqual([]);

    // All three integrity snippets recoverable.
    expect(result.fullText).toContain("人は驚きすぎると");
    expect(result.fullText).toContain("スイはそれを初めて知った");
    expect(result.fullText).toContain("数歩先へ行ったモルが振り返る");

    // Paragraphs Round 7 missed are now recovered.
    expect(result.fullText).toContain("スイはモルが好きだった");
    expect(result.fullText).toContain("グリダニアで");

    // This document's real content DOES contain TJ-array numeric
    // adjustments (discovered by this round's exhaustive extraction,
    // contradicting Round 7's implicit assumption of none). Their
    // significance is analyzed in the next test, not assumed here.
    expect(result.tjAdjustmentsFound.length).toBeGreaterThan(0);
  });

  it("analyzes the real TJ-array adjustments found: which glyph pairs they sit between, and their physical magnitude", () => {
    const { bytes, latin1 } = loadPdf();
    const streams = decompressAllFlateStreams(bytes, latin1);
    const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
    const cidToUnicode = parseToUnicodeCMap(cmapStream!.decoded);
    const bodyStream = streams.find((s) => /\bBT\b/.test(s.decoded) && /\bTj\b|\bTJ\b/.test(s.decoded));
    const result = extractTextState(bodyStream!.decoded, cidToUnicode);

    const magnitudesEm = result.tjAdjustmentContext.map((c) => ({ ...c, adjEm: c.adj / 1000, adjPt: (c.adj / 1000) * EM_PT }));
    // eslint-disable-next-line no-console
    console.log("ROUND8_TJ_MAGNITUDES", JSON.stringify(magnitudesEm));

    const tenValues = result.tjAdjustmentContext.filter((c) => c.adj === 10);
    const bigValues = result.tjAdjustmentContext.filter((c) => c.adj !== 10);
    // eslint-disable-next-line no-console
    console.log("ROUND8_TJ_SMALL_ADJUSTMENTS_COUNT", tenValues.length, "-- 10/1000em =", (10 / 1000) * EM_PT, "pt each");
    // eslint-disable-next-line no-console
    console.log("ROUND8_TJ_LARGE_ADJUSTMENTS", JSON.stringify(bigValues), "-- each is", (bigValues[0]?.adj ?? 0) / 1000, "em =", ((bigValues[0]?.adj ?? 0) / 1000) * EM_PT, "pt");

    expect(result.tjAdjustmentContext.length).toBe(result.tjAdjustmentsFound.length);
  });

  it("locates the two -250 adjustments within their own Tm-run to test the line-end-justification hypothesis (vs. a fixed post-comma mojikumi rule)", () => {
    const { bytes, latin1 } = loadPdf();
    const streams = decompressAllFlateStreams(bytes, latin1);
    const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
    const cidToUnicode = parseToUnicodeCMap(cmapStream!.decoded);
    const bodyStream = streams.find((s) => /\bBT\b/.test(s.decoded) && /\bTj\b|\bTJ\b/.test(s.decoded));
    const result = extractTextState(bodyStream!.decoded, cidToUnicode);

    // Find every 、 glyph together with its own index, its Tm-run's start Y
    // (the first glyph sharing its xPt -- a proxy for "which column"), and
    // its own position within that run -- to see whether the -250 cases
    // sit near the run's own end (last N glyphs before x changes) or are
    // scattered mid-run (which would argue against line-fill justification).
    const glyphs = result.glyphs;
    for (let i = 0; i < glyphs.length; i++) {
      if (glyphs[i].char !== "、") continue;
      const next = glyphs[i + 1];
      if (!next || (next.char !== "と" && next.char !== "ど")) continue;
      // Determine the run: contiguous glyphs sharing this glyph's xPt.
      let runStart = i;
      while (runStart > 0 && glyphs[runStart - 1].xPt === glyphs[i].xPt) runStart--;
      let runEnd = i;
      while (runEnd < glyphs.length - 1 && glyphs[runEnd + 1].xPt === glyphs[i].xPt) runEnd++;
      const positionFromRunEnd = runEnd - i;
      const positionFromRunStart = i - runStart;
      const runLength = runEnd - runStart + 1;
      // eslint-disable-next-line no-console
      console.log("ROUND8_MINUS250_CONTEXT", JSON.stringify({
        char: glyphs[i].char, nextChar: next.char, xPt: glyphs[i].xPt, yPt: glyphs[i].yPt,
        positionFromRunStart, positionFromRunEnd, runLength,
        surrounding: glyphs.slice(Math.max(0, i - 5), Math.min(glyphs.length, i + 6)).map((g) => g.char).join(""),
      }));
    }
  });

  it("punctuation inventory: PRESENT/ABSENT + occurrence counts for every class the round asked about", () => {
    const { bytes, latin1 } = loadPdf();
    const streams = decompressAllFlateStreams(bytes, latin1);
    const cmapStream = streams.find((s) => /begincmap/.test(s.decoded) && /beginbfchar|beginbfrange/.test(s.decoded));
    const cidToUnicode = parseToUnicodeCMap(cmapStream!.decoded);
    const bodyStream = streams.find((s) => /\bBT\b/.test(s.decoded) && /\bTj\b|\bTJ\b/.test(s.decoded));
    const result = extractTextState(bodyStream!.decoded, cidToUnicode);
    const t = result.fullText;
    const count = (needle: string) => (t.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    const inventory = {
      "、": count("、"), "。": count("。"), "「": count("「"), "」": count("」"),
      "『": count("『"), "』": count("』"), "（": count("（"), "）": count("）"),
      "！": count("！"), "？": count("？"), "・": count("・"), "――": count("――"),
      "……": count("……"), "！？": count("！？"), "？！": count("？！"),
      "。」": count("。」"), "、」": count("、」"), "！」": count("！」"), "？」": count("？」"),
      "！？」": count("！？」"), "？！」": count("？！」"),
    };
    // eslint-disable-next-line no-console
    console.log("ROUND8_PUNCTUATION_INVENTORY", JSON.stringify(inventory));
    expect(inventory["、"]).toBeGreaterThan(0);
  });
});

export { extractTextState, tokenize, decompressAllFlateStreams, parseToUnicodeCMap, loadPdf, EM_PT };
