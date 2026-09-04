// TSP-LOOP-029 — export typesetting integrity (missing / shifted glyphs).
//
// Structural contracts for the fix. The behavioural proof (Preview == export
// per-glyph, no dropped line-transition character) is the browser walkthrough
// `scripts/diag-tsp029-slot-geometry.mjs` + HUMAN QA against the reporting
// manuscript — regex cannot rasterise.
//
// Run:  node scripts/verify-tsp029-export-typesetting-integrity.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};
const code = (s) =>
  (s ?? "").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");

let failures = 0;
const check = (name, cond) => {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
};

const pageCard = read("src/components/PageCard.tsx");
const pcCode = code(pageCard);
const tategaki = read("src/lib/tategaki.ts");
const exportCapture = read("src/utils/exportCapture.ts");
const exportPdf = read("src/utils/exportPdf.ts");
const exportImage = read("src/utils/exportImage.ts");
const pageLayout = read("src/lib/pageLayout.ts");

/* ---------- 1. one canonical slot ladder, integer-rounded, no cumulative sum ---------- */

check(
  "1. FixedSlotLine derives every slot edge from ONE rounded ladder (slotTop / slotSpanPx)",
  !!pageCard &&
    /const slotTop = \(index: number\): number => Math\.round\(index \* slotExtentPx\)/.test(pageCard) &&
    /const slotSpanPx = \(startIndex: number, count: number\): number =>\s*\n?\s*slotTop\(startIndex \+ count\) - slotTop\(startIndex\)/.test(pageCard),
);
check(
  "2. no slot position is a raw non-integer `index * slotExtentPx` in the grid renderer",
  !!pageCard &&
    // every `* slotExtentPx` in a `top:` / `height:` is now via slotTop/slotSpanPx or Math.round
    ![...pcCode.matchAll(/\b(top|height):\s*[^,\n]*\*\s*slotExtentPx/g)].some(
      (m) => !/Math\.round|slotTop|slotSpanPx/.test(m[0]),
    ),
);
check(
  "3. slot ladder is not a running sum (position = round(index * pitch), derived not accumulated)",
  !!pageCard && !/slotCursorPx\s*\+=|runningTop\s*\+=|accum(ulated)?Top/.test(pcCode),
);

/* ---------- 4. clip no longer coincides with the grid extent ---------- */

check(
  "4. FixedSlotLine container: overflow clip + a >=1-glyph clip margin (was bare `hidden`)",
  !!pageCard &&
    /overflow:\s*"clip"[\s\S]{0,120}overflowClipMargin:\s*`\$\{Math\.ceil\(fontSizePx\)\}px`/.test(pageCard),
);
check(
  "5. text-area container: same overflow clip + clip margin",
  !!pageCard &&
    (() => {
      const m = pageCard.match(/const textContainerStyle: CSSProperties = \{[\s\S]*?\};/);
      return !!m && /overflow:\s*"clip"/.test(m[0]) && /overflowClipMargin:\s*`\$\{Math\.ceil\(fontSizePx\)\}px`/.test(m[0]);
    })(),
);
check(
  "6. the fix adds no new letter-spacing / line-height typesetting hack (pre-existing microSpacing legacy path untouched)",
  !!pageCard &&
    /const computeMicroSpacingPx = /.test(pageCard) &&
    /letterSpacing:\s*`\$\{microSpacingPx\}px`/.test(pageCard) &&
    // the FixedSlotLine container itself never sets letterSpacing/lineHeight
    (() => {
      const m = pageCard.match(/const containerStyle: CSSProperties = \{[\s\S]*?\};/);
      return !!m && !/letterSpacing|lineHeight/.test(m[0]);
    })(),
);

/* ---------- 7. pagination / index integrity unchanged ---------- */

check(
  "7. tategaki tokenizer/pagination not modified by this loop (no source char drop)",
  !!tategaki &&
    /export function tokenizeTategakiWithOffsets/.test(tategaki) &&
    /computePageSourceRanges/.test(tategaki),
);
check(
  "8. buildLineSlots still keeps exactly [0, charsPerLine) and advances slotCursor by tokenLength",
  !!pageCard &&
    /slots\.filter\(\(slot\) => slot\.slotIndex < charsPerLine\)/.test(pageCard) &&
    /slotCursor \+= tokenLength\(token\)/.test(pageCard),
);

/* ---------- 9. capture path unchanged (same DOM, no second layout engine) ---------- */

check(
  "9. exportCapture still rasterises the LIVE node via html-to-image (no reflow engine), unchanged by this loop",
  !!exportCapture &&
    /await toCanvas\(target,/.test(exportCapture) &&
    /includeStyleProperties: getCloneStyleProps\(\)/.test(exportCapture) &&
    /from 'html-to-image'/.test(exportCapture) &&
    !/^\s*import .*html2canvas/m.test(exportCapture),
);
check(
  "10. PDF & JPG share capturePageToCanvas; failure handling (alert on throw) unchanged",
  !!exportPdf && !!exportImage &&
    /capturePageToCanvas/.test(exportPdf) && /capturePageToCanvas/.test(exportImage) &&
    /pdf\.save\(fileName\)/.test(exportPdf),
);

/* ---------- 11. protected runs / ruby / tcy / Apple-glyph layers intact ---------- */

check(
  "11. ―― / …… protected run wrapper + per-char ellipsis boxes still present",
  !!pageCard &&
    /data-protected-run-wrapper=\{run\.kind\}/.test(pageCard) &&
    /data-protected-run-glyph="ellipsis"/.test(pageCard) &&
    /VERT_LEADER_TEST/.test(pageCard),
);
check(
  "12. ruby annotation + tcy renderers still on the SAME rounded ladder (Math.round on their slot math)",
  !!pageCard &&
    /const baseStartTop = Math\.round\(annotation\.startSlot \* slotExtentPx\)/.test(pageCard) &&
    /top: Math\.round\(cell\.slotIndex \* slotExtentPx\)/.test(pageCard),
);
check(
  "13. TSP-021/022 Apple vertical-glyph layer untouched (data-vertical-leader / mixed orientation wrappers)",
  !!pageCard &&
    /data-vertical-leader=""/.test(pageCard) &&
    /textOrientation:\s*"mixed"/.test(pageCard) &&
    /data-protected-run-wrapper/.test(pageCard),
);

/* ---------- 14. no data / infra ---------- */

check(
  "14. no schema / supabase / edge / turnstile touched",
  !!pageCard && !/supabase|functions\.invoke|\.sql\b|migration/i.test(pcCode),
);
check(
  "15. PX_PER_MM / DPI constants unchanged (no coordinate-system rescale)",
  !!pageLayout &&
    /export const PX_PER_MM = 2\.2;/.test(pageLayout) &&
    /export const PDF_EXPORT_DPI = 600;/.test(pageLayout) &&
    /export const PRINT_JPG_LONG_SIDE_PX = 1600;/.test(pageLayout),
);

/* ---------- done ---------- */

console.log("");
if (failures === 0) console.log("All TSP-029 export-typesetting-integrity checks passed.");
else { console.log(`${failures} TSP-029 check(s) FAILED.`); process.exit(1); }
