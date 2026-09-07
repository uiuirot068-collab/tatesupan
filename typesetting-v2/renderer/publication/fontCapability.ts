// P3-O08 — Publication vertical-glyph paint foundation: a deliberately
// minimal, self-contained `cmap` glyph-coverage reader — NOT a general
// font parser, NOT imported from/shared with `core/measurement/sfntReader.ts`
// (this module is Publication-Renderer-paint-only, per this task's own
// explicit scope boundary; it never touches Core). It answers exactly one
// question, deterministically: "does this committed font file contain a
// glyph for Unicode code point C?" — used to decide, at PAINT TIME only,
// whether a real Unicode vertical presentation-form glyph (see
// `verticalGlyphMap.ts`) can be substituted for an ordinary horizontal
// character, instead of guessing or assuming coverage.
//
// Supports cmap subtable formats 4 (BMP, segment mapping) and 12
// (full-range groups) — the two formats real-world fonts (including
// Google Fonts CJK builds) actually ship. Bounds-checked; a malformed or
// unsupported cmap throws a structured error rather than silently
// reporting false coverage.

function requireBytes(buf: Buffer, offset: number, length: number, what: string): void {
  if (offset < 0 || offset + length > buf.length) {
    throw new Error(`fontCapability: truncated/malformed font — cannot read ${what} at offset ${offset} (file is only ${buf.length} bytes)`);
  }
}

function findCmapTableOffset(buf: Buffer): number {
  requireBytes(buf, 0, 12, "the sfnt header");
  const numTables = buf.readUInt16BE(4);
  for (let i = 0; i < numTables; i++) {
    const entryOffset = 12 + i * 16;
    requireBytes(buf, entryOffset, 16, `table directory entry ${i}`);
    const tag = buf.toString("latin1", entryOffset, entryOffset + 4);
    if (tag === "cmap") return buf.readUInt32BE(entryOffset + 8);
  }
  throw new Error("fontCapability: font has no 'cmap' table");
}

interface CmapSubtableRef {
  platformID: number;
  encodingID: number;
  offset: number; // absolute byte offset from the start of `buf`
}

function findBestSubtable(buf: Buffer, cmapOffset: number): CmapSubtableRef {
  requireBytes(buf, cmapOffset, 4, "cmap header");
  const numSubtables = buf.readUInt16BE(cmapOffset + 2);
  const subtables: CmapSubtableRef[] = [];
  for (let i = 0; i < numSubtables; i++) {
    const entryOffset = cmapOffset + 4 + i * 8;
    requireBytes(buf, entryOffset, 8, `cmap encoding record ${i}`);
    subtables.push({
      platformID: buf.readUInt16BE(entryOffset),
      encodingID: buf.readUInt16BE(entryOffset + 2),
      offset: cmapOffset + buf.readUInt32BE(entryOffset + 4),
    });
  }
  // Preference order: Windows full-Unicode (3,10) > Windows BMP (3,1) >
  // Unicode platform (0, any) > Windows Symbol (3,0) as a last resort.
  const preferred =
    subtables.find((s) => s.platformID === 3 && s.encodingID === 10) ??
    subtables.find((s) => s.platformID === 3 && s.encodingID === 1) ??
    subtables.find((s) => s.platformID === 0) ??
    subtables.find((s) => s.platformID === 3 && s.encodingID === 0);
  if (!preferred) {
    throw new Error("fontCapability: no usable (Windows/Unicode) cmap subtable found");
  }
  return preferred;
}

type CoverageCheck = (codePoint: number) => boolean;
type GlyphIdLookup = (codePoint: number) => number | undefined;

function parseFormat4Lookup(buf: Buffer, tableOffset: number): GlyphIdLookup {
  requireBytes(buf, tableOffset, 14, "cmap format 4 header");
  const segCountX2 = buf.readUInt16BE(tableOffset + 6);
  const segCount = segCountX2 / 2;
  const endCodeOffset = tableOffset + 14;
  const startCodeOffset = endCodeOffset + segCountX2 + 2; // +2 skips reservedPad
  const idDeltaOffset = startCodeOffset + segCountX2;
  const idRangeOffsetOffset = idDeltaOffset + segCountX2;
  requireBytes(buf, idRangeOffsetOffset, segCountX2, "cmap format 4 idRangeOffset array");

  return (codePoint: number): number | undefined => {
    if (codePoint > 0xffff) return undefined; // format 4 only covers the BMP
    for (let i = 0; i < segCount; i++) {
      const endCode = buf.readUInt16BE(endCodeOffset + i * 2);
      if (codePoint > endCode) continue;
      const startCode = buf.readUInt16BE(startCodeOffset + i * 2);
      if (codePoint < startCode) return undefined;
      const idRangeOffset = buf.readUInt16BE(idRangeOffsetOffset + i * 2);
      const idDelta = buf.readInt16BE(idDeltaOffset + i * 2);
      if (idRangeOffset === 0) {
        const glyphId = (codePoint + idDelta) & 0xffff;
        return glyphId !== 0 ? glyphId : undefined;
      }
      const glyphIndexAddress = idRangeOffsetOffset + i * 2 + idRangeOffset + 2 * (codePoint - startCode);
      requireBytes(buf, glyphIndexAddress, 2, "cmap format 4 glyphIdArray entry");
      const rawGlyphId = buf.readUInt16BE(glyphIndexAddress);
      if (rawGlyphId === 0) return undefined;
      const glyphId = (rawGlyphId + idDelta) & 0xffff;
      return glyphId !== 0 ? glyphId : undefined;
    }
    return undefined;
  };
}

function parseFormat12Lookup(buf: Buffer, tableOffset: number): GlyphIdLookup {
  requireBytes(buf, tableOffset, 16, "cmap format 12 header");
  const numGroups = buf.readUInt32BE(tableOffset + 12);
  const groupsOffset = tableOffset + 16;
  requireBytes(buf, groupsOffset, numGroups * 12, "cmap format 12 groups");

  return (codePoint: number): number | undefined => {
    for (let i = 0; i < numGroups; i++) {
      const g = groupsOffset + i * 12;
      const startCharCode = buf.readUInt32BE(g);
      const endCharCode = buf.readUInt32BE(g + 4);
      if (codePoint >= startCharCode && codePoint <= endCharCode) {
        const startGlyphID = buf.readUInt32BE(g + 8);
        return startGlyphID + (codePoint - startCharCode);
      }
      if (startCharCode > codePoint) break;
    }
    return undefined;
  };
}

/**
 * Builds a deterministic glyph-ID lookup for the given raw font bytes —
 * the same cmap subtable parse as `createGlyphCoverageChecker`, but
 * returning the real numeric glyph ID (needed by fontMetrics.ts's own
 * `glyf`/`hmtx` lookups) instead of a boolean.
 */
export function createGlyphIdLookup(buf: Buffer): GlyphIdLookup {
  const cmapOffset = findCmapTableOffset(buf);
  const subtable = findBestSubtable(buf, cmapOffset);
  requireBytes(buf, subtable.offset, 2, "cmap subtable format");
  const format = buf.readUInt16BE(subtable.offset);
  if (format === 4) return parseFormat4Lookup(buf, subtable.offset);
  if (format === 12) return parseFormat12Lookup(buf, subtable.offset);
  throw new Error(`fontCapability: unsupported cmap subtable format ${format} (only 4 and 12 are supported)`);
}

/**
 * Builds a deterministic glyph-coverage checker for the given raw font
 * bytes. Throws a structured error for a malformed/unsupported font rather
 * than silently returning false for everything.
 */
export function createGlyphCoverageChecker(buf: Buffer): CoverageCheck {
  const lookup = createGlyphIdLookup(buf);
  return (codePoint: number) => lookup(codePoint) !== undefined;
}
