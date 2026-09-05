# P2-L07B — Unbroken Ruby Human QA Scorecard

- Status: **FROZEN 2026-09-05** — Human QA completed. 東京（とうきょう）: no wrap, belongs to whole group, hangs from start, body unchanged, NATURAL. 其（なにがし）: remains one continuous run, body unchanged, but **start-anchored placement without centering judged NOT ACCEPTABLE** for this overlong case — Human explicitly rejected a `baseLength==1` special case and instead requested a generic geometry rule (center only when `rubyExtent > baseExtent`). See P2-L07C.
- How to view: open `typesetting-v2/prototypes/phase2-japanese-capability-poc/visual-fidelity-comparison.html` → Feature C (Ruby).
- Context: P2-L07 confirmed the base-position invariant (ruby never shifts body text) but found the annotation itself wrapped into a second column, worse for long ruby than short. P2-L07B fixed the annotation box sizing generically (narrow fixed width, unconstrained height, start-anchored to the base group) — reasoned from CSS box-sizing mechanics, but **not independently screenshotted** this loop (a permission guard blocked headless-browser verification). Please report exactly what you see.
- Single-character-base long ruby (其/なにがし) intentionally uses the same simple start-anchored rule as short ruby, not a centered placement — this was a deliberate scope decision (avoiding special-case complexity), not an oversight; final overflow/centering policy remains OPEN regardless.

---

## 東京（とうきょう）

1. Ruby is one continuous vertical run: **YES**
2. Ruby clearly belongs to 東京: **YES**
3. Ruby wraps/breaks: **NO**
4. Body text shifted: **NO**
5. Appearance: **NATURAL**

## Long-ruby (其 / なにがし)

6. Ruby remains one continuous run: **YES**
7. Body remains fixed: **YES**
8. Appearance: **NOT ACCEPTABLE** — start-anchored placement without centering rejected; Human wants geometry-based conditional centering (rubyExtent > baseExtent), not a baseLength==1 special case. See P2-L07C.
9. Continue with this ruby renderer rule? **NO** (as shipped in P2-L07B) — superseded by P2-L07C.

---

Any other observations —
