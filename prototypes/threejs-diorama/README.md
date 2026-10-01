# 2.5D箱庭マップ表示の試作（オルクス魔王城・玉座の間）

Three.js で、手描きの透過PNG・SDキャラ・簡単な3Dの箱を組み合わせ、斜め上から見下ろす箱庭のSRPGマップを試す。
ゲーム本編（ルートの `index.html`）とは別の試作。ブランチ `trial/threejs-diorama`（原作者 2026-10-01）。

- 床・壁・段（玉座台・階段）・柱 … 簡単な3Dの箱（`MapScene.buildArchitecture`）
- 玉座・ステンドグラス・旗・垂れ布・松明・魔灯・キャラ … 透過PNGを板（PlaneGeometry）にして立てる
- 前後関係は Three.js の深さ（depth test）で決まる。板も3Dの位置に立つので、キャラが松明の奥を通れば松明が前、手前を通ればキャラが前になる

## 起動方法

Node.js（v20 以上）が必要。初回だけ部品を入れる:

```bash
cd prototypes/threejs-diorama
npm install
```

開発用のサーバー（調整の窓つき）:

```bash
npm run dev
```

`http://localhost:5188` を開く。書き出し（`dist/`）は `npm run build`、確かめるときは `npm run preview`。

### 操作

| 操作 | 内容 |
|---|---|
| クリック | アルシェがそのマスへ動く（0.3秒。通れないマスは赤く光って動かない） |
| G | グリッドの表示・非表示 |
| Shift＋クリック | 板・キャラの position・rotation・scale・grid を左上に出す（開発用） |

URL の確認用の指定: `?at=5,7`（キャラをそのマスに置く）・`?grid`・`?rot=30`（マップを回す）・`?nogui`（調整の窓を隠す）・`?debug`（書き出した版でも調整の窓を出す）。

## 素材の追加方法

```
public/assets/
  maps/        床に敷く絵（真上から見た形）
  props/       立てる小物（透過PNG）
  characters/  SDキャラ（透過PNG・足元が下の端）
```

- 画像を上のフォルダに置き、`src/MapData.js` から `assets/props/〜.png` のように指す。
- 見つからない素材は、名前を書いた紫の仮の板になる（止まらない。コンソールに一覧が出る）。
- 玉座の間の素材は `tools/prepare_assets.py` で作り直せる（`npm run assets`）。
  - `背景/orcus_throne_room_assets/` から写す（元の絵は変えない）。まとめ画像から切り分けたときに残った「となりの素材の切れ端」を消し、絵の所だけに切り詰める。
  - 斜めから描いた絨毯（台形）を、真上から見た長方形に引き伸ばす（`06e_carpet_top.png`）。
  - 床の絵（`07_floor`）も同じように引き伸ばすが、光の筋が斜めに崩れるので今は使わない。床はコードで描いた石畳。
  - SDキャラは `unity-prototype/Assets/Art/SD/` から写す。

## 新しい小物（PROP）の配置方法

`src/MapData.js` の `props` に1行足す。

```js
{ id: 'torch_l3', src: 'assets/props/05a_torch_orange_large.png', grid: { x: 5, y: 11 }, height: 2.0, billboard: true, blocks: [[5, 11]],
  glow: [{ color: '#ff8a3a', at: [0, 0.82], size: 2.0, floor: true }] },
```

| 項目 | 意味 |
|---|---|
| `grid: { x, y }` | 置くマス（x＝左→右、y＝奥→手前）。小数も使える（`7.5` ＝ 7列と8列の境、`-0.4` ＝ 奥の壁ぎわ） |
| `y` | 高さ。省くとそのマスの地面の高さ（玉座台の上なら 1.2） |
| `height` / `scale` | 板の高さ（world unit）。`scale` なら 絵のpx ÷ 40 × scale |
| `offset` / `rotation` | 位置のずらし・向き（`{ x, y, z }`。rotation はラジアン） |
| `billboard` | true でいつもカメラを向く（独立して立つ松明・魔灯など）。壁や柱に下げる物は false |
| `stretch` | 立てた板を、カメラの傾きの分だけ縦に伸ばして描いた絵の比率のまま見せる（既定 true）。奥の壁の絵は false |
| `layer` | 同じ位置に重なる物の描く順（大きいほど後） |
| `blocks` | 通れなくするマスの一覧 |
| `glow` | 炎の光のにじみ。`at` は板の中の位置（横 −0.5〜0.5、縦 0〜1）。`floor: true` で床への映りこみの筋 |
| `selfLight` | 絵の自分の明るさ（0〜1。光が当たらなくても絵が暗く沈まない） |
| `visible` | false で最初は隠す（調整の窓の「素材の表示」で出せる） |

置く場所は、`npm run dev` で Shift＋クリックして position を見ながら決めるとよい。

## マップサイズの変更方法

`src/MapData.js` の `cols`・`rows` と、同じ大きさの文字の層を変える。

- `heights` … 1文字＝1マス。`legend` で文字 → 高さ・種類（`.` 床・`P` 柱・`D` 玉座台・`1`〜`3` 階段）。
- `surface` … `c` のマスに絨毯（床の上は1枚の絵、段の上は布の帯）。

1マス＝1 world unit＝40px（`PX_PER_UNIT`）。マスと座標の変換は `GridSystem.gridToWorld` / `worldToGrid`。

## カメラ調整方法

- `npm run dev` で右上の「調整（開発用）」→「カメラ」。camera X・Y・Z、見る点の高さ・奥行き、zoom、map rotation を動かせる。
- 良い所で「カメラの値をコピー」→ `src/MapData.js` の `camera` に貼る（最終的には固定のカメラにする）。
- 絵が正面から描かれているので、既定は正面の斜め上（OrthographicCamera）。map rotation を付けると、斜めから見た箱庭になる。
- 光の強さ（全体・ステンドグラス・松明・魔灯）と画面の明るさも同じ窓で変えられる。光の色と位置は `MapData.js` の `lights`（松明は代表の2か所だけに光を置き、ほかは光のにじみで見せる）。

## ファイル

```
src/
  main.js          起動・調整の窓（lil-gui）・HUD
  MapScene.js      シーン・3Dの箱・板の小物・光・カメラ・マウス
  GridSystem.js    マス ⇔ 座標・高さ・通れるか・グリッドの線・ホバーと選択の印
  MapData.js       玉座の間の中身（座標はここに書く）
  AssetManager.js  画像の読み込み・仮の板・コードで描く石の模様・光のにじみ
  Unit.js          SDキャラ（カメラを向く板・足元の影・なめらかな移動）
  styles.css       HUD（黒紫・紫の帯・金の細罫線・明朝体）
tools/prepare_assets.py  素材の下ごしらえ
```
