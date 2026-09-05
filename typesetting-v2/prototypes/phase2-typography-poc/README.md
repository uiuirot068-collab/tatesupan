# Phase 2 — P2-L01 Typography PoC (C1 / C2 / C3)

Master reference: `../../docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md` §14 Phase 2.
Loop log: `../../research/PHASE2_LOOP_LOG.md` (P2-L01-A/B/C/D).
Human QA: `../../qa/human/PHASE2_L01_TYPOGRAPHY_SCORECARD.md` (unscored — Product Owner fills this in).

## What this is

A small, comparable visual proof-of-concept of the three Phase 1 shortlisted
candidate architectures (`../../docs/architecture/PHASE1_SHORTLIST.md`),
rendering the same canonical regression sentence under the same 文庫 preset
conditions, using the same font, so they can be compared side by side. It is
**not** the full Engine v2 implementation.

## How to view the result

Open `comparison.html` directly in any browser (no server, no build step).
A static reference screenshot (taken with a headless local Edge, in case
opening the file isn't convenient) is at `outputs/comparison-screenshot.png`.
The PDF spike is at `outputs/c1-c3-bunko-native-printtopdf.pdf`.

## Test conditions (fixed across all three candidates)

- Preset: **文庫**, 1-column — read read-only from `src/constants/paperSizes.ts`
  (`'文庫'.cols1`): 105mm×148mm paper, margins T14/B14/gutter15/outer10mm,
  font-size 8.5pt, line-spacing 1.7, 38 chars/column, 16 columns/page.
- Font: **Shippori Mincho** (Google Fonts CDN, `wght@400;700`, matching
  `src/app/layout.tsx`'s own loading and `src/constants/fonts.ts`'s default
  option) — same family for all three candidates (font-fairness requirement).
- Text: the canonical regression sentence (`REGRESSION_CORPUS_SPEC.md` §1):
  `「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」`

## Candidates, and exactly what each PoC does

### C3 — Browser Control (`candidates/c3-browser-control/`)
Plain `writing-mode:vertical-rl; text-orientation:mixed` on a normal block.
Browser does line-breaking, kinsoku, glyph shaping, and punctuation
placement entirely natively. Zero compensation. This is the baseline the
other two are compared against — it is deliberately **not** "fixed."

### C1 — Pragmatic Hybrid (`scripts/build-comparison.js` → `buildC1`)
Explicit absolute-positioned character grid — each character gets its own
`<span>` at a deterministic `(col, row)` cell computed directly from 文庫's
own `charsPerLine`/`fontSize`/`lineSpacing` values (FixedSlot's *positioning
discipline*, not its DOM-screenshot export path). Glyph painting inside
each cell is still 100% native browser shaping — **no per-glyph optical
correction was added.** What this PoC actually demonstrates: logical layout
(which character sits where) is separated from — and deterministic
independent of — natural CSS reflow; visual punctuation rhythm is,
correctly, unchanged from C3 (see loop log P2-L01-B).

### C2 — Dedicated Shaping (`candidates/c2-dedicated-shaping/`)
Real HarfBuzz-via-WASM (`harfbuzzjs`) shaping of the sentence, direction
`ttb`, against the actual Shippori Mincho font file, with several explicit
OpenType feature combinations tested (not assumed). Output glyphs are drawn
as real SVG `<path>` vector outlines (`font.glyphToPath`) positioned by the
shaper's own advance/offset data — the browser only rasterizes vectors
here, it performs no text shaping for this candidate. See
`evidence/SHAPING_EVIDENCE.md` for the full measured findings (short version:
this font's `vpal` only nudges glyph offset, never advance — the punctuation
gap is not solved by this font's own OpenType data alone).

### Publication (PDF) spike
Attempted via the Vivliostyle CLI first (the path the Phase 1 shortlist
names for Candidates 1 and 3) — hit a tooling blocker (CLI exits silently
in this sandboxed, non-interactive shell; see loop log P2-L01-D). Fell back
to native Chromium/Edge `--print-to-pdf` against the same 文庫-dimensioned
HTML: produced a genuinely selectable-text vertical PDF (`outputs/c1-c3-
bunko-native-printtopdf.pdf`) — a first empirical confirmation of Phase 1's
open R-004 question — but did not auto-paginate the sentence's overflow
into a second page/column. Recorded as ACCEPT (selectable text) + OPEN
(auto-pagination), not silently treated as fully solved.

## Dependency policy compliance

`harfbuzzjs`, `opentype.js`, `@resvg/resvg-js` are installed **only** inside
`candidates/c2-dedicated-shaping/package.json` (isolated PoC-only package,
not touching the repo root `package.json`/`package-lock.json`). A nested
`.gitignore` in this folder keeps their `node_modules/` and log files out
of any future `git add`. `@vivliostyle/cli` was invoked only via `npx`
(never installed anywhere), matching `tools/renderer-poc/README.md`'s own
established pattern. None of these installs constitute a Production
dependency decision.

The Shippori Mincho `.ttf` used for the HarfBuzz spike was downloaded from
the `google/fonts` GitHub mirror (OFL license) into an out-of-repo scratch
path for this session only — it was **not** copied into any committed
location in this repo (see `../../docs/TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md`'s
general "don't unnecessarily duplicate font binaries" guidance). To
reproduce: fetch `https://github.com/google/fonts/raw/main/ofl/shipporimincho/ShipporiMincho-Regular.ttf`
and pass its path via the `TSP_FONT_PATH` env var to the scripts in
`candidates/c2-dedicated-shaping/`.

## Known limitations of this specific loop (see loop log for full detail)

- Only the canonical single sentence was tested, not the full Regression
  Corpus (kinsoku, hanging, ruby, TCY, dashes/ellipsis, images, pagination
  are all untested here — the corpus text itself still needs assembling,
  `../../fixtures/manuscripts/REGRESSION_CORPUS_SPEC.md` is spec-only).
- Only the 文庫 preset was tested (per loop brief scope).
- C2 was not column-wrapped at 文庫's 38-char capacity (rendered as one
  continuous column) — multi-column splitting of raw shaped output was out
  of scope for this loop's timebox.
- The Vivliostyle CLI publication path (as opposed to native print-to-PDF)
  remains unverified due to a tooling blocker, not a capability finding.
- No architecture has been selected. This is comparative evidence only,
  pending Human Visual QA (`../../qa/human/PHASE2_L01_TYPOGRAPHY_SCORECARD.md`).
