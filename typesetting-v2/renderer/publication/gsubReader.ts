// P3-O08 — OpenType vertical GSUB audit (Human Visual QA HOLD round 6): a
// deliberately minimal, self-contained GSUB reader — NOT a general
// OpenType shaping engine, no full lookup-type coverage, no context/chain
// substitution, no mark attachment. It answers exactly one question,
// deterministically: does this committed font's own GSUB table define a
// `vert` and/or `vrt2` feature, and if so, which lookups does it use and
// what glyph-ID substitution (if any) do those lookups perform? Same
// architectural boundary as fontCapability.ts/fontMetrics.ts:
// Publication-Renderer-paint-only, never imported by/shared with Core.
//
// Only SingleSubst lookups (GSUB LookupType 1, both subtable formats) are
// fully resolved into a glyph-ID substitution map — the lookup type every
// production CJK font's own `vert`/`vrt2` feature actually uses for
// punctuation/kana vertical alternates. LookupType 7 (Extension
// Substitution) is unwrapped one level (its real, wrapped type is then
// handled the same way). Any OTHER lookup type encountered is recorded
// (type number only, in `otherLookupTypes`) but NOT resolved into the
// substitution map — this audit does not fabricate a substitution for a
// lookup type it cannot actually parse.

function requireBytes(buf: Buffer, offset: number, length: number, what: string): void {
  if (offset < 0 || offset + length > buf.length) {
    throw new Error(`gsubReader: truncated/malformed font — cannot read ${what} at offset ${offset} (file is only ${buf.length} bytes)`);
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

/** Does this font have a GSUB table at all? Cheap presence check, no parsing. */
export function hasGsubTable(buf: Buffer): boolean {
  return readTableDirectory(buf).has("GSUB");
}

interface ScriptRecord {
  tag: string;
  scriptOffset: number; // absolute
}

function readScriptList(buf: Buffer, gsubOffset: number, scriptListOffset: number): ScriptRecord[] {
  const sl = gsubOffset + scriptListOffset;
  requireBytes(buf, sl, 2, "ScriptList.scriptCount");
  const scriptCount = buf.readUInt16BE(sl);
  const records: ScriptRecord[] = [];
  for (let i = 0; i < scriptCount; i++) {
    const recOffset = sl + 2 + i * 6;
    requireBytes(buf, recOffset, 6, `ScriptRecord ${i}`);
    const tag = buf.toString("latin1", recOffset, recOffset + 4);
    const offset = buf.readUInt16BE(recOffset + 4);
    records.push({ tag, scriptOffset: sl + offset });
  }
  return records;
}

/** Feature indices (into the FeatureList) that a script's own default LangSys activates. */
function readDefaultLangSysFeatureIndices(buf: Buffer, scriptTableOffset: number): number[] {
  requireBytes(buf, scriptTableOffset, 4, "Script table header");
  const defaultLangSysOffset = buf.readUInt16BE(scriptTableOffset);
  if (defaultLangSysOffset === 0) return [];
  const ls = scriptTableOffset + defaultLangSysOffset;
  requireBytes(buf, ls, 6, "LangSys header");
  const featureIndexCount = buf.readUInt16BE(ls + 4);
  requireBytes(buf, ls + 6, featureIndexCount * 2, "LangSys.featureIndices");
  const indices: number[] = [];
  for (let i = 0; i < featureIndexCount; i++) indices.push(buf.readUInt16BE(ls + 6 + i * 2));
  return indices;
}

interface FeatureRecord {
  tag: string;
  lookupListIndices: number[];
}

function readFeatureList(buf: Buffer, gsubOffset: number, featureListOffset: number): FeatureRecord[] {
  const fl = gsubOffset + featureListOffset;
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

interface LookupTable {
  lookupType: number;
  subtableOffsets: number[]; // absolute
}

function readLookupList(buf: Buffer, gsubOffset: number, lookupListOffset: number): LookupTable[] {
  const ll = gsubOffset + lookupListOffset;
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

/** Parses a Coverage table into an ordered array of covered glyph IDs (index = coverage index). */
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
  throw new Error(`gsubReader: unsupported Coverage format ${format}`);
}

/** Parses ONE GSUB LookupType 1 (Single Substitution) subtable into {sourceGlyphId -> substituteGlyphId} entries, merged into `into`. */
function parseSingleSubstSubtable(buf: Buffer, subtableOffset: number, into: Map<number, number>): void {
  requireBytes(buf, subtableOffset, 4, "SingleSubst header");
  const substFormat = buf.readUInt16BE(subtableOffset);
  const coverageOffset = subtableOffset + buf.readUInt16BE(subtableOffset + 2);
  const covered = readCoverage(buf, coverageOffset);
  if (substFormat === 1) {
    const deltaGlyphID = buf.readInt16BE(subtableOffset + 4);
    for (const g of covered) into.set(g, (g + deltaGlyphID) & 0xffff);
    return;
  }
  if (substFormat === 2) {
    const glyphCount = buf.readUInt16BE(subtableOffset + 4);
    requireBytes(buf, subtableOffset + 6, glyphCount * 2, "SingleSubst format 2 substituteGlyphIDs");
    for (let i = 0; i < covered.length && i < glyphCount; i++) {
      into.set(covered[i], buf.readUInt16BE(subtableOffset + 6 + i * 2));
    }
    return;
  }
  throw new Error(`gsubReader: unsupported SingleSubst format ${substFormat}`);
}

export interface GsubFeatureResult {
  present: boolean;
  /** Every distinct GSUB lookup TYPE this feature's own lookups reference (post-Extension-unwrap), for evidence -- e.g. [1] means "only SingleSubst," [1, 4] means "SingleSubst plus a Ligature lookup this audit does not resolve." */
  lookupTypesUsed: number[];
  /** glyphId -> substitute glyphId, resolved ONLY from LookupType 1 (SingleSubst) subtables -- the type CJK fonts actually use for vert/vrt2 kana/punctuation alternates. Empty if the feature uses no SingleSubst lookup. */
  substitutionMap: Map<number, number>;
}

const NO_FEATURE: GsubFeatureResult = { present: false, lookupTypesUsed: [], substitutionMap: new Map() };

export interface GsubAudit {
  hasGsub: boolean;
  /** Every script tag this font's own GSUB ScriptList declares (e.g. "kana", "hani", "DFLT", "latn"). */
  scriptTags: string[];
  vert: GsubFeatureResult;
  vrt2: GsubFeatureResult;
}

/**
 * Full audit entry point: does this font have GSUB, which scripts does it
 * declare, and does `vert`/`vrt2` exist -- and if so, resolve their real
 * glyph-ID substitution (SingleSubst lookups only; other lookup types are
 * recorded, not resolved). Throws a structured error for a malformed GSUB
 * rather than silently reporting no substitution.
 */
export function auditGsub(buf: Buffer): GsubAudit {
  const tables = readTableDirectory(buf);
  const gsub = tables.get("GSUB");
  if (!gsub) return { hasGsub: false, scriptTags: [], vert: NO_FEATURE, vrt2: NO_FEATURE };

  requireBytes(buf, gsub.offset, 10, "GSUB header");
  const scriptListOffset = buf.readUInt16BE(gsub.offset + 4);
  const featureListOffset = buf.readUInt16BE(gsub.offset + 6);
  const lookupListOffset = buf.readUInt16BE(gsub.offset + 8);

  const scripts = readScriptList(buf, gsub.offset, scriptListOffset);
  const scriptTags = scripts.map((s) => s.tag);
  const features = readFeatureList(buf, gsub.offset, featureListOffset);
  const lookups = readLookupList(buf, gsub.offset, lookupListOffset);

  // Which FeatureList entries are actually ACTIVATED by at least one
  // script's own default LangSys (rather than blindly trusting every
  // same-tagged FeatureList entry, some fonts declare unused ones).
  const activeFeatureIndices = new Set<number>();
  for (const script of scripts) {
    for (const idx of readDefaultLangSysFeatureIndices(buf, script.scriptOffset)) activeFeatureIndices.add(idx);
  }

  function resolveFeature(tag: "vert" | "vrt2"): GsubFeatureResult {
    const matches = features
      .map((f, i) => ({ f, i }))
      .filter(({ f, i }) => f.tag === tag && activeFeatureIndices.has(i));
    if (matches.length === 0) return NO_FEATURE;

    const lookupTypesUsed = new Set<number>();
    const substitutionMap = new Map<number, number>();

    for (const { f } of matches) {
      for (const lookupIndex of f.lookupListIndices) {
        const lookup = lookups[lookupIndex];
        if (!lookup) continue;
        applyLookup(lookup.lookupType, lookup.subtableOffsets);
      }
    }

    function applyLookup(lookupType: number, subtableOffsets: number[]): void {
      if (lookupType === 1) {
        lookupTypesUsed.add(1);
        for (const off of subtableOffsets) parseSingleSubstSubtable(buf, off, substitutionMap);
        return;
      }
      if (lookupType === 7) {
        // Extension Substitution: unwrap one level to the real lookup type.
        for (const off of subtableOffsets) {
          requireBytes(buf, off, 8, "ExtensionSubst header");
          const extensionLookupType = buf.readUInt16BE(off + 2);
          const extensionOffset = buf.readUInt32BE(off + 4);
          lookupTypesUsed.add(extensionLookupType);
          if (extensionLookupType === 1) parseSingleSubstSubtable(buf, off + extensionOffset, substitutionMap);
        }
        return;
      }
      lookupTypesUsed.add(lookupType);
    }

    return { present: true, lookupTypesUsed: Array.from(lookupTypesUsed).sort((a, b) => a - b), substitutionMap };
  }

  return { hasGsub: true, scriptTags, vert: resolveFeature("vert"), vrt2: resolveFeature("vrt2") };
}
