# P3 — Ruby Standards Review (P3-O06)

- Status: **Human Rule-Freeze Gate CLOSED (2026-09-05).** HD-Q1 and HD-Q2 (§6) are now resolved by explicit Human decision — see "Human Rule-Freeze Decisions" section below. This does **not** overwrite Phase 2's Human-approved ruby behavior (Master §25.6/HD-020) — it extends it. Master updated to v1.6 (§26).
- Resolves/narrows: Phase 3 Open Item P3-O06 (`PHASE3_OPEN_ITEMS.md`)
- Primary source: `../../research/phase3/P3_L01_PRIMARY_SOURCE_LEDGER.md` SOURCE-001, sections `#ruby_and_emphasis_dots`, `#positioning_of_jukugoruby`, `#notes_a3` (cl-21/22/23 rules), `#cl-08` overhang note.

## Human Rule-Freeze Decisions (2026-09-05)

**HD-Q1 — RESOLVED: jukugo-ruby internal breakability capability APPROVED.** Phase 3 Core must be *capable of* representing legal internal break opportunities between a jukugo-ruby group's individual base-character + ruby-segment pairs, consistent with jlreq's cl-23 rule (§1 finding 2 above). This is a **Core data-model capability requirement**, not "all ruby may break anywhere" — Phase 2's Human-approved unbroken-run behavior for **mono-ruby (cl-22) and group-ruby** is explicitly retained, unchanged, as the atomic case. The Core must therefore be able to conceptually distinguish at least: (a) atomic/group ruby (one unbroken run, Phase 2 behavior, retained), and (b) jukugo-ruby with internal base↔ruby-segment relationships (new capability, this decision). **Exact data-model shape is deferred to Phase 3 Core Contract (P3-L02) — this decision freezes the requirement, not an implementation.**

**HD-Q2 — RESOLVED IN PRINCIPLE: character-class-aware ruby overhang budgets APPROVED, layered on top of the retained geometry clamp.** The future logical policy is: (1) determine ruby/base relationship, (2) determine any source-backed adjacent-character-class overhang allowance, (3) calculate desired placement, (4) apply line/column boundary protection — the already Human-approved CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN clamp (Master §25.6/HD-020), which is **not discarded**. The base-position invariant (ruby never moves body text) is likewise **not** affected by this decision. **Exact numeric budget values are explicitly NOT frozen here** — where jlreq documents multiple legitimate conventions (e.g. overhang onto kanji: "never" vs. "up to half-width"; onto opening brackets: "up to full ruby-width" vs. "none/half-width"), no convention is silently chosen. This sub-question remains **OPEN** (see `PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md` row 22b) for a future, narrower Human decision before Core hard-codes any specific numeric budget.

**Classification discipline:** both decisions are **PRODUCT_POLICY/CORE-CAPABILITY decisions built on STANDARD_BACKED jlreq evidence** — Human approval of a capability requirement is not itself a claim that jlreq mandates TateSpun's exact eventual implementation.

---

## 1. Authoritative evidence

jlreq documents **at least three distinct ruby placement styles**, each with different composition behavior — this is the single most important finding of this review, because Phase 2's approved policy (Master §25.6) treats ruby as one uniform behavior, and jlreq does not:

1. **モノルビ / mono-ruby (jlreq class cl-22, "simple-ruby character complexes"):** one ruby annotation attached to a single base character. jlreq's break rule (`#notes_a3` id596): **no line-break opportunity within the same cl-22 complex; a break opportunity exists between two different cl-22 complexes.** I.e., each individual base-character+ruby pair is atomic; adjacent pairs are independent.

2. **熟語ルビ / jukugo-ruby (jlreq class cl-23, "jukugo-ruby character complexes"):** ruby for a multi-character compound word, where each base kanji gets its own ruby segment (allocated per-character when each character's reading is ≤2 kana, per `#positioning_of_jukugoruby` / `#principles_of_jukugoruby_distribution_1`), with overflow explicitly permitted to spill onto **neighboring base characters within the same word** (up to full-width or 1.5×, preferring the character *after*, per `#principles_of_jukugoruby_distribution_2`). jlreq's break rule (`#notes_a3` id597) is **structurally different from cl-22**: *"A line break opportunity exists between two consecutive base characters belonging to the same jukugo-ruby character complex (cl-23)... and between two runs of ruby text accompanying the corresponding base characters. However, a base character and the accompanying ruby text shall be indivisible."* In other words: **jlreq explicitly permits breaking a line in the middle of a jukugo-ruby word**, between one base-kanji-plus-its-ruby-segment and the next — it is only each individual (kanji, ruby-segment) pair that must stay together, not the whole compound word.

3. **グループルビ / group-ruby** (mentioned at `#ruby_and_emphasis_dots`, id~3423): ruby distributed evenly across the *entire* base word as one unit ("複数の親文字で構成される語全体に掛かるように配置する" / positioned so the ruby applies evenly across the whole multi-character word). Its specific break-rule classification was **not located** in this pass (it is not one of the cl-21/22/23 entries explicitly enumerated in `#notes_a3`) — **recorded OPEN**, not investigated further within this loop's timebox (a genuinely different research question from the mono/jukugo distinction above, and third-priority per the loop brief's ordering).

**Ruby overhang onto adjacent (non-ruby) characters** (`#ruby_and_emphasis_dots`, multiple notes around id~4100–4180):
- Overhang onto plain **cl-19 ideographic characters (kanji) is forbidden** by the primary rule ("前又は後ろにくる漢字等（cl-19）にルビ文字を掛けてはならない" — ruby must not overhang onto adjacent kanji), **though jlreq documents an alternate, also-legitimate convention that permits up to half the ruby character's width onto adjacent kanji/hiragana/katakana** — explicitly framed as "another processing method" (処理法), i.e. Product Policy, not a single mandatory rule.
- Overhang onto **cl-08 (dash/ellipsis, the same class covered in the Dash/Ellipsis Freeze Candidate) is permitted, up to the full width of the ruby character size** (`#cl-08` overhang note, directly verified).
- Overhang onto **cl-05 (middle dots) is permitted, up to full width**, reduced if adjacent spacing has already been compressed by line adjustment.
- Overhang onto **cl-01 (opening brackets) is optional** — jlreq documents both "allow full ruby-width overhang" and "disallow, or cap at half-width" as legitimate conventions, again explicitly Product Policy.
- **Jukugo-ruby at line start/end** (`#ruby_and_emphasis_dots` id~4259/4267): when a jukugo-ruby word falls at the start (or end) of a line, the ruby string's start (end) aligns with the base string's start (end) at the line boundary; if ruby overflows even after using the intra-word overhang budget, the base character spacing may be expanded instead.

## 2. Phase 2 approved TateSpun behavior (Master §25.6 / HD-020, restated for comparison, not altered)

- Base-position invariant: ruby never moves body text (verified via real DOM `getBoundingClientRect` measurement, 0.00px delta).
- **Every ruby logical group is treated as ONE unbroken annotation run** — no distinction between mono-ruby-style and jukugo-ruby-style groups.
- Geometry-based boundary policy for overlong ruby, relative to **line/column extent** (not adjacent-character class): CENTER / START_CLAMP / END_CLAMP / OVERFLOW_OPEN.
- Explicitly recorded as Human-approved Product/Renderer behavior, **not** a claim of full JLREQ/JIS compliance.

## 3. Matches

- The **mono-ruby (cl-22) case** — Phase 2's "one unbroken annotation run, base-position invariant" policy is **directly consistent** with jlreq's cl-22 rule (atomic base+ruby pair, breakable only between separate pairs). For TateSpun's current, predominant ruby use case (single-word/short-phrase ruby), Phase 2's policy is standards-aligned.
- **CENTER-style geometry overhang** for overlong ruby is broadly consistent in spirit with jlreq's own permission for ruby to overhang adjacent characters when it doesn't fit the base width — both frameworks agree overlong ruby needs *some* overhang/clamping strategy rather than forced shrinkage, wrapping, or truncation.

## 4. Differences

1. **Jukugo-ruby internal breakability.** jlreq explicitly permits a line break *inside* a jukugo-ruby group (between its component base-character+ruby-segment pairs); Phase 2's policy currently forbids this unconditionally by treating the whole group as one unbroken run. This is the most concrete, evidence-backed gap found in this review.
2. **Character-class-specific overhang budgets.** jlreq's overhang rules are keyed to the *adjacent character's class* (forbidden onto plain kanji by the primary convention, up to full-width onto cl-08/cl-05, optional onto cl-01). Phase 2's CENTER/START_CLAMP/END_CLAMP policy operates purely on **line/column geometric extent**, with no adjacent-character-class awareness at all. These are different axes (jlreq: micro, per-neighbor; Phase 2: macro, per-line), not strictly contradictory, but Phase 2's policy is coarser than what jlreq documents as the fuller convention.
3. **Group-ruby style** is not modeled as a distinct case in Phase 2's policy at all (nor was its jlreq break-rule fully located in this pass — see OPEN above).

## 5. Ambiguous / optional areas (jlreq itself offers more than one convention)

- Overhang onto plain kanji/hiragana/katakana: jlreq documents **both** "never" and "up to half-width" as legitimate, named alternate methods.
- Overhang onto opening brackets: jlreq documents **both** "up to full ruby-width" and "none, or half-width" as legitimate.
- Whether cl-09/cl-10/cl-11 stay split (jlreq's default) or merge (JIS X 4051's older convention) indirectly affects which characters are even eligible neighbors for ruby overhang math, though this is really a kinsoku-table question (see Kinsoku Freeze Candidate).

## 6. Potential Human Decisions

Per the loop brief's instruction to ask concrete, evidence-backed alternatives rather than vague questions:

**HD-Q1 — Jukugo-ruby internal breakability.** Should Phase 3's Canonical Layout Model:
- (a) **Keep Phase 2's policy unconditionally** (every ruby group — mono or jukugo — is one unbroken run, regardless of jlreq's cl-23 allowance), accepting this is stricter than jlreq's documented convention but simpler and already Human-approved; or
- (b) **Add jukugo-ruby-specific breakability** (distinguish "one base char, one ruby segment" pairs as the atomic unit, allow breaks between pairs within a jukugo word), matching jlreq's cl-23 rule more closely, at the cost of new complexity (per-character ruby-segment allocation, per `#principles_of_jukugoruby_distribution_1`) that TateSpun's current data model (does it even distinguish mono-ruby from jukugo-ruby today?) may not yet support?

**HD-Q2 — Character-class-aware overhang.** Should Phase 3's overhang policy:
- (a) **Keep Phase 2's line/column-geometry-only CENTER/START_CLAMP/END_CLAMP policy** as the complete overhang model (simpler, already Human-approved, ignores which specific character is adjacent); or
- (b) **Layer in jlreq's adjacent-character-class-specific overhang budgets** (never onto kanji by default, up to full-width onto cl-08/cl-05, optional onto brackets) as an additional constraint on top of the existing line/column clamp, closer to full jlreq compliance but a materially larger renderer-policy surface?

Neither question is being answered in this loop — both are recorded for the Human Rule-Freeze Gate.

## 7. Recommended Core-vs-Renderer boundary

- **Core (Canonical Layout Model) responsibility:** ruby-to-base association, atomic-unit determination (which characters must never be split from each other — this is where HD-Q1's answer lives), base-position invariance, source mapping of ruby runs.
- **Renderer responsibility:** the actual pixel-level overhang amount onto a specific neighboring glyph (this is where HD-Q2's finer character-class budgets, if adopted, would be applied) — Master §25.5 already places painting-level decisions downstream of Core's logical decisions, and overhang-onto-a-specific-glyph is a painting-level concern by that same logic, informed by (not overridden by) Core's atomic-unit boundaries.

## 8. What must be frozen before Core implementation

Nothing here blocks Phase 3 Core from starting — Phase 2's ruby policy remains valid and Human-approved as a default. **What should be frozen before Phase 3 Core hard-codes ruby data structures specifically** is HD-Q1 (mono-ruby vs. jukugo-ruby distinction), because it determines whether the Core's ruby data model needs a per-base-character ruby-segment field (jukugo-ruby-aware) or can stay a single base-group-to-single-annotation-run field (Phase 2's current shape). Retrofitting this later, after Core's data model is built around the simpler shape, would be more expensive than deciding it now. HD-Q2 is lower-priority — it only affects the Renderer layer, which is separately OPEN anyway (P3-O09).

**Core blocker: NO** (Phase 2's existing Human-approved policy is a valid, standards-non-contradicting default to build Core against; HD-Q1/HD-Q2 refine rather than block it).
