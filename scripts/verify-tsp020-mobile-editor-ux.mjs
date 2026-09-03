// TSP-LOOP-020 — mobile editor UX hotfix gate.
//
// Focused regression checks for the phone editor emergency fix:
//  - the phone gets a scrolling document + a sticky nav (never a trapped
//    nested scroller / "touch the outer frame to scroll");
//  - the manuscript area is clearly identified as 本文 and reachable;
//  - the preview initially FITS the phone width (no desktop-sized canvas
//    cropped past the right edge) while pan/zoom is preserved;
//  - comfortable safe-area-aware bottom breathing room;
//  - no global horizontal overflow from fixed pixel widths in the editor
//    surface; desktop output (PDF/JPG) scale is untouched.
//
// Run:  node scripts/verify-tsp020-mobile-editor-ux.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => {
  const p = path.join(repoRoot, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
};

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${name}`);
  if (!cond) failures += 1;
}

const editor = read("src/components/TategakiEditor.tsx");
const editorPane = read("src/components/EditorPane.tsx");
const preview = read("src/components/PreviewPane.tsx");
const nav = read("src/components/MobileEditorNav.tsx");
const globals = read("src/app/globals.css");
const layout = read("src/app/layout.tsx");
const narrowHook = read("src/hooks/useIsNarrowViewport.ts");

/* ---------------- 1. scrolling document + sticky nav (escape is always possible) ---------------- */

check(
  "1. phone editor shell is a min-h-[100dvh] scrolling block; the viewport lock is md-only",
  !!editor &&
    /data-editor-shell/.test(editor) &&
    /min-h-\[100dvh\]/.test(editor) &&
    /md:h-screen/.test(editor) &&
    /md:overflow-hidden/.test(editor)
);
check(
  "1b. globals.css restores document scroll for the editor shell ONLY at <=767px",
  !!globals &&
    /@media\s*\(max-width:\s*767px\)/.test(globals) &&
    /:has\(\[data-editor-shell\]\)/.test(globals) &&
    /overflow-y:\s*auto\s*!important/.test(globals)
);
check(
  "1c. the phone nav is sticky (top-0) so it survives any inner scroller owning a gesture",
  !!nav && /\bsticky\b/.test(nav) && /\btop-0\b/.test(nav) && /z-40/.test(nav)
);
check(
  "1d. preview's inner scroll surface uses overscroll-contain (a trapped swipe can't yank the doc)",
  !!preview && /overscroll-contain/.test(preview)
);

/* ---------------- 2. "continue writing" is obvious ---------------- */

check(
  "2. phone-only manuscript identity block: ✏️ 本文を書く + helper line, md:hidden",
  !!editorPane &&
    /✏️\s*本文を書く/.test(editorPane) &&
    /縦書きプレビューに反映されます/.test(editorPane) &&
    /md:hidden/.test(editorPane)
);
check(
  "2b. an explicit「本文を書く」action scrolls to + focuses the textarea (focus only on this tap)",
  !!editorPane &&
    /const goToManuscript = \(\) => \{/.test(editorPane) &&
    /\.scrollIntoView\(/.test(editorPane) &&
    /\.focus\(\{ preventScroll: true \}\)/.test(editorPane)
);
check(
  "2c. nav's 本文 action scrolls to the manuscript section (id=tsp-manuscript) without stealing focus",
  !!editor &&
    /id="tsp-manuscript"/.test(editor) &&
    /scrollMobileTo\("tsp-manuscript"\)/.test(editor) &&
    !/showEditorView[\s\S]{0,160}\.focus\(/.test(editor)
);

/* ---------------- 3. preview fits the phone width; output scale untouched ---------------- */

check(
  "3. preview has a phone width-fit path keyed off a narrow-viewport store",
  !!preview &&
    /useIsNarrowViewport/.test(preview) &&
    /narrowFitScale/.test(preview) &&
    /naturalContentSize\.width/.test(preview)
);
check(
  "3b. narrow fit is a pure derivation — no zoom-reset setState-in-effect",
  !!preview &&
    /Math\.max\(zoomScale, 1\)/.test(preview) &&
    !/useEffect\([\s\S]{0,120}setZoomScale/.test(preview)
);
check(
  "3c. narrow-viewport store is SSR-safe (getServerSnapshot returns false)",
  !!narrowHook &&
    /useSyncExternalStore/.test(narrowHook) &&
    /getServerSnapshot/.test(narrowHook)
);
check(
  "3d. pan/zoom preserved — zoom controls + scroll/pan container still present",
  !!preview &&
    /const zoomIn = /.test(preview) &&
    /const zoomOut = /.test(preview) &&
    /overflow-y-scroll overflow-x-auto/.test(preview)
);
check(
  "3e. touch-action pan-x pan-y on the preview surface (deliberate move; native pinch-zoom kept)",
  !!preview && /touchAction:\s*"pan-x pan-y"/.test(preview)
);
check(
  "3f. export / PDF / JPG scale is NOT driven by the preview viewing scale",
  !!preview &&
    /data-export-scale-root/.test(preview) &&
    // the export capture path strips the transform; presentationScale must not
    // leak into export geometry constants
    !/PDF_EXPORT_DPI\s*[*/]\s*(presentationScale|narrowFitScale|effectiveFitScale)/.test(preview)
);
check(
  '3g. beginner-facing UI never says "パン"',
  !!preview && !/パン/.test(preview)
);

/* ---------------- 4. bottom breathing room, safe-area aware ---------------- */

check(
  "4. shell bottom padding = env(safe-area-inset-bottom) + comfortable mobile space",
  !!editor && /pb-\[calc\(env\(safe-area-inset-bottom\)\s*\+\s*\d+(?:\.\d+)?rem\)\]/.test(editor)
);
check(
  "4b. viewport-fit:cover declared (safe-area insets resolve to real values)",
  !!layout && /viewportFit:\s*"cover"/.test(layout)
);
check(
  "4c. desktop whitespace not bloated — bottom padding stays md:pb-10",
  !!editor && /md:pb-10/.test(editor)
);

/* ---------------- 5. no global horizontal overflow from fixed widths ---------------- */

check(
  "5. phone horizontal overflow is contained: body overflow-x:clip (globals) + fixed-height preview clips x",
  !!globals &&
    /:has\(\[data-editor-shell\]\)[\s\S]*?overflow-x:\s*clip\s*!important/.test(globals) &&
    /--preview-w[\s\S]{0,900}?max-md:overflow-hidden/.test(editor) &&
    /--preview-w[\s\S]{0,900}?h-\[calc\(100dvh/.test(editor)
);
check(
  "5b. the phone editor shell is width-safe: w-screen / 100vw is md-only",
  !!editor &&
    /min-h-\[100dvh\][\s\S]{0,200}md:w-screen/.test(editor) &&
    !/\bw-screen\b[^"]*min-h-\[100dvh\]/.test(editor)
);

/* ---------------- done ---------------- */

console.log("");
if (failures === 0) {
  console.log("All TSP-020 mobile-editor-UX checks passed.");
} else {
  console.log(`${failures} TSP-020 mobile-editor-UX check(s) FAILED.`);
  process.exit(1);
}
