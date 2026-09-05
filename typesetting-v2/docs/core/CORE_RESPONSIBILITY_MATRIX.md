# Core Responsibility Matrix

- Status: DOCUMENTATION ONLY (P3-L02). Each row names exactly one owner — no shared/ambiguous ownership, per the loop brief.
- Columns match the pipeline in `TATESPUN_V2_CORE_CONTRACT.md` §3/§29: Editor, Normalizer, Logical Core, Measurement Provider, Canonical Layout (the Core's own output artifact, listed separately from "Logical Core" the decision-maker only where useful to distinguish decision from artifact), Preview Renderer, Publication Renderer, Product Policy (a Human/settings-level decision, not code).

| Concern | Owner | Note |
|---|---|---|
| Unicode segmentation (grapheme-safe atom boundaries) | Normalizer | Contract §6 — Core consumes already-safe atoms, never re-segments raw strings |
| Manual page-break recognition (3-case disambiguation) | Normalizer | Contract §13 — Core receives a resolved `ManualBreakUnit`, never re-parses `【改ページ】` |
| Character classification (cl-01–cl-30 assignment) | Logical Core | Contract §7, data-driven via `RuleSetVersion` |
| Kinsoku (line-start/end prohibition) | Logical Core | Contract §7/§8 |
| Ruby grouping (atomic vs. jukugo identification) | Normalizer (identification) / Logical Core (break-opportunity consequences) | Normalizer recognizes markup shape; Core decides what it means for breaking — Contract §5/§9 |
| Jukugo segmentation — *discovery* (deciding where a compound word's reading splits per kanji) | Normalizer / upstream Logical Analysis | **Not Core.** Hardened at P3-L02 closeout: the Core never linguistically discovers segmentation — it only ever consumes an already-segmented `JUKUGO` RubyUnit. The upstream mechanism itself (explicit markup / deterministic local parser / dictionary-assisted local analysis — no candidate chosen, no network/AI per Master §12.1/§20.3) is a distinct, still-OPEN policy question (`PHASE3_OPEN_ITEMS.md`), not a Core ambiguity. |
| Jukugo segmentation — *honoring* provided segment boundaries during composition | Logical Core | Contract §8/§9 — given `segments`, decide `RUBY_INTERNAL_ALLOWED`/`PROHIBITED`; given no `segments`, treat as `ATOMIC` (never guesses a split) |
| Ruby overhang allowance (which class, how much) | Product Policy (values) / Logical Core (application) | Contract §9.1 — HG-4 approved the mechanism; exact values are Product Policy, not yet set |
| Line break (final decision) | Logical Core | Contract §8 |
| Page break (final decision, including manual force) | Logical Core | Contract §8/§13 |
| Hanging decision (whether punctuation hangs) | Logical Core | Contract §12 — Renderer paints, never decides |
| TCY semantic grouping | Normalizer (explicit units) / Product Policy (auto-detection threshold, P3-O07, not yet set) | Contract §10 |
| TCY painting (visual combine) | Publication/Preview Renderer | Contract §10/§28 — P3-O03's renderer bug lives here, untouched by this contract |
| Dash/ellipsis semantic grouping (cl-08 inseparability) | Logical Core | Contract §11 |
| Dash/ellipsis painting (visual alignment) | Publication/Preview Renderer | Contract §11/§28 — P3-O04/O05 live here, untouched |
| Natural Pitch (default character advance, no page-fill stretch) | Logical Core (application) / Measurement Provider (raw advance value) | Contract §17/§18 |
| Font measurement (natural advance, metrics) | Measurement Provider | Contract §17 — supplied as versioned input, never silently recomputed mid-flow by a Renderer (INV-009) |
| Image intrinsic measurement | Measurement Provider | Contract §17 |
| Image flow placement (where in the column/page) | Logical Core | Contract §14 |
| Image decode/paint | Publication/Preview Renderer | Contract §14/§28 |
| Page numbering (value/scheme) | Product Policy (scheme) / Logical Core (placement per §15's page-decoration layer) | Contract §15/§16 |
| Colophon inclusion/placement | Logical Core | Contract §15 — distinct Source Block + CanonicalDocument-level element, per Master HD-006 |
| Source mapping (span survives every transform) | Normalizer (initial assignment) / Logical Core (preserved through every subsequent transform) | Contract §22, INV-001 |
| Decision trace (why a decision was made) | Logical Core | Contract §23 |
| Determinism (same input ⇒ same output) | Logical Core | Contract §24, INV-005 |
| Coordinate/unit conversion (mm → renderer-native unit) | Publication/Preview Renderer | Contract §21/§28 — Core geometry stays mm; conversion happens at the renderer's own paint boundary |
| PDF byte encoding | Publication Renderer | Contract §29 — technology selection out of scope (Master §7, P3-O08) |
| JPG byte encoding | Publication Renderer | Contract §29 |
| Editor undo/redo, Memo, session activity counter, SNS sharing | Editor | Contract §29 — entirely outside Core |
| TXT import/export UI, Editor Export Profiles | Editor | Contract §29 — Core only consumes the resulting normalized source, not the I/O UI itself |
| Publication-approval HOLD (whether an unresolved condition blocks PASS) | Logical Core (produces `hold` flag) / Product Policy (which conditions are serious enough to hold) | Contract §26 |
