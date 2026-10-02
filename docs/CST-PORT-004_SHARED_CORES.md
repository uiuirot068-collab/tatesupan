# CST-PORT-004 — shared cores with COLUMNSTAND (search / replace, gutter zone)

Loop: CST-PORT-004 (COLUMNSTAND ⇄ TateSpun mutual porting, round 4). Base: master 15449ee.
COLUMNSTAND counterpart: `docs/CST-PORT-004_SMALL_PORTS.md` in the columnstand repository.

No screen or behaviour change in TateSpun.

- C5: COLUMNSTAND now uses a byte-identical copy of `src/lib/searchReplaceNavigation.ts`.
  Its existing tests (`src/lib/searchReplaceNavigation.test.ts`, 20 tests) are now part
  of `npm test`, so a change to the core is caught here first.
- C6: `src/lib/gutterZone.ts` + `src/lib/gutterZone.test.ts` are the same files as in
  COLUMNSTAND: the ノドの見づらい範囲 model (中綴じ / 平綴じ, thickness → ノド注意 width)
  that COLUMNSTAND's 3D view uses. Not wired to any screen yet; it is the base for the
  cover / 3D ports. Keep both repositories' copies byte-identical.

Checks: `npm test` 36 files / 455 tests (was 34 / 430).
