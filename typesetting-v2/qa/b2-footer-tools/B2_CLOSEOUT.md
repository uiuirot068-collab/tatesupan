# B2 Footer 2-tool customization — Closeout

Status: FIXED / RELEASE-CANDIDATE READY / NOT RELEASED

Human QA: PASS (2026-09-21 JST)

Validated by Human:
- Footer pin/unpin semantics: PASS
- Writing-check remains usable from Review Hub when unpinned.
- Footer display is independent from writing-check ON/OFF.
- Re-pin and persistence: PASS.
- 770px tablet action-row regression: PASS.
- Other previously checked B2 Human QA items: PASS.

Automated checkpoint inherited from commit `b931423`:
- B2 focused tests: PASS
- component tests: PASS
- hooks tests: PASS
- typegen: PASS
- TypeScript: PASS
- changed-file ESLint: 0 errors
- git diff-check: clean
- Review Hub E2E: PASS
- header-density E2E: PASS
- mobile-shared-export E2E: PASS

Known pre-existing baseline failures, not B2 blockers:
- `exportCancellation.test.ts` topmost Escape
- `editorSessionActivity` E2E immediate debounced character-count snapshot

Accepted B2 known limits:
- Pinned writing-check uses the existing B1 strip instead of a separate compact chip.
- A one-step undo action may remain visible after a writing-check correction even when writing-check is unpinned.
- Extremely narrow ~335px split columns may wrap when both footer tools are pinned.

Release state:
- NOT PUSHED
- NOT DEPLOYED
- NOT MERGED TO MASTER
- Production Update History not published
- A4 frozen RC untouched
- DB/Auth/Supabase/env/migrations untouched

Rollback path:
- Pre-B2 base: `d72e2e30abfed61d67acd15860789d5b92875f1b`
- B2 implementation commits: `3fd7f19`, `b931423`
- Before release, rollback = do not merge/push these B2 commits.
- After a future release, use a normal forward revert/release rollback; do not reset production history.
