# P2-L02 — C1 vs C3 Multi-Preset Human QA Scorecard

- Status: **FROZEN 2026-09-05** — Human QA completed. Result is preset-dependent (not a uniform C1 or C3 win) — see per-preset results below and the root-cause diagnosis in `evidence/P2_L03_LAYOUT_FORMULA_AUDIT.md` (P2-L03).
- How to view: open `typesetting-v2/prototypes/phase2-typography-poc/multipreset-comparison.html` directly in a browser (no server needed).
- Context: P2-L01's repeat Human QA passed both C1 and C3 as publication-quality-acceptable for a single sentence at 文庫 (C3 marginally preferred, difference minimal; C2 deferred, not rejected — see `PHASE2_L01_TYPOGRAPHY_SCORECARD.md`). This scorecard asks whether that holds across all 8 mandatory presets, using a longer synthetic stress fixture (the canonical sentence repeated ×30) rather than just the single sentence.
- Known caveat going in: C3's panel shows the browser's own natural line-break/clip result against far more text than fits each preset's page-1 box; C1's panel shows a fixed deterministic slice at the preset's declared capacity. Whether these two boundaries land at the same point was **not measured by the agent** — part of what you're being asked to judge is exactly that (see "Determinism" below).

---

## Per-preset judgment

For each preset, inspect the C1/C3 pair and record:

### 文庫

- **Preferred: C1**

### A5 1段

- **Preferred: C1**

### A5 2段

- **Preferred: C1**

### B5 (1段)

- **Preferred: C3**
- Specific defect: **C1 judged too sparse / too loose** on B5 — consistent with the "known open item" flagged in `evidence/P2_L02_MULTIPRESET_MEASUREMENTS.md` §3 (B5's computed justified line pitch came out ~44% looser than declared font size). See P2-L03 (`evidence/P2_L03_LAYOUT_FORMULA_AUDIT.md`) for root-cause diagnosis of whether this is a real C1-architecture limitation or a PoC formula-fidelity problem.

### B6 (1段)

- **Preferred: C1**

### 新書 (1段)

- **Neither exactly ideal — Human preference sits visually between C1 and C3.** Not resolved by inventing a midpoint (explicitly out of scope); see P2-L03 for whether a principled existing metric corresponds to this preference.

### A6 (1段)

- **Preferred: C1**

### Web閲覧用 (1段)

- **Preferred: C3**
- Specific defect: **C1 judged too cramped / too tight** — the sequence around 「二人で」was particularly noticeable. See P2-L03 for root-cause diagnosis.

---

## Overall

Across presets, which feels more consistently publication-ready? **Preset-dependent — not a uniform win for either.** C1 preferred on 文庫/A5 1段/A5 2段/B6/A6 (5 of 8); C3 preferred on B5/Web閲覧用 (2 of 8); 新書 is an intermediate case (neither exact candidate ideal).

Any preset that clearly fails? **No outright failure recorded** — "acceptable overall except these C1 problem cases" (B5-too-loose, Web-too-tight). This is explicitly **not** to be reinterpreted as "C3 wins overall" or "C1 wins overall" — the Human evidence is preset-dependent, and P2-L03 investigates whether the B5/Web C1 problems are a real architecture limitation or an artifact of the PoC's simplified layout formula not faithfully reproducing TateSpun's actual `computePageLayout`.

Any other observations: the B5/B6/新書 "known open item" (looser computed line pitch flagged in P2-L02's measurements doc) turned out to correlate with at least one of the two reported C1 defects (B5) — see P2-L03 for whether that correlation is causal.
