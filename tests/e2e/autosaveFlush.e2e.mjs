// Explicit-run E2E for the Phase 6.1 autosave flush contract.
//
//   TATESPUN_E2E_BASE_URL=http://127.0.0.1:3000 node tests/e2e/autosaveFlush.e2e.mjs
//
// Uses a disposable browser profile, so the local IndexedDB documents it
// creates die with it. No cloud project is touched.
//
// FLOW 1  type → leave /editor through the in-app ← 作品一覧 link well inside the
//         1.5 s autosave debounce (client navigation unmounts the editor) →
//         reopen the document → the edit is there.            (asserted)
// FLOW 2  type → reload inside the debounce (pagehide flush, best effort:
//         the IndexedDB write is async) → reopen → reported, not asserted.
import assert from "node:assert/strict";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const target = resolveE2eTarget(process.env, "autosave flush E2E");
const session = await launchEditorSession("tatespun-autosave-flush-");
const { cdp } = session;
const log = (line) => console.log(line);

async function navigate(path) {
  await cdp.send("Page.navigate", { url: target.url(path) });
}

async function openNewDocument() {
  await navigate("/editor");
  await cdp.waitFor(`/[?&]id=\\d+/.test(location.search) && document.querySelector('[data-editor-save-status="saved"]') !== null && !!document.querySelector('[data-demo-target="editor"]')`, { timeoutMs: 60_000, label: "new document loaded" });
  return cdp.evaluate(`Number(new URLSearchParams(location.search).get('id'))`);
}

async function openDocument(id) {
  await navigate(`/editor?id=${id}`);
  await cdp.waitFor(`document.querySelector('[data-editor-save-status="saved"]') !== null && !!document.querySelector('[data-demo-target="editor"]')`, { timeoutMs: 60_000, label: `document ${id} loaded` });
  await sleep(300);
  return cdp.evaluate(`document.querySelector('[data-demo-target="editor"]').value`);
}

async function type(text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
  })()`);
}

try {
  await session.setViewport(1280, 900);

  log("FLOW 1: unmount inside the debounce window");
  const id = await openNewDocument();
  const unmountText = `離脱直前の編集 ${Date.now()}`;
  await type(unmountText);
  await cdp.waitFor(`document.querySelector('[data-editor-save-status="saving"]') !== null`, { label: "autosave pending" });
  const clicked = await cdp.evaluate(`(() => {
    const link = Array.from(document.querySelectorAll('a[href]')).find((a) => a.textContent.includes('作品一覧') && a.offsetParent !== null);
    if (!link) return false;
    link.click();
    return true;
  })()`);
  assert.ok(clicked, "← 作品一覧 link not found");
  await cdp.waitFor(`!document.querySelector('[data-editor-shell]')`, { label: "editor unmounted" });
  log("  left /editor while the save was still pending (client navigation)");
  await sleep(800); // let the flushed IndexedDB write settle before the full navigation below
  const reopened = await openDocument(id);
  assert.equal(reopened, unmountText, "edit typed before leaving must survive the unmount");
  log("  reopened: edit survived");

  log("FLOW 2: reload inside the debounce window (pagehide, best effort)");
  const reloadText = `再読み込み直前の編集 ${Date.now()}`;
  await type(reloadText);
  await cdp.waitFor(`document.querySelector('[data-editor-save-status="saving"]') !== null`, { label: "autosave pending" });
  await cdp.send("Page.reload", {});
  const afterReload = await openDocument(id);
  log(afterReload === reloadText
    ? "  reload: edit survived (pagehide flush completed)"
    : "  reload: edit NOT persisted (best effort; IndexedDB write did not finish before unload)");

  log("autosave flush E2E: PASS");
} finally {
  await session.close();
}
