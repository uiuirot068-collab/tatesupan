# TateSpun β RC branch integration audit

Date: 2026-09-10
Start HEAD: `653eb2de530e551e953d0b4f9226689e87b7155f`
Branch: `design/tatespun-typesetting-v2`
Status: **RC READY FOR HUMAN QA / NOT RELEASED**

## Approved decisions implemented

- **PDF A:** v2 PDF is generated inside the browser. A module Worker consumes the canonical PaintPlan; no manuscript/image upload route exists.
- **Bleed A:** v2 β output is trim-only. The export surface states this concisely. Existing legacy bleed code remains untouched.
- **TXT A:** local UTF-8 no-BOM/LF export; BOM/no-BOM CRLF/LF import; visible TateSpun notation is opaque/preserved; image binary is not placed in TXT.
- **Rollout B:** `NEXT_PUBLIC_TATESPUN_RENDERER=V2_BETA` activates v2 at build/start time. Unset, `LEGACY`, or an unknown value fails closed to legacy. No user-facing selector and no manuscript migration exist.

## Dependency-ordered implementation result

1. The rollout choke point is independent of document state; legacy stays available.
2. The real Editor now exposes UI-C settings drawer, direct Memo, completed checklist model, TXT import/export, while reusing passed Undo/Redo, manual page break, 11-B, help, and Writing Check behavior.
3. The production v2 surface composes current title/content/settings once through `composeV2Document`; Canonical output feeds Preview and Publication.
4. Real local image data is pre-resolved to Publication bytes/dimensions. Missing/corrupt/unsupported images remain structured failures and visibly HOLD export.
5. Publication font readers now use a scoped browser-safe `Uint8Array`/`DataView` adapter. No global Node Buffer polyfill is installed. jsPDF receives image `Uint8Array` directly.
6. PDF paint runs in a Worker and yields between canonical pages for pause/cancel/progress. Only a complete byte result is downloaded.
7. Web first-page JPG, Web all-page ZIP, and print all-page ZIP use the same canonical PaintPlan. Print long side remains 1600 px.
8. Existing export cancellation coordination gates JPG page/encode/ZIP units; the PDF Worker has page-boundary pause/resume/cancel messages.
9. The frozen Hero/subcopy/journey and local/privacy/output-ownership message are present on the top page.
10. NG words have a distinct purple wave; RED/YELLOW meaning is unchanged; amber is lighter and result text is Editor-readable.

## Static-host/browser boundary

- `next.config.ts` remains `output: "export"`.
- No dynamic Route Handler or server PDF endpoint was added.
- The Shippori Mincho file is served as a static local asset at `/fonts/ShipporiMincho-Regular.ttf` (respecting the app base path through `withBasePath`).
- Worker source is bundled by Next from `new URL("../workers/v2Pdf.worker.ts", import.meta.url)`.
- The ignored static-export directory `out` is excluded from root TypeScript input, so a V2 build followed by a LEGACY build remains reproducible.

## 100+ page evidence

The deterministic branch integration test composed and rendered a representative 112-page Japanese document with Ruby, explicit TCY, U+30FC, dash, ellipsis, a manual break, running heads, folios, a resolved image, and a structural colophon. It supplied the real Shippori Mincho resource, removed `globalThis.Buffer` during render, and emitted a complete 6,678,695-byte PDF in approximately 9.28 seconds on the final full-suite run on this machine. Result: **PASS**.

This is an automated executor measurement, not a claim that every browser/device has the same timing. The Worker keeps browser UI work separated, and Human QA must still confirm progress/cancellation and representative image/colophon output in the real Editor.

## Validation recorded

- TypeScript: PASS in both optimized production builds.
- Publication regression: 51 files / 584 tests PASS after browser-byte adaptation.
- Pre-integration/bridge/Writing Check suite: 36 files / 389 tests PASS.
- Preview regression: 6 files / 114 tests PASS.
- Core/root regression: 29 files / 368 tests PASS.
- Editor session hook: 1 file / 11 tests PASS.
- 11-B work-session regression: 3 files / 44 tests PASS.
- UI-C checklist/manual-break regression: 3 files / 13 tests PASS.
- Optimized Next 16.3 static build with `V2_BETA`: PASS, 11 static routes.
- Optimized Next 16.3 static build with `LEGACY`: PASS, 11 static routes.
- Targeted new-integration ESLint: 0 errors; one pre-existing `pdfGenerator.ts` unused-variable warning remains outside this change's lines.

## Remaining gates

- Consolidated Human branch QA in `typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md`.
- Explicit Human approval of the final release diff.
- Merge/push/deploy and Production smoke are separate, not authorized in this run.

Closed Typography/Ruby/TCY/etc. quality was exercised by the Publication regression and was not redesigned or reopened. Unrelated pre-existing QA artifact noise is excluded from task-owned staging.
