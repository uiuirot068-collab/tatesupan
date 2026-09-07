// P3-O08 — OpenType vertical GPOS audit (Human Visual QA HOLD round 10):
// the audit's own ground-truth evidence, against the REAL committed
// Shippori Mincho asset. `console.log` blocks are deliberate raw
// evidence, transcribed into qa/evidence/P3_O08_YAKUMONO_GPOS.md.

import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { auditGpos, hasGposTable } from "./gposReader";
import { createGlyphIdLookup } from "./fontCapability";
import { auditGsub } from "./gsubReader";

const FONT_PATH = join(__dirname, "..", "..", "qa", "publication", "p3-o08", "font-poc", "fonts", "ShipporiMincho-Regular.ttf");

function loadFont(): Buffer {
  return readFileSync(FONT_PATH);
}

describe("gposReader -- GPOS table presence + vertical feature detection (real Shippori Mincho asset)", () => {
  it("detects whether GPOS is present at all", () => {
    const buf = loadFont();
    const present = hasGposTable(buf);
    // eslint-disable-next-line no-console
    console.log("HAS_GPOS", present);
    expect(typeof present).toBe("boolean");
  });

  it("parses GPOS deterministically -- same font, same audit result twice", () => {
    const buf = loadFont();
    const a = auditGpos(buf);
    const b = auditGpos(buf);
    expect(a.hasGpos).toBe(b.hasGpos);
    expect(a.featureTagsPresent).toEqual(b.featureTagsPresent);
    expect(a.vhal.present).toBe(b.vhal.present);
  });

  it("records every feature tag present, and the resolved state of vhal/vchw/valt/vpal/vkrn/halt/chws/palt/kern", () => {
    const buf = loadFont();
    const audit = auditGpos(buf);
    // eslint-disable-next-line no-console
    console.log(
      "GPOS_AUDIT",
      JSON.stringify(
        {
          hasGpos: audit.hasGpos,
          featureTagsPresent: audit.featureTagsPresent,
          vhal: { present: audit.vhal.present, lookupTypesUsed: audit.vhal.lookupTypesUsed, adjustmentCount: audit.vhal.singleAdjustments.size },
          vchw: { present: audit.vchw.present, lookupTypesUsed: audit.vchw.lookupTypesUsed, adjustmentCount: audit.vchw.singleAdjustments.size },
          valt: { present: audit.valt.present, lookupTypesUsed: audit.valt.lookupTypesUsed, adjustmentCount: audit.valt.singleAdjustments.size },
          vpal: { present: audit.vpal.present, lookupTypesUsed: audit.vpal.lookupTypesUsed, adjustmentCount: audit.vpal.singleAdjustments.size },
          vkrn: { present: audit.vkrn.present, lookupTypesUsed: audit.vkrn.lookupTypesUsed, adjustmentCount: audit.vkrn.singleAdjustments.size },
          halt: { present: audit.halt.present, lookupTypesUsed: audit.halt.lookupTypesUsed, adjustmentCount: audit.halt.singleAdjustments.size },
          chws: { present: audit.chws.present, lookupTypesUsed: audit.chws.lookupTypesUsed, adjustmentCount: audit.chws.singleAdjustments.size },
          palt: { present: audit.palt.present, lookupTypesUsed: audit.palt.lookupTypesUsed, adjustmentCount: audit.palt.singleAdjustments.size },
          kern: { present: audit.kern.present, lookupTypesUsed: audit.kern.lookupTypesUsed, adjustmentCount: audit.kern.singleAdjustments.size },
        },
        null,
        2
      )
    );
    expect(audit.hasGpos).toBe(true);
  });

  it("fails structurally on a malformed GPOS rather than silently reporting no adjustment", () => {
    const buf = loadFont();
    let gposOffset = -1;
    const numTables = buf.readUInt16BE(4);
    for (let i = 0; i < numTables; i++) {
      const entryOffset = 12 + i * 16;
      const tag = buf.toString("latin1", entryOffset, entryOffset + 4);
      if (tag === "GPOS") gposOffset = buf.readUInt32BE(entryOffset + 8);
    }
    expect(gposOffset).toBeGreaterThan(0);
    const corrupted = Buffer.from(buf);
    corrupted.writeUInt16BE(0xffff, gposOffset + 4);
    expect(() => auditGpos(corrupted)).toThrow();
  });
});

interface CharSpec {
  label: string;
  char: string;
  codePoint: number;
}

const TARGET_CHARS: CharSpec[] = [
  { label: "period", char: "。", codePoint: 0x3002 },
  { label: "closing-corner-bracket", char: "」", codePoint: 0x300d },
  { label: "comma", char: "、", codePoint: 0x3001 },
  { label: "opening-corner-bracket", char: "「", codePoint: 0x300c },
  { label: "closing-paren", char: "）", codePoint: 0xff09 },
  { label: "opening-paren", char: "（", codePoint: 0xff08 },
  { label: "ellipsis", char: "…", codePoint: 0x2026 },
  { label: "dash", char: "―", codePoint: 0x2015 },
  { label: "normal-kana-control", char: "た", codePoint: 0x305f },
];

describe("gposReader -- real vhal/vchw single-adjustment values for the post-GSUB vertical glyph IDs", () => {
  it("resolves post-GSUB vert glyph IDs, then looks up vhal/vchw adjustments for each -- using the CORRECT (post-substitution) glyph ID, not the pre-GSUB source glyph", () => {
    const buf = loadFont();
    const glyphIdFor = createGlyphIdLookup(buf);
    const gsub = auditGsub(buf);
    const gpos = auditGpos(buf);

    const evidence = TARGET_CHARS.map((spec) => {
      const sourceGlyphId = glyphIdFor(spec.codePoint);
      const vertGlyphId = sourceGlyphId !== undefined ? (gsub.vert.substitutionMap.get(sourceGlyphId) ?? gsub.vrt2.substitutionMap.get(sourceGlyphId)) : undefined;
      const glyphForGpos = vertGlyphId ?? sourceGlyphId;
      const vhalAdjustment = glyphForGpos !== undefined ? gpos.vhal.singleAdjustments.get(glyphForGpos) : undefined;
      const vchwAdjustment = glyphForGpos !== undefined ? gpos.vchw.singleAdjustments.get(glyphForGpos) : undefined;
      // vhal/vchw are ABSENT in this font (confirmed above) -- vpal IS
      // present (446 adjustments) and is the only real vertical
      // positioning feature this font ships. Check it for both the
      // post-GSUB vert glyph AND the pre-GSUB source glyph.
      const vpalOnVertGlyph = glyphForGpos !== undefined ? gpos.vpal.singleAdjustments.get(glyphForGpos) : undefined;
      const vpalOnSourceGlyph = sourceGlyphId !== undefined ? gpos.vpal.singleAdjustments.get(sourceGlyphId) : undefined;
      const vhalOnSource = sourceGlyphId !== undefined ? gpos.vhal.singleAdjustments.get(sourceGlyphId) : undefined;
      const vchwOnSource = sourceGlyphId !== undefined ? gpos.vchw.singleAdjustments.get(sourceGlyphId) : undefined;
      return {
        label: spec.label,
        codePoint: "U+" + spec.codePoint.toString(16).toUpperCase().padStart(4, "0"),
        sourceGlyphId,
        vertGlyphId,
        vhalOnVertGlyph: vhalAdjustment,
        vchwOnVertGlyph: vchwAdjustment,
        vhalOnSourceGlyph: vhalOnSource,
        vchwOnSourceGlyph: vchwOnSource,
        vpalOnVertGlyph,
        vpalOnSourceGlyph,
      };
    });

    // eslint-disable-next-line no-console
    console.log("VHAL_VCHW_EVIDENCE", JSON.stringify(evidence, null, 2));

    for (const row of evidence) expect(row.sourceGlyphId, `no glyph for ${row.label}`).toBeDefined();
  });

  it("determinism: resolving the same glyph's vhal adjustment twice yields the identical value", () => {
    const buf = loadFont();
    const glyphIdFor = createGlyphIdLookup(buf);
    const gsub = auditGsub(buf);
    const audit1 = auditGpos(buf);
    const audit2 = auditGpos(buf);
    const sourceGlyphId = glyphIdFor(0x3002)!; // 。
    const vertGlyphId = gsub.vert.substitutionMap.get(sourceGlyphId) ?? sourceGlyphId;
    expect(audit1.vhal.singleAdjustments.get(vertGlyphId)).toEqual(audit2.vhal.singleAdjustments.get(vertGlyphId));
  });
});
