# SRPGプロジェクト文書案内

このフォルダは、プロジェクト直下に増えていたMarkdown文書を、役割別に整理したものです。

ゲーム本体のコード、画像・音声素材、生成物はここへ移していません。

## まず読む文書

| 知りたいこと | 開く文書 |
|---|---|
| このゲームで最優先する方針 | [`../PROJECT_CONSTITUTION.md`](../PROJECT_CONSTITUTION.md) |
| 複数の担当チャットでどう情報共有するか | [`00-core/MULTI_CHAT_COLLABORATION_GUIDE.md`](00-core/MULTI_CHAT_COLLABORATION_GUIDE.md) |
| Unity完成までに必要な作業の全体像 | [`00-core/UNITY_GAME_DEVELOPMENT_MASTER_CHECKLIST.md`](00-core/UNITY_GAME_DEVELOPMENT_MASTER_CHECKLIST.md) |
| 理想の戦闘ルール | [`10-design/battle/BATTLE_RULES_V2.md`](10-design/battle/BATTLE_RULES_V2.md) |
| UIの方向性と試作方針 | [`10-design/ui/UNITY_SRPG_UI_DESIGN_DIRECTION_DRAFT.md`](10-design/ui/UNITY_SRPG_UI_DESIGN_DIRECTION_DRAFT.md) |
| 現在のブラウザ版に何が実装されているか | [`20-implementation/CURRENT_GAME_SYSTEM_2026-09-21.md`](20-implementation/CURRENT_GAME_SYSTEM_2026-09-21.md) |
| 次に何をするか | [`30-planning/NEXT_ACTION_QUEUE.md`](30-planning/NEXT_ACTION_QUEUE.md) |
| 直近の作業内容 | [`90-worklogs/WORK_MEMO_2026-09-24.md`](90-worklogs/WORK_MEMO_2026-09-24.md) |

## フォルダの役割

### `00-core` — 全担当で共有する基盤

- [`MULTI_CHAT_COLLABORATION_GUIDE.md`](00-core/MULTI_CHAT_COLLABORATION_GUIDE.md)：ゲームシステム、マップ、シナリオ、Unity実装など、担当チャット間の共有方法
- [`UNITY_GAME_DEVELOPMENT_MASTER_CHECKLIST.md`](00-core/UNITY_GAME_DEVELOPMENT_MASTER_CHECKLIST.md)：Unityで完成させるまでに必要な項目の総覧

### `10-design` — ゲームの理想・仕様案

#### 戦闘・成長

- [`battle/BATTLE_RULES_V2.md`](10-design/battle/BATTLE_RULES_V2.md)：戦闘ルール案
- [`battle/COMBAT_ARTS_DESIGN.md`](10-design/battle/COMBAT_ARTS_DESIGN.md)：戦技・スキル設計案
- [`battle/TRPG_SRPG_DESIGN_THINKING.md`](10-design/battle/TRPG_SRPG_DESIGN_THINKING.md)：TRPGらしさをSRPGへ翻訳する考え方
- [`battle/TRPG_TO_SRPG_STAT_CONVERSION.md`](10-design/battle/TRPG_TO_SRPG_STAT_CONVERSION.md)：能力値変換の検討
- [`battle/trpg_to_srpg_damage_design.md`](10-design/battle/trpg_to_srpg_damage_design.md)：ダメージ式の検討

#### UI・世界観表現

- [`ui/UNITY_SRPG_UI_DESIGN_DIRECTION_DRAFT.md`](10-design/ui/UNITY_SRPG_UI_DESIGN_DIRECTION_DRAFT.md)：Unity向けUI設計方針のたたき台
- [`ui/WORLD_UI_DIRECTION_MEMO.md`](10-design/ui/WORLD_UI_DIRECTION_MEMO.md)：世界観とUI表現の方向性

### `20-implementation` — 現在の実装事実

- [`CURRENT_GAME_SYSTEM_2026-09-21.md`](20-implementation/CURRENT_GAME_SYSTEM_2026-09-21.md)：現行ブラウザ版の実装監査
- [`PROJECT_DEV_LOG.md`](20-implementation/PROJECT_DEV_LOG.md)：開発履歴

設計資料に書かれた理想と、現在動いている処理を混同しないための場所です。

### `30-planning` — 次の作業と担当間調整

- [`NEXT_ACTION_QUEUE.md`](30-planning/NEXT_ACTION_QUEUE.md)：作業候補と優先順
- [`SYNC_AGENDA.md`](30-planning/SYNC_AGENDA.md)：担当間で確認する議題

### `40-reviews` — 調査・レビュー結果

- [`CLEANUP_REVIEW.md`](40-reviews/CLEANUP_REVIEW.md)：整理・清掃観点のレビュー
- [`DECLARATION_PATCH_REVIEW.md`](40-reviews/DECLARATION_PATCH_REVIEW.md)：宣言や仕様差分のレビュー
- [`DEVELOPMENT_REVIEW_MEMO.md`](40-reviews/DEVELOPMENT_REVIEW_MEMO.md)：開発全体のレビュー記録

### `90-worklogs` — 日付つき作業記録

- 完成仕様ではなく、「その時点で何を調べ、何を決めたか」を追うための履歴です。
- 新しい記録ほど現在に近いですが、正式仕様は上位方針・設計文書を優先します。

## `docs` 外に残している文書

- [`../AGENTS.md`](../AGENTS.md)：Codex / Claude Code 共通のAI作業指示。場所を変えない。
- [`../CLAUDE.md`](../CLAUDE.md)：`AGENTS.md` を読み込んだうえでのClaude Code固有の補足。場所を変えない。
- [`../PROJECT_CONSTITUTION.md`](../PROJECT_CONSTITUTION.md)：ゲーム全体の最上位方針。見失わないようルートに残す。
- [`../採用版md/README.md`](../採用版md/README.md)：採用済みの能力値・成長率資料。検討中の設計資料と区別する。
- `output/`、`outputs/`：生成した報告書や出力物。
- `assets/`、`tools/`、各素材フォルダ：その対象に密接な説明文書を同居させる。

## 内容が食い違ったときの優先順

1. `PROJECT_CONSTITUTION.md` の最上位方針
2. `採用版md/` にある採用済み仕様
3. `docs/10-design/` の新しい正式設計
4. `docs/20-implementation/` に記録された現在の実装事実
5. `docs/30-planning/` の予定・議題
6. `docs/40-reviews/` と `docs/90-worklogs/` の検討・履歴

設計を変更した場合は、関連する正式文書を更新し、必要なら最新の作業メモに変更理由を残します。
