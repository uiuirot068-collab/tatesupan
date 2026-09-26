// Explicit-run E2E for the Phase 4 broken-image warning contract.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 node tests/e2e/imageWarningLifecycle.e2e.mjs
//
// Runs only against an explicit base URL (non-loopback also needs
// TATESPUN_E2E_ALLOW_PRODUCTION=1) and only on the in-memory Demo route: no
// project, IndexedDB document, cloud, Storage or manifest is touched. A real,
// local "broken image" is produced the same way a user can produce one: a TXT
// import keeps IMG markers but carries no image data (TategakiEditor.importTxt).
// Cloud-manifest/TTL cases (72h expiry, tombstones, local originals) are covered
// deterministically below the browser in src/lib/imageRecovery.test.ts.
//
// FLOW 2  break → modal once → page export blocked → same-ID replace → image
//         renders, export STILL blocked → 通知解除 → export allowed
// FLOW 3  break → 通知解除 refused → marker deleted → warning kept with its last
//         page → 通知解除 accepted → warning gone
import assert from "node:assert/strict";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "image warning lifecycle E2E");
const session = await launchEditorSession("tatespun-image-warning-");
const { cdp, downloads } = session;
const log = (line) => console.log(line);

const dialogs = [];
cdp.on("Page.javascriptDialogOpening", (params) => {
  dialogs.push({ type: params.type, message: params.message });
  void cdp.send("Page.handleJavaScriptDialog", { accept: true });
});

async function click(selector) {
  const ok = await cdp.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el || el.disabled) return false;
    el.click();
    return true;
  })()`);
  assert.ok(ok, `could not click ${selector}`);
}

/** Replaces the manuscript through the real TXT import (markers kept, image data dropped). */
async function importTxt(text) {
  await cdp.evaluate(`(() => {
    const input = document.querySelector('input[type="file"][accept=".txt,text/plain"]');
    const transfer = new DataTransfer();
    transfer.items.add(new File([${JSON.stringify(text)}], 'qa.txt', { type: 'text/plain' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
}

async function setManuscript(text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  })()`);
}

async function openWarningPanel() {
  const open = await cdp.evaluate(`!!document.querySelector('[data-image-warning-page]')`);
  if (!open) await click("[data-image-link-warning-footer] button");
  await cdp.waitFor(`!!document.querySelector('[data-image-warning-page]')`, { label: "warning panel" });
}

/** Single-page JPG of page 1 through the real 書き出し menu. Returns "blocked" or "exported". */
async function exportPage1Jpg() {
  const dialogsBefore = dialogs.length;
  const downloadsBefore = downloads.filter((d) => d.state === "completed").length;
  await click('[data-demo-target="export"]');
  await cdp.waitFor(`!!document.querySelector('[data-export-menu-entry="jpg"]')`, { label: "export menu" });
  await click('[data-export-menu-entry="jpg"]');
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (dialogs.length > dialogsBefore) {
      assert.match(dialogs[dialogs.length - 1].message, /画像リンク切れ/, "block dialog must explain the image break");
      return "blocked";
    }
    if (downloads.filter((d) => d.state === "completed").length > downloadsBefore) return "exported";
    await sleep(150);
  }
  throw new Error("export neither blocked nor completed");
}

const modalOpen = () => cdp.evaluate(`!!document.getElementById('image-link-broken-title')`);

try {
  await session.setViewport(1280, 900);
  await cdp.send("Page.navigate", { url: target.url("/editor?demo=1") });
  await cdp.waitFor(`!!document.querySelector('[data-demo-target="editor"]') && !!document.querySelector('[data-page-card=true]')`, { label: "demo editor + Preview" });
  await sleep(1_200);

  // --- FLOW 2 --------------------------------------------------------------------------------------
  log("FLOW 2: break → repair → still blocked → 通知解除 → allowed");
  await importTxt("挿絵のある本文です。\n【IMG:qa-red:40:30:center】\n続きの本文です。");
  await cdp.waitFor(`!!document.querySelector('[data-image-link-warning-footer]')`, { label: "footer warning after break" });
  await cdp.waitFor(`!!document.getElementById('image-link-broken-title')`, { label: "break modal" });
  assert.equal(await cdp.evaluate(`document.querySelector('[data-image-link-warning-footer] button').textContent.trim()`), "⚠️ 画像切れ");
  await click('[aria-label="画像リンク切れのお知らせを閉じる"]');
  // Further edits (and the Editor's re-evaluations) must not re-announce the same break.
  await setManuscript("挿絵のある本文です。\n【IMG:qa-red:40:30:center】\n続きの本文です。追記。");
  await sleep(1_500);
  assert.equal(await modalOpen(), false, "the same break must not re-open the modal");
  log("  break: footer ⚠️ 画像切れ + modal exactly once");

  assert.equal(await exportPage1Jpg(), "blocked", "export of the broken page must be blocked");
  log("  broken page export: blocked");

  await openWarningPanel();
  assert.equal(await cdp.evaluate(`document.querySelector('[data-image-warning-image="qa-red"]')?.dataset.imageWarningStatus`), "broken");
  await click('[data-image-warning-replace="qa-red"]'); // selects the SAME image id for replacement
  await cdp.evaluate(`(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 300; canvas.height = 200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2a6fd0';
    ctx.fillRect(0, 0, 300, 200);
    return new Promise((resolve) => canvas.toBlob((blob) => {
      const input = document.querySelector('[data-image-link-warning-footer] input[type="file"]');
      const transfer = new DataTransfer();
      transfer.items.add(new File([blob], 'qa-repair.png', { type: 'image/png' }));
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      resolve(true);
    }, 'image/png'));
  })()`);
  await cdp.waitFor(`document.querySelector('[data-image-warning-image="qa-red"]')?.dataset.imageWarningStatus === 'repaired'`, { label: "status repaired" });
  await cdp.waitFor(`!!document.querySelector('[data-page-card=true] img[src^="data:image/png"]')`, { label: "repaired image renders in Preview" });
  assert.match(await cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`), /【IMG:qa-red:40:30:center】/, "marker (id/size/position) untouched");
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-image-link-warning-footer]')`), true, "warning must stay until 通知解除");
  log("  replace: same id, image renders, warning still pending");

  assert.equal(await exportPage1Jpg(), "blocked", "repaired but unacknowledged page must stay blocked");
  log("  repaired, before 通知解除: export still blocked");

  await openWarningPanel();
  await click('[data-image-warning-dismiss="1"]');
  await cdp.waitFor(`!document.querySelector('[data-image-link-warning-footer]')`, { label: "footer cleared after 通知解除" });
  assert.equal(await exportPage1Jpg(), "exported", "after 通知解除 the export must run");
  log("  通知解除: warning cleared, export allowed");

  // --- FLOW 3 --------------------------------------------------------------------------------------
  log("FLOW 3: break → dismiss refused → marker deleted → 通知解除");
  await importTxt("別の本文です。\n【IMG:qa-gone:40:30:center】\n続き。");
  await cdp.waitFor(`!!document.querySelector('[data-image-link-warning-footer]')`, { label: "footer warning after second break" });
  if (await modalOpen()) await click('[aria-label="画像リンク切れのお知らせを閉じる"]');
  await openWarningPanel();
  const dialogsBeforeRefusal = dialogs.length;
  await click('[data-image-warning-dismiss="1"]');
  await cdp.waitFor(`true`);
  const refusalDeadline = Date.now() + 5_000;
  while (dialogs.length === dialogsBeforeRefusal && Date.now() < refusalDeadline) await sleep(100);
  assert.match(dialogs[dialogs.length - 1]?.message ?? "", /まだ読み込めません/, "dismiss before repair must be refused");
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-image-link-warning-footer]')`), true);
  log("  通知解除 before repair: refused");

  await setManuscript("別の本文です。\n続き。");
  await openWarningPanel();
  await cdp.waitFor(`document.querySelector('[data-image-warning-image="qa-gone"]')?.dataset.imageWarningStatus === 'deleted'`, { label: "status deleted" });
  assert.equal(await cdp.evaluate(`document.querySelector('[data-image-warning-page]')?.dataset.imageWarningPage`), "1", "last-known page retained");
  assert.equal(await exportPage1Jpg(), "blocked", "deleted but unacknowledged page must stay blocked");
  log("  marker deleted: warning kept on its last-known page 1P, export still blocked");

  await openWarningPanel();
  await click('[data-image-warning-dismiss="1"]');
  await cdp.waitFor(`!document.querySelector('[data-image-link-warning-footer]')`, { label: "footer cleared after deleted-image 通知解除" });
  assert.equal(await exportPage1Jpg(), "exported");
  log("  通知解除 after delete: accepted, export allowed");

  log("image warning lifecycle E2E: PASS");
} catch (error) {
  console.error("image warning lifecycle E2E: FAIL --", error instanceof Error ? error.message : error);
  console.error("dialogs:", JSON.stringify(dialogs));
  process.exitCode = 1;
} finally {
  await session.close();
}
