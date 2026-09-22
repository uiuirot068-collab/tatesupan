# TateSpun Combined Beta RC Scope — 2026-09-23

Status: **SCOPE LOCKED / NOT RELEASED**

This document fixes the scope of the next combined beta Release Candidate. It describes changes relative to the current production baseline; it is not a production-deploy authorization.

## Included in this RC

- **B1 Review Hub / 見直し**
  - 文章チェックβ、作業カウンター、音読β、描写・修飾チェックβを見直し導線に集約。
- **B2 Review footer customization**
  - フッター表示は最大2機能。
  - 機能のON/OFFとフッター表示を分離。
  - 端末ローカル設定。既存の内部 `character-count` キーは作業カウンターの移行キーとして維持。
- **B3 Review feedback survey**
  - 既存の報告経路内。新しい解析基盤・原稿本文送信は追加しない。
- **B4 音読β**
  - 選択範囲 / 現在の段落 / 全文。
  - 速度・音声選択・端末ローカルの読み方辞書。
  - 明示ルビ > 読み方辞書 > ブラウザ音声。
- **B5 描写・修飾チェックβ**
  - A / B / C を独立選択。
  - ローカル解析。AI/APIへ原稿を送らない。
- **Final Review UI**
  - 768px以上: Preview下のReview Bar + 上向きpopover。
  - 768px未満: Editor下の1行Review footer + Bottom Sheet。
  - 「見直し」は全体Hub。ピンした機能はその機能だけの詳細を開く。
- **原稿文字数 / 作業カウンター整理**
  - 現在の原稿文字数はタイトル横に常時表示。
  - 作業カウンターは見直し機能として扱う。
- **SpunTalesトップへの導線**
  - TateSpunトップのSpunTalesリンクを canonical portal へ。
- **DOCX読み込みβ**
  - オプション > 原稿データ入出力に追加。
  - 横書きWordと、通常の文書設定による縦書きWordの本文・段落・改行を取り込む。Word側の縦書き/横書きレイアウト自体は引き継がず、TateSpun側で縦書き組版する。
  - Wordルビを TateSpun `｜本文《よみ》` へ変換。
  - Wordの手動改ページを `【改ページ】` へ変換。
  - 画像・文字装飾・ページ設定等の非対応条件を読み込みボタン周辺とHelpに明記。
  - 読み込み処理はブラウザ内。元DOCXは変更しない。
- **Help final alignment**
  - Review UIの現行配置に文言を統一。
  - DOCX読み込みβの対応範囲・非対応範囲を追加。

## Explicitly excluded

- **B6 傍点** — renderer parity / authoring notation decision が未完了。別フェーズ。
- **DOCX書き出し** — 今回は読み込みβのみ。
- Wordの完全再現 / 往復互換。
- DOCX内の画像、フォント、文字サイズ、太字・斜体・色、ページ余白/用紙、ヘッダー/フッター、脚注/文末脚注、コメント、テキストボックスの再現。
- Supabase / Auth / DB / migration / production env の変更。
- A4 release-baselineの変更。

## RC gates after this implementation

1. DOCX Human QA
   - PC: 横書きDOCXと縦書きDOCXの両方で、Optionsから選択、置換確認、本文/段落/改行、ルビ、手動改ページ。
   - 非対応書式が本文を壊さないこと。
   - Mobile: OptionsからDOCX選択導線が使えること。
2. Combined regression for B1–B5 + Review UI + existing save/export/mobile flows.
3. Release Candidate checkpointを作成。
4. A4 soakの必要ゲートを満たす。
5. Humanによるproduction deploy明示承認。

## Production deploy mandatory gate: top-page Update History

**本番デプロイ前に必ずトップページの更新履歴を追加する。**
RC作成だけでは追加せず、production deploy日を確定した時点で日付を入れる。

Draft:

> 見直し機能をアップデートしました。文章チェックβ・作業カウンター・音読β・描写／修飾チェックβを「見直し」にまとめ、PC・モバイルの操作を整理しました。Word（.docx）本文読み込みβにも対応しました。

The deploy must not proceed if this Update History entry has not been added and verified.
