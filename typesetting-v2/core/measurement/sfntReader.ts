// P3-O08 — Real Shippori Mincho MeasurementFacts: the SMALLEST deterministic
// SFNT (TrueType/OpenType) reader this task needs — NOT a general-purpose
// font parser. It reads only the table directory (to confirm the file is a
// structurally valid sfnt and to locate the tables MeasurementFacts
// consumers actually care about) and, from `head`, `unitsPerEm` (recorded
// for evidence completeness only — see shipporiMinchoProvider.ts's own
// comment on why unitsPerEm does NOT feed into any advance formula). It
// never parses glyph outlines, `cmap` mappings, `hmtx`/`vmtx` per-glyph
// widths, or any OpenType layout table (GSUB/GPOS) — none of those are
// needed by the frozen Natural Pitch contract (Core Contract §18; Master
// HD-015/HD-018: character advance is the declared point size itself, a
// "natural 1em declared-pitch", never a per-glyph measurement).
//
// Bounds-checked, deterministic, no network, no native dependency. A
// malformed/truncated font throws a structured error rather than returning
// a fabricated value.

export interface SfntSummary {
  /** The 4-byte version tag, decoded to one of the well-known sfnt flavors. */
  flavor: "truetype" | "opentype-cff" | "true" | "typ1";
  numTables: number;
  tables: ReadonlySet<string>;
  /** `head` table's own `unitsPerEm` field — recorded for evidence/debugging only, never used to derive any GeometryTick (see module doc). `undefined` if `head` is absent. */
  unitsPerEm: number | undefined;
}

const FLAVOR_TAGS: Record<number, SfntSummary["flavor"]> = {
  0x00010000: "truetype",
  0x4f54544f: "opentype-cff", // "OTTO"
  0x74727565: "true", // "true"
  0x74797031: "typ1", // "typ1"
};

function requireBytes(buf: Buffer, offset: number, length: number, what: string): void {
  if (offset < 0 || offset + length > buf.length) {
    throw new Error(`sfntReader: truncated/malformed font — cannot read ${what} at offset ${offset} (file is only ${buf.length} bytes)`);
  }
}

export function readSfntSummary(buf: Buffer): SfntSummary {
  requireBytes(buf, 0, 12, "the sfnt header");
  const tag = buf.readUInt32BE(0);
  const flavor = FLAVOR_TAGS[tag];
  if (!flavor) {
    throw new Error(`sfntReader: not a recognized sfnt font (version tag 0x${tag.toString(16)})`);
  }
  const numTables = buf.readUInt16BE(4);
  if (numTables <= 0 || numTables > 100) {
    throw new Error(`sfntReader: implausible numTables (${numTables}) — refusing to parse further`);
  }

  const tables = new Set<string>();
  let headOffset: number | undefined;
  for (let i = 0; i < numTables; i++) {
    const entryOffset = 12 + i * 16;
    requireBytes(buf, entryOffset, 16, `table directory entry ${i}`);
    const tag4 = buf.toString("latin1", entryOffset, entryOffset + 4).trim();
    const offset = buf.readUInt32BE(entryOffset + 8);
    tables.add(tag4);
    if (tag4 === "head") headOffset = offset;
  }

  let unitsPerEm: number | undefined;
  if (headOffset !== undefined) {
    // `head` table layout (OpenType spec): unitsPerEm is a uint16 at byte
    // offset 18 from the table's own start.
    requireBytes(buf, headOffset + 18, 2, "head.unitsPerEm");
    unitsPerEm = buf.readUInt16BE(headOffset + 18);
  }

  return { flavor, numTables, tables, unitsPerEm };
}
