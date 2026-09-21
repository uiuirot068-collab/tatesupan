# B6 傍点（圏点）— architecture decision

**Decision: B6 BLOCKED / PARITY NOT PROVEN / NOT RELEASED.**
No product code was changed for B6. No emphasis notation, UI, renderer branch or fake ruby-based emphasis was added. This document is the bounded investigation the brief required *before* mutation, and it records why implementation was stopped, what a safe implementation would have to be, and which decisions belong to the Human.

Date: 2026-09-22 · Branch `feat/tsp-b4-b6-train-20260922` · push NO · deploy NO · master merge NO · A4 untouched · DB/Auth/Supabase/migrations untouched.

## 1. Rule applied
> If safe parity requires broad renderer redesign or cannot be proven, STOP B6 after bounded investigation … Do not ship partial fake support. (train prompt, Phase 4)
> CSS `text-emphasis` is only a candidate; Editor/Preview-only appearance is insufficient; prove export parity before adopting. (roadmap B6)

Both conditions hold: parity must be proven for **two renderer modes** (LEGACY and V2_BETA) × **Preview / JPG / PDF**, the V2_BETA half needs a change to a frozen Core contract plus five renderer modules, and which mode production uses cannot be verified from the repository.

## 2. What the investigation found

### 2.1 Manuscript model / persistence / undo — *fine, not the blocker*
The manuscript is one plain string with inline notation (`｜漢字《かん》`, `[tate]…[/tate]`, `【改ページ】`, `【IMG:…】`). Save/reload (IndexedDB / cloud `content`), Undo/Redo (native textarea history; WINDOWED editor's application-level `undoModel`) and copy/paste all operate on that string. A **string-level notation** therefore gets persistence, undo/redo and selection ranges for free and needs **no Supabase schema change** and no client-document format bump.
Current behaviour of the proposed notation `《《…》》` (Kakuyomu / Narou convention) — measured, `parity/current-behaviour-of-proposed-notation.json`: today it is **literal text** in the tokenizer (`これは《《強調》》です。` → one `text` token), it does **not** collide with the ruby regexes (`漢字《《強調》》` is still plain text), and 文章チェックβ raises nothing on it. A ruby or 縦中横 inside an emphasis range tokenises as *separate* tokens with the markers left as stray literal text (`《《｜漢字《かんじ》》》` → `text(《《)`, `ruby`, `text(》》)`), so the flat token model **cannot nest** emphasis around ruby/TCY without tokenizer + pagination changes.
Backward compatibility: an older client would show `《《…》》` literally; an existing manuscript that already contains that literal would change meaning. Both are documented risks, not blockers.

### 2.2 Two independent renderers, two export architectures — *the blocker*
`src/lib/v2Rollout.ts`: `NEXT_PUBLIC_TATESPUN_RENDERER` is inlined at build time; `"V2_BETA"` enables the v2 renderer, anything else is `LEGACY`. The repository cannot tell which value production uses (the roadmap lists confirming it in the Cloudflare dashboard as an open item, §"In the Cloudflare Pages dashboard … confirm current Production values"). Per the brief, an unverified production renderer must not be assumed, so **both** must be proven.

| | LEGACY | V2_BETA |
|---|---|---|
| Preview | DOM `PageCard.tsx` (2 586 lines; ruby = `<ruby>`, TCY inline-block, per-character layout contracts) | Core `LogicalUnit[]` → `CanonicalDocument` → **Preview paint model** (`renderer/preview/paintModel.ts`, 555 lines) → React `PreviewRenderer.tsx` |
| JPG | `html-to-image` capture of the live Preview DOM | **Publication** paint model → `rasterGenerator*.ts` (a *sibling* consumer: "Preview PASS ≠ Publication PASS", Master §28.10) |
| PDF | `jsPDF.addImage` of that DOM raster | **vector** `PaintPlan` (one `PaintCommand` per glyph/rect) → jsPDF primitives (`pdfGenerator.ts`, 1 381 lines) with embedded font metrics/GPOS |

### 2.3 Cost of doing it *right* in V2_BETA
Emphasis has to become a first-class typographic fact, not CSS. Every layer that today knows about ruby would need to learn about emphasis, in a package whose contracts are frozen and golden-tested:

| Layer | Change needed | Ruby-mention count (size proxy) |
|---|---|---|
| `src/lib/tategaki.ts` tokenizer + pagination (`paginateTokens`, `computePageSourceRanges`, hanging punctuation, text frames) | paired zero-width `emphasisStart/End` tokens; per-page carry of the "active emphasis" state; source-range audits | 22 |
| `src/lib/v2Bridge/manuscriptAdapter.ts` | map to v2 units | 4 |
| `core/units/*` (**frozen Contract §5**) | new attribute or unit kind on TEXT / RUBY / TCY | 13 (+units index) |
| `core/compose/line.ts`, `core/layout/schema.ts`, `core/breaks/opportunity.ts` | carry the attribute through composition and layout | 37 / 10 / 8 |
| `renderer/preview/paintModel.ts` + `PreviewRenderer.tsx` | dot primitive + geometry | 28 / 34 |
| `renderer/publication/paintModel.ts` + `pdfGenerator.ts` + `rasterGenerator*.ts` | dot primitive in physical mm; vector circles in PDF; canvas dots in JPG | 16 / 19 / — |
| LEGACY `PageCard.tsx` | dots per character without disturbing the fixed column pitch and "no per-glyph nudge" contract | 61 |
| `tools/compare/*`, fixtures, golden PDFs/JPGs | new fixtures and re-baselined goldens | 60+ |

That is a multi-module change across a frozen contract, i.e. "broad renderer redesign". It also needs its own parity harness (deterministic fixtures × {LEGACY, V2_BETA} × {Preview, JPG, PDF}) before it can be called parity.

### 2.4 What CSS `text-emphasis` does (measured) — sufficient for LEGACY Preview only
`parity/css-text-emphasis-layout-probe.json` + screenshots: a standalone `vertical-rl` page (20 px font, line-height 1.6) with and without `text-emphasis: filled dot|sesame; text-emphasis-position: over right`: **all five column pitches identical (32 px), same scroll width** — the marks sit on the right of each glyph inside the line-height slack, so the LEGACY Preview column grid is not disturbed (with generous line spacing; it was not measured at tight spacing). So a LEGACY-only Preview is plausible. But it does **not** reach V2_BETA (no DOM), and LEGACY JPG/PDF capture of `text-emphasis` through `html-to-image` was **not** proven (no product code was modified to test it end-to-end). A LEGACY-only implementation would ship emphasis that silently disappears (or differs) when the build flag is `V2_BETA` — exactly the "partial fake support" the brief forbids.

### 2.5 Open typographic conflicts (need a Human decision, not code)
- **Ruby vs 傍点 side.** TateSpun's ruby annotation lane is on the right (`rubyLane.ts`: annotation centre 46 % of column pitch toward the Ruby side). Japanese vertical convention also puts 圏点 on the right. Ruby + 傍点 on the same characters needs a rule (dots on the opposite side? ruby wins? disallow?), and the brief requires "ruby + emphasis coexistence".
- **縦中横 (TCY).** A TCY run is one logical cell (`logicalCells: 1`): one dot per cell or per digit?
- **Dot style/size/offset** (black dot only in the initial beta; which size ratio, which distance) and how it interacts with 促音/句読点/括弧 (dot on punctuation? on 「」?).
- **Page/line breaks.** An emphasis range crossing a line or page boundary; emphasis over 改ページ (must the marker split?).
- **Range edits.** Typing at the start/end of a range (inside or outside?), Backspace onto a half marker, deleting one marker leaving an orphan (render orphan literally + a 文章チェック hint?).

## 3. Parity judgment
| Mode | Preview | JPG | PDF |
|---|---|---|---|
| LEGACY | plausible (CSS route measured to keep the column grid) — **not implemented** | **not proven** | **not proven** |
| V2_BETA | **not implemented; broad redesign** | **not proven** | **not proven** |

**PARITY NOT PROVEN → B6 BLOCKED.** Nothing partial ships.

## 4. If B6 is taken up later — recommended design (so this investigation is not lost)
1. **Semantic representation:** inline notation `《《…》》` in the manuscript string (same family as ruby/TCY/改ページ), never ruby data. Tokenizer emits paired `emphasisStart/emphasisEnd` tokens (zero width, like `pageBreak` is zero-width); an unpaired marker stays literal text. Ruby and 縦中横 inside a range are allowed (tokens are flat; the *state* is what nests).
2. **Authoring:** a 「傍点」 action (selection → wrap / unwrap; toggle when the whole selection is already inside one range; merge adjacent ranges) built on the existing `replaceRangeGlobal` (WINDOWED) / textarea edit paths so it is **one atomic undoable edit**. Nothing else in Undo/Redo changes.
3. **Persistence / compatibility:** string only; no schema change; document the literal-marker behaviour for older clients; a one-time check that no existing stored manuscript contains a literal `《《`.
4. **Renderer/export strategy (the real work):** treat emphasis as a **paint-plan fact computed once** (per emphasised glyph cell: dot centre/radius in physical mm from Core's placed cell) and consumed identically by Preview, JPG and PDF — never CSS-only. Sequence: (a) amend Core Contract §5 with an emphasis attribute + tests; (b) Preview + Publication paint models emit a `DOT` primitive; (c) `pdfGenerator` draws vector circles, `rasterGenerator*` draws canvas circles; (d) LEGACY `PageCard` draws the same geometry (absolutely-positioned pseudo-element, not `text-emphasis`, so it can never move the column grid); (e) fixture set + goldens for {LEGACY, V2_BETA} × {Preview, JPG, PDF}, with a numeric dot-centre comparison instead of eyeballing.
5. **Undo/redo strategy:** none beyond the string (edits are ordinary text edits).
6. **Parity gate:** B6 may only move to HUMAN_GATE when the numeric parity harness passes in **both** renderer modes and a Human has looked at Preview / JPG / PDF fixtures.

## 5. Decisions needed from the Human (before any B6 loop)
1. Which renderer does **production** actually use (Cloudflare `NEXT_PUBLIC_TATESPUN_RENDERER`)? If LEGACY only, is a LEGACY-only beta acceptable (with V2_BETA explicitly unsupported and gated), or must both be covered?
2. Ruby + 傍点 on the same characters: side/precedence rule (or forbid combining in the beta).
3. TCY and punctuation dot policy; dot size ratio/offset.
4. Go/no-go on a dedicated V2 loop that amends the frozen Core contract (est. multi-day, golden re-baseline).

## 6. Evidence in this folder
- `parity/css-text-emphasis-layout-probe.json` and `parity/css-text-emphasis-probe-{plain,cssTextEmphasis,cssTextEmphasisDot}.png` — measured column pitch with/without `text-emphasis`.
- `parity/current-behaviour-of-proposed-notation.json` — today's tokenizer / 文章チェックβ behaviour on `《《…》》`.
