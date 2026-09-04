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
const tgCode = code(tategaki);
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
  "4. FixedSlotLine container: overflow clip + a clip margin of one slot + one glyph (was bare `hidden`; slot term added for the issue-A hanging 。/、)",
  !!pageCard &&
    /overflow:\s*"clip"[\s\S]{0,160}overflowClipMargin:\s*`\$\{Math\.ceil\(slotExtentPx \+ fontSizePx\)\}px`/.test(pageCard),
);
check(
  "5. text-area container: same overflow clip + one-slot-plus-one-glyph clip margin (canonical pitch)",
  !!pageCard &&
    (() => {
      const m = pageCard.match(/const textContainerStyle: CSSProperties = \{[\s\S]*?\};/);
      return (
        !!m &&
        /overflow:\s*"clip"/.test(m[0]) &&
        /overflowClipMargin:\s*`\$\{Math\.ceil\(canonicalSlotExtentPx \+ fontSizePx\)\}px`/.test(m[0])
      );
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

/* ---------- 7. line-boundary SOURCE COVERAGE: pagination reserves the 一字下げ cell ---------- */

check(
  "7. one canonical 一字下げ predicate (paragraphNeedsAutoIndent) shared by pagination + renderer",
  !!tategaki &&
    /export function paragraphNeedsAutoIndent\(firstChar: string\): boolean/.test(tategaki) &&
    /export const AUTO_INDENT_CHAR = /.test(tategaki) &&
    !!pageCard &&
    /import \{[\s\S]*?paragraphNeedsAutoIndent[\s\S]*?\} from "@\/lib\/tategaki"/.test(pageCard) &&
    /return paragraphNeedsAutoIndent\(firstVisibleChar\(token\)\)/.test(pageCard),
);
check(
  "8. paginateTokensByLines shortens a paragraph-first line's budget by the indent cell",
  !!tategaki &&
    (() => {
      const fn = tgCode.slice(
        tgCode.indexOf("function paginateTokensByLines"),
        tgCode.indexOf("export function computePageSourceRanges"),
      );
      return (
        /const openLineBudget = \(firstChar: string\): number =>/.test(fn) &&
        /lineIndentCells = 1;/.test(fn) &&
        /const lineBudget = isFreshLine\s*\n?\s*\? openLineBudget\(value\[i\]\)/.test(fn) &&
        /const wasFilled = lineChars >= lineBudget;/.test(fn) &&
        /pendingParagraphStart = true;/.test(fn)
      );
    })(),
);
check(
  "8b. computePageSourceRanges applies the IDENTICAL indent budget (cursor↔page map can't drift)",
  !!tategaki &&
    (() => {
      const fn = tgCode.slice(tgCode.indexOf("export function computePageSourceRanges"));
      return (
        /const openLineBudget = \(firstChar: string\): number =>/.test(fn) &&
        /const wasFilled = lineChars >= lineBudget;/.test(fn) &&
        /lineIndentCells = 0;/.test(fn)
      );
    })(),
);
check(
  "8c. buildLineSlots no longer SILENTLY drops an over-range plain-text slot (dev console.error)",
  !!pageCard &&
    /\[TSP-029\] FixedSlotLine dropped/.test(pageCard) &&
    /pagination\/render grid mismatch/.test(pageCard) &&
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

/* ---------- 16. issue A — ぶら下げ組 (hanging 。/、), scoped and mirrored ---------- */

const pageSettingsPanel = read("src/components/PageSettingsPanel.tsx");

check(
  "16. isHangingPunctuation covers ONLY 。、，． — no brackets / ！？ / small kana / ー",
  !!tategaki &&
    /const HANGING_PUNCTUATION = new Set\("、。，．"\)/.test(tategaki) &&
    /export function isHangingPunctuation\(char: string\): boolean/.test(tategaki) &&
    !/HANGING_PUNCTUATION[\s\S]{0,40}[「『（【〈《〔］｝！？ー々]/.test(tategaki),
);
check(
  "17. paginateTokensByLines hangs a LONE trailing 。/、 on the full line (not a run of them), consuming it once",
  !!tategaki &&
    (() => {
      const fn = tgCode.slice(
        tgCode.indexOf("function paginateTokensByLines"),
        tgCode.indexOf("export function computePageSourceRanges"),
      );
      return (
        /isHangingPunctuation\(value\[j\]\)/.test(fn) &&
        /!isHangingPunctuation\(value\[j \+ 1\] \?\? ""\)/.test(fn) &&
        /placeToken\(\{ type: "text", value: value\[j\] \}\);/.test(fn) &&
        /i = j \+ 1;/.test(fn)
      );
    })(),
);
check(
  "18. computePageSourceRanges mirrors the hang branch — the 。/、 offset is marked on THIS page exactly once, cursor advances past it",
  !!tategaki &&
    (() => {
      const fn = tgCode.slice(tgCode.indexOf("export function computePageSourceRanges"));
      return (
        /isHangingPunctuation\(value\[j\]\)/.test(fn) &&
        /!isHangingPunctuation\(value\[j \+ 1\] \?\? ""\)/.test(fn) &&
        /mark\(start \+ i, start \+ j \+ 1\);/.test(fn) &&
        /i = j \+ 1;/.test(fn)
      );
    })(),
);
check(
  "19. buildLineSlots keeps exactly ONE over-capacity slot iff it is a lone hanging 。/、 (slotIndex === charsPerLine); ordinary letters still filtered",
  !!pageCard &&
    /const overCap = slots\.filter\(\(s\) => s\.slotIndex >= charsPerLine\)/.test(pageCard) &&
    /overCap\.length === 1 &&\s*\n?\s*overCap\[0\]\.slotIndex === charsPerLine &&\s*\n?\s*isHangingPunctuation\(overCap\[0\]\.text\)/.test(pageCard) &&
    /slot\.slotIndex < charsPerLine \|\| slot === hangingSlot/.test(pageCard) &&
    /hangingSlotIndex: hangingSlot \? hangingSlot\.slotIndex : null/.test(pageCard),
);
check(
  "20. the hanging slot is drawn on the SAME rounded ladder (slotTop) one cell past the grid, tagged data-hanging-punctuation",
  !!pageCard &&
    /data-hanging-punctuation=\{slot\.slotIndex === hangingSlotIndex \? "" : undefined\}/.test(pageCard) &&
    /top: slotTop\(slot\.slotIndex\)/.test(pageCard),
);
check(
  "21. hang branch never fires for an ordinary next char (guarded by isHangingPunctuation) and never zero-widths punctuation globally",
  !!pageCard &&
    !/letterSpacing:\s*`?-/.test(pcCode) &&
    !/width:\s*0[^-.\d]/.test(pcCode.replace(/border[^;]*/g, "")),
);

/* ---------- 22. issue C — Page Settings shows the EFFECTIVE grid, never an unreachable target ---------- */

check(
  "22. DEFAULT_PAGE_SETTINGS is self-consistent with its own geometry (39×15, not the old clamp-bait 40×17)",
  !!pageLayout &&
    /charsPerLine:\s*39,/.test(pageLayout) &&
    /linesPerColumn:\s*15,/.test(pageLayout) &&
    !/charsPerLine:\s*40,/.test(pageLayout) &&
    !/linesPerColumn:\s*17,/.test(pageLayout),
);
check(
  "23. PageSettingsPanel seeds / syncs / dirties the draft from the EFFECTIVE grid (layout.charsPerLine / linesPerColumn), so the input can't show 40 while Preview composes 39",
  !!pageSettingsPanel &&
    /const effectiveGrid = \(settings: PageSettings, layout: PageLayout\): PageSettings/.test(pageSettingsPanel) &&
    /charsPerLine: layout\.charsPerLine/.test(pageSettingsPanel) &&
    /linesPerColumn: layout\.linesPerColumn/.test(pageSettingsPanel) &&
    /const displaySettings = effectiveGrid\(settings, layout\)/.test(pageSettingsPanel) &&
    /toDraftValues\(effectiveGrid\(settings, layout\)\)/.test(pageSettingsPanel) &&
    /draft\[key\] !== String\(displaySettings\[key\]\)/.test(pageSettingsPanel),
);
check(
  "24. commitDraft stores the clamped effective grid AND surfaces a note when the user's value was auto-adjusted (never a silent clamp)",
  !!pageSettingsPanel &&
    /const committed: PageSettings = \{[\s\S]{0,160}charsPerLine: candidateLayout\.charsPerLine,[\s\S]{0,80}linesPerColumn: candidateLayout\.linesPerColumn,/.test(pageSettingsPanel) &&
    /const charsClamped = candidate\.charsPerLine > candidateLayout\.charsPerLine/.test(pageSettingsPanel) &&
    /setCommitNote\(/.test(pageSettingsPanel) &&
    /onChange\(committed\)/.test(pageSettingsPanel) &&
    !/onChange\(candidate\)/.test(pageSettingsPanel),
);

/* ---------- done ---------- */

console.log("");
if (failures === 0) console.log("All TSP-029 export-typesetting-integrity checks passed.");
else { console.log(`${failures} TSP-029 check(s) FAILED.`); process.exit(1); }
