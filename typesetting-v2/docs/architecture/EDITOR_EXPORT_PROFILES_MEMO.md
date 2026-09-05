# Editor Export Profiles — Product Requirement Memo

- Status: PRODUCT REQUIREMENT recorded during Phase 2. **Not an architecture or implementation decision** — recorded here only so it isn't lost before its own specification pass. See `PHASE3_OPEN_ITEMS.md` P3-O11.
- Classification: **Editor Export Profiles** — separate from the Typesetting Engine core (same category boundary Master §20.7/HD-007 already draws for 文章チェックβ).

## Requirement

When exporting Editor text, the user should be able to choose between at least:

**A. 記法あり / markup-preserving export**
Purpose: retain Markdown and/or TateSpun textual notation (ruby, TCY, page-break markers, image markers, etc.) needed for re-editing or moving the manuscript to another capable editor.

**B. プレーンテキスト / 投稿向け export**
Purpose: easy copy/export for posting sites such as pixiv, without unwanted Markdown-style or TateSpun-specific markup leaking into the visible text.

**C. Future-capable design: platform-specific export profiles**
Example concept: a pixiv-specific (or other posting-site-specific) notation conversion. **Not implemented or promised in Phase 2** — only the *design space* for future profiles should not be foreclosed by how A/B are specified.

## Relationship to the existing TXT requirement (Master §9.1)

These are two separate concerns and must not be collapsed into one:

- **TXT import/export** (Master §9.1, already-approved v2 requirement): the transport *file format* — encoding, line endings, BOM, round-trip guarantee.
- **Export Profile**: a *notation transformation* applied to the same source manuscript before it becomes a text file.

The same source manuscript can pass through either profile and still be written out via the same TXT transport format:

```
source manuscript → Profile: markup-preserving → .txt file
source manuscript → Profile: plain              → .txt file
```

## Open policy questions (for the later specification pass, not decided here)

- How does ruby (`｜base《reading》` / bare-kanji-run《reading》) render in Plain Text mode — dropped entirely, reading-in-parens, something else?
- How does the manual page-break marker (`【改ページ】`) render in Plain mode?
- Headings — does TateSpun have a heading notation, and how does each profile handle it?
- Images (`【IMG:...】` markers) — dropped, described, or something else in Plain mode?
- Colophon (奥付) — included in export at all? Which profile?
- General TateSpun-specific control notation not otherwise listed above.
- Markdown emphasis/other markup removal rules for the Plain profile.
- Line-ending and encoding behavior per profile (or is this always governed by the existing TXT requirement, Master §9.1, regardless of profile?).

## Explicit non-decisions

- No specific platform profile (pixiv or otherwise) is specified or promised here.
- No UI/UX for profile selection is designed here.
- No implementation exists yet — this is a requirement record only, per instruction not to implement it in this task.
