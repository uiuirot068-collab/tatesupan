# P2-L01 — Typography PoC Human QA Scorecard

- Status: **FROZEN (second pass complete, 2026-09-05)** — C1 PASS, C3 PASS (near-tie, C3 marginally preferred by one reviewer), C2 DEFERRED (not rejected). Both C1 and C3 carried forward into P2-L02 (`PHASE2_L02_MULTIPRESET_SCORECARD.md`) for a multi-preset stability check. Master §11.1: Human Visual QA remains the PASS authority — nothing below is agent-fabricated detail.
- How to view: open `typesetting-v2/prototypes/phase2-typography-poc/comparison.html` directly in a browser (no server needed), and/or `typesetting-v2/prototypes/phase2-typography-poc/outputs/comparison-screenshot.png` for a static reference, and/or `outputs/c1-c3-bunko-native-printtopdf.pdf` for the PDF spike.
- Preset: 文庫 (1-column). Font: Shippori Mincho. Sentence: the canonical regression sentence (Master §11.3).

---

## First pass (2026-09-05, against the original diagnostic-decorated comparison.html)

## C3 — Browser Control

- General vertical rhythm:
- 「。け」spacing (the gap between だ。and けれど):
- 「、ど」spacing (the gap between ば、and どこへ):
- Naturalness: **judged not acceptable / visually unnatural**
- Obvious defects:

## C1 — Pragmatic Hybrid (explicit grid)

- General vertical rhythm:
- 「。け」spacing:
- 「、ど」spacing:
- Naturalness: **currently judged the most natural of the three; publication quality appears potentially acceptable (provisional, not final)**
- Obvious defects: none reported beyond the presentation issue below

## C2 — Dedicated Shaping

- General vertical rhythm:
- 「。け」spacing:
- 「、ど」spacing:
- Naturalness: **INCONCLUSIVE — could not be fairly judged**
- Obvious defects: rendered sample was clipped / too large in the comparison presentation to inspect fairly (a presentation problem, not a typography judgment — see P2-L01B)

---

## Overall (first pass)

Preferred visual result so far: **C1**

Publication quality: **PROVISIONAL YES for C1; FINAL = HOLD until a clean, non-diagnostic-decorated comparison exists and is reviewed** (P2-L01B partially addresses the C2-clipping problem — new correctly-scaled/sliced C2 SVG assets now exist — but `comparison.html` was not yet rebuilt to remove the yellow highlighting or wire in the new C2 assets; typography itself was not changed in either pass).

Any other observations: judgment on C1 was obstructed by yellow diagnostic highlighting overlaid on the manuscript; C2's judgment was obstructed by the rendered sample being clipped/oversized in its panel. Neither issue is a typography finding — both are being corrected in P2-L01B as presentation-only fixes.

---

## Second pass — pending

**Status: HOLD — likely complete, but unverified in-session.** P2-L01C (`scripts/build-comparison.js`) was rewritten to wire the already-generated C2 assets (`outputs/c2-full.svg`, `outputs/c2-focus-daketo.svg`, `outputs/c2-focus-bado.svg`) into `comparison.html`, with yellow highlighting and C1 grid/cell borders moved behind a "診断表示" checkbox (CSS-only, `#diagToggle:checked ~ .page ...`, unchecked/OFF by default), plus a new focused-comparison section showing 「それまでだ。けれど」and「気づけば、どこへ」for all three candidates at a shared 24pt scale. The build script ran once successfully (confirmed via its own console output and file size, 92,921 bytes written). **However, verification of the resulting page (grep sanity-check, headless screenshot) was interrupted by a tooling/permission guard twice in a row, and per instruction no further verification was attempted this loop.** Treat `comparison.html`'s actual current on-disk state as *probably* correct but not independently confirmed before a Human opens it. If anything looks wrong when opened, that's the thing to report back, not a sign this note is wrong.

## C3 — Browser Control (second pass)

- General vertical rhythm:
- 「。け」spacing:
- 「、ど」spacing:
- Naturalness:
- Obvious defects:

## C1 — Pragmatic Hybrid (second pass)

- General vertical rhythm:
- 「。け」spacing:
- 「、ど」spacing:
- Naturalness:
- Obvious defects:

## C2 — Dedicated Shaping (second pass)

- General vertical rhythm:
- 「。け」spacing:
- 「、ど」spacing:
- Naturalness:
- Obvious defects:

## Overall (second pass) — FROZEN 2026-09-05

- **C1 — Pragmatic Hybrid: PASS** — natural, publication-quality acceptable.
- **C3 — Browser Control: PASS** — natural, publication-quality acceptable.
- **External second Human opinion:** C3 looked very slightly better than C1, but the difference was described as very small.
- **C2 — Dedicated Shaping: DEFER** — not fairly Human-judgeable because the comparison presentation remains clipped/incomplete. **Not technically rejected** — deferred, not required for the current C1/C3 discrimination. Reopen only if C1 and C3 both fail a Publication Quality requirement, or if Phase 2 evidence reveals a shaping-control requirement neither can satisfy.

Preferred visual result: **C1 and C3 both carried forward** (near-tie; C3 marginally preferred by one reviewer, difference minimal).

Does any candidate look publication-quality enough to continue? **Yes — C1 and C3 both do**, for this single-sentence/文庫 fixture. Whether that holds across TateSpun's other mandatory presets and under real pagination is the open question carried into P2-L02 (`multipreset-comparison.html`, `qa/human/PHASE2_L02_MULTIPRESET_SCORECARD.md`).

Any other observations: none beyond what's recorded above (no numeric scores were supplied by the Human and none are fabricated here).
