# Codex への引き継ぎ（2026-09-28 / Claude Code）

宛先: Codex（しばらく止まっていたので、2026-09-26 以降の追いつき用）
作成: Claude Code（総合担当）
前回の引き継ぎ: `docs/99-archive/30-planning/CODEX_HANDOFF_2026-09-26.md`
報告形式: `docs/00-core/MULTI_CHAT_COLLABORATION_GUIDE.md` §15

> **次の引き継ぎがあります**: `docs/30-planning/CODEX_HANDOFF_2026-10-01.md`（武器・敵のステータスの決定、2026-10-01）。

> この文書は「何が変わったか」と「どこを読めばよいか」だけをまとめる。中身の正本は各文書と作業メモ。

## 0. 今の担当（2026-09-28）

| 担当 | 役割 |
|---|---|
| Claude Code（総合担当） | ブラウザ版・Unity版の実装、素材の組み込み、発注書・下絵づくり |
| Claude（マップ担当・別チャット） | マップの企画・配置表・画像のレビュー |
| Claude（ゲームレビュー担当・別チャット） | Unity版の戦闘を点検表で調べて報告（コードは変えない）。`docs/30-planning/GAME_REVIEW_CHAT_HANDOFF_2026-09-28.md` |
| ChatGPT | イラスト・画像素材・背景の生成 |
| **Codex** | 使うことになったとき: **レビューと、ChatGPT への依頼文づくりの手伝い**（前回と同じ）。コードを変える作業を頼むときは、原作者がそう指示する |

- ブランチ: `ui/battle-reference-layout`（GitHub にプッシュ済み）。Unity は `unity-prototype/`。
- 会話は共有されない。判断は作業メモ `docs/90-worklogs/WORK_MEMO_2026-09-27.md`（9/27〜9/28 の分をまとめて書いている）に残っている。

## 1. 大きく変わったこと（9/26 → 9/28）

### マップ
- **2Dの斜めの1枚絵（1マス128×64の菱形）はやめた**。マップは **3Dの盤面＋2Dのキャラ（板の絵）** で作る（原作者 9/27）。理由: `docs/10-design/map/MAP_BOARD_METHOD_DECISION_2026-09-27.md`。
- 見せ方は**寄りの画面が基本**（横に約10マス。盤面全体は「全体」ボタン）。盤面の外は景色で埋める。
- 地面は**真上から見た1枚絵**を盤面の天面に貼る（タイルの画像生成がうまくいかなかったため）。国境監視路で試し、ブラッシュアップ版を採用（原作者 9/28「絵柄や色の雰囲気を優先」）。木は描いた木の絵を板にして立てる。
- **探索もこの3Dの盤面の上で行う**（原作者 9/28）。
- 絵の頼み方の標準: `docs/10-design/map/MAP_ART_PIPELINE_v1_2026-09-28.md`（床の1枚絵・壁の模様・小物の3種類。作る順番は 訓練場 → 城内廊下 → オルクス城内 → 謁見の間）。
- 制作仕様: `docs/10-design/map/UNITY_3D_BOARD_MAP_PRODUCTION_GUIDE_2026-09-27.md`（前の `UNITY_ISOMETRIC_MAP_PRODUCTION_GUIDE_2026-09-26.md` は旧案）。

### Unity版の戦闘
- 戦闘は Unity の3Dの盤面（`Assets/Scenes/Battle3D.unity`）で動く。盤面は国境監視路（地形の決まりが効く）。
- 戦闘の計算はブラウザ版の `battlePlan.js` と同じ（答え合わせのテスト 520件が一致）。
- UI はブラウザ版の意匠（黒紫・紫の帯・金の細罫線・明朝体）のまま作った。フォントは Noto Serif JP を同梱。
- 入ったもの: 戦技・魔法の一覧、攻撃の切り替え、補助の魔法、状態の時間、敵の行動予告と攻撃の前の予測、虚像・封印・転移・範囲攻撃、持ち物（消耗品）、専用戦技、召喚（リングホルムのヒトダマ）、戦況の画面（勝利条件・行動予告・マップ表）、隠れたキャラを見せる半透明、昼の光、足元の影。
- 1回目のレビュー: `docs/40-reviews/PLAYTEST_REVIEW_2026-09-28.md`。重さ高の3件（文字の小ささ・味方と敵の見分け・敵の予測のカメラ）は直した。点検表: `docs/40-reviews/PLAYTEST_CHECKLIST_v1.md`。

### 魔法・戦技の考え方（原作者 9/27）
- TRPG の魔法は、戦技・スキル・魔法の武器に振り分ける。アルバスが素で使える魔法は、因果Lv・兵種Lvで得るものだけ。仮の呼び名「魔核」。`docs/30-planning/MAGIC_CORE_DESIGN_NOTES_2026-09-27.md`。
- 召喚は戦技に入っているものだけ（ヒトダマ・1体まで・リングホルムが倒れたら消える）: `docs/30-planning/SUMMON_HITODAMA_DRAFT_2026-09-27.md`（試作対象）。

### 会話劇（原作者 9/28）
- 会話は探索の盤面を映したまま、立ち絵を左右の端に寄せ、やや斜めに向かい合わせる。方針: `docs/10-design/ui/DIALOGUE_STAGING_DIRECTION_2026-09-28.md`。
- 会話用の立ち絵は全員作り直す（今のはAIの仮）。発注書: `docs/30-planning/TACHIE_DIALOGUE_ORDER_2026-09-28.md`（最初は幼少期のアルシェ・カリマ）。

## 2. 読む順番

1. この文書
2. `docs/90-worklogs/WORK_MEMO_2026-09-27.md`（見出しを拾い読み。「決定」と書いた所が原作者の決定）
3. `docs/10-design/map/MAP_ART_PIPELINE_v1_2026-09-28.md`
4. `docs/10-design/ui/DIALOGUE_STAGING_DIRECTION_2026-09-28.md` と `docs/30-planning/TACHIE_DIALOGUE_ORDER_2026-09-28.md`
5. `docs/40-reviews/PLAYTEST_REVIEW_2026-09-28.md`（今の Unity版の見た目は `unity-prototype/Assets/Previews/` の画像で分かる）

## 3. Codex にお願いできること（原作者が頼んだとき）

| # | 内容 | 書く場所 |
|---|---|---|
| 1 | 発注書（マップの絵の作り方・会話用の立ち絵）を読んで、ChatGPT が誤解しそうな所・足りない所を指摘する | `docs/40-reviews/ORDER_REVIEW_YYYY-MM-DD.md` |
| 2 | ChatGPT から届いた絵のレビュー（発注書の「確かめること」に沿って） | `docs/40-reviews/ART_REVIEW_YYYY-MM-DD.md` |
| 3 | 原作者に頼まれたときの、依頼文の直し（届いた絵がずれていたときの頼み直し） | レビュー文書の中 |

- コードと素材は変更しない（原作者が別に指示したときを除く）。
- Unity の組み立て（バッチ）は、総合担当・レビュー担当と同時に走らせない。

## 4. 前回の引き継ぎから古くなったこと

- 「マップは斜め見下ろし、1マス横128×縦64の菱形」→ 3Dの盤面に変わった（上のとおり）。
- 「マップ担当は Codex」→ Claude の別チャットに移った（Codex が止まっていたため。9/26）。
- `MAP_UI_ASSET_ORDER_2026-09-26_v3.md` の M5（盤面の模様のドット絵）は、地面の1枚絵の方式に置き換わりつつある。
