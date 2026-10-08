# 無地・四隅の星飾りの背景初稿

2026-10-08。状態：背景の方向は原作者選定、分離素材の組み込み後の画面確認待ち。本編／Unityへは未反映。

## 選定と生成元

- 直近の無地比較3枚目：`C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-0490c9fd-4eec-4b0d-97f7-5d837a7d2e53.png`。原作者が「3が好き」と選定。
- 上の画像を参照して、内蔵imagegenで背景だけを分離生成。CLI／APIキー経路は使用しない。
- 生成元：`C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-e8852573-9a04-498b-8c6c-b982e6ba97e2.png`。
- 保存先：同フォルダの `home-wallpaper-stars-v01.png`。無加工でコピー、元の素材を上書きしない。
- 実寸1844×853、不透明PNG、1,136,211 bytes。
- SHA256：`9998f3bf988950c2ca1c0db74a9b93ae2d550b37b7d69ee202ff5d45ccc04ecb`。
- 比較画像のUIの描き直しは採用しない。太陽盤・アイコン・マップ等は従来の素材とHTMLを使う。

## 送信したプロンプト

```text
Use case: precise-object-edit. Produce ONE standalone wallpaper raster asset for an existing fantasy SRPG mobile-terminal home.
INPUT IMAGE IS THE SELECTED DESIGN REFERENCE. Keep ONLY its flat charcoal backing and FOUR subtle champagne-silver corner ornaments. REMOVE every UI foreground component: sun wheel, golden commands, all Japanese text, notification bar, map/castle photograph, task card, buttons, app icons, gold tile edges, weather sun, and any other content. Do not retain ghosts or silhouettes of those removed components. Output EMPTY wallpaper, not a menu screenshot.
Target dimensions: 1688 x 780 pixels (844x390 doubled), exact landscape ratio 2.164:1. Opaque background.
Background is entirely uniform solid matte charcoal #1c1d1f, no texture, grain, gradient, vignette, noise, light bands, scenery or patterns. It must remain the same charcoal across the entire image.
Four isolated delicate corner trims matched to selected screenshot: a tiny four-point star in each corner, flanked by two short softly bowed line segments along the two adjoining edges, sparse elegant flat western celestial line art. Dull champagne/pewter #9d9481, modest contrast, very thin lines around 2px at this resolution, star only about 14px tip-to-tip. Placement similar reference, each corner cluster entirely inside a 70x70px corner region, about 12-22px inset. No corner-to-corner connected border, no central motif, no tiny dots across interior, no double frame or bevel, no shine. Four corners ONLY, perfect calm negative space elsewhere.
Keep reference corner design restrained, symmetrical by mirrored placement, with clean smooth strokes. No text, no logo, no watermark, no display of any phone device. Do not create four variants. This wallpaper will have original live UI placed over it; do not bake ANY UI into the asset.
```

生成の指示は完全な無地だが、生成PNGの全画素が同じRGBであることを保証したものではない。原作者確認時にむらや線の強さが気になる場合は、背景素材だけを改稿する。表示用の縮小・圧縮は今回未実施。

## マップ枠：選定2枚目から別素材へ

- 内蔵imagegen、transparent_background: true。選定見本を参照して枠のみを生成。
- 参照: C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-2cc5b546-8e15-47ee-8c56-e176cabc7f9f.png
- 保存元: C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-5005ea7a-477d-4bf8-9b98-3608861187a2.png
- 保存先: map-frame-silver-gold-v01.png（無加工コピー）。2022×778 RGBA、SHA256: 8eece972793053a853f30973cc03d0bcdedcb42fe320ae3edca882bf54bb8f05。
- 真のアルファを保持。中央の検査領域(x200,y150)-(x1800,y650)はA値0〜1、ほぼ透明だが完全なA=0ではない。微小ノイズの無断補修はしない。
- 高アルファの輪郭範囲はおよそx42〜1980／y47〜725。CSSで透明な安全余白を窓の外へ逃がす。場所画像にはこの寸法補正を適用しない。統合後の描画は未確認。

送信したプロンプト：

```text
Use case: background-extraction. Asset type: transparent game UI map window frame overlay.
Reference image is a full menu style reference. Extract/recreate ONLY the thin silver rectangular MAP WINDOW frame around the castle picture, with its tiny flat warm gold L-shaped connectors at all four corners. No map picture, no caption, no button, no lettering, no fortune strip, no icons, no sun wheel, no wallpaper.
Requested asset canvas approximately 1976x760 pixels, landscape ratio494:190, to display at494x190 logical pixels. Frame nearly fills canvas with no more than4 output pixels of transparent edge safety padding. Hairline pale silver straight outline about3 output pixels thick, small slightly softened corners, short subdued gold connector caps about18 output pixels long and5 output pixels thick. Interior and everything except frame lines and gold caps are genuinely alpha transparent. Same quiet thin simple frame as selected source, NOT an ornate illustrated fantasy border.
Flat clean crisp anti-aliased surface; no texture, grain, metallic bevel, shadow, glow, gradient, filigree, new star symbols. Four symmetric tiny geometric gold corner accents plus silver lines only. Export true transparent PNG, never checkerboard baked into image.
```
