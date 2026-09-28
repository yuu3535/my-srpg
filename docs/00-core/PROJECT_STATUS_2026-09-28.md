# いまの状態（2026-09-28 時点）

作成: 2026-09-28 / 総合担当（Claude Code）
目的: 新しいチャットや Codex が、古い状態（main）から作業を始めないように、今どこで何が進んでいるかを1枚にまとめる。細かい経緯は作業メモ `docs/90-worklogs/WORK_MEMO_2026-09-27.md`（9/27〜9/28 をまとめて書いている）。

## 1. ブランチ（いちばん大事）

- **作業ブランチは `main`**（原作者の決定 2026-09-28）。この日に `ui/battle-reference-layout` のすべてを main へ取り込んだ（早送りで同じ中身にした）。以後は main で作業し、`git pull` してから始める。
- main は GitHub Pages の公開元（https://yuu3535.github.io/my-srpg/）。ブラウザ版のファイルを変えたら、テストを通してからプッシュする。
- `ui/battle-reference-layout` は取り込み済みで、2026-09-28 に削除した（GitHub にも手元にも、ブランチは main だけ）。古いブランチ（battle-v2・refactor/combat-pipeline・trial/adopted-stats・codex-world-ui-theme-experiment）と、前のエージェントの作業場所は 2026-09-28 に削除した（中身はすべて main に入っているか、今の形に置き換わっていた）。

## 2. 作品の方針（今の決定）

- **本編のシナリオは Unity版で作る**。プロローグ1-1（`シナリオ集/シナリオブラッシュアップ/第1章プロローグ｜シナリオ執筆用.xlsx`）が本編のシナリオ（原作者 2026-09-28）。
- **ブラウザ版**は、戦闘の計算の確かめ用が中心（Unity版と答え合わせをする正本）。ブラウザ版のプロローグ（`scenario.js`）は、差し替えまでの仮。
- マップは **3Dの盤面＋2Dのキャラ**（2Dの斜めの1枚絵は旧案。2026-09-28 に Unity の2Dの試作を削除した）。探索も3Dの盤面を歩く。地面は真上から見た1枚絵、場所ごとに配置表（`docs/10-design/map/layouts/`）。
- 会話は、盤面を映したまま立ち絵を左右に置く会話劇。会話用の立ち絵は作り直し中。

## 3. 担当（チャット）

| 担当 | 役割 | 引き継ぎ |
|---|---|---|
| 総合担当（Claude Code の本体） | 実装・組み込み・発注書・下絵 | この文書・作業メモ |
| マップ担当（Claude の別チャット） | 配置表・マップの絵のレビュー | `docs/30-planning/MAP_IMAGE_CHAT_HANDOFF_2026-09-26.md` |
| ゲームレビュー担当（Claude の別チャット） | 点検表でレビュー（コードは変えない） | `docs/30-planning/GAME_REVIEW_CHAT_HANDOFF_2026-09-28.md` |
| 立ち絵担当（Claude の別チャット） | 会話用の立ち絵の依頼文・確認・透過 | `docs/30-planning/TACHIE_CHAT_HANDOFF_2026-09-28.md` |
| Codex | 使うときはレビューと依頼文づくり | `docs/30-planning/CODEX_HANDOFF_2026-09-28.md` |
| ChatGPT | 絵の生成 | 各発注書 |

## 4. 今どこまでできているか

- Unity版の戦闘（`Assets/Scenes/Battle3D.unity`）: 3Dの盤面、ブラウザ版と同じ計算（答え合わせ 520件）、UI、行動予告の矢印、交換。
- プロローグ1-1（計画 `docs/30-planning/PROLOGUE_1_1_UNITY_PLAN_2026-09-28.md`）: 段1 シナリオの取り込み・段2 会話の画面・段3 配置表から盤面・段4 探索（`Assets/Scenes/Explore3D.unity`。自室 → 廊下 → 訓練場）まで。次は段5（訓練の戦闘へつなぐ）。

## 5. 2026-09-28 の整理

- Unity の確認用の画像（`unity-prototype/Assets/Previews/`）を Git に入れないようにした（組み立てのたびに約214MBを撮り直し、履歴がふくらんでプッシュが途中で切れていたため）。画像は手元のフォルダに残り、レビュー担当はそこを見る。
- Unity の2Dの斜めの盤面の試作（BattleM1・IsoGrid・iso の絵・SampleScene）を削除した（3Dの盤面に決まったため）。
- 原作者の決定（2026-09-28）: main に合わせる（済み）、取り込み済みの古いブランチを消す（済み）。
