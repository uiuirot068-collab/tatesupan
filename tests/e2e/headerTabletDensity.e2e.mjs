// Explicit-run real-browser E2E for the tablet / narrow-desktop app-shell header density.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 npm run test:e2e:header-density
//
// Loopback only unless TATESPUN_E2E_ALLOW_PRODUCTION=1; never starts a server; disposable Chrome profile;
// normal local /editor, nothing saved.
//
// Why: at 768-770px the header's controls block (~654px) had only ~630px, so its last button wrapped onto a
// second row and the header grew to 146px (a third of a 720px-high window). In the 768-904px range the
// controls now stay on ONE row (header ~94px) without hiding or shrinking any control. Above that range and on
// phones the header is exactly what it was.
import assert from "node:assert/strict";
import { sleep } from "./helpers/cdp.mjs";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";

const NAME = "header tablet density E2E";
const target = resolveE2eTarget(process.env, NAME);
const session = await launchEditorSession("tatespun-header-density-");
const { cdp } = session;

const pageErrors = [];
cdp.on("Runtime.exceptionThrown", (p) => pageErrors.push(p.exceptionDetails?.exception?.description ?? "exception"));

// In-range widths must be compact; outside the range the pre-existing heights are pinned (+-1px).
const COMPACT = [768, 770, 800, 850, 900].map((width) => ({ width, height: 720 }));
const UNCHANGED = [
  { width: 906, height: 720, header: 106 },
  { width: 1024, height: 768, header: 106 },
  { width: 1280, height: 720, header: 66 },
];
const PHONE = { width: 390, height: 844 };
const CONTROLS = ["集中モード", "クラウドに保存", "保存作品一覧", "ログイン / 会員登録"];

const MEASURE = `(() => {
  const vis = (e) => e.getClientRects().length > 0;
  const rect = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
  const hd = [...document.querySelectorAll('header')].find(vis);
  const H = rect(hd);
  const byText = (t) => [...hd.querySelectorAll('button')].filter(vis).find((e) => e.textContent.replace(/\\s+/g, ' ').trim() === t);
  const controls = ${JSON.stringify(CONTROLS)}.map((t) => { const e = byText(t); return { t, ...(e ? rect(e) : { missing: true }) }; });
  const all = [...hd.querySelectorAll('button, a, img')].filter(vis).map((e) => rect(e));
  let overlaps = 0;
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = all[i], b = all[j]; if (a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5) overlaps++; }
  const ta = document.querySelector('[data-demo-target="editor"]').getBoundingClientRect();
  // The Editor pane's own title action row (元に戻す / やり直す / 改ページ挿入 / 置換 [/ 報告]).
  const row = document.querySelector('[data-editor-action-row]');
  const acts = [...row.querySelectorAll('[data-editor-action]')].filter(vis).map((e) => ({ a: e.dataset.editorAction, ...rect(e),
    label: (e.querySelector('span:not([aria-hidden])') ?? null) && vis(e.querySelector('span:not([aria-hidden])')), aria: e.getAttribute('aria-label') }));
  const paneR = row.closest('.overflow-hidden').getBoundingClientRect();
  const actionRow = { h: rect(row).h, acts, inPane: acts.every((x) => x.l >= paneR.left - 0.5 && x.r <= paneR.right + 0.5),
    overlaps: acts.filter((x, i) => acts.some((y, j) => j > i && x.l < y.r - 0.5 && y.l < x.r - 0.5)).length };
  return { header: H, actionRow, controls, overlaps, outside: all.filter((r) => r.l < H.l - 0.5 || r.r > H.r + 0.5 || r.t < H.t - 0.5 || r.b > H.b + 0.5).length,
    hScroll: document.documentElement.scrollWidth - innerWidth, textareaH: ta.height, subtitle: /縦書きWebエディタ/.test(hd.textContent), brand: /TateSpun/.test(hd.textContent) };
})()`;

async function measureAt({ width, height }) {
  await session.setViewport(width, height);
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(
    `document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved' && !!document.querySelector('[data-demo-target="editor"]')`,
    { timeoutMs: 120_000, label: `/editor ready at ${width}` }
  );
  await sleep(700);
  return cdp.evaluate(MEASURE);
}

// Regression (B2 Human QA, ~770px): 元に戻す / やり直す / 改ページ挿入 filled the ~300px Editor column and 置換 wrapped
// onto a second row (+34px of editor header). All four actions must stay visible, on ONE row, inside the pane.
function assertActionRowOneLine(tag, row) {
  assert.deepEqual(row.acts.map((x) => x.a).slice(0, 4), ["undo", "redo", "page-break", "replace"], `${tag}: all four title actions still shown`);
  const tops = row.acts.map((x) => x.t);
  assert.ok(Math.max(...tops) - Math.min(...tops) <= 3, `${tag}: title actions on ONE row (tops ${tops.map(Math.round)})`);
  assert.ok(row.h <= 30, `${tag}: title action row must not grow the editor header (${row.h}px; a wrapped row is ~60px)`);
  assert.ok(row.inPane, `${tag}: title actions inside the Editor pane`);
  assert.equal(row.overlaps, 0, `${tag}: title actions do not overlap`);
  assert.ok(row.acts.filter((x) => ["undo", "redo"].includes(x.a)).every((x) => x.aria), `${tag}: 元に戻す / やり直す keep their accessible names`);
}

try {
  const heights = {};
  for (const vp of COMPACT) {
    const m = await measureAt(vp);
    const tag = `${vp.width}x${vp.height}`;
    heights[tag] = { header: m.header.h, textarea: m.textareaH };
    assert.ok(m.header.h <= 100, `${tag}: header must be compact (<=100px), got ${m.header.h}px`);
    for (const c of m.controls) assert.ok(!c.missing, `${tag}: control "${c.t}" must still be visible`);
    const tops = m.controls.map((c) => c.t);
    assert.ok(Math.max(...tops) - Math.min(...tops) <= 6, `${tag}: all controls on ONE row (tops ${tops.map(Math.round)})`);
    for (const c of m.controls) assert.ok(c.h >= 29.5, `${tag}: "${c.t}" keeps its tap height (${c.h}px)`);
    assert.equal(m.overlaps, 0, `${tag}: no overlapping header controls`);
    assert.equal(m.outside, 0, `${tag}: no header control clipped outside the header`);
    assert.ok(m.hScroll <= 1, `${tag}: no horizontal page scroll (${m.hScroll}px)`);
    assert.ok(m.subtitle && m.brand, `${tag}: product copy still shown`);
    assertActionRowOneLine(tag, m.actionRow);
    console.log(`  ${tag}: header ${m.header.h}px, controls one row, manuscript ${Math.round(m.textareaH)}px; title actions one row (${Math.round(m.actionRow.h)}px)`);
  }
  for (const vp of UNCHANGED) {
    const m = await measureAt(vp);
    const tag = `${vp.width}x${vp.height}`;
    assert.ok(Math.abs(m.header.h - vp.header) <= 1, `${tag}: outside the compact range the header is unchanged (${vp.header}px), got ${m.header.h}px`);
    assert.equal(m.overlaps, 0, `${tag}: no overlap`);
    assertActionRowOneLine(tag, m.actionRow);
    assert.ok(m.actionRow.acts.filter((x) => ["undo", "redo"].includes(x.a)).every((x) => x.label), `${tag}: outside the tablet range 元に戻す / やり直す keep their text labels`);
    console.log(`  ${tag}: header ${m.header.h}px (unchanged)`);
  }
  {
    const m = await measureAt(PHONE);
    assert.ok(m.header.h <= 50, `390x844: phone header unchanged and one line (${m.header.h}px)`);
    assert.equal(m.hScroll <= 1, true);
    console.log(`  390x844: header ${m.header.h}px (phone, unchanged)`);
  }
  assert.deepEqual(pageErrors, [], `uncaught page error(s): ${JSON.stringify(pageErrors)}`);
  console.log(`${NAME}: PASS (${COMPACT.map((v) => v.width).join("/")} compact; ${UNCHANGED.map((v) => v.width).join("/")} + 390 unchanged)`);
} catch (error) {
  process.exitCode = 1;
  console.error(`${NAME}: FAIL -- ${error instanceof Error ? error.message : error}`);
} finally {
  await session.close();
}
