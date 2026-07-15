# CLEANUP_REVIEW.md

2026-07-15 / battle-v2 cleanup review

## 結論

現時点では削除よりも棚卸しと分割準備を優先する。

- `game.js`: 約 5,191 行。戦闘ロジック、宣言制AI、横画面UI、シナリオ、セーブ、デバッグ起動が混在している。
- `style.css`: 約 4,184 行。縦画面UI、横画面UI、ステータス詳細、演出、旧UIのスタイルが混在している。
- 直近の安全地点: `634d295 Refine status sheet arts layout`
- このレビューではファイル削除はしない。未追跡ファイルも触らない。

## これからも資産になりそうなもの

### 戦闘・成長ロジック

- `statConversion.js`
  - TRPG原値からSRPG用の戦闘能力値を算出する中核。
  - `tests/statConversion.test.js` があり、数値仕様の検算にも使える。
- `battleHooks.js`
  - `BattleActionContext` と効果フックの入口。
  - 戦技・パッシブ・必殺・反撃・予測を同じ経路に寄せるための土台。
- `combatArts.js`
  - 戦技データの純粋データ置き場。
  - 現時点で本体に実装済み扱いなのは安全ゲートを通した `両断` のみ。
- `passiveSkills.js`
  - パッシブスキルの純粋データ置き場。
  - まだ効果実装は本格接続していないので、今後のフック検証で使う。
- `buildMilestones.js`
  - 修練度による補正・習得分岐の定義候補。
  - 戦技、パッシブ、命中補正、ダメージ補正の設計を分離するために重要。
- `partyState.js`
  - 戦闘間の永続状態の器。
  - 今後 `learnedArts`、`equippedArts`、`learnedPassives`、`equippedPassives`、ビルド選択を持たせる候補。
- `battleDefinitions.js`
  - 本番バトルとテストバトルの入口。
  - キャラ配置、章ごとの陣営、テスト用高水準キャラの切り替えをここへ寄せたい。

### UI・表現

- 横画面バトルUI
  - スマホ横画面での操作感を優先する現在の主UI。
  - 宣言レーザー、危険域、戦闘予測、詳細画面がここに集約されつつある。
- ステータス詳細UI
  - `VITAL / BATTLE / LOADOUT / TRAINING / ARTS / PASSIVE / MAGIC` の構成は良い方向。
  - 原能力値を隠し、プレイヤー向けの基礎情報と戦闘能力に整理したのは維持したい。
- `prototypes/landscape_battle_ui_prototype.html`
  - 本体へ横画面UIを移植した後も、見た目の基準としてしばらく残す。

### 設計メモ

- `PROJECT_CONSTITUTION.md`
  - 判断に迷った時の憲法。特にスマホ操作感、世界観、SRPG快適性の優先順位が重要。
- `COMBAT_ARTS_DESIGN.md`
  - 戦技・修練度・魔法修練度・パッシブの方針。
- `BATTLE_RULES_V2.md`
  - TRPG原値を使ったFE型の戦闘式の設計メモ。
- `PROJECT_DEV_LOG.md`
  - その日に何をしたか、次に何を見るべきかのログ。
- `NEXT_ACTION_QUEUE.md`
  - 次回作業の優先順位リスト。
- `SYNC_AGENDA.md`
  - Claude/Codex間の仕様すり合わせメモ。

## 要注意コード

### `game.js`

最大のリスク箇所。

- 戦闘計算、UI描画、AI、シナリオ遷移、デバッグ起動が同じファイル内にある。
- ただし今すぐ大分割すると事故りやすい。
- 先に純粋関数やデータ参照から小さく抜き出す方が安全。

特に注意する関数群:

- `resolvePhysicalHit`
  - 物理攻撃、命中、必殺、戦技、反撃の中核。
  - 戦闘予測と実ダメージがズレやすいので、安易に別ルートを増やさない。
- `executeMagic`
  - 魔法攻撃、魔法命中、必殺、反撃の中核。
  - 物理側と同じ `BattleActionContext` 経路へ寄せ続ける。
- `calculateBattlePrediction`
  - 戦闘予測の入口。
  - 実戦闘と同じ計算経路を使う方針を崩さない。
- `planEnemyActions` / `enemyAction`
  - 宣言制AIの中心。
  - 敵の予告レーザー、ターゲット、実行位置がズレるとゲーム体験に直撃する。
- `renderLandscapeStatusSheet`
  - 詳細画面の描画。
  - UI改善中に情報の重複や古い呼称が残りやすい。

### `style.css`

UIの見た目を支えているが、旧UIと新UIが混在している。

- 横画面バトルUI
- 縦画面UI
- シナリオ横画面UI
- ステータス詳細
- 戦闘予測
- フェーズ演出

削除候補を見つけても、まずは対応するHTML/JSから参照が消えているか確認する。

## まだ消さないもの

- 旧縦画面UI関連
  - まだ一部のシナリオやフォールバックで参照される可能性がある。
- `prototypes/`
  - 見た目の基準、比較対象としてまだ価値がある。
- `map_editor.html`
  - 本体ランタイムではないが、マップ作成・検証用の資産。
- 立ち絵・生成素材・`CharaStatus/`
  - 画像パイプラインと採用素材の整理が終わるまで削除しない。
- `.claude/`, `.codex-tmp/`, `.vs/`, `generated_assets/`, `rurubu4/`
  - 未追跡のローカル・作業用ファイル。勝手にstage/deleteしない。

## 整理候補

### 1. `game.js` の小分割

安全な順番:

1. 戦闘計算の純粋関数を `battleDamage.js` へ移す
2. `BattleActionContext` 周辺を `battleRuntime.js` へ寄せる
3. ステータス詳細描画を `statusSheet.js` へ移す
4. 横画面バトルUI描画を `battleUiLandscape.js` へ移す
5. 宣言制AIを `enemyAi.js` へ移す
6. セーブ/ロードを `saveLoad.js` へ移す

最初から全部やらない。1ファイルずつ移し、毎回 `node --check game.js` と既存テストを通す。

### 2. `style.css` のセクション分割

HTML/CSSの構造が安定してから着手する。

候補:

- `base.css`
- `battle-landscape.css`
- `scenario-landscape.css`
- `status-sheet.css`
- `effects.css`

ビルドツールなし運用を維持するなら、`index.html` の読み込み順を明示する。

### 3. データと装備状態の整理

次に必要になりそうな拡張:

- `partyState.js`
  - `learnedArts`
  - `equippedArts`
  - `learnedPassives`
  - `equippedPassives`
  - `buildChoices`
- `combatArts.js`
  - 実装済み・未実装の安全ゲートを維持
- `passiveSkills.js`
  - まずは `絶影` など1個ずつ接続して検証

## 近い次タスク

1. `partyState.js` に習得済み/装備中の戦技・パッシブを持たせる
2. `絶影` を1つだけ実装し、`beforeAttack` / `beforeDamaged` の検証対象にする
3. 戦闘予測と実ダメージが一致するテストを増やす
4. `IMPLEMENTED_COMBAT_ART_IDS` / `IMPLEMENTED_PASSIVE_SKILL_IDS` の安全ゲートを維持する
5. `game.js` から純粋な戦闘計算だけを最初に切り出す

## 方針

- 迷ったら `PROJECT_CONSTITUTION.md` を優先する。
- スマホ横画面の遊びやすさを最優先にする。
- 予測と実戦闘の数値経路を分けない。
- Claude/Codex間で責務が重複しそうな時は、先にこのメモか `SYNC_AGENDA.md` に残す。
- 大改修は必ず小さいコミットに分ける。
