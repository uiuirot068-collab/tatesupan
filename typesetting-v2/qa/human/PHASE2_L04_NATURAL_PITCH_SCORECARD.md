# P2-L04 — Natural-Pitch C1 Human QA Scorecard

- Status: **FROZEN 2026-09-05** — Human QA completed against the P2-L04B-corrected comparison page. Result below is preset-dependent, recorded verbatim; the "Interpretation" section is the agent's engineering reading of that result, explicitly not attributed to the Human.
- How to view: open `typesetting-v2/prototypes/phase2-typography-poc/natural-pitch-comparison.html` directly in a browser (no server needed). Judge primarily from the long non-repeating prose (Fixture B) shown in each preset's three-way panel; the compact "Fixture A" section at the bottom (canonical sentence, all presets) is for technical/diagnostic continuity only, not the primary Human judgment.
- Context: P2-L03 traced the P2-L02 preset-dependent split to two different causes — B5/新書's "too loose" (C1) was a **real, already-shipped** production stretch behavior (`justified` gridMode), while Web閲覧用's "too cramped" (C1) was a **PoC unit-conversion bug**. This loop tests a principled alternative — **C1-NATURAL** (Production's own existing "solid"/1-em mode, applied uniformly instead of per-preset) — against the corrected `C1-JUSTIFIED` and against `C3`, on the 3 presets that discriminated plus 2 controls.
- Important: v2's kinsoku/hanging-punctuation rules are **not** finalized (Master, Phase 1 standards-verification still OPEN). Judge character rhythm, density, visual balance, and naturalness — **not** line-start/line-end punctuation correctness, which is not yet a final rule in this PoC.
- Reminder: all three candidates use the same font (Shippori Mincho) and the same line pitch per preset — only the down-column character pitch differs between C1-JUSTIFIED and C1-NATURAL.

---

## B5

- **Preferred: C3**
- **Does C1-NATURAL fix the "too sparse" impression from P2-L02?** **IMPROVED** (Human noted improvement even though C3 was still the overall preference for this preset).

## 新書

- **Preferred: C1-NATURAL**

## Web閲覧用

- Old P2-L02 C1 sample: **INVALID (unit bug) — not shown again.**
- **Preferred: C1-NATURAL**
- **Does the corrected C1-NATURAL fix the previous "too cramped" impression?** **IMPROVED.**

## 文庫 (control)

- **Preferred: C1-JUSTIFIED**
- **Did 文庫 become worse under either C1 variant?** **NO** — no regression observed.

## A5 1段 (control)

- **Preferred: C1-NATURAL** (note: for this preset C1-JUSTIFIED and C1-NATURAL are formula-identical — Production already uses `solid`/1-em mode here — so this preference is effectively "the existing A5 1段 rendering," not a new distinct variant.)
- **Did A5 1段 become worse?** **NO** — no regression observed.

---

## Overall

Preferred visual result, per preset: 文庫 → **C1-JUSTIFIED**; A5 1段 → **C1-NATURAL** (formula-identical to JUSTIFIED here); B5 → **C3**; 新書 → **C1-NATURAL**; Web閲覧用 → **C1-NATURAL**.

Across the 5 tested presets, which variant feels most consistently publication-ready overall? **Not explicitly answered by the Human — not fabricated here.** The per-preset preferences above are themselves preset-dependent (not a single uniform winner): C1-NATURAL was preferred on 3/5 (A5 1段, 新書, Web閲覧用), C1-JUSTIFIED on 1/5 (文庫), C3 on 1/5 (B5).

Publication quality: **YES**, overall, subject to the per-preset preferences above.

Any other observations: B5's "too sparse" impression and Web閲覧用's "too cramped" impression were both **improved** by C1-NATURAL relative to their P2-L02 baselines, even though B5's overall preference still went to C3.

---

## Engineering interpretation (agent's reading — NOT a Human quote, recorded separately per instruction)

- C1-NATURAL remains strongly viable: it resolved both previously-identified C1 defects (B5-sparse, Web-cramped) without harming either control preset (文庫, A5 1段).
- C3 remains an important visual/control candidate — it was still preferred outright on B5.
- C1-JUSTIFIED should **not** become the general v2 policy merely because 文庫 preferred it — 文庫's own stretch ratio (1.05×) is mild, so this preference doesn't generalize to presets with larger stretch amounts (B5, 新書) the way this loop's evidence shows.
- No per-preset pitch tuning is authorized by this result — none was introduced, and none is implied as a next step.
- C2 remains DEFERRED (unchanged).
- Final architecture remains **NOT SELECTED**.
