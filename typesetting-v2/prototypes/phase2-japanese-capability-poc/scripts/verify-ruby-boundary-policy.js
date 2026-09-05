// TSP-V2 Phase 2 P2-L07E — pure geometry test of the REAL decidePlacement()
// function (imported, not reimplemented) against synthetic inputs with
// obvious expected outcomes. Run with: node scripts/verify-ruby-boundary-policy.js
const { decidePlacement, rubyGeometry } = require("./build-visual-fidelity.js");

const cases = [
  { name: "CENTER", baseStart: 40, baseExtent: 20, rubyExtent: 30, lineExtent: 100, expected: "CENTER" },
  { name: "START_CLAMP", baseStart: 0, baseExtent: 10, rubyExtent: 30, lineExtent: 100, expected: "START_CLAMP" },
  { name: "END_CLAMP", baseStart: 90, baseExtent: 10, rubyExtent: 30, lineExtent: 100, expected: "END_CLAMP" },
  { name: "OVERFLOW_OPEN", baseStart: 40, baseExtent: 20, rubyExtent: 120, lineExtent: 100, expected: "OVERFLOW_OPEN" },
  { name: "START (non-overlong)", baseStart: 10, baseExtent: 30, rubyExtent: 20, lineExtent: 100, expected: "START" },
];

console.log("=== STEP 1: pure decidePlacement() geometry test ===");
let allPass = true;
for (const c of cases) {
  const result = decidePlacement(c.baseStart, c.baseExtent, c.rubyExtent, c.lineExtent);
  const pass = result.placement === c.expected;
  if (!pass) allPass = false;
  console.log(`${c.name}: expected=${c.expected} actual=${result.placement} topPx=${result.topPx.toFixed(2)} ${pass ? "PASS" : "FAIL"}`);
}
console.log("Pure policy test overall:", allPass ? "PASS" : "FAIL");

console.log("\n=== STEP 2/3: actual fixture geometry (real rubyGeometry(), real fixture text) ===");
const fixtures = [
  { name: "MIDDLE", text: "あああああ｜其《なにがし》あああ", cap: 14, expected: "CENTER" },
  { name: "LINE START (longText)", text: "｜其《なにがし》という名の男が現れた。誰も知らない人物だった", cap: 14, expected: "START_CLAMP" },
  { name: "LINE END", text: "あああああああああああああ｜其《なにがし》あ", cap: 14, expected: "END_CLAMP" },
];
for (const f of fixtures) {
  const { geometry } = rubyGeometry(f.text, f.cap);
  const g = geometry[0];
  if (!g) { console.log(`${f.name}: NO RUBY GROUP FOUND`); continue; }
  console.log(`${f.name}:`);
  console.log(`  base=${g.base} rt=${g.rt} baseStartPx=${g.baseStartPx.toFixed(2)} baseExtentPx=${g.baseExtentPx.toFixed(2)} rubyExtentPx=${g.rubyExtentPx.toFixed(2)} colHeightPx=${g.colHeightPx.toFixed(2)}`);
  const desiredStart = g.baseStartPx + g.baseExtentPx / 2 - g.rubyExtentPx / 2;
  const desiredEnd = desiredStart + g.rubyExtentPx;
  console.log(`  desiredStart=${desiredStart.toFixed(2)} desiredEnd=${desiredEnd.toFixed(2)} lineEnd(colHeightPx)=${g.colHeightPx.toFixed(2)}`);
  console.log(`  expected=${f.expected} actual=${g.placement} ${g.placement === f.expected ? "PASS" : "FAIL"}`);
}
