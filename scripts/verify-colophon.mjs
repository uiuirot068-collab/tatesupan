// TSP-LOOP-005 regression gate — horizontal colophon page (奥付).
//
// The colophon is an INDEPENDENT horizontal-tb page appended after all body
// pages. It never touches `content`, body pagination, page-break positions,
// charsPerLine, or source mapping. This checks the pure data model
// (src/lib/colophon.ts) plus a few source-level invariants for the renderer
// and Help. Run with:
//   node scripts/verify-colophon.mjs
// Uses only Node's built-in TS type-stripping (Node >=23.6) + node:assert,
// matching the other verify-*.mjs scripts (no test framework in this repo).
//
// RED check: several assertions below fail on a broken implementation — most
// directly, "empty fields array falls back to defaults" and "template switch
// preserves fields". A regression that drops user data on template change, or
// leaves the field list empty and unrecoverable, turns this script RED.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  COLOPHON_TEMPLATE_IDS,
  COLOPHON_TEMPLATE_LABELS,
  DEFAULT_COLOPHON_PLACEMENT,
  addColophonField,
  colophonRenderModel,
  createDefaultColophonSettings,
  createGuideColophonSettings,
  defaultColophonFields,
  moveColophonField,
  normalizeColophonPagePosition,
  normalizeColophonPlacement,
  normalizeColophonSettings,
  removeColophonField,
  resolveColophonInsertion,
  resolveColophonNombre,
  updateColophonField,
  withColophonDefaults,
} from "../src/lib/colophon.ts";
// NOTE: pageLayout.ts pulls in `@/constants/*` which Node's bare loader can't
// resolve (same reason the other verify-*.mjs scripts never import it), so its
// wiring is checked via a source scan below instead of importing it.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let failures = 0;
function check(name, cond) {
  if (cond) {
    console.log(`PASS: ${name}`);
  } else {
    console.log(`FAIL: ${name}`);
    failures += 1;
  }
}
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ---- defaults / OFF ---- */
const def = createDefaultColophonSettings();
check("default colophon is OFF", def.enabled === false);
check("default templateId is standard", def.templateId === "standard");
check("default fontFamily is 'same as body' (empty)", def.fontFamily === "");
check("default freeText is empty", def.freeText === "");
check(
  "default fields include stable ids 書名/著者名 etc.",
  def.fields.some((f) => f.id === "title" && f.label === "書名") &&
    def.fields.some((f) => f.id === "author") &&
    def.fields.length >= 6
);
check("seed title flows into the 書名 field value", createDefaultColophonSettings("春の夜").fields[0].value === "春の夜");

/* ---- backward compatibility / old documents ---- */
check("old document (no colophon) → valid default, OFF", normalizeColophonSettings(undefined).enabled === false);
check("null / non-object → default", deepEqual(normalizeColophonSettings(null), createDefaultColophonSettings()));
check("empty object → default", deepEqual(normalizeColophonSettings({}), createDefaultColophonSettings()));
{
  const pl = fs.readFileSync(path.join(repoRoot, "src/lib/pageLayout.ts"), "utf8");
  check(
    "pageLayout.ts wires colophon into PageSettings + DEFAULT_PAGE_SETTINGS",
    /createDefaultColophonSettings/.test(pl) &&
      /colophon:\s*ColophonSettings/.test(pl) &&
      /colophon:\s*createDefaultColophonSettings\(\)/.test(pl)
  );
}
check(
  "withColophonDefaults keeps other PageSettings fields and adds colophon",
  (() => {
    const merged = withColophonDefaults({ paperSize: "A5", colophon: undefined });
    return merged.paperSize === "A5" && merged.colophon.enabled === false;
  })()
);

/* ---- partial merge / migration ---- */
{
  const s = normalizeColophonSettings({ enabled: true, templateId: "center", freeText: "hi" });
  check("partial merge: enabled/template/freeText applied", s.enabled && s.templateId === "center" && s.freeText === "hi");
  check("partial merge: missing fields fall back to defaults", s.fields.length === defaultColophonFields().length);
}
check("invalid templateId falls back to standard", normalizeColophonSettings({ templateId: "bogus" }).templateId === "standard");
check(
  "malformed field entries are dropped, duplicate ids re-keyed",
  (() => {
    const s = normalizeColophonSettings({ fields: [42, { id: "a", label: "L", value: "V" }, { id: "a", label: "L2", value: "V2" }] });
    const ids = s.fields.map((f) => f.id);
    return s.fields.length === 2 && new Set(ids).size === 2;
  })()
);
// RED anchor: a broken normalize that leaves fields:[] as-is fails here.
check("empty fields array falls back to defaults (never unrecoverable)", normalizeColophonSettings({ fields: [] }).fields.length === defaultColophonFields().length);

/* ---- 4 templates ---- */
check("exactly 4 template ids", COLOPHON_TEMPLATE_IDS.length === 4);
check(
  "template ids are standard/center/minimal/classic",
  deepEqual([...COLOPHON_TEMPLATE_IDS], ["standard", "center", "minimal", "classic"])
);
check(
  "every template has a Japanese label",
  COLOPHON_TEMPLATE_IDS.every((id) => typeof COLOPHON_TEMPLATE_LABELS[id] === "string" && COLOPHON_TEMPLATE_LABELS[id].length > 0)
);

/* ---- template switch preserves data (RED anchor) ---- */
{
  let s = normalizeColophonSettings({
    enabled: true,
    fields: [
      { id: "title", label: "作品名", value: "春の夜の話", visible: true },
      { id: "x", label: "Special Thanks", value: "みんな", visible: false },
    ],
    freeText: "無断転載禁止",
    fontFamily: "'Noto Sans JP', sans-serif",
  });
  const before = JSON.stringify(s.fields);
  for (const id of COLOPHON_TEMPLATE_IDS) {
    s = { ...s, templateId: id };
    check(`template switch → ${id} keeps fields verbatim`, JSON.stringify(s.fields) === before);
  }
  check("template switch keeps freeText", s.freeText === "無断転載禁止");
  check("template switch keeps font selection", s.fontFamily === "'Noto Sans JP', sans-serif");
  check("edited label '書名'→'作品名' survives", s.fields[0].label === "作品名");
}

/* ---- field operations ---- */
{
  const base = defaultColophonFields();
  const relabeled = updateColophonField(base, "title", { label: "作品名" });
  check("updateColophonField changes only the target label", relabeled[0].label === "作品名" && relabeled[1].label === base[1].label);
  check("updateColophonField cannot change id", relabeled[0].id === "title");
  const revalued = updateColophonField(base, "author", { value: "夏織" });
  check("updateColophonField edits value", revalued.find((f) => f.id === "author").value === "夏織");
  const hidden = updateColophonField(base, "contact", { visible: false });
  check("visible toggle works and is isolated", hidden.find((f) => f.id === "contact").visible === false && hidden[0].visible === true);

  const added = addColophonField(base, { label: "装丁" });
  check("addColophonField appends one field", added.length === base.length + 1 && added[added.length - 1].label === "装丁");
  check("addColophonField gives a unique id", new Set(added.map((f) => f.id)).size === added.length);
  check("addColophonField defaults visible=true", added[added.length - 1].visible === true);

  const removed = removeColophonField(added, added[added.length - 1].id);
  check("removeColophonField drops exactly one, others intact", deepEqual(removed, base));

  const movedUp = moveColophonField(base, "author", -1);
  check("moveColophonField -1 swaps with previous", movedUp[0].id === "author" && movedUp[1].id === "title");
  const movedDown = moveColophonField(base, "title", 1);
  check("moveColophonField +1 swaps with next", movedDown[0].id === "author" && movedDown[1].id === "title");
  check("moveColophonField at top edge is a no-op", deepEqual(moveColophonField(base, "title", -1), base));
  check("moveColophonField at bottom edge is a no-op", deepEqual(moveColophonField(base, base[base.length - 1].id, 1), base));
  check("moveColophonField unknown id is a no-op", deepEqual(moveColophonField(base, "nope", 1), base));

  check("all field ops return new arrays (no mutation)", base.length === defaultColophonFields().length && base[0].label === "書名");
}

/* ---- save / reload round-trip ---- */
{
  let s = normalizeColophonSettings({ enabled: true, templateId: "classic" });
  s = { ...s, fields: addColophonField(s.fields, { label: "使用フォント", value: "しっぽり明朝" }) };
  s = { ...s, fields: moveColophonField(s.fields, "date", -1), freeText: "SNS: @example" };
  s = {
    ...s,
    pagePosition: { mode: "after-body-page", afterBodyPage: 237 },
    placement: { horizontal: "right", vertical: "bottom", respectGutter: false, respectVerticalMargins: false },
  };
  const reloaded = normalizeColophonSettings(JSON.parse(JSON.stringify(s)));
  check(
    "save→reload preserves everything (enabled/template/fields/order/visible/font/freeText/pagePosition/placement)",
    deepEqual(reloaded, s)
  );
}

/* ---- §2-4: PAGE POSITION data + out-of-range safety ---- */
{
  check("default pagePosition is dynamic end", createDefaultColophonSettings().pagePosition.mode === "end");
  check("default placement is center/center + respect both", deepEqual(createDefaultColophonSettings().placement, DEFAULT_COLOPHON_PLACEMENT));

  // normalize
  check("bad pagePosition → end", normalizeColophonPagePosition({ mode: "nope" }).mode === "end");
  check("after-body-page < 1 → end", normalizeColophonPagePosition({ mode: "after-body-page", afterBodyPage: 0 }).mode === "end");
  check(
    "after-body-page integer preserved",
    deepEqual(normalizeColophonPagePosition({ mode: "after-body-page", afterBodyPage: 20 }), { mode: "after-body-page", afterBodyPage: 20 })
  );
  check("non-integer after-body-page floored", normalizeColophonPagePosition({ mode: "after-body-page", afterBodyPage: 20.9 }).afterBodyPage === 20);
  check("bad placement → default", deepEqual(normalizeColophonPlacement("x"), DEFAULT_COLOPHON_PLACEMENT));
  check(
    "placement fields fall back individually",
    deepEqual(normalizeColophonPlacement({ horizontal: "left", vertical: "bogus", respectGutter: false }), {
      horizontal: "left",
      vertical: "center",
      respectGutter: false,
      respectVerticalMargins: true,
    })
  );

  // resolveColophonInsertion — presentation-sequence basis
  const end = resolveColophonInsertion({ mode: "end" }, 400);
  check("end mode: colophon after all body pages, no fallback", end.precedingBodyPages === 400 && !end.fallback && end.requestedPage === null);
  const p1 = resolveColophonInsertion({ mode: "after-body-page", afterBodyPage: 1 }, 100);
  check("after page 1: colophon precedes 1 body page (physical page 2)", p1.precedingBodyPages === 1 && !p1.fallback);
  const mid = resolveColophonInsertion({ mode: "after-body-page", afterBodyPage: 20 }, 100);
  check("after page 20 of 100: colophon precedes 20 body pages", mid.precedingBodyPages === 20 && !mid.fallback && mid.requestedPage === 20);
  const high = resolveColophonInsertion({ mode: "after-body-page", afterBodyPage: 100 }, 100);
  check("after page 100 of 100: exact last page, no fallback", high.precedingBodyPages === 100 && !high.fallback);
  // out-of-range: 300 requested, body shrank to 280
  const oor = resolveColophonInsertion({ mode: "after-body-page", afterBodyPage: 300 }, 280);
  check("out-of-range 300/280: falls back to end (280), flags fallback", oor.precedingBodyPages === 280 && oor.fallback === true);
  check("out-of-range: requested page number is preserved for the warning", oor.requestedPage === 300);
  // recovery: body grows back to 300+
  const rec = resolveColophonInsertion({ mode: "after-body-page", afterBodyPage: 300 }, 320);
  check("recovery: body back to >= requested → original position, no fallback", rec.precedingBodyPages === 300 && !rec.fallback);
  // resolveColophonInsertion never mutates the position object (settings untouched)
  const pos = { mode: "after-body-page", afterBodyPage: 300 };
  resolveColophonInsertion(pos, 10);
  check("resolveColophonInsertion does not rewrite the saved value", pos.afterBodyPage === 300);
}

/* ---- §5-6: presentation sequence + nombre by physical order ---- */
{
  // Model the PreviewPane sequence build (pure) to lock the ordering contract.
  const buildSeq = (bodyCount, enabled, position) => {
    const ins = resolveColophonInsertion(position, bodyCount);
    const seq = [];
    for (let i = 0; i < bodyCount; i++) {
      if (enabled && i === ins.precedingBodyPages) seq.push("C");
      seq.push(`B${i}`);
    }
    if (enabled && ins.precedingBodyPages >= bodyCount) seq.push("C");
    return seq;
  };
  check("seq: Body1 / Colophon / Body2 / Body3  (after page 1 of 3)", deepEqual(buildSeq(3, true, { mode: "after-body-page", afterBodyPage: 1 }), ["B0", "C", "B1", "B2"]));
  check("seq: end mode appends colophon last", deepEqual(buildSeq(3, true, { mode: "end" }), ["B0", "B1", "B2", "C"]));
  check("seq: colophon OFF → body only, unchanged", deepEqual(buildSeq(3, false, { mode: "after-body-page", afterBodyPage: 1 }), ["B0", "B1", "B2"]));
  check("seq: 0 body pages + enabled → just the colophon", deepEqual(buildSeq(0, true, { mode: "end" }), ["C"]));

  // §6 nombre follows physical order: Body1→1, Colophon→2, Body2→3, Body3→4
  const master = { nombrePosition: "center", nombreStart: 1, hideNombreOnFirstPage: false };
  // colophon after 1 body page → precedingBodyPages 1 → resolveColophonNombre(master, 1) → value 2
  check("§6 colophon inserted after body page 1 → nombre 2", resolveColophonNombre(master, 1).value === 2);
  // and the body page that now sits at physical 3 would get nombre 3 (PageCard: nombreStart + pageNumber - 1)
  check("§6 body page shifted to physical 3 → nombre 3 (nombreStart + 3 - 1)", 1 + 3 - 1 === 3);
}

/* ---- §15: Guide document colophon (real example, not the default) ---- */
{
  check("createGuideColophonSettings is enabled", createGuideColophonSettings().enabled === true);
  check("createDefaultColophonSettings stays OFF (guide is the only opt-in)", createDefaultColophonSettings().enabled === false);
  const g = createGuideColophonSettings();
  check("guide colophon: end position, safe default placement, standard template", g.pagePosition.mode === "end" && deepEqual(g.placement, DEFAULT_COLOPHON_PLACEMENT) && COLOPHON_TEMPLATE_IDS.includes(g.templateId));
  check("guide freeText names the 📖 扉・奥付 → 奥付（横） entry point", /📖 扉・奥付/.test(g.freeText) && /奥付（横）/.test(g.freeText));
  check("guide freeText contains 注意事項 ① (1 file 1 page)", /1ファイルにつき1ページ/.test(g.freeText));
  check("guide freeText contains 注意事項 ② (no vertical text / images)", /縦書きのテキストや画像を入れられません/.test(g.freeText));
  check("guide colophon survives a save/reload round-trip", deepEqual(normalizeColophonSettings(JSON.parse(JSON.stringify(g))), g));
}
{
  const db = fs.readFileSync(path.join(repoRoot, "src/lib/db.ts"), "utf8");
  check("db.ts uses createGuideColophonSettings only for the sample/guide document", /createGuideColophonSettings/.test(db));
}

/* ---- render model / safety ---- */
{
  const s = normalizeColophonSettings({
    fields: [
      { id: "title", label: "書名", value: "本", visible: true },
      { id: "hidden", label: "秘密", value: "x", visible: false },
      { id: "empty", label: "", value: "", visible: true },
      { id: "xss", label: "<b>ラベル</b>", value: "<script>alert(1)</script>", visible: true },
    ],
    freeText: "<img src=x onerror=alert(1)>",
  });
  const model = colophonRenderModel(s);
  check("render model excludes hidden rows", !model.rows.some((r) => r.id === "hidden"));
  check("render model excludes fully-empty rows", !model.rows.some((r) => r.id === "empty"));
  check("render model keeps visible rows in order", deepEqual(model.rows.map((r) => r.id), ["title", "xss"]));
  check(
    "render model passes user text through verbatim (React escapes at render; no markup transform here)",
    model.rows[1].value === "<script>alert(1)</script>" && model.freeText === "<img src=x onerror=alert(1)>"
  );
}

/* ---- nombre on the colophon page (Human-spec correction §1) ---- */
{
  const master = (over = {}) => ({
    nombrePosition: "center",
    nombreStart: 1,
    hideNombreOnFirstPage: false,
    ...over,
  });
  // body nombre ON → colophon gets a page number
  const n = resolveColophonNombre(master(), 12);
  check("nombre ON → colophon nombre shown", n !== null);
  check("nombre value = next page after the body (start + bodyPageCount)", n.value === 13);
  check("nombre isOddPage reflects the physical page number", n.isOddPage === ((12 + 1) % 2 === 1));
  // nombreStart offset respected
  check("nombreStart offset flows through", resolveColophonNombre(master({ nombreStart: 5 }), 10).value === 15);
  // body nombre OFF (position hidden) → none
  check("nombre hidden → colophon nombre suppressed", resolveColophonNombre(master({ nombrePosition: "hidden" }), 12) === null);
  // gutter / outer positions still produce a nombre (position handled by NombreOverlay)
  check("gutter position still yields a colophon nombre", resolveColophonNombre(master({ nombrePosition: "gutter" }), 3) !== null);
  // hideNombreOnFirstPage only bites when the colophon would be physical page 1
  check("hideNombreOnFirstPage + 0 body pages → suppressed", resolveColophonNombre(master({ hideNombreOnFirstPage: true }), 0) === null);
  check("hideNombreOnFirstPage + >=1 body page → still shown", resolveColophonNombre(master({ hideNombreOnFirstPage: true }), 4) !== null);
}

/* ---- source-level invariants: renderer ---- */
{
  const src = fs.readFileSync(path.join(repoRoot, "src/components/ColophonPageCard.tsx"), "utf8");
  check("renderer uses writing-mode horizontal-tb", /horizontal-tb/.test(src));
  check("renderer emits a data-page-card element", /data-page-card/.test(src));
  check("renderer emits a data-bleed-guide (trim guide) for print presets", /data-bleed-guide/.test(src));
  check("renderer never uses dangerouslySetInnerHTML", !/dangerouslySetInnerHTML/.test(src));
  check(
    "renderer does not pull in the vertical body pipeline",
    !/tokenizeTategaki|paginateTokens|detokenizeTategaki|FixedSlot|TokenView|LatinRun|ProtectedRun/.test(src)
  );
  check("renderer does not set vertical-rl writing mode", !/vertical-rl/.test(src));
  // §1: reuse the body's own nombre component + font resolution, not a parallel system.
  check("renderer reuses the body NombreOverlay component", /NombreOverlay/.test(src) && /from ["']\.\/PageCard["']/.test(src));
  check("renderer resolves the nombre via resolveColophonNombre + resolveNombreFontFamily", /resolveColophonNombre/.test(src) && /resolveNombreFontFamily/.test(src));
  // §8-11: block placement via a PlacementArea driven by colophon.placement, not
  // 36 separate template layouts.
  check("renderer derives a PlacementArea from colophon.placement", /placement\.horizontal/.test(src) && /placement\.vertical/.test(src) && /respectGutter/.test(src) && /respectVerticalMargins/.test(src));
  check("renderer only uses existing margin values (no invented print numbers)", /settings\.marginGutter/.test(src) && /settings\.marginOuter/.test(src) && /settings\.marginTop/.test(src) && /settings\.marginBottom/.test(src));
  check("renderer never auto-shrinks / paginates the colophon (overflow = warn only)", !/scale\(/.test(src) && !/pageSplit|autoSplit|truncate/.test(src));
  // §13-14: exactly one horizontal colophon, no image insert path.
  check("renderer has no image insertion / body image renderer", !/ImagePositionOverlay|FullPageImage|handleInsertImage|onImageAdd/.test(src));
}
{
  const src = fs.readFileSync(path.join(repoRoot, "src/components/PageCard.tsx"), "utf8");
  check("PageCard exports NombreOverlay for reuse", /export function NombreOverlay/.test(src));
}

/* ---- source-level invariant: body layout math ignores colophon ---- */
{
  const src = fs.readFileSync(path.join(repoRoot, "src/lib/pageLayout.ts"), "utf8");
  const start = src.indexOf("export function computePageLayout");
  const rest = src.slice(start + 1);
  const end = rest.indexOf("\nexport ");
  const body = rest.slice(0, end === -1 ? undefined : end);
  check("computePageLayout() never references colophon", !/colophon/i.test(body));
}
{
  const src = fs.readFileSync(path.join(repoRoot, "src/components/PreviewPane.tsx"), "utf8");
  // The body pagination memo must not depend on colophon settings.
  const memoStart = src.indexOf("const pages = useMemo(");
  const memoChunk = src.slice(memoStart, memoStart + 600);
  check("PreviewPane body pagination memo does not depend on colophon", !/colophon/i.test(memoChunk));
  check("PreviewPane guards colophon behind settings.colophon.enabled", /settings\.colophon\?\.enabled === true/.test(src));
  // §5: Presentation Sequence — body `pages` untouched; reorder/selection/source
  // ranges stay body-only. Colophon lives only in the presentation layer.
  check("PreviewPane builds a Presentation Sequence via resolveColophonInsertion", /resolveColophonInsertion/.test(src) && /presentationSequence/.test(src));
  check("PreviewPane spread grouping is over the presentation sequence length", /computeSpreadGroups\(presentationSequence\.length\)/.test(src));
  check("PreviewPane passes a physicalPageNumber (not body index) to PageCard", /physicalPageNumber/.test(src) && /pageNumber=\{physicalPageNumber\}/.test(src));
  check("PreviewPane reorder still targets body `pages` only", /reorderByDrag\(pages,/.test(src) && /moveSelected\(pages,/.test(src));
  // §3: selected-scope PDF must NOT auto-append the colophon; default OFF, opt-in only.
  check("PreviewPane has a pdfIncludeColophon toggle defaulting to false", /const \[pdfIncludeColophon, setPdfIncludeColophon\] = useState\(false\)/.test(src));
  check(
    "selected PDF includes colophon only when opted in; full PDF includes it when enabled",
    /pdfScope === "all" \|\| pdfIncludeColophon/.test(src)
  );
  // §12: PDF keeps the colophon at its Presentation-Sequence position, not appended.
  check("PDF export inserts the colophon at its sequence position (>= precedingBodyPages)", /bodyIdx >= colophonInsertion\.precedingBodyPages/.test(src));
  check("PDF modal exposes 「奥付ページを含める」 for the selected scope", /奥付ページを含める/.test(src));
  // §4: out-of-range fallback surfaces a warning (does not mutate settings).
  check("PreviewPane shows an out-of-range fallback warning", /colophonInsertion\.fallback/.test(src) && /一時的に作品最終ページ/.test(src));
}

/* ---- §4–5 + UI consolidation: no standalone 📖 奥付 button; entry via BookPartsModal ---- */
{
  const panel = fs.readFileSync(path.join(repoRoot, "src/components/PageSettingsPanel.tsx"), "utf8");
  check("PageSettingsPanel has no colophon editor UI", !/colophon/i.test(panel) && !/ColophonSettingsTab/.test(panel));
  check("PageSettingsPanel tab bar is back to 4 cells (no 奥付 tab)", /grid-cols-4/.test(panel) && !/grid-cols-5/.test(panel));

  const editor = fs.readFileSync(path.join(repoRoot, "src/components/EditorPane.tsx"), "utf8");
  // The standalone 📖 奥付 toolbar button (and its onOpenColophon prop) is removed —
  // the single book-parts entry point is the existing 📖 扉・奥付 button.
  check("EditorPane has NO standalone 📖 奥付 button / onOpenColophon prop", !/onOpenColophon/.test(editor) && !/>\s*📖 奥付\s*</.test(editor));
  check("EditorPane keeps the 📖 扉・奥付 button (single book-parts entry)", /📖 扉・奥付/.test(editor) && /onOpenBookParts/.test(editor));
  // 📖 扉・奥付 must sit before the 改ページ挿入 button (button text, not the
  // "改ページを挿入" title attr, which differs by one character).
  const bpBtn = editor.indexOf("📖 扉・奥付");
  const brkBtn = editor.indexOf("改ページ挿入");
  check("📖 扉・奥付 button comes before the 改ページ挿入 button", bpBtn !== -1 && brkBtn !== -1 && bpBtn < brkBtn);

  const bp = fs.readFileSync(path.join(repoRoot, "src/components/BookPartsModal.tsx"), "utf8");
  check(
    "BookPartsModal offers 奥付（縦）/ 奥付（横）/ 扉（タイトルページ）/ 目次作成",
    /奥付（縦）/.test(bp) && /奥付（横）/.test(bp) && /扉（タイトルページ）/.test(bp) && /目次作成/.test(bp)
  );
  check("BookPartsModal 奥付（縦） still uses the existing body-text path", /generateColophonText/.test(bp) && /handleInsertColophon/.test(bp));
  check("BookPartsModal 奥付（横） opens the existing ColophonModal via onOpenColophonModal", /onOpenColophonModal/.test(bp) && !/import ColophonModal/.test(bp));
  check("BookPartsModal keeps 扉 + 目次 insert logic", /generateTitlePageText/.test(bp) && /generateTocText/.test(bp));
  check("BookPartsModal shows a one-line description per part", /本文ページとして縦書きの奥付を作成/.test(bp) && /独立した横書き専用ページを作成/.test(bp));

  const modal = fs.readFileSync(path.join(repoRoot, "src/components/ColophonModal.tsx"), "utf8");
  check("ColophonModal has ON/OFF, templates, font, fields, +add, freeText, ↑/↓/delete", /enabled/.test(modal) && /COLOPHON_TEMPLATE_IDS/.test(modal) && /fontFamily/.test(modal) && /addColophonField/.test(modal) && /moveColophonField/.test(modal) && /removeColophonField/.test(modal) && /freeText/.test(modal));
  check("ColophonModal closes on Escape and a 閉じる button", /Escape/.test(modal) && /閉じる/.test(modal));
  // §2: PAGE POSITION UI — radio + numeric input, no page dropdown.
  check("ColophonModal has a 配置場所 section with the two radios + numeric page input", /配置場所/.test(modal) && /P目の後に配置/.test(modal) && /作品最終ページに配置/.test(modal) && /type="number"/.test(modal) && /min=\{1\}/.test(modal));
  check("ColophonModal does not build a page-list dropdown for position", !/pages\.map\(\(_, i\) => <option/.test(modal));
  check("ColophonModal shows the out-of-range fallback warning + preserves the value", /が現在の本文にはありません/.test(modal) && /指定値は保持されます/.test(modal));
  check("ColophonModal never rewrites the saved after-body-page on out-of-range (no auto-clamp to bodyPageCount)", !/afterBodyPage: bodyPageCount/.test(modal));
  // §8: BLOCK PLACEMENT UI under the template selector.
  check("ColophonModal has a 配置 section: 左右 / 上下 / ノドを考慮する / 天地の余白を考慮する", /配置<\/span>|>配置</.test(modal) && /左寄り/.test(modal) && /上部寄せ/.test(modal) && /ノドを考慮する/.test(modal) && /天地の余白を考慮する/.test(modal));
  check("ColophonModal has NO image-insertion mechanics (§14)", !/onImageAdd|handleInsertImage|type="file"|accept="image/.test(modal));

  const tge = fs.readFileSync(path.join(repoRoot, "src/components/TategakiEditor.tsx"), "utf8");
  check("TategakiEditor renders ColophonModal and wires BookPartsModal.onOpenColophonModal", /ColophonModal/.test(tge) && /onOpenColophonModal=\{/.test(tge));
  check("TategakiEditor passes bodyPageCount to ColophonModal (from PreviewPane)", /onBodyPageCountChange=\{/.test(tge) && /bodyPageCount=\{bodyPageCount\}/.test(tge));
}

/* ---- Help ---- */
{
  const help = fs.readFileSync(path.join(repoRoot, "public/docs/help.md"), "utf8");
  const sec = help.slice(help.indexOf("## 奥付"), help.indexOf("## キーボードショートカット"));
  check("help.md has a 奥付 section", sec.startsWith("## 奥付"));
  check("help.md: names the 📖 扉・奥付 entry point", /📖 扉・奥付/.test(sec) && !/📖 奥付[^・]/.test(sec));
  check("help.md: documents 奥付（縦） as a normal editable body page", /### 奥付（縦）/.test(sec) && /通常の本文ページとして/.test(sec) && /縦書き本文として自由に編集/.test(sec));
  check("help.md: documents 奥付（横） as an independent horizontal page", /### 奥付（横）/.test(sec) && /独立した横書き/.test(sec));
  check(
    "help.md: 選び方 — neither form is forced",
    /### 選び方/.test(sec) && /縦書きの奥付にしたい/.test(sec) && /横書きの独立した奥付ページにしたい/.test(sec) && /強制するものではありません/.test(sec) && !/横書きしか作れません/.test(sec)
  );
  check("help.md: states body pagination is unaffected", /本文の文字数・改ページ・縦書き設定は変わりません/.test(sec));
  check("help.md: 奥付（横） can go after any body page or at the end", /本文.*P目の後に配置/.test(sec) && /作品最終ページに配置/.test(sec));
  check("help.md: in-page left/right + top/bottom placement is adjustable", /左寄り/.test(sec) && /右寄り/.test(sec) && /上部寄せ/.test(sec) && /下部寄せ/.test(sec));
  check("help.md: gutter + vertical-margin can be respected", /ノドを考慮/.test(sec) && /天地の余白を考慮/.test(sec));
  check("help.md: nombre follows the physical (作品) page order", /続きのページ番号/.test(sec) && /物理ページ順/.test(sec));
  check("help.md: one horizontal colophon per file", /1ファイルにつき1ページ/.test(sec));
  check("help.md: no vertical text / no images in the horizontal colophon", /縦書きのテキストや画像を入れられません/.test(sec));
  check("help.md: re-editable from the same 📖 扉・奥付 button", /再編集も同じ「📖 扉・奥付」/.test(sec));
  check("help.md: lists the initial item names and that they are editable", /書名/.test(sec) && /項目名そのものを変更できます/.test(sec));
  check("help.md: names all 4 templates", /標準/.test(sec) && /中央/.test(sec) && /ミニマル/.test(sec) && /クラシック/.test(sec));
  check("help.md: template change keeps entered info + placement", /テンプレートを変更しても.*配置は維持/.test(sec));
  check("help.md: PDF — full includes when ON, selected only when opted in", /全ページPDF/.test(sec) && /選択ページPDF/.test(sec) && /奥付ページを含める/.test(sec));
  check("help.md: output covers Preview / JPG / PDF", /Preview/.test(sec) && /JPG/.test(sec) && /PDF/.test(sec));
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll checks passed.");
