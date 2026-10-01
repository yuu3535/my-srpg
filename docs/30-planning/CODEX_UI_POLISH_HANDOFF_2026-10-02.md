# Codex への引き継ぎ: 戦闘画面のUIの見た目の調整（2026-10-02 / Claude Code）

宛先: Codex（UIの見た目の調整）
作成: Claude Code（総合担当）
状態: **試作対象**（原作者 2026-10-02: 「今めっちゃダサいので」調整してほしい）
前回の引き継ぎ: `docs/30-planning/CODEX_HANDOFF_2026-10-01.md`（武器・敵の数値。今回とは別の話）
報告形式: `docs/00-core/MULTI_CHAT_COLLABORATION_GUIDE.md` §15

## 0. いちばん大事なこと

- **見た目の案はブラウザ版（HTML/CSS）で作る。Unity への組み込みは Claude Code がする。**
  - Unity 版の戦闘画面（`unity-prototype/Assets/Scripts/Battle/UI/Battle3DHud.cs`）は、ブラウザ版の 844×390 の画面で測った位置と大きさ、同じ素材（`assets/ui/`）で組み立てている。だからブラウザ版で決まった見た目は、そのまま Unity へ移せる。
  - Unity の画面は C# のコードで組み立てていて、確かめるにはUnityの組み立て（バッチ）を回す必要がある。Codex は Unity のファイルを触らない。
- **案は何案か並べて、原作者に選んでもらう。** 原作者は色や形の調和を厳しめに見る（`docs/10-design/ui/COLOR_HARMONY_DIRECTION_2026-10-02.md`）。1案だけ作って「直しました」にしない。
- **`main` は GitHub Pages の公開元。** 本編の `style.css`・`game.js` を直接作り変えない。見本は §4 の場所に作る。本編への反映は、原作者が選んだあとに別作業で行う。

## 1. 守ること（意匠の基準。変えない）

`PROJECT_CONSTITUTION.md`「UIの意匠基準」（2026-09-21 原作者確認）より:

- 深い黒紫の下地、紫の帯、鈍い金の細い罫線、明朝体、控えめな紋章。基準は `1efae8f` 時点の横画面ステータスシート。
- テーマ色はヴァイオレット × ゴールド × アンバー。
- 汎用的なダッシュボード風（白文字・サンセリフ・角丸カード・青系）にしない。読みやすさを直すときも、この意匠の中で直す。
- 画面は横画面専用。基準の比率は 844×390。縦長の画面で縦積みに切り替えない。
- UIは中央の16:9の枠（844×390 のうち約 693×390）の中に置く。左右の余りには背景とマップだけを見せる（`docs/10-design/ui/UI_DIRECTION_AND_ASSET_LIST_2026-09-25.md` §6。`style.css` の `--ls-safe`）。

色の決まり（`docs/10-design/ui/COLOR_HARMONY_DIRECTION_2026-10-02.md`。原作者 2026-10-02）:

- **UIの部品そのもの**（枠・帯・ボタン）は、テーマ色の紫と金のままでよい。
- **景色にかける色**（オーバーレイ・霧・時間帯の光・画面全体の色かぶせ）はテーマ色にしない。背景の色相の**隣の色か反対の色**から選ぶ。例: 青空に紫はかけない。黄色は黄ばんで見える。
- 色の案は何色か並べて選んでもらう。

## 2. 今の戦闘画面の部品（どこがどれか）

ブラウザ版: `index.html` の `#landscapeBattleShell` の中。見た目は `style.css`、中身は `game.js`。
Unity 版: `Battle3DHud.cs` の `Build...()` が同じ部品を作る（括弧の中は 844×390 の画面での x, y, 幅, 高さ）。

| 部品 | ブラウザ版 | Unity 版 | 中身 |
| --- | --- | --- | --- |
| 上の帯 | `#landscapeTopStrip` | `BuildTopStrip`（82, 6, 680, 30） | フェーズ名（ALLY PHASE／味方フェーズ）、勝利条件、TURN、敵の行動予告の数 |
| 左の味方一覧 | `#landscapeRoster` | `BuildRoster`（82, 45, 46, 314） | 顔、HPの細い帯、行動済みの「済」。**2026-10-02 に開け閉めのつまみ（◀／▶ 味方）を付けた** |
| 地形の欄 | （Unity版だけ） | `BuildTerrainPanel`（640, 44, 118, 42） | 地形の名前と効果 |
| コマンド | `#landscapeCommandList` | `BuildCommandList`（640, 158, 118, 75） | 攻撃・魔法・待機・アイテム・交換など（アイコンつき） |
| ユニットのカード | `#landscapeUnitPanel`（`.lcCard`） | `BuildUnitCard`（130, 279, 244, 86） | 顔、名前、因果Lv、兵種、HP・MP |
| 武器のカード | `.lcWeapon` | `BuildWeaponCard`（380, 296, 150, 69） | 武器名、威力・射程・命中・必殺、耐久 |
| 手引きの帯 | （Unity版だけ） | `BuildGuide`（140, 42, 490, 30） | 訓練の戦闘の手引きの文 |
| 下の説明 | `#landscapeHint` | `BuildHint`（82, 369, 680, 14） | 「動かす味方を選んでください」など |
| 戦闘予測 | `#lsForecast` | `BuildForecast` | 左右に攻撃側・受ける側。HP（前▶後）・ダメージ・命中・必殺。キャンセル・実行する・戦闘詳細 |
| 戦況 | （Unity版だけ。ブラウザ版は右下の「危険域」など） | `BuildStatus` | 敵の行動予告の一覧と縮小マップ |
| 盤面の上の小さな表示 | ユニットの下の数字とHPの帯 | `UpdateOverlays` | HPの数字、帯、行動予告の印 |

Unity版だけの部品は、ブラウザ版の見本の中に置いて形を決めてよい（Unity版の画像は `Battle3DBuilder` が書き出す `unity-prototype/Assets/Previews/Battle3D_ui_*.png`。Git には入っていないので、要るときは Claude Code に頼む）。

素材: `assets/ui/`（`tools/build_ui_assets.py` が書き出す。枠・ボタン・顔枠・ゲージ・範囲マスなど）。素材を直すなら、`build_ui_assets.py` を直して書き出し直す形を基本にする。

## 3. どこがダサいか（原作者に書いてもらう欄）

> 原作者 2026-10-02: 「今めっちゃダサい」。具体的な箇所は次の作業の前に原作者が書き足す。
> Codex は作業の始めにここを読み、空なら原作者に聞く（推測で全部を作り変えない）。

| # | 箇所 | どう嫌か | 状態 |
| --- | --- | --- | --- |
| 1 | | | |
| 2 | | | |
| 3 | | | |

参考になる、これまでの原作者の好み:

- 帯で囲みすぎない方がおしゃれ（探索UIの見本: 上の方のUIは帯なしの方がよい。2026-10-02）。
- 名前の上に紫の名前帯を載せる形はダサい。帯なしで文字と細い線だけにした形は「だいぶ良くなった」（2026-10-02）。
- 紫のオーバーレイを景色全体にかけるのはダサい（§1 の色の決まりの理由）。
- 見本: `docs/10-design/ui/concepts/explore_2d_ui_mock_2026-10-02.webp`（探索中のUIの見本。844×390）。

## 4. 作り方

1. **今の画面を撮る。** 静的サーバー（例: `py -3.12 -m http.server 8931`）で `http://localhost:8931/index.html?battle=battle_prologue_training` を開く。訓練の戦闘がすぐ始まる。横長の比率（844×390 か同じ比率の大きさ）で、ふだんの画面・ユニットを選んだ画面・戦闘予測・戦況を撮る。
2. **見本を作る。** `prototypes/ui-polish-2026-10/` に、1枚で開ける HTML を作る（本編の `style.css` は読み込まず、見本の中に CSS を書く。素材は `../../assets/ui/` を参照してよい）。844×390 の枠に、今の画面と同じ部品を置く。背景は今の戦闘の背景の画像を使う。
3. **案は2〜4案。** 一つの見本の中で切り替えられる形（ボタンやタブで A・B・C）か、並べて見比べられる形にする。案ごとに「何を変えたか」を一行で添える。
4. **撮った画像を残す。** 案ごとの画像を `docs/10-design/ui/concepts/` に置き、原作者に見せる。
5. 原作者が選んだら、決まったことを `docs/10-design/ui/` に記録する（案の状態を「正式採用」にするのは原作者の確認のあと）。
6. **本編への反映**: ブラウザ版の `style.css` などへの反映は、原作者の確認を取ってから別のコミットで行う。`index.html` の `?v=` を更新する。Unity 版への反映は Claude Code に回す（反映するものの一覧を引き継ぎに書く）。

## 5. 触らないもの

- `unity-prototype/` の中（Unity への反映は Claude Code がする）。
- 戦闘の計算（`battlePlan.js`・`trialStatSystem.js`・`combatPipeline.js`）。見た目の作業で数値や処理を変えない。
- 立ち絵・背景の元の絵（上書きしない）。
- `docs/30-planning/TACHIE_DIALOGUE_ORDER_2026-09-28.md`（別の担当が作業中）。
- 探索の2D回廊の試作（`570787a`）は、別の作業として止まっている。今回の見本には混ぜない。

## 6. コミット

- `git add .`／`git add -A` は使わない。ファイル名を指定してステージする。
- 1コミット1目的。見本（prototypes）・画像（concepts）・文書・本編のコードを混ぜない。
- 作業の前に `git pull`。作業メモは `docs/90-worklogs/WORK_MEMO_YYYY-MM-DD.md` に残す。

## 7. 読む文書（この順）

1. `PROJECT_CONSTITUTION.md`「UIの意匠基準」
2. `docs/10-design/ui/COLOR_HARMONY_DIRECTION_2026-10-02.md`（色の決まり）
3. `docs/10-design/ui/UI_DIRECTION_AND_ASSET_LIST_2026-09-25.md`（今の画面の構成が決まった経緯、§5・§6）
4. `docs/10-design/ui/UNITY_SRPG_UI_DESIGN_DIRECTION_DRAFT.md`（Unity版のUIの方向。下書き）
5. `docs/90-worklogs/WORK_MEMO_2026-10-01.md`（直近の決定。2026-10-02 の分もここにある）
