# UI Comparison Prototypes — Editor/Settings Switching + Memo Access

Phase 1 (Master §21, HD-008/HD-009) product-decision demo. Three interactive variants of the same content, differing ONLY in how Editor/Settings switching and Memo access work. Not production code — no framework, no build step, plain HTML/CSS/JS so they can be opened directly.

## What each variant is

- **UI-A — Tab Model** (`ui-a.html`): 編集/設定 as two clearly-labeled tabs at the top. Switching is a pure CSS display toggle — both views stay mounted, so Editor scroll position/content are never lost when you switch away and back.
- **UI-B — Explicit Mode Buttons** (`ui-b.html`): same switching mechanics as UI-A, but styled as a segmented pill control with icon+label ("✏️ 編集する" / "⚙️ 設定する") instead of tab underlines — testing whether button-style framing reads differently from tab framing even though the underlying behavior is identical.
- **UI-C — Settings Drawer** (`ui-c.html`): Editor is the persistent primary screen and is *never* unmounted or hidden. Settings opens as a slide-in drawer overlay on top of it; closing the drawer returns to Editor with zero state loss because Editor was never actually left.

In all three, **Memo opens directly from an Editor toolbar button** as its own overlay — independent of Settings — per HD-009 ("Memo must not be a Settings-only feature").

## Content parity

All three load identical toolbar buttons, settings fields, sample manuscript text, and memo default text from `shared/content.js` (and identical base styling from `shared/base.css`), so no variant has more features/content than another — only the switching mechanism differs.

## How to open

No server needed — just open the file in a browser:

- Double-click `ui-a.html`, `ui-b.html`, or `ui-c.html` directly, **or**
- Open `index.html` for a hub that lets you switch between all three in an embedded frame, with PC-width/mobile-width (390px) presets.
  - If your browser blocks the `file://` iframe (some browsers restrict cross-file iframes even in the same folder), use the "別タブで直接開く" link in the hub, or just open the three files directly — the hub degrades gracefully to plain links in that case.

## Checking PC vs. mobile width

- **PC width:** open normally, full browser window.
- **Mobile width:** either resize your browser window narrow (≤600px triggers the shared mobile breakpoint — toolbar icons lose their text labels, settings fields stack vertically, UI-C's drawer goes full-width), or use your browser's device toolbar / responsive design mode (e.g. Chrome DevTools → toggle device toolbar → pick a phone width like 390px), or use the "モバイル幅 (390px)" preset in `index.html`'s hub.

## What to check in each variant

- Switch Editor → Settings → Editor: does the manuscript text/scroll position survive the round trip?
- Open Memo directly from Editor (no need to visit Settings first), close it, confirm you're back exactly where you were.
- Try both at PC width and at mobile width.
- Compare: writing focus, Settings discoverability, how easy it feels to get back to writing, Memo accessibility, visual clutter, how many taps/clicks each action takes.

Record impressions in `../../qa/human/UI_COMPARISON_SCORECARD.md` — Claude does not pick a winner; this is Human QA (Master §11.1's mandate that Human Visual/UX QA is not replaced by automated or AI judgment applies here too).
