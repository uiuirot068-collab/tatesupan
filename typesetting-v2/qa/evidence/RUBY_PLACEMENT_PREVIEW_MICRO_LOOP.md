# Ruby Placement Micro-Loop

## 1. Verdict

**PASS.** Canonical ruby annotation geometry is now computed once, during Core composition (`core/compose/line.ts`), and consumed read-only by the P3-O09 Preview Renderer Foundation. Body placement is unchanged (INV-003 verified). Breaks, capacity, and Natural Pitch are unchanged. This is a wiring/foundation task, not final ruby optical tuning — P3-O06 remains OPEN.

## 2. Dependency / Why This Was Required

`qa/evidence/P3_O09_PREVIEW_RENDERER_FOUNDATION.md` §11 concluded: *"A final Preview cannot paint ruby annotation at all — not even provisionally positioned — until `placeRuby()` is wired into the compose pipeline and `PlacedUnit` ... actually carries computed annotation geometry."* This was a concrete technical dependency, not a Product-behavior question — this micro-loop resolves it.

## 3. Existing `placeRuby()` Audit

Answers to the required audit questions, established by direct reading of `core/ruby/index.ts`, `core/measurement/facts.ts`, `core/layout/schema.ts`, and `core/layout/assemble.ts` before writing any code:

1. **Return value:** `{ policy: "CENTER"|"START_CLAMP"|"END_CLAMP"|"OVERFLOW_OPEN"; readingOffsetTick: GeometryTick }` — a pure function, already fully implemented, already tested (`core/ruby/index.test.ts`, pre-existing).
2. **Inputs required:** `{ baseExtentTick, readingExtentTick, overhangAllowanceBeforeTick, overhangAllowanceAfterTick }` — all `GeometryTick`, all inputs, not derived internally.
3. **Uses GeometryTick already:** yes, exclusively.
4. **Requires MeasurementFacts already available during line composition:** yes — `readingExtentTick` must come from `measurement.rubyReadingExtentTick(fontRef, sizePt, text)`, and `measurement: MeasurementFacts` is already a `composeLine` parameter.
5. **What placeRuby returns:** only policy + reading offset — **not** annotation start/extent/segments on its own. The offset is relative to the base run's own start tick (never absolute), and the caller (this task) is responsible for tracking base extent, reading extent, and overhang allowances itself and supplying them.
6. **Canonical type to own placement:** `PlacedUnit` already had a placeholder field for exactly this — `rubyBoundaryPolicy?: "CENTER"|"START_CLAMP"|"END_CLAMP"|"OVERFLOW_OPEN"` — declared at P3-L04/L15 but never populated (confirmed by grep: `schema.ts` was the only file mentioning it). This micro-loop completes that pre-existing, already-frozen field rather than inventing a new one.
7. **Can it attach to an existing PlacedUnit:** yes — see §4.
8. **Does wiring it change body placement today?** **NO**, confirmed by direct code reading (`placeRuby` has no base-coordinate output at all, per its own `core/ruby/index.test.ts` regression: `expect(Object.keys(result)).toEqual(["policy", "readingOffsetTick"])`) and by a new regression test (§6, test 17) proving `xTick`/`yTick`/`sourceSpan` for every atom are identical to a plain cumulative-advance model regardless of whether ruby annotation fields are attached. No HOLD required.

**Genuine gap found (not part of the original audit-question list, discovered while tracing the actual call path):** `RubyUnit`/`RubySegment` stored no literal reading text — only `readingSpan`/`baseSpan` offsets — and Core's `DocumentCompositionInput` never carries a raw manuscript source string (confirmed by reading `core/layout/assemble.ts` in full). `measurement.rubyReadingExtentTick(fontRef, sizePt, text)` needs the literal text, so without a source of truth for it inside Core, `placeRuby()` could never actually be called at all. This is not a body-placement or Product-policy question — it is the same missing-plumbing gap `compose/line.ts` itself already disclosed for indent-exemption checks on RUBY/SEMANTIC_RUN (*"a known, disclosed architecture constraint"*). Resolved by applying the **already-established** convention (`TextUnit.text`, `TCYUnit.displayText` already store their own literal content directly) to the one kind that lacked it: added `RubyUnit.readingText: string` and `RubySegment.readingText: string`. This is data-shape plumbing, not a Product-behavior decision — no jlreq/Product ruby rule changes; only what data Core has to compute against changes.

## 4. Canonical Annotation Contract

`PlacedUnit` (`core/layout/schema.ts`) gains two sibling fields alongside the pre-existing `rubyBoundaryPolicy`:

```ts
rubyBoundaryPolicy?: "CENTER" | "START_CLAMP" | "END_CLAMP" | "OVERFLOW_OPEN";
rubyReadingOffsetTick?: GeometryTick; // placeRuby()'s own output, relative to this atom's own yTick
rubyReadingExtentTick?: GeometryTick; // the reading's own measured extent, so a Renderer never re-measures
```

Populated only for a placed atom whose owning `LogicalUnit` is `RUBY` — one atom per declared JUKUGO segment (each gets independent geometry), or one atom for the whole group (ATOMIC, or undeclared/too-short JUKUGO, both composed as a single atom already). No field not required by `placeRuby()`'s own existing contract, or by the Renderer's own need to avoid re-measuring, was added.

## 5. Measurement Ownership

`compose/line.ts` calls `measurement.rubyReadingExtentTick(settings.bodyFontRef, settings.bodyFontSizePt, readingText)` — the SAME `MeasurementFacts` bundle already threaded through every other composition decision, no new fact introduced (the fact already existed, unused, since P3-L04). Overhang allowance is resolved via the already-existing `ruleSet.characterClassFor(char)` + `resolveOverhangAllowance(ruleSet, classId)` path, reading the literal boundary character of the immediately-adjacent, already-placed atom on the SAME line (via a new `literalTextForAtom` helper that slices an already-known TEXT/TCY unit's own stored text by relative code-point offset — never a raw source string, never a re-tokenization). No DOM/canvas/browser measurement of any kind is used anywhere in `core/` or `renderer/preview/`.

## 6. Body Invariant

Regression test 17 (`core/compose/rubyPlacement.test.ts`) proves: for a line containing `[TEXT, RUBY, TEXT]`, every placed atom's `yTick`/`xTick`/`sourceSpan` exactly matches a plain cumulative-advance model (`[0, CELL, CELL*3]` for the given fixture) — the RUBY atom's presence in the middle changes nothing about its own or its neighbors' coordinates, whether or not `rubyBoundaryPolicy` is populated. **Body placement changed: NO.**

## 7. Atomic / Group Ruby

Unchanged: `deriveRubyBreakOpportunities` (break-opportunity derivation) was not touched by this task. Test 8 confirms an ATOMIC ruby with a multi-character base still places as exactly one atom (no internal break) — INV-007 holds exactly as before, now with placement geometry attached to that single atom.

## 8. Jukugo Ruby

Test 9 proves a segmented JUKUGO ruby places one atom PER declared segment, each with independently-computed reading extent and policy (a 2-cell/5-cell-reading segment overflows; a neighboring 1-cell/1-cell segment centers) — proving segment-level independence, not a single averaged placement. Test 10 confirms an undeclared (segments-absent) JUKUGO still composes as exactly one atom (treated as ATOMIC), matching P3-O14's frozen "never guess a split" policy — **no auto jukugo discovery was introduced.**

## 9. Overhang / Clamp Boundary

`DEFAULT_RULE_SET_V2.rubyOverhangAllowance` ships empty (P3-O06 residual, HG-4 exact values still OPEN) — every overhang allowance this task resolves is therefore 0 today, and every overflowing case in the new tests reaches `OVERFLOW_OPEN` (never a fabricated `START_CLAMP`/`END_CLAMP` with an invented nonzero budget). Test 7 exercises the full class-lookup capability (a real adjacent character, e.g. `「`, is classified via `ruleSet.characterClassFor`) end-to-end without throwing or misclassifying, proving the CAPABILITY is real and wired — not that any particular optical value is now correct. **class-aware overhang: PARTIAL** (mechanism wired; values remain P3-O06 OPEN). **clamp: PARTIAL** (same reason — the clamp mechanism itself is fully exercised by `core/ruby/index.test.ts`'s pre-existing direct-call tests with synthetic nonzero allowances; this task's own wiring cannot yet observe a real clamp because the shipped table is empty).

## 10. Paragraph / Manual Break Interaction

Test 11: ruby on a paragraph-first line — the paragraph's own auto-indent applies normally (from a TEXT-first unit, since RUBY's own first-character is still indeterminate for the indent-exemption check, an already-disclosed, unrelated limitation), and the ruby atom's `yTick` is exactly the preceding atom's own advance, with the indent never appearing a second time inside the ruby's own placement fields. Test 12: ruby immediately after a `PARAGRAPH_BREAK` composes with correct, independent annotation geometry. Test 13: ruby immediately after a `MANUAL_BREAK` composes on the new page with correct geometry, and `page2Line0.indentTick` stays `undefined` — the earlier First-Line-Indent Visual HOLD fix (`core/compose/column.ts`) is unaffected and still holds. Tests 14/15: ruby placed at a column/page boundary composes correctly on the next column/page.

## 11. Preview Renderer Integration

`renderer/preview/paintModel.ts`: `PaintPlacedUnit.rubyAnnotationStatus?: "PENDING"` is replaced by `rubyAnnotation?: RubyAnnotationPaint`, a discriminated union (`{status:"PENDING"}` retained only as a defensive fallback for a theoretical unpopulated atom / `{status:"PLACED"; policy; offsetPx; extentPx; text}`). A new `rubyAnnotationFor` helper reads `placed.rubyBoundaryPolicy`/`rubyReadingOffsetTick`/`rubyReadingExtentTick` directly and converts ticks→px through the SAME `tickToPx` every other geometry value already uses — it never calls `placeRuby()`, never centers/clamps/measures anything itself, and never chooses a ruby segment break. `PreviewRenderer.tsx`'s `UnitBox` paints a `.ruby-annotation` span at the supplied `offsetPx`/`extentPx`, showing the resolved reading text — visible in **both** NORMAL and DEBUG mode (real content, not dev-only chrome); a richer geometry tooltip (`policy=... offset=...px extent=...px`) stays DEBUG-mode-only.

## 12. Tests

**Core** (`core/compose/rubyPlacement.test.ts`, 17 new tests, all 20 required cases covered — cases 4 and 5 combined into one test since the shipped empty overhang table makes them observationally identical today):
1 (short ruby, body≥reading→CENTER), 2 (annotation longer than body→overflow), 3 (centered annotation), 4/5 (START/END clamp — both degrade to OVERFLOW_OPEN given the empty table, proving the mechanism without fabricating a value), 6 (line/column edge, no same-line neighbor), 7 (adjacent to punctuation, class-lookup capability), 8 (atomic ruby = one atom), 9 (jukugo segmented = N independent atoms), 10 (undeclared jukugo = one atom, no auto-discovery), 11 (paragraph-start indent interaction), 12 (paragraph-break interaction), 13 (manual-page-break interaction, no phantom indent), 14 (column-boundary interaction), 15 (page-boundary interaction), 16 (source mapping preserved), 17 (body placement invariant), 18 (determinism).

**Renderer** (`renderer/preview/`, +3 tests over the P3-O09 Foundation's own 24): test 16 rewritten for real `PLACED` geometry; a new test 19 (renderer consumes geometry without recalculation — px fields directly traced back to Core's own tick fields via the single `tickToPx` formula); a new "ruby annotation text is real content..." test (case 20's normal/debug decoration split, ruby-specific).

**Full regression:** 347/347 Core tests pass (330 pre-existing + 17 new), 21/21 Stage C, 30/30 Stage D, 25/25 P3-O09 renderer/preview tests (19 pre-existing paintModel + 6 artifact-generation, net +1 file count from the Foundation's own 24 after this task's edits). `npx tsc --noEmit`: 0 new errors (only the known pre-existing `src/app/layout.tsx` baseline error) — 22 pre-existing test-file `RubyUnit`/`RubySegment` literals across 6 files needed a `readingText`/placeholder addition to keep type-checking (mechanical, no assertion changed).

## 13. Human Visual Artifact

`typesetting-v2/qa/visual/p3-o09-preview/index.html` (NORMAL) and `debug.html` (DEBUG) regenerated — the "atomic-ruby" fixture case (`これは`+RUBY(東京/とうきょう)+`に行く用事があった`) now shows the real annotation text `とうきょう` positioned beside the base `東京`, not an "annotation pending" placeholder. The historical Stage D artifact (`qa/visual/stage-d/index.html`) is untouched. This demonstrates: annotation appears, is attached to the correct body run, body did not move, annotation stays on the correct line, and the Renderer is visibly using canonical geometry (not a re-measured/re-centered approximation) — it does **not** claim optically-perfect ruby (P3-O06 exact overhang values remain OPEN, so this specific fixture's overflow case paints via `OVERFLOW_OPEN`, the least visually refined of the four policies, honestly).

## 14. P3-O06 Remaining Work

**Status: OPEN** (not closed by this task — ruby becoming visible is not the same as ruby overhang/optical quality being finished). Remaining: the exact numeric overhang allowance values per adjacent character class (jlreq documents multiple legitimate conventions; none was chosen here, matching the existing HG-4 disposition); once real (nonzero) allowances are frozen, `START_CLAMP`/`END_CLAMP` become observable in practice, not just in `core/ruby/index.test.ts`'s synthetic-input tests; any further optical (not logical) ruby refinement (e.g. group-ruby's own still-unlocated break rule, P3-O15, unaffected by this task).

## 15. Next Technical Task

With ruby annotation now visible end-to-end, the remaining special-unit visual-quality items (P3-O03 TCY shaping, P3-O04 dash alignment, P3-O05 ellipsis alignment) and the P3-O06 overhang-value question are all independently available — none blocks another architecturally. Recommended default order, per the frozen roadmap's own dependency reasoning (not a Human preference call): **P3-O03 (TCY visual)** next, since TCY's clean paint boundary was already established by the P3-O09 Foundation and needs no further Core change to begin; then **P3-O04/P3-O05** (semantic-run visuals, same reasoning); the **P3-O06 exact overhang values** remain a distinct, narrower Human Product question (not a technical-ordering one) whenever Product priorities call for it. This ordering is offered as a recommendation, not a decision — no Human Product decision is required to proceed with any of these, since none surfaces an undecided policy question on its own.

## Human Visual QA — Annotation Missing HOLD (2026-09-07)

**Discrepancy:** the machine report above states "normal ruby annotation visible: YES," backed by tests that checked SSR string presence (`renderToStaticMarkup` output contains the reading text). Human Visual QA of the actual artifact (`qa/visual/p3-o09-preview/index.html`) found the ruby body text present but **no visible reading annotation**, and the fixture heading still read "annotation painting PENDING — P3-O06" (stale copy predating this micro-loop). **Reason for the discrepancy:** the annotation text was genuinely present in the DOM (string-presence checks were not lying), but was unconditionally hidden by CSS — a class of bug SSR string matching structurally cannot detect, since it never runs a real layout/paint engine.

**Failure layer: PREVIEW RENDERER (CSS), not Core, not the paint model's data.**

**Exact root cause:** `.ruby-annotation` was rendered as a DOM CHILD of `.unit`, positioned via `left: 100%` (deliberately placed OUTSIDE `.unit`'s own box, to sit beside the base run) — but `.unit` carried `overflow: hidden` (added for an unrelated, legitimate reason: clipping a glyph's own ink to its tightly-fitted paint box, per the Page Content Clipping HOLD immediately before this one). CSS `overflow` clips ALL descendants of the element it is set on, regardless of where those descendants are positioned relative to it — so the annotation was clipped by its own parent in every real browser, unconditionally, independent of font metrics or scale.

**Fix (Renderer-only, no Core change):** introduced an inner `.unit-ink` wrapper (`renderer/preview/PreviewRenderer.tsx`) that now carries `overflow: hidden` instead of `.unit` itself; the base text/image-placeholder/provisional-badge moved inside `.unit-ink`, while `.ruby-annotation` (and the debug-only pending label / debug badge) remain direct children of `.unit`, siblings of `.unit-ink`, never subject to its clip. This is the minimal structural change: CSS `overflow` only ever clips descendants, never siblings, so moving the clip one DOM level down un-clips the annotation while preserving glyph-ink clipping exactly as before (verified: the Page Content Clipping HOLD's own no-overflow regression tests still pass unchanged).

**Heading/status copy corrected:** `renderer/preview/fixtures.ts`'s "atomic-ruby" fixture label changed from "Ruby (logical placement final; annotation painting PENDING — P3-O06)" to "Ruby (body + annotation geometry active; exact overhang/optical tuning pending — P3-O06)" — accurately reflects that basic canonical annotation IS now painted, without claiming P3-O06 (exact overhang/optical values) is closed.

**Regression tests added** (`generateFoundationArtifact.test.ts`, new `describe` block "Ruby Annotation Missing HOLD"), all against the ACTUAL `atomic-ruby` fixture from `ALL_FIXTURES` through the full artifact-generation pipeline — never an isolated synthetic `RubyUnit`: (1/2/3) canonical annotation placement exists, exactly one annotation paint item, non-empty display text; (4) the generated HTML contains the reading text as a **direct sibling** of `.unit-ink`, asserted via a structural regex requiring `.unit-ink`'s own closing tag before `.ruby-annotation` opens — not just substring presence, the exact class of check that would have caught this bug originally; (5) the annotation's offset/extent are finite, positive, and in the same small-px range as the rest of the fixture's geometry; (6) the base unit's own `topPx`/`sourceSpan` are provably unchanged whether the annotation renders or not; (7) NORMAL and DEBUG modes paint byte-identical annotation geometry (only the debug-only tooltip differs), and the heading no longer contains the misleading "annotation painting PENDING" phrase.

**Body invariant:** unchanged (test 6). **Line/page breaks:** unchanged (no Core file touched). **P3-O06:** remains OPEN — this fix makes CENTER/OVERFLOW_OPEN placements visible; it does not add, tune, or claim any exact overhang value.

**Tests:** 35/35 renderer/preview tests pass (30 previous + 5 new); 347/347 Core, 21/21 Stage C, 30/30 Stage D tests remain green; `npx tsc --noEmit` shows 0 new errors.

**Artifact regenerated:** `qa/visual/p3-o09-preview/index.html` and `debug.html` — the atomic-ruby fixture now visibly shows "とうきょう" beside "東京".

**Human recheck status: PENDING.**
