# ゲームレビュー担当 引き継ぎ文書

作成: 2026-09-28 / 総合担当（Claude Code）
状態: 原作者の依頼で作成（2026-09-28）。レビュー担当は、原作者が別に開く Claude のチャット

## 1. 役割

- 遊びやすさ・分かりやすさ・見た目のまとまり・戦闘の数字の偏りを、**点検表に沿って調べて報告する**。
- **コードや素材は変更しない**（AGENTS.md「調査・レビューだけの依頼ではコードを変更しない」）。直すのは総合担当（Claude Code の本体のチャット）。
- 決めるのは原作者。レビュー担当は「こう困る」「こうなっているとよい（案）」までを書き、案には状態（アイデア／検討中）を付ける。

## 2. 最初に読むもの

1. `AGENTS.md`・`CLAUDE.md`（共通の決まり。Windows・日本語ファイル名・Git の決まり）
2. `PROJECT_CONSTITUTION.md`（作品の核・優先する価値・UIの意匠）
3. 最新の作業メモ `docs/90-worklogs/WORK_MEMO_2026-09-27.md`（何が決まり、何がまだ仮か）
4. 点検表 `docs/40-reviews/PLAYTEST_CHECKLIST_v1.md`
5. 盤面の方針 `docs/10-design/map/UNITY_3D_BOARD_MAP_PRODUCTION_GUIDE_2026-09-27.md`

## 3. 見る対象

- **Unity版の3Dの戦闘**（`unity-prototype/Assets/Scenes/Battle3D.unity`）。盤面は国境監視路、地面は描いた1枚絵、木は描いた木の絵。
- UI: 右のコマンド・左下のユニットと武器のカード・下の戦闘予測の帯・上の帯・左の味方一覧・右上の地形の欄・戦況の画面。
- ブラウザ版（`index.html`）は戦闘の計算の確かめ用。見た目の点検はしない（ブラウザ版はUnity版と盤面が違う）。

## 4. 画像を見る

組み立てのたびに撮られる確認の画像が `unity-prototype/Assets/Previews/` にある（2倍の大きさ 1688×780。スマホの横画面 844×390 の2倍）。

| 画像 | 場面 |
|---|---|
| `Battle3D_ui_idle` | 戦闘の始まり（誰も選んでいない） |
| `Battle3D_ui_status` | 戦況の画面 |
| `Battle3D_ui_select`・`_acting` | 味方を選んだ・動いたあと |
| `Battle3D_ui_magic_list`・`_support`・`_transfer`・`_items` | 魔法の一覧・補助の対象・転移・持ち物 |
| `Battle3D_ui_forecast`・`_forecast_next` | 戦闘予測・攻撃の切り替え |
| `Battle3D_ui_enemy_preview` | 敵が攻撃する前の予測 |
| `Battle3D_ui_turn2` | 敵の番のあと（ターン2） |
| `Battle3D_ui_summon_circle`・`_summon` | 召喚の陣・ヒトダマ |
| `Battle3D_close*`・`_front`・`_top`・`_ring_*` | 寄り・正面・真上・赤い丸 |
| `Board3D_T8_painted_*` | 地面の1枚絵（試作の盤面） |
| `Board3D_T6_occlusion_*` | 隠れたキャラの見せ方 |

- 画像を撮り直すときは、下の組み立てを実行する（**Unity を閉じてから**。原作者が Unity を開いている間は実行できない。総合担当が組み立てている間も同時に実行しない）。

```powershell
& "C:\Program Files\Unity\Hub\Editor\6000.3.24f1\Editor\Unity.exe" -batchmode -projectPath "C:\Users\jade-\Desktop\自作srpg 2\unity-prototype" -executeMethod Srpg.EditorAgent.Battle3DBuilder.BuildAll -quit -logFile <スクラッチパッド>\bt3d.log
```

- 原作者が遊んで撮ったスクショ・感想も受け取る（点検表の H は、原作者の感想が一番の手がかり）。

## 5. 数字を調べる

- 戦闘の計算はブラウザ版 `battlePlan.js`（Unity版は `Assets/Scripts/Battle/Plan/` に同じ計算）。
- 答え合わせのデータ `unity-prototype/Assets/Tests/EditMode/Fixtures/battle_plan_cases.json` に、全員×全員の予測と交戦の結果がある（520件）。偏りを調べるのに使える。
- 調べるための使い捨ての台本は、リポジトリではなくスクラッチパッドに置く。

## 6. 1手ごとの画像

**できた（2026-09-28）**: 試験の戦闘を最初から決着まで自動で進め、1手ごとに撮る（味方も敵と同じ評価で動く。乱数は決まった種なので毎回同じ戦闘）。
- 画像と一覧: `unity-prototype/PlaythroughShots/`（Git には入れない。手元で見る）。一覧と戦闘の記録（ダメージ・外れ・倒れた）は同じ所の `playthrough.md`。
- 名前は `t<ターン>_<番号>_<キャラ>_<場面>.png`（moved＝動いたあと・forecast＝戦闘予測・preview＝敵の攻撃の前の予測・acted＝行動のあと・turn＝ターンの始まり）。
- ダメージの数字（仮の表示）は画像に写らない。`playthrough.md` の記録で見る。
- 撮り直すとき（Unity を閉じてから。先に §4 の組み立てを実行しておく）:

```powershell
& "C:\Program Files\Unity\Hub\Editor\6000.3.24f1\Editor\Unity.exe" -batchmode -projectPath "C:\Users\jade-\Desktop\自作srpg 2\unity-prototype" -executeMethod Srpg.EditorAgent.Battle3DPlaythrough.Run -quit -logFile <スクラッチパッド>\play.log
```

- 別の動かし方（別の種・別の順番・ある場面だけ）が要るときは、総合担当に頼む。

## 6b. 探索（2026-09-28 追加。プロローグ1-1）

- シーン: `unity-prototype/Assets/Scenes/Explore3D.unity`（原作者が▶で遊べる）。自室で起きる → 剣立てを調べて剣を取る → 廊下（キャリー・ヘンリーとの会話は必須、井戸端会議は寄り道）→ 訓練場に着くと合流の会話 → 戦闘の手前で止まる（戦闘へのつなぎは次の段階）。
- 計画: `docs/30-planning/PROLOGUE_1_1_UNITY_PLAN_2026-09-28.md`。シナリオの表: `シナリオ集/シナリオブラッシュアップ/第1章プロローグ｜シナリオ執筆用.xlsx`（シート「シナリオプロローグ1-1」）。ブロックの一覧: `docs/30-planning/scenario/prologue_1_1_blocks.md`。場所の配置表: `docs/10-design/map/layouts/*.json・*.md`。
- 確認の画像: `Explore_*`（最初から訓練場まで自動で進めたもの）、`Map_<場所>_*`（場所ごと）、`Dialogue_*`（会話の画面）。
- 撮り直すとき（Unity を閉じてから。総合担当が組み立てている間は実行しない）:

```powershell
& "C:\Program Files\Unity\Hub\Editor\6000.3.24f1\Editor\Unity.exe" -batchmode -projectPath "C:\Users\jade-\Desktop\自作srpg 2\unity-prototype" -executeMethod Srpg.EditorAgent.ExploreBuilder.BuildAll -quit -logFile <スクラッチパッド>\explore.log
```

- 点検表は J（探索と会話）を使う。
- 仮の所（指摘しなくてよい）: 自室・廊下の床は下絵の色分け（床の絵は発注中）、家具・小物は仮の箱と柱、キャリー・ヘンリー・ギュンターは会話の立ち絵を小さくした仮の姿、名前のない従者は青白い火の玉、立ち絵は全員仮（会話用を作り直し中）、テキストボックスの位置は仮、訓練場の遠景は仮の森、謁見の間はまだない、携帯端末のメニューはまだない、戦闘へのつなぎはまだない。

## 7. 報告のしかた

- 1回のレビューを1つのファイルにする: `docs/40-reviews/PLAYTEST_REVIEW_YYYY-MM-DD.md`（同じ日に2回目なら `_2`）。
- 書く順番:
  1. 見たもの（画像の名前・原作者のスクショ・どの版の何時の組み立てか）
  2. 点検表の結果（○△×－の一覧）
  3. △と×の詳しい説明（1件ずつ）: どこで／何が困るか／なぜ困るか（SRPGとしての理由）／こうなっているとよい（案・状態）／重さ（高＝遊べない・誤解する、中＝不便、低＝好み）
  4. よかった所（残したい所。直すときに壊さないため）
  5. 総合担当への依頼の一覧（重さの順）
- 点検表に足したい項目があれば、報告の最後に「点検表への追加案」として書く（点検表の更新は総合担当が行う）。
- 報告を書いたら、原作者に「どのファイルに書いたか」と重さ高の件だけを短く伝える。

## 8. 今わかっている仮の所（指摘しなくてよい）

- 門・壁・たいまつ・橋の欄干は仮の3Dの形（描いた模様はまだ）。
- ヒトダマは絵がなく、青白い火の玉。
- 地形の欄の「回避+0・防御+0」（地形の効果はまだ戦闘の計算にない）。
- ダメージの数字と勝敗の文字は仮の表示。攻撃の演出はまだない。
- ブラウザ版の見た目はUnity版と違う。

## 9. 原作者が新しいチャットに貼る文

```
あなたは自作SRPG（リポジトリ C:\Users\jade-\Desktop\自作srpg 2）のゲームレビュー担当です。
docs/30-planning/GAME_REVIEW_CHAT_HANDOFF_2026-09-28.md を読み、そこに書かれた順に文書を読んでから、
点検表 docs/40-reviews/PLAYTEST_CHECKLIST_v1.md に沿って Unity版の戦闘をレビューしてください。
コードや素材は変更せず、結果は docs/40-reviews/PLAYTEST_REVIEW_YYYY-MM-DD.md に書いてください。
```
