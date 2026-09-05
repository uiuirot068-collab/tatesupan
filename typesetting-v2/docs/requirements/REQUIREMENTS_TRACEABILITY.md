# TateSpun Engine v2 — Requirements Traceability

- Status: Phase 0 draft — updated 2026-09-05 after Phase 0 Human Decision Freeze (HD-001–HD-009, Master §20–§21); updated again 2026-09-05 after Phase 2 Architecture Human Gate (HD-015–HD-021, Master §25) — new Architecture (V2-ARCH-*) and Editor Export (V2-EXPORT-*) groups added, existing Typography rows annotated with Phase 2 evidence; statuses annotated in place, no ID removed or renumbered
- Purpose: every later architecture choice and test must trace back to an approved requirement here, back to the Master's approved user decisions (Master §18). Trivial/sub-requirements are intentionally not fragmented into their own IDs — see the parent requirement's notes instead.

Columns: **ID | Requirement | Source | Phase Responsible | QA Method | Human QA Required? | Status**

## Output (V2-OUT-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-OUT-001 | PDF is canonical Publication output, meets Publication Quality bar | Master §1.1; Freeze §2 | 4 | Human Visual QA + Regression Corpus | Yes | Approved (frozen) |
| V2-OUT-002 | JPG is canonical Publication output, same quality bar as PDF | Master §1.1; Freeze §2 | 4 | Human Visual QA + Regression Corpus | Yes | Approved (frozen) |
| V2-OUT-003 | PNG optional/future; architecture must not foreclose it | Master §1.1; Freeze §2 | 1 (design consideration only) | N/A | No | Approved (frozen) |
| V2-OUT-004 | PDF/JPG pagination is deterministic and reproducible for unchanged manuscript+settings | Master §1.1; Freeze §2, §8 | 3–4 | Automated (repeat-export diff) | No | Approved (frozen) |

## Preview (V2-PREV-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-PREV-001 | Preview is a high-quality confirmation renderer, not a low-quality one | Master §1.2; Freeze §3 | 5 | Human Visual QA | Yes | Approved (frozen) |
| V2-PREV-002 | Preview technology need not match Export technology | Master §1.2; Freeze §3 | 1, 5 | N/A (architecture constraint) | No | Approved (frozen) |
| V2-PREV-003 | Preview need not be pixel-identical to PDF/JPG | Master §1.2; Freeze §3, §16 | 5 | N/A (explicit non-requirement) | No | Approved (frozen) |
| V2-PREV-004 | Preview must match Publication on every item in the Logical Layout Consistency Contract | Master §1.3; Freeze §4 | 3, 5, 7 | Automated logical-diff + Human Visual QA | Yes | Approved (frozen) |

## Typography (V2-TYPO-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-TYPO-001 | Natural, uniform character advance; no forced page-fill stretching | Master §5.1–5.2; Freeze §7 | 2–3 | Human Visual QA vs. InDesign reference | Yes | Approved (frozen); empirically confirmed as "Natural Pitch" default composition principle, Phase 2 Architecture Gate (Master §25.4, HD-018) — dose-response evidence P2-L03/L04, no preset-specific exception authorized |
| V2-TYPO-002 | No magic-number per-preset/per-phrase corrections | Master §5.3; Freeze §7 | 2–3 | Code review + Decision Record audit | No | Approved (frozen) |
| V2-TYPO-003 | Character-category rules (punctuation, brackets, dash, ellipsis, TCY, Latin, numbers, ruby, kinsoku/hanging targets) are permitted as category specs | Master §5.4; Freeze §7 | 2–3 | Human Visual QA + Regression Corpus | Yes | Approved (frozen) |
| V2-TYPO-004 | Kinsoku (line-start/line-end) correctly resolved | Master §5.1, §10; Freeze §7 | 2–3 | Regression Corpus categories 16–17 | Yes | Approved (frozen); structural capability (deterministic rule-decision layer, pre-position) demonstrated Phase 2 P2-L05/L06, Human-confirmed visually; full character-class table remains Phase 3 open item P3-O01 |
| V2-TYPO-005 | Hanging punctuation (ぶら下げ) correctly resolved | Master §5.1, §10; Freeze §7 | 2–3 | Regression Corpus category 18 | Yes | Approved (frozen); structural capability demonstrated Phase 2 P2-L05/L06, Human-confirmed visually; exact ink-metric-derived hang extent remains a rendering-precision open question |
| V2-TYPO-006 | Ruby (including long ruby) correctly attached/overflowed | Master §5.1, §10; Freeze §7 | 2–3 | Regression Corpus categories 9–10 | Yes | Approved (frozen); Phase 2 (Master §25.6, HD-020) recorded Human-approved renderer POLICY — base-position invariant (0.00px delta, measured), unbroken annotation run, geometry-based CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN — explicitly NOT full JLREQ/JIS standards compliance; final overflow/distribution standards review remains Phase 3 open item P3-O06 |
| V2-TYPO-007 | TCY (縦中横) correctly resolved | Master §5.1, §10; Freeze §7 | 2–3 | Regression Corpus category 11 | Yes | Approved (frozen); logical-unit representation (1 cell, source-mapped) PASS (P2-L05); visual renderer (`text-combine-upright`) found broken in P2-L06, root cause not yet resolved — Product-Owner-deferred Phase 3 open item P3-O03, not an Architecture-Narrowing blocker |
| V2-TYPO-008 | Dash (――) / ellipsis (……) rendered as continuous vertical glyph runs | Master §5.1, §10; Freeze §7 | 2–3 | Regression Corpus categories 7–8 | Yes | Approved (frozen); keep-together/defer-whole run mechanism PASS (P2-L05, directly proven via F-DASH-DEFER); final visual alignment Human-flagged "slightly left-shifted", measurement mechanism shipped but unread — Product-Owner-deferred Phase 3 open items P3-O04/P3-O05 |
| V2-TYPO-009 | "Matches Chromium native rendering" is explicitly not an acceptance condition | Master §4.1; Freeze §7, §16 | 2 | N/A (explicit non-requirement) | No | Approved (frozen) |
| V2-TYPO-010 | font-weight is not a v2 repair target; not changed without independent justification | Master §5.1, §18(8) | 2–3 | Decision Record audit | No | Approved (frozen) |

## Pagination (V2-PAGE-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-PAGE-001 | Chars/line, lines/column, columns derived from font size + preset, not hardcoded | Master §5.3; Freeze §8 | 3 | Code review + automated derivation test | No | Approved (frozen) |
| V2-PAGE-002 | Manual page break supported, position identical across renderers | Master §10, §1.3; Freeze §8, Corpus #19 | 3, 5 | Regression Corpus category 19 | Yes | Approved (frozen) |
| V2-PAGE-003 | Multi-column (段組) layout supported | Master §10; Freeze §8, Corpus #20 | 3 | Regression Corpus category 20 | Yes | Approved (frozen) |
| V2-PAGE-004 | Page capacity derived from margins/paper size (see current TSP-LOOP-031 behavior in Compatibility Matrix) | Master §10; Freeze §8 | 3 | Compare against Compatibility Matrix row | No | Approved (frozen); implementation detail pending Compat Matrix |
| V2-PAGE-005 | Deterministic pagination for identical input across Preview/PDF/JPG | Master §1.3; Freeze §4, §8 | 3, 7 | Automated logical-diff | No | Approved (frozen) |

## Compatibility (V2-COMPAT-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-COMPAT-001 | Existing MUST KEEP features preserved as user-visible capabilities (see Compatibility Matrix) | Master §8, §10; Freeze §9 | 6–7 | Full Regression against Compatibility Matrix | Yes | Approved (frozen); per-feature detail pending Compatibility Matrix |
| V2-COMPAT-002 | Existing user data / projects remain compatible; migration checkpoint defined before cutover | Master §12.3, §14 (Phase 8–9); Freeze §14 | 8–9 | Parallel Production QA | Yes | Approved (frozen) |
| V2-COMPAT-003 | Old Engine code path retained; rollback possible for a defined period post-cutover | Master §12.2–12.3, §15, §17; Freeze §14 | 9 | Rollback test (Master §17 acceptance item) | No | Approved (frozen) |
| V2-COMPAT-004 | UI/settings changes require: justification, user-impact statement, migration method, rollback method, presented before the change | Master §8; Freeze §9 | 6 | Decision Record review | No | Approved (frozen) |
| V2-COMPAT-005 | "1 character = 1 span" and similar are implementation details, never user-visible requirements | Master §7 (white-sheet reset); Freeze §9, §16 | — | N/A (classification rule) | No | Approved (frozen) |
| V2-COMPAT-009 | Image insertion, undo, and redo are high-value Editor interactions that must remain easy to discover | Master §22 context (HD-013) | 6 | Manual functional test | No | Approved (Phase 1 UI Human QA Freeze 2026-09-05); interaction with session-activity counter/TXT import/ruby/page-break tokens TBD Phase 2+ |
| V2-COMPAT-006 | Colophon (奥付) is a formal Canonical Layout Model element (page placement, pagination relation, font, layout area, export inclusion) | Master §20.6 (HD-006), §10; Freeze §9, §18 | 3 | Regression/Full Regression once corpus covers colophon | No | Approved (Human Decision Freeze 2026-09-05) |
| V2-COMPAT-007 | 文章チェックβ stays separate from Typesetting Engine core; kept as Editor-side feature | Master §20.7 (HD-007); Freeze §9 | 6 | Manual functional test | No | Approved (Human Decision Freeze 2026-09-05) |
| V2-COMPAT-008 | 柱/奥付 font inherits body font by default, independently overridable; current hardcoded Shippori-Mincho behavior is not a requirement | Master §20.5 (HD-005); Freeze §9 | 6 | Manual functional test | No | Approved (Human Decision Freeze 2026-09-05) |

## TXT I/O (V2-TXT-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-TXT-001 | `.txt` import supported | Master §9.1; Freeze §10 | 3, 6 | Automated round-trip test (scope TBD) | No | Approved (frozen); encoding/BOM/notation details remain engineering unknowns |
| V2-TXT-002 | `.txt` export of editor content supported | Master §9.1; Freeze §10 | 3, 6 | Automated round-trip test (scope TBD) | No | Approved (frozen); round-trip guarantee level RESOLVED by HD-002 (Master §20.2) — lossless-where-representable, non-representable content out of scope |

## Session Metrics (V2-SESSION-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-SESSION-001 | START/END session with cumulative (typed+deleted) activity counter, separate from Typesetting Engine core | Master §9.2, §20.4; Freeze §11 | 6 | Manual functional test | No | Approved (frozen); paste/delete counting and import/normalization exclusion RESOLVED by HD-004 — remaining edge cases (IME, undo/redo, replace, select-all, ruby/break/image tokens) are engineering investigation, not open product decisions |
| V2-SESSION-002 | SNS share of session activity result | Master §9.2; Freeze §11 | 6 | Manual functional test | No | Approved (frozen) |

## Privacy (V2-PRIV-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-PRIV-001 | Manuscript not sent to external AI/third-party processing without explicit user-approved consent flow | Master §3(3), §15, §20.3; Freeze §12 | 1 (architecture constraint), 6 | Architecture review + Decision Record audit | No | Approved (frozen); scope of "explicit" RESOLVED by HD-003 (per-feature explicit invocation, never a silent default) — exact consent UI mechanism remains a later design decision |

## Units (V2-UNIT-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-UNIT-001 | Print presets: canonical unit is physical/typographic (pt/mm/em/font units), never px as source of truth | Master §6.1; Freeze §5 | 1, 3 | Architecture review | No | Approved (frozen); specific unit choice deferred to Phase 1 |
| V2-UNIT-002 | Web preset: web logical units (e.g. px) may legitimately be canonical | Master §6.2; Freeze §6 | 1, 3 | Architecture review | No | Approved (frozen); unit choice remains Phase 1 |
| V2-UNIT-003 | Web閲覧用 retains the Canonical Layout Model's logical page unit even if presented as continuous scroll | Master §20.1 (HD-001); Freeze §6 | 1, 3 | Architecture review | No | Approved (Human Decision Freeze 2026-09-05); specific pagination mechanism (discrete vs. scroll-over-segmented-model) is now narrower Phase 1 engineering research |

## UI Product Direction (V2-UI-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-UI-001 | Editor⇄Settings switching model replaces simultaneous always-visible desktop layout as the UI direction (mechanism undecided) | Master §21.1 (HD-008); Freeze §18 | 6 | Manual UX review | No | Approved (Human Decision Freeze 2026-09-05); mechanism selection deferred to UI design phase |
| V2-UI-002 | Memo must be directly reachable from Editor without navigating to Settings (mechanism undecided) | Master §21.2 (HD-009); Freeze §18 | 6 | Manual functional test | No | Approved (Human Decision Freeze 2026-09-05); mechanism selection deferred to UI design phase |
| V2-UI-003 | Settings opens as a drawer/side panel while Editor remains visible (PC); existing TateSpun visual identity (color/tone/UI language) preserved — prototype visual skin NOT approved | Master §22.1 (HD-010); Freeze §18; `qa/human/UI_COMPARISON_SCORECARD.md` | 6 | Human Visual/UX QA | Yes | Approved (Phase 1 UI Human QA Freeze 2026-09-05) |
| V2-UI-004 | Editor default writing direction is horizontal; optional vertical Editor mode is a desired direction pending feasibility research (shared manuscript model, cursor/IME/selection reliability, mobile/accessibility impact) | Master §22.2 (HD-011); Freeze §18 | 1–2 (research), not yet implemented | Architecture review | No | Approved (direction); feasibility genuinely open — Phase 1/2 engineering research required before any implementation |
| V2-UI-005 | Emoji use in UI is limited/deliberate, never the primary icon language; every emoji use must be explicitly disclosed (exact emoji, location, purpose) and pass Human QA before Production adoption — no emoji carries over from prototype to Production by default | Master §23 (HD-012); `qa/human/UI_COMPARISON_SCORECARD.md` Emoji Disclosure table | 6 | Human QA per emoji use | Yes | Approved (Phase 1 UI Human QA Freeze 2026-09-05); final verdicts recorded 2026-09-05 (HD-014, Master §24): ↶/↷/⏎/⚙️ APPROVED for their stated purposes only; 💾/🖼/👁/📝/✏️ REJECTED, replace with text label or design-approved icon; any new emoji requires fresh disclosure |

## Architecture (V2-ARCH-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-ARCH-001 | Logical typesetting core owns page/column/line/logical-unit/source-range/break-decision/ruby-association/TCY-group authority; decisions made deterministically, before positioning, independent of any single painting technology | Master §25.1 (HD-015) | 3 | Automated determinism check + Human Visual QA | Yes | Approved (Phase 2 Architecture Human Gate, 2026-09-05); C1-NATURAL is the Phase 3 direction — NOT a final full architecture, Preview/Publication renderer technology remains OPEN |
| V2-ARCH-002 | Every logical unit (character/ruby-base/TCY-run/dash-ellipsis-run) retains its manuscript source range through tokenization, unit expansion, and line-breaking | Master §25.1 (HD-015) | 3 | Automated source-mapping check | No | Approved (Phase 2 Architecture Human Gate, 2026-09-05); demonstrated P2-L05 `P2_L05_SOURCE_MAPPING.md` |
| V2-ARCH-003 | Manuscript → Logical Typesetting Core → Canonical Layout Model → Preview Renderer → Publication Renderer separation preserved; renderers may differ in technology | Master §25.5 (HD-019); Master §2 | 3–5 | Architecture review | No | Approved (Phase 2 Architecture Human Gate, 2026-09-05); final Preview (Phase 5)/Publication (Phase 4) renderer technology remains OPEN (P3-O08/P3-O09) |
| V2-ARCH-004 | C3 (browser-native rendering) may be used as a candidate painting/Preview technology but never as logical-layout authority | Master §25.2 (HD-016) | 3–5 | Architecture review | No | Approved (Phase 2 Architecture Human Gate, 2026-09-05); C3 not rejected, retained as control/reference |
| V2-ARCH-005 | C2 (dedicated shaping, HarfBuzz-via-WASM) remains deferred/reopenable; not rejected | Master §25.3 (HD-017) | 3–5 (reopen only) | N/A | No | Approved (Phase 2 Architecture Human Gate, 2026-09-05); reopen conditions in Master §25.3 |

## Editor Export (V2-EXPORT-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-EXPORT-001 | Editor text export supports at least a markup-preserving profile (retains Markdown/TateSpun notation for re-editing/round-trip) | Master §25.7 (HD-021) | 3 (full spec), 6 (implementation) | Manual functional test | Yes | Approved (Phase 2 Architecture Human Gate, 2026-09-05); full specification is Phase 3 open item P3-O11, not implemented |
| V2-EXPORT-002 | Editor text export supports at least a plain/posting-friendly profile (removes unwanted markup for sites such as pixiv) | Master §25.7 (HD-021) | 3 (full spec), 6 (implementation) | Manual functional test | Yes | Approved (Phase 2 Architecture Human Gate, 2026-09-05); full specification is Phase 3 open item P3-O11, not implemented; open sub-questions (ruby/page-break/headings/images/colophon/encoding representation) unresolved |
| V2-EXPORT-003 | Export Profile architecture must not foreclose future platform-specific profiles (e.g. pixiv-specific conversion) | Master §25.7 (HD-021) | 3 (design consideration only) | N/A | No | Approved (Phase 2 Architecture Human Gate, 2026-09-05); future-capable only, no specific platform profile implemented or promised |
| V2-EXPORT-004 | TXT transport format (Master §9.1/V2-TXT-*) and Export Profile (notation transformation) are separate concerns; the same manuscript may pass through either profile before being written as TXT | Master §25.7 (HD-021) | 3 | Architecture review | No | Approved (Phase 2 Architecture Human Gate, 2026-09-05) |

## QA (V2-QA-*)

| ID | Requirement | Source | Phase | QA Method | Human QA? | Status |
|----|---|---|---|---|---|---|
| V2-QA-001 | Human Visual QA mandatory for Publication Quality PASS; automated tests supplement, never replace | Master §11.1, §17; Freeze §15 | 2–9 | Human Visual QA | Yes | Approved (frozen) |
| V2-QA-002 | Mandatory 8-preset QA matrix (文庫/A5×2/B5/B6/新書/A6/Web閲覧用) | Master §11.2; Freeze §15 | 7 | Human Visual QA per preset | Yes | Approved (frozen) |
| V2-QA-003 | Regression Corpus (canonical sentence + 23 categories) is the shared QA fixture set across all renderers | Master §11.3; Freeze §16, Corpus doc | 2, 7 | Human Visual QA + automated logical checks | Yes | Approved (frozen); corpus text generation is Phase 1/2 |

---

**Requirement count:** 58 IDs across 13 groups.

**Major requirement groups:** Output (4), Preview (4), Typography (10), Pagination (5), Compatibility (9), TXT I/O (2), Session Metrics (2), Privacy (1), Units (3), UI Product Direction (5), Architecture (5), Editor Export (4), QA (3).
