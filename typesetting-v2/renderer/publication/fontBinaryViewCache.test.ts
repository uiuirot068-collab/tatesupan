import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FontBinary } from "./fontBinary";

/**
 * TateSpun Phase 7: FontBinary caches ONE DataView per instance instead of
 * allocating one per read. Every read must still equal a fresh DataView read
 * of the same bytes — for the whole font, and for a sub-view with a non-zero
 * byteOffset (subarray/slice share or copy the buffer).
 */
const fontBytes = readFileSync(resolve("public/fonts/ShipporiMincho-Regular.ttf"));

function reference(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

describe("FontBinary DataView cache", () => {
  const font = FontBinary.fromBase64(fontBytes.toString("base64"));

  it("reads equal fresh DataView reads across the whole font", () => {
    const view = reference(font);
    for (let offset = 0; offset + 4 <= font.length; offset += 4099) {
      expect(font.readUInt16BE(offset)).toBe(view.getUint16(offset, false));
      expect(font.readInt16BE(offset)).toBe(view.getInt16(offset, false));
      expect(font.readUInt32BE(offset)).toBe(view.getUint32(offset, false));
    }
  });

  it("a sub-view reads relative to its own byteOffset, not the parent's cached view", () => {
    // Warm the parent's cache first, then take views of the same buffer.
    expect(font.readUInt32BE(0)).toBe(reference(font).getUint32(0, false));
    const sub = font.subarray(1000, 5000) as unknown as FontBinary;
    const copy = font.slice(2000, 6000) as unknown as FontBinary;
    for (const part of [sub, copy]) {
      const view = reference(part);
      for (let offset = 0; offset + 4 <= part.length; offset += 97) {
        expect(part.readUInt16BE(offset)).toBe(view.getUint16(offset, false));
        expect(part.readUInt32BE(offset)).toBe(view.getUint32(offset, false));
      }
    }
  });

  it("fromBytes of the same bytes reads identically", () => {
    const fromBytes = FontBinary.fromBytes(new Uint8Array(fontBytes));
    for (let offset = 0; offset + 4 <= fromBytes.length; offset += 50_021) {
      expect(fromBytes.readUInt32BE(offset)).toBe(font.readUInt32BE(offset));
    }
  });
});
