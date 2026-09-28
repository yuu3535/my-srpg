# いまの状態（2026-09-28 時点）

作成: 2026-09-28 / 総合担当（Claude Code）
目的: 新しいチャットや Codex が、古い状態（main）から作業を始めないように、今どこで何が進んでいるかを1枚にまとめる。細かい経緯は作業メモ `docs/90-worklogs/WORK_MEMO_2026-09-27.md`（9/27〜9/28 をまとめて書いている）。

## 1. ブランチ（いちばん大事）

| ブランチ | 中身 | 使い方 |
|---|---|---|
| **`ui/battle-reference-layout`** | **今の作業のすべて**（Unity版の3Dの戦闘・探索・会話、ブラウザ版の試験の戦闘とUI、文書） | **ここで作業する**。作業の前に `git branch` と `git pull` で確かめる |
| `main` | 古い状態（上のブランチより342コミット遅れている。2026-09-28）。GitHub Pages の公開元 | 作業に使わない。上のブランチを合わせるかは、原作者が決める（§5） |
| `battle-v2`・`refactor/combat-pipeline`・`trial/adopted-stats` | 上のブランチに取り込み済み | 使わない |
| `worktree-agent-af543bd9…`（`.claude/worktrees/` の作業場所） | 前のエージェントの作業場所。コミットしていない game.js・style.css の変更が残っている | 使わない。要るかどうかを確かめてから片付ける |
| `codex-world-ui-theme-experiment` | Codex の試し（1コミット、取り込んでいない） | 使わない |

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
- **原作者の判断待ち**: `ui/battle-reference-layout` を `main` に合わせるか（main は GitHub Pages の公開元なので、合わせると公開中のブラウザ版も今の状態に変わる）。取り込み済みの古いブランチを GitHub から消すか。
