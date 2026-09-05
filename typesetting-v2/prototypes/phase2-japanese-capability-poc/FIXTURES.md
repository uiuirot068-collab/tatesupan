# P2-L05 — Fixture Manifest

Small, targeted fixtures per capability (not one giant repeated sentence). Each demo capacity is a **PoC demonstration value chosen to force the relevant rule to fire within a short fixture** — it is NOT tied to any real preset's `charsPerLine` and must not be read as a preset recommendation.

| ID | Purpose | Source text | Demo capacity (cells) | Expected structural behavior | Status |
|---|---|---|---|---|---|
| F-KINSOKU | 行頭禁則 push-out: naive break lands right before a closing bracket (」) | `これはテストです」と彼は静かに言った` | 8 | 」 pulled back onto line 1 instead of starting line 2 | POC CAPABILITY DEMONSTRATION — the specific character classes pulled from `LINE_START_PROHIBITED` (`src/lib/tategaki.ts`); the *complete* kinsoku class table remains OPEN per Master |
| F-LINE-END | 行末禁則: naive break lands right after an opening bracket (「) | `すると「静かな声が聞こえた気がした` | 4 | 「 pushed forward to start line 2 instead of ending line 1 | POC CAPABILITY DEMONSTRATION |
| F-HANGING | ぶら下げ: naive break lands right before a 。 | `それはとても静かな夜だった。窓の外には雪が降っていた` | 13 | 。hangs as an extra slot on line 1 rather than pushing to line 2 | POC CAPABILITY DEMONSTRATION — scope intentionally narrow (only 。/、, per TSP-LOOP-029, not brackets/！？/small kana) |
| F-HANGING-BRACKET | ぶら下げ + a following closing bracket riding with it | `それはとても静かな夜だった。」と彼は思った` | 13 | 。and the following 」 both hang together on line 1 (TSP-LOOP-029 R3) | POC CAPABILITY DEMONSTRATION |
| F-RUBY-SHORT | Ordinary ruby, explicit `｜base《reading》` notation | `｜東京《とうきょう》に行く用事があった` | 10 | base "東京" stays together as one group; reading carried as associated metadata, not its own cells | POC CAPABILITY DEMONSTRATION (existing TateSpun notation, Freeze §7/Corpus #9) |
| F-RUBY-LONG | Ruby longer than its base (overflow-pressure case, Corpus #10) | `｜其《なにがし》という名の男が現れた` | 6 | 1-char base "其" carries a 4-char reading; base/reading association retained even though reading is much longer than base | POC CAPABILITY DEMONSTRATION — final overflow/spacing *rule* is OPEN (Corpus §4), this only proves the association survives |
| F-RUBY-BOUNDARY | Multi-char ruby base sitting exactly at a naive capacity boundary | `あ｜東京都《とうきょうと》へ行く` | 4 | base "東京都" (3 chars) never split mid-base even though it abuts the boundary | POC CAPABILITY DEMONSTRATION |
| F-TCY-BARE | Bare auto-detect TCY (2-digit number) | `その日は12月だった。西暦は[tate]2026[/tate]年だ` | 8 | `12` becomes 1 logical cell; also exercises explicit `[tate]2026[/tate]` (4 source chars → 1 cell) | POC CAPABILITY DEMONSTRATION — exact digit-run auto-detect threshold is OPEN (Freeze §17, Corpus §4); this only proves both notations collapse to 1 cell |
| F-DASH-FIT | Dash run (――) that fits whole within the naive line | `彼は――そうだ――と静かに言った` | 5 | both `――` runs render as unbroken 2-char groups | POC CAPABILITY DEMONSTRATION |
| F-DASH-DEFER | Dash run that does NOT fit — must defer whole, not split | `彼は――そうだ――と静かに言った` | 3 | line 1 ends at "彼は" (under capacity) rather than splitting the following `――` mid-run | POC CAPABILITY DEMONSTRATION — direct evidence for the "keep-together" mechanism |
| F-ELLIPSIS | Ellipsis run (……) | `……そうか……と彼はつぶやいた` | 5 | `……` renders as an unbroken 2-char group, same mechanism as dash | POC CAPABILITY DEMONSTRATION — dash/ellipsis primary-source composition rule remains OPEN (Master §24/Phase 1); only the run-grouping mechanism is demonstrated here |

## Standards-status labeling key

- **POC CAPABILITY DEMONSTRATION** — this fixture proves the *architecture* can represent/control the behavior deterministically. It does not freeze a final typographic rule.
- No fixture in this loop is labeled **FINAL** — per the loop brief, none of v2's Japanese typesetting rules are finalized yet (full kinsoku class table: OPEN; dash/ellipsis primary-source rule: OPEN).

## Source of the rule constants used

All character-class constants (`LINE_START_PROHIBITED`, `LINE_END_PROHIBITED`, `HANGING_PUNCTUATION`, `HANGING_CLOSE_BRACKETS`) and pattern regexes (`RUBY_PATTERN`, `TCY_PATTERN`, dash/ellipsis run families) are copied **verbatim** from `src/lib/tategaki.ts` (read-only reference) — classified as **PRODUCT REQUIREMENT** (Master §10 requires kinsoku/hanging/ruby/TCY/dash/ellipsis to be retained; the notation itself, e.g. `｜base《reading》`, `[tate]…[/tate]`, is an existing user-facing contract not to be reinvented). The break-decision **algorithm** in `scripts/engine.js` (single-pass, group-aware) is a **new PoC-only reimplementation** — classified as **LEGACY IMPLEMENTATION DETAIL, not reused**: `tategaki.ts`'s own iterative fixed-point algorithm (`adjustLineSplit`) is not reproduced here, since this loop's question is architectural (can the model represent these decisions deterministically, source-mapped, before positioning?), not "is this exact algorithm production-ready."
