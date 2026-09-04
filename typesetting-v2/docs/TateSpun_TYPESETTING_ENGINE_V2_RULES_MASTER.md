# TateSpun TYPESETTING ENGINE v2 RULES MASTER

- Status: APPROVED BASELINE
- Version: v1.2
- Established: 2026-09-05
- Updated: 2026-09-05 — repository/worktree/integration rule clarified
- Updated: 2026-09-05 — Phase 0 Human Decisions frozen (HD-001–HD-009); Editor/Settings switching UI direction added; Memo-in-Editor requirement added; 柱/奥付 font inheritance + override requirement added
- Scope: TateSpun Typesetting Engine v2
- Authority: This document is the highest-level design and migration rule set for Engine v2.
- Production baseline at boundary: current production remains unchanged unless separately approved.
- Boundary decision: TSP-TYPO-LOOP-005 marks the end of patch-style typography repair on the current rendering model.

---

## 0. WHY ENGINE v2 EXISTS

TateSpunの既存Typography調整では、FixedSlot、CSS縦書き、Chromiumのnative shaping、html-to-imageを中心とした現行レンダリング方式の範囲内で、文字送り・約物・出力品質の改善を進めた。

TSP-TYPO-LOOP-005までの調査により、残存するPublication Quality上の差の一部はTateSpun固有の単純な座標バグではなく、Shippori Minchoのglyph設計とChromiumの縦組みshaping挙動そのものに由来することが確認された。

したがって、今後は現行方式を守ることを前提とした局所パッチを続けない。

Engine v2では以下を境界線とする。

- TateSpunの理念は維持する。
- 基本UI・主要機能・既存ユーザー資産は可能な限り維持する。
- 出力品質は捨てない。むしろ最優先する。
- 現行Preview方式は採用前提にしない。
- 「Preview = Exportそのもの」という前提を廃止する。
- 現行FixedSlot / 1文字1span / CSS writing-mode / Chromium native shaping / html-to-imageを白紙評価へ戻す。
- 組版エンジンの考え方そのものを再設計する。
- 現行コードを改造することから始めず、「TateSpunにとって正しい組版とは何か」を先に定義する。

---

# 1. PRODUCT PRINCIPLES

## 1.1 Publication output is canonical

Engine v2では最終出力を正本とする。

Publication Canonical Output:
- PDF
- JPG

PDFは印刷・入稿における第一正本とする。
JPGも正本クラスとして品質保証する。

PNGは初回v2リリースの必須要件にはしない。
ただし将来追加可能な設計余地を保持する。
PNGを追加する場合は、無劣化画像出力として独立した価値が確認された時点で仕様化する。

## 1.2 Preview is not the canonical output

Previewは高品質な確認用Rendererとする。

Previewを低品質にしてよいという意味ではない。
編集・確認に十分な視認品質、ページ構造、ルビ、禁則、画像位置、文字送りの再現性を持たせる。

ただし以下の制約は撤廃する。

- Preview RendererとExport Rendererが同一技術でなければならない
- Preview DOMをそのまま画像化・PDF化しなければならない
- Preview pixelとExport pixelが完全一致しなければならない

## 1.3 Same logical typesetting, different renderers allowed

PreviewとExportで描画技術が異なることを許可する。

ただし以下は一致させる。

- ページ数
- 改ページ位置
- 文字送りの論理値
- 行数・1行文字数
- 禁則処理結果
- ぶら下げ処理結果
- ルビ対象と配置関係
- 縦中横
- 約物カテゴリ処理
- 画像配置
- 段組
- ページ番号
- その他、書籍として意味を持つ組版結果

PreviewとExportが「別の本」に見える差は許容しない。

---

# 2. CANONICAL LAYOUT MODEL

Engine v2では、描画技術より先に共通の組版結果を定義する。

基本概念:

Manuscript
→ Typesetting Engine
→ Canonical Layout Model
→ Preview Renderer
→ Publication Renderer

Canonical Layout Modelは、ページ、段、行、文字、ルビ、約物、画像等の論理配置を表す共通データモデルである。

例:
- page
- column
- line
- source text range
- glyph / token
- x / y
- advance
- font
- size
- ruby relation
- punctuation category
- kinsoku state
- hanging state
- tcy state
- image frame
- page break reason

ただし、この構造自体もPhase 0〜1で検証する。
現行FixedSlot構造をそのまま写しただけのモデルにしてはならない。

---

# 3. QUALITY PRIORITY

Engine v2の優先順位は以下とする。

1. 出版品質
2. 組版の正確性・再現性
3. 原稿を勝手に外部AI等へ送らないこと
4. 既存TateSpun機能との互換性
5. Preview品質
6. 操作レスポンス
7. 実装の単純さ
8. 開発コスト

「実装しやすいから」という理由だけでPublication Quality上限の低い方式を採用してはならない。

多少実装量が増えても、将来的な品質上限と保守可能性が高い方式を優先する。

---

# 4. PUBLICATION QUALITY REFERENCE

## 4.1 Browser native is not the authority

以下を正しさの最終基準にしない。

- Chromium native vertical writing
- CSS writing-modeのデフォルト挙動
- Font native positioningをそのまま適用した結果
- html-to-imageが忠実に再現したかどうか

ブラウザnativeと一致していても、出版物として不自然なら改善対象とする。

## 4.2 InDesign is a major reference, not an absolute copy target

InDesignをPublication Quality Referenceとして使用する。

比較対象:
- 文字送り
- 約物
- 禁則
- ぶら下げ
- ルビ
- 縦中横
- 段組
- ページ密度
- 全体リズム

ただしInDesignのpixel完全コピーは目標にしない。
InDesignと他の合理的な組版規則が異なる場合は、「出版物として自然か」「再現性があるか」「説明可能か」を優先して判断する。

---

# 5. TYPOGRAPHY RULES

## 5.1 Typography focus

Engine v2での主要改善対象:
- 自然で均一な文字送り
- 局所的な視覚字間
- 約物
- 禁則
- ぶら下げ
- ルビ
- 縦中横
- ――
- ……
- 改ページ
- 段組
- ページ再現性

文字の太さは今回の再設計の主課題にしない。
font-weightを根拠なく変更しない。

## 5.2 Natural pitch over forced page-fill

版面高を完全に埋めるために、文字送りを無理に伸縮することより自然な文字送りを優先する。

余剰スペースが発生する場合は、原則として版面余白として扱う。

版面密度を変更したい場合は:
- font size
- chars per line
- margin
- line count
- paper preset

等の正式な仕様値として扱う。
Renderer側の隠れ補正で埋めない。

## 5.3 Magic number prohibition

禁止:
- 文庫だけ +0.3px
- `。`だけ -2px
- Webだけ特別offset
- B5だけ別letter-spacing
- 目視で「このくらい」に合わせたpreset別補正
- 特定フレーズ専用補正

許可される調整:
- font metric
- OpenType data
- Unicode / Japanese typesetting category
- 物理単位
- 数学的配置規則
- 明示的な日本語組版規則

から導出できる一般則。

## 5.4 Character-category rules are allowed

以下のような組版カテゴリ別規則はmagic numberとはみなさない。

- 句読点
- 開き括弧
- 閉じ括弧
- 中点
- ダッシュ
- 三点リーダ
- 縦中横
- 欧文
- 数字
- ルビ
- 禁則対象
- ぶら下げ対象

ただし文字個別hackではなく、カテゴリとして仕様化する。

---

# 6. UNIT SYSTEM

## 6.1 Print-oriented presets

印刷系規格ではpxを組版の基準単位にしない。

基準候補:
- pt
- mm
- em
- font units

pxはPreviewやbitmap exportへ描画するときの変換結果として扱う。

## 6.2 Web-oriented preset

TateSpunには「Web閲覧用」規格が存在するため、Web向け規格についてはCSS px等のWeb logical unitを正本単位として採用する余地を残す。

ただし、印刷規格とWeb規格を同じ内部単位へ無理に統合して品質を落としてはならない。

Engine v2は各presetについて「どの単位系をcanonicalとするか」を明示的に持てる設計を検討する。

原則:
- Print preset: physical typesetting units first
- Web preset: web logical units may be canonical
- Common layout semantics remain shared

**HD-001 (v1.2):** Web閲覧用も含め、Canonical Layout Model上のpage単位は廃止しない。画面上のUI表現として縦スクロール等の閲覧方式を採用することは許可するが、それはPresentation/Preview層の選択であり、論理page構造そのものを放棄することを意味しない。Web preset向けにweb logical unitをcanonicalにできるかは引き続きPhase 1で検討する（§20.1）。

---

# 7. TECHNOLOGY SELECTION — WHITE-SHEET RULE

Engine v2では以下をすべて採用未定に戻す。

- FixedSlot
- 1文字1span
- CSS writing-mode
- Chromium shaping
- html-to-image
- Canvas
- SVG
- HTML DOM
- WebGL
- WASM
- HarfBuzz等のshaper
- PDF library
- browser PDF
- server-side rendering
- client-side rendering

どれもPhase 0で先に採用しない。

禁止:
「既存コードがこれだから」
「今のPageCardを少し直せば使えるから」
という理由だけで方式を選ぶこと。

技術選定はRequirements Freeze後に複数案を比較して行う。

---

# 8. EXISTING TATESPUN ASSETS TO PRESERVE

原則維持対象:

- TateSpunのサービス理念
- 基本UI
- 原稿エディタ
- 用紙設定
- フォント選択
- 文字サイズ
- 段組
- ルビ
- 改ページ
- 画像
- ページ番号
- 保存
- クラウド
- Export UI
- 現行ユーザーデータ
- 既存プロジェクトデータとの互換性

ただしPublication Quality達成に本当に必要な場合は、一部UI・設定仕様の変更を許可する。

UI維持は絶対制約ではない。
変更する場合は:
- なぜ必要か
- 既存ユーザーへの影響
- migration方法
- rollback方法

を先に提示する。

**HD-008 (v1.2):** Engine v2統合後のUI方向性として、Editor⇄Settings切替型UIへの変更を製品要件として承認済み（§21.1）。これは上記の「変更する場合の提示」プロセスを経て承認された例であり、今後の類似UI変更にも同じプロセスを適用する。

---

# 9. NEW REQUIREMENTS APPROVED FOR v2

## 9.1 TXT import / export

Editor I/O要件として追加する。

必要機能:
- `.txt` の読み込み
- Editor内容を `.txt` として書き出し

Phase 0で決める事項:
- 文字コード
- 改行コード
- BOM
- ルビ等のTateSpun独自記法をどう扱うか
- 改ページ記号の扱い
- 画像参照の扱い
- import時の警告
- round-trip guaranteeの範囲

**HD-002 (v1.2):** round-tripの目標は「可能な限り元のテキスト情報を失わない」こととする。ただし画像そのもの等、plain TXTで完全に表現できない情報は別仕様として扱う（§20.2）。上記「Phase 0で決める事項」は、この目標の範囲内でPhase 1以降に確定する。

## 9.2 Writing-session total activity counter

STARTボタンからENDボタンまでの間に行った「総編集文字数」をカウントする機能を追加要件とする。

概念:
- 入力した文字数
- 削除した文字数

を累積し、最終文字数ではなく「そのセッションでどれだけ書いた／消したか」を表す。

例:
100文字入力
50文字削除
30文字入力
→ 総作業文字数 180

Phase 0以降で確定する事項:
- IME compositionの扱い
- paste
- cut
- undo
- redo
- replace
- select-all delete
- import
- programmatic normalization
- ruby入力
- 改ページtoken
- 画像token

**HD-004 (v1.2) 確定事項:**
- paste: 貼り付けた文字数をactivity（typed側）として扱う方向で確定。
- delete / cut: 削除文字数をactivityとして扱う方向で確定。
- `.txt` importおよびprogrammatic normalizationは、通常の執筆activityとは分離する。

上記以外（IME composition, undo, redo, replace, select-all delete, ruby入力, 改ページtoken, 画像token）は引き続きengineering investigation後に確定する（§20.4）。

START / END後に結果をSNSシェアできるようにする。

この機能はTypesetting Engineのcore責務ではなくEditor Session Metricsとして分離する。

---

# 10. REQUIRED FEATURES AT v2 COMPLETION

原則すべて維持必須:

- 禁則
- ぶら下げ
- ルビ
- 縦中横
- ――
- ……
- 改ページ
- 段組
- ページ番号
- 画像配置
- 既存ページ容量設定
- 奥付（colophon）— Canonical Layout Modelの正式要素として（§20.6）

これらを「Engine v2にすると難しい」という理由だけで削除しない。

仕様変更が必要な場合はHuman Gate必須。

---

# 11. QA MASTER RULE

## 11.1 Human Visual QA is mandatory

Engine v2は自動テストだけでは完成扱いにしない。

Publication Quality PASSにはHuman Visual QAを必須とする。

## 11.2 Mandatory preset matrix

最低限以下をHuman QA対象として維持する。

- 文庫
- A5 1段
- A5 2段
- B5
- B6
- 新書
- A6
- Web閲覧用

## 11.3 Typography Regression Corpus

今回使用した以下の文章を正式Regression Sentenceとして保存する。

「気が合った、と言ってしまえばそれまでだ。けれど気づけば、どこへ行くにも二人でいることが当たり前になっていた。」

追加Corpusを作る。

最低カテゴリ:
- 普通の漢字・かな
- 、。
- 開き括弧
- 閉じ括弧
- 「」
- 『』
- ――
- ……
- ルビ
- 長いルビ
- 縦中横
- 半角英数字
- 全角英数字
- 行頭禁則
- 行末禁則
- ぶら下げ
- 改ページ
- 複数段
- 画像混在
- 長文pagination
- paragraph boundary

Corpusは将来の全Renderer共通QA資産とする。

---

# 12. PRODUCTION SAFETY / ROLLBACK

## 12.1 Current Production stays intact

Engine v2開発中は現行Productionを壊さない。

現行 `spuntales.net/tatespun/` はv2完成まで維持する。

## 12.2 Parallel development

Engine v2は既存Production code pathと分離して開発する。

Productionへ直接置換しながら作らない。

## 12.3 Rollback is mandatory

v2をProductionへ切り替えた後も、一定期間は旧Engineへ戻せるようにする。

必須:
- old engine code path保持
- migration前checkpoint
- rollback procedure
- data compatibility確認
- feature flag / routing switch等の安全な切替方式をPhase 1以降で検討

「v2 deploy = old engine削除」を禁止する。

---

# 13. REPOSITORY / FOLDER POLICY

## 13.0 Non-negotiable repository / worktree integration rule

Engine v2の開発配置は、以下の4点セットを正式ルールとして固定する。

**同じrepo**
＋
**別worktree**
＋
**typesetting-v2専用フォルダ**
＋
**完成後に既存TateSpunアプリへ統合**

具体的には以下を意味する。

1. Engine v2のために新しい別repositoryを作らない。  
   現行TateSpunと同じGit repositoryの履歴・既存資産・将来の統合経路を共有する。

2. Engine v2の設計・研究・PoCは、現行Productionや既存Typography investigationのdirty stateから分離するため、専用のisolated worktreeで行う。  
   推奨branchは `design/tatespun-typesetting-v2` とする。

3. その専用worktreeのrepository root直下に、`typesetting-v2/` を専用workspaceとして作成する。  
   Phase 0〜2では原則としてこのworkspace内へ仕様・研究・QA・prototypeを蓄積し、既存`src/`へ混在させない。

4. Engine v2を独立した別サイト・別Cloudflare Pagesアプリとして恒久運用することを最終形にしない。  
   Engine v2がHuman QA / Regression / Publication Qualityを満たした後、既存TateSpunアプリへ統合する。

5. Production公開時の最終URLは、原則として既存の
   `https://spuntales.net/tatespun/`
   を継続使用する。

6. v2完成前に`typesetting-v2/`単体をProductionの正規TateSpunとして置き換えない。

7. 統合時は旧Engineを即削除せず、feature flag / routing switch等による安全な切替とrollback可能性を保持する。

初心者向けの運用原則:
**「別室で新しい組版エンジンを作り、完成後に今のTateSpunへ取り付ける。サイトそのものを別物として作り直すわけではない。」**

Engine v2は同じTateSpun repository内で管理することを原則とする。

ただし現行Production実装と混在させず、専用top-level workspaceを作る。

推奨初期構造:

```text
typesetting-v2/
  README.md
  docs/
    TateSpun_TYPESETTING_ENGINE_V2_RULES_MASTER.md
    requirements/
    architecture/
    decisions/
  research/
    browser/
    fonts/
    shaping/
    pdf/
    image-export/
  fixtures/
    manuscripts/
    fonts/
    expected/
  prototypes/
  qa/
    human/
    automated/
  artifacts/
```

初期段階では`src/`配下へEngine v2実装を入れない。

Phase 0〜2では研究・仕様・PoCを`typesetting-v2/`へ隔離する。

正式architecture決定後、production integration targetを別途決める。

推奨branch:
`design/tatespun-typesetting-v2`

可能ならisolated worktreeを使用する。

---

# 14. DEVELOPMENT PHASES

## Phase 0 — Requirements Freeze

目的:
TateSpunが「正しい組版」とみなす仕様を技術非依存で固定する。

このPhaseでは本実装禁止。

成果物:
- requirements matrix
- layout semantics
- unit policy
- output guarantees
- preview guarantees
- feature compatibility matrix
- QA corpus definition
- unknowns / decisions needed

## Phase 1 — Architecture Research

複数方式を比較する。

比較軸:
- Publication Quality ceiling
- Japanese vertical shaping
- OpenType support
- PDF generation
- JPG generation
- Preview feasibility
- browser compatibility
- performance
- offline/client-side feasibility
- font handling
- licensing
- complexity
- maintainability

本実装禁止。
小さなtechnical spikeは可。

## Phase 2 — Typography Proof of Concept

同一Regression Corpusを複数方式で描画し比較する。

InDesign referenceとHuman QAする。

このPhaseで初めて「どの技術が品質上限を満たせるか」を実証する。

## Phase 3 — Core Typesetting Engine

Canonical Layout Model:
- pagination
- lines
- columns
- kinsoku
- hanging
- ruby
- tcy
- punctuation
- images
- page break

等を実装する。

## Phase 4 — Publication Renderer

PDF / JPGを正本品質で生成する。

## Phase 5 — Preview Renderer

高品質・高応答な確認表示を作る。

Publication rendererと別技術を使用してよい。

## Phase 6 — Existing UI Adapter

現行TateSpun Editor / Settings / Save / Cloud等と接続する。

## Phase 7 — Full Regression

全preset / 全機能 / QA corpusを検証する。

## Phase 8 — Parallel Production QA

旧Engineとv2を同じ原稿で並行出力する。

## Phase 9 — Migration

Human QA PASS後のみProduction切替。

Rollbackを保持した状態で公開する。

---

# 15. ENGINE v2 GUARDRAILS

Engine v2の全Phaseで禁止:

- 現行方式を守ることを暗黙の前提にする
- 先にRendererを決める
- Publication Qualityより実装容易性を優先する
- magic numberによるpreset別補正
- Human QAなしでPublication PASSとする
- Productionを直接実験場にする
- 既存ユーザーデータを無断migrationする
- rollback不能な切替
- font-weightをTypography修正の代替として変更
- 原稿をユーザー承諾なく外部AI等へ送信する

---

# 16. DECISION RECORD REQUIREMENT

Engine v2で重要なarchitecture decisionを行う場合はADR相当のDecision Recordを残す。

最低項目:
- Decision ID
- Date
- Problem
- Options considered
- Evidence
- Tradeoffs
- Decision
- Rejected options
- Reversibility
- Migration impact
- QA impact

「なぜこの方式にしたか」を後から追跡可能にする。

---

# 17. ACCEPTANCE PRINCIPLE FOR ENGINE v2

Engine v2は以下を満たして初めてProduction候補となる。

- PDF Publication Quality PASS
- JPG Publication Quality PASS
- Preview Quality PASS
- Preview/Export logical-layout consistency PASS
- Mandatory preset matrix PASS
- Regression Corpus PASS
- Kinsoku PASS
- Hanging punctuation PASS
- Ruby PASS
- TCY PASS
- Dash / ellipsis PASS
- Pagination PASS
- Image placement PASS
- Existing project compatibility PASS
- TXT I/O PASS
- Performance acceptable
- Privacy requirement PASS
- Human Visual QA PASS
- Rollback tested

どれかが未確定の場合、Production migrationしない。

---

# 18. APPROVED USER DECISIONS

2026-09-05時点で以下を承認済み。

1. Publication output canonical: YES
2. Preview / Export renderer separation allowed: YES
3. Logical typesetting must match: YES
4. Pixel-perfect identity not required: YES
5. Browser native is not authority: YES
6. InDesign used as major reference: YES
7. Publication-natural behavior preferred: YES
8. Font weight not a v2 repair target: YES
9. Current renderer assumptions reset: YES
10. Technology choice deferred: YES
11. Independent v2 prototype first: YES
12. Current production preserved + rollback required: YES
13. Print units not px-first; Web preset requires separate unit study: YES
14. Natural pitch preferred over forced fill: YES
15. Magic numbers prohibited: YES
16. Typesetting-category rules allowed: YES
17. Existing product assets preserved: YES
18. UI change allowed when justified: YES
19. PDF canonical: YES
20. JPG canonical; PNG optional future: YES
21. JPG explicitly canonical: YES
22. Typography Regression Corpus required: YES
23. Human QA required: YES
24. 8-preset QA matrix required: YES
25. Existing typesetting features retained: YES
26. TXT I/O + session editing-count/share added: YES
27. Priority order approved: YES
28. Quality ceiling prioritized over implementation ease: YES

2026-09-05 Phase 0 Human Decision Freeze additions (HD-001–HD-009, see §20–§21):

29. Web閲覧用 retains logical page model even with scroll-style presentation UI: YES
30. TXT round-trip target: lossless-where-possible, non-representable content out of scope: YES
31. External AI/third-party processing requires explicit per-feature user consent: YES
32. Session activity counter: paste/delete count as activity; TXT import/programmatic normalization excluded from writing activity: YES
33. 柱/奥付 font inherits body font by default, independently overridable: YES
34. Hardcoded Shippori Mincho for 柱/奥付 is not carried forward as a v2 requirement (implementation detail only): YES
35. Colophon (奥付) is a formal Canonical Layout Model element: YES
36. 文章チェックβ stays separate from Typesetting Engine core: YES
37. Editor/Settings switching UI direction (mechanism undecided) approved, replacing "must preserve current desktop UI" as an absolute constraint: YES
38. Memo must be reachable directly from Editor without navigating to Settings (mechanism undecided): YES

---

# 19. CURRENT STATUS

Current typography patch path:
STOP after TSP-TYPO-LOOP-005.

Current production:
KEEP.

Loop003 uncommitted typography experiment:
DO NOT ship as part of Engine v2 decision unless separately reviewed and approved.

Phase 0 Human Decision Freeze:
COMPLETE (2026-09-05) — HD-001 through HD-009 recorded in §20–§21.

Next authorized action:
Phase 0 — Requirements Freeze (documentation update only; awaiting final Human Review sign-off before Phase 1).

Not yet authorized:
- Engine v2 implementation
- production integration
- renderer selection
- master push/deploy
- current production replacement
- UI implementation mechanism selection (tabs / drawer / modal / etc. for Editor⇄Settings switching or Memo access — see §21)

---

# 20. PHASE 0 HUMAN DECISION FREEZE (v1.2)

2026-09-05時点で、Phase 0 Human ReviewによりHD-001〜HD-007を承認済み。
これらはProduct Requirementの確定であり、実装方式の選定ではない。

## 20.1 HD-001 — Web閲覧用のpage概念維持

Web閲覧用でも「ページ」というCanonical Layout上の論理単位を廃止しない。

画面上で縦スクロール等の閲覧UIを採用することは許可する。
ただしそれはPresentation/Preview層の選択であり、
Canonical Layout Model側のpage構造そのものを放棄する理由にはしない。

Web閲覧用について、印刷presetと同じ物理単位系を無理に強制しない方針は維持する（§6.2）。
Web logical unitをcanonicalにできるかはPhase 1で引き続き検討する。

## 20.2 HD-002 — TXT round-tripの目標

TXT import / edit / TXT exportにおいて、
可能な限り元のテキスト情報を失わないround-tripを目標とする。

画像そのもの等、plain TXTで完全に表現できない情報は、
この目標の対象外とし、別仕様（§9.1）として扱う。

以下はPhase 1以降で確定する:
- encoding
- BOM
- line endings
- ruby notation
- manual page break notation
- image references
- malformed input warnings
- round-trip guaranteeの正確な境界

## 20.3 HD-003 — 外部処理への同意

原稿本文を外部AI・外部第三者処理へ送信するのは、
ユーザーがその機能を明示的に実行または許可した場合に限る。

通常の以下の操作では、原稿本文を外部AI等へ送信しないことを基本contractとする:
- editing
- typesetting
- Preview
- PDF generation
- JPG generation

これはMaster §3優先順位3、§12 Privacy Contractの具体化である。

## 20.4 HD-004 — Session editing activity counterの確定事項

以下を確定する:
- paste: 貼り付けた文字数をactivity（typed側）として扱う方向。
- delete / cut: 削除文字数をactivityとして扱う方向。
- TXT importおよびprogrammatic normalizationは、通常の執筆activityとは分離する。

以下は引き続きengineering investigation後に確定する（未決定のまま）:
- IME compositionの扱い
- undo / redo
- replace
- select-all delete
- ruby入力のカウント方法
- 改ページtokenのカウント方法
- 画像tokenのカウント方法

SNS share機能は維持する。

## 20.5 HD-005 — 柱 / 奥付フォントの継承と上書き

現行実装の「柱・奥付は本文フォントに関わらずShippori Mincho固定」は、
Engine v2のuser-visible requirementとして継承しない
（これはimplementation detailとして扱う）。

Product requirement:
- 柱・奥付の初期状態では本文フォントを継承する
- ユーザーはあとから柱・奥付のフォントを本文とは独立して変更できる
- 具体的なsettings UIとdata modelはarchitecture / UI design以降で決定する

## 20.6 HD-006 — Canonical Layout Model内での奥付の扱い

奥付（colophon）は、Canonical Layout Modelの正式な組版要素として扱う。

少なくとも以下をEngine v2側で論理的に管理できること:
- page placement
- pagination関係（本文pageとの関係）
- font
- layout area
- export inclusion

最終的なdata structureはPhase 1以降で決定する。
これは既存の奥付が本文pagination/writing-modeから分離されている現行実装（TSP-LOOP-005）を、
Canonical Layout Modelの外に置いたままにしないという方針であり、
現行の実装方法そのものを維持する意味ではない。

## 20.7 HD-007 — 文章チェックβの分離

文章チェックβ（非AI・ローカル・テキスト非破壊のproofreading機能）は、
Typesetting Engine coreとは分離する。

Editor-side featureとして維持・接続する。
Engine v2 architectureへ文章チェック機能自体を混在させない。

---

# 21. UI PRODUCT DIRECTION — EDITOR / SETTINGS SWITCHING (v1.2)

Master §8の「UI維持は絶対制約ではない」プロセスに基づき、
以下のUI方向性をPhase 0 Human Reviewで承認済み。
これはProduct Requirementであり、具体的な実装方式の選定ではない。

## 21.1 HD-008 — Editor / Settings 切替型UI

既存Desktop UI（Editor / Settingsを常時同時表示する現行レイアウト）を
絶対維持するという制約を解除する。

Engine v2統合後のTateSpunでは、
スマホUIの考え方に近い

Editor ⇄ Settings

の切替型UIを基本方向とする。

Meaning:
- EditorとSettingsを常時同時表示することを必須にしない
- writing workspaceをEditorへ集中させる
- Settingsは明示的な切替で開ける
- desktop / mobile双方で一貫したmental modelを目指す

未決定（実装方式の例、まだ選ばない）:
- tabs
- segmented control
- toolbar switch
- drawer
- route transition
- split-view optional mode

## 21.2 HD-009 — EditorからのMemoアクセス

Memoは、Editor workflowから直接開けることを必須要件とする。

ユーザーがMemoを見るためにEditorからSettings画面へ移動する必要がないこと。

未決定（実装方式の例、まだ選ばない）:
- panel
- drawer
- modal
- floating window

要件は次の一文に集約される:
「Editor内からMemoを開き、原稿との行き来を妨げない」こと。

MemoをSettings-only featureにしない。

---

END OF MASTER
