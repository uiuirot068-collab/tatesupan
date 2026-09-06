# P3-O12 Capacity / Geometry Audit

- **Status: RESEARCH + PRODUCT DECISION EVIDENCE ONLY. No implementation.**
- Scope: read-only inspection of `src/` (Production) and `typesetting-v2/docs` (frozen v2 Core Contract). No file under `src/` was modified. No v2 Core module was created.
- Branch: `design/tatespun-typesetting-v2`, HEAD `8fd24d5` (unchanged), worktree clean before and after.
- P3-O12 remains **OPEN**. This document ends with **DECISION READY**, not RESOLVED.
- **P3-O12-B update (same HEAD, same worktree):** §16 traces the exact load→render code path and resolves the apparent tension between "derived capacity persisted" and "recomputed on load" reported in the original audit (§4/§5 below, unchanged). §16 also stress-tests and confirms the 8-point compatibility policy Product proposed as technically coherent, with two concrete implementation-level gaps flagged (not conceptual objections) — see §16.6/§16.9. §11-§15 below are left exactly as originally written; §16 sharpens, and in one case (the 2-column clamp bug, originally Human Decision #2) resolves, points they left open.
- **P3-O12-C update — HUMAN PRODUCT DECISION: APPROVED.** Approved direction: **Option B/D, versioned compatibility/hybrid**, in the concrete 8-point shape stress-tested and confirmed coherent in §16.8. Implementation of the pure capacity-policy module (legacy-frozen port, v2-native formula, version/migration-trigger dispatch — no Editor/`src/` wiring) is now authorized and has been completed under `typesetting-v2/core/settings/` (`capacityFormulaVersion.ts`, `capacityLegacyFrozen.ts`, `capacityV2Native.ts`, `capacityPolicy.ts`, `capacityFixtures.ts` + test files). P3-O12 status: **IMPLEMENTED / READY FOR VALIDATION** — not CLOSED; Production/Editor integration remains a separate, future, explicit gate (§15, unchanged).

---

## 1. Executive Summary

TateSpun currently decides "how many characters fit on a page" with a small, well-commented set of pure functions in `src/lib/pageLayout.ts`. They take a paper size, margins, font size, line spacing and column count, and produce two numbers: characters per vertical line, and lines per column. This audit traced that formula exactly, checked what a saved document actually stores, and compared it against the frozen v2 Core Contract's own capacity rules.

Three things stand out:

1. **A saved document's page settings are not just margins — they also store the target character/line counts as plain numbers, with no version tag on which formula produced them.** If the derivation formula changes, every existing document's page count and pagination could shift the next time it's opened, silently. This is not a hypothetical — it is how the code is built today.
2. **The product already has two competing "how much can I fit" formulas in production**, used at different moments (a cautious "auto/preview" estimate with a built-in safety margin, and a stricter "maximum" used when margins mode commits a change). They already disagree for 2-column presets — the "maximum" formula ignores the 2-column split entirely and reports a physically impossible capacity for a single line. This is a pre-existing product quirk, not something v2 would introduce.
3. **The numbers printed inside `PAPER_SIZE_TEMPLATES` (e.g. "文庫 = 38×16") are not actually used to compute anything.** The moment a user picks a paper preset, the app immediately re-derives chars/lines from that preset's margins and font size — and gets a *different* number (39×15 for 文庫 1段, in the app's own current behavior). The template's stored numbers are stale display artifacts, not the live algorithm's output.

None of this is a bug that needs fixing today — it is the existing, shipped, and evidently accepted behavior. But it means: **v2 cannot treat "port the preset numbers" and "port the derivation algorithm" as the same task**, and **any new formula — even one Product considers "obviously more correct" — is a compatibility-risk change for every document already saved**, because there is currently no mechanism that would stop it from silently repaginating them.

The recommendation (§13) is a **versioned compatibility layer** (Option B): freeze the current formula, verbatim, as a versioned "legacy" derivation that existing documents keep using; build the v2-native, GeometryTick-based formula only for new documents (or documents that explicitly opt in). This preserves every existing reader's pagination exactly, while letting v2 start clean.

---

## 2. Current Production Calculation Pipeline

### 2.1 Entry points (call graph)

```
computePageLayout(settings: PageSettings): PageLayout      ← the ONE function that decides what actually renders/paginates
  ├─ resolvePaperSize(settings.paperSize)                   → PaperSize { widthMm, heightMm, isPx, widthPx?, heightPx? }
  ├─ computeFontSizeMm(fontSizePt)                           = fontSizePt * MM_PER_PT
  ├─ computeLinePitchMm(fontSizePt, lineHeightRatio)         = computeFontSizeMm(...) * lineHeightRatio
  ├─ computeTextAreaWidthMm(paper, marginGutter, marginOuter)      = max(paper.widthMm - gutter - outer, 0)
  ├─ computeColumnHeightMm(paper, marginTop, marginBottom, columnCount, columnGapMm)
  │     = columnCount === 2 ? max((textAreaHeightMm - gapMm)/2, 0) : textAreaHeightMm
  ├─ computeAutoCharsPerLine(columnHeightMm, fontSizeMm, columnCount)   [AUTO fallback + safety-margined]
  ├─ computeMaxCapacityChars(textAreaHeightMm, fontSizeMm)             [HARD CLAMP for an explicit target — full text-area height, NOT per-column]
  ├─ computeAutoLinesPerColumn(textAreaWidthMm, linePitchMm, columnCount)  [used BOTH as auto fallback AND as the explicit-target clamp]
  └─ → charsPerLine = min(target-or-auto, maxCapacityChars); linesPerColumn = min(target-or-auto, autoLinesPerColumn)

deriveMaxCapacityFromMargins(input): { charsPerLine, linesPerColumn, maxBodyCharsPerPage }
  — "margin mode" commit path: what's the biggest capacity these margins could hold.
  Calls computeMaxCapacityChars (NOT computeAutoCharsPerLine — no safety margin) + computeAutoLinesPerColumn.

calculateCapacityFromMargins(input)   [src/utils/layoutCalculator.ts]
  — "capacity mode" live-preview / preset-switch path: a cautious estimate.
  Calls computeAutoCharsPerLine (WITH safety margin) + computeAutoLinesPerColumn.

deriveFrameMargins(input)   [src/lib/textFramePosition.ts]
  — "capacity mode" commit path: given a target chars/lines, solve backward for the 4 margins
  (via computeRequiredTextAreaHeightMm / computeRequiredTextAreaWidthMm, exact inverses of the clamp above).

inferPositionFromMargins(margins)   [src/lib/textFramePosition.ts]
  — UI-only: guesses which of 9 anchor positions the existing 4 margins represent. Never writes settings by itself.
```

**Classification:**

| Function | Classification | Why |
|---|---|---|
| `computeFontSizeMm` / `computeLinePitchMm` | GEOMETRIC NECESSITY | pt→mm conversion and line-pitch = font×ratio are physical facts, not product choices. |
| `computeTextAreaWidthMm` / `computeColumnHeightMm` | GEOMETRIC NECESSITY | Straight paper-minus-margins arithmetic. The 2-column height split (`(h - gap)/2`) is a layout policy but an unavoidable one for a stacked 2-column vertical page. |
| `computeAutoCharsPerLine` (with `PAGE_SAFETY_MARGIN_CHARS = 0.5` and, for 2-column, an *extra* `-1`) | PRODUCT POLICY + LEGACY FIXEDSLOT-ADJACENT | The 0.5-char and 2-column extra -1 are explicit anti-clipping safety margins, added after a real clipping bug (comment cites `overflow:hidden` clipping a boundary character). Not a FixedSlot "one glyph = one slot" assumption, but it *is* a hand-tuned fudge factor with no principled derivation. |
| `computeMaxCapacityChars` | PRODUCT POLICY | Deliberately **not** safety-margined, and deliberately measured against the **full** 天地 text-area height even when `columnCount === 2` (see §3.2 — this is a known, documented inconsistency with `computeAutoCharsPerLine`, not an oversight introduced by this audit). |
| `computeAutoLinesPerColumn` | GEOMETRIC NECESSITY (mostly) | `floor(width / pitch)`, floored to ≥1. No safety margin at all (asymmetric with the chars/line side, which does apply one). |
| `deriveMaxCapacityFromMargins` | PRODUCT POLICY | An explicit "no invented formula" wrapper — the code comments state it must reuse the *exact* clamp functions above so no drift is introduced between margin-mode's "what's the max" and capacity-mode's actual clamp. |
| `deriveFrameMargins` / `computeRequiredTextAreaHeightMm` / `computeRequiredTextAreaWidthMm` | GEOMETRIC NECESSITY | Exact algebraic inverses of the clamp formulas above, plus a documented `0.01mm` epsilon to survive later display rounding. |
| `PAGE_SAFETY_MARGIN_CHARS` (0.5) | PRODUCT POLICY (empirically tuned) | Not derived from font metrics; a flat constant added to prevent a specific observed clipping bug. |

No UNKNOWN classifications remained after reading the source — every function carries an explanatory comment written by a prior loop, which materially reduced ambiguity here.

---

## 3. Units / Axes / Rounding

### 3.1 Physical axis diagram (vertical writing)

```
                         小口 (outer) ←──── width ────→ ノド (gutter)
                    ┌───────────────────────────────────────────┐
                天  │   [line N] [line N-1] ... [line 2] [line1] │  ← lines stack
             (top)  │      │        │              │       │    │    right→left
                    │      │        │              │       │    │    (linesPerColumn
                    │      ▼        ▼              ▼       ▼    │     = how many
                    │  each line runs top→bottom (charsPerLine)  │     fit across
                地  │                                             │     this width)
             (bottom)└───────────────────────────────────────────┘
```

- **Main axis (charsPerLine)** — bounded by page **height** minus 天/地 (and, for 2-column, further split top/bottom by `columnGapMm`). Source: `paper.heightMm`, `marginTop`, `marginBottom`, `columnCount`, `columnGapMm`, `fontSizeMm`.
- **Cross axis (linesPerColumn)** — bounded by page **width** minus ノド/小口. Source: `paper.widthMm`, `marginGutter`, `marginOuter`, `linePitchMm`. **`columnCount` does NOT divide this axis** — 2-column vertical Japanese is a top/bottom stack, not a left/right split, so both columns share the full ノド–小口 width independently (`columnWidthMm = textAreaWidthMm`, unconditionally, in `computePageLayout`).

This means: naming is *not* symmetrical with intuition from horizontal writing. "Column count" affects the main axis (height split), not the cross axis (width), which is the opposite of what "2-column newspaper layout" suggests in English. The code comments explicitly warn about exactly this.

### 3.2 Exact rounding/clamp order

For an explicit (non-zero) `settings.charsPerLine` target, inside `computePageLayout`:

```
fontSizeMm = fontSizePt * MM_PER_PT                                  (float mm)
linePitchMm = fontSizeMm * lineHeightRatio                            (float mm)
textAreaHeightMm = max(paper.heightMm - marginTop - marginBottom, 0)  (float mm, FULL height, no column split)
columnHeightMm = (per-column height, DOES split for columnCount===2)  (float mm)
maxCapacityChars = floor(textAreaHeightMm / fontSizeMm)               ← clamp uses FULL height, not columnHeightMm
charsPerLine = min(settings.charsPerLine, maxCapacityChars)           ← no safety margin subtracted here
```

For the **auto-fallback** path (`settings.charsPerLine === 0`), a *different* formula supplies the candidate before the same `min(...)` is applied:

```
autoCharsPerLine = floor(columnHeightMm / fontSizeMm - 0.5)           ← per-column height, WITH 0.5-char safety margin
                 = (columnCount===2) ? max(floor(that) - 1, 1)         ← 2-column gets one more full char subtracted
                                     : max(floor(that), 0)
```

For lines per column (both auto and explicit-target paths use the **same** function — no divergence here):

```
linesPerColumn = min(settings.linesPerColumn OR autoLinesPerColumn, autoLinesPerColumn)
autoLinesPerColumn = max(floor(textAreaWidthMm / linePitchMm), 1)      ← no safety margin at all
```

**This is the single most important finding of Part 2:** the "maximum capacity" clamp (`maxCapacityChars`, used against an explicit user target and by `deriveMaxCapacityFromMargins`'s margin-mode "max" preview) is checked against `textAreaHeightMm` — the **full, undivided** 天地 text area — even when `columnCount === 2`. The "auto/estimate" formula (`computeAutoCharsPerLine`, used by capacity-mode preset defaults and the capacity-mode live preview) correctly uses `columnHeightMm` — the height **after** the 2-column split. These two are not reconcilable by adding an epsilon; they encode genuinely different (and, for 2-column presets, contradictory) ideas of "how tall is one line's available space." See §10 for the numeric consequence (a ~2× discrepancy for A5 2段).

Both `computeMaxCapacityChars` and `computeAutoCharsPerLine` truncate (`Math.floor`), never round or ceil. `deriveFrameMargins`'s inverse-solve adds a fixed `0.01mm` (`REQUIRED_FRAME_SIZE_EPSILON_MM`) *before* any display rounding, specifically so a later `Math.round(x*1000)/1000` (3-decimal display rounding, `roundMm`) can never eat back into the space a target needs. No other floating-point epsilon is used anywhere in the chain.

---

## 4. Margin Mode vs Capacity Mode

| | Margin mode (`layoutMode: "margin"`) | Capacity mode (`layoutMode: "capacity"`, the default) |
|---|---|---|
| User edits | marginTop/Bottom/Gutter/Outer directly (`MarginField`s) | 3×3 "版面の位置" anchor + up to 2 anchor-margin numbers, plus target charsPerLine/linesPerColumn |
| Live-typing feedback | `calculateCapacityFromMargins` (safety-margined estimate) on every keystroke via `marginCapacityPreview` | `deriveFrameMargins` (exact inverse) on every keystroke via `derivedPreview` |
| On "設定を反映" (commit) | `applyLayoutModeAdjustment` recomputes chars/lines via **`deriveMaxCapacityFromMargins`** (the un-margined "true max") from the committed margins | `deriveFrameMargins` solves the 4 margins from the committed target chars/lines + anchor position, using the same clamp `computePageLayout` will apply |
| What's stored | The literal 4 margins the user typed, **plus** `charsPerLine`/`linesPerColumn` set to `deriveMaxCapacityFromMargins`'s result (not the raw safety-margined preview number) | The **effective** (already `computePageLayout`-clamped) chars/lines actually achieved, plus the 4 margins `deriveFrameMargins` derived to fit them |
| If values conflict | N/A — margin mode has no separate "target" concept; margins always win, chars/lines always follow | If the committed target chars/lines cannot fit, `commitDraft` rejects the whole change (`ok:false` → error shown, **nothing** is written) — no silent clamp-and-save |
| Does switching modes mutate settings? | **No.** `handleLayoutModeChange` is a pure `{ ...settings, layoutMode: mode }` flip — no margin/chars recompute happens at the moment of switching. | Same — the flip is symmetric and inert. |
| Are derived values persisted? | **Yes** — `charsPerLine`/`linesPerColumn` are ordinary fields on the persisted `PageSettings`, not recomputed-only UI state. | Same — `marginTop/Bottom/Gutter/Outer` are equally ordinary persisted fields, even though capacity mode "derives" them. |
| Recomputed on load? | **No.** `db.ts`'s `withDefaults` only fills in *missing* keys (for records saved before a field existed); it never re-runs any capacity/margin formula on an existing value. | Same. |

**Practical consequence:** switching `layoutMode` on an already-saved document changes nothing about its numbers until the user actually edits something and commits in the new mode. A silently-stale `charsPerLine`/`marginTop` combination that no longer agrees with what the *current* formula would derive from the other is entirely possible and, per the render path (`computePageLayout` always re-clamps at render time using whatever is currently persisted), harmless to *this version* of the code — but is exactly the situation a *changed* formula would expose (§5).

---

## 5. Saved Document Compatibility

`DocumentRecord.settings` (IndexedDB, `src/lib/db.ts`) stores the **entire `PageSettings` object verbatim** — there is no separate "derived" vs "authored" schema split at the persistence layer. Every field below is a plain, un-versioned value on that one object:

| Value | Classification |
|---|---|
| `paperSize` (preset key) | PERSISTED RAW INPUT |
| `marginTop/Bottom/Gutter/Outer` | PERSISTED RAW INPUT (margin mode) / PERSISTED DERIVED VALUE (capacity mode, written by `deriveFrameMargins` at commit time) |
| `fontSizePt`, `lineHeightRatio`, `columnGapMm`, `columnCount` | PERSISTED RAW INPUT |
| `charsPerLine`, `linesPerColumn` | PERSISTED DERIVED VALUE (margin mode, written by `deriveMaxCapacityFromMargins` at commit time) / PERSISTED RAW INPUT-AS-TARGET (capacity mode — literally what the user typed, then clamped to the achievable value before being written back, per the `effectiveGrid` / TSP-LOOP-029-issue-C comment) |
| `layoutMode` | PERSISTED RAW INPUT (UI mode flag only) |
| Frame anchor/position (3×3 selector) | **UI-ONLY.** Never persisted; `inferPositionFromMargins` re-derives a best-guess anchor from the 4 margins every time the panel mounts or the margins change from outside the panel. |
| Web px-specific values (`widthPx`/`heightPx`) | **NOT PERSISTED at all** — these live only on the derived, in-memory `PaperSize` object `resolvePaperSize()` returns each render; `PageSettings.paperSize` stores just the preset key string (`"Web閲覧用"`), and the px↔mm conversion re-runs from the `PAPER_SIZE_TEMPLATES` constant every time. |
| Page overrides (`pageOverrides`) | PERSISTED RAW INPUT, unrelated to capacity |

There is **no `settingsVersion`, `formulaVersion`, or any equivalent field** anywhere in `PageSettings`, `DocumentRecord`, or the Dexie schema (`TategakiDatabase`, versions 1–3, which only ever added `images` and an `isCollection` index — never a settings-shape version). `withDefaults()` merges in `DEFAULT_PAGE_SETTINGS`/`DEFAULT_MASTER_PAGE_SETTINGS` purely to backfill **missing keys** (for records saved before a field was introduced, e.g. `colophon`), not to re-derive or re-validate existing values.

### Compatibility question — answer

> **If the derivation formula changes tomorrow, can an existing saved document silently repaginate even without the user touching its settings?**

**YES.**

Reason: `computePageLayout(settings)` is called fresh, from the persisted `settings` object, every time a document is opened, previewed, paginated, or exported — there is no cached/frozen "last known good" layout stored alongside the raw settings, and no version tag that could let a future formula choose to keep computing the old way for old records. Every existing document's `charsPerLine`/`linesPerColumn`/margins were authored *against* the current formula's specific arithmetic (including its specific safety-margin constants and its specific full-height-vs-per-column clamp choice for 2-column presets, §3.2). Change any constant or clamp dimension in that arithmetic, and the very next time `computePageLayout` runs against an unmodified saved document, it can produce a different `charsPerLine`/`linesPerColumn`, which cascades into different pagination (`paginateTokens`, not audited here but consuming this output) — with no user action, no warning, and no way to distinguish "this document was authored under the old rules" from "this document was authored under the new rules," because both look like an ordinary `PageSettings` object.

---

## 6. Preset Matrix

All values read directly from live `PAPER_SIZE_TEMPLATES` (`src/constants/paperSizes.ts`) — **not** from the dead `PAGE_PRESETS` (see below).

| Preset | width×height | unit | cols1: margins T/B/G/O, font, line-sp, gap | cols1 stored chars×lines | cols2: margins T/B/G/O, font, line-sp, gap | cols2 stored chars×lines | gridMode | nombre notes |
|---|---|---|---|---|---|---|---|---|
| A5 | 148×210mm | mm | 18/18/20/14, 9.0pt, 1.7, 0 | 53×22 | 16/16/18/14, 8.5pt, 1.65, 8 | 25×24 | cols1: `solid` (only preset using it) | center, 8mm, 8pt |
| B5 | 182×257mm | mm | 20/20/22/16, 9.5pt, 1.7, 0 | 45×26 | 18/18/20/15, 8.5pt, 1.65, 8 | 28×28 | (unset → `justified`) | center, 8mm, 8pt |
| B6 | 128×182mm | mm | 16/16/18/12, 9.0pt, 1.7, 0 | 40×18 | 14/14/16/12, 8.0pt, 1.65, 6 | 22×20 | (unset → `justified`) | center, 7mm, 6pt |
| 新書 | 103×182mm | mm | 15/15/16/11, 8.5pt, 1.7, 0 | 40×15 | 13/13/15/10, 7.5pt, 1.65, 6 | 22×17 | (unset → `justified`) | center, 7mm, 6pt |
| A6 | 105×148mm | mm | 14/14/15/10, 8.5pt, 1.7, 0 | 38×16 | 12/12/14/10, 7.5pt, 1.65, 6 | 20×18 | (unset → `justified`) | center, 6mm, (no nombreFontSize override) |
| 文庫 | 105×148mm | mm | 14/14/15/10, 8.5pt, 1.7, 0 | 38×16 | 12/12/14/10, 7.5pt, 1.65, 6 | 20×18 | (unset → `justified`) | center, 6mm, 5pt |
| B5/B6/新書 note | — | — | — | — | — | — | — | These three are exactly the presets `PHASE2_ARCHITECTURE_NARROWING.md` already flagged as needing capacity-formula re-confirmation before Phase 3 treats their Phase 2 preset arithmetic as production-ready — consistent with this audit's own finding that the *stored* chars/lines here do not match what the *current live formula* derives from these same margins (§10). |
| Web閲覧用 | 768×1024px | **px** (isPx) | 40/40/20/20, 36pt, 1.8, 0 | 29×12 | 40/20/20/20, 32pt, 1.75, 10 | 16×14 | (unset → `justified`) | center, 8mm, 15pt; headerFontSize 20pt |

**`gridMode`**: only A5 1段 sets `"solid"` (1em-fixed character pitch; the residual space is pushed to the bottom margin instead of being distributed as extra letter-spacing). Every other profile is unset, which defaults to `"justified"` (residual space distributed evenly across all character slots — i.e. the *opposite* of Natural Pitch/INV-004's "never stretch to fill," see §9). This is a **per-preset behavioral flag already living inside `PaperSizeColumnProfile`**, not something `computePageLayout`/`pageLayout.ts` itself reads (a grep of `gridMode` usage outside this constants file and its own type definition found no consumer in the reviewed capacity chain — it is either consumed by a renderer/pagination module not in this audit's required-reading list, or not yet wired up; either way it is a **v2-relevant data point**, since `justified`'s "distribute the remainder as extra letter-spacing" is precisely the "stretch to fill" behavior INV-004 forbids).

**Dead/unused preset data — explicitly excluded from migration authority:** `src/lib/constants/presets.ts` exports a *second*, structurally different `PAGE_PRESETS` (with `marginInner`/`marginOuter` naming, a `targetCharCount` field, and a Web preset carrying unrelated footer/branding fields). A repo-wide search found **zero import references to `PAGE_PRESETS`** anywhere else in `src/` — it is confirmed dead code, not a second live source of truth, and must not be consulted for any v2 default.

**Confirmed dead at the point of use, not just orphaned:** even `PAPER_SIZE_TEMPLATES`'s own `cols1.charsPerLine`/`cols1.linesPerColumn` (and `cols2` equivalents) are overwritten immediately after being applied — `handlePaperSizeChange`/`handleColumnCountChange` call `applyPaperTemplate` (which does copy `profile.charsPerLine`/`linesPerColumn` onto the draft settings) and then **unconditionally** call `deriveCapacityFromCurrentMargins` on the result, which recomputes chars/lines from the *margins* the template also just supplied and **discards** whatever `applyPaperTemplate` wrote. The Web閲覧用 profile's own comment already discloses this ("この2値自体は実行時には使われない"), but source-reading confirms it is true for **all eight presets**, not just Web — the table's "stored chars×lines" column is a **display/documentation convenience only**, verified stale against the live formula for every preset checked in §10.

---

## 7. Web閲覧用

- **Truly px-authored:** only the outer page `width`/`height` (768×1024). `resolvePaperSize()` is the single, sole conversion point (`pxToInternalMm`, dividing by `PX_PER_MM = 2.2`, a **preview render-scale constant, not a physical DPI**).
- **Converted to mm:** the above, once, into `PaperSize.widthMm/heightMm` (≈349.09×465.45mm). Nothing downstream (`computePageLayout`, `deriveMaxCapacityFromMargins`, `deriveFrameMargins`) treats Web differently from a print preset once this conversion has happened — they only ever see mm.
- **Values that only exist for Preview:** `widthPx`/`heightPx` on the resolved `PaperSize` (used by `ColophonPageCard`/`PageCard`/`PreviewPane`'s `data-is-px-page` branches for DOM sizing, bleed suppression, and PDF-export gating — Web閲覧用 has no PDF export). `PX_PER_MM` itself is also purely a screen/preview scale factor, reused (not re-derived) by a *second*, genuinely-physical constant (`CSS_PX_PER_MM_96DPI = 96/25.4`) whenever an actual physical size is needed (e.g. print-JPG export pixel-ratio math) — the two constants are deliberately kept distinct in the code and comments, and must not be conflated in v2.
- **Font size (`fontSizePt: 36`/`32`) is canonical pt, NOT px**, despite the preset being `isPx`. `pxToInternalFontSizePt()` exists in `pageLayout.ts` but has **zero call sites anywhere in `src/`** — it is dead code, and the explicit code comment at `pageLayout.ts:34-38` states the product intent plainly: `fontSizePt`/margins are canonical mm/pt "regardless of whether the paper is isPx," and re-converting them would double-convert and render too large. So Web's "36pt" heading font is authored exactly like a print preset's font size would be, then scaled to a final screen pixel size only by the same `PX_PER_MM` factor every other mm value on the page also goes through at DOM-render time.
- **Values that participate in capacity calculation:** all of them, once `resolvePaperSize()` has produced mm — `computePageLayout`/`deriveMaxCapacityFromMargins`/`calculateCapacityFromMargins` treat a resolved Web `PaperSize` identically to a print `PaperSize`. There is no Web-specific branch anywhere in the capacity chain itself.

**Options for v2 (not decided here):**
- **(a)** Treat Web as "physical geometry, scaled" — GeometryTick already represents it correctly once the px→mm boundary conversion happens once at the settings-resolution boundary (mirrors current production exactly).
- **(b)** Give Web its own logical-unit representation in v2 settings (Core Contract §21 explicitly flags this as the still-open Master §6.2/HD-001 question, distinct from what unit Core's *internal* geometry uses). This audit does not resolve HD-001; it only confirms that Production's *current* answer is (a) — a single boundary conversion, mm downstream of it — which is consistent with, but does not by itself require, GeometryTick's own mm-tick model.

---

## 8. Legacy FixedSlot Assumptions

| Behavior | Classification | Evidence |
|---|---|---|
| "One glyph = one character-cell of `fontSizeMm` height" as the base unit for `charsPerLine` | SAFE TO PORT — this is Natural Pitch's own premise (advance = natural per-character advance for the declared font+size), not a FixedSlot artifact. `computeFontSizeMm`/`computeLinePitchMm` compute a *nominal* pitch from declared font size, which is exactly what Core Contract §18 calls the Natural Pitch default before any `MeasurementFacts`-based refinement. | `pageLayout.ts` §2 above |
| `PAGE_SAFETY_MARGIN_CHARS` (0.5-char, +1 extra for 2-column) flat safety margin | REQUIRES DECISION — not a FixedSlot assumption per se (it exists to counter real sub-pixel/font-metric drift in the DOM renderer), but it is a **renderer-measurement compensation baked into the Core-adjacent formula layer**, which is exactly the boundary INV-009/INV-013 say must not happen (a renderer's own measurement discrepancy must never feed back into canonical layout facts). If v2 needs an equivalent safety margin, Core Contract §17's `MeasurementFacts` (versioned, supplied, not empirically fudged) is the correct home for it — not a hardcoded product constant. | `pageLayout.ts:284-292`, `computeAutoCharsPerLine` |
| `gridMode: "justified"` (residual space distributed as extra inter-character spacing to exactly fill the line) | **MUST NOT PORT.** This is precisely the "stretch to fill" behavior INV-004 and Core Contract §18 forbid outright ("no preset-specific pitch multiplier exists... if TateSpun ever wants this, it must be a distinct, explicitly-named composition mode, never a hidden per-preset coefficient"). It is currently the *default* for 7 of 8 mandatory presets (only A5 1段 uses `"solid"`). | `paperSizes.ts:9-13`, `CORE_INVARIANTS.md` INV-004, Core Contract §18 |
| `gridMode: "solid"` (1em fixed pitch, residual as bottom margin) | SAFE TO PORT — this is Natural Pitch's behavior already, shipped for exactly one preset (A5 1段, per a documented TSP-LOOP-003 fix for the same "stretch looks sparse" symptom INV-004 generalizes). | `paperSizes.ts:67-70` |
| `computeMaxCapacityChars`'s use of **full** 天地 height (ignoring the 2-column split) as the clamp for an explicit target | REQUIRES DECISION — not "FixedSlot" per se, but an internal inconsistency already present in current Production (§3.2, §10) that v2 must not silently inherit as if it were an intentional physical model. A GeometryTick-based Core would need to pick *one* height basis (per-column, matching `computeAutoCharsPerLine`) and treat the other as the bug it evidently is. | `pageLayout.ts:405-419` (own comments already flag this as a deliberate-but-narrow "don't invent a stricter clamp" choice, not a claim that the full-height basis is physically correct) |
| PX_PER_MM (2.2) preview-scale constant / raster-export pixel-ratio math | SAFE TO PORT AS A RENDERER-ONLY CONCERN — entirely downstream of Core's canonical mm/tick geometry; already isolated in the code (never used inside `computePageLayout`'s capacity math itself). | `paperSizes.ts:24-99` |
| Current DOM implementation's `overflow:hidden` clipping (the reason `PAGE_SAFETY_MARGIN_CHARS` exists at all) | MUST NOT PORT AS-IS — a v2 Preview renderer is free to reproduce the *visual* safety this buys, but the underlying cause (a renderer clipping content the Core said should fit) is a Renderer-side rendering-fidelity problem, not a Core capacity-formula problem, per INV-002/INV-009's Core/Renderer split. | inferred from comment at `pageLayout.ts:284-292`; renderer code itself out of this audit's required-reading list |

---

## 9. C1-NATURAL Compatibility

1. **Can the old capacity formula be expressed cleanly using v2 GeometryTick?** PARTIALLY. The core arithmetic (`floor(heightAvailable / pitch)`) converts to integer-tick division trivially. Two things resist a "clean" 1:1 port: (a) the `PAGE_SAFETY_MARGIN_CHARS` empirical fudge factor has no principled place in a `MeasurementFacts`-driven model (§8); (b) the full-height-vs-per-column clamp inconsistency (§3.2) is not "cleanly expressible" — it is an *error* to decide about, not a formula to preserve.
2. **Does it assume character pitch equals nominal font size?** Yes, exactly — `computeFontSizeMm(fontSizePt) = fontSizePt * MM_PER_PT` is used directly as the per-character advance with no font-metrics lookup anywhere in this chain. This happens to already match Core Contract §18's Natural Pitch default ("natural per-character advance for the declared font+size") in *spirit*, but Production's version is a flat pt→mm arithmetic conversion, not a `MeasurementProvider`-supplied, versioned, font-specific advance (Core Contract §17). They will not always produce numerically identical results once a real `MeasurementFacts` bundle is introduced (real glyph advances are not always exactly `fontSize`).
3. **Does it depend on actual MeasurementFacts?** No — Production has no `MeasurementFacts` concept; it is 100% nominal-font-size arithmetic today.
4. **Would exact porting conflict with Natural Pitch?** For `gridMode: "solid"` and the base clamp math, no. For `gridMode: "justified"` (7 of 8 presets' current default), **yes, directly** — it is the exact stretch-to-fill behavior INV-004 exists to prohibit.
5. **Can current preset defaults remain identical while using a better internal derivation?** Likely yes for the *numbers users currently see rendered* (chars×lines), since those numbers were themselves derived from margins/font/line-height via the *auto* (safety-margined) formula, not hand-picked independently (§10 confirms this for every preset checked) — but only if the new derivation deliberately reproduces the *auto* formula's specific safety-margin and per-column-height choices, not the inconsistent "max" formula's. This is exactly why Part 11's Option A ("exact compatibility port") is evaluated as **VIABLE for preserving current visual output**, but only by porting the messy safety-margin constant too, which sits uneasily with a clean GeometryTick/MeasurementFacts model — the tension driving the Option B recommendation.

**Legacy FixedSlot assumptions found:** Partially — see §8. The most serious is `gridMode: "justified"`'s letter-spacing stretch, not a "one glyph = one grid cell" positional assumption (Production does not appear to use fixed per-glyph slot positions in the geometry-derivation layer itself; that would need to be confirmed against `tategaki.ts`/renderer code, out of this audit's required-reading list).

**Natural Pitch conflict:** **CONDITIONAL** — `"solid"` mode and the base clamp arithmetic: no conflict. `"justified"` mode (the current default for 7/8 presets): direct conflict with INV-004, if and when v2 renders using that field at all (this audit found `gridMode` defined and preset-populated but did not find a Production consumer within the required-reading scope — it may be inert dead data today, in which case there is no *live* Production behavior yet contradicting INV-004, only a **latent** one).

---

## 10. Parity Examples

All computed by hand, directly executing the *actual* formulas in §2 (no new algorithm invented). "Capacity-mode auto" = what a fresh preset switch or the capacity-mode live preview shows (`computeAutoCharsPerLine`/`computeAutoLinesPerColumn`, safety-margined). "Margin-mode max" = what `deriveMaxCapacityFromMargins` returns (`computeMaxCapacityChars`, not safety-margined for chars).

### 文庫 1段 (defaults: 14/14/15/10mm, 8.5pt, ×1.7, gap 0)
- fontSizeMm = 8.5 × 25.4/72 = **2.9986mm**; linePitchMm = **5.0976mm**
- textAreaHeightMm (=columnHeightMm, 1段) = 148 − 14 − 14 = **120mm**; textAreaWidthMm = 105 − 15 − 10 = **80mm**
- Capacity-mode auto: charsPerLine = floor(120/2.9986 − 0.5) = floor(39.52) = **39**; linesPerColumn = floor(80/5.0976) = **15**
- Margin-mode max: charsPerLine = floor(120/2.9986) = **40**; linesPerColumn = **15**
- `PAPER_SIZE_TEMPLATES` stored value: **38×16**
- **PASS/FAIL:** Three different numbers for the identical physical geometry (38×16 stored, 39×15 capacity-auto, 40×15 margin-max). `DEFAULT_PAGE_SETTINGS` (39×15) matches **capacity-mode auto exactly** — confirming `DEFAULT_PAGE_SETTINGS` was hand-synced to the live auto-formula (per its own TSP-LOOP-029 comment), while the *template's own* `cols1.charsPerLine/linesPerColumn` (38×16) were never updated to match and are stale. Marked **FAIL** in the sense of "does the documented preset number match the live formula" — not a bug, but a real, evidenced discrepancy migration must account for.

### A5 1段 (18/18/20/14mm, 9.0pt, ×1.7, gap 0)
- fontSizeMm = **3.175mm**; linePitchMm = **5.3975mm**
- textAreaHeightMm = 210 − 36 = **174mm**; textAreaWidthMm = 148 − 34 = **114mm**
- Capacity-mode auto: charsPerLine = floor(174/3.175 − 0.5) = floor(54.30) = **54**; linesPerColumn = floor(114/5.3975) = **21**
- Margin-mode max: charsPerLine = floor(54.80) = **54**; linesPerColumn = **21**
- `PAPER_SIZE_TEMPLATES` stored value: **53×22**
- **PASS/FAIL: FAIL** (stored value disagrees with both live formulas, which agree with each other here). Loop brief's own example ("A5 1段 = 53×22") matches the **stale stored template value**, not the current live derivation (54×21) — confirming the brief's example is PRESET DEFAULT VALUE evidence (concept A), not derivation output (concept C), exactly the distinction the brief warned not to conflate.

### A5 2段 (16/16/18/14mm, 8.5pt, ×1.65, gap 8) — the important one
- fontSizeMm = **2.9986mm**; linePitchMm = **4.9477mm**
- textAreaHeightMm (full) = 210 − 32 = **178mm**; columnHeightMm (per-column, 2段) = (178 − 8)/2 = **85mm**; textAreaWidthMm = 148 − 32 = **116mm**
- Capacity-mode auto: charsPerLine = floor(85/2.9986 − 0.5) = floor(27.85) = 27, then 2-column extra −1 = **26**; linesPerColumn = floor(116/4.9477) = **23**
- Margin-mode max: charsPerLine = **floor(178/2.9986) = 59** (!) — computed against the *full*, undivided height, not the 85mm per-column height; linesPerColumn = **23**
- `PAPER_SIZE_TEMPLATES` stored value: **25×24**
- **PASS/FAIL: FAIL, and structurally significant.** Margin-mode's "max capacity" (59 chars/line) is roughly **2.2× physically impossible** for an actual 85mm-tall column — it silently ignores the 2-column split (§3.2). This is not a rounding nit; it means today, if a user is in margin mode on a 2-column preset and commits any margin/font change, the app can write a `charsPerLine` into their saved settings that is more than double what will actually render (since `computePageLayout` itself, at render time, correctly re-clamps using the per-column-aware auto path... **except it doesn't** — re-reading §2: `computePageLayout`'s own explicit-target clamp *also* uses `computeMaxCapacityChars` against full `textAreaHeightMm`, the same as `deriveMaxCapacityFromMargins`. So a margin-mode-committed 59-chars-per-line target would render as 59, not silently reduced to what an 85mm column can hold — a real, live, currently-shippable visual overflow risk for A5/B5/B6/新書 2段 in margin mode, independent of v2.** This is exactly the discrepancy `PHASE2_ARCHITECTURE_NARROWING.md` flagged for B5/B6/新書 without fully explaining its mechanism; this audit supplies that mechanism.

### Modified margins (文庫 1段, margins widened to 20/20/15/10mm, font/line-height unchanged)
- textAreaHeightMm = 148 − 40 = **108mm**; textAreaWidthMm unchanged = 80mm
- Capacity-mode auto: charsPerLine = floor(108/2.9986 − 0.5) = **35**; linesPerColumn unchanged = **15**
- **PASS** — monotonic, no anomaly; margin sensitivity behaves exactly as expected.

### Modified font size (文庫 1段, fontSizePt raised 8.5→10pt, margins/line-height unchanged)
- fontSizeMm = **3.5278mm**; linePitchMm = **5.9972mm**
- Capacity-mode auto: charsPerLine = floor(120/3.5278 − 0.5) = **33**; linesPerColumn = floor(80/5.9972) = **13**
- **PASS** — monotonic, no anomaly.

### Web閲覧用 1段 (768×1024px preset; resolved 349.09×465.45mm; 40/40/20/20mm, 36pt, ×1.8, gap 0)
- fontSizeMm = **12.7mm**; linePitchMm = **22.86mm**
- textAreaHeightMm = 465.4545 − 80 = **385.4545mm**; textAreaWidthMm = 349.0909 − 40 = **309.0909mm**
- Capacity-mode auto: charsPerLine = floor(385.4545/12.7 − 0.5) = floor(29.85) = **29**; linesPerColumn = floor(309.0909/22.86) = **13**
- Margin-mode max: charsPerLine = floor(30.35) = **30**; linesPerColumn = **13**
- `PAPER_SIZE_TEMPLATES` stored value: **29×12**
- **PASS/PARTIAL** — charsPerLine (29) matches capacity-auto exactly; linesPerColumn is off by one (stored 12 vs. live 13) — same "stale stored template" pattern as every print preset, confirming Web is not a special case for this particular finding, only for unit handling (§7).

**Summary:** every preset checked shows the same pattern — `PAPER_SIZE_TEMPLATES`'s stored chars×lines is stale relative to the live capacity-mode-auto formula (by 1-2 in most fields), while `DEFAULT_PAGE_SETTINGS` (which only exists for 文庫) does match the live formula exactly. The A5-2段-class discrepancy (margin-mode max ignoring the 2-column split) is categorically different — a live, currently-shippable formula inconsistency, not a stale-constant issue.

---

## 11. Migration Options

### Option A — Exact Compatibility Port
Port `computeAutoCharsPerLine`/`computeMaxCapacityChars`/`computeAutoLinesPerColumn` semantics into v2 Core verbatim (GeometryTick-integer rewrite, same constants, same clamp-dimension choices — including the full-height-vs-per-column inconsistency, unless Product decides to fix it as part of this port).
- **Pros:** Existing saved documents keep rendering identically (modulo the float→integer-tick rounding boundary, which is a solvable, bounded engineering problem). One formula, one code path, forever. Simplest mental model for support/debugging.
- **Cons:** Bakes `PAGE_SAFETY_MARGIN_CHARS` (an empirical DOM-clipping fudge factor with no font-metrics basis) into the Core as if it were a physical fact — sits awkwardly next to `MeasurementFacts`/INV-009's explicit "renderer measurement never becomes Core authority" rule. Also bakes in the 2-column full-height clamp bug (§10) as permanent Core behavior unless explicitly special-cased out, which would then make it *not* an exact port.
- **Compatibility:** STRONG (by construction). **Natural Pitch impact:** MIXED — the underlying nominal-pitch arithmetic is compatible; the safety-margin constant is not principled under Natural Pitch's own model. **Technical debt:** the 2-column clamp bug becomes permanently load-bearing instead of being an acknowledged, fixable quirk. **Future flexibility:** WEAK — any future formula improvement becomes a compatibility break by definition, the same problem P3-O12 exists to solve today, just deferred.

### Option B — Versioned Compatibility Layer
Existing documents keep a frozen "legacy" derivation (Option A's exact port, tagged e.g. `capacityFormulaVersion: 1`); new documents (or documents that explicitly opt in) use a new v2-native, `MeasurementFacts`-driven derivation (`capacityFormulaVersion: 2`+).
- **Pros:** Existing documents are provably unaffected forever (the legacy formula is frozen, never edited again). v2 Core is free to fix the 2-column clamp bug, drop the empirical safety-margin fudge in favor of real `MeasurementFacts`, and forbid `justified` stretch outright — all without touching a single existing document.
- **Cons:** Two formulas to maintain and test indefinitely. Requires a real version field to exist on `PageSettings`/`DocumentRecord` (currently absent — a genuine schema addition, not free). UI complexity: a user comparing two documents with "identical-looking" settings could see different capacities if one is legacy-versioned and one is not — must be surfaced, not hidden. Migration trigger question must be answered explicitly (see §13) — most defensible default is "never, automatically" (only on explicit user action, e.g. "re-derive from margins" in margin mode, which already exists as a deliberate user action today).
- **Compatibility:** STRONG. **Natural Pitch impact:** STRONG (new documents get the clean model; old documents are unaffected either way). **Technical debt:** MIXED (two code paths, but each is simple and the legacy one is frozen/inert, not actively maintained). **Future flexibility:** STRONG.

### Option C — v2-Native Formula Only
Replace the derivation for all documents, old and new alike; existing documents migrate/reflow on first v2 open.
- **Pros:** Simplest implementation — one formula, ever. Fixes the 2-column bug and drops the fudge factor for everyone immediately.
- **Cons:** Directly triggers the YES answer in §5 — every saved document's pagination, page count, and possibly text-fitting-on-a-page can shift the moment its owner opens it in v2, with no warning and no way to opt out. For a **currently public service** (per this loop's checkpoint context) with real authors' real manuscripts already saved, this is a trust-damaging, support-load-generating change, not merely an engineering inconvenience — page counts shifting can invalidate an author's already-finalized print-ready PDF page numbering, colophon references, or print-run planning.
- **Compatibility:** WEAK. **User surprise:** the loop brief's own criteria name this directly — HIGH. **Implementation simplicity:** STRONG, but simplicity that pushes real cost onto users, not engineers.

### Option D — Hybrid (proposed; evidence-supported, not merely offered for symmetry)
Preserve each existing saved document's **already-persisted, effective** `charsPerLine`/`linesPerColumn`/margins exactly as-is (they are already, per §5, ordinary persisted numbers `computePageLayout` consumes directly — no recomputation is required to keep using them). Use the new v2-native derivation **only** when a document is opened in v2 for the first time **and has no `capacityFormulaVersion` tag yet AND the user takes an explicit "recalculate from physical settings" action** — which, notably, **already exists as a real, shipped user gesture today**: margin-mode's "設定を反映" commit, and capacity-mode's own commit, both already explicitly *re-derive* capacity from current inputs on demand. Option D is really Option B's data model plus a stronger default (legacy values simply keep being consumed forever, with zero new "migration" step required — v2-native derivation is opt-in via an action the product already has, not a new one to design).
- **Why the current data model makes this viable, specifically:** §5 already established that `PageSettings` stores `charsPerLine`/`linesPerColumn`/margins as ordinary, self-sufficient numbers with no dependency on *how* they were derived — `computePageLayout` never asks "was this margin authored or derived." That means "do nothing to old documents" is not a migration step to design — it is simply *not changing the read path* for a document lacking a version tag. Only new documents (or an explicit recalculate action) need to touch the new formula at all.
- **Evaluated as VIABLE**, effectively a stricter, lower-effort variant of Option B rather than a fourth distinct axis.

---

## 12. Decision Matrix

| Criterion | A — Exact Port | B — Versioned Layer | C — v2-Native Only | D — Hybrid |
|---|---|---|---|---|
| Existing-document stability | STRONG | STRONG | WEAK | STRONG |
| Publication Quality | MIXED (inherits 2-col clamp bug) | STRONG (new docs) / MIXED (legacy docs, unchanged from today) | STRONG (once migrated) | STRONG (new docs) / MIXED (legacy docs, unchanged from today) |
| C1-NATURAL consistency | MIXED | STRONG (new docs) | STRONG | STRONG (new docs) |
| Determinism | STRONG | STRONG | STRONG | STRONG |
| Implementation complexity | GOOD (one path) | MIXED (two paths + version field) | STRONG (one path, but a migration routine still needed) | GOOD (two paths, no migration routine needed) |
| Long-term maintainability | WEAK (bug is now permanent) | MIXED (two paths forever) | STRONG (eventually) | MIXED (two paths forever, but legacy path is frozen/inert) |
| 8-preset compatibility | STRONG | STRONG | STRONG (post-migration) | STRONG |
| Web compatibility | STRONG (Web has no special-case in the capacity chain itself, §7) | STRONG | STRONG | STRONG |
| User comprehension | STRONG (one number, always) | MIXED (two documents can legitimately show different capacities for "the same" settings — must be surfaced) | STRONG (eventually) / WEAK (at the moment of migration) | MIXED (same as B) |
| Rollback safety | GOOD | STRONG (legacy path never touched) | WEAK (reflow is not generally reversible) | STRONG |

No numeric scoring is fabricated — these are qualitative judgments against the evidence in §2-§10 only.

---

## 13. Recommended Direction

**Recommend Option B (Versioned Compatibility Layer), implemented in its Option-D-shaped low-effort form: freeze the current formula as legacy and simply keep consuming already-persisted values for old documents; require no active migration step.**

Rationale, directly from evidence above: §5 already proves old documents don't need their formula *re-run* to keep working — they need the formula to **never be changed out from under them**. That is cheaper than it sounds: it does not require building a parallel "legacy calculator" that gets exercised — it only requires **not applying the new v2-native derivation to a document that doesn't ask for it**, and tagging new/opted-in documents so v2 knows which formula last touched them.

- **What should become the authoritative rule for NEW documents?** A v2-native, GeometryTick-integer derivation that: (a) fixes the full-height-vs-per-column clamp inconsistency found in §10 (2-column presets must clamp against per-column height, always); (b) sources its safety margin, if any is still needed for a real renderer, from a versioned `MeasurementFacts`-supplied value rather than the flat `PAGE_SAFETY_MARGIN_CHARS` constant, per INV-009/INV-013; (c) never applies `justified`-style stretch-to-fill (INV-004) — `gridMode` as currently modeled must not be ported as a default-on behavior for 7/8 presets.
- **What happens to EXISTING saved documents?** Nothing, by default. Their persisted `charsPerLine`/`linesPerColumn`/margins keep being read and rendered exactly as `computePageLayout` reads them today (including, if unaddressed, the 2-column clamp quirk **for that specific document's already-saved values** — freezing the formula freezes its quirks too, which is the point).
- **When, if ever, does an existing document migrate?** Only on an explicit user action — most naturally, reusing the "設定を反映" recalculate gesture that already exists in both layout modes today, extended to also stamp the new `capacityFormulaVersion`. Never automatically, never silently, never merely by opening the document in v2.
- **What values must be versioned?** A single new field is sufficient: `capacityFormulaVersion` (or equivalent) on `PageSettings`/`DocumentRecord`. It does not need to version each individual constant — only which *formula family* (legacy vs. v2-native) authored the currently-persisted `charsPerLine`/`linesPerColumn`/margins.
- **What does v2 Core own?** The v2-native derivation itself (geometry→capacity, GeometryTick-integer, `MeasurementFacts`-driven where a safety margin is genuinely needed) — this is squarely Core Contract §19's "Capacity model," already scoped to exactly this question and already carrying P3-O12 forward as its own explicit open item.
- **What remains Editor/Settings responsibility?** The legacy formula (frozen, verbatim, never touched again — effectively "Editor-side legacy support code," not Core), the `capacityFormulaVersion` read/write, the UI surfacing of "this document uses the legacy sizing rule" if that ever becomes user-relevant, and the recalculate action that lets a user explicitly opt a document into the new formula.

---

## 14. Human Decisions Required

1. Approve or reject Option B/D as the migration direction (vs. A or C).
2. Decide whether the 2-column full-height clamp bug (§10, A5/B5/B6/新書 2段) should be silently inherited by the legacy formula (as-is, for byte-for-byte compatibility) or explicitly patched even in the legacy path (a narrow, disclosed exception to "freeze it exactly as it is").
3. Decide whether `gridMode: "justified"`'s stretch-to-fill behavior (currently the default for 7/8 presets in the data, whether or not it is yet wired to a live renderer) should be actively disabled/renamed before v2 ships anything, independent of the capacity-formula question, since it directly contradicts frozen INV-004.
4. Decide the exact recalculate-action UX for opting an existing document into the new v2-native formula (reuse "設定を反映," or a new, explicitly-labeled action — Product's call, not decided here).
5. Confirm `capacityFormulaVersion` (or chosen name) as the single new persisted field, and who owns writing it (Editor settings-commit code, presumably, mirroring how `layoutMode`/`charsPerLine` are already written today).

---

## 15. Implementation Boundary After Approval

Not authorized by this document. Once Human Decisions (§14) are made, a **future, separate** P3 loop may: define the v2-native capacity module inside `typesetting-v2/core/`, define the `capacityFormulaVersion` schema addition (Editor-side `PageSettings`/`DocumentRecord` change, not a Core Contract change), and wire the recalculate action. None of that is done here. No `src/` file was modified. No `typesetting-v2/core/` module was created. No `PageSettings`/`DocumentRecord` schema field was added.

---

## 16. P3-O12-B Addendum — Existing-Document Compatibility Decision Hardening

Added in a follow-up, time-boxed pass over the same evidence, to resolve one specific ambiguity in §4/§5 before Human approval. **Nothing in §1-§15 above was changed or retracted.** This section only sharpens the mechanism and, in §16.8, resolves Human Decision #2 (§14) rather than leaving it open.

### 16.1 The exact runtime path for an existing document (traced, not inferred)

```
DocumentRecord.settings (IndexedDB, raw)
  → db.ts withDefaults()            — backfills MISSING keys only (masterPage/pageOverrides/colophon); never touches
                                       an existing charsPerLine/linesPerColumn/margin value
  → loadDocument(id)                — src/lib/db.ts:129
  → TategakiEditor.tsx:310           setSettings(doc.settings ?? DEFAULT_PAGE_SETTINGS)   — verbatim, no transform
       (the `settings` state itself is declared at TategakiEditor.tsx:82 via
        `useEditorSettings({ persist: !isEphemeralRoute })` — that hook's own effects only (a) seed brand-NEW
        documents from localStorage's last-used settings before any doc has loaded, and (b) mirror every
        `setSettings` call back to localStorage; neither effect intercepts or alters a `setSettings(doc.settings)`
        call made directly by the document-load effect. So the hook is inert for an existing document's own
        persisted values — it never substitutes, versions, or re-derives them.)
  → TategakiEditor.tsx:213           const layout = useMemo(() => computePageLayout(settings), [settings])
                                       — recomputed the instant `settings` state changes, i.e. immediately on load
  → computePageLayout() (pageLayout.ts:450) — reads settings.charsPerLine/linesPerColumn/margins/font/columnCount.
       Notably: computePageLayout NEVER reads settings.layoutMode. The clamp logic below is identical
       regardless of which mode the document was authored in.
  → effective charsPerLine = Math.min(settings.charsPerLine > 0 ? settings.charsPerLine : autoCharsPerLine,
                                        computeMaxCapacityChars(textAreaHeightMm, fontSizeMm))
  → effective linesPerColumn = Math.min(settings.linesPerColumn > 0 ? settings.linesPerColumn : autoLinesPerColumn,
                                          computeAutoLinesPerColumn(textAreaWidthMm, linePitchMm, columnCount))
```

**Margin mode and capacity mode reach this identically** — `computePageLayout` has no mode branch at all. The mode only ever governed which *UI commit path* (`applyLayoutModeAdjustment`+`deriveMaxCapacityFromMargins` for margin mode; `deriveFrameMargins` for capacity mode, both in `PageSettingsPanel.tsx`) most recently *wrote* `settings.charsPerLine`/margins — not how those values are read back at render time.

### 16.2 Question 2, answered exactly

Persisted `charsPerLine`/`linesPerColumn` are used as **B — a target that is re-clamped/re-derived**, unconditionally, every time `computePageLayout` runs, in **both** modes identically. Not A (never trusted outright), not C (never ignored), not D (no mode-dependent branch exists in the read path — §16.1's trace shows `computePageLayout` doesn't inspect `layoutMode`). The only mode-dependent step in the entire pipeline is which *panel commit function* last wrote the value — a write-time distinction, not a read-time one.

### 16.3 Reconciling §4/§5's two claims (the ambiguity this addendum was asked to resolve)

"Derived capacity persisted: YES" and "recomputed on load: NO" are **both correct** and **not in tension**, once "recompute" is split into two distinct operations that §4/§5 used the same word for:

- **Persisted-value mutation** ("recomputed on load" in the original sense: does loading a document *rewrite* the stored `charsPerLine`/`linesPerColumn`/margins in IndexedDB?) — **NO.** `loadDocument`/`withDefaults` never call any capacity function; they only backfill structurally-missing keys.
- **Effective-value derivation** (does the number actually used for pagination/rendering get recalculated from the stored inputs?) — **YES, always, on every single `computePageLayout` call**, including the one that fires immediately after load (§16.1). There is no cache of "the effective value as of when this was last saved" — only the raw target number is stored, and it is re-clamped fresh by whatever formula the *currently running build* implements.

### 16.4 Question 3, answered exactly

**YES, application code alone can change final pagination for an unmodified document, in both modes identically**, via one exact operation: the `Math.min(target, computeMaxCapacityChars(...))` clamp (and its `computeAutoLinesPerColumn` sibling for lines) inside `computePageLayout`. Concretely: take any existing document where `settings.charsPerLine` already equals today's effective, clamped value (true for anything saved through the existing commit UI, per the `effectiveGrid`/TSP-LOOP-029 comment in `PageSettingsPanel.tsx`). Today, `Math.min(charsPerLine, computeMaxCapacityChars(...))` is a no-op because the stored value already equals the max. **Change only `computeMaxCapacityChars`'s implementation** (e.g. fix the 2-column full-height bug from §10, or drop/alter `PAGE_SAFETY_MARGIN_CHARS`) — with zero change to any stored field — and the *same* `Math.min` call now clamps the *same* stored `charsPerLine` down (or, in principle, could allow it up if a new formula is more generous) to a different number, because `computeMaxCapacityChars` is a pure function of the *shipped code*, not of anything persisted. This reproduces for `linesPerColumn` symmetrically via `computeAutoLinesPerColumn`. Mode-identical: since `computePageLayout` never reads `layoutMode` (§16.1), this mechanism fires the same way whether the document was last edited in margin or capacity mode.

### 16.5 Question 4 — is the proposed legacy-freeze policy sufficient?

**PASS, with one necessary clarification the literal wording glosses over.** "Use the persisted effective charsPerLine/linesPerColumn as authoritative, don't recalculate from margins" is sufficient to preserve existing pagination **only if "authoritative" is implemented as "keep running the exact frozen legacy clamp formula against this document's stored margins/font/target,"** not as "bypass the clamp entirely and trust the stored number no-matter-what." §16.4 shows the *current* design's whole safety property (a target can never silently render larger than the physical page allows) depends on that clamp continuing to run — decoupling the persisted number from the margins it was clamped against would be a **new, unrelated behavior change** (removing a live geometry-consistency check), not a compatibility freeze. Because every existing document's stored `charsPerLine`/margins were written together, atomically, by the same commit (`PageSettingsPanel.tsx`'s `commitDraft`, §4), and nothing in the current product lets a user edit margins without also going through that same atomic commit, **both interpretations produce byte-identical results for every document reachable through the existing UI** — so the distinction is inert today, but must be specified precisely (as "freeze the *formula*, keyed by version, not just skip the *clamp*") so a future engineer doesn't mistake "authoritative" for "unclamped."

### 16.6 Question 5 — does "設定を反映" cleanly map to "opt into v2"?

**Not cleanly, as literally worded — flagged HUMAN DECISION REQUIRED, per the loop's own escape hatch.** Reason: `computePageLayout` today is a single, non-version-aware function; there is exactly one clamp formula live at any moment, selected by which code is deployed, never by a per-document flag. "設定を反映"'s existing behavior is: validate draft → build candidate settings → call `computePageLayout(candidate)` (whichever formula is currently shipped) → write back the effective result (§4). For this gesture to mean "opt this specific document into the v2-native formula while OTHER open documents keep using the legacy one," `computePageLayout` (or a wrapper around it) must become version-aware — dispatching to a frozen legacy implementation or the new v2-native one **based on that document's own `capacityFormulaVersion`**, not on a single global code path. That dispatch mechanism does not exist today and was not designed by the original P3-O12 audit's Option B description either (which named the version field but not where the branch lives). This is a genuine, undecided implementation-shape question, not merely a UX-labeling one — **added to §14 as Human Decision #6, below.**

### 16.7 Versioning minimum

- Old documents do **not** need a version field written immediately — a missing field can safely mean `legacy-frozen`, exactly as `PageSettings`/`DocumentRecord` already treat every other historically-added field (`colophon`, `pageOverrides`, etc. — §5's `withDefaults` pattern already establishes "absent key ⇒ default/legacy behavior" as this codebase's existing, working convention). This avoids any bulk migration pass entirely.
- **Ordinary re-save must not stamp a version.** `saveDocument()` (`db.ts:150`) writes exactly the `settings` object it is given; a plain content edit's autosave passes through the *same, untouched* `settings` state (§16.1 — nothing in the content-typing path calls any Settings-panel commit function). So as long as the version stamp is written **only** inside the geometry-commit code path (§16.6's dispatch point) and nowhere else, "an old document is cloud-saved again without touching layout settings" provably cannot migrate it — the write path that would need to add the tag is never invoked by an ordinary save. This must be an explicit implementation rule for whichever future loop builds §16.6's dispatch, not merely an assumption.

### 16.8 The eight-point policy — coherence check

All eight points are **technically coherent** together, given the evidence in §1-§16.7. Two are conceptual restatements of what's already established (1, 2); two need one implementation-shape decision each before they're buildable (3, 6 — both trace back to §16.6's missing dispatch mechanism); one needs an explicit numeric decision (4); and one **resolves, rather than merely restates, an open item from the original audit**:

- **Point 8 ("fix the legacy 2-column max-capacity bug in v2 rather than preserving it") resolves Human Decision #2 (§14) directly.** Under this 8-point policy, the frozen legacy path is *never edited again* (point 1/2), so it silently keeps its existing 2-column clamp bug for any document still on it — the bug is inherited by definition of "frozen," exactly as §14 Decision #2's first option describes — while the v2-native path (points 3/5) is free to fix it cleanly, since it's a different code path serving only documents that have explicitly opted in. This is fully coherent and is now the **recommended answer** to Decision #2 (fix in v2-native only; do not patch the legacy path).
- **Point 4 ("new documents start from established preset default capacities")** is coherent **only if** "established preset default" is read as *the numbers the current live formula actually produces for that preset's margins today* (verified in §10 — e.g. 文庫 1段 = 39×15, matching `DEFAULT_PAGE_SETTINGS`) — **not** the stale, unused numbers literally stored in `PAPER_SIZE_TEMPLATES` (e.g. 文庫's stored 38×16, confirmed dead in §6/§10). A new document should not be seeded from data already proven, in this same audit, to disagree with what the app actually renders.
- **Points 3/5/6 (explicit-recalculation opt-in, version stamped at that point)** are coherent in *direction* but require §16.6's dispatch mechanism to actually exist before they're implementable — flagged, not resolved, here.
- **Point 7 (never port `justified` stretch-to-fill into v2 Core)** is unconditionally coherent and simply restates §8/§9/§13's existing finding (INV-004 conflict).

### 16.9 Updated Human Decisions (supersedes/extends §14; §14's original 5 items are not deleted)

6. **(New.)** Decide where the legacy-vs-v2-native dispatch lives: inside a version-aware `computePageLayout` itself (Core-adjacent, reads a document-level flag before choosing a formula), or in a thin Editor-side wrapper that calls one of two otherwise-untouched formula modules (keeps `computePageLayout`/Core single-formula and pushes the version branch to Editor/Settings code, consistent with §13's "what remains Editor/Settings responsibility"). This is the one piece of engineering shape neither the original audit nor this addendum decided, and every one of points 3/5/6 (§16.8) depends on it.
7. **(New, but effectively already answered by §16.8's point 8.)** Confirm: the 2-column full-height clamp bug (§10, originally Decision #2) is fixed **only** in the v2-native formula and is preserved as-is, unfixed, in the frozen legacy path serving existing documents — Human sign-off requested on this specific resolution, not a re-opening of the question.

### 16.10 Result (P3-O12-B)

**EXISTING DOCUMENT PATH**
margin mode persisted capacity role: B (re-clamped target) — mode-invariant read path
capacity mode persisted capacity role: B (re-clamped target) — mode-invariant read path
effective capacity re-derived during rendering: YES (every `computePageLayout` call, unconditionally)
code-only formula change can repaginate unchanged document: YES — BY the same mechanism in both modes (§16.4)

**LEGACY FREEZE POLICY**
persisted effective capacity can be authoritative: YES — provided "authoritative" means "clamped by the frozen legacy formula," not "unclamped" (§16.5)
missing version can safely mean legacy-frozen: YES (§16.7, matches existing `withDefaults` convention)
open causes migration: NO (confirmed — §16.1, `loadDocument`/`withDefaults` never write derived values)
ordinary save causes migration: NO (confirmed — §16.7, `saveDocument` writes only what it's given; the version stamp, once designed per Decision #6, must live solely in the geometry-commit path)
explicit recalculation migration: VIABLE — direction confirmed, exact dispatch mechanism NOT yet designed (Decision #6)

**NEW DOCUMENTS**
recommended starting capacity: the live-legacy-formula-consistent numbers already verified per preset in §10 (e.g. 文庫 39×15) — NOT the stale `PAPER_SIZE_TEMPLATES` literals
preset defaults preserved: YES (in the "live-formula-consistent" sense above, not the stale-literal sense)
v2 formula active on creation: AFTER FIRST GEOMETRY CHANGE (point 5, §16.8)

**V2 FORMULA**
legacy justified stretch copied: MUST BE NO (unchanged from §9/§13)
legacy 2-column clamp bug copied: MUST BE NO — resolved: fix only in v2-native, preserve as-is in frozen legacy (§16.8/§16.9 item 7)
MeasurementFacts-compatible: YES (v2-native path only; legacy path remains a flat pt→mm constant by design, frozen)
GeometryTick-compatible: YES (v2-native path; legacy path can be represented in ticks for storage/determinism purposes without adopting its clamp semantics)

**RECOMMENDATION**
final policy: the 8-point policy as tested in §16.8, adopted as the concrete shape of §13's Option B/D recommendation — not a replacement for it.
existing docs: frozen legacy formula, keyed by absence of `capacityFormulaVersion`; never rewritten by open or ordinary save.
new docs: seeded from live-legacy-formula-consistent preset numbers; switch to v2-native only after the user's first geometry edit.
migration trigger: explicit geometry-commit action only, once §16.9 Decision #6 (dispatch location) is made.
minimum versioning concept: single optional field, e.g. `capacityFormulaVersion?: "v2-1"` (absent = legacy-frozen), written only by the geometry-commit path.

**SAFETY**
src changed: NO
Core changed: NO
Production changed: NO
HEAD: 8fd24d5
commit: NONE

**DECISION**
P3-O12: DECISION READY
HUMAN APPROVAL READY: YES (7 items total: §14's original 5 + §16.9's 2 new/sharpened ones)
IMPLEMENTATION AUTHORIZED: NO

STOP.

---

## 17. P3-O12-C Addendum — Implementation Evidence (Human-Approved, Isolated, Pre-Integration)

Following Human Product Decision: APPROVED (top of document), the pure capacity-policy module described by §13/§16.8's approved 8-point policy was implemented, isolated from `src/` and from any Editor wiring, under `typesetting-v2/core/settings/`:

| File | Role |
|---|---|
| `capacityFormulaVersion.ts` | `CapacityFormulaVersion` type, `resolveCapacityFormulaVersion()` (missing/unrecognized ⇒ `"legacy-frozen"`), `canMigrateCapacityFormula(event)` (true only for `"explicitGeometryCommit"`) |
| `capacityLegacyFrozen.ts` | Verbatim mm-float port of `src/lib/pageLayout.ts`'s clamp chain — including the `PAGE_SAFETY_MARGIN_CHARS` fudge and the full-height 2-column clamp inconsistency (§3.2/§10), deliberately preserved, never to be edited to "fix" it |
| `capacityV2Native.ts` | Corrected, GeometryTick-integer, `MeasurementFacts`-driven formula — per-column height always used for the main-axis clamp (§10's bug fixed here only), no safety-margin fudge, no stretch-to-fill, residual space reported on both axes (INV-004) |
| `capacityPolicy.ts` | `deriveCapacityForEvent()` dispatch (resolves version → runs exactly one formula → reports which) and `initializeNewDocumentCapacity()` (new documents start legacy-frozen, seeded from the live legacy formula's own preset output — never `PAPER_SIZE_TEMPLATES`'s stale literals) |
| `capacityFixtures.ts` | Test-fixture-only literal transcription of all 8 mandatory presets' `cols1`/`cols2` geometry from `src/constants/paperSizes.ts` (not imported — Core has zero `src/` dependency) |
| `capacityFormulaVersion.test.ts`, `capacityLegacyFrozen.test.ts`, `capacityV2Native.test.ts`, `capacityPolicy.test.ts` | 91 new tests, all passing — see results below |

**Parity protection (legacy path):** every hand-verified number from §10 above is asserted verbatim in `capacityLegacyFrozen.test.ts` — 文庫 1段 (39×15 auto / 40×15 explicit-max), A5 1段 (54×21), A5 2段 (26×23 auto / **59×23 explicit-max, the documented bug, deliberately protected, not fixed**), modified-margin and modified-font cases, Web閲覧用 (29×13 / 30×13). All passed on first implementation with no numeric adjustment needed.

**Bug-fix protection (v2-native path):** `capacityV2Native.test.ts` proves the A5 2段 case never reproduces 59 chars/line, computes a physically-valid per-column result instead (28×23, using the actual 85mm column height rather than the full 178mm page height), and structurally asserts `legacyBuggyMax.charsPerLine * v2.advanceTick > v2.columnHeightTick` — i.e. it proves the legacy "max" is physically impossible for the real column, using the corrected formula's own geometry as the yardstick.

**Migration-policy protection:** `capacityPolicy.test.ts` exercises test groups A-F/N/P exactly as specified — missing version resolves legacy, `documentOpen`/`ordinarySave`/`unrelatedSettingsEdit` never migrate, `explicitGeometryCommit` does, an already-`"v2-1"` document never reverts, and the legacy/v2 result branches are a discriminated union (`legacy` vs. `v2` keys) so diagnostic metadata cannot be confused between the two paths.

### Test/type-check results

```
npx tsc --noEmit   → only the pre-existing baseline error (src/app/layout.tsx:33, unrelated LayoutProps issue). Zero new errors from any typesetting-v2/core file.
npx vitest run     → 23 test files, 265 tests, ALL PASSING (174 pre-existing + 91 new from this Loop).
```

### Safety confirmation

No file under `src/` was read for anything other than the already-completed P3-O12-A/B read-only audit evidence above; no file under `src/` was modified. No `package.json`/lockfile change. No Editor/`src/` wiring of `deriveCapacityForEvent` exists — `core/index.ts` exports the new API as part of the Core's public surface (consistent with every other Core module), but nothing outside `typesetting-v2/core/` imports it yet.

### P3-O12 status after this Loop

**IMPLEMENTED / READY FOR VALIDATION.** Not RESOLVED, not CLOSED — Production/Editor integration (wiring `deriveCapacityForEvent` to the actual `PageSettingsPanel.tsx` commit flow and `DocumentRecord` schema, per §14/§16.9's remaining Human Decisions — dispatch-location Decision #6 is now answered by this implementation's own `capacityPolicy.ts` shape, but wiring it into the Editor is still a separate, future, explicit gate) remains un-started and unauthorized by this Loop.

STOP.
