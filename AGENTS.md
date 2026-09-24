# AGENTS.md — 自作SRPGプロジェクト共通指示

このファイルは Codex / Claude Code など、このリポジトリで作業するすべてのAIエージェント向けの共通指示書です。
作業前に必ず目を通すこと。ツール固有の補足は `CLAUDE.md` 等に分ける。

## プロジェクト概要

原作者のTRPG体験をもとにした、TRPG × SRPG の融合を目指す自作シミュレーションRPG。
ダークファンタジー世界観。主人公はアルケー（13歳の少年・百年戦争編）。
GitHub Pagesで公開中: https://yuu3535.github.io/my-srpg/

作品の核・優先する価値・AIの行動原則は `PROJECT_CONSTITUTION.md`（最上位方針）に従う。

- 画面は横画面専用（2026-09-21 原作者指定）。縦長ウィンドウでも横長比率を維持し、ホーム・会話・戦闘・ステータスを縦配置へ切り替えない。
- UI意匠は `1efae8f` の横画面ステータスシートを基準にする（2026-09-21 原作者確認）。黒紫の下地・紫の帯・金の細罫線・明朝体・控えめな紋章を維持し、可読性改善を理由に汎用ダッシュボード風へ変更しない。
- UIカラーテーマ: ヴァイオレット × ゴールド × アンバー

## 文書の読み方

文書の案内は `docs/README.md`。内容が食い違ったときの優先順:

1. `PROJECT_CONSTITUTION.md` の最上位方針
2. `採用版md/` にある採用済み仕様
3. `docs/10-design/` の新しい正式設計
4. `docs/20-implementation/` に記録された現在の実装事実
5. `docs/30-planning/` の予定・議題
6. `docs/40-reviews/` と `docs/90-worklogs/` の検討・履歴

- 直近の状況と再開地点は `docs/90-worklogs/` の最新 `WORK_MEMO_*.md` を見る。
- 設計資料の「理想」と、現在動いている処理を混同しない。現行実装の事実は `docs/20-implementation/` とコードで確認する。

## 技術構成

- JavaScript / HTML / CSS。ビルドツール・フレームワークなしでブラウザから直接実行する（GitHub Pagesでそのまま動く構成を維持）。
- エントリポイント: `index.html`。通常の `<script>` で順に読み込み、最後が `game.js`。
  - データ: `characters.js`、`skills.js`、`magics.js`（原作資料寄り）、`spells.js`（実戦闘で使う魔法データ）、`combatArts.js`、`passiveSkills.js`、`battleDefinitions.js`
  - 戦闘基盤: `battleHooks.js`、`statConversion.js`、`combatPipeline.js`、`combatShadowComparison.js`
  - その他: `dataHelper.js`、`partyState.js`、`scenario.js`
  - 本体: `game.js`（戦闘・UI・シナリオ・ホームが同居する大きなファイル。大改造は避け、機能単位で小さく触る）
  - `buildMilestones.js`、`cloneBattleExecutor.js` は現在 `index.html` から読み込まれていない（テスト・今後の接続用）。
- `index.html` のスクリプト・CSS参照には `?v=...` のキャッシュ対策が付いている。内容を変えたファイルは、スマホやGitHub Pagesで旧版が残らないよう `?v=` の値も更新する。
- 新しいロジック／データのモジュールはDOMに触れない純粋な処理にし、末尾の `if (typeof module !== "undefined") { module.exports = ... }` でNodeテストからも読み込めるようにする。
- スタイル: `style.css`
- 素材: `assets/`、`Character/`、`背景/`、立ち絵フォルダ（後述）
- 設定資料: `CharaStatus/`、`シナリオ集/`、原作TRPG資料 `rurubu4/`
- `map_editor.html` と `prototypes/` はゲーム本編の実行経路ではない。
- `unity-prototype/` は Unity 6.3 LTS（6000.3.24f1・URP 2D）の試作。`.meta` を削除・分離しない。

## テスト

Node.js（フレームワークなし）。各テストファイルを直接実行する。

```powershell
node tests/combatPipeline.test.js
```

全件実行:

```powershell
Get-ChildItem tests\*.test.js | ForEach-Object { node $_.FullName }
```

- 戦闘ロジックを変えたら関連テストを実行し、必要ならテストを追加する。
- 命中・回避・反撃・状態異常は予測表示と実処理がずれやすい。変更時はVS予測も一緒に確認する。

## コーディング方針

- 既存コードのスタイル（命名・構成）に合わせる。大規模なリファクタは事前に提案して承認を得る。
- UIを触るときはヴァイオレット×ゴールド×アンバーのテーマと、上記の意匠基準から外れない。
- 日本語でコメント・会話する。
- シナリオ進行と戦闘初期化は密接につながっている。`startChapter`、`playBattleScene`、`setBattleMode`、`resumeScenarioAfterBattle` は特に慎重に扱う。
- 画像パスや日本語ファイル名が多いので、素材名を変える前に参照箇所を検索する。

## 背景の対応ルール

`battleDefinitions.js` の `BATTLE_DEFINITIONS` に登録する `background` は、
`scenario.js` でそのバトル直前のシーンに設定される `scene.bg` と一致させること。

例: プロローグのバトル直前シーンが `bg: "背景/オルクス魔王城鍛錬場.png"` なら、
`battle_tutorial` の `background` も `"背景/オルクス魔王城鍛錬場.png"` にする。

## 立ち絵の背景透過ワークフロー（確立済み）

立ち絵はAI生成（白背景）→ 透過処理 → ゲームで使用、という流れ。
透過処理には原則 `tools/tachie_studio.py` を使うこと。**自前で透過処理を再実装しない。**
ルートの旧 `tachie_clear.py` は過去素材の再現・比較用として残しているが、新規素材には使わない。
詳細なパラメータ指針は `tools/TACHIE_STUDIO.md` を参照する。

### フォルダの役割

- `立ち絵AI生成/` … AI生成した白背景の立ち絵を入れる場所（入力）
- `立ち絵透過下処理/` … AIで自動透過した、人手確認前のPNGを置く場所（Git管理外）
- `立ち絵透過済み/` … 人手で仕上げと確認を終えた、ゲーム採用可能なPNGを置く場所

### 起動

```powershell
py -3.12 -m pip install -r tools/requirements.txt
py -3.12 tools/tachie_studio.py
```

- `http://localhost:8787` が開いたら白背景画像をドロップする。
- 自動透過後、濃色・市松・白背景を切り替えて輪郭を目視確認し、必要な箇所だけ魔法の杖・消しゴム・復元で修正してPNG保存する。出力は `元ファイル名_clear.png`。
- 「離れたパーツを保持」は通常ONにする（離れた魔法・炎・輪・髪先を失わないため）。
- 完成素材は `立ち絵透過済み/` へ置く。参照パス変更は素材確認後に別作業で行う。

### フォルダ一括処理

```powershell
py -3.12 tools/prepare_tachie_batch.py 立ち絵AI生成 立ち絵透過下処理 --existing-dir 立ち絵透過済み
```

一括処理後も目視確認は必須。仕上げたPNGだけを `立ち絵透過済み/` へ移す。

### 注意事項

- 処理前に入力フォルダに立ち絵以外の画像（スクリーンショット等）が混ざっていないか確認する。
- 元画像（`立ち絵AI生成/` 内）は削除・上書きしない。透過結果は必ず別フォルダに出す。
- 白い服、細い髪、武器、独立エフェクト、足元の影を重点的に確認する。
- 初回のみ `isnet-anime` モデル約176MBがユーザーフォルダへダウンロードされる。起動ログが `CPUExecutionProvider` の場合は1枚に数分かかることがある。

## 協働ルール（複数のAI・担当チャット間）

詳細は `docs/00-core/MULTI_CHAT_COLLABORATION_GUIDE.md`。要点:

- 会話履歴は他のエージェントと共有されない。重要な判断は共有ファイルへ記録する。
- 原作者（ユーザー）が最終決定者。ゲームルール、キャラクター・シナリオの解釈、UIの正式採用は原作者の確認を得る。
- 案には状態を付け、`アイデア / 検討中 / 試作対象 / 保留 / 正式採用 / 不採用 / 廃止` を混同しない。
- 調査・レビューだけの依頼ではコードを変更しない。
- 設計を変更したら関連する正式文書を更新し、必要なら最新の作業メモ（`docs/90-worklogs/WORK_MEMO_YYYY-MM-DD.md`）に理由を残す。
- 採用済みの仕様だけを `採用版md/` に追加する。

## Git

- `git add .` / `git add -A` は使わない。未追跡の素材・作業ファイルが多いため、保存対象はファイル名を指定してステージする。
- 1コミット1目的。素材・文書・コードの変更を混ぜない。
- ブランチの状況は最新の作業メモを確認する。
