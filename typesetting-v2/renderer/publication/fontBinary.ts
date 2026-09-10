/**
 * Browser-safe, bounds-neutral byte view for the small SFNT readers used by
 * Publication. It deliberately mirrors only the handful of big-endian reads
 * those readers need; it is not a Node Buffer polyfill and installs no global.
 */
export interface FontBinary extends Uint8Array {
  readUInt16BE(offset: number): number;
  readInt16BE(offset: number): number;
  readUInt32BE(offset: number): number;
  toString(encoding?: string, start?: number, end?: number): string;
}

class BrowserFontBinary extends Uint8Array implements FontBinary {
  static fromBytes(bytes: Uint8Array): BrowserFontBinary {
    return bytes instanceof BrowserFontBinary ? bytes : new BrowserFontBinary(Uint8Array.from(bytes));
  }

  static fromBase64(base64: string): BrowserFontBinary {
    const binary = globalThis.atob(base64);
    const bytes = new BrowserFontBinary(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  private view(): DataView {
    return new DataView(this.buffer, this.byteOffset, this.byteLength);
  }

  readUInt16BE(offset: number): number {
    return this.view().getUint16(offset, false);
  }

  readInt16BE(offset: number): number {
    return this.view().getInt16(offset, false);
  }

  readUInt32BE(offset: number): number {
    return this.view().getUint32(offset, false);
  }

  toString(encoding?: string, start: number = 0, end: number = this.length): string {
    if (encoding && encoding !== "latin1") {
      throw new Error(`FontBinary: unsupported encoding ${encoding}`);
    }
    let value = "";
    for (let index = start; index < end; index += 1) value += String.fromCharCode(this[index]);
    return value;
  }
}

export const FontBinary = {
  fromBytes: BrowserFontBinary.fromBytes,
  fromBase64: BrowserFontBinary.fromBase64,
};

export function asFontBinary(bytes: Uint8Array): FontBinary {
  return BrowserFontBinary.fromBytes(bytes);
}
