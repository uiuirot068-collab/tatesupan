# TateSpun 11-A / 11-B Specification v1.1
Updated: 2026-09-09
Revision reason: roadmap reconciliation recovered older authoritative scope details that were missing from v1.

## 11-A correction / recovered historical authority

The historical TateSpun roadmap already contained an unnumbered future item:
**文章チェックβ v2 — 縦書き・入稿向け原稿チェック**

Its intended categories were:

1. 約物 / punctuation
2. 段落・空白 / paragraph & whitespace
3. 縦書き文字 / vertical-writing character issues
4. TateSpun notation errors
5. 表記 / dictionary / NG-word features

The historical richer finding/fix model also included a **fix-class** concept:

- `SAFE_AUTO_FIX`
- `REVIEW_BEFORE_FIX`
- `NOTICE_ONLY`

This is distinct from severity. A diagnostic may be high-confidence yet still be NOTICE_ONLY, or may have a safe mechanical replacement.

### Current implementation state

11-A Phase 1 is COMPLETE (`26eef0f`):
- reusable local rule engine
- current bracket/punctuation/TCY/ruby rules
- structured diagnostic schema
- HIGH_CONFIDENCE / REVIEW severity
- UTF-16 offsets
- IME/privacy/build regression coverage

The original fix-class model has NOT yet been implemented.
The remaining categories (paragraph/whitespace, broader vertical-writing checks, dictionary/NG words) remain open.

### Product principles preserved

- textarea remains manuscript source of truth
- browser-local processing
- no automatic external AI/API manuscript transmission
- no silent mutation
- output PDF/JPG/Preview must not contain diagnostics
- explicit Human actions are required for manuscript modification

### β boundary still requiring Human decision

Need Human decision on whether category 5 dictionary/NG-word/user-dictionary UI is:
- required for β, or
- post-β.

Presets, Fix/Ignore UI and safe bulk fix also remain for later 11-A phases.

---

## 11-B recovered historical authority

Historical source: Master §9.2 `Session Editing Metrics`.

Confirmed:
- START
- END
- inserted characters
- deleted characters
- `totalActivity = inserted + deleted`
- example: +100, -50, +30 = total activity 180
- final manuscript net length is not the metric
- results may be explicitly shared to SNS
- belongs to Editor Session Metrics, not Typesetting Engine Core

Still unresolved historically:
- IME composition
- paste
- cut
- undo
- redo
- replace
- select-all delete
- import
- programmatic normalization
- ruby input
- page-break token
- image token
- Writing Check-driven fixes
- persistence/history semantics

No implementation has started yet.

---

## Prompt ownership

ChatGPT owns implementation-prompt creation and review.
Claude Code / Cursor is the implementation/audit agent.
