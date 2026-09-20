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
  return { header: H, controls, overlaps, outside: all.filter((r) => r.l < H.l - 0.5 || r.r > H.r + 0.5 || r.t < H.t - 0.5 || r.b > H.b + 0.5).length,
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
    console.log(`  ${tag}: header ${m.header.h}px, controls one row, manuscript ${Math.round(m.textareaH)}px`);
  }
  for (const vp of UNCHANGED) {
    const m = await measureAt(vp);
    const tag = `${vp.width}x${vp.height}`;
    assert.ok(Math.abs(m.header.h - vp.header) <= 1, `${tag}: outside the compact range the header is unchanged (${vp.header}px), got ${m.header.h}px`);
    assert.equal(m.overlaps, 0, `${tag}: no overlap`);
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
