# TateSpun Typesetting Engine v2 — Workspace

This is the isolated workspace for TateSpun Engine v2 design, research, and prototyping. It lives in the same repository as current Production, in a dedicated worktree on branch `design/tatespun-typesetting-v2`, per the non-negotiable repository/worktree policy below. Nothing under `src/` is touched from here during Phase 0–2.

## Why this exists

TSP-TYPO-LOOP-005 marked the end of patch-style repair of the current typography/rendering architecture. Engine v2 starts from requirements — "what must TateSpun guarantee as correct typesetting?" — before any renderer technology is chosen. See the canonical rule set for the full rationale.

## Canonical authority

**`docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md`** is the highest-authority rule document for Engine v2. Read it first. Everything else in this workspace derives from it and must not contradict it; if a conflict is found, the Master wins and the conflict gets reported, not silently resolved.

## Repository / worktree policy (non-negotiable)

Same repo + separate worktree + dedicated `typesetting-v2/` workspace + integrate into the existing TateSpun app after completion. No separate permanent repository. No independent site. Current Production (`spuntales.net/tatespun/`) stays intact and rollback-capable throughout. See Master §13.0.

## Structure

```
typesetting-v2/
  README.md                     — this file
  docs/
    TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md   — canonical rules (highest authority)
    requirements/                — Phase 0 requirements-freeze artifacts
    architecture/                — Phase 1 research questions (no selection yet)
    decisions/                   — ADR-style Decision Records (populated once decisions are made)
  research/
    browser/ fonts/ shaping/ pdf/ image-export/   — Phase 1 investigation notes, per axis
  fixtures/
    manuscripts/                 — regression corpus spec + (later) corpus text
    expected/                    — (later) expected logical-layout outputs for automated checks
  prototypes/                    — Phase 1–2 technical spikes / PoCs
  qa/
    human/ automated/            — QA procedures and results
  artifacts/                     — generated outputs from prototypes/QA runs
```

Folders are created ahead of need per the Master's recommended structure; they are populated only as each phase actually produces something — empty folders are not filled with placeholder files.

## Phase model

Phase 0 (Requirements Freeze) → Phase 1 (Architecture Research) → Phase 2 (Typography PoC) → Phase 3 (Core Engine) → Phase 4 (Publication Renderer) → Phase 5 (Preview Renderer) → Phase 6 (Existing UI Adapter) → Phase 7 (Full Regression) → Phase 8 (Parallel Production QA) → Phase 9 (Migration). Full detail in Master §14.

Current phase: **Phase 0**, pending Human Review. No implementation, no renderer selection, no commit/push/deploy happens in this phase.
