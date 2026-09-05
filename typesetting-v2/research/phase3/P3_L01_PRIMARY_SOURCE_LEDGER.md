# P3-L01 — Primary Source Ledger

- Status: Research loop artifact (P3-L01), pending Phase 3 Rule-Freeze Human Gate
- Scope: sources used to resolve/narrow P3-O01 (kinsoku), P3-O02 (dash/ellipsis), P3-O06 (ruby)
- Retrieval method note: Phase 1 (P1-L10/P1-L10a) failed to retrieve this content because it relied on WebFetch's fetch-and-summarize model against a single ~1.9MB rendered HTML page, which truncated before reaching the appendix. This loop used a **different retrieval method**: the official page was downloaded verbatim into this worktree (`typesetting-v2/research/phase3/source-cache/jlreq/jlreq-index.html`, 1,925,819 bytes, fetched from `https://w3c.github.io/jlreq/`) and searched directly with exact-text grep — no AI summarization step, so no truncation-before-the-answer failure mode. This is the "different legitimate method" the loop brief asked for (official source, direct retrieval, no access-control bypass).

---

## SOURCE-001

**title:** Requirements for Japanese Text Layout (日本語組版処理の要件)
**publisher/authority:** W3C (Internationalization Working Group), living document
**official URL:** `https://w3c.github.io/jlreq/`
**official repository path:** `w3c/jlreq`, branch `gh-pages`, file `index.html` (this is the branch actually served at the URL above — the repo has no separate modular/XML source; the published HTML *is* the source)
**local cache (this worktree, official content, unmodified):** `typesetting-v2/research/phase3/source-cache/jlreq/jlreq-index.html`
**version/date:** live document as fetched 2026-09-05; no internal version/date string was checked in this pass (OPEN — see Notes)
**section/anchor:** multiple, cited per-claim below (`#cl-01`…`#cl-30`, `#possibilities_for_linebreaking_between_characters`, `#notes_a3`, `#addendum_a3`, `#ruby_and_emphasis_dots`, `#positioning_of_jukugoruby`)
**question supported:** P3-O01 (full character-class table), P3-O02 (dash/ellipsis inseparability rule — corrects the P1-L10 "§3.1.10" citation), P3-O06 (ruby overhang, jukugo-ruby distribution, ruby breakability)
**evidence summary:** see the three freeze-candidate/review documents below; this is the primary source for nearly all of them.
**directly verified:** YES (exact-text grep against the downloaded official HTML, not a model summary)
**confidence:** HIGH
**used for:** kinsoku classification, dash/ellipsis inseparability rule, ruby overhang rules, jukugo-ruby distribution algorithm, hanging-punctuation scope

**Note on document structure:** this document does **not** expose classical numbered clauses (no "§3.1.10"-style numbering appears anywhere in the rendered HTML). The earlier Phase 1 citation of "jlreq §3.1.10" (Master §19, P1-L10a) could not be corroborated then and still cannot be corroborated now — this document has no such numbering scheme. **Citations in this loop use the document's own stable HTML anchor IDs instead** (e.g. `#cl-08`, `#possibilities_for_linebreaking_between_characters`), which are real, dereferenceable, and lower-risk than inventing a section number that doesn't exist in this edition.

---

## SOURCE-002

**title:** Table 2 — Possibility of separation between characters (表2 文字間での分割の可否) — full PDF table
**publisher/authority:** W3C (jlreq repository)
**official URL:** `https://w3c.github.io/jlreq/tables/table_ja3.pdf` (Japanese), `https://w3c.github.io/jlreq/tables/table_en3.pdf` (English)
**local cache:** `typesetting-v2/research/phase3/source-cache/jlreq/table_ja2.pdf`, `table_ja3.pdf` (downloaded, official, unmodified)
**version/date:** not checked (PDF metadata not inspected this pass)
**section/anchor:** referenced from `#possibilities_for_linebreaking_between_characters` (SOURCE-001)
**question supported:** P3-O01 — this is the *actual full N×N breakability grid* the HTML body only summarizes in prose/notes
**evidence summary:** SOURCE-001's HTML body does **not** reproduce the full grid inline — it explicitly defers to this PDF ("See Table 2... (PDF)"). The PDF was downloaded into this worktree's source cache successfully (566,941 / 540,682 bytes, real content, not an error page).
**directly verified:** NO — the PDF's own text/table content was **not** extracted in this pass. This worktree's Read tool requires `pdftoppm` (poppler-utils) for PDF rendering, which is not installed in this environment, and no other legitimate in-worktree extraction path was attempted further within this loop's timebox.
**confidence:** N/A (not read) — the file's *existence and official origin* is confirmed; its *content* is not yet verified
**used for:** flagged OPEN below (see Kinsoku Freeze Candidate §"Not transcribed")
**failed route, recorded so Phase 3 doesn't repeat it blindly:** `Read` tool → PDF render path fails in this environment without `poppler-utils`. A future pass should either install/request `poppler-utils` in this worktree's environment, or fetch the PDF's raw text stream via a non-rendering extraction path, before assuming this table is unreachable.

---

## SOURCE-003

**title:** 簡便な行組版ルール（案） — "Simplified line composition rules (draft/proposal)"
**publisher/authority:** W3C jlreq repository, `docs/line-composition/` — an editorial companion document, **not** part of the normative jlreq body itself (title explicitly says "案" = draft/proposal)
**official URL:** `https://w3c.github.io/jlreq/docs/line-composition/`
**question supported:** P3-O02 (corroborating, lower-confidence companion to SOURCE-001)
**evidence summary:** States verbatim: "2倍ダーシや2倍の3点リーダーなどは分割禁止とすることから1つの文字クラスになっている" (double-width dashes and double-width three-dot-leaders are grouped into one character class *because* they are prohibited from being split). Also discusses ぶら下げ組 (hanging punctuation) citing an Iwanami Shoten proofreading reference.
**directly verified:** YES (WebFetch against this specific, small, topic-scoped page — not the giant main document — did not truncate)
**confidence:** MEDIUM — this document uses its **own, different, simplified 12-class scheme** (cl-i through cl-xii), not the main document's 30-class scheme (cl-01–cl-30, SOURCE-001). **Do not conflate the two numbering systems** — they are different documents with coincidentally-similar-looking IDs. This document is corroborating evidence for the *concept* (dash/ellipsis run-inseparability is a real, named jlreq-family idea), not a citable source for the *classification numbering* Phase 3 should actually implement (use SOURCE-001's cl-08 for that).
**used for:** corroboration only, in the Dash/Ellipsis Freeze Candidate

---

## SOURCE-004 (discovery only, not authoritative)

**title:** WebSearch snippets (multiple, general web search)
**publisher/authority:** none — blog/aggregator-level, unverified
**question supported:** initial discovery/orientation only (pointed this loop toward the "分離禁止" / dash-ellipsis-inseparability concept and toward the existence of a 30-class jlreq scheme, both of which were then independently verified against SOURCE-001 directly)
**directly verified:** NO
**confidence:** LOW — **used only to decide where to look next, never cited as evidence for any frozen rule.**
**used for:** nothing in the frozen output; discovery routing only, per the loop brief's source-priority policy.

---

## Failed / abandoned retrieval routes (recorded so they are not blindly repeated)

1. **WebFetch-and-summarize directly against `https://w3c.github.io/jlreq/` for the character-class appendix and the dash/ellipsis rule.** This is the exact route Phase 1 (P1-L10a) used and that failed (truncation before reaching the appendix). **Not repeated in this loop.** Superseded by: download the page verbatim into the worktree, then `grep`/`Read` it directly (SOURCE-001's retrieval method above) — this succeeded on the first attempt.
2. **Reading `table_ja2.pdf`/`table_ja3.pdf` via the `Read` tool.** Failed: `pdftoppm is not installed`. Not retried with a different flag/parameter (there isn't one) — recorded as a real tool-capability gap for a future loop to solve differently (e.g. a text-mode PDF extractor), not silently worked around.
3. An early attempt to cache downloaded research files under this session's OS-level scratch directory (outside the worktree) was corrected mid-loop per explicit user instruction; all research artifacts in this loop live under `typesetting-v2/research/phase3/source-cache/`, in compliance with Master §13's workspace-isolation rule.

---

## Human Rule-Freeze Gate → Source ID map (2026-09-05, no new sources opened)

| Human decision | Built on | Note |
|---|---|---|
| HG-1 (cl-05 stricter default) | SOURCE-001 (`#addendum_a3`) | Source establishes the base level + Level 2 relaxation; the Human choice is which level TateSpun adopts |
| HG-2 (cl-12/13 stricter default) | SOURCE-001 (`#addendum_a3`) | Same source, Level 1 relaxation this time |
| HG-3 (jukugo-ruby breakability capability) | SOURCE-001 (`#notes_a3` id597, `#positioning_of_jukugoruby`) | Source establishes jlreq permits this; the Human choice is to build the capability into Core |
| HG-4 (class-aware overhang, principle only) | SOURCE-001 (`#ruby_and_emphasis_dots` overhang notes) | Source documents *that* class-specific budgets exist and offers multiple conventions; exact convention selection deliberately left OPEN, not sourced further here |

## Unsupported-claim check

No section number, table figure, or rule in the four output documents (Kinsoku/Dash-Ellipsis/Ruby freeze candidates, Rule Freeze Matrix) is asserted without either (a) a direct quote/anchor from SOURCE-001, verified by grep against the locally-cached official file, or (b) explicit labeling as PRODUCT_POLICY / OPEN / not-yet-verified. The previously-invented "jlreq §3.1.10" citation (Master §19) is explicitly corrected, not repeated, in the Dash/Ellipsis Freeze Candidate.
