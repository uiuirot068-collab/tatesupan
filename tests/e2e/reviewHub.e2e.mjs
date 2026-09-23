// TateSpun RC final Review Hub E2E.
//
// Final contract after Review UI Revision 4:
// - <768px: mobile one-line Review footer + Bottom Sheet.
// - >=768px: Preview-bottom Desktop Review Bar + popover.
// - Raw manuscript character count is ALWAYS title-side (`data-editor-character-count`).
// - Internal tool id "character-count" is preserved for B2 local preference migration,
//   but the visible tool is 作業カウンター / WorkSessionTracker.
// - Footer display is max 2 tools and independent of feature ON/OFF.
// - Next.js <nextjs-portal> exists only under `next dev`; if it covers the exact
//   coordinate in headless dev, dispatch directly to the intended product element.
//   Any other overlay remains a hard failure.

import assert from "node:assert/strict";
import { launchEditorSession, resolveE2eTarget } from "./helpers/editorSession.mjs";
import { sleep } from "./helpers/cdp.mjs";

const NAME = "review hub E2E";
const target = resolveE2eTarget(process.env, NAME);

const PINS_KEY = "tatespun.reviewHub.footerTools.v1";
const WRITING_CHECK_KEY = "tatespun_writing_check";
const COLLAPSED_KEY = "tatespun_editor_footer_collapsed";
const PANEL = "[data-review-hub-panel]";

const VIEWPORTS = [
  { name: "320x568", width: 320, height: 568, surface: "compact" },
  { name: "390x844", width: 390, height: 844, surface: "compact" },
  { name: "770x900", width: 770, height: 900, surface: "desktop" },
  { name: "1280x720", width: 1280, height: 720, surface: "desktop" },
];

const session = await launchEditorSession("tatespun-review-hub-final-");
const { cdp } = session;

const pageErrors = [];
cdp.on("Runtime.exceptionThrown", (p) => {
  pageErrors.push(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text ?? "exception");
});

const log = (s) => console.log(s);

async function navigate() {
  await cdp.send("Page.navigate", { url: target.url("/editor") });
  await cdp.waitFor(
    `document.querySelector('[data-editor-save-status]')?.dataset.editorSaveStatus === 'saved' &&
     !!document.querySelector('[data-demo-target="editor"]') &&
     !!document.querySelector('[data-editor-character-count]')`,
    { timeoutMs: 30_000, label: "/editor ready" },
  );
  await sleep(450);
}

async function openWith(v, pins = ["writing-check", "character-count"], writingOn = true) {
  await session.setViewport(v.width, v.height);
  await navigate();
  await cdp.evaluate(`(() => {
    localStorage.setItem(${JSON.stringify(PINS_KEY)}, ${JSON.stringify(JSON.stringify(pins))});
    localStorage.setItem(${JSON.stringify(WRITING_CHECK_KEY)}, ${JSON.stringify(writingOn ? "on" : "off")});
    localStorage.setItem(${JSON.stringify(COLLAPSED_KEY)}, "off");
    return true;
  })()`);
  await navigate();
  await cdp.waitFor(
    `document.querySelector('main')?.dataset.reviewSurface === ${JSON.stringify(v.surface)}`,
    { timeoutMs: 8_000, label: `${v.name}: review surface = ${v.surface}` },
  );
}

async function realClick(selector) {
  await cdp.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((x) => x.getClientRects().length > 0 && !x.disabled);
    e?.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  })()`);

  const hit = await cdp.evaluate(`(() => {
    const e = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((x) => x.getClientRects().length > 0 && !x.disabled);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const y = r.top + r.height / 2;
    const top = document.elementFromPoint(x, y);
    return {
      x, y,
      hit: top === e || e.contains(top),
      devBadge: top?.tagName === "NEXTJS-PORTAL",
      top: top?.outerHTML?.slice(0, 120) ?? null,
    };
  })()`);

  assert.ok(hit, `${selector}: no visible enabled target`);
  if (hit.devBadge) {
    await cdp.evaluate(`(() => {
      const e = [...document.querySelectorAll(${JSON.stringify(selector)})]
        .find((x) => x.getClientRects().length > 0 && !x.disabled);
      e?.click();
      return true;
    })()`);
    return;
  }
  assert.ok(hit.hit, `${selector}: covered by ${hit.top}`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: hit.x, y: hit.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: hit.x, y: hit.y, button: "left", clickCount: 1 });
}

async function pressEscape() {
  await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
}

async function panelShown() {
  return cdp.evaluate(`(() => {
    const p = document.querySelector(${JSON.stringify(PANEL)});
    return !!p && getComputedStyle(p).display !== "none";
  })()`);
}

async function openHub(tag) {
  if (await panelShown()) return;
  await realClick("[data-editor-review-hub-trigger]");
  await cdp.waitFor(
    `document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]') !== null &&
     (() => { const p = document.querySelector(${JSON.stringify(PANEL)}); return !!p && getComputedStyle(p).display !== "none"; })()`,
    { timeoutMs: 8_000, label: `${tag}: Hub opens` },
  );
}

async function closeHub(tag) {
  if (!(await panelShown())) return;

  // Final Review Hub contract: opening never steals focus. Escape closes only
  // while focus is inside the Hub (or on the trigger), so put focus on a real
  // focusable control inside the visible panel before dispatching Escape.
  const focusedInside = await cdp.evaluate(`(() => {
    const p = document.querySelector('${PANEL}');
    const candidate = p && [...p.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      .find((e) => e.getClientRects().length > 0);
    candidate?.focus();
    return !!p && p.contains(document.activeElement);
  })()`);
  assert.equal(focusedInside, true, `${tag}: focus must be inside Hub before Escape`);

  await pressEscape();
  await cdp.waitFor(
    `document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]') === null`,
    { timeoutMs: 8_000, label: `${tag}: Hub closes by Escape` },
  );
  assert.equal(await panelShown(), false, `${tag}: panel hidden after Escape`);
}

async function setText(text) {
  await cdp.evaluate(`(() => {
    const el = document.querySelector('[data-demo-target="editor"]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(el, ${JSON.stringify(text)});
    el.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }));
    return true;
  })()`);
}

const visibleTriggerCount = () =>
  cdp.evaluate(`[...document.querySelectorAll('[data-editor-review-hub-trigger]')].filter((e) => e.getClientRects().length > 0).length`);

const toolIds = () =>
  cdp.evaluate(`[...document.querySelectorAll('${PANEL} [data-review-hub-tool]')].map((e) => e.dataset.reviewHubTool)`);

const pinPressed = (id) =>
  cdp.evaluate(`document.querySelector('[data-review-hub-tool="${id}"] [data-review-hub-footer-pin-toggle]')?.getAttribute('aria-pressed')`);

const pinDisabled = (id) =>
  cdp.evaluate(`!!document.querySelector('[data-review-hub-tool="${id}"] [data-review-hub-footer-pin-toggle]')?.disabled`);

const writingPillShown = () =>
  cdp.evaluate(`!!document.querySelector('[data-mobile-writing-check-pill],[data-desktop-writing-check-pill]')`);

const workPillShown = () =>
  cdp.evaluate(`!!document.querySelector('[data-work-session-footer-pill]')`);

async function coreViewport(v) {
  const tag = v.name;
  await openWith(v);

  // Top navigation remains unchanged.
  assert.deepEqual(
    await cdp.evaluate(`[...document.querySelectorAll('[data-editor-secondary]')].map((e) => e.dataset.editorSecondary)`),
    ["settings", "options", "memo", "help"],
    `${tag}: top toolbar remains 設定/オプション/メモ/ヘルプ`,
  );

  assert.equal(await visibleTriggerCount(), 1, `${tag}: exactly one visible 見直し trigger`);

  if (v.surface === "compact") {
    assert.equal(await cdp.evaluate(`!!document.querySelector('[data-mobile-review-footer]')`), true, `${tag}: mobile Review footer exists`);
    assert.equal(await cdp.evaluate(`!!document.querySelector('[data-desktop-review-bar]')`), false, `${tag}: no Desktop Review Bar`);
  } else {
    assert.equal(await cdp.evaluate(`!!document.querySelector('[data-desktop-review-bar]')`), true, `${tag}: Desktop Review Bar exists`);
    assert.equal(await cdp.evaluate(`!!document.querySelector('[data-mobile-review-footer]')`), false, `${tag}: no mobile Review footer`);
  }

  // Final raw-count contract: title-side only, independent from the Review tool pin.
  assert.equal(
    await cdp.evaluate(`document.querySelector('[data-editor-character-count]')?.getAttribute('title')`),
    "現在の原稿文字数",
    `${tag}: raw manuscript count is title-side`,
  );

  // 1234 + two paragraph-break characters + 56 = 1292 visual characters.
  // The previous RETRY15 expectation accidentally asserted 1,290 even though the
  // canonical title-side counter correctly reported 1,292.
  const EXPECTED_RAW_COUNT = 1292;
  await setText("あ".repeat(1234) + "\n\n" + "い".repeat(56));
  await cdp.waitFor(
    `(() => {
      const t = document.querySelector('[data-editor-character-count]')?.textContent ?? "";
      return Number(t.replace(/[^0-9]/g, "")) === ${EXPECTED_RAW_COUNT};
    })()`,
    { timeoutMs: 8_000, label: `${tag}: title-side raw count follows typing` },
  );
  const rawCount = await cdp.evaluate(`document.querySelector('[data-editor-character-count]').textContent.trim()`);
  assert.equal(
    Number(rawCount.replace(/[^0-9]/g, "")),
    EXPECTED_RAW_COUNT,
    `${tag}: canonical raw count value`,
  );
  assert.match(rawCount, /1,292/, `${tag}: grouped raw count`);

  await openHub(tag);
  assert.deepEqual(
    await toolIds(),
    ["writing-check", "character-count", "read-aloud", "description-check"],
    `${tag}: four final Review tools`,
  );

  // Internal id is preserved, but the visible feature is now 作業カウンター.
  assert.equal(
    await cdp.evaluate(`!!document.querySelector('[data-review-hub-tool="character-count"] [data-work-session-tracker]')`),
    true,
    `${tag}: character-count id hosts WorkSessionTracker`,
  );
  assert.equal(
    await cdp.evaluate(`!!document.querySelector('[data-review-hub-character-count]')`),
    false,
    `${tag}: obsolete raw-count Review section is gone`,
  );
  assert.match(
    await cdp.evaluate(`document.querySelector('[data-review-hub-tool="character-count"]').textContent`),
    /作業カウンター|作業スタート/,
    `${tag}: visible Work Session content`,
  );

  const sheet = await cdp.evaluate(`document.querySelector('${PANEL}')?.hasAttribute('data-review-hub-sheet') ?? false`);
  assert.equal(sheet, v.surface === "compact", `${tag}: compact uses Bottom Sheet only`);

  await closeHub(tag);
  log(`  ${tag}: final Review surface + raw-count separation + WorkSession tool OK`);
}

async function targetedMobileTool() {
  const v = VIEWPORTS[1]; // 390
  const tag = `${v.name} targeted work-session`;
  await openWith(v);

  assert.equal(await workPillShown(), true, `${tag}: default 作業カウンター pill`);
  await realClick("[data-work-session-footer-pill]");
  await cdp.waitFor(
    `(() => {
      const p = document.querySelector('${PANEL}');
      const tools = p ? [...p.querySelectorAll('[data-review-hub-tool]')].map((e) => e.dataset.reviewHubTool) : [];
      return getComputedStyle(p).display !== "none" && tools.length === 1 && tools[0] === "character-count";
    })()`,
    { timeoutMs: 8_000, label: `${tag}: targeted Bottom Sheet` },
  );
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-work-session-tracker]')`), true);
  await closeHub(tag);
  log(`  ${tag}: pinned tool opens only its own detail OK`);
}

async function pinSemantics(v) {
  const tag = `${v.name} pin semantics`;
  await openWith(v);

  assert.equal(await writingPillShown(), true, `${tag}: writing pill default`);
  assert.equal(await workPillShown(), true, `${tag}: work-session pill default`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-editor-character-count]')`), true, `${tag}: raw count always title-side`);

  await openHub(tag);
  assert.equal(await pinPressed("writing-check"), "true");
  assert.equal(await pinPressed("character-count"), "true");
  assert.equal(await pinPressed("read-aloud"), "false");
  assert.equal(await pinPressed("description-check"), "false");
  assert.equal(await pinDisabled("read-aloud"), true, `${tag}: third pin blocked at max2`);
  assert.equal(await pinDisabled("description-check"), true, `${tag}: fourth pin blocked at max2`);

  // Unpin writing-check: display disappears, feature state stays ON.
  await realClick('[data-review-hub-tool="writing-check"] [data-review-hub-footer-pin-toggle]');
  await cdp.waitFor(`localStorage.getItem('${PINS_KEY}') === '["character-count"]'`, { label: `${tag}: writing unpinned` });
  assert.equal(await writingPillShown(), false, `${tag}: writing display removed`);
  assert.equal(await workPillShown(), true, `${tag}: work display remains`);
  assert.equal(await cdp.evaluate(`localStorage.getItem('${WRITING_CHECK_KEY}')`), "on", `${tag}: unpin does not disable feature`);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-editor-character-count]')`), true, `${tag}: raw count unaffected by pins`);

  // A free slot allows another tool; reaching max2 disables remaining unpinned tool.
  await realClick('[data-review-hub-tool="read-aloud"] [data-review-hub-footer-pin-toggle]');
  await cdp.waitFor(`localStorage.getItem('${PINS_KEY}') === '["character-count","read-aloud"]'`, { label: `${tag}: B4 pinned second` });
  assert.equal(await pinDisabled("description-check"), true, `${tag}: max2 still enforced`);

  // Restore default pair. Visible order is no longer part of the RC contract after the final Review Bar redesign;
  // only membership/max2/persistence and display-vs-enable separation are release-gating.
  await realClick('[data-review-hub-tool="read-aloud"] [data-review-hub-footer-pin-toggle]');
  await realClick('[data-review-hub-tool="writing-check"] [data-review-hub-footer-pin-toggle]');
  await cdp.waitFor(`localStorage.getItem('${PINS_KEY}') === '["character-count","writing-check"]'`, { label: `${tag}: default pair restored by membership` });
  assert.equal(await writingPillShown(), true);
  assert.equal(await workPillShown(), true);

  // Feature ON/OFF is separate from display.
  const before = await cdp.evaluate(`document.querySelector('[data-review-hub-writing-check-toggle]').checked`);
  await realClick("[data-review-hub-writing-check-toggle]");
  await cdp.waitFor(
    `document.querySelector('[data-review-hub-writing-check-toggle]').checked === ${!before}`,
    { label: `${tag}: writing feature toggles` },
  );
  assert.equal(await writingPillShown(), true, `${tag}: ON/OFF does not unpin display`);
  await realClick("[data-review-hub-writing-check-toggle]");
  await cdp.waitFor(
    `document.querySelector('[data-review-hub-writing-check-toggle]').checked === ${before}`,
    { label: `${tag}: writing feature restored` },
  );

  // Zero pins: Review Hub stays usable; raw manuscript count still exists because it is not a pin anymore.
  await realClick('[data-review-hub-tool="character-count"] [data-review-hub-footer-pin-toggle]');
  await realClick('[data-review-hub-tool="writing-check"] [data-review-hub-footer-pin-toggle]');
  await cdp.waitFor(`localStorage.getItem('${PINS_KEY}') === '[]'`, { label: `${tag}: zero pins` });
  assert.equal(await writingPillShown(), false);
  assert.equal(await workPillShown(), false);
  assert.equal(await cdp.evaluate(`!!document.querySelector('[data-editor-character-count]')`), true, `${tag}: raw count still visible with zero pins`);
  assert.deepEqual(await toolIds(), ["writing-check", "character-count", "read-aloud", "description-check"]);

  await closeHub(tag);
  log(`  ${tag}: max2 + membership + display/enable separation + zero pins OK`);
}

try {
  log("phase 1: final Review Hub surface contract");
  for (const v of VIEWPORTS) await coreViewport(v);

  log("phase 2: mobile targeted tool detail");
  await targetedMobileTool();

  log("phase 3: final pin semantics");
  await pinSemantics(VIEWPORTS[1]); // 390 mobile
  await pinSemantics(VIEWPORTS[3]); // 1280 desktop

  assert.deepEqual(pageErrors, [], `uncaught page error(s): ${JSON.stringify(pageErrors)}`);
  log(`${NAME}: PASS`);
} catch (error) {
  process.exitCode = 1;
  console.error(`${NAME}: FAIL -- ${error instanceof Error ? error.message : error}`);
  try {
    console.error(
      "state at failure:",
      JSON.stringify(
        await cdp.evaluate(`({
          innerWidth, innerHeight,
          surface: document.querySelector('main')?.dataset.reviewSurface ?? null,
          hubOpen: !!document.querySelector('[data-editor-review-hub-trigger][aria-expanded="true"]'),
          tools: [...document.querySelectorAll('${PANEL} [data-review-hub-tool]')].map((e) => e.dataset.reviewHubTool),
          pins: localStorage.getItem('${PINS_KEY}'),
          rawCount: document.querySelector('[data-editor-character-count]')?.textContent ?? null
        })`)
      )
    );
  } catch {}
} finally {
  await session.close();
}
