# 総合担当（Claude Code の本体）3代目への引き継ぎ

作成: 2026-11-14 / 総合担当（2代目）
理由: 2代目の会話が長くなり、重くなった（原作者「総合担当3代目に引継ぎもしようか」）。判断と進み具合は文書にあるので、3代目はここから続ける。
前の引き継ぎ: `GENERAL_LEAD_HANDOFF_2026-09-28.md`（1代目 → 2代目。Unity の動かし方などは一部古い。下の §4 が今の形）

## 1. 最初に読むもの（この順）

1. `AGENTS.md`・`CLAUDE.md`（共通の決まり。日本語・1コミット1目的・`git add .` 禁止）
2. `docs/90-worklogs/WORK_MEMO_2026-11-14.md`・`WORK_MEMO_2026-11-13.md`・`WORK_MEMO_2026-11-12.md`（直近の経緯。決定には「原作者 日付」が付いている）
3. 直近に組み込んだ画面の記録（`docs/20-implementation/`）
   - `EXPLORE_E_UNITY_2026-11-14.md`（2Dの探索の新しい画面）
   - `TITLE_UNITY_2026-11-13.md`（タイトル画面）
   - `TALK_H_UNITY_2026-11-13.md`（会話枠 H）
   - `SUPPORT_SELECT_UNITY_2026-11-12.md`（支援会話の相手選び）
   - `MENU_HUB2_UNITY_2026-11-09.md`（拠点メニュー Hub2。太陽盤の部分は古い。回る太陽盤は WORK_MEMO_2026-11-13）
4. デザインの仕様書のまとまり: `docs/10-design/ui/{explore,talk,title,support_select}/`（README に「作る前に決めたこと」）

## 2. 役割

- 総合担当 = Unity 版（`unity-prototype/`）の組み込み・発注書（依頼文）・記録。Unity 版が本編。
- デザインは claude.ai の「メニュー画面UIデザイン」のチャットで作り、仕様書のまとまり（spec pack）を受け取って総合担当が組み込む（原作者 2026-11-14「その方式でいい」）。
  - 受け取ったら、仕様書を全部読み、見本の画像を40%で重ねて合わせる。食い違い・わからない所は**作る前に**原作者に聞く（勝手に決めない）。
- ほかの担当: テキスト修正のチャット（台詞の長さ・改行）、ChatGPT（画像・キャラ設定）、Codex。会話の履歴は共有されないので、決定は文書に残す。
- 原作者が最終決定者。ルール・シナリオ・UIの正式採用は原作者に聞く。

## 3. 原作者との約束（守ること）

- 返事・報告は日本語で、やさしい言葉で。専門用語は言い換える。原作者は疲れやすいので、頼む手順は最小に。
- 案を出すときは「おすすめ」を付ける。原作者はたいてい「おすすめで」と答える。
- コミットは総合担当がしてよい。**プッシュは原作者に言われたとき**（「プッシュして」）。
  - `git add .` / `-A` は使わない。ファイル名を指定。素材・文書・コードは別のコミット。
  - コミットメッセージはスクラッチパッドに書いて `git commit -F`。末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`。
- コミットしない物: `.claude/launch.json`、`unity-prototype/Assets/Settings/`・`ProjectSettings/` の書き換わり、`.codex-tmp/`、`unity-prototype/Assets/Previews/`、`Assets/Art/Maps/`、消えた 背景/立ち絵 のファイル、`Assets/Art/Portraits/*_card.png` の書き換わり、絵の `.meta` の書き換わり（WebGL の書き出しで毎回変わる）、`docs/30-planning/TACHIE_DIALOGUE_ORDER_2026-09-28.md`。
- **VRM（試し用の3Dモデル）**: `Alsche_Proxy_StageTest.vrm` は「再配布禁止・作者のみ」。`unity-prototype/Assets/LocalOnly/`（Git の外）に置くだけ。コミットしない。公開版の書き出しの前に、書き出しの記録に `LocalOnly` / `Alsche_Proxy` が0件か確かめる。
- ダウンロードは原作者の許可を取ってから（ファイル名・出どころ・大きさを伝える）。
- 公開中の Unity 版（WebGL）の更新は原作者の許可を取ってから。

## 4. Unity の動かし方（今の形）

```bash
U="/c/Program Files/Unity/Hub/Editor/6000.3.24f1/Editor/Unity.exe"; P="C:/Users/jade-/Desktop/自作srpg 2/unity-prototype"
# テスト（EditMode か PlayMode。-testFilter で絞れる）
"$U" -batchmode -projectPath "$P" -runTests -testPlatform EditMode -testResults <スクラッチパッド>/res.xml -logFile <スクラッチパッド>/log.txt
# ブラウザ版（WebGL）を手元に書き出す（10分近くかかることがある）
"$U" -batchmode -quit -projectPath "$P" -executeMethod Srpg.EditorAgent.WebGLBuilder.Build -logFile <スクラッチパッド>/webgl.log
```

- テストの数（2026-11-14）: EditMode 74・PlayMode 23。すべて成功。
- 手元の確認: 静的サーバー `srpg-static`（ポート 8931。`.claude/launch.json`）→ http://localhost:8931/unity-prototype/Builds/WebGL/index.html （原作者は Chrome で Ctrl+F5）。
- 公開: `bash tools/publish_unity_web.sh`（公開専用のリポジトリ。https://yuu3535.github.io/my-srpg-unity/ ）。許可と VRM の確認のあとで。
- 確認の画像: 一時のテスト（`TmpProbeTests` など）を PlayMode に置いて撮り、使い終わったら消す。オーバーレイの Canvas はカメラに描く形に変え、`Text.SetAllDirty()` してから撮る。
- 気をつけること:
  - Bash のヒアドキュメントやコマンドの中の `\\n` は、ツールが `\n`（改行）に変えてしまうことがある。文字の `\n` を JSON に入れるときは、Python で `chr(92)+'n'` を使うか、Write/Edit で書く。
  - 会話枠 H（DialogueView）はカメラに描く Canvas（並び順 200）。画面にじかに描く Canvas（ScreenSpaceOverlay）は必ず手前になり、押すのを横取りする。探索の画面（ExploreOverlay）はカメラに描く（150）。
  - Unity の Shadow を何個も重ねると形が増え続ける（`SoftTextShadow` を使う）。

## 5. 今の状態（2026-11-14）

- タイトル画面 → はじめから（2Dの探索・自室から）／続きから。開発中だけのボタン: 戦闘テスト・支援会話テスト・立ち絵の並び・表示の切り替え。
- 2Dの探索は「探索の札 E」の作り（当たり判定・縁の光・CHECK/TALK の札・端まで歩けば出る・EXIT の案内）。部屋に何があるかはシナリオの場面に合わせる。
- 会話枠 H。立ち絵は顔の高さを分類（子供・大人男性・大人女性）でそろえ、横は並び（1人・2人・4人）の立ち位置で決まる。原作者は立ち位置を了承（2026-11-14）。
- 拠点メニュー Hub2（回る太陽盤・炎は連番）・支援会話の相手選び（素早く2回タップで戻る）。
- タップの波紋（銀の菱形）は全部の画面。
- 公開中の Unity 版は古いまま（2026-11-13 より前）。手元の版は最新。

## 6. 次にやること・待っていること

1. **プッシュ**: 2代目の最後の保存がプッシュ済みか `git status -sb` で確かめる（原作者に言われたらプッシュ）。
2. **公開版の更新**: 原作者が手元の版を確かめたら。公開の前に VRM の確認。
3. **テキスト修正のチャット**: 台詞の長さ・改行の見直しを頼んだ（`docs/30-planning/TALK_TEXT_LENGTH_HANDOFF_2026-11-14.md`）。直ったら、ドライブの表から `tools/import_scenario.py` で取り込む。
4. **探索の札（2Dの探索）**: 組み込み済み。廊下などほかの場所の当たり判定・縁の光は、場所ごとの仕様が来たら。
5. **SE（効果音）**: 原作者が素材を集める（規約を確かめて手で取る）。総合担当は試聴・選別の道具と、Unity 版の音を鳴らす仕組みを作る（WORK_MEMO_2026-11-14「相談」）。
6. **戦闘UI**: Hub2 の雰囲気に寄せる（デザインはチャット。変えるときは `SILVER_BATTLE_UI_DIRECTION_2026-10-02.md` も直す）。
7. **キャラ・立ち絵・SD**: ChatGPT と設定・衣装を詰めている（ドライブが正本）。SD は新しい衣装で1人試して並べる案。
8. 公開の形にするとき false にする開発用の切り替え: `SupportSelectView.OpenBeforeUnlock`・`StartMenu.ShowBattleTest`・`ShowSupportTest`・`ShowPortraitTest`・`ShowBackToStart`（「最初へ」を消すなら、拠点メニューに「タイトルへ」を用意）。

## 7. 原作者の判断待ち

- 御伽噺の本（1-2）の場所: シナリオの進行（イベントの場面）で決める。それまで出さない。
- 仮の文（アルシェの本棚・カリマの本棚・カリマの収納箱）の本番の文。
- 短い一言の吹き出し（探索の仕様書 §8 のしっぽ付き）を使う場面。
- 支援会話の台本（できたら `Resources/Support/support_talks.json` を差し替え。表から書き出す道具はまだ）。
- 「続きから」でセーブ欄の一覧を出す形（原作者 2026-11-13「あとで」）。
