# P2-L05 — Source Mapping Evidence

- Status: Phase 2 PoC evidence, not a Phase 3 spec
- Demonstrates that every logical unit (ordinary char, ruby-base char, TCY run, dash/ellipsis run) retains its manuscript source range (`start`/`end`, UTF-16 code-unit offsets into the original source string) all the way through tokenization, unit expansion, and line-breaking — nothing is glyph-only / source-detached.

## F-KINSOKU

Source: `これはテストです」と彼は静かに言った`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| char | こ | [0,1) | — |
| char | れ | [1,2) | — |
| char | は | [2,3) | — |
| char | テ | [3,4) | — |
| char | ス | [4,5) | — |
| char | ト | [5,6) | — |
| char | で | [6,7) | — |
| char | す | [7,8) | — |
| char | 」 | [8,9) | — |
| char | と | [9,10) | — |
| char | 彼 | [10,11) | — |
| char | は | [11,12) | — |
| char | 静 | [12,13) | — |
| char | か | [13,14) | — |
| char | に | [14,15) | — |
| char | 言 | [15,16) | — |
| char | っ | [16,17) | — |
| char | た | [17,18) | — |

## F-LINE-END

Source: `すると「静かな声が聞こえた気がした`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| char | す | [0,1) | — |
| char | る | [1,2) | — |
| char | と | [2,3) | — |
| char | 「 | [3,4) | — |
| char | 静 | [4,5) | — |
| char | か | [5,6) | — |
| char | な | [6,7) | — |
| char | 声 | [7,8) | — |
| char | が | [8,9) | — |
| char | 聞 | [9,10) | — |
| char | こ | [10,11) | — |
| char | え | [11,12) | — |
| char | た | [12,13) | — |
| char | 気 | [13,14) | — |
| char | が | [14,15) | — |
| char | し | [15,16) | — |
| char | た | [16,17) | — |

## F-HANGING

Source: `それはとても静かな夜だった。窓の外には雪が降っていた`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| char | そ | [0,1) | — |
| char | れ | [1,2) | — |
| char | は | [2,3) | — |
| char | と | [3,4) | — |
| char | て | [4,5) | — |
| char | も | [5,6) | — |
| char | 静 | [6,7) | — |
| char | か | [7,8) | — |
| char | な | [8,9) | — |
| char | 夜 | [9,10) | — |
| char | だ | [10,11) | — |
| char | っ | [11,12) | — |
| char | た | [12,13) | — |
| char | 。 | [13,14) | — |
| char | 窓 | [14,15) | — |
| char | の | [15,16) | — |
| char | 外 | [16,17) | — |
| char | に | [17,18) | — |
| char | は | [18,19) | — |
| char | 雪 | [19,20) | — |
| char | が | [20,21) | — |
| char | 降 | [21,22) | — |
| char | っ | [22,23) | — |
| char | て | [23,24) | — |
| char | い | [24,25) | — |
| char | た | [25,26) | — |

## F-HANGING-BRACKET

Source: `それはとても静かな夜だった。」と彼は思った`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| char | そ | [0,1) | — |
| char | れ | [1,2) | — |
| char | は | [2,3) | — |
| char | と | [3,4) | — |
| char | て | [4,5) | — |
| char | も | [5,6) | — |
| char | 静 | [6,7) | — |
| char | か | [7,8) | — |
| char | な | [8,9) | — |
| char | 夜 | [9,10) | — |
| char | だ | [10,11) | — |
| char | っ | [11,12) | — |
| char | た | [12,13) | — |
| char | 。 | [13,14) | — |
| char | 」 | [14,15) | — |
| char | と | [15,16) | — |
| char | 彼 | [16,17) | — |
| char | は | [17,18) | — |
| char | 思 | [18,19) | — |
| char | っ | [19,20) | — |
| char | た | [20,21) | — |

## F-RUBY-SHORT

Source: `｜東京《とうきょう》に行く用事があった`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| rubyBase | 東 | [0,10) | ruby@0 |
| rubyBase | 京 | [0,10) | ruby@0 |
| char | に | [10,11) | — |
| char | 行 | [11,12) | — |
| char | く | [12,13) | — |
| char | 用 | [13,14) | — |
| char | 事 | [14,15) | — |
| char | が | [15,16) | — |
| char | あ | [16,17) | — |
| char | っ | [17,18) | — |
| char | た | [18,19) | — |

## F-RUBY-LONG

Source: `｜其《なにがし》という名の男が現れた`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| rubyBase | 其 | [0,8) | ruby@0 |
| char | と | [8,9) | — |
| char | い | [9,10) | — |
| char | う | [10,11) | — |
| char | 名 | [11,12) | — |
| char | の | [12,13) | — |
| char | 男 | [13,14) | — |
| char | が | [14,15) | — |
| char | 現 | [15,16) | — |
| char | れ | [16,17) | — |
| char | た | [17,18) | — |

## F-RUBY-BOUNDARY

Source: `あ｜東京都《とうきょうと》へ行く`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| char | あ | [0,1) | — |
| rubyBase | 東 | [1,13) | ruby@1 |
| rubyBase | 京 | [1,13) | ruby@1 |
| rubyBase | 都 | [1,13) | ruby@1 |
| char | へ | [13,14) | — |
| char | 行 | [14,15) | — |
| char | く | [15,16) | — |

## F-TCY-BARE

Source: `その日は12月だった。西暦は[tate]2026[/tate]年だ`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| char | そ | [0,1) | — |
| char | の | [1,2) | — |
| char | 日 | [2,3) | — |
| char | は | [3,4) | — |
| tcy | 12 | [4,6) | — |
| char | 月 | [6,7) | — |
| char | だ | [7,8) | — |
| char | っ | [8,9) | — |
| char | た | [9,10) | — |
| char | 。 | [10,11) | — |
| char | 西 | [11,12) | — |
| char | 暦 | [12,13) | — |
| char | は | [13,14) | — |
| tcy | 2026 | [14,31) | — |
| char | 年 | [31,32) | — |
| char | だ | [32,33) | — |

## F-DASH-FIT

Source: `彼は――そうだ――と静かに言った`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| char | 彼 | [0,1) | — |
| char | は | [1,2) | — |
| dashRun | ―― | [2,4) | dashRun@2 |
| char | そ | [4,5) | — |
| char | う | [5,6) | — |
| char | だ | [6,7) | — |
| dashRun | ―― | [7,9) | dashRun@7 |
| char | と | [9,10) | — |
| char | 静 | [10,11) | — |
| char | か | [11,12) | — |
| char | に | [12,13) | — |
| char | 言 | [13,14) | — |
| char | っ | [14,15) | — |
| char | た | [15,16) | — |

## F-DASH-DEFER

Source: `彼は――そうだ――と静かに言った`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| char | 彼 | [0,1) | — |
| char | は | [1,2) | — |
| dashRun | ―― | [2,4) | dashRun@2 |
| char | そ | [4,5) | — |
| char | う | [5,6) | — |
| char | だ | [6,7) | — |
| dashRun | ―― | [7,9) | dashRun@7 |
| char | と | [9,10) | — |
| char | 静 | [10,11) | — |
| char | か | [11,12) | — |
| char | に | [12,13) | — |
| char | 言 | [13,14) | — |
| char | っ | [14,15) | — |
| char | た | [15,16) | — |

## F-ELLIPSIS

Source: `……そうか……と彼はつぶやいた`

| Unit kind | Display | Source [start,end) | Group |
|---|---|---|---|
| ellipsisRun | …… | [0,2) | ellipsisRun@0 |
| char | そ | [2,3) | — |
| char | う | [3,4) | — |
| char | か | [4,5) | — |
| ellipsisRun | …… | [5,7) | ellipsisRun@5 |
| char | と | [7,8) | — |
| char | 彼 | [8,9) | — |
| char | は | [9,10) | — |
| char | つ | [10,11) | — |
| char | ぶ | [11,12) | — |
| char | や | [12,13) | — |
| char | い | [13,14) | — |
| char | た | [14,15) | — |

