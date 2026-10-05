# 画像生成プロンプト記録

状態: 試作対象。2026-10-05。組込み画像生成を使用し、全呼出しで `transparent_background: true`。

参照: 既存SDの young_arshe.png、young_karima.png、gunter.png。身体の衣装は新規の仮衣装、頭は参照ベースの編集。生成で細部が変化したため、厳密な原画切り出しとして扱わない。

幼め身体は young_arshe を参照。標準身体は生成した幼め身体と gunter を参照。頭アトラスは3人の元画像を参照。修正は直前のアトラスを編集対象とした。

## 幼め身体

```text
Use case: stylized-concept. Asset type: reusable transparent 2D anime SRPG CHILD body template, one asset, square 1024x1024. Input image 1 is STYLE AND PROPORTION reference only, not an edit target. Generate ONE headless clothed chibi body from the neck down, designed to receive a separate head. Complete continuous body with both arms and legs, not separate parts. Intended full character approximately 2.5 heads tall once its separate oversized head is added. Keep the top 35% of the square completely empty for the future head. Neck around x480 y390, boots at y930. Three-quarter front view facing RIGHT, like the reference. Neutral gender-compatible junior light swordsman PROTOTYPE uniform: off-white rolled sleeves, charcoal fitted vest with simple muted silver edging, short dark trousers, belt, dark leather boots, no emblem, no tie, no cape. Light warm skin. Natural grounded ready stance, knees slightly soft, one foot forward. Viewer-right arm bent comfortably forward, small gripping fist at waist/chest height positioned to hold a separate upright sword, other arm relaxed but alert. NO head, no face, no hair, no ears, no dummy oval, no sword or weapon, no severed-neck gore; short clean neck stump is a technical game part. Crisp dark indigo outlines, reference-matched anime cel shading with 2-3 clear tones, readable silhouette at 70 pixels. Genuine transparent background with zero alpha outside solid drawn contours. No ambient haze, no halo, no floor, no shadow, no effects, no text or grid. Both boots and all fingers intact. Do not include the reference head or any detached extra pieces.
```

## 標準身体

```text
Use case: stylized-concept. Asset type: reusable transparent 2D anime SRPG STANDARD body template, one square asset. Image 1: shared CHILD body reference for exact uniform, cel shading, pose and palette. Image 2: adult chibi STYLE/PROPORTION reference, do not copy its purple coat. Primary request: create a matching STANDARD adult-sized headless clothed body, intended around 3 heads tall after a separate head is added. Same three-quarter front-right orientation and ready pose as image 1; slightly longer torso and legs, restrained broader shoulders, not muscular or realistic. Same off-white rolled sleeves, charcoal vest with muted silver trim and buttons, dark belt and dark leather boots. Replace shorts with straight dark trousers tucked into boots. Viewer-right forearm bent forward, closed gripping fist ready for a separate upright sword; viewer-left arm relaxed. ONE complete continuous body from a short clean neck stump to both boot soles, no detached pieces. Reserve top 30% for head. NO head, no face, no hair, no ears, no dummy head, no sword, no weapon, no shield. Genuine transparent background, zero-alpha everywhere outside the solid outline, no haze/halos/glow/shadow/ground, no text, no grid. Preserve the outfit design from image 1; practical interchangeable-body prototype, not a redesign of the named adult character.
```

## 頭アトラス

```text
Use case: precise-object-edit. Asset type: ONE transparent technical sprite atlas of THREE isolated original character HEAD cutouts, landscape 1536x1024, no labels. Input image 1: exact black-haired child Arshe head extraction target. Input image 2: exact white-haired child Karima head extraction target. Input image 3: exact purple-haired eyepatch adult Gunter head extraction target. Preserve each original face, expression, eyes, bangs, hair shape, ahoge, ears, cel shading and outline as faithfully as possible; extraction, NOT character redesign. Put Arshe in LEFT THIRD, Karima in MIDDLE THIRD, Gunter in RIGHT THIRD, each at a comparable head scale, chin around y720, all hair safely within its own 512px column. Remove ALL clothing, neck, shoulders, torsos, limbs and weapons, retaining only the whole head including ears, complete hairstyle and chin silhouette. No busts, no collars, no floating accessories, no duplicates. Keep Arshe's gold/orange eyes, Karima's gold and blue heterochromia, Gunter's existing eyepatch on the same side, visible gold eye and pointed ear. Clean game-sprite cutouts on genuine transparency with zero alpha outside solid contours, only narrow antialiased edges. No background, no grid, no text, no shadow, no fog, no halo or glow. These heads will be placed onto separately drawn shared bodies; keep chin edge clean and intact.
```

## アトラスの間隔・ハロー除去の修正

```text
Use case: precise-object-edit. Edit target: the three-head sprite atlas. Change ONLY layout spacing and surrounding background, not the characters. Keep the same three heads, Arshe left, Karima middle, Gunter right. Reduce each head INCLUDING all hair/ahoge to a maximum width of 360 pixels, centered at x256, x768, x1280 in a 1536x1024 transparent canvas. All three heads must be fully isolated with at least 120px COMPLETELY TRANSPARENT GAP between them and at least 50px from canvas sides. Do not overlap hair tips or clip any head/hair. Keep faces, original expressions, eye colors, eyepatch side, shading and hair shapes the same. Remove ALL surrounding white/grey/purple haze, halo, ambient light, vignette and shadow; every pixel outside each drawn contour must have zero alpha, including the interior gap of the ahoge. No necks, no clothing, no extra objects, no text or grid. Technical cutout atlas to crop each 512px-wide column separately.
```

生成原本は assets/*_source.png。配布・検証用の透過仕上げは既存 tachie_studio.py.process、輪郭矩形の切出しは prepare_assets.py。指定1024の身体出力は実際1254角、指定した頭の幅・余白は保持されなかったため、asset_bounds.json の実寸を使う。
