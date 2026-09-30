# TateSpun Design Phase 2

Built on `71ea903` (Phase 1). This phase changes appearance, layout and wording only. Functions,
editor behaviour, data and key colours are unchanged.

## Reference principles (studied 2026-09-30, nothing copied)

| site | principle taken | not taken |
|---|---|---|
| hirono-iwc.co.jp/recruit | a small uppercase English label over a larger Japanese heading; one strong primary action, repeated | giant display English, textured bright fields, a hamburger-hidden navigation |
| unicell.co.jp | a quiet paper surface, generous whitespace, a light serif-like headline, one CTA colour | the rounded masking frame and the scrolling marquee text |
| i-taxoffice.jp | numbered 01 / 02 / 03 entries, hairline and dotted rules, outlined pill secondaries | illustration-heavy circles, vertical body text |
| studiocbr.jp | the content is the hero (for us: the shelf and the books); a faint oversized English word as section texture; items without heavy boxes; one accent for primary actions | photography, a dense commerce grid |

## Concept

**Top: the shelf is the hero.** The page should feel quiet but make you want to write.

- A returning writer opens straight onto 「あなたの本棚」.
- The shelf shows its count and the last date written.
- One primary action, 「＋ 次の一冊を書く」, sits beside it.
- The shelf is set on the page between hairlines instead of inside a card.
- A dashed empty spine, 「次の一冊」, marks the next book's place.
- 「Recently」 lists the three works most recently written in.

**Editor: first-time comprehension.**

- **Header:** one primary action, クラウドに保存 in gold. 保存作品一覧 and, on the editor,
  ログイン are outlined secondaries.
- **Toolbar:** one utility style, with a divider between history (元に戻す / やり直す) and editing
  (改ページ挿入 / 検索・置換).
- **設定 / オプション / メモ / ヘルプ:** each says what it holds. A short descriptor appears when the
  pane is wide (用紙・本文 / 奥付・目次 / 執筆メモ / 使い方), with the full list as a tooltip.
- **Gold:** the character count becomes a neutral chip, so gold marks primary actions only.

## System

- **Labels:** English small caps, 10 px, letter-spacing 0.24em, in the shelf grey (5.9:1), after a
  22 px gold rule.
- **Headings:** Japanese serif, 24–40 px, letter-spacing 0.04em.
- **Separation:** hairlines (`--home-line`) instead of boxes. Numbered index rows (mono numerals in
  gold).
- **Buttons:**
  - primary: ink fill (gold in dark) / gold fill for cloud save;
  - secondary: outlined, gold for 保存作品一覧, ink for account;
  - utility: quiet 15 % ink border.
- **Focus:** a 2 px ink focus ring on every button, link and tab (zero-specificity, so component
  focus styles win).
- **Disabled:** 45 % in the 編集ページ navigator (was 30 %).
- **Motion:** only 150–300 ms hover moves (≤ 3 px) and fades. Nothing moves on its own, nothing
  animates near the textarea, and `prefers-reduced-motion` removes them.
- **Dark mode:** the shared header now has a dark surface and mapped text on every page. Before, it
  stayed a white card in the editor.
