# B3 Feedback instrumentation — Closeout

Status: FIXED / RELEASE-CANDIDATE READY / NOT RELEASED

Human QA completed: 2026-09-21 JST

## Human QA result
- B1 production-flag recheck: PASS
- B2 production-flag recheck: PASS
- B3 UI / responsive review: PASS
- B3 local end-to-end feedback harness: PASS
- Production ordinary report -> Discord: PASS
- Production ordinary report -> Spreadsheet「気になる事」: PASS

## Privacy validation
The local B3 end-to-end harness confirmed:
- UI send success
- local Sheet row = 1
- local Discord thread = 1
- `B3 Human QA送信確認` is present in the submitted feedback
- manuscript body sentinel `ABC987` is absent everywhere downstream
- title sentinel `B3TITLE-XYZ` is absent everywhere downstream
- no title / documentId / fileName field is present
- path is `/editor` only
- no document-id-like UUID is present in message / environment / path

B3 does not silently send manuscript text, selection, title, filenames, document IDs,
PDF/JPG content, or character names.

## Transport boundary
B3 reuses the existing beta-feedback transport:
BetaFeedbackModal
-> submitBetaFeedback
-> Supabase Edge Function `beta-feedback`
-> Spreadsheet「気になる事」 (canonical record)
+ existing Discord forum notification

No new Discord channel is required.

A browser real-send from localhost to the deployed production function is intentionally
not used as the release gate because production CORS and production Turnstile reject
local development origins/test tokens. Instead:
1. the local harness validates the real B3 UI + client + real Edge Function source +
   downstream payload generation with local Sheet/Discord stand-ins, and
2. a normal report sent from the production site validates the live production
   Spreadsheet and Discord transport.

## B3 product questions covered
- Is Review Hub useful / understandable?
- Is max 2 footer tools enough?
- Which Review Hub tools are used frequently?
- What is inconvenient or missing before later Review Hub expansion?

## Data sent on explicit B3 survey submission
- Q1 answer
- Q2 selected tool names
- current footer pin order/count
- page-load-local Hub-open / pin-change counters
- optional user-entered note
- existing standard environment metadata used by the report system

No automatic remote telemetry is introduced.

## Known limits accepted for B3
- Survey answers are plain text in Spreadsheet「気になる事」, not separate columns.
- Usage counters reset on reload and are not persisted.
- The survey is reached via 報告 -> 見直し; no extra link is added inside Review Hub.
- 320x568 uses a short modal scroll area, but controls remain reachable.
- Q2 contains only currently registered Review Hub tools; later tools appear through the registry.
- The pre-existing 906px header-density issue with the beta report button is not a B3 regression.

## QA asset
`tests/local-feedback-harness/` is retained as a QA-only asset because production browser
security intentionally prevents localhost from exercising the deployed feedback function
end-to-end. It must not weaken production CORS, Turnstile, or feedback code.

## Release state
- NOT PUSHED
- NOT DEPLOYED
- NOT MERGED TO MASTER
- Production Update History not published
- A4 frozen RC untouched
- DB/Auth/Supabase/env/migrations untouched

## Rollback path
- Pre-B3 base: B2 closeout `a46279abfc4dbda427a4d3466eb33b42bff95c0c`
- B3 implementation checkpoint: `0e3157f`
- QA harness is a separate QA-only checkpoint.
- Before release, rollback means do not merge/push the B3 commits.
- After a future release, use a normal forward revert/release rollback; do not rewrite production history.
