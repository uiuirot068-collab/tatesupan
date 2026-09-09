# TateSpun TYPESETTING ENGINE v2 RULES MASTER

- Status: APPROVED BASELINE
- Version: v1.8
- Established: 2026-09-05
- Updated: 2026-09-06 — Phase 3 P3-L03 Canonical Core Implementation Plan FROZEN (§28): the implementation plan for the Contract frozen at §27 is accepted, not yet executed. Planned isolated location `typesetting-v2/core/` (zero Production import today, verified read-only); 25-module boundary map across 12 dependency tiers with zero DOM/React/Canvas/PDF/Renderer/UI/SNS/cloud/AI dependency at any tier; a 12-Loop implementation roadmap (P3-L04–P3-L15, 45–90 min each, none >120 min) from first Core source file to a Canonical Core regression milestone; a deterministic, Core-first test strategy (type-check available today via existing `tsc --noEmit`; Vitest recommended as the sole future test-runner dependency, explicitly gated behind separate Human approval and **not installed by this freeze**); a 20-fixture (F01–F20) technical regression taxonomy kept distinct from the long Human visual-QA prose corpus; every existing Core Invariant (INV-001–INV-013, `CORE_INVARIANTS.md`) mapped to an implementing Loop, none renumbered; every open Phase 3 item (P3-O03/04/05/06 residual/07/08/09/14/15) explicitly staged as non-blocking rather than silently closed; an 8-stage migration plan (A isolated dev → H old-engine retirement, not scheduled) with the old engine preserved unmodified through every stage until an explicit future retirement gate; an explicit first-`src/`-integration entry gate (8 criteria, none satisfied by unit tests alone); Logical/Preview/Publication quality gates kept distinct (Core PASS ⇏ Preview PASS ⇏ Publication PASS); Human QA scoped to exactly one gate inside the roadmap (G1, after P3-L15, logical trace/JSON review only — no renderer exists yet to judge visually). This is a planning-freeze update — **Phase 3 Core engine implementation has not begun.**
- Updated: 2026-09-06 — Phase 3 P3-L02 Canonical Logical Typesetting Core Contract FROZEN for implementation planning (§27): Core/Normalizer/Measurement-Provider/Renderer authority boundaries made explicit (Core decides composition; Renderer never re-decides a break, ruby grouping, or logical position); source addressing fixed at Unicode code-point offsets with grapheme-safe unit boundaries; canonical geometry fixed at integer micrometer ticks (1 tick = 0.001mm, hardened from an initial 0.01mm proposal) with mm as the display/documentation unit only; Japanese character-class/kinsoku rules represented as versioned data, not conditionals; BreakOpportunity/BreakDecision separated (candidate vs. actual, with reasons); ruby ATOMIC/JUKUGO capability frozen, with jukugo segmentation *discovery* explicitly placed upstream of the Core (Normalizer/Logical Analysis, mechanism itself not yet chosen — new Phase 3 open item P3-O14) while the Core only ever honors provided segment boundaries and never guesses a split; ruby class-aware overhang mechanism frozen per HG-4 (exact budget values remain the pre-existing open item); Natural Pitch, decision trace, determinism, versioning, and a structured Warning/Error/HOLD model (Publication approval may be withheld) all made contractual; 12 Core Invariants recorded, plus a 13th precision invariant added at this closeout. This is a documentation/contract freeze — **Phase 3 Core engine implementation has not begun.** New Phase 3 open items P3-O14 (jukugo segmentation mechanism) and P3-O15 (group-ruby's own break-rule, carried from P3-L01) added; neither blocks Core Contract review or a future Core implementation plan.
- Updated: 2026-09-05 — Phase 3 P3-L01 Japanese Rule Freeze Human Gate CLOSED (HG-1–HG-4, §26): kinsoku line-start prohibition for cl-05 middle-dots and cl-12/13 abbreviations set to jlreq's stricter base-level policy as the v2 Core default (superseding legacy looser behavior); jukugo-ruby internal-breakability Core capability approved (Phase 2's atomic mono-ruby/group-ruby behavior retained, not replaced); character-class-aware ruby overhang budgets approved in principle, layered on the retained Phase 2 geometry clamp, with exact numeric budget values deliberately left open pending a future narrower Human decision; the prior invalid "jlreq §3.1.10" dash/ellipsis citation (§19/§24) is corrected — the real rule is verified via jlreq anchors `#cl-08`/`#notes_a3`. Phase 3 Open Items P3-O01/P3-O02/P3-O06 updated accordingly (P3-O01/P3-O06: resolved to Core-Contract-ready with one narrow residual item each; P3-O02: resolved). This is a rule/policy freeze, not Core code — Phase 3 Core implementation has not yet begun.
- Updated: 2026-09-05 — repository/worktree/integration rule clarified
- Updated: 2026-09-05 — Phase 0 Human Decisions frozen (HD-001–HD-009); Editor/Settings switching UI direction added; Memo-in-Editor requirement added; 柱/奥付 font inheritance + override requirement added
- Updated: 2026-09-05 — Phase 1 UI Human QA decision frozen (HD-010–HD-013): Settings-drawer-while-Editor-visible direction selected (existing TateSpun visual identity NOT superseded by prototype visuals); Editor default-horizontal/optional-vertical direction added as a research item; limited/disclosed emoji policy added; image-insert/undo/redo recorded as high-value Editor requirements; Phase 1 jlreq standards-verification caveats (dash/ellipsis citation correction, partial kinsoku-class confirmation) recorded as pre-Phase-3 blockers
- Updated: 2026-09-05 — Final Phase 1 emoji Human QA completed (HD-014): ↶/↷/⏎/⚙️ approved for their stated purposes only (undo/redo/manual-page-break/settings); 💾/🖼/👁/📝/✏️ rejected (future UI must use a text label or proper design-approved icon instead); Phase 1 ready for checkpoint closure
- Updated: 2026-09-05 — Phase 2 Architecture Human Gate approved 7/7 (HD-015–HD-021, §25): C1-NATURAL selected as the PRIMARY PHASE 3 LOGICAL-TYPESETTING-CORE DIRECTION (not a final full architecture — Preview/Publication renderer technology remains OPEN); C3 retained as browser-native control/reference and candidate painting technology, not logical authority; C2 (dedicated shaping) remains DEFERRED/REOPENABLE, not rejected; Natural Pitch (declared physical font size, no forced page-fill stretch) approved as the default v2 composition principle, no preset-specific exception authorized; Manuscript→Logical Core→Canonical Layout Model→Preview/Publication Renderer separation approved; Human-approved Phase 2 Ruby behavior recorded (§25.6) — base-position invariant, unbroken annotation run, geometry-based CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN policy — explicitly not a claim of full JLREQ/JIS ruby standards compliance; Editor Export Profiles added as a new Product Requirement (markup-preserving / plain-posting-friendly / future platform-specific, §25.7); Phase 3 open-item register carried forward (§25.8); Phase 2 CLOSED
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

**GATE-F Human Decision（2026-09-09）:** セッションはEditorを開いた時点で自動開始し、同一タブ内のreload・作品切替をまたいで継続し、タブセッション終了時に終了する。従来のSTART/ENDボタン表現は、この厳密なセッションライフサイクル決定で置き換える。

そのEditorセッション中に行った「総編集文字数」をカウントする機能を追加要件とする。

概念:
- 入力した文字数
- 削除した文字数

を累積し、最終文字数ではなく「そのセッションでどれだけ書いた／消したか」を表す。

例:
100文字入力
50文字削除
30文字入力
→ 総作業文字数 180

Phase 0時点で未確定だった事項（GATE-Fで全項目解決済み）:
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

**GATE-F確定（2026-09-09）:** 単位はUnicode code point。挿入・削除はいずれも正に加算し、置換は削除全文字＋挿入全文字。IME中間更新は0、compositionendの最終commitを一度だけ数え、cancelは0。undo/redoは実際に生じた原稿変化を数える。直接手入力したruby/構造token/画像関連本文は通常計数し、Ruby UIの自動markup変換、専用改ページUI、画像UIの構造token操作は0。明示的な文章チェック修正は数え、解析・無視・辞書/NG設定は0。load/import/normalization/migration/autosave/Preview・組版再構成/Publication生成は0。

永続化は`sessionStorage`のみ。cloud/database/`localStorage`永続化は行わない。UIは既存の原稿文字数と明確に区別し、`このセッションの編集量`と表示する。

**HD-004 (v1.2) 確定事項:**
- paste: 貼り付けた文字数をactivity（typed側）として扱う方向で確定。
- delete / cut: 削除文字数をactivityとして扱う方向で確定。
- `.txt` importおよびprogrammatic normalizationは、通常の執筆activityとは分離する。

上記以外もGATE-F Human Decisionで確定済み（§20.4）。

セッションの編集量結果を明示操作でSNSシェアできるようにする。

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

2026-09-05 Phase 1 UI Human QA Freeze additions (HD-010–HD-013, see §22–§23):

39. Settings opens as a drawer/side panel while Editor remains visible on PC (supersedes §21.1's open tab/mode-button/drawer choice — drawer specifically selected): YES
40. Prototype (ui-c.html) visual design is NOT approved as final — existing TateSpun visual identity (color palette, visual tone, UI language, product character) must be preserved: YES
41. Editor default writing direction remains horizontal (横書き): YES
42. Optional vertical (縦書き) Editor mode is a desired direction, pending Phase 1/2 engineering research into feasibility: YES
43. Limited, deliberate emoji use is permitted in UI, never as the primary icon language; every emoji use must be explicitly disclosed and pass Human QA before Production adoption — no emoji silently carries over from prototype to Production: YES
44. Image insertion, undo, and redo are recorded as high-value, must-remain-easy-to-discover Editor interactions: YES

2026-09-05 Final Phase 1 Emoji Human QA (HD-014, see §24):

45. ↶ (Undo/戻る) approved for that stated purpose only: YES
46. ↷ (Redo/やり直す) approved for that stated purpose only: YES
47. ⏎ (manual page break/改ページ) approved for that stated purpose only: YES
48. ⚙️ (Settings/設定) approved for that stated purpose only: YES
49. 💾 (Save) rejected — future UI uses a text label or design-approved icon instead: YES (rejection confirmed)
50. 🖼 (Image insertion) rejected — future UI uses a text label or design-approved icon instead: YES (rejection confirmed)
51. 👁 (Preview) rejected — future UI uses a text label or design-approved icon instead: YES (rejection confirmed)
52. 📝 (Memo) rejected — future UI uses a text label or design-approved icon instead: YES (rejection confirmed)
53. ✏️ (Editor mode label) rejected — future UI uses a text label or design-approved icon instead: YES (rejection confirmed)

2026-09-05 Phase 2 Architecture Human Gate (HD-015–HD-021, see §25):

54. C1-NATURAL approved as the PRIMARY PHASE 3 LOGICAL-TYPESETTING-CORE DIRECTION (not a final full architecture): YES
55. C3 (browser-native) retained as control/reference and candidate painting technology, not logical-layout authority: YES
56. C2 (dedicated shaping) remains DEFERRED/REOPENABLE, not rejected: YES
57. Natural Pitch (declared physical font size; no forced page-fill stretch; residual space becomes margin) approved as the default v2 composition principle; no preset-specific exception authorized: YES
58. Manuscript → Logical Typesetting Core → Canonical Layout Model → Preview Renderer → Publication Renderer separation approved; final Preview/Publication renderer technology remains OPEN: YES
59. Human-approved Phase 2 Ruby behavior recorded (§25.6) — base-position invariant, unbroken annotation run, geometry-based CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN policy; explicitly NOT a claim of full JLREQ/JIS ruby standards compliance: YES
60. Editor Export Profiles added as a new Product Requirement (markup-preserving / plain-posting-friendly / future platform-specific), specification deferred to Phase 3 (§25.7): YES

2026-09-05 Phase 3 P3-L01 Japanese Rule-Freeze Human Gate (HG-1–HG-4, see §26):

61. HG-1 — kinsoku line-start prohibition for cl-05 (middle dots ・：；): stricter jlreq base-level policy adopted as the v2 Core default, superseding legacy `tategaki.ts` looser behavior: YES
62. HG-2 — kinsoku line-start prohibition for cl-12/13 (pre/postfixed abbreviations): stricter jlreq base-level policy adopted as the v2 Core default: YES
63. HG-3 — jukugo-ruby internal-breakability Core capability approved (Core must be able to represent legal breaks between base-character+ruby-segment pairs within a jukugo-ruby group); Phase 2's Human-approved atomic mono-ruby/group-ruby behavior (§25.6/HD-020) explicitly retained, not replaced: YES
64. HG-4 — character-class-aware ruby overhang budgets approved in principle, layered on top of the retained (not replaced) Phase 2 geometry clamp (§25.6); exact numeric budget/convention values explicitly NOT frozen, left open for a future narrower Human decision: YES (principle only)
65. Dash/ellipsis semantic run-inseparability rule (cl-08) resolved with a corrected primary-source citation, superseding the invalid "jlreq §3.1.10" reference in §19/§24: YES

2026-09-06 Phase 3 P3-L02 Core Contract freeze (see §27):

66. Canonical Logical Typesetting Core Contract (Core/Renderer/Normalizer/Measurement-Provider authority, source model, Japanese rule data model, ruby ATOMIC/JUKUGO capability with segmentation explicitly upstream, Natural Pitch, decision trace, determinism, versioning, Warning/Error/HOLD model, 13 Core Invariants) FROZEN for implementation planning; no new Human Product Decision required — every choice traces to an already-frozen decision or a low-risk engineering default: YES
67. Canonical geometry precision hardened to integer micrometer ticks (1 tick = 0.001mm), superseding the initial 0.01mm proposal: YES
68. Jukugo-ruby segmentation *discovery* placed explicitly upstream of the Core (Normalizer/Logical Analysis); mechanism itself not yet chosen (new open item P3-O14); Core never guesses a segmentation split: YES

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

Phase 1 UI Human QA Freeze:
COMPLETE (2026-09-05) — HD-010 through HD-013 recorded in §22–§23. UI-C's interaction model (Settings drawer, Editor stays visible) selected; its visual design is explicitly NOT final.

Phase 1 Final Emoji Human QA:
COMPLETE (2026-09-05) — HD-014 recorded in §24. ↶/↷/⏎/⚙️ approved for their stated purposes only; 💾/🖼/👁/📝/✏️ rejected. Phase 1 ready for checkpoint closure.

Phase 1 standards-verification status:
SUPERSEDED by Phase 3 P3-L01 (below) for the kinsoku table and dash/ellipsis citation specifically. Originally: OPEN — jlreq dash/ellipsis inseparability citation corrected (previously-cited "§3.1.10" not corroborated, see `typesetting-v2/research/PHASE1_LOOP_LOG.md` P1-L10a); kinsoku character-class table partially confirmed (extends to at least cl-27) but not fully retrieved. This history is preserved for traceability; it is no longer the current status.

Phase 2 Architecture Human Gate:
COMPLETE (2026-09-05) — HD-015 through HD-021 recorded in §25. C1-NATURAL approved as the Phase 3 logical-typesetting-core direction (not a final full architecture); C3 retained as control/reference; C2 deferred/reopenable; Natural Pitch approved as default; renderer separation approved; Human-approved Ruby behavior recorded; Editor Export Profiles added as a new Product Requirement. Full evidence: `typesetting-v2/docs/architecture/PHASE2_ARCHITECTURE_NARROWING.md`, `PHASE2_EVIDENCE_SUMMARY.md`. Phase 2 CLOSED.

Phase 3 P3-L01 Japanese Rule-Freeze Human Gate:
COMPLETE (2026-09-05) — HG-1 through HG-4 recorded in §26. Full jlreq cl-01–cl-30 kinsoku class table and TateSpun-relevant break rules directly verified from the primary source; dash/ellipsis cl-08 inseparability rule recovered with a corrected citation (the old "§3.1.10" reference is retired, not merely re-flagged); kinsoku conformance-level defaults (cl-05, cl-12/13) set to jlreq's stricter base level; jukugo-ruby internal-breakability Core capability approved (Phase 2's atomic ruby behavior retained); ruby class-aware overhang approved in principle only, exact numeric budgets deliberately left open. Full evidence: `typesetting-v2/docs/standards/PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md`, `P3_KINSOKU_RULE_FREEZE_CANDIDATE.md`, `P3_DASH_ELLIPSIS_RULE_FREEZE_CANDIDATE.md`, `P3_RUBY_STANDARDS_REVIEW.md`, `typesetting-v2/research/phase3/P3_L01_PRIMARY_SOURCE_LEDGER.md`, `typesetting-v2/research/PHASE3_LOOP_LOG.md`. This is a rule/policy freeze only — **Phase 3 Core implementation has not begun.**

Phase 3 P3-L02 Core Contract:
FROZEN for implementation planning (2026-09-06) — see §27. No Human Gate was required (every design choice was either a restatement of an already-frozen decision or a low-risk, evidence-backed engineering default). Full documents: `typesetting-v2/docs/core/TATESPUN_V2_CORE_CONTRACT.md`, `TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md`, `CORE_RESPONSIBILITY_MATRIX.md`, `CORE_INVARIANTS.md`. **Phase 3 Core engine implementation has NOT begun** — this is a contract/data-model freeze only.

Next authorized action:
Phase 3 — Core Implementation Plan (P3-L03), building against the frozen Core Contract (§27) and informed by `typesetting-v2/docs/architecture/PHASE3_OPEN_ITEMS.md` (P3-O01/P3-O02/P3-O06 resolved or narrowed to Core-Contract-ready; P3-O14/P3-O15 newly added and non-blocking; remaining items are Renderer-level, Publication/Preview-technology, or Editor-side).

Not yet authorized:
- Engine v2 implementation in `src/` (Phase 3 begins in `typesetting-v2/` per §13, same as prior phases)
- production integration
- final Preview/Publication renderer technology selection (§25.5 separates this from the logical-core direction just approved)
- master push/deploy
- current production replacement
- UI implementation mechanism selection for Memo access (panel / drawer / modal / floating window — see §21.2, still undecided)
- Visual/pixel-level design of the drawer, or any other Production UI surface (see §22.1 — interaction model only is approved)
- Vertical Editor mode implementation (see §22.2 — research direction only, not implementation)
- Any specific emoji's Production use (see §23 — disclosure + Human QA required per use, never blanket-approved)
- Editor Export Profiles implementation (§25.7 — requirement recorded only, full specification is Phase 3 open item P3-O11)
- Full JLREQ/JIS standards freeze in the broadest sense: P3-O01 (900-cell pairwise grid, low-impact residual), P3-O06's exact ruby-overhang numeric budget values, and P3-O07 (TCY auto-detection threshold) remain open — P3-O01's class table/break rules and P3-O02 (dash/ellipsis) are now resolved, and P3-O06's capability-level questions (HD-Q1/HD-Q2) are now resolved, per §26
- Phase 3 Core engine code itself (this Rule Freeze Gate is policy/documentation only, per §26 — no Canonical Layout Model implementation exists yet)

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

以下はGATE-F Human Decision（2026-09-09）で確定済み:
- Unicode code-point単位、挿入＋削除の正のactivity
- IMEは中間0、最終commit一度、cancel 0
- undo / redo / replace / select-all deleteは実際の削除＋挿入
- rubyの直接入力とuser-entered readingは計数、自動markup変換は0
- 改ページ・画像の専用UI構造token操作は0、文字としての直接入力は計数
- 明示的Writing Check修正は計数、解析・無視・辞書/NG設定は0
- 同一タブのEditor sessionとして`sessionStorage`のみで保持

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

# 22. PHASE 1 UI HUMAN QA FREEZE (v1.3)

2026-09-05時点で、Phase 1 UI比較のHuman QAによりHD-010〜HD-011を承認済み。
これらはinteraction-model/product requirementの確定であり、visual designや実装方式の選定ではない。

## 22.1 HD-010 — Settings Drawerモデル

Human Product OwnerはPC向けUI比較で **UI-C（設定ドロワー型）** のinteraction structureを選択した。

理由：作業中の原稿を見ながら設定を変更できることを高く評価。

承認された要件：
- Editorが常にprimary workspaceであり続ける
- SettingsはEditor全体を置き換えるのではなく、PC上でEditorの上／横に重なる形で開く
- Settingsを閉じると即座に執筆に戻れる
- Settingsを開いたことによってEditorのstate／scroll位置／カーソル位置が失われない
- MemoはEditorから直接アクセス可能なまま維持する
- Previewへのアクセスが明確であり続ける

**重要：Phase 1のui-c.htmlプロトタイプの見た目（配色・トーン・UI言語）はfinal designとして承認されていない。**
承認されたのは「Editorを表示したままSettingsをdrawer/side panelとして開く」というinteraction modelのみである。

最終UIは既存TateSpunの以下を維持すること：
- 配色（color palette）
- 視覚的トーン（visual tone）
- UI言語
- プロダクトアイデンティティ
- 全体的なデザイン性格

drawer方式のinteraction modelを採用するのであって、プロトタイプのvisual skinを採用するのではない。

## 22.2 HD-011 — Editor執筆方向（横書き／縦書き）

現行TateSpunのEditorは基本的に横書きである。

承認された製品方向：

- **デフォルト：横書きEditor**
- **将来的に望ましいoptional mode：縦書きEditor**

ユーザーが理想的にはEditor自体の書字方向（横書き／縦書き）を選べることを目指す。

これはPublication Output側の書字方向（常に縦書き前提）とは独立した、Editor UIの話である。
「出力が縦書きだからEditorも縦書きでなければならない」という前提は置かない。

Phase 1/2 engineering researchが明らかにすべき事項：
- 横書きEditorと縦書きEditorが同一のmanuscriptモデルを共有できるか
- 縦書きmodeでcursor／selection／IME挙動が信頼できるか
- 方向切替時にediting position/contentを保持できるか
- mobileへの影響
- accessibilityへの影響
- 縦書きEditor modeをoptionalとして安全に提供しても、Canonical Layoutに影響しないか

まだ実装しない。研究方向として記録するのみ。

---

# 23. LIMITED EMOJI POLICY (v1.3, HD-012)

TateSpun UIは限定的かつ意図的な範囲でemojiを使用してよい。

許容され得る例：
- ⚙ Settings用
- ↩️ 等、Undo／Back系アクション用

ただし：
- emojiを過度に使用しない
- emojiがインターフェースの主要な視覚言語にならない
- プロトタイプおよびProduction UI提案で使用された全emojiは、その目的とともに明示的に開示する
- 各emoji使用はProduction採用前にHuman QAを通過すること

一般的なUI表現として引き続き優先されるもの：
- テキストラベル
- 正式なicon asset
- SVG／iconコンポーネント
- デザイン承認済みの画像

emojiは包括的なiconシステムではなく、選択的な例外として許容される。

**重要：プロトタイプで使われたemojiがProductionへ無断で引き継がれることを禁止する。**

emojiを使用する場合、必ず：
1. 使用した正確なemojiを列挙する
2. 使用箇所（画面／場所）を列挙する
3. 何を表しているかを説明する
4. HUMAN-QA-REQUIREDと明記する
5. Human QA通過までは承認済みとして扱わない

このルールはprototype／将来のEngine v2 UI／Production統合すべてに適用する。
ユーザーが執筆する原稿本文の内容には適用されない。

---

# 24. FINAL PHASE 1 EMOJI HUMAN QA (v1.4, HD-014)

2026-09-05、Product OwnerはPhase 1 UIプロトタイプに現れる全emojiについて、個別にAPPROVED／REJECTEDを判定した。

## APPROVED（記載の用途に限定して承認）

| Emoji | 用途 | 判定 |
|---|---|---|
| ↶ | Undo／戻る | APPROVED |
| ↷ | Redo／やり直す | APPROVED |
| ⏎ | 改ページ（manual page break） | APPROVED |
| ⚙️ | 設定（Settings） | APPROVED |

## REJECTED（将来のUIではtext labelまたはdesign-approved iconを使用すること）

| Emoji | 用途 | 判定 |
|---|---|---|
| 💾 | 保存（Save） | REJECTED |
| 🖼 | 挿絵挿入（Image insertion） | REJECTED |
| 👁 | プレビュー（Preview） | REJECTED |
| 📝 | メモ（Memo） | REJECTED |
| ✏️ | Editor切替ラベル | REJECTED |

## 適用範囲

- 上記4件のAPPROVEDは、記載された用途に限定した承認であり、他の用途への一般化を禁止する。
- 上記5件のREJECTEDは、将来のUIでtext labelまたは正式なdesign-approved iconに置き換えること。
- 一般原則（§23 Limited Emoji Policy）は引き続き有効：emojiは選択的にのみ使用し、UIの主要言語にしない。新規に提案されるemojiは、その都度開示とHuman QAを要する。

---

# 25. PHASE 2 ARCHITECTURE NARROWING FREEZE (v1.5, HD-015–HD-021)

2026-09-05、Product OwnerはPhase 2 Architecture Human Gate（7項目）を全て承認した。
これはPhase 3のLOGICAL-TYPESETTING-CORE方向の確定であり、最終的な完全アーキテクチャの選定ではない。

Full evidence: `typesetting-v2/docs/architecture/PHASE2_ARCHITECTURE_NARROWING.md`（recommendation + comparison matrix）, `PHASE2_EVIDENCE_SUMMARY.md`（loop-by-loopエビデンス）, `typesetting-v2/research/PHASE2_LOOP_LOG.md`（P2-L01〜P2-L08、生ログ）。

## 25.1 HD-015 — C1-NATURAL: Phase 3 Logical-Typesetting-Core Direction

C1-NATURAL（explicit deterministic logical layout + natural 1em declared-pitch composition + residual margin + renderer separation）を、**PRIMARY PHASE 3 LOGICAL-TYPESETTING-CORE DIRECTION**として承認する。

意味：
- TateSpunがpage/column/line/logical unit/source range/break decision/ruby association/TCY group/deterministic coordinatesの決定権を持つ。
- 決定はrendering前に行われ、再現可能・source-mapped・traceableである（Phase 2 P2-L05で実証済み）。

**「C1-NATURALが最終的な完全アーキテクチャである」とは書かない。** Preview/Publication rendererの技術選定は引き続きOPEN（§25.5, Phase 3 open item P3-O08/P3-O09）。

## 25.2 HD-016 — C3: Control / Reference

C3（browser-native）は、CONTROL/REFERENCEとして維持する。将来のPreview/Publication renderer技術の候補にはなり得るが、logical typesetting authorityとしては承認しない。

C3は「rejected」ではない。視覚品質が高い場合があることは記録するが（例：B5, Web閲覧用でのHuman選好）、TateSpunが必要とするdeterministic・source-mapped・traceableな組版決定を提供しない、という理由による。

## 25.3 HD-017 — C2: Deferred / Reopenable

C2（dedicated shaping, HarfBuzz-via-WASM経路）は、DEFERRED/REOPENABLEとする。rejectedではない。

Reopen条件：
- C1/browser paintingでは達成できない必須のglyph-level挙動が判明した場合
- Publication PDF pathがdedicated shaping evidenceを必要とする場合
- 将来の機能が、他の方法では得られないshaping controlを要求する場合

## 25.4 HD-018 — Natural Pitch as Default Composition Principle

Natural Pitch（宣言されたphysical font sizeがそのままnatural character advanceになる。版面を埋めるためだけの伸縮をしない。余白は版面余白として残ってよい）を、v2のDEFAULT composition principleとして承認する。これはMaster §5.2の既存原則の具体化であり、新原則ではない。

**Preset-specific optical pitch tuningは一切authorizeしない：**
- 文庫-specific multiplier: NO
- B5-specific correction: NO
- 新書 midpoint: NO
- その他preset別の目視補正: NO

文庫でのHuman-observed mild preference for legacy justified pitch（P2-L04, stretch比約1.05×）は、エビデンスとして記録するのみであり、preset-specific exceptionの承認を意味しない。

## 25.5 HD-019 — Renderer Separation

以下のpipelineをapprove：

```
Manuscript
→ Logical Typesetting Core
→ Canonical Layout Model
→ Preview Renderer
→ Publication Renderer
```

Preview / Publication rendererは異なる技術を使用してよい。ただしcanonical logical結果を共有し、pixel-perfect一致は不要（Master §1.2/§1.3と整合）。ただし「別の本」に見える差は許容しない、という既存原則は変わらない。

Logical layout authorityはrenderer paintingより上流にある。Preview rendererの技術（Phase 5, P3-O09）およびPublication rendererの技術（Phase 4, P3-O08）は、引き続きOPENである。

## 25.6 HD-020 — Ruby: Human-Approved Phase 2 Product/Renderer Behavior

Phase 2 (P2-L07〜P2-L07E) で検証・承認されたRuby挙動を記録する。**これはHuman-approved Phase 2 Product/Renderer behaviorであり、JLREQ/JIS ruby distribution標準への完全準拠を意味しない。** 最終的なruby overflow/distribution標準のレビューはPhase 3 open item（P3-O06）として残る。

**Base invariant:** rubyの存在はbody text位置を一切変更しない。Human検証済み（実際のrendered DOM測定、`getBoundingClientRect`）：東京（とうきょう）の東・京、それぞれmain-axis delta 0.00px / cross-axis delta 0.00px。PASS。

**Unbroken annotation run:** 1つのruby logical groupは1つの途切れないannotation runとして描画される。ruby annotationはbody flowの外側（position:absolute相当）にあり、body layoutに影響を与えない。PASS。

**Overlong ruby — geometry-based centering:** ruby annotationの物理的extentがbase groupの物理的extentを超える場合、base-group中心に対してcenteringする。`baseLength == 1`等の特殊分岐は用いない（純粋にgeometry — base extent, ruby extent, line/column extentから導出）。

**Boundary policy:**
- CENTER — centering後もline/column extent内に収まる場合
- START_CLAMP — centeringするとline/column始端を越える場合、始端に固定
- END_CLAMP — centeringするとline/column終端を越える場合、終端に固定
- OVERFLOW_OPEN — ruby annotation自体がline/column extentに収まらない場合（縮小・分割・wrapはしない。厳密な扱いはOPEN）

Human PASS：CENTER, START_CLAMP, END_CLAMP, 其（なにがし）。

## 25.7 HD-021 — Editor Export Profiles (New Product Requirement)

Editor text exportにおいて、少なくとも以下2つのprofileを選択できることを、新しいProduct Requirementとして承認する。詳細仕様はPhase 3 open item（P3-O11）として別途行う。

- **Profile A — 記法あり / markup-preserving**: Markdown/TateSpun記法を保持し、再編集・別editorへの移行を可能にする。
- **Profile B — プレーンテキスト / 投稿向け**: pixiv等への投稿を想定し、不要なMarkdown風記法を除去する。
- **Profile C（将来）— platform-specific export profiles**: pixiv等特定サイト向け変換。Phase 2では実装・約束しない。future-capable設計のみ。

TXT import/export（Master §9.1, 既存承認済み要件）とExport Profile（記法変換）は別概念である。同一原稿が、どちらのprofileを経てもTXT transport formatとして書き出せる。

詳細: `typesetting-v2/docs/architecture/EDITOR_EXPORT_PROFILES_MEMO.md`

## 25.8 Phase 3 Open Items — Carried Forward

Full register: `typesetting-v2/docs/architecture/PHASE3_OPEN_ITEMS.md`（P3-O01〜P3-O13）。要点：

- **標準未確定（Phase 3 rule freeze前に解決必須）**: full kinsoku class table (P3-O01), dash/ellipsis authoritative primary-source rule (P3-O02), ruby final overflow/distribution standards (P3-O06), TCY auto-detection Product policy (P3-O07)。
- **Renderer-level（Human Owner明示的にPhase 3へ delegate、Architecture Narrowingのblockerではない）**: TCY visual renderer (P3-O03), dash final alignment (P3-O04), ellipsis final alignment (P3-O05)。
- **Publication/Preview technology（引き続きOPEN, Master §7 white-sheet rule）**: Publication PDF renderer選定 (P3-O08), Preview renderer実装 (P3-O09)。
- **Editor側（Typesetting Engine coreの範囲外）**: Editor vertical-mode feasibility (P3-O10), Editor Export Profiles full specification (P3-O11)。

これらはいずれもPhase 3開始のblockerではない。各々「何の前に解決が必要か」をPHASE3_OPEN_ITEMS.mdに明記する。

---

# 26. PHASE 3 P3-L01 JAPANESE RULE FREEZE (v1.6, HG-1–HG-4)

2026-09-05、Product OwnerはPhase 3 P3-L01（日本語組版標準の一次資料調査）で提起された4件のHUMAN_GATE項目全てを承認した。これはPhase 3 Coreが実装すべきルール・ポリシーの確定であり、Core実装そのものの完了を意味しない。

Full evidence: `typesetting-v2/docs/standards/PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md`、`P3_KINSOKU_RULE_FREEZE_CANDIDATE.md`、`P3_DASH_ELLIPSIS_RULE_FREEZE_CANDIDATE.md`、`P3_RUBY_STANDARDS_REVIEW.md`、一次資料台帳 `typesetting-v2/research/phase3/P3_L01_PRIMARY_SOURCE_LEDGER.md`、生ログ `typesetting-v2/research/PHASE3_LOOP_LOG.md`（P3-L01-A〜D、Human Gate closeout）。

## 26.1 HG-1/HG-2 — Kinsoku conformance-level defaults

**HG-1（cl-05、中点類 ・：；の行頭禁則）**: jlreqのbase-level（最も厳格な既定水準）の行頭禁則をv2 Coreの既定値として採用する。現行`tategaki.ts`のより緩い挙動（行頭禁則対象外）は、legacy比較用の記録としてのみ保持し、v2既定値としては引き継がない。

**HG-2（cl-12/13、前置・後置省略記号 ￥＄￡＃ / °′″℃￠％‰の行頭禁則）**: 同様にbase-levelの行頭禁則をv2 Coreの既定値として採用する。

両決定は、jlreqが公式に提示している複数の正当な準拠水準（"very loose"/"loose"等）のうちどれをTateSpunが採用するかというPRODUCT_POLICY判断であり、STANDARD_BACKEDな根拠（jlreq `#addendum_a3`）の上に成り立つ。「jlreqがTateSpunのこの具体的構成を強制している」という主張ではない。

## 26.2 HG-3 — Jukugo-ruby internal breakability (Core capability)

熟語ルビ（jukugo-ruby）グループ内部で、親文字1字とそれに対応するルビ・セグメントの組同士の間に改行機会を表現できるCore capabilityを承認する。これはjlreq cl-23の規定（`#notes_a3` id597）に基づく。

**重要な限定**：「ルビはどこでも分割してよい」という意味ではない。Phase 2でHuman承認済みのモノルビ・グループルビの「1つの途切れない注釈ラン」挙動（§25.6/HD-020）はそのまま維持し、上書きしない。データモデルの具体的な形はPhase 3 Core Contract（P3-L02）へ委ねる。

## 26.3 HG-4 — Character-class-aware ruby overhang (principle only)

隣接文字クラスに応じたルビの掛かり量（オーバーハング）の予算を、既存の（維持される）Phase 2ジオメトリ境界クランプ（CENTER/START_CLAMP/END_CLAMP/OVERFLOW_OPEN、§25.6）に重ねて導入する、という**原則**を承認する。本文位置不変の原則（ルビは本文を動かさない）も維持する。

**具体的な数値・慣例は本決定では凍結しない**。jlreqは同じ状況に対して複数の正当な慣例（例：漢字への掛かりを「禁止」とするか「ルビ文字サイズの半角まで許容」とするか）を並記しており、どちらか一方を無断で選択することはしない。この点は`PHASE3_JAPANESE_RULE_FREEZE_MATRIX.md`の行22bとして引き続きOPENとし、将来の、より狭い範囲のHuman決定を要する。

## 26.4 Dash / ellipsis citation correction

Master §19/§24で記録されていた「jlreq §3.1.10」という引用は、本ループにより誤りであることが確定した（この版のjlreqには番号付き条項体系そのものが存在しない）。分離禁止文字（cl-08：EM DASH／HORIZONTAL ELLIPSIS／TWO DOT LEADER）の実際の規則は、jlreqのアンカー`#cl-08`／`#notes_a3`から一次資料で直接検証済みである。今後この規則を参照する場合は、この訂正後のアンカー引用を用いる。

## 26.5 Scope note

本§26はPhase 3のルール・ポリシー凍結であり、Canonical Layout ModelのCore実装そのものではない。Phase 3 Core Contract（P3-L02）は本§26の内容を前提として開始できる状態にあるが、実装コードは本更新の時点で一切作成されていない。

---

# 27. PHASE 3 P3-L02 CANONICAL LOGICAL TYPESETTING CORE CONTRACT (v1.7)

2026-09-06、Phase 3 P3-L02によりCanonical Logical Typesetting Core Contractが確定した。これはCore実装が完了したことを意味しない — **Phase 3 Coreのエンジン実装はまだ開始されていない。** 本節はContractの内容を承認・記録するものである。

Full evidence: `typesetting-v2/docs/core/TATESPUN_V2_CORE_CONTRACT.md`（32節＋8ケースの検証付録）、`TATESPUN_V2_CORE_DATA_MODEL_CANDIDATE.md`（疑似コード）、`CORE_RESPONSIBILITY_MATRIX.md`（責任分界）、`CORE_INVARIANTS.md`（INV-001〜INV-013）、生ログ `typesetting-v2/research/PHASE3_LOOP_LOG.md` P3-L02。

## 27.1 Core / Renderer / Normalizer / Measurement Provider の権限境界

C1-NATURAL（§25.1、既承認、本節では再検討しない）に基づき、以下を確定する：

- **Logical Core**は、page/column/line構造、break決定、日本語組版規則の適用、ruby/TCY/dash/ellipsisの論理単位、source-mapped配置単位、決定論的な正準座標、およびlayout decision traceを所有する。
- **Renderer**（Preview／Publication）は、すでに確定した配置の描画方法のみを所有する。Renderer は break決定・ruby分割・論理位置を独自に変更してはならない。
- **Normalizer**（Core上流）は、TateSpun記法の認識（ルビ記法、手動改ページマーカー、画像マーカー）、source span生成、意味的正規化を担う。
- **Measurement Provider**は、版のフォント測定・ルビ読み幅・画像固有サイズ等の事実を、バージョン管理された入力として供給する。Rendererが独自に再測定してlayoutを変更することは禁止する（INV-009）。

## 27.2 Source addressing / grapheme安全性

Source Spanのオフセット単位はUnicodeコードポイントとする（UTF-16コード単位でもgraphemeクラスタ単位でもない、意図的な決定）。LogicalUnitの境界は、拡張grapheme クラスタ境界より細かく分割してはならない（サロゲートペア・結合文字列・異体字セレクタ・絵文字ZWJシーケンスを破壊しない、INV-011）。

## 27.3 正準ジオメトリ精度（0.001mm整数ティック）

Canonical Layoutの物理ジオメトリ（座標・送り・行/段の範囲・ルビ範囲・残余スペース）は、**整数マイクロメートル・ティック（1ティック＝0.001mm）**として正準的に保持する。当初提案されていた0.01mmから、出版品質を最優先するMaster §3の原則に基づき精度を強化した。表示・診断用途では"mm"表記を用いてよいが、それは正準保存値ではない（INV-013）。Renderer側でのtick→px／tick→pt変換は、Renderer自身の描画境界でのみ行い、その変換結果がCanonical Layoutの決定にフィードバックされてはならない。

## 27.4 日本語文字クラス／禁則のデータ駆動表現

cl-01〜cl-30の文字クラス、HG-1／HG-2で確定した行頭禁則既定値、cl-08の分離禁止ペア規則、ぶら下げ組の適用範囲（cl-06／cl-07）は、すべて`RuleSetVersion`としてバージョン管理されたデータで表現し、`if (char === ...)`のような条件分岐の連鎖にしない。

## 27.5 BreakOpportunity と BreakDecision の分離

「ここで改行しうるか（候補）」と「実際にどこで改行したか（決定）」を明確に分離したモデルを確定する。将来のDecision Traceにおいて「ここでの改行は検討されたが、Xの理由で却下された」という説明が可能になる。

## 27.6 Ruby: ATOMIC／JUKUGO capability と segmentation の権限境界

Master §26.2（HG-3）で承認されたjukugo-ruby internal breakability capabilityを、Core Contract上で以下のように明確化する：

- **Coreの責務**：すでに提供された`segments`配列（親文字セグメントと対応するルビセグメントの組）を尊重し、セグメント間の境界を`RUBY_INTERNAL_ALLOWED`、セグメント内部を`RUBY_INTERNAL_PROHIBITED`として扱う。
- **Coreの責務ではないもの**：熟語の読みをどこで親文字ごとに分割するか（segmentation）を言語的に発見すること。これはCoreより上流のNormalizer／Logical Analysisの責務であり、その具体的な仕組み（明示的記法／決定的ローカルパーサ／辞書補助ローカル解析等）は本節では選定しない。ネットワーク・外部AI処理は使用しない（Master §12.1／§20.3）。
- `segments`が提供されない熟語ルビ候補は、**ATOMIC（分割不可）として扱う**。Coreがsegment境界を無断で推測することはない。
- この境界の未決定は、Core ContractレビューやCoreスケルトン実装を妨げない。新規Phase 3 open item **P3-O14**（jukugo-ruby segmentation policy/analyzer）として記録する。

グループルビ（グループルビ）固有の分割規則は、P3-L01で概念のみ確認され規則が未特定のまま、新規Phase 3 open item **P3-O15**として引き続きOPENとする（既存のP3-O06/HD-Q4の残課題である正確なルビ掛かり量の数値予算とは区別する）。

## 27.7 Natural Pitch / Decision Trace / Determinism / Versioning / Warning-Error-HOLD

以下をContract上で確定する（いずれもMaster既存原則の具体化であり、新原則ではない）：

- Natural Pitch（§18）はデフォルトの組版原則であり、版面を埋めるための伸縮は行わない。余白は`residualSpaceTick`として明示的に保持する。
- Decision Trace（§23）は、source range・適用規則・代替案・採否理由を記録するエンジンエビデンス契約である。
- Determinism（§24）は、同一の正規化済み原稿・設定・RuleSetVersion・MeasurementFactsから同一の論理レイアウトが得られることを要求する。Renderer側のラスタライズ差異はこれを損なわない。
- Versioning（§25）は、`coreSchemaVersion`／`ruleSetVersion`／`settingsVersion`／`measurementIdentity`をCanonical Layout出力に含めることを要求する。
- Warning／Error／HOLDモデル（§26）は、未解決の重大なlayout条件がある場合、Publication承認を保留（HOLD）できることを要求する。沈黙のフォールバックは禁止する。

## 27.8 Core Invariants

`CORE_INVARIANTS.md`にINV-001〜INV-013として記録する。追加されたINV-013（精度不変条件）を含め、いずれもCore実装が将来にわたって遵守すべき性質であり、変更する場合はDecision Record（Master §16）を要する。

## 27.9 Human Gate

本Core Contractの確定にあたり、新規のHuman Product Decisionは不要であった。すべての設計判断は、既に確定済みのMaster／P3-L01決定の具体化、またはリスクの低いエンジニアリング上の既定選択（根拠付き）である。真に未解決な項目（P3-O14、P3-O15、既存のP3-O06残課題、P3-O07、P3-O12）は、Core Contractの完成を妨げるものではなく、そのまま繰り越す。

## 27.10 適用範囲

本節はContractの確定であり、Canonical Logical CoreのCore実装そのものではない。Phase 3 Core Contractは、次のCore Implementation Plan（P3-L03）の開始条件を満たす状態にあるが、実装コードは本更新の時点で一切作成されていない。

---

# 28. PHASE 3 P3-L03 CANONICAL CORE IMPLEMENTATION PLAN FREEZE (v1.8)

2026-09-06、Phase 3 P3-L03によりCanonical Core Implementation Planが確定した。これは§27で凍結されたContractの実装計画の承認であり、**Core実装コードは本更新の時点で一切作成されていない。**

Full evidence: `typesetting-v2/docs/implementation/P3_CORE_IMPLEMENTATION_PLAN.md`、`CORE_MODULE_MAP.md`、`P3_CORE_LOOP_ROADMAP.md`、`CORE_TEST_STRATEGY.md`、`CORE_MIGRATION_ROLLBACK_PLAN.md`、`CORE_IMPLEMENTATION_RISK_REGISTER.md`、生ログ `typesetting-v2/research/PHASE3_LOOP_LOG.md` P3-L03。

## 28.1 実装配置

Core実装は`typesetting-v2/core/`に隔離配置する（計画のみ、ディレクトリ未作成）。既存の`src/`はこのパスを一切参照しておらず（読み取り専用調査で確認済み）、リポジトリ既存の`tsc --noEmit`が追加設定なしにこの配置を型検査できる。Production統合は§28.9の明示的ゲートを経るまで発生しない。

## 28.2 モジュール境界と依存方向

Contract（§27）の各節・`CORE_RESPONSIBILITY_MATRIX.md`の各行に対応する25モジュール、12依存層のDAGとして計画する。Coreはいかなる層においてもDOM／React／Canvas／PDFライブラリ／Renderer実装／UI状態／SNS／クラウド／外部AI／ネットワーク原稿処理に依存しない。単一の巨大`typesettingEngine.ts`は作らない。

## 28.3 実装ロードマップ

P3-L04（Core Foundation）からP3-L15（Canonical Regression Suite / 8-preset論理検証、マイルストーン）まで、12個の独立したLoopとして計画する。各Loopの上限は90分、いかなるLoopも120分を超えて不透明に継続しない。各Loopはテスト・スコープ監査・（該当する場合のみ）Human Gate・チェックポイントコミットで終える。P3-L04／L05／L06のような複数Loopを単一の実装タスクに統合しない。

## 28.4 テスト戦略とVitex依存ゲート

Core実装は決定論的な単体テスト・フィクスチャテスト・正準構造出力テスト・source-span／break-decision／trace／GeometryTick／HOLD／determinismテストを優先し、スクリーンショット・ブラウザラスタテスト・ヘッドレスブラウザを要求しない。現時点で専用テストランナーは未導入（`tsc --noEmit`のみ利用可能）。将来のテストランナーとしてVitestを推奨するが、**本凍結時点で導入は行っていない**。Vitest導入（`package.json`／lockfile変更を伴う）は、P3-L04開始時に別途明示的なHuman承認を要する独立したDependency Gateとして記録する。

## 28.5 フィクスチャ分類

F01〜F20の技術的回帰フィクスチャ分類（平叙文・行頭/行末禁則・cl-05／cl-12/13厳格方針・ぶら下げ・atomic/group ruby・jukugo ruby・overlong ruby・TCY・dash/ellipsis run・手動改ページ・画像・二段組・Unicode/grapheme安全性・HOLD・容量/残余・複数ページ長文・正準回帰文）を確定する。既存の長文Human視覚QA原稿コーパス（`REGRESSION_CORPUS_SPEC.md`）は、これとは別個に維持し、短い技術的フィクスチャで置き換えない。

## 28.6 Invariantマッピング

`CORE_INVARIANTS.md`のINV-001〜INV-013すべてを、実装するLoopに対応付ける。既存IDは変更しない。INV-002／INV-009はRendererが存在するまで構造的に（違反しうるコードが存在しないことで）担保され、Renderer実装段階で実テスト化する。

## 28.7 Measurement戦略

初期Core実装は決定論的なfake/reference MeasurementFactsプロバイダを用いる。実測技術（DOM／Canvas／HarfBuzz／WASM／PDFライブラリ等）は本計画では選定しない。RendererがCanonical Layoutを再測定・再フローすることは禁止する（INV-009）。

## 28.8 Open Item staging

P3-O03（TCY visual renderer）、P3-O04／O05（dash/ellipsis visual alignment）、P3-O06残課題（正確なruby overhang数値）、P3-O07（TCY自動判定）、P3-O08（Publication/PDF renderer）、P3-O09（Preview renderer）、P3-O14（jukugo segmentation policy）、P3-O15（group-ruby固有規則）は、いずれもCore skeleton実装を妨げない非ブロッキング項目として、将来のステージに明示的に割り当てる。これらを実装の都合で沈黙のうちにクローズしない。

## 28.9 移行・統合ゲート・ロールバック

Stage A（隔離開発）からStage H（旧エンジン退役、未スケジュール）までの8段階移行計画を確定する。旧TateSpunエンジンは、明示的な将来の退役ゲートまで、いかなるステージにおいても変更されず利用可能なまま維持する。最初の`src/`統合は、単体テストのPASSのみでは発生しない — Core invariantスイートPASS、必須論理機能の網羅、決定論的複数ページフィクスチャPASS、source mapping PASS、重大HOLDの沈黙的な格下げがないこと、比較アダプタ計画の存在、ロールバック経路の存在、統合開始への明示的Human承認、の8条件をすべて満たすことを要する。Loop単位のロールバック（各Loopのチェックポイントへの復帰）とProduct単位のロールバック（旧エンジン温存）を区別して維持する。

## 28.10 品質ゲートの分離

LOGICAL CORRECTNESS（Core）、VISUAL PREVIEW QUALITY（Preview）、PUBLICATION OUTPUT QUALITY（Publication）を独立した3つのゲートとして維持する。Core PASSはPreview PASSを意味せず、Preview PASSはPublication PASSを意味しない。Publication QualityはProductの最優先事項であり続ける（Master §3）。

## 28.11 Human Gate

本Implementation Plan自体の確定にあたり、新規のHuman Product Decisionは不要であった（既存Contract／Invariantの具体化、または低リスクな工学的既定選択のみ）。ロードマップ内で計画されるHuman Gateは、P3-L15終了後のG1（論理trace／Canonical出力のレビューのみ、視覚的判断は含まない）の1件のみであり、将来のPreview／Publication renderer段階のHuman視覚QAとは明確に区別する。

## 28.12 適用範囲

本節はImplementation Planの確定であり、Core実装そのものではない。P3-L04（Core Foundation）は、Vitest導入のDependency Gateが別途解決された後に開始できる状態にあるが、実装コードは本更新の時点で一切作成されていない。

---

---

# 29. BETA PRE-INTEGRATION DEVELOPMENT CHECKPOINT (2026-09-09)

Without modifying Production `src/`, the isolated v2 Human E2E Editor now carries the Human-decision-free UI/product shell needed for consolidated review:

- UI-C right-side Settings drawer while the horizontal Editor remains mounted and visible;
- direct local Memo access;
- local-only 完成前マイチェックリスト with editable presets/personal reusable sets and no cloud/external transmission;
- undo/redo/manual page-break actions using only their individually approved symbols;
- current development manuscript/settings → existing v2 bridge → Canonical PaintPlan → browser Web/print JPG (single first page or all-page ZIP).

Status: **IMPLEMENTED / HUMAN QA PENDING** in development. Production Editor adoption, Writing Check visual polish, Help top TOC, TOC-dialog polish, and final export-button migration are **PRODUCTION INTEGRATION GATE** under the run's no-`src/` rule. Browser-native PDF remains **HUMAN_GATE / PRODUCTION INTEGRATION GATE** because the current vector PDF/font/image executor uses Node `Buffer`; the development Editor retains its local Vite API and does not invent a new server architecture.

Evidence: `typesetting-v2/qa/evidence/BETA_PRE_INTEGRATION_AUTONOMOUS_AUDIT.md`. Consolidated Human QA: `typesetting-v2/qa/HUMAN_QA_PRE_INTEGRATION.md`.

---

END OF MASTER
