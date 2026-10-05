# SD戦闘モーション PoC

状態: **比較資料 / 腕付きv2の見た目は原作者から不自然との指摘（2026-10-05）**。本編・Unity未接続、作画方式の正式採用ではない。

現在試しているのは [共通身体＋頭差し替え](shared-body/README.md)。`http://127.0.0.1:8788/shared-body/` を開く。このページ以下の腕リグは経緯と比較用に保存し、自然な動作が確認済みとは扱わない。全身パーツ分割で量産する決定もしていない。

AutoSpriteと既存のスプライトシート方針を変更するものではない。幼少アルシェの右腕（画面右側）を肩・肘・手に分け、ユーザー作成のオルクス剣SDを持たせた。待機と「構え→斬り→復帰」を確認できる。反対の腕と脚は静止画のまま。

## 開き方

PowerShellでこのフォルダーへ移動し、次を実行する。

```powershell
py -3.12 -m http.server 8788
```

ブラウザーで `http://localhost:8788/` を開く。`fetch` でJSONを読むため、`index.html`のダブルクリックではなくローカルサーバーを使う。

「攻撃」→「再生」。再生位置で停止ポーズを見られる。「肩・肘・手・足元を表示」で接続点を確認。左右反転、速度、握り位置、剣サイズはその場の確認用で、JSONへの保存はしない。「調整値を初期化」で戻せる。

## 現在の構成

- `motion-v2.json`: 腕付きモーションの原本。体格、肩位置、各関節、剣Grip/Pivot、身体・腕のキーを保持。
- `motion-core-v2.js`: DOMに触れない補間と関節計算。ブラウザと書き出しが**同じJS評価器**を使う。
- `app.js`: Canvasプレビューと調整UI。
- `export_motion.js`: Nodeで上記評価器を実行し、フレーム行列をJSON出力。
- `generate-v2.py`: その行列でAPNG・SpriteSheet・メタデータを出力し、画像・時間・関節を検証する。
- `verify_rig.js`: 接続、握り位置、復帰、ループ、角度変化のテスト。
- `assets/character/young_arshe.png`: Unity側の原本を変更せずコピーしたPoC用スナップショット。
- `assets/rig/`: 画像生成による試作パーツ、生成原本と透過処理後のアトラス。
- `assets/weapon/orcus_sword.png`: ユーザー提供PNGの複製。原本を変更せず、描画時に縮小する。
- `prepare_rig_assets.py`: 既存の `tools/tachie_studio.py` で薄いハローを除き、4パーツに切り出す。
- `ASSET_PROMPTS.md`: 画像生成の指示と素材の履歴。

旧 `motion.json` / `motion-core.js` / `generate.py` / `verify_core.js` / `generated/` 直下はv1比較用。現在の画面はv2のみ読む。

## 再生成

NodeとPython 3.12、Pillow 12.3.0で確認。腕素材の再切り出しには既存Tachie Studioの依存環境とモデルも必要（通常の書き出しには不要）。

```powershell
node verify_rig.js
py -3.12 generate-v2.py
```

書き出し:

- `generated/v2/idle.apng` / `attack.apng`
- `generated/v2/idle_sheet.png` / `attack_sheet.png`
- `generated/v2/idle_frames.json` / `attack_frames.json`
- `generated/v2/attack_pose_review.jpg`
- `generated/v2/verification.json`

24fps目安、待機1.5秒・攻撃1.05秒。APNGの同一連続コマは時間を合算するので攻撃は25コマ、シートは26コマ。端点姿勢は `*_end.png`。

初期の剣縮尺は0.08（元画像の8％、UIはこれを1.00倍と表示）。肩→上腕→肘→前腕→手→剣の順で位置を計算し、描画順を切り替える。攻撃の命中・ダメージ判定はこのデータに入れていない。

## 素材の選定と限界

`unity-prototype/Assets/Art/SD/young_arshe.png` を選んだ。人型で、武器・盾・エフェクトが人物画像に描き込まれていないため、別武器レイヤーの最小検証に向く。原本は読み取りだけで、PoCは複製を読む。

v2はその画像を参照し、画像生成で腕のない胴体と上腕・前腕・握り手のアトラスを作った。顔・衣装は近いが、**原本の完全な切り抜きではなく、細部に変化がある**。関節の継ぎ目・肩の接続・背面の隠れ方は作画確認対象。動く腕と実武器の連動確認が目的で、完成作画ではない。

剣は `立ち絵透過下処理/武器/オルクス剣SD.png` のRGBAを複製し、周囲の光も保持した。入力武器や元キャラを上書きしていない。

## Unityへ進む前の判断項目

1. 攻撃の作画方式を「腕パーツ」「ポーズ差分」「AutoSpriteの完成コマ」のどれにするか。
2. 2体目の異なる体格・手位置に、同じ攻撃キーを適用して調整量を測る。本PoCの1体だけで全キャラへ流用可能とは判断しない。
3. Unityでは、スプライトシートとフレーム情報を読む方式か、JSONを実時間再生する方式かを性能・作画修正コストで比較する。
