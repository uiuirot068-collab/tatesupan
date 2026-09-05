# P2-L05 — Break Decision Trace

- Status: Phase 2 PoC evidence, not a Phase 3 spec
- Generated directly from `scripts/engine.js` output by `scripts/build-capability-poc.js` — not hand-transcribed, cannot drift from what the engine actually computed.
- Every row is reproducible: `node -e "console.log(require('./scripts/engine.js').runCapability('<text>', <capacity>).trace)"`

## F-KINSOKU — 行頭禁則 push-out (追い出し)

Source: `これはテストです」と彼は静かに言った` · demo capacity: 8 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,9) | char:"す"@7 | char:"」"@8 | line-start-prohibited (追い出し) | "これはテストです」" | 9 | "と"@9 |
| 1 | [9,17) | char:"っ"@16 | char:"た"@17 | (none — naive break stood) | "と彼は静かに言っ" | 8 | "た"@17 |
| 2 | [17,18) | char:"た"@17 | (end of text) | (none — naive break stood) | "た" | 1 | (end of text) |

## F-LINE-END — 行末禁則 (opening bracket cannot end a line)

Source: `すると「静かな声が聞こえた気がした` · demo capacity: 4 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,3) | char:"「"@3 | char:"静"@4 | line-end-prohibited (opening bracket pushed to next line) | "すると" | 3 | "「"@3 |
| 1 | [3,7) | char:"な"@6 | char:"声"@7 | (none — naive break stood) | "「静かな" | 4 | "声"@7 |
| 2 | [7,11) | char:"こ"@10 | char:"え"@11 | (none — naive break stood) | "声が聞こ" | 4 | "え"@11 |
| 3 | [11,15) | char:"が"@14 | char:"し"@15 | (none — naive break stood) | "えた気が" | 4 | "し"@15 |
| 4 | [15,17) | char:"た"@16 | (end of text) | (none — naive break stood) | "した" | 2 | (end of text) |

## F-HANGING — ぶら下げ (hanging 。)

Source: `それはとても静かな夜だった。窓の外には雪が降っていた` · demo capacity: 13 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,14) | char:"た"@12 | char:"。"@13 | hanging punctuation (ぶら下げ, extra slot) | "それはとても静かな夜だった。" | 14 | "窓"@14 |
| 1 | [14,26) | char:"た"@25 | (end of text) | (none — naive break stood) | "窓の外には雪が降っていた" | 12 | (end of text) |

## F-HANGING-BRACKET — ぶら下げ + riding close-bracket

Source: `それはとても静かな夜だった。」と彼は思った` · demo capacity: 13 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,15) | char:"た"@12 | char:"。"@13 | hanging punctuation (ぶら下げ, extra slot); hanging close-bracket rides with 。/、 (TSP-LOOP-029 R3) | "それはとても静かな夜だった。」" | 15 | "と"@15 |
| 1 | [15,21) | char:"た"@20 | (end of text) | (none — naive break stood) | "と彼は思った" | 6 | (end of text) |

## F-RUBY-SHORT — ordinary ruby

Source: `｜東京《とうきょう》に行く用事があった` · demo capacity: 10 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,18) | char:"っ"@17 | char:"た"@18 | (none — naive break stood) | "東京に行く用事があっ" | 10 | "た"@18 |
| 1 | [18,19) | char:"た"@18 | (end of text) | (none — naive break stood) | "た" | 1 | (end of text) |

## F-RUBY-LONG — ruby longer than its base (overflow pressure)

Source: `｜其《なにがし》という名の男が現れた` · demo capacity: 6 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,13) | char:"の"@12 | char:"男"@13 | (none — naive break stood) | "其という名の" | 6 | "男"@13 |
| 1 | [13,18) | char:"た"@17 | (end of text) | (none — naive break stood) | "男が現れた" | 5 | (end of text) |

## F-RUBY-BOUNDARY — multi-char ruby base at a naive boundary

Source: `あ｜東京都《とうきょうと》へ行く` · demo capacity: 4 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,13) | rubyBase:"都"@1 | char:"へ"@13 | (none — naive break stood) | "あ東京都" | 4 | "へ"@13 |
| 1 | [13,16) | char:"く"@15 | (end of text) | (none — naive break stood) | "へ行く" | 3 | (end of text) |

## F-TCY-BARE — TCY: bare auto-detect + explicit [tate] notation

Source: `その日は12月だった。西暦は[tate]2026[/tate]年だ` · demo capacity: 8 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,9) | char:"っ"@8 | char:"た"@9 | (none — naive break stood) | "その日は12月だっ" | 8 | "た"@9 |
| 1 | [9,33) | char:"だ"@32 | (end of text) | (none — naive break stood) | "た。西暦は2026年だ" | 8 | (end of text) |

## F-DASH-FIT — dash run, fits whole

Source: `彼は――そうだ――と静かに言った` · demo capacity: 5 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,5) | char:"そ"@4 | char:"う"@5 | (none — naive break stood) | "彼は――そ" | 5 | "う"@5 |
| 1 | [5,10) | char:"と"@9 | char:"静"@10 | (none — naive break stood) | "うだ――と" | 5 | "静"@10 |
| 2 | [10,15) | char:"っ"@14 | char:"た"@15 | (none — naive break stood) | "静かに言っ" | 5 | "た"@15 |
| 3 | [15,16) | char:"た"@15 | (end of text) | (none — naive break stood) | "た" | 1 | (end of text) |

## F-DASH-DEFER — dash run, must defer whole (not split)

Source: `彼は――そうだ――と静かに言った` · demo capacity: 3 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,2) | char:"は"@1 | dashRun:"――"@2 | (none — naive break stood) | "彼は" | 2 | "――"@2 |
| 1 | [2,5) | char:"そ"@4 | char:"う"@5 | (none — naive break stood) | "――そ" | 3 | "う"@5 |
| 2 | [5,7) | char:"だ"@6 | dashRun:"――"@7 | (none — naive break stood) | "うだ" | 2 | "――"@7 |
| 3 | [7,10) | char:"と"@9 | char:"静"@10 | (none — naive break stood) | "――と" | 3 | "静"@10 |
| 4 | [10,13) | char:"に"@12 | char:"言"@13 | (none — naive break stood) | "静かに" | 3 | "言"@13 |
| 5 | [13,16) | char:"た"@15 | (end of text) | (none — naive break stood) | "言った" | 3 | (end of text) |

## F-ELLIPSIS — ellipsis run

Source: `……そうか……と彼はつぶやいた` · demo capacity: 5 cells

| Line | Source range | Naive break (after unit) | Naive next unit | Rule decisions | Final line text | Final cells | Next line starts at |
|---|---|---|---|---|---|---|---|
| 0 | [0,5) | char:"か"@4 | ellipsisRun:"……"@5 | (none — naive break stood) | "……そうか" | 5 | "……"@5 |
| 1 | [5,10) | char:"は"@9 | char:"つ"@10 | (none — naive break stood) | "……と彼は" | 5 | "つ"@10 |
| 2 | [10,15) | char:"た"@14 | (end of text) | (none — naive break stood) | "つぶやいた" | 5 | (end of text) |

