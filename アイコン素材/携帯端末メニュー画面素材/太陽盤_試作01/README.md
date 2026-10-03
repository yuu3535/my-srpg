# 太陽盤 素材試作01

状態: 比較・試作用。正式採用ではない。
作成: 2026-10-03。組み込みの画像生成を使用。

追記: preview.html は試作03の枠・面の分離調整に更新。初期表示は試作03。
盤と針それぞれのサイズ・中心X/Y・角度・面の不透明度を調整できる。
試作03の構成・制限は ../太陽盤_試作03/README.md を参照。
このフォルダ内の試作01 PNGは保存したまま、版選択で切り替えられる。
試作02の生成条件・制限は ../太陽盤_試作02/README.md を参照。

## ファイル

- solar-glass-v01.png: ステンドグラス盤。1254×1254 RGBA。
- solar-rays-v01.png: 太陽の針・中心軸。1254×1254 RGBA。
- preview.html: 無地背景で透け方・重なり・回転を確認するローカル素材見本。

両素材は正面視・正方形。画像中心を同じ位置に合わせて配置し、中心を回転軸にする。
画面へ配置する際に表示領域でクリップする。元画像そのものは欠けた半円にしない。
命令札や文字・タップ判定は素材に焼き込まず別に配置する。

## 透過の確認と制限

外側は透過。ガラス内部は部分透過だが、白・琥珀の面に不透明に近い画素も多い。
ガラス面だけが一様に25〜40％となる完成済み素材ではない。
当初の試作はガラス層の表示不透明度32％、針の層を100％にして透け感を確認した。
この方式ではガラス盤に含まれる枠線も一緒に薄くなる。針は別層なので輪郭を保てる。
枠線を完全不透明に保つ必要が出た場合、ガラスと枠をさらに分ける案を検討する。
本編の透過率・色・回転速度・配置は未決定。回転／実機表示は未検証。

低アルファの周辺画素には赤・黄のRGB値が存在するため、通常のアルファ合成で扱う。
画像ビューアの背景処理によってこれが強く見える場合がある。透明度を無視して描画しない。

## 生成プロンプト

### ガラス盤

Use case: stylized-concept.
Asset type: transparent PNG game UI sprite, lower stained-glass layer of a two-layer ROTATABLE SOLAR COMMAND DIAL for a magical-engineering handheld menu.
Primary request: one complete circular stained-glass solar disk, strictly front-facing orthographic, centered on square 1536 x 1536 canvas. Center pivot exactly at image center. Circular outer boundary diameter 1320 pixels with clean transparent margin on every side. Full circle, never cropped. This is a usable separate image asset, NOT a UI screenshot or composition.
Design: refined lightweight contemporary magical engineering for a cheerful outgoing 13-year-old fantasy prince. A sun motif, NOT a compass rose. Thin concentric circular rims and a harmonious radial pattern of twelve broad curved flame/petal-shaped stained-glass sectors surrounding a small open center. Some sectors are pale near-clear glass; a small restrained portion carries soft honey-amber tint. Subtle neutral pearlescent glass reflections. Fine pale silver-champagne framing lines, slim and precise, low-relief, not chunky gold jewelry. Modern, bright, elegant and youthful without childish cartoon faces.
Layer separation: this lower layer contains ONLY the glass sectors, their slim structural seams and narrow circular rim. NO needles, no arrows, no spear-like compass points, no projecting sun-rays, no center hub, no commands, no texts, no numerals, no cardinal letters.
Transparency is essential: genuinely RGBA transparent outside the circle AND substantially translucent glass interiors with low alpha approx 20–35%, so a future scene image will remain clearly visible THROUGH the panes. Structure lines can be opaque or semi-opaque. Do not fill glass panes with opaque gray, solid cream or solid dark blue. Do not bake any sky, clouds, scenery, checkerboard, white background, black background or illustrative reflection of a scene into the sprite. Open center fully transparent. No cast shadow outside, no light bloom.
Rotational symmetry and evenly distributed detail, no perspective, no elliptical distortion, no directional lighting that looks odd when rotated, no ornate gothic rococo, no scratches/aged metal. High-quality crisp readable game raster artwork, delicate material highlights. SINGLE standalone disk only on a true transparent canvas.

### 針・中心軸

Use case: stylized-concept.
Asset type: separate top-layer transparent PNG sprite for a rotatable stained-glass SUN dial.
Input image 1 is ONLY a size, center-registration and material reference for the bottom-layer disk. DO NOT reproduce its glass panels.
Generate ONE isolated sunray/needle assembly with hub, on TRUE TRANSPARENT background. No whole menu screen.
Canvas: square 1254 x 1254, exact centered pivot at (627,627), orthographic front-facing. Fit the full assembly within a circle diameter approx 1180 pixels centered on the canvas, leaving transparent margin. Central hub approx 240 pixels diameter, covers the hole of the bottom disk.
Subject: delicate twelve-ray sun, rays radiate evenly every 30 degrees from a small round precision spindle/hub. Mix softly curved slim flame-like sunrays with simple narrow tapered needles, harmonious rotationally balanced solar silhouette. Refined pale champagne-silver metal, soft warm amber enamel line, small clear luminous bead at hub. Premium magical engineering for a bright 13-year-old prince. Lightweight, bright, playful, elegant, not an antique compass rose.
Construction: sparse thin opaque elements only. All spaces BETWEEN the rays must be FULLY TRANSPARENT so a separate glass disk and future scene can show through. Keep rays slender, their metal occupies little area. No outer ring, no glass panes, no solid disk behind needles, no backdrop, no black circular fill, no cream fill, no cast shadow, no blooming aura, no floating specks, no text, no labels, no N/S/E/W. No bulky gold star or ornate cathedral hardware.
Neutral subtle highlights so rotation around the center looks coherent. Exact square registered with reference disk. SINGLE clean complete circular top-layer game asset, no other objects.
