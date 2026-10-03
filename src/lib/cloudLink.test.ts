import { describe, expect, it } from "vitest";
import { clearCloudLink, readCloudLink, writeCloudLink } from "./cloudLink";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
}

describe("CST-PORT-014 cloud link of a local work", () => {
  it("remembers, per local work, the cloud work it was saved to", () => {
    const storage = memoryStorage();
    expect(readCloudLink(1, storage)).toBeNull();
    writeCloudLink(1, "p1", storage);
    writeCloudLink(2, "p2", storage);
    expect(readCloudLink(1, storage)).toBe("p1");
    expect(readCloudLink(2, storage)).toBe("p2");
    clearCloudLink(1, storage);
    expect(readCloudLink(1, storage)).toBeNull();
    expect(readCloudLink(2, storage)).toBe("p2");
  });

  it("unavailable storage behaves as unlinked and never throws", () => {
    const broken = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
    };
    expect(readCloudLink(1, broken)).toBeNull();
    expect(() => writeCloudLink(1, "p1", broken)).not.toThrow();
    expect(() => clearCloudLink(1, broken)).not.toThrow();
    expect(readCloudLink(1, null)).toBeNull();
  });
});
