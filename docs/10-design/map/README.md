# 戦闘マップ資料案内

更新: 2026-09-27

このフォルダは、戦闘マップの設計、世界観表現、画像素材の制作方針を管理する場所です。
2026-09-27以降は、Unity版の **3Dの盤面＋2Dのキャラ** を現行方針として扱います（原作者の決定）。

## 最初に読むもの

1. [`../../../PROJECT_CONSTITUTION.md`](../../../PROJECT_CONSTITUTION.md)
2. [`MAP_WORLD_AND_ART_DIRECTION_2026-09-26.md`](MAP_WORLD_AND_ART_DIRECTION_2026-09-26.md)
3. [`UNITY_3D_BOARD_MAP_PRODUCTION_GUIDE_2026-09-27.md`](UNITY_3D_BOARD_MAP_PRODUCTION_GUIDE_2026-09-27.md)
   - なぜ3Dか: [`MAP_BOARD_METHOD_DECISION_2026-09-27.md`](MAP_BOARD_METHOD_DECISION_2026-09-27.md)
   - 色・明るさ: [`MAP_COLOR_MOOD_DIRECTION_2026-09-27.md`](MAP_COLOR_MOOD_DIRECTION_2026-09-27.md)
4. [`MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md`](MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md)
5. [`../../30-planning/UNITY_M1_PLAN_2026-09-26.md`](../../30-planning/UNITY_M1_PLAN_2026-09-26.md)
6. [`../../30-planning/MAP_IMAGE_CHAT_HANDOFF_2026-09-26.md`](../../30-planning/MAP_IMAGE_CHAT_HANDOFF_2026-09-26.md)

内容が食い違う場合は、`PROJECT_CONSTITUTION.md`、原作者の新しい決定、採用版文書、新しい正式設計、現在の実装事実、計画・作業記録の順で判断します。

## 区分

### Unity最新版

| 文書・素材 | 状態 | 現在の用途 |
|---|---|---|
| `MAP_WORLD_AND_ART_DIRECTION_2026-09-26.md` | 現行の設計基盤 | 原作TRPG、世界観、物語をマップへ翻訳する基準 |
| `UNITY_3D_BOARD_MAP_PRODUCTION_GUIDE_2026-09-27.md` | **現行の制作仕様** | 3Dの盤面の決まり・重ねる層・マップのデータ（地形の表）・画像素材・Unityへの受け渡し |
| `MAP_BOARD_METHOD_DECISION_2026-09-27.md` | 決定の記録 | 作り方・回し方・角度・高い物・明るさを最上位方針の物差しで比べた |
| `MAP_COLOR_MOOD_DIRECTION_2026-09-27.md` | 方針案 | 原作TRPGの背景素材から読み取った彩度・色・雰囲気 |
| `MAP_3D_BOARD_TEST_REQUEST_2026-09-26.md` | 試作の記録 | 3Dの盤面の見え方の試作 T1〜T5 と原作者の決定 |
| `MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md` | 試作対象（案B改） | 最初の非シナリオ12×8試作。A〜Cの配置比較と、採用した案B改の地形表 |
| `graybox/border_watchroad_*.png` | 試作対象の図 | 案の比較図、案B改の配置図・地形の配置図（ChatGPTへ渡す） |
| `concepts/reference_battle_screen_*` | 原作者の見本 | 目指す戦闘画面の見た目（斜め見下ろし・石のブロックの城壁） |
| `docs/30-planning/UNITY_M1_PLAN_2026-09-26.md` | 現在の実装計画 | Unity試作の到達点と次工程 |

### ブラウザ試作向け

| 文書・素材 | 状態 | 現在の用途 |
|---|---|---|
| `docs/30-planning/ISO_MAP_ORDER_2026-09-26.md` | ブラウザ試作の発注文 | 下絵寸法と2:1座標の参考。Unity完成素材の全仕様ではない |
| `MAP_GRAYBOX_COMPARISON_2026-09-24.md` | 比較用仮案 | ルート分岐、橋、水路、報酬配置の考え方だけ再利用する |
| `graybox/graybox_B_7x8.svg` | ブラウザ用白地図 | 操作確認の履歴 |
| `graybox/graybox_B_9x8.svg` | ブラウザ用白地図 | 経路選択の履歴 |

### 旧案

| 文書・素材 | 状態 | 現在の用途 |
|---|---|---|
| `UNITY_ISOMETRIC_MAP_PRODUCTION_GUIDE_2026-09-26.md` | 旧制作仕様（2Dの斜めの1枚絵） | 論理マップ先行・高い物の分離・見やすさの基準は3Dへ引き継いだ |
| `docs/30-planning/MAP_ORDER_BORDER_WATCHROAD_2026-09-26.md` | 取りやめ | 斜めの地面マップの依頼文（当時の記録） |
| `docs/30-planning/ISO_MAP_ORDER_2026-09-26.md` | 旧案 | ブラウザ試作の斜めの絵の依頼文 |
| `assets/maps/iso_trial_12x8*.png`、`unity-prototype/Assets/Art/Maps/iso_trial_12x8.png` | 旧素材 | 2Dの斜めの仮マップと下絵。ブラウザ版と Unity の `BattleM1`（比べるために残す）が使う |
| `MAP_VIEWPOINT_COMPARISON_2026-09-24.md` | 方針変更前の比較記録 | A・B・C視点を比較した判断過程を残す |
| `MAP_CAMERA_VIEW_POLICY_DRAFT.md` | 旧カメラ案 | B視点を標準とした案。遮蔽対策だけはUnity設計にも活かせる |
| `concepts/map_viewpoint_A_topdown_wide.png` | 雰囲気確認用 | 真上視点の参考。実装素材ではない |
| `concepts/map_viewpoint_B_three_quarter.png` | 雰囲気確認用 | 浅い斜め視点の参考。実装素材ではない |
| `concepts/map_viewpoint_C_isometric.png` | 雰囲気確認用 | アイソメの印象参考。マス位置を保証しない |

## 背景たたき台の扱い

`マップ背景イメージたたき台/` は、すべて雰囲気確認用です。ゲームへ直接組み込む完成素材ではありません。

- `Concept image of the Alstro royal capital.png`: アルストロの白石、青屋根、水路、庭園、聖堂建築の参考。
- `Concept image of the battle UI.jpeg`、英数字名の戦闘画面3点: 盤面とUIの密度、斜め見下ろしの印象参考。壁や樹木が多く、そのままでは遮蔽が強すぎる。
- `雰囲気1.png`〜`雰囲気3.png`: 黒、鈍い金、宗教画・ステンドグラス・運命の象徴表現の参考。盤面画像ではない。

## 方針変更の要点

- 2026-09-24: 操作性を優先し、B案の浅い斜め見下ろし＋正方格子を初期候補にした。
- 2026-09-25〜26: ブラウザで2:1アイソメトリックを試作し、マス選択が成立することを確認した。
- 2026-09-26: Unity版をスマホ横画面、2:1アイソメトリック、1マス128×64pxで進めることを原作者が決定した。
- 2026-09-26〜27: 盤面を回して見たいという原作者の希望から、3Dの盤面の見え方を試作（T1〜T5）。
- 2026-09-27: マップは3Dの盤面＋2Dのキャラで作ると原作者が決定。Unity版の戦闘（M1）を3Dの盤面に置き換えた。

旧案の知見は捨てません。A案の「読みやすさ」、B案の「遮蔽対策」、C案の「世界観と高低差表現」を、固定アイソメトリック盤面へ統合します。

## マップ担当の現在の役割

- 原作TRPG、百年戦争編、国家・世界観資料を読み、舞台の意味を整理する。
- 盤面の遊び、物語上の選択、視認性を両立したマップ案を比較する。
- 画像生成前に複数案と用途を提示する。
- 承認後、地形の表・高い物の表を作り、ChatGPTへの模様・部品・背景の依頼文を作ってレビューする（3Dの盤面。2026-09-27〜）。
- ゲームコードとUnityシーンの組み込みは変更しない。組み込み条件をClaude Codeへ渡す。
- 判断と再開地点を文書へ残し、別チャットでも継続できるようにする。
