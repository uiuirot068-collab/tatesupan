// P3-O08 — OpenType vertical GPOS audit (Human Visual QA HOLD round 10):
// a deliberately minimal, self-contained GPOS reader — NOT a general
// OpenType positioning engine, no pair/cursive/mark-attachment/chaining-
// contextual resolution. It answers exactly one question,
// deterministically: does this committed font's own GPOS table define
// `vhal`/`vchw` (or the other named vertical/contextual features), and if
// a feature uses GPOS LookupType 1 (Single Adjustment — the type real
// fonts use for vhal's own full-em-to-half-em vertical metric override),
// what XPlacement/YPlacement/XAdvance/YAdvance does it apply to a given
// glyph ID? Same architectural boundary as gsubReader.ts (deliberately
// NOT merged with it, per this round's own "do not replace the working
// GSUB implementation unnecessarily" instruction): Publication-Renderer-
// paint-only, never imported by/shared with Core.
//
// Lookup types other than 1 (Single Adjustment) are DETECTED (tag +
// lookup type recorded) but NOT resolved into a value-record map — this
// audit does not implement Pair Adjustment (2), Cursive (3), Mark
// Attachment (4-6), Contextual (7), or Chaining Contextual (8) GPOS
// positioning. LookupType 9 (Extension) is unwrapped one level, exactly
// like gsubReader.ts's own Extension handling.

function requireBytes(buf: Buffer, offset: number, length: number, what: string): void {
  if (offset < 0 || offset + length > buf.length) {
    throw new Error(`gposReader: truncated/malformed font — cannot read ${what} at offset ${offset} (file is only ${buf.length} bytes)`);
  }
}

interface TableDirectoryEntry {
  offset: number;
  length: number;
}

function readTableDirectory(buf: Buffer): Map<string, TableDirectoryEntry> {
  requireBytes(buf, 0, 12, "the sfnt header");
  const numTables = buf.readUInt16BE(4);
  const tables = new Map<string, TableDirectoryEntry>();
  for (let i = 0; i < numTables; i++) {
    const entryOffset = 12 + i * 16;
    requireBytes(buf, entryOffset, 16, `table directory entry ${i}`);
    const tag = buf.toString("latin1", entryOffset, entryOffset + 4);
    tables.set(tag, { offset: buf.readUInt32BE(entryOffset + 8), length: buf.readUInt32BE(entryOffset + 12) });
  }
  return tables;
}

export function hasGposTable(buf: Buffer): boolean {
  return readTableDirectory(buf).has("GPOS");
}

interface FeatureRecord {
  tag: string;
  lookupListIndices: number[];
}

function readFeatureList(buf: Buffer, gposOffset: number, featureListOffset: number): FeatureRecord[] {
  const fl = gposOffset + featureListOffset;
  requireBytes(buf, fl, 2, "FeatureList.featureCount");
  const featureCount = buf.readUInt16BE(fl);
  const records: FeatureRecord[] = [];
  for (let i = 0; i < featureCount; i++) {
    const recOffset = fl + 2 + i * 6;
    requireBytes(buf, recOffset, 6, `FeatureRecord ${i}`);
    const tag = buf.toString("latin1", recOffset, recOffset + 4);
    const featureOffset = buf.readUInt16BE(recOffset + 4);
    const featureTableOffset = fl + featureOffset;
    requireBytes(buf, featureTableOffset, 4, `Feature table ${i} header`);
    const lookupIndexCount = buf.readUInt16BE(featureTableOffset + 2);
    requireBytes(buf, featureTableOffset + 4, lookupIndexCount * 2, `Feature table ${i} lookupListIndices`);
    const lookupListIndices: number[] = [];
    for (let j = 0; j < lookupIndexCount; j++) lookupListIndices.push(buf.readUInt16BE(featureTableOffset + 4 + j * 2));
    records.push({ tag, lookupListIndices });
  }
  return records;
}

function readScriptDefaultLangSysFeatureIndices(buf: Buffer, gposOffset: number, scriptListOffset: number): Set<number> {
  const sl = gposOffset + scriptListOffset;
  requireBytes(buf, sl, 2, "ScriptList.scriptCount");
  const scriptCount = buf.readUInt16BE(sl);
  const active = new Set<number>();
  for (let i = 0; i < scriptCount; i++) {
    const recOffset = sl + 2 + i * 6;
    requireBytes(buf, recOffset, 6, `ScriptRecord ${i}`);
    const scriptTableOffset = sl + buf.readUInt16BE(recOffset + 4);
    requireBytes(buf, scriptTableOffset, 4, "Script table header");
    const defaultLangSysOffset = buf.readUInt16BE(scriptTableOffset);
    if (defaultLangSysOffset === 0) continue;
    const ls = scriptTableOffset + defaultLangSysOffset;
    requireBytes(buf, ls, 6, "LangSys header");
    const featureIndexCount = buf.readUInt16BE(ls + 4);
    requireBytes(buf, ls + 6, featureIndexCount * 2, "LangSys.featureIndices");
    for (let j = 0; j < featureIndexCount; j++) active.add(buf.readUInt16BE(ls + 6 + j * 2));
  }
  return active;
}

interface LookupTable {
  lookupType: number;
  subtableOffsets: number[]; // absolute
}

function readLookupList(buf: Buffer, gposOffset: number, lookupListOffset: number): LookupTable[] {
  const ll = gposOffset + lookupListOffset;
  requireBytes(buf, ll, 2, "LookupList.lookupCount");
  const lookupCount = buf.readUInt16BE(ll);
  const lookups: LookupTable[] = [];
  for (let i = 0; i < lookupCount; i++) {
    requireBytes(buf, ll + 2 + i * 2, 2, `LookupList offset ${i}`);
    const lookupOffset = buf.readUInt16BE(ll + 2 + i * 2);
    const lt = ll + lookupOffset;
    requireBytes(buf, lt, 6, `Lookup table ${i} header`);
    const lookupType = buf.readUInt16BE(lt);
    const subTableCount = buf.readUInt16BE(lt + 4);
    requireBytes(buf, lt + 6, subTableCount * 2, `Lookup table ${i} subtable offsets`);
    const subtableOffsets: number[] = [];
    for (let j = 0; j < subTableCount; j++) subtableOffsets.push(lt + buf.readUInt16BE(lt + 6 + j * 2));
    lookups.push({ lookupType, subtableOffsets });
  }
  return lookups;
}

function readCoverage(buf: Buffer, coverageOffset: number): number[] {
  requireBytes(buf, coverageOffset, 2, "Coverage.coverageFormat");
  const format = buf.readUInt16BE(coverageOffset);
  if (format === 1) {
    const glyphCount = buf.readUInt16BE(coverageOffset + 2);
    requireBytes(buf, coverageOffset + 4, glyphCount * 2, "Coverage format 1 glyphArray");
    const glyphs: number[] = [];
    for (let i = 0; i < glyphCount; i++) glyphs.push(buf.readUInt16BE(coverageOffset + 4 + i * 2));
    return glyphs;
  }
  if (format === 2) {
    const rangeCount = buf.readUInt16BE(coverageOffset + 2);
    requireBytes(buf, coverageOffset + 4, rangeCount * 6, "Coverage format 2 rangeRecords");
    const glyphs: number[] = [];
    for (let i = 0; i < rangeCount; i++) {
      const r = coverageOffset + 4 + i * 6;
      const start = buf.readUInt16BE(r);
      const end = buf.readUInt16BE(r + 2);
      for (let g = start; g <= end; g++) glyphs.push(g);
    }
    return glyphs;
  }
  throw new Error(`gposReader: unsupported Coverage format ${format}`);
}

export interface GposValueRecord {
  xPlacement: number;
  yPlacement: number;
  xAdvance: number;
  yAdvance: number;
}

const ZERO_VALUE: GposValueRecord = { xPlacement: 0, yPlacement: 0, xAdvance: 0, yAdvance: 0 };

// ValueFormat bit flags (OpenType spec).
const VF_X_PLACEMENT = 0x0001;
const VF_Y_PLACEMENT = 0x0002;
const VF_X_ADVANCE = 0x0004;
const VF_Y_ADVANCE = 0x0008;
// Device-table offset bits (0x0010/0x0020/0x0040/0x0080) are NOT resolved
// here (device tables carry hinting-grid deltas, irrelevant to the real,
// unhinted em-space adjustment this audit needs) — their presence is
// recorded (their offset fields are skipped over, per the fixed
// ValueRecord field order) but never dereferenced/added to the value.

function valueRecordSize(valueFormat: number): number {
  let size = 0;
  for (const bit of [0x0001, 0x0002, 0x0004, 0x0008, 0x0010, 0x0020, 0x0040, 0x0080]) {
    if (valueFormat & bit) size += 2;
  }
  return size;
}

function readValueRecord(buf: Buffer, offset: number, valueFormat: number): GposValueRecord {
  let cursor = offset;
  const value: GposValueRecord = { ...ZERO_VALUE };
  if (valueFormat & VF_X_PLACEMENT) {
    value.xPlacement = buf.readInt16BE(cursor);
    cursor += 2;
  }
  if (valueFormat & VF_Y_PLACEMENT) {
    value.yPlacement = buf.readInt16BE(cursor);
    cursor += 2;
  }
  if (valueFormat & VF_X_ADVANCE) {
    value.xAdvance = buf.readInt16BE(cursor);
    cursor += 2;
  }
  if (valueFormat & VF_Y_ADVANCE) {
    value.yAdvance = buf.readInt16BE(cursor);
    cursor += 2;
  }
  return value;
}

/** Parses ONE GPOS LookupType 1 (Single Adjustment) subtable into {glyphId -> ValueRecord}, merged into `into`. */
function parseSingleAdjustSubtable(buf: Buffer, subtableOffset: number, into: Map<number, GposValueRecord>): void {
  requireBytes(buf, subtableOffset, 4, "SinglePos header");
  const posFormat = buf.readUInt16BE(subtableOffset);
  const coverageOffset = subtableOffset + buf.readUInt16BE(subtableOffset + 2);
  const valueFormat = buf.readUInt16BE(subtableOffset + 4);
  const covered = readCoverage(buf, coverageOffset);

  if (posFormat === 1) {
    // Format 1: ONE ValueRecord applies to every covered glyph.
    const value = readValueRecord(buf, subtableOffset + 6, valueFormat);
    for (const g of covered) into.set(g, value);
    return;
  }
  if (posFormat === 2) {
    // Format 2: one ValueRecord PER covered glyph, in coverage order.
    const valueCount = buf.readUInt16BE(subtableOffset + 6);
    const recordSize = valueRecordSize(valueFormat);
    const recordsOffset = subtableOffset + 8;
    for (let i = 0; i < covered.length && i < valueCount; i++) {
      const value = readValueRecord(buf, recordsOffset + i * recordSize, valueFormat);
      into.set(covered[i], value);
    }
    return;
  }
  throw new Error(`gposReader: unsupported SinglePos format ${posFormat}`);
}

export interface GposFeatureResult {
  present: boolean;
  lookupTypesUsed: number[];
  /** glyphId -> ValueRecord, resolved ONLY from LookupType 1 (Single Adjustment) subtables. Empty if the feature uses no such lookup (e.g. it is purely contextual). */
  singleAdjustments: Map<number, GposValueRecord>;
}

const NO_FEATURE: GposFeatureResult = { present: false, lookupTypesUsed: [], singleAdjustments: new Map() };

export interface GposAudit {
  hasGpos: boolean;
  featureTagsPresent: string[];
  vhal: GposFeatureResult;
  vchw: GposFeatureResult;
  valt: GposFeatureResult;
  vpal: GposFeatureResult;
  vkrn: GposFeatureResult;
  halt: GposFeatureResult;
  chws: GposFeatureResult;
  palt: GposFeatureResult;
  kern: GposFeatureResult;
}

/** Full audit: does this font have GPOS, which feature tags does it declare (regardless of resolvability), and for the named vertical/contextual features, resolve their real Single-Adjustment value records (other lookup types recorded, not resolved). */
export function auditGpos(buf: Buffer): GposAudit {
  const tables = readTableDirectory(buf);
  const gpos = tables.get("GPOS");
  const emptyResult = {
    hasGpos: false,
    featureTagsPresent: [],
    vhal: NO_FEATURE,
    vchw: NO_FEATURE,
    valt: NO_FEATURE,
    vpal: NO_FEATURE,
    vkrn: NO_FEATURE,
    halt: NO_FEATURE,
    chws: NO_FEATURE,
    palt: NO_FEATURE,
    kern: NO_FEATURE,
  };
  if (!gpos) return emptyResult;

  requireBytes(buf, gpos.offset, 10, "GPOS header");
  const scriptListOffset = buf.readUInt16BE(gpos.offset + 4);
  const featureListOffset = buf.readUInt16BE(gpos.offset + 6);
  const lookupListOffset = buf.readUInt16BE(gpos.offset + 8);

  const features = readFeatureList(buf, gpos.offset, featureListOffset);
  const lookups = readLookupList(buf, gpos.offset, lookupListOffset);
  const activeFeatureIndices = readScriptDefaultLangSysFeatureIndices(buf, gpos.offset, scriptListOffset);
  const featureTagsPresent = Array.from(new Set(features.filter((_, i) => activeFeatureIndices.has(i)).map((f) => f.tag))).sort();

  function resolveFeature(tag: string): GposFeatureResult {
    const matches = features.map((f, i) => ({ f, i })).filter(({ f, i }) => f.tag === tag && activeFeatureIndices.has(i));
    if (matches.length === 0) return NO_FEATURE;

    const lookupTypesUsed = new Set<number>();
    const singleAdjustments = new Map<number, GposValueRecord>();

    function applyLookup(lookupType: number, subtableOffsets: number[]): void {
      if (lookupType === 1) {
        lookupTypesUsed.add(1);
        for (const off of subtableOffsets) parseSingleAdjustSubtable(buf, off, singleAdjustments);
        return;
      }
      if (lookupType === 9) {
        for (const off of subtableOffsets) {
          requireBytes(buf, off, 8, "ExtensionPos header");
          const extensionLookupType = buf.readUInt16BE(off + 2);
          const extensionOffset = buf.readUInt32BE(off + 4);
          lookupTypesUsed.add(extensionLookupType);
          if (extensionLookupType === 1) parseSingleAdjustSubtable(buf, off + extensionOffset, singleAdjustments);
        }
        return;
      }
      lookupTypesUsed.add(lookupType);
    }

    for (const { f } of matches) {
      for (const lookupIndex of f.lookupListIndices) {
        const lookup = lookups[lookupIndex];
        if (!lookup) continue;
        applyLookup(lookup.lookupType, lookup.subtableOffsets);
      }
    }

    return { present: true, lookupTypesUsed: Array.from(lookupTypesUsed).sort((a, b) => a - b), singleAdjustments };
  }

  return {
    hasGpos: true,
    featureTagsPresent,
    vhal: resolveFeature("vhal"),
    vchw: resolveFeature("vchw"),
    valt: resolveFeature("valt"),
    vpal: resolveFeature("vpal"),
    vkrn: resolveFeature("vkrn"),
    halt: resolveFeature("halt"),
    chws: resolveFeature("chws"),
    palt: resolveFeature("palt"),
    kern: resolveFeature("kern"),
  };
}
