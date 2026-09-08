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

11-A Phase 2 is COMPLETE:
- fix-class model implemented: `SAFE_AUTO_FIX` / `REVIEW_BEFORE_FIX` / `NOTICE_ONLY`, a required field on every diagnostic, independent of `severity` (a diagnostic can be HIGH_CONFIDENCE yet NOTICE_ONLY, exactly as this spec's own §11-A correction anticipated)
- paragraph/whitespace category: R6 trailing whitespace (SAFE_AUTO_FIX), R7 leading tab+ideographic-space mixing (REVIEW_BEFORE_FIX), R8 3+ consecutive blank lines (NOTICE_ONLY, REVIEW severity, **disabled by default** -- blank-line conventions vary by author/genre, a real style question left for a later Human decision on defaults)
- vertical-writing character category (partial): R4 half-width katakana detection (REVIEW_BEFORE_FIX, no computed replacement text yet -- a real conversion table is deferred to whenever the Fix UI itself is built), R5 stray control characters (SAFE_AUTO_FIX)
- per-rule configuration contract: `WritingCheckConfig.ruleOverrides` (additive, flips specific rules relative to the engine's own default set) alongside Phase 1's `enabledRuleIds` (absolute whitelist, unchanged)
- rule IDs remain stable/deterministic (explicit regression test), replacement ranges verified safe across emoji/ruby/TCY/multiline/CRLF context
- explicit no-mutation regression tests added

Deliberately NOT attempted in Phase 2 (real false-positive/product-judgment risk without further guidance):
- "excessive indentation" (no reliable existing contract defines an invalid threshold -- this spec's own caution against assuming "one ideographic space is always mandatory")
- ASCII punctuation with a full-width equivalent (URL/code/deliberate-Latin false-positive risk)
- half-width katakana's own auto-conversion replacement text

The remaining categories (broader vertical-writing checks beyond R4/R5, dictionary/NG words) remain open, along with the entire Fix/Ignore UI, presets, and bulk-fix workflow (11-A Phase 3, HUMAN_GATE).

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
