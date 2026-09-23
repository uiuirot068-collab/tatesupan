# B6 傍点（圏点）— implementation result

Status: **B6 BLOCKED / PARITY NOT PROVEN / NOT RELEASED** (decided after a bounded investigation; see `B6_ARCHITECTURE_DECISION.md`).

## What was and was not done
| Item | Result |
|---|---|
| Investigation (manuscript model, selection/range, persistence, undo/redo, ruby/TCY/punctuation/page-break, Preview / JPG / PDF, both renderer modes) | done — findings in the decision doc |
| Architecture decision document | written |
| Product code (notation, authoring action, renderer branches, exports) | **not changed** — nothing partial, nothing faked (no ruby-based emphasis) |
| Automated QA for B6 | none to run: no B6 behaviour exists. Baseline evidence recorded instead: today's tokenizer / 文章チェックβ treat `《《…》》` as literal text (`parity/current-behaviour-of-proposed-notation.json`) and CSS `text-emphasis` leaves the vertical column pitch unchanged at generous line spacing (`parity/css-text-emphasis-layout-probe.json`) |
| Export parity (Editor / Preview / JPG / PDF, LEGACY and V2_BETA) | **not proven** — V2_BETA needs a frozen-Core-contract change plus Preview/Publication paint models, PDF and raster generators; production renderer flag is unverifiable from the repo |
| Responsive authoring control (390 / ~770 / 1280) | not applicable — no control was added |
| Roadmap | B6 recorded as BLOCKED / PARITY NOT PROVEN |

## Why stopping is the correct result here
The brief and the roadmap make export parity a precondition ("Editor/Preview-only appearance is insufficient", "if parity cannot be proven safely, stop"). The LEGACY route looks feasible, but it would leave V2_BETA without emphasis and is unproven for JPG/PDF; the V2_BETA route is a multi-module Core-contract change. Shipping either alone would be the "partial fake support" the brief forbids.

## State left behind
- Working tree: docs + evidence only under `typesetting-v2/qa/b6-emphasis/`, plus the roadmap B6 note. The app behaves exactly as at B5.
- B4 and B5 checkpoints are unaffected and independent of this outcome.
- Rollback: revert the docs commit (no behaviour to roll back).

## Next step (Human decision required)
See `B6_ARCHITECTURE_DECISION.md` §5. Until those are answered, B6 stays out of the release train; per the train policy the release order may proceed B4 → B5 with B6 deferred.
