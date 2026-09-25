# 戦闘マップ資料案内

更新: 2026-09-26

このフォルダは、戦闘マップの設計、世界観表現、画像素材の制作方針を管理する場所です。
2026-09-26以降は、Unity版の2:1アイソメトリック盤面を現行方針として扱います。

## 最初に読むもの

1. [`../../../PROJECT_CONSTITUTION.md`](../../../PROJECT_CONSTITUTION.md)
2. [`MAP_WORLD_AND_ART_DIRECTION_2026-09-26.md`](MAP_WORLD_AND_ART_DIRECTION_2026-09-26.md)
3. [`UNITY_ISOMETRIC_MAP_PRODUCTION_GUIDE_2026-09-26.md`](UNITY_ISOMETRIC_MAP_PRODUCTION_GUIDE_2026-09-26.md)
4. [`MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md`](MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md)
5. [`../../30-planning/UNITY_M1_PLAN_2026-09-26.md`](../../30-planning/UNITY_M1_PLAN_2026-09-26.md)
6. [`../../30-planning/MAP_IMAGE_CHAT_HANDOFF_2026-09-26.md`](../../30-planning/MAP_IMAGE_CHAT_HANDOFF_2026-09-26.md)

内容が食い違う場合は、`PROJECT_CONSTITUTION.md`、原作者の新しい決定、採用版文書、新しい正式設計、現在の実装事実、計画・作業記録の順で判断します。

## 区分

### Unity最新版

| 文書・素材 | 状態 | 現在の用途 |
|---|---|---|
| `MAP_WORLD_AND_ART_DIRECTION_2026-09-26.md` | 現行の設計基盤 | 原作TRPG、世界観、物語をマップへ翻訳する基準 |
| `UNITY_ISOMETRIC_MAP_PRODUCTION_GUIDE_2026-09-26.md` | 現行の制作仕様 | 2:1、128×64px、レイヤー分割、Unityへの受け渡し |
| `MAP_PROTOTYPE_BORDER_WATCHROAD_2026-09-26.md` | 比較用仮案 | 最初の非シナリオ12×8試作。A〜Cの配置比較 |
| `docs/30-planning/UNITY_M1_PLAN_2026-09-26.md` | 現在の実装計画 | Unity試作の到達点と次工程 |
| `assets/maps/iso_trial_12x8_guide.png` | 現行下絵 | 12×8盤面の位置合わせ基準 |
| `assets/maps/iso_trial_12x8.png` | 仮素材 | M1用の石畳・森の仮マップ。完成素材ではない |
| `unity-prototype/Assets/Art/Maps/iso_trial_12x8.png` | Unity取込済み仮素材 | 上記仮マップのUnity側コピー |

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

旧案の知見は捨てません。A案の「読みやすさ」、B案の「遮蔽対策」、C案の「世界観と高低差表現」を、固定アイソメトリック盤面へ統合します。

## マップ担当の現在の役割

- 原作TRPG、百年戦争編、国家・世界観資料を読み、舞台の意味を整理する。
- 盤面の遊び、物語上の選択、視認性を両立したマップ案を比較する。
- 画像生成前に複数案と用途を提示する。
- 承認後、下絵に合うマップ画像・地形部品の生成とレビューを行う。
- ゲームコードとUnityシーンの組み込みは変更しない。組み込み条件をClaude Codeへ渡す。
- 判断と再開地点を文書へ残し、別チャットでも継続できるようにする。
