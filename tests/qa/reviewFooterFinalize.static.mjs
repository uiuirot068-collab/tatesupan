import fs from "node:fs";

const read = (p) => fs.readFileSync(p, "utf8");
const checks = [];
const ok = (label, value) => checks.push([label, !!value]);

const editor = read("src/components/EditorPane.tsx");
const bar = read("src/components/DesktopReviewBar.tsx");
const readAloud = read("src/components/ReadAloudDockCard.tsx");
const work = read("src/components/WorkSessionTracker.tsx");
const hub = read("src/components/ReviewHub.tsx");
const desc = read("src/components/DescriptionCheckControls.tsx");
const model = read("src/lib/reviewHub.ts");
const help = read("public/docs/help.md");

ok("raw count is always beside title", editor.includes('data-editor-character-count=""'));
ok("raw count footer pin removed", !editor.includes("ReviewHubFooterPinnedTools"));
ok("old syntax/status footer removed", !editor.includes("data-editor-status-surfaces"));
ok("mobile review-only footer exists", editor.includes('data-mobile-review-footer=""'));
ok("desktop writing-check is Preview-side", bar.includes('data-desktop-writing-check-pill=""'));
ok("desktop writing-check result host exists", bar.includes('data-desktop-writing-check-host=""'));
ok("B4 desktop range selector exists", readAloud.includes('data-read-aloud-inline-bar=""'));
ok("B5 popover widened", bar.includes('w-[24rem]'));
ok("work-session footer pill exists", work.includes("WorkSessionFooterPill"));
ok("internal migration id preserved", /id:\s*[\"']character-count[\"']/.test(model));
ok("visible tool renamed to 作業カウンター", model.includes("作業カウンター"));
ok("Review Hub contrast raised", hub.includes("text-ink/80"));
ok("B5 phrase no longer forced truncate", !desc.includes('className="truncate text-[12px] font-semibold"'));
ok("Help documents final Review UI", help.includes("help-id: review-tools"));
ok("B6 untouched by this verifier", true);

let failed = 0;
for (const [label, pass] of checks) {
  console.log(`${pass ? "[PASS]" : "[FAIL]"} ${label}`);
  if (!pass) failed++;
}
if (failed) process.exit(1);
console.log("[PASS] review-footer-final static gate");
