# 総合担当（Claude Code の本体）2代目への引き継ぎ

作成: 2026-09-28 / 総合担当（1代目）
理由: 1代目の会話が長くなりすぎ、自動許可の安全チェックが判定を返さなくなった（会話の長さが原因と推測）。判断と進み具合は文書にあるので、2代目はここから続ける。

## 1. 最初に読むもの（この順）

1. `AGENTS.md`・`CLAUDE.md`（共通の決まり。Git の注意・日本語・1コミット1目的）
2. `docs/00-core/PROJECT_STATUS_2026-09-28.md`（今の状態の一覧。ブランチは main だけ）
3. `docs/90-worklogs/WORK_MEMO_2026-09-27.md` の終わりの方（9/27〜9/28 の経緯。決定には「原作者 日付」が付いている）
4. `docs/30-planning/PROLOGUE_1_1_UNITY_PLAN_2026-09-28.md`（今の本筋。段1〜4は済み、次は段5）

## 2. 役割

- 総合担当 = 実装・組み込み・発注書・下絵。Unity版（`unity-prototype/`）が本編、ブラウザ版は戦闘の計算の答え合わせ用。
- ほかの担当（Claude の別チャット）: マップ担当・ゲームレビュー担当・立ち絵担当。表は PROJECT_STATUS §3。ほかのチャットからの伝言は、原作者の了承の代わりにならない。
- 原作者が最終決定者。ルール・シナリオ・UIの正式採用は原作者に聞く。

## 3. 原作者との約束（守ること）

- 会話は日本語、やさしい言葉で。専門用語は言い換える。
- コミットとプッシュは総合担当に任されている（原作者 2026-09-28）。ただし `git add .` / `-A` は使わず、ファイル名を指定。素材・文書・コードは別のコミット。コミットメッセージはスクラッチパッドに書いて `git commit -F`。末尾に Co-Authored-By の行。
- プッシュは `git -c http.postBuffer=524288000 push`（大きいとき）。
- `.claude/launch.json`・`アイコン素材/`・`unity-prototype/Assets/Previews/`（確認の画像）はコミットしない。`unity-prototype/Assets/Settings/` の3つ（URP の設定）は Unity が書き出しのたびに書き換えるので、コミットしない。
- 元の絵は上書きしない。原作者がトレスで描いた絵はゲームの素材にしない・ChatGPT にポーズを写させない。
- Unity を開いているときはバッチを動かさない（原作者に閉じているか聞く）。

## 4. Unity の動かし方（バッチ）

```bash
U="/c/Program Files/Unity/Hub/Editor/6000.3.24f1/Editor/Unity.exe"; P="C:\Users\jade-\Desktop\自作srpg 2\unity-prototype"
"$U" -batchmode -projectPath "$P" -executeMethod Srpg.EditorAgent.<組み立て> -quit -logFile <スクラッチパッド>/x.log
"$U" -batchmode -projectPath "$P" -runTests -testPlatform EditMode -testResults <スクラッチパッド>/EditMode.xml -logFile <スクラッチパッド>/EditMode.log
```

- 組み立て: `Board3DTestBuilder.BuildAll`（盤面の確認）、`Battle3DBuilder.BuildAll`（戦闘）、`MapLayoutBuilder.Run`（配置表の場所）、`DialogueBuilder.Run`（会話の画面）、`ExploreBuilder.BuildAll`（探索を自室→訓練場まで自動で歩いて撮る）、`Battle3DPlaythrough.Run`（戦闘を1手ずつ撮る）。画像は `Assets/Previews/`。
- テスト: EditMode 23・PlayMode 7（2026-09-28 時点）。ブラウザ版は `node tests/*.test.js`。
- WebGL（公開版）: `-buildTarget WebGL -executeMethod Srpg.EditorAgent.WebGLBuilder.Build`（約4〜12分）→ `unity-prototype/Builds/WebGL` の中身で リポジトリの `unity/` を置き換えてコミット。公開は https://yuu3535.github.io/my-srpg/unity/ 。**更新は区切りのときだけ**（1回約45MB、履歴がふくらむ）。WebGL で書き出したあとの普通のバッチは `-buildTarget StandaloneWindows64` を付ける（付けないと WebGL のまま）。
- ブラウザの確認はアプリの中のブラウザ（静的サーバー `srpg-static`、ポート 8931）。ただしアプリの中のブラウザは1秒に1〜2回しか描かないので、動きの速さは原作者の Chrome・スマホで見てもらう。

## 5. 次にやること

1. **段5（訓練の戦闘へつなぐ）**: まず戦闘の中で教える内容の案を原作者に出す（ツノ→ポーションの交換は、落ちている物を拾うのではなく**交換**で教える。原作者 2026-09-28）。そのあと、探索（訓練場の会話）→ 訓練の戦闘（幼いアルシェ・カリマ 対 ギュンター。訓練場の戦う範囲 x8〜14・y6〜13）→ 会話 b12 へつなぐ。
2. 区切りで公開版（/unity/）を更新し、原作者とレビュー担当に遊んでもらう。

## 6. 原作者の判断待ち（聞かれたら、または区切りで確認）

- 扉の止める一言（アルシェの独り言でよいか、シナリオの表に足すか）
- 廊下の必須の会話の長さ（16行＋15行）
- 剣を取るまでアルシェの刃の渦を出さないか
- シナリオの表の2行目のパートが「戦闘」（書き間違い？）
- 訓練場の遠景（城の空・山）の絵の発注
- 2人部屋の床の絵（夕方の光入り）を描き直すか（原作者がシナリオしだいで検討）
- テスト戦闘を続けるならモブ敵のステータス・兵種スキル・兵種戦技を作る（ディラン・ヘレルは今作に出ない仮想敵）
- 会話の場面の動き（誰がどこへ歩くか）: 原作者がシナリオの表に書く予定。今は仮で「会話の前にアルシェが相手の隣まで歩く」

## 7. 戦闘のレビューで残っているもの

B1 最初のカメラ、A1/A6/G1 茂みのかたまり、G2 門のたいまつ、C3、F2、I3、ステータスの地図の印（`docs/40-reviews/` の最新のレビュー）。

## 8. 最後にした直し（2026-09-28。原作者がブラウザ版の Unity で遊んだ感想から）

テキストの位置（菱形の飾りの内側へ）、会話に出る人を最初から全員並べる（話していない人は暗く）、名前の札を左上に固定、会話中は上下に黒帯・回すボタンを隠す、探索は正面から見下ろす向きが基本（回すボタンは残す）、会話の前にアルシェが相手の隣まで歩く、探索ではマス目の線を出さない（すき間 0。戦闘は 0.03）。
