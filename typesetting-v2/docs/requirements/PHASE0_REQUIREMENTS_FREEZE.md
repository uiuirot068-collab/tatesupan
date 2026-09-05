# TateSpun Engine v2 — Phase 0 Requirements Freeze

- Status: Phase 0 draft — Human Decision Freeze applied 2026-09-05 (HD-001–HD-009, Master §20–§21); pending final Human Review sign-off
- Source authority: `typesetting-v2/docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` (all section references below are to this document unless noted)
- Companion documents: `CURRENT_PRODUCT_COMPATIBILITY_MATRIX.md`, `REQUIREMENTS_TRACEABILITY.md`, `../architecture/PHASE1_RESEARCH_QUESTIONS.md`, `../../fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md`

This document defines *what* TateSpun Engine v2 must guarantee, independent of implementation technology. No renderer, library, or shaping engine is selected here (Master §7).

---

## 1. Product Goal

TateSpun Engine v2 promises the user:

1. A manuscript typeset in traditional vertical Japanese book form, at a quality level judged against real publication output (InDesign as the major reference, Master §4.2) — not against what a browser renders by default (Master §4.1).
2. That what they see while editing (Preview) faithfully represents the book they will get (Publication output), in every way that matters to a reader/author — page count, pagination, line breaks, ruby placement, kinsoku, hanging punctuation — even if Preview and Publication are drawn by different rendering technology (Master §1.2–1.3).
3. That their existing manuscripts, projects, and account data continue to work, and that the current production app is not put at risk while v2 is built (Master §12, §13.0).
4. That their manuscript text is not sent to external AI or third-party processing without their explicit, informed consent (Master §3 priority 3).

## 2. Canonical Output Contract

### PDF
- Publication-quality guarantee: PDF output must meet the Publication Quality Reference bar (Master §4) for vertical Japanese typesetting — natural character advance, correct kinsoku/hanging/ruby/TCY resolution, no magic-number per-preset patching (Master §5.3).
- Logical layout guarantee: PDF pagination, line/column assignment, and all book-semantic layout (Master §1.3 list) are treated as the reference logical layout that Preview and JPG must agree with.
- Reproducibility requirement: the same manuscript + same settings must always produce the same PDF layout (deterministic pagination, Master §8 Pagination Contract). Re-exporting an unchanged manuscript must not silently change page breaks.
- PDF is first among equals for print/入稿 use (Master §1.1).

### JPG
- Publication-quality guarantee: same bar as PDF — JPG is a canonical output class, not a lesser derivative (Master §1.1).
- Logical layout guarantee: JPG pages must match the same logical layout as PDF for the same manuscript/settings (page count, breaks, etc.) — see Logical Layout Consistency Contract (§4 below).

### PNG
- Optional/future: not a required deliverable for the first Engine v2 release (Master §1.1).
- The architecture must not be designed in a way that forecloses adding lossless PNG export later, once an independent product need for it is confirmed. This is a non-blocking design consideration, not a Phase 0 commitment to build it.

## 3. Preview Contract

Preview is a high-quality confirmation renderer, not a low-quality one (Master §1.2).

**Preview MUST faithfully communicate:**
- Page structure (how many pages, what's on each)
- Ruby placement and its attachment to base text
- Kinsoku and hanging punctuation results
- Image position within the flow
- Character-advance/rhythm sufficient for the author to trust what they're seeing
- All items in the Logical Layout Consistency Contract (§4)

**Preview does NOT need to:**
- Use the same rendering technology as Publication output (Master §1.2)
- Be pixel-identical to the PDF/JPG output (Master §1.2, explicitly rejected as a constraint)
- Be produced by rendering the same DOM that gets rasterized into the final output (the current html-to-image assumption is reset, Master §7)

**Quality expectation:** sufficient visual/structural fidelity that an author can make real editing decisions (line breaks, page breaks, ruby placement) by looking at Preview alone, without needing to export to verify. This is a functional bar, not a pixel bar.

**Consistency with Canonical Layout:** anything in §4 below must match between Preview and Publication. Anything not in §4 (e.g. exact anti-aliasing, exact font hinting, exact color rendering of the screen vs. print) is explicitly allowed to differ.

## 4. Logical Layout Consistency Contract

The following must be identical across Preview / PDF / JPG for the same manuscript and settings (Master §1.3):

- Page count
- Pagination (which content lands on which page)
- Line/column assignment
- Character logical positions (i.e., which character is where in reading order/layout — not necessarily pixel coordinates)
- Ruby relationships (which ruby attaches to which base run)
- Kinsoku results (which characters got pushed to avoid violating line-start/line-end rules)
- Hanging results (which punctuation hangs outside the column, and where)
- TCY (which runs are rendered tate-chu-yoko)
- Punctuation category treatment (brackets, dashes, ellipsis, etc. — consistent category assignment)
- Image placement
- Page breaks (manual and automatic)
- Page numbers
- Any other layout information that carries book-semantic meaning

A difference here is treated as "Preview and Export look like different books," which is explicitly disallowed (Master §1.3). A difference in something *not* on this list (pixel-level rendering nuance) is allowed and expected.

## 5. Print Unit Contract

- Print-oriented presets (文庫, A5, B5, B6, 新書, A6, and any other physical paper preset) must not use `px` as the internal canonical unit (Master §6.1).
- Canonical candidates for print presets: `pt`, `mm`, `em`, font units — the specific choice among these is deferred, not decided in Phase 0.
- `px` is permitted only as a *derived* value for a specific rendering target (e.g. Preview screen rendering, bitmap export resolution) — never as the source of truth for print layout.
- Requirement, not implementation: print typesetting must be defined in physical/typographic units first; pixel values are always a conversion output, never an input assumption.

## 6. Web Preset Unit Contract

- TateSpun's "Web閲覧用" preset is explicitly allowed to differ from print presets in its canonical unit model (Master §6.2).
- What it shares with print presets: the same Logical Layout Consistency Contract (§4) — page/line/column semantics, kinsoku, ruby, etc. still apply logically even if "page" means something more fluid on the web.
- What may legitimately be web-logical-unit based: the Web preset's canonical unit may be CSS px or another web logical unit, if that best serves web presentation — this is explicitly not required to match the print unit model (Master §6.2).
- **RESOLVED (HD-001, Master §20.1):** Web閲覧用 does not abandon the logical page unit of the Canonical Layout Model. A continuous-scroll *presentation* is allowed at the Preview/UI layer, but that is a presentation-layer choice, not license to drop page semantics from the underlying model.
- **Still open, deferred to Phase 1 research:** the specific mechanism — i.e., does Web閲覧用 render as discrete simulated pages, or as continuous scroll over an underlying page-segmented model — and how print-preset pagination logic is reused vs. adapted for it. This is now a narrower engineering question than before HD-001, not a product-direction question.

## 7. Typography Quality Contract

Required quality areas (Master §5.1, §11.3 corpus categories):

- Natural, uniform character advance (no forced stretching to fill a page, Master §5.2)
- Stable visual rhythm across a column/page
- Optical spacing derivable from font metrics/OpenType data/Unicode category/physical units/documented Japanese typesetting rules (Master §5.3) — never a hand-tuned magic number
- Punctuation: 、。and category-based rules (Master §5.4)
- Opening/closing brackets: 「」『』, correct kinsoku interaction
- Kinsoku (line-start and line-end prohibition rules)
- Hanging punctuation (ぶら下げ)
- Ruby, including long ruby overflow behavior
- TCY (縦中横)
- Dash (――) and ellipsis (……) as continuous vertical glyph runs
- Latin text (half-width and full-width) mixed into vertical Japanese flow
- Numbers, including the TCY threshold question
- Mixed Japanese/Latin running text without compounding spacing artifacts

**Explicit non-acceptance-condition:** "matches Chromium's native vertical-writing-mode rendering" is NOT an acceptance condition (Master §4.1). A result can be technically what the browser produces by default and still fail Publication Quality review if it looks unnatural against the InDesign reference (Master §4.2).

## 8. Pagination Contract

Required deterministic guarantees for:

- Characters per line (derived from font size, line length, and paper preset — not hardcoded per preset as a magic number, Master §5.3)
- Lines per column
- Columns (multi-column/段組 layouts)
- Page breaks, both automatic (natural fill) and manual (author-inserted, §11 in this doc)
- Paragraph boundaries (indentation/separation rules)
- Images (how an image frame affects surrounding text flow and page capacity)
- Page capacity (derived from margins/paper size — see current-product note on TSP-LOOP-031 "derive maximum text capacity from margins" in the Compatibility Matrix for the existing behavior this must preserve or deliberately supersede)
- Determinism: identical manuscript + identical settings → identical pagination, every time, across Preview/PDF/JPG (this is the pagination-specific instance of §4 above)

Natural pitch is preferred over forced page-filling (Master §5.2) — leftover space at the end of a page is treated as margin, not as a target to eliminate by stretching character advance.

## 9. Existing Feature Compatibility

This section classifies existing TateSpun functionality at the requirement level. The full feature-by-feature detail (current implementation, migration risk) lives in `CURRENT_PRODUCT_COMPATIBILITY_MATRIX.md` — this section states the classification *policy* and headline groups; see that document for the authoritative per-feature table.

**MUST KEEP** (Master §8, §10 — user-visible, required at v2 completion unless a Human Gate exception is granted):
- Kinsoku, hanging punctuation, ruby, TCY, ――, ……, manual page break, multi-column layout, page numbering, image placement, existing page-capacity/paper-preset settings, colophon (奥付, now formally a Canonical Layout Model element per HD-006/Master §20.6, §10)
- Manuscript editor, paper/font/font-size settings, save, cloud/project data, Export UI as user-facing capabilities (not their current implementation)
- Compatibility with existing user data and existing projects
- 文章チェックβ as an Editor-side feature, kept separate from the Typesetting Engine core (HD-007, Master §20.7)

**MAY CHANGE IF JUSTIFIED** (Master §8):
- Any UI or settings-surface detail, *if* Publication Quality genuinely requires the change, and the change comes with: why it's needed, impact on existing users, migration method, rollback method (Master §8) — presented before being made, not after.
- Underlying implementation of any MUST KEEP feature (e.g. how kinsoku is computed) — the user-visible guarantee is what's fixed, not the code path.

**RESOLVED, formerly NEEDS PRODUCT DECISION:**
- 柱/奥付 font hardcoding (HD-005, Master §20.5): the current hardcoded-Shippori-Mincho behavior is an implementation detail, not carried forward as a requirement. v2 requirement: 柱/奥付 inherit the body font by default, independently overridable by the user; settings UI/data model TBD in later phases.
- Editor/Settings UI relationship (HD-008, Master §21.1): the current desktop layout's simultaneous always-visible Editor+Settings display is no longer a MUST KEEP constraint. New approved direction: an Editor⇄Settings switching model (mechanism — tabs/drawer/toolbar switch/etc. — undecided, a later design-phase choice, not a Phase 0 commitment).
- Memo accessibility (HD-009, Master §21.2): net-new MUST KEEP requirement — Memo must be reachable directly from Editor without a detour through Settings. Mechanism (panel/drawer/modal/floating window) undecided.

**NEEDS PRODUCT DECISION:**
- Anything remaining in the Compatibility Matrix marked "NEEDS PRODUCT DECISION" that HD-001–HD-009 did not resolve — see that document.

**Standing rule:** "1 character = 1 span" and similar implementation facts must never be classified as a user-visible requirement (explicit example in the Phase 0 task spec, consistent with Master §7's white-sheet reset of FixedSlot/1-char-1-span).

## 10. TXT I/O Contract

Approved requirement (Master §9.1): import `.txt`, export editor content as `.txt`.

**RESOLVED (HD-002, Master §20.2):** the round-trip goal is to lose as little of the original text information as possible. Content that plain `.txt` genuinely cannot represent (e.g. embedded images themselves) is explicitly out of that goal's scope and handled via a separate spec, not forced into the text format.

**Unresolved questions** (Phase 0 does not answer these; they are listed, not invented):
- Character encoding (UTF-8 assumed likely but not confirmed as the only supported encoding)
- BOM handling on import
- Line-ending handling (CRLF/LF/CR round-trip)
- How TateSpun's own ruby notation (and any other custom notation) round-trips through plain `.txt`, which has no native ruby syntax
- Manual page-break notation in plain text
- Image references in plain text (a `.txt` file cannot embed a binary image — some reference/placeholder scheme is needed, unspecified)
- Round-trip guarantee scope: is import→export of an unmodified file guaranteed to be byte-identical, or only content-equivalent?
- Malformed input warnings: what counts as malformed, and what the user is told

## 11. Session Editing Metrics Contract

Approved concept (Master §9.2): START button → editing session → END button → total editing activity count → SNS share. This is Editor Session Metrics, explicitly separated from the Typesetting Engine core (Master §9.2, §3).

"Total editing activity" = cumulative characters typed + cumulative characters deleted during the session, not the net/final character delta. Example: 100 typed, 50 deleted, 30 typed → 180 total activity, even though net change is 80.

**RESOLVED (HD-004, Master §20.4):**
- Paste: pasted character count is treated as typed-side activity.
- Cut/delete: deleted character count is treated as deleted-side activity.
- `.txt` import and programmatic normalization are excluded from normal writing activity (kept separate from the counter, not folded in as ordinary typing).

**Still unresolved rules** (Master §20.4 lists these explicitly as open, pending engineering investigation):
- IME composition (does an in-progress, not-yet-committed IME composition count, or only committed characters?)
- Undo / redo (does undo subtract from the count, or does redo re-add activity?)
- Replace (find-and-replace across the doc — one count event or many?)
- Select-all delete
- Ruby input (does entering ruby notation count extra characters for the ruby text itself?)
- Page-break token insertion
- Image token insertion

Existing related work: `docs` in the main worktree already references "automatic feedback environment metadata" (TSP-LOOP-030) — the Compatibility Matrix should confirm whether that overlaps with or is unrelated to this session-metrics feature (they read as distinct: TSP-030 is about environment metadata for feedback capture, not activity counting).

## 12. Privacy Contract

Original manuscript data must not be sent to external AI or other external processing services without explicit, user-approved product behavior (Master §3 priority 3, §15 guardrail list).

Distinguish three processing locations:
- **Browser-local processing:** happens on the user's device, manuscript never leaves the browser.
- **Application backend:** TateSpun's own server/cloud infrastructure (e.g. existing Supabase-backed save/cloud features) — this is the user's own data going to the user's own account's storage, not a third party.
- **External third-party processing:** any service outside TateSpun's own infrastructure (e.g. a third-party AI API, an external font-shaping-as-a-service, an external PDF-generation SaaS) — sending manuscript content here requires explicit, informed user consent as a product decision, not an engineering default.

Do not invent integrations: this contract does not imply any current or planned integration with an external AI/processing service. It exists to bound what Phase 1 architecture choices are allowed to assume without a separate product decision.

**RESOLVED (HD-003, Master §20.3):** ordinary product operations — editing, typesetting, Preview, PDF generation, JPG generation — never send manuscript text to external AI or third-party processing. Any feature that would do so requires the user to explicitly invoke or enable that specific feature; it is never a silent default. The exact consent UI/flow remains a later decision (§17 below).

## 13. Performance Contract

No numeric targets are invented in Phase 0. Required user experience, described qualitatively:

- Editing must remain responsive — typing/deleting should not visibly lag regardless of manuscript length.
- Preview should update usefully — the author should get timely enough feedback to make editing decisions, without requiring Preview to be instant on every keystroke.
- Large manuscripts (full novel-length, i.e. well beyond the corpus samples in §11.3 of the Master) must remain practical to edit and preview.
- Publication rendering (PDF/JPG export) may be slower than Preview if that is what quality requires (Master §1.1 priority: Publication Quality first, response speed lower in the priority list, Master §3).

## 14. Compatibility / Migration Contract

- Current project/manuscript compatibility: existing user projects must continue to work when opened under v2 (exact mechanism TBD in later phases; the guarantee is stated here, not the mechanism).
- Existing user data: preserved, not silently migrated without a defined migration checkpoint (Master §12.3).
- Old Engine coexistence: the current production Engine's code path is not deleted when v2 ships (Master §12.2–12.3, §15 — "v2 deploy = old engine削除" is explicitly prohibited).
- Feature flag / routing possibility: a safe switch mechanism (e.g. feature flag or routing split) is expected to be designed in Phase 1+ (Master §12.3, §13.0 point 7) — not selected here.
- Migration checkpoint: a defined point where data compatibility is verified before cutover (Master §12.3).
- Rollback requirement: for a defined period after cutover, reverting to the old Engine must remain possible (Master §12.3, §17 "Rollback tested" is a v2 completion acceptance item).
- Final integration: v2 integrates into the existing TateSpun application; it does not become a permanent separate site/app (Master §13.0 point 4). Final public URL remains `https://spuntales.net/tatespun/` in principle (Master §13.0 point 5).

## 15. QA Contract

Mandatory Human QA preset matrix (Master §11.2):

- 文庫
- A5 1段
- A5 2段
- B5
- B6
- 新書
- A6
- Web閲覧用

Human Visual QA is mandatory for Publication Quality PASS (Master §11.1, §17). Automated tests (Phase 3+ logical/data-level checks against the Regression Corpus, see `../../fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md`) supplement Human QA — they do not replace it, for any preset, ever.

## 16. Explicit Non-Requirements

Engine v2 is explicitly NOT required to:

- Be a pixel-perfect clone of InDesign output (Master §4.2 — InDesign is a major reference, not an absolute copy target)
- Make Preview pixel-perfect identical to PDF (Master §1.2 — explicitly rejected as a constraint)
- Match Chromium's native vertical-writing-mode rendering exactly (Master §4.1 — not the quality authority)
- Ship PNG export in the first Engine v2 release (Master §1.1 — optional/future)
- Preserve FixedSlot as an architecture (Master §7 — reset to undecided)
- Preserve the one-character-per-span DOM structure (Master §7 — reset to undecided)
- Preserve html-to-image as the export mechanism (Master §7 — reset to undecided)
- Preserve the current hardcoded Shippori-Mincho-for-柱/奥付 behavior (HD-005, Master §20.5 — an implementation detail, not a requirement)
- Preserve simultaneous always-visible Editor+Settings display as the desktop UI model (HD-008, Master §21.1 — superseded by the Editor⇄Settings switching direction)

## 17. UNKNOWN / HUMAN DECISION NEEDED

Genuine product-owner decisions that Phase 0 cannot resolve by engineering investigation alone. Updated 2026-09-05 after the Phase 0 Human Decision Freeze (HD-001–HD-009, Master §20–§21) resolved several items formerly listed here — resolutions are recorded in place of the removed items, not silently deleted:

1. **Web閲覧用 pagination *mechanism*** (§6 above) — narrowed by HD-001: the page-model-retained *product direction* is now resolved; only the engineering mechanism (discrete simulated pages vs. continuous scroll over a page-segmented model) remains, and that is now Phase 1 engineering research, not a standing Human Decision item.
2. ~~TXT round-trip fidelity guarantee level~~ — **RESOLVED by HD-002** (§10): lossless-where-representable is the goal; non-representable content is out of scope by design, not by omission.
3. ~~Scope of "explicit user-approved product behavior" for external processing~~ — **RESOLVED by HD-003** (§12): explicit per-feature invocation/enablement is required; ordinary product operations never send manuscript text externally. (The exact consent *UI* — a dialog, a settings toggle, a first-run prompt — remains a later UI-design decision, not a Phase 0 blocker.)
4. ~~Session-metrics edge-case rules~~ — **PARTIALLY RESOLVED by HD-004** (§11): paste/delete counting and import/normalization exclusion are decided. Remaining open items (IME composition, undo/redo, replace, select-all delete, ruby/page-break/image token counting) are now framed as engineering investigation per Master §20.4, not open product decisions — the *policy* (activity = typed+deleted, session-scoped) was always the product decision; these are edge cases within an already-decided policy.

**New from this Freeze update:**

5. **柱/奥付 settings UI and data model** (§9, §18 below) — HD-005 fixed the requirement (inherit body font, independently overridable); the concrete settings surface and schema are a later design decision, not blocking Phase 0 closure.
6. **Editor⇄Settings switching mechanism and Memo access mechanism** (§18 below) — HD-008/HD-009 fixed the product requirement; the UI mechanism (tabs, drawer, modal, etc.) is explicitly deferred to a UI design phase, not chosen here.

Everything else deferred elsewhere in this document (e.g. TCY digit threshold, specific print unit choice among pt/mm/em/font-units, exact architecture) is an **engineering-resolvable unknown** belonging to Phase 1 research (see `../architecture/PHASE1_RESEARCH_QUESTIONS.md`) and is deliberately not listed here.

## 18. UI Product Direction Contract (added 2026-09-05, HD-008/HD-009)

This section is net-new to the Freeze, added by the Phase 0 Human Decision Freeze — it was not part of the original 17-section template because the underlying product direction did not exist yet at initial Freeze time.

**Editor/Settings relationship (HD-008, Master §21.1):**
- The prior assumption that desktop UI must keep Editor and Settings simultaneously visible is no longer a MUST KEEP constraint (superseding the relevant part of §9/§16 above).
- New direction: an Editor⇄Settings *switching* model, writing workspace concentrated in Editor, Settings reached via explicit switch, consistent mental model across desktop and mobile.
- Non-requirement: no specific mechanism (tabs/segmented control/toolbar switch/drawer/route transition/optional split-view) is chosen. Choosing one is a later design-phase task.

**Memo accessibility (HD-009, Master §21.2):**
- Net-new MUST KEEP requirement: Memo must be directly reachable from within the Editor workflow, without requiring navigation to a Settings screen first.
- Non-requirement: no specific mechanism (panel/drawer/modal/floating window) is chosen.
- Standing rule: Memo must not become a Settings-only feature under whatever mechanism is eventually chosen.

**Settings drawer selected (HD-010, Master §22.1, Phase 1 UI Human QA Freeze 2026-09-05):**
- Human QA selected UI-C's interaction model: Editor stays visible as the primary workspace; Settings opens as a drawer/side panel over/beside it on PC, not a full-screen replacement. This narrows §21.1's previously-open tab/mode-button/drawer choice — drawer specifically won.
- Explicit non-approval: ui-c.html's visual design (colors, tone, UI language) is NOT the final design — only its interaction structure carries forward. Final UI must preserve existing TateSpun visual identity.
- Requirement, not yet mechanism: closing Settings must return immediately to writing with Editor state/scroll/cursor intact; Memo and Preview access must remain clear alongside this model.

**Editor writing direction (HD-011, Master §22.2):**
- Default remains horizontal (横書き), matching current TateSpun.
- Optional vertical (縦書き) Editor mode is a desired direction, independent of Publication Output's own (always-vertical) orientation — explicitly not yet a commitment to implement, pending Phase 1/2 research into: shared manuscript model feasibility, cursor/selection/IME reliability in vertical mode, direction-switch state preservation, mobile and accessibility implications, and Canonical Layout Model impact.

**Emoji policy (HD-012, Master §23):**
- Limited, deliberate emoji use is permitted; emoji must never become the primary icon language (text labels/proper icon assets/SVG components remain preferred).
- Every emoji use — in prototypes or Production — must be explicitly disclosed (exact emoji, location, purpose) and pass its own Human QA before Production adoption. No blanket approval; no silent carryover from prototype to Production.
- Applies to all UI surfaces; does not apply to user-authored manuscript content.
- **RESOLVED for the Phase 1 prototype set (HD-014, Master §24, 2026-09-05):** ↶ (Undo), ↷ (Redo), ⏎ (manual page break), ⚙️ (Settings) are approved for those specific purposes only. 💾 (Save), 🖼 (Image insertion), 👁 (Preview), 📝 (Memo), ✏️ (Editor mode label) are rejected — future UI must use a text label or a proper design-approved icon for these five instead. Any emoji proposed beyond this set requires fresh disclosure and its own Human QA pass.

**Editor actions (HD-013):**
- Image insertion, undo, and redo are recorded as high-value Editor interactions that must remain easy to discover from the Editor workflow — confirmed via Phase 1 UI Human QA's positive evaluation of the prototype's inclusion of these.
- Interaction with the Session Editing Metrics Contract (§11 above), TXT I/O, ruby input, and page-break tokens remains for Phase 2+ to clarify — not resolved here.
