# 太陽盤 素材試作02

作成: 2026-10-03。状態: 比較用試作。正式採用・本編反映は未実施。
生成方法: 組み込み画像生成。元素材は上書きせず別ファイル保存。

## 原作者の修正指示
「全体的に色がキラキラしすぎかもしれない(針とかすごく綺麗だけどね)」
添付のスキル・武器アイコン、アルシェSD、2D回廊と調和させる。

## 修正内容
- 針の曲線と先端の形は参考に残す。
- 虹色・真珠光沢・宝石状の中心軸・細かなきらめきを抑える。
- 剣のアイコンに合わせた輪郭、広い明暗面、白銀と控えめな金へ寄せる。
- ガラス盤と針は別層のまま。背景絵は素材に焼き込まない。

## ファイル
- solar-glass-v02.png: 1254×1254 RGBA、正面視の全円。
- solar-rays-v02.png: 1254×1254 RGBA、針と中心軸。
- corridor-reference.png: 原作者が添付した参考画像の保存コピー。素材への色合わせ・背景合成確認用。背景としての正式採用を意味しない。
- 比較ページ: ../太陽盤_試作01/preview.html
  現在は枠と面を分離した試作03を初期表示し、試作02・01へ切り替え可能。
  盤・針それぞれの面の不透明度、サイズ、中心X/Y、回転と背景を選択できる。
  参考アイコン・SD・マップも並べて確認できる。

## 透過・位置の注意
外側は透過。ガラス面には不透明に近い画素が残るため、表示側の不透明度32％を仮の初期値とする。
ガラスの枠も一緒に薄くなる。針の輪郭は独立して保てる。
一様なガラス面の半透明化が完了した素材とは扱わない。
同じ画像中心で重ねる。生成画像なので回転対称性・厳密な形の一致は本番前に確認が必要。
元画像の欠けない全円を残し、画面上の表示領域でクリップする。

## ガラス盤生成プロンプト
Use case: precise-object-edit.
Asset: isolated transparent PNG lower layer of rotatable solar stained-glass game UI dial.
Input 1: EDIT TARGET, previous glass disk, keep its complete circular silhouette, concentric rings, center hole, and flowing radial solar-petal layout.
Input 2: skill icon STYLE REFERENCE for quiet matte gold and restrained shading.
Input 3: sword icon PRIMARY STYLE REFERENCE: clean outlined anime game art, broad simple faceted values, ivory/silver and ochre metallic details, no glitter.
Input 4: cheerful 13-year-old prince SD sprite supporting STYLE REFERENCE, defined edges and soft cel-shaded surfaces.
Input 5: 2D corridor supporting world art reference, not content to put inside this asset.
Primary change: make the disk stylistically belong to these existing 2D painted/cel-shaded game assets. Remove ALL rainbow pearlescent swirls, iridescence, jewel sparkle, glow and cloudy white gleam. Remove decorative tiny diamonds and microdetail. Keep sun petal curves but draw clean simple thin structural seams.
Glass panes: smooth lightly tinted translucent neutral glass and a few soft subdued honey-colored panes; large calm flat fields, one restrained reflected edge per pane at most. Never cloudy glitter, rainbow interference or photoreal gemstone rendering.
Rim and seams: understated warm ochre/gold like sword fittings, thin dark warm-gray contour separating surfaces, only two or three broad shading values. Natural matte/satin appearance, not mirror chrome.
Preserve centered registration on SQUARE 1254x1254 canvas. Full front-facing orthographic circle with margin, center exactly image center, no perspective. Open center and outer background true alpha zero; glass interiors ideally genuinely low-alpha translucent tint. Never paint scene or checkerboard into panes.
No needles, hub, arms, rays, text, commands, labels, cardinal letters, symbols or character portrait. No glow, star sparkle, flecks, particles, scratches, rococo metalwork. One complete isolated clean PNG layer, not a product mockup or complete menu.

## 針生成プロンプト
Use case: precise-object-edit.
Asset: transparent PNG upper needle/ray and hub layer of rotatable SUN dial.
Input 1 EDIT TARGET: prior isolated twelve-ray sun assembly. Preserve its appealing silhouette: alternating slender diamond-tipped needles and softly curved flame rays, twelve evenly spaced radial elements, central circular hub, complete uncropped circular footprint.
Input 2 prayer icon STYLE reference: restrained broad matte gold shades, clean readable silhouette.
Input 3 sword PRIMARY STYLE reference: clean anime/cel-shaded game icon with ivory/silver fields, subdued ochre-gold edges, broad geometric light/shade planes and clear dark edge outlines.
Input 4 SD character STYLE reference for line weight and controlled cel shading.
Input 5 corridor WORLD STYLE reference. Do not paint this scenery or character into this asset.
Change only finish/style: eliminate EVERY rainbow opal reflection, iridescent marble swirl, glitter, sparkle, luminous gem and tiny glossy fleck from rays and hub. Replace with smooth satin metal, ivory/silver faces with two or three clean shading planes, narrow warm ochre-gold borders, fine dark warm-gray outline. Hub is a simple matte silver/ivory enamel spindle with one subtle highlight, not a radiant glass gemstone.
Art belongs to the same 2D fantasy game as the supplied icons and SD. Quiet, clean, lightly painted cel shading. Shape may be beautiful but the material must be calm and readable at small UI size.
Square 1254x1254, front-facing orthographic, exact central pivot at image center, diameter ~1180 pixels with transparent margin all sides. Maintain full balanced twelve-ray sun, not a compass rose.
TRUE RGBA transparent outside the hub/rays and BETWEEN EVERY ray. No background ring, no stained glass sector fillings, no solid disk filling the gaps, no cast shadow, no glow, no bloom, no particles, no specks, no text, no letters or symbols. Single isolated top-layer asset.
