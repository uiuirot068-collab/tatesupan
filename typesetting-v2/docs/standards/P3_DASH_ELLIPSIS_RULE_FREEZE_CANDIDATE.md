# P3 — Dash / Ellipsis Rule Freeze Candidate (P3-O02)

- Status: **Human Rule-Freeze Gate CLOSED (2026-09-05).** This item required no Human decision (no HG-question was raised for it — the semantic-run rule was STANDARD_BACKED with no legitimate-alternative-convention ambiguity requiring a Product choice). RESOLVED and binding as of the 2026-09-05 closeout. Master updated to v1.6 (§26). Visual alignment (P3-O04/O05) remains untouched, RENDERER_ONLY, and still OPEN — this closeout does not touch it.
- Resolves/narrows: Phase 3 Open Item P3-O02 (`PHASE3_OPEN_ITEMS.md`)
- Primary source: `../../research/phase3/P3_L01_PRIMARY_SOURCE_LEDGER.md` SOURCE-001 (verified) and SOURCE-003 (corroborating)

## Correction of the prior citation

Master §19 and P1-L10a recorded a citation to **"jlreq §3.1.10"** for dash/ellipsis inseparability, which P1-L10a already flagged as unverifiable. **This loop directly confirms the correction stands: jlreq's live document has no "§3.1.10" or any classical numbered-clause scheme at all** (checked directly against the downloaded source — grepped for section-numbering patterns and found none). The number was not found in this pass either, from a different retrieval route (direct source download + grep, not fetch-and-summarize), which raises confidence it does not exist in this edition rather than merely being hard to reach.

**The underlying rule itself, however, is real and is now directly verified** — it just doesn't live at a numbered section. It lives at anchor `#cl-08` (class definition) and `#notes_a3` (the actual breakability rule), both inside `#appendix_3` / `#possibilities_for_linebreaking_between_characters`. This freeze candidate cites those anchors, not an invented section number.

**previous invalid citation corrected: YES.**

---

## A. Semantic-run behavior — STANDARD_BACKED

jlreq classifies EM DASH (—, U+2014), HORIZONTAL ELLIPSIS (…, U+2026), and TWO DOT LEADER (‥, U+2025) together as **cl-08, "Inseparable characters" (分離禁止文字)** (`#cl-08`, example list: "—…‥ etc."). This is a real, named, primary-source-verified character class — not an invented TateSpun convention.

**TateSpun's product convention of ―― (paired em dash) and …… (paired ellipsis) as the canonical "run" forms is consistent with, but not identical to, jlreq's own framing**: jlreq's rule (below) operates on *any two consecutive same-kind cl-08 characters*, which is exactly what a doubled ―― or …… is, but jlreq does not itself mandate "always write dashes/ellipses in pairs" as an authorship rule — it describes what happens *if* they appear consecutively. The doubling convention itself is a widely-used Japanese typesetting/editorial convention (and matches TateSpun's existing product behavior), not a jlreq requirement. **Classification: the "run exists and must stay together" behavior is STANDARD_BACKED; "authors should type them in pairs" is an editorial/PRODUCT_POLICY convention outside jlreq's scope.**

## B. Break / keep-together behavior — STANDARD_BACKED

Verbatim rule (`#notes_a3`, id589–id594, id595 for the "different kind" clause):

> "There is no line break opportunity between following couple of consecutive inseparable characters (cl-08) as follows: EM DASH+EM DASH; HORIZONTAL ELLIPSIS+HORIZONTAL ELLIPSIS; TWO DOT LEADER+TWO DOT LEADER; [and two specific vertical-kana-repeat-mark pairs, 〳+〵 and 〴+〵, not relevant to TateSpun's current character set]. When the combination of preceding and trailing inseparable characters is different from each other, the two characters are separable. For example, when two EM DASH appear consecutively, these two characters are inseparable, and consecutive EM DASH and HORIZONTAL ELLIPSIS are separable."

**This is the precise, complete rule**, directly resolving what P1-L10a could not find:

- **Same-kind cl-08 runs are inseparable** (must not break between them): —— stays together, …… stays together, ‥‥ stays together.
- **Different-kind cl-08 adjacency IS breakable**: e.g. —… (dash immediately followed by ellipsis) may break between them.
- This is a **class-and-identity** rule, not merely a class rule: "same kind" means the same specific character (EM DASH pairs only with EM DASH), not "any two cl-08 members." A Phase 3 Core implementation must key inseparability by character identity within cl-08, not by class membership alone (see Kinsoku Freeze Candidate's "Core Data Model Candidate" note on this exact point).
- **Conformance-level nuance (Product Policy, not part of the base rule):** jlreq's own Addendum lists **same-kind cl-08 inseparability as relaxable** at looser conformance levels — fully relaxable at "Level 1" (very loose/newspapers), and *partially* relaxable at "Level 2" (loose/magazines) — but at Level 2, **only** the ellipsis-pair and two-dot-leader-pair exception is listed, **not** the dash-pair exception (`#addendum_a3`, id607 vs id616). I.e. jlreq's own "loose" convention treats …… as more freely breakable than ——. This is a genuine, citable, non-obvious asymmetry TateSpun should be aware of if it ever offers a "looser" line-breaking mode.

**Character-run length is not specified by jlreq at all** — jlreq's rule is purely pairwise ("no break opportunity between these two adjacent characters"); it says nothing about a maximum or canonical run length (e.g. "exactly 2" for ――). A pairwise-inseparable rule applied transitively across a run of any length (2, 4, 6 same characters) naturally produces "the whole run stays together" as an emergent property, without jlreq needing to state a run-length rule directly — this is worth noting as the correct mental model for Phase 3 Core (implement the pairwise rule, not a special-cased "runs of exactly 2" rule).

## C. Source mapping — no jlreq content (PRODUCT_POLICY / engineering concern, not a standards question)

jlreq does not address source-mapping (manuscript-to-glyph range tracking) at all — this is purely a TateSpun engineering concern. Phase 2 (P2-L05) already demonstrated dash/ellipsis run source-mapping is representable in the C1-NATURAL architecture; nothing in this loop's research changes that. **Classification: PRODUCT_POLICY / engineering, not addressed by the standard either way — no conflict.**

## D. Vertical glyph orientation — RENDERER_POLICY

jlreq's rule above is entirely about **line-breaking/composition** (should a break exist between these two characters), not about **glyph shape or orientation** (how the dash/ellipsis glyph itself is drawn when rotated for vertical writing). Vertical-orientation glyph selection is governed by OpenType features (`vert`/`vrt2`) and font-specific glyph design — outside jlreq's scope entirely, and outside this loop's research question per the loop brief. **Classification: RENDERER_POLICY, not addressed by this loop.**

## E. Visual centering / alignment — RENDERER_POLICY / OPEN (explicitly not closed here)

"Dash looks slightly left-shifted" (P3-O04) and "ellipsis looks slightly left-shifted" (P3-O05) are **renderer/glyph-painting defects**, not semantic composition-rule questions — jlreq's cl-08 rule (which characters must stay adjacent) is silent on sub-pixel/optical glyph placement within their advance box. **This loop does not touch P3-O04/O05 and does not close visual alignment.** Per the loop brief: **Classification: RENDERER_POLICY / OPEN**, explicitly not resolved by this standards research, and not conflated with the semantic run rule above.

---

## Summary classification table

| Aspect | Classification | Confidence |
|---|---|---|
| cl-08 classification of —/…/‥ | STANDARD_BACKED | HIGH (direct anchor `#cl-08`) |
| Same-kind-pair inseparability rule | STANDARD_BACKED | HIGH (direct anchor `#notes_a3` id589–595) |
| Different-kind-pair separability | STANDARD_BACKED | HIGH (same anchor, explicit dash/ellipsis worked example) |
| Doubled ――/…… as the *authoring* convention | PRODUCT_POLICY (editorial convention, not a jlreq mandate) | MEDIUM |
| Conformance-level relaxation (Level 1/2 asymmetry) | PRODUCT_POLICY (jlreq documents it as implementation-defined) | HIGH (directly quoted) |
| Source mapping | PRODUCT_POLICY / not addressed by standard | N/A |
| Vertical glyph orientation | RENDERER_POLICY | N/A (out of scope by definition) |
| Visual/optical alignment (P3-O04/O05) | RENDERER_POLICY / OPEN | N/A (explicitly not investigated here) |

**Core implementation blocker: NO.** The semantic run/break rule (the part that actually determines Canonical Layout Model line-breaking) is now STANDARD_BACKED with a directly-verified, correctly-cited primary source. Nothing here blocks Phase 3 Core from implementing dash/ellipsis run-inseparability correctly. The remaining open items (P3-O04/O05 visual alignment) are renderer-level and were already separated from architecture/core work by Product Owner decision in P2-L06.
