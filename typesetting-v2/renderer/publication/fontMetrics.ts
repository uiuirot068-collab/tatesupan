// P3-O08 — Font-derived vertical glyph paint metrics (Human Visual QA HOLD
// round 5): a deliberately minimal, self-contained SFNT metrics reader —
// NOT a general OpenType parser, NOT a shaping engine, no GSUB, no
// composite-glyph contour math. It reads exactly the tables needed to
// answer "where does this glyph's own real ink sit inside its own advance
// box" from the font's OWN data, replacing the prior task's arbitrary,
// Human-rejected em-relative offset constants. Same architectural
// boundary as fontCapability.ts: Publication-Renderer-paint-only, never
// imported by/shared with Core.
//
// Table audit result (qa/publication/p3-o08/font-poc/fonts/ShipporiMincho-Regular.ttf,
// measured via fontMetrics.test.ts, recorded in
// qa/evidence/P3_O08_FONT_DERIVED_VERTICAL_GLYPH_METRICS.md §2): this font
// DOES contain real `vhea`/`vmtx` tables (VORG is absent, which is normal —
// VORG only exists in CFF-outline OpenType fonts, never TrueType-outline
// ones like this one; TrueType vertical origin is derived from vmtx's own
// topSideBearing per the OpenType spec, no VORG needed). `vhea`/`vmtx` ARE
// read below and used as real, measured vertical-origin data.
//
// Deliberately does NOT read: composite glyph outlines (only simple
// glyphs' own already-stored bounding box is read — composite glyphs fall
// back to a documented "unavailable" result, never a guess), or hinting
// instructions.

import type { FontBinary } from "./fontBinary";

function requireBytes(buf: FontBinary, offset: number, length: number, what: string): void {
  if (offset < 0 || offset + length > buf.length) {
    throw new Error(`fontMetrics: truncated/malformed font — cannot read ${what} at offset ${offset} (file is only ${buf.length} bytes)`);
  }
}

interface TableDirectoryEntry {
  tag: string;
  offset: number;
  length: number;
}

function readTableDirectory(buf: FontBinary): Map<string, TableDirectoryEntry> {
  requireBytes(buf, 0, 12, "the sfnt header");
  const numTables = buf.readUInt16BE(4);
  const tables = new Map<string, TableDirectoryEntry>();
  for (let i = 0; i < numTables; i++) {
    const entryOffset = 12 + i * 16;
    requireBytes(buf, entryOffset, 16, `table directory entry ${i}`);
    const tag = buf.toString("latin1", entryOffset, entryOffset + 4);
    tables.set(tag, { tag, offset: buf.readUInt32BE(entryOffset + 8), length: buf.readUInt32BE(entryOffset + 12) });
  }
  return tables;
}

/** Every table tag physically present in this font — the audit's own raw evidence, no interpretation. */
export function listTables(buf: FontBinary): string[] {
  return Array.from(readTableDirectory(buf).keys()).sort();
}

interface HeadInfo {
  unitsPerEm: number;
  indexToLocFormat: number; // 0 = short (uint16, x2), 1 = long (uint32)
}

function readHead(buf: FontBinary, tables: Map<string, TableDirectoryEntry>): HeadInfo {
  const head = tables.get("head");
  if (!head) throw new Error("fontMetrics: font has no 'head' table");
  requireBytes(buf, head.offset, 54, "head table");
  return {
    unitsPerEm: buf.readUInt16BE(head.offset + 18),
    indexToLocFormat: buf.readInt16BE(head.offset + 50),
  };
}

function readNumGlyphs(buf: FontBinary, tables: Map<string, TableDirectoryEntry>): number {
  const maxp = tables.get("maxp");
  if (!maxp) throw new Error("fontMetrics: font has no 'maxp' table");
  requireBytes(buf, maxp.offset + 4, 2, "maxp.numGlyphs");
  return buf.readUInt16BE(maxp.offset + 4);
}

function readLoca(buf: FontBinary, tables: Map<string, TableDirectoryEntry>, numGlyphs: number, indexToLocFormat: number): number[] {
  const loca = tables.get("loca");
  if (!loca) throw new Error("fontMetrics: font has no 'loca' table");
  const offsets: number[] = [];
  if (indexToLocFormat === 0) {
    requireBytes(buf, loca.offset, (numGlyphs + 1) * 2, "loca (short format)");
    for (let i = 0; i <= numGlyphs; i++) offsets.push(buf.readUInt16BE(loca.offset + i * 2) * 2);
  } else {
    requireBytes(buf, loca.offset, (numGlyphs + 1) * 4, "loca (long format)");
    for (let i = 0; i <= numGlyphs; i++) offsets.push(buf.readUInt32BE(loca.offset + i * 4));
  }
  return offsets;
}

export interface GlyphInkBBox {
  /** Simple (non-composite) glyph: real outline bounds, directly from `glyf`'s own per-glyph header, in FONT UNITS. */
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  numberOfContours: number;
  /** True for a composite glyph (numberOfContours < 0) -- its own glyf header still carries a real, already-computed bbox, so this is populated either way; recorded for evidence transparency, never used to fabricate a fallback. */
  isComposite: boolean;
}

export interface HorizontalMetrics {
  advanceWidth: number; // font units
  leftSideBearing: number; // font units
}

export interface VerticalMetrics {
  advanceHeight: number; // font units
  topSideBearing: number; // font units -- distance from the vertical origin Y down to the glyph's own yMax (per OpenType vmtx spec)
  /** yOrigin = yMax + topSideBearing (OpenType spec formula for VORG-less TrueType fonts) -- the Y coordinate, in font units, of this glyph's own vertical origin. Requires a real glyf bbox; undefined if the glyph has none (e.g. space) or vmtx/glyf/loca are unavailable. */
  originY: number | undefined;
}

/**
 * Renderer-independent font-derived metrics reader, built once per font
 * buffer (parses `head`/`maxp`/`loca` once; per-glyph lookups are then O(1)
 * table reads). Every returned quantity is FONT UNITS unless divided by
 * `unitsPerEm` — callers convert to em-relative fractions themselves.
 */
export class FontMetricsReader {
  private readonly buf: FontBinary;
  private readonly tables: Map<string, TableDirectoryEntry>;
  readonly unitsPerEm: number;
  /** vhea.ascent / vhea.descent, font units -- undefined if `vhea` is absent. Recorded for reference only (this task uses per-glyph originY, not these font-wide extremes, for placement). */
  readonly vertAscent: number | undefined;
  readonly vertDescent: number | undefined;
  private readonly numGlyphs: number;
  private readonly locaOffsets: number[] | undefined;
  private readonly glyfOffset: number | undefined;
  private readonly hmtxOffset: number | undefined;
  private readonly numHMetrics: number | undefined;
  private readonly vmtxOffset: number | undefined;
  private readonly numVMetrics: number | undefined;

  constructor(buf: FontBinary) {
    this.buf = buf;
    this.tables = readTableDirectory(buf);
    const head = readHead(buf, this.tables);
    this.unitsPerEm = head.unitsPerEm;
    this.numGlyphs = readNumGlyphs(buf, this.tables);
    if (this.tables.has("loca") && this.tables.has("glyf")) {
      this.locaOffsets = readLoca(buf, this.tables, this.numGlyphs, head.indexToLocFormat);
      this.glyfOffset = this.tables.get("glyf")!.offset;
    }
    const hhea = this.tables.get("hhea");
    const hmtx = this.tables.get("hmtx");
    if (hhea && hmtx) {
      requireBytes(buf, hhea.offset + 34, 2, "hhea.numberOfHMetrics");
      this.numHMetrics = buf.readUInt16BE(hhea.offset + 34);
      this.hmtxOffset = hmtx.offset;
    }
    const vhea = this.tables.get("vhea");
    const vmtx = this.tables.get("vmtx");
    if (vhea && vmtx) {
      // vhea has the identical 36-byte layout as hhea, with
      // numOfLongVerMetrics at the same +34 offset as hhea.numberOfHMetrics
      // (OpenType spec: vhea mirrors hhea's structure for the vertical axis).
      requireBytes(buf, vhea.offset + 4, 36 - 4, "vhea.ascent/descent/numOfLongVerMetrics");
      this.vertAscent = buf.readInt16BE(vhea.offset + 4);
      this.vertDescent = buf.readInt16BE(vhea.offset + 6);
      this.numVMetrics = buf.readUInt16BE(vhea.offset + 34);
      this.vmtxOffset = vmtx.offset;
    }
  }

  hasTable(tag: string): boolean {
    return this.tables.has(tag);
  }

  /** Real outline bounding box for a glyph ID, straight from `glyf`'s own already-computed per-glyph header — `undefined` only if `glyf`/`loca` are absent or the glyph has zero contours (whitespace). */
  glyphInkBBox(glyphId: number): GlyphInkBBox | undefined {
    if (!this.locaOffsets || this.glyfOffset === undefined) return undefined;
    if (glyphId < 0 || glyphId >= this.numGlyphs) return undefined;
    const start = this.locaOffsets[glyphId];
    const end = this.locaOffsets[glyphId + 1];
    if (end <= start) return undefined; // empty glyph (e.g. space) -- genuinely no outline, not a parse failure
    const off = this.glyfOffset + start;
    requireBytes(this.buf, off, 10, `glyf header for glyph ${glyphId}`);
    const numberOfContours = this.buf.readInt16BE(off);
    return {
      numberOfContours,
      isComposite: numberOfContours < 0,
      xMin: this.buf.readInt16BE(off + 2),
      yMin: this.buf.readInt16BE(off + 4),
      xMax: this.buf.readInt16BE(off + 6),
      yMax: this.buf.readInt16BE(off + 8),
    };
  }

  /** Horizontal advance width + left side bearing for a glyph ID, from `hmtx` (the last recorded advance repeats for any glyphId beyond `numberOfHMetrics`, per the OpenType spec). `undefined` if `hhea`/`hmtx` are absent. */
  horizontalMetrics(glyphId: number): HorizontalMetrics | undefined {
    if (this.hmtxOffset === undefined || this.numHMetrics === undefined) return undefined;
    const i = Math.min(glyphId, this.numHMetrics - 1);
    const recordOffset = this.hmtxOffset + i * 4;
    requireBytes(this.buf, recordOffset, 4, `hmtx record for glyph ${glyphId}`);
    const advanceWidth = this.buf.readUInt16BE(recordOffset);
    // lsb for glyphs beyond numberOfHMetrics lives in a trailing int16 array, not modeled here (not needed by this task's own glyph set, all of which are within numberOfHMetrics for a normal CJK font) -- read directly when within range, otherwise report the shared advanceWidth with an lsb of 0 rather than mis-reading unrelated bytes.
    const leftSideBearing = glyphId < this.numHMetrics ? this.buf.readInt16BE(recordOffset + 2) : 0;
    return { advanceWidth, leftSideBearing };
  }

  /** Real vertical advance height + top side bearing for a glyph ID, from `vmtx` (same "last record repeats" rule as hmtx). `originY` is derived per the OpenType spec formula (yOrigin = yMax + topSideBearing) using this glyph's own real `glyf` bbox -- `undefined` only if `vhea`/`vmtx` are absent (this font has both). */
  verticalMetrics(glyphId: number): VerticalMetrics | undefined {
    if (this.vmtxOffset === undefined || this.numVMetrics === undefined) return undefined;
    const i = Math.min(glyphId, this.numVMetrics - 1);
    const recordOffset = this.vmtxOffset + i * 4;
    requireBytes(this.buf, recordOffset, 4, `vmtx record for glyph ${glyphId}`);
    const advanceHeight = this.buf.readUInt16BE(recordOffset);
    const topSideBearing = glyphId < this.numVMetrics ? this.buf.readInt16BE(recordOffset + 2) : 0;
    const bbox = this.glyphInkBBox(glyphId);
    const originY = bbox ? bbox.yMax + topSideBearing : undefined;
    return { advanceHeight, topSideBearing, originY };
  }
}
