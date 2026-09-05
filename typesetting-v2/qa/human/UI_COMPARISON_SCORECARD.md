# UI Comparison — Human QA Scorecard

- Status: **Human QA decision recorded (2026-09-05)** — interaction-model decision only; per-category scores below were not individually scored by the reviewer and are left blank rather than fabricated (see `TSP-V2-PHASE1-UI-HUMAN-FREEZE` HD-010–HD-013, `../../docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` §22–§23)
- Subject: `../../prototypes/ui-comparison/` (UI-A tab model, UI-B explicit mode buttons, UI-C settings drawer)
- Purpose: record Human judgment on the Editor/Settings switching + Memo access UI direction (Master §21, HD-008/HD-009). Claude does not select a winner — this scorecard is filled in by a human reviewer.

Score each item 1 (poor) – 5 (excellent), or write a short note where a number doesn't fit. Test both PC width and mobile width (≤600px / device toolbar) for each variant before scoring.

## Scorecard

| Criterion | UI-A (Tabs) | UI-B (Mode buttons) | UI-C (Drawer) | Notes |
|---|---|---|---|---|
| Writing focus (does Editor feel like the main workspace?) | | | | |
| Settings discoverability (easy to find how to open Settings?) | | | | |
| Return-to-writing ease (getting back to Editor after Settings) | | | | |
| Memo accessibility (opening/closing Memo without losing place) | | | | |
| Preview accessibility (concept placeholder only — is its access point sensible?) | | | | |
| PC usability | | | | |
| Mobile usability (narrow width) | | | | |
| Visual clutter (lower = more cluttered, higher = cleaner) | | | | |
| Operation count (fewer taps/clicks to reach Settings and back = better) | | | | |
| Overall preference | | | | |

## Free-form notes

**UI-A (Tab Model):** (not separately scored — see Decision)

**UI-B (Explicit Mode Buttons):** (not separately scored — see Decision)

**UI-C (Settings Drawer):** Preferred. Primary reason: Settings can be changed while the work screen (Editor) remains visible — the reviewer highly values being able to see the working manuscript while adjusting settings, rather than losing sight of it during a full-screen switch (as UI-A/UI-B's mutually-exclusive views would cause).

## Decision

Preferred variant: **UI-C (Settings Drawer)** — interaction model only.

Reasoning: seeing the manuscript while changing settings was the deciding factor. This selects the *interaction structure* (Editor stays visible, Settings opens as a drawer/side panel over/beside it) — it does NOT approve ui-c.html's current visual design (colors, tone, UI language) as final. The final UI must preserve existing TateSpun visual identity; only the drawer interaction pattern carries forward. See Master §22.1 (HD-010).

Additional Human notes recorded alongside this decision (not separate per-variant scores):

1. **Visual identity:** current TateSpun visual identity (color palette, visual tone, UI language, product character) must remain — UI-C's look itself is not the target, only its interaction model.
2. **Editor writing direction:** current Editor input is horizontal; default must remain horizontal (横書き). An optional vertical (縦書き) Editor mode is desired if technically sound — recorded as a Phase 1/2 research direction, not yet implemented. See Master §22.2 (HD-011).
3. **Emoji:** permitted selectively, but excessive use is prohibited. Any emoji use must be explicitly disclosed and pass Human QA — none is approved by default. See Master §23 (HD-012) and the Emoji Disclosure note below.
4. **Editor actions:** image insertion, undo, and redo were positively evaluated in the prototype and are recorded as high-value Editor interaction requirements to preserve/build (Master §22 context, HD-013).

## Emoji Disclosure (HD-012/HD-014 — final Human QA result, 2026-09-05)

The following emoji/symbols appeared in the Phase 1 UI prototypes (`../../prototypes/ui-comparison/`). Each has now been individually judged by the Product Owner — approvals are scoped to the stated purpose only, not generalized to other uses. See Master §24 (HD-014).

| Emoji/symbol | Location | Purpose | Human QA verdict |
|---|---|---|---|
| ↶ | Editor toolbar (all 3 variants) | 元に戻す (Undo) | **APPROVED** (for Undo only) |
| ↷ | Editor toolbar (all 3 variants) | やり直す (Redo) | **APPROVED** (for Redo only) |
| ⏎ | Editor toolbar (all 3 variants) | 改ページ (Insert page break) | **APPROVED** (for manual page break only) |
| ⚙️ | UI-B mode button; UI-C settings-drawer toolbar button | 設定する / 設定 (Settings) | **APPROVED** (for Settings only) |
| 💾 | Editor toolbar (all 3 variants), `shared/content.js` | 保存 (Save) | **REJECTED** — replace with a text label or design-approved icon |
| 🖼 | Editor toolbar (all 3 variants) | 挿絵 (Insert image) | **REJECTED** — replace with a text label or design-approved icon |
| 👁 | Editor toolbar (all 3 variants) | プレビュー (Preview) | **REJECTED** — replace with a text label or design-approved icon |
| 📝 | Editor toolbar (all 3 variants) | メモ (Memo) | **REJECTED** — replace with a text label or design-approved icon |
| ✏️ | UI-B mode button | 編集する (Editor mode label) | **REJECTED** — replace with a text label or design-approved icon |

Any *new* emoji proposed beyond this set still requires fresh disclosure and its own Human QA pass — this table's approvals do not extend to future icon choices.

Reviewer:

Date: 2026-09-05
