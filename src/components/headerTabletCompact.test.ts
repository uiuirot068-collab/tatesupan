import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Source contracts for the tablet / narrow-desktop header compaction. The pixel proof
// (header height, one controls row, no overlap/clipping per viewport) is the real-browser
// tests/e2e/headerTabletDensity.e2e.mjs.
const header = readFileSync(resolve("src/components/Header.tsx"), "utf8");
const RANGE = "md:max-[905px]:";

describe("Header tablet compaction (editor variant, 768-904px)", () => {
  it("every compaction utility lives behind the md..905px range variant only", () => {
    // no unconditional / sm: / lg: padding or gap change was introduced for this
    expect(header).toContain(
      "const TABLET_COMPACT_SHELL = 'md:max-[905px]:my-1 md:max-[905px]:py-1.5 md:max-[905px]:gap-y-1';"
    );
    expect(header.match(/md:max-\[(\d+)px\]:/g)?.every((token) => token === RANGE)).toBe(true);
  });

  it("the shell compaction applies to the editor variant, never to the home header", () => {
    expect(header).toContain(`\${isHome ? 'min-[780px]:flex-nowrap min-[780px]:gap-x-6' : TABLET_COMPACT_SHELL}`);
  });

  it("tightens only horizontal padding/gap on the controls (tap heights stay py-1.5 / sm:py-1.5)", () => {
    const used = new Set(Array.from(header.matchAll(/md:max-\[905px\]:([a-z]+(?:-[xy])?-[0-9.]+)/g), (m) => m[1]));
    expect([...used].sort()).toEqual(["gap-x-3", "gap-y-1", "my-1", "px-2.5", "px-3", "py-1.5"]);
    // the vertical size of every button is untouched: no py-* variant other than the shell's own py-1.5
    expect(header.match(/md:max-\[905px\]:py-[0-9.]+/g)).toEqual([`${RANGE}py-1.5`]);
    expect(header).not.toMatch(/md:max-\[905px\]:(text-|h-|min-h-|w-|hidden)/);
  });

  it("keeps every control, label and product copy (nothing removed or renamed)", () => {
    for (const copy of ["集中モード", "通常に戻す", "クラウドに保存", "保存作品一覧", "ログイン / 会員登録", "ログアウト", "画面モード", "TateSpun (タテスパン)", "縦書きWebエディタ", "← 作品一覧"]) {
      expect(header, copy).toContain(copy);
    }
    expect(header).not.toMatch(/md:max-\[905px\]:(hidden|sr-only)/);
  });
});
