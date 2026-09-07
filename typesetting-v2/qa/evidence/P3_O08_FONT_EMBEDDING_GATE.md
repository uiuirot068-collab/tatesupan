# P3-O08 — Font Embedding Gate

## 1. Verdict

**HOLD — ASSET ACQUISITION GATE, not a license or technology blocker.**
Every question this audit was asked to resolve came back favorably: the
license permits embedding and repository redistribution, and jsPDF's own
documentation explicitly supports the exact custom-TTF/CJK embedding
pattern needed. The one open item is that **no local font asset for any
of TateSpun's body fonts exists anywhere in this repository or its
`node_modules`**, and fetching one over the network was explicitly halted
mid-task pending a Human decision on how to proceed (see §15). No PoC PDF
with real embedded CJK glyphs was generated this task — only the audit
questions were answered.

## 2. Existing TateSpun Font Identity

Direct-read, not memory: `src/lib/pageLayout.ts:266` —
`fontFamily: "'Shippori Mincho', serif"` is the Production Editor's own
default body font. `src/app/layout.tsx:43` loads four families via Google
Fonts CDN: `Noto Sans JP`, `Noto Serif JP`, `Shippori Mincho`, `Zen Old
Mincho` (weights 400/700 each) — `Shippori Mincho` is the one actually
assigned as the default body font; the other three are available
alternatives/headers per `PageSettings`, not independently audited here
(same license family — see §4).

## 3. Exact Font Asset

**No local font file exists.** Direct search (`**/*.{ttf,otf,woff,woff2}`,
whole repository including `node_modules`) found zero files for Shippori
Mincho, Noto Sans JP, Noto Serif JP, or Zen Old Mincho anywhere — the
Production app loads all four exclusively from Google's own CDN
(`fonts.googleapis.com`/`fonts.gstatic.com`) at request time, never
bundling a local copy. The only CJK-adjacent font files present anywhere
in the repo are unrelated: `typesetting-v2/prototypes/phase2-typography-poc/candidates/c2-dedicated-shaping/node_modules/harfbuzzjs/test/fonts/noto/`
contains `NotoSans-Regular.ttf/.otf` (Latin only), `NotoSansDevanagari-Regular.otf`,
and `NotoSansArabic-Variable.ttf` — a different prototype's HarfBuzz
shaping test corpus, confirmed to carry **no Japanese/CJK glyph coverage**
by their own names/scripts, not usable as a substitute.

**Format:** not independently verified (no local copy to inspect) —
Google's own official Fonts GitHub repository names the static regular
weight `ShipporiMincho-Regular.ttf` (`.ttf` extension, per the standard
Google Fonts OFL directory convention), which is consistent with, but not
directly proven equivalent to, jsPDF's own documented `.ttf` support (§7).
This should be confirmed against the actual file the moment one is
obtained, not assumed.

## 4. License / Embedding Rights

Recovered from Google's own official Fonts repository (`google/fonts`,
`ofl/shipporimincho/OFL.txt` on GitHub — the authoritative upstream source,
not a "free font" inference): **SIL Open Font License, version 1.1 (dated
26 February 2007)**. The license text explicitly grants permission to
*"use, study, copy, merge, **embed**, modify, redistribute, and sell
modified and unmodified copies of the Font Software"* — embedding is named
explicitly, not inferred. Conditions: the font cannot be sold as a
standalone product; modified versions must retain the same license;
Reserved Font Names cannot be used in derivatives without permission; the
copyright notice and license text must accompany any distribution; no
warranty is provided.

**PDF embedding: ALLOWED**, directly, by name, in the license grant.

## 5. Repository Redistribution Rights

**ALLOWED**, with conditions, per the same OFL 1.1 text — "redistribute...
copies of the Font Software" is explicitly granted. The binding condition
for THIS repository specifically: the font's own copyright notice and the
full OFL license text must be committed alongside the font binary (the
same convention Google's own repository already follows — each font
directory ships its own `OFL.txt`). No Reserved Font Name conflict applies
(TateSpun would not be renaming or rebranding the font, only using it
as-is). **Distinction honored, per instruction:** PDF-embedding permission
and repository-commit permission are both confirmed here as the SAME
answer for this specific license (OFL 1.1 permits both), but they were
verified as two separate license clauses, not assumed identical because
one was true.

## 6. MeasurementFacts Identity

**No real measurement provider exists anywhere in v2 Core yet** — direct
read of `core/measurement/facts.ts` and `core/measurement/fakeProvider.ts`
confirms `createFakeMeasurementProvider()` (`providerId:
"tatespun-fake-measurement-provider"`) is explicitly documented as *"the
only concrete provider until a real Renderer-adjacent measurement adapter
is designed (P3-O08/O09, explicitly out of Core scope)"* — every tick
value Core has ever produced, in every test across this entire session
(Preview, Stage C, Stage D, and this task's own Publication paint model),
derives from a synthetic, font-agnostic fixture formula
(`sizePt * 25.4/72 * 1000`), never from any real font's actual glyph
metrics.

**Determination:** "does Publication's font identity match MeasurementFacts'
identity" is **not yet a meaningful question** — there is no real font
identity on the Core side to match against. This is a pre-existing,
system-wide, disclosed architectural gap (not new, not introduced by this
task, not specific to Publication) — recording it honestly here rather
than fabricating a false "match" or treating it as this task's own defect.
`fontIdentityMismatch` (the structural flag both Preview and Publication
already implement, §8 of `P3_O08_PUBLICATION_RENDERER_FOUNDATION.md`)
remains correctly wired and will become meaningful the moment a real
measurement provider exists.

## 7. jsPDF Capability Audit

Direct read of `node_modules/jspdf/types/index.d.ts` and
`node_modules/jspdf/README.md` (version `4.2.1`, confirmed via
`node_modules/jspdf/package.json` — the same version already declared in
this repository's own root `package.json`, no new dependency needed).

**`addFont` signature** (index.d.ts:735) accepts an `encoding` parameter
including `"Identity-H"` — the standard PDF encoding for TrueType fonts
with 2-byte glyph indices, exactly the mechanism CJK fonts require (more
than 256 glyphs, cannot use a single-byte encoding). This is a strong,
direct signal the API was designed with exactly this use case in mind, not
an accident of a generic Unicode feature.

**README.md §"Use of Unicode Characters / UTF-8"** (lines 204–229) states,
verbatim: *"The 14 standard fonts in PDF are limited to the ASCII-codepage.
If you want to use UTF-8 you have to integrate a custom font... jsPDF
supports .ttf-files. So if you want to have **for example Chinese text**
in your pdf, your font has to have the necessary Chinese glyphs."* jsPDF's
own official documentation uses a CJK example (Chinese) to illustrate
exactly this capability — this is authoritative, not inferred from generic
Unicode support claims. The documented pattern: `addFileToVFS(filename,
base64OrBinaryString)` → `addFont(filename, name, style)` → `setFont(name)`
→ ordinary `text()` calls.

**Confirmed supported, by the library's own documentation and typings:**
custom TTF registration, Unicode/CJK glyph text via a registered font,
`Identity-H` encoding for multi-byte glyph indices, explicit font-weight/
style selection (`addFont`'s own `fontStyle`/`fontWeight` parameters), and
(from `P3_O08_PUBLICATION_RENDERER_FOUNDATION.md`'s own already-proven
work) placing content at explicit physical mm coordinates via `text(str, x,
y, options)`, entirely independent of any browser DOM.

**Not yet independently proven end-to-end** (requires an actual font
binary, §15): whether Shippori Mincho's specific file (once obtained)
parses cleanly through jsPDF's internal TTF parser without error, whether
its real file size (unknown without the file) produces an unreasonably
large embedded PDF, and whether real rendered glyphs are visually correct
(inherently requires Human Visual QA regardless, per instruction never to
machine-declare that).

## 8. Minimal CJK Vector PoC

**NOT GENERATED this task.** Blocked by the missing local font asset
(§3) — no `typesetting-v2/qa/publication/p3-o08/font-poc/` artifact was
created. This is reported honestly as not-yet-attempted, not as a failure
of the jsPDF path itself (which, per §7, has no evidence against it — only
an untested-in-this-repo status).

## 9. Vertical Paint Viability

**NOT ATTEMPTED** — depends on §8 completing first, per the task's own
instruction not to skip ahead.

## 10. Publication Renderer Integration

**NOT ATTEMPTED** — per the task's own instruction, integration into
`renderer/publication/` is gated on the isolated PoC (§8) succeeding
first. No file under `renderer/publication/` was modified by this task.

## 11. File Size / Subsetting Notes

Cannot be measured without the actual font file. Recorded for the future:
jsPDF's documented pattern (§7) embeds the font as a base64-encoded string
via `addFileToVFS` — the README gives no indication of automatic
subsetting (embedding the WHOLE font file's glyph table appears to be the
default, documented behavior); if Shippori Mincho's full CJK glyph set
produces an unreasonably large PDF, that is a distinct, later optimization
question per this task's own instruction ("not justification to return to
screenshot PDF immediately").

## 12. Failure Classification if Any

**Category F — MISSING LOCAL ASSET.** Explicitly not A (license — cleared,
§4/§5), not B (font format — Google's own naming convention indicates
`.ttf`, matching jsPDF's documented support, §3/§7), not C or D (jsPDF's
own documentation directly endorses this exact use case, §7), not E
(vertical paint transform — not yet reached). The sole blocker is that no
font binary is physically present anywhere this task is permitted to
obtain one from without further authorization (§15).

## 13. Tests

**None added this task.** Every test the task's own §"TESTS" section lists
(font resource resolution, font identity recording, model-unchanged-by-
font-loading, Japanese text paint commands retained, etc.) requires either
an actual font resource to register or a `renderer/publication/` code
change wiring one in — both are gated on §8/§10 completing first. Adding
placeholder tests against a font path that does not exist yet would either
trivially pass without proving anything, or require faking a font
resource, both of which this task's own instructions rule out. The
existing 21 P3-O08 Foundation tests (`paintModel.test.ts` +
`generatePublicationArtifact.test.ts`) were re-run unmodified to confirm
this audit made no code change: still 21/21 PASS.

## 14. Human QA Artifact

**None generated.** `READY FOR HUMAN FONT/PDF QA: NO` — there is no
Japanese-glyph PDF yet for a Human to inspect.

## 15. Exact Next Technical Task

**A Human decision on how to obtain the Shippori Mincho font asset**, now
that its license is confirmed to permit both embedding and repository
redistribution (§4/§5) — this is the ONLY remaining gate before the actual
PoC (§8) can run. Three legitimate paths, none started by this task
pending that decision:

1. **Human supplies the font file directly** (e.g., drops the `.ttf` into
   a scratch/PoC location) — no network access needed from this session.
2. **This session fetches it from Google's own official Fonts repository**
   (the exact same authoritative source already used for the license text
   in §4) via an explicitly re-authorized one-time download — a prior
   attempt at this was interrupted and cancelled mid-task, specifically
   because it happened before the license/asset audit above was complete;
   the audit is now complete.
3. **A different already-approved, already-local Japanese font asset** is
   identified and substituted — none was found in this repository (§3), so
   this path currently has no candidate.

Once a font binary is available by any of these paths, the immediate next
steps are exactly as originally scoped: register it via jsPDF's documented
`addFileToVFS`/`addFont` pattern (§7), generate the minimal CJK vector PoC
under `typesetting-v2/qa/publication/p3-o08/font-poc/` (§8/§9 of the
original task), and only then consider `renderer/publication/` integration
(§10).
