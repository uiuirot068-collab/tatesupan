# B6 傍点 — Human QA / decisions

B6 is **BLOCKED / PARITY NOT PROVEN**, so there is no B6 behaviour to test yet. What is needed from the Human is a small set of **decisions and fixtures**, so that a future B6 loop can start without rediscovering them (`B6_ARCHITECTURE_DECISION.md` §5).

## A. Decisions (please answer)
1. **Which renderer does production use?** (Cloudflare Pages → Settings → Environment variables → `NEXT_PUBLIC_TATESPUN_RENDERER` for *Production*): ☐ unset / LEGACY ☐ V2_BETA ☐ don't know
2. **Scope for a beta:** ☐ both renderers must show identical 傍点 ☐ LEGACY-only is acceptable if V2_BETA is explicitly unsupported ☐ defer B6 entirely
3. **Ruby + 傍点 on the same characters:** ☐ forbid combining (ruby wins) ☐ dots on the opposite side of the ruby ☐ other: ______
4. **Punctuation / 縦中横:** dot on 「」・。、? ☐ yes ☐ no ☐ only on the enclosed text; one dot per TCY cell or per digit? ______
5. **Dot look:** size ______ (e.g. ~0.3 em) / distance from the glyph ______ — a Human will judge this from a printed fixture.
6. **Go / no-go** on a dedicated V2 loop that amends the frozen Core contract (multi-day, golden re-baseline): ☐ go ☐ no-go ☐ later

## B. Fixtures the Human can prepare (optional; used later for visual judgement)
- One paragraph with 傍点 in the middle of a line, at a line start, at a line end, across a line break, across a page break.
- 傍点 over a word that has ruby; over 「かぎ括弧」 and 。、; over `[tate]12[/tate]`.
- The same text shown as: Editor, Preview, JPG, PDF — for both renderer modes if both are in scope.

## C. Today's behaviour to be aware of
Typing `《《強調》》` now produces literal characters in every surface (no emphasis) — see `parity/current-behaviour-of-proposed-notation.json`. Please do **not** rely on that notation in real manuscripts until B6 defines it (its meaning would change when B6 ships).

Result: ☐ decisions returned ☐ B6 stays deferred
