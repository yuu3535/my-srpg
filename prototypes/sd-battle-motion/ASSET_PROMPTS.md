# 腕付き試作素材の生成履歴

2026-10-05、imagegenスキルを使用。既存幼少アルシェのスナップショットを参照画像として、透過RGBAで生成。採用素材ではなく動作検証用。以下は送信したプロンプト。

## 1. 4パーツのアトラス

```text
Use case: precise-object-edit. Asset type: transparent 2D game rig sprite atlas, landscape 1536x1024. Edit target: supplied young Ars he chibi character, preserve exact face, hair, eyes, outfit, shorts, shoes, standing pose and anime shading. Make a technical cutout atlas with FOUR DISJOINT pieces, no labels, no grid, no background, genuine RGBA transparency, no floor or shadow. LEFT HALF: entire original character full height, EXCEPT REMOVE ONLY the arm on the viewer's RIGHT starting from the shoulder sleeve through the hand. Fill the small exposed torso side naturally; keep the viewer-left arm unchanged. Do not redesign any face or costume. RIGHT HALF contains THREE separate corresponding arm pieces in a vertical stack with generous transparent gaps: top = upper arm white shirt sleeve from rounded shoulder down to rolled cuff at elbow, oriented straight downward; middle = bare skin forearm from rounded elbow end to wrist, straight downward, no hand; bottom = small closed gripping hand of this same child, knuckles and thumb visible, designed to grasp a separate sword handle. Arm pieces must be same pixel scale as the character body. Upper arm elbow joint smoothly overlaps forearm; forearm wrist overlaps the gripping hand. Treat these as professional paper doll animation parts with closed rounded ends at joints. Source arm proportions: shoulder to elbow 60 original pixels, elbow to wrist 48 original pixels, small child hand 25 original pixels on source 512px-high character. No sword. No extra arms, no extra character, no outlines around the atlas, no text. Keep the original dark hair, gold eyes, black gold-trim vest, white rolled-up shirt, purple tie precisely.
```

## 2. 周囲のハロー除去

```text
Edit target: this exact game sprite atlas. Change ONLY the background / surrounding glow: REMOVE ALL grey, purple, white and dark haze, halos, ambient glow, vignette and drop shadows surrounding the character and the three detached arm parts. Make every area outside each solid drawn outline completely transparent with zero alpha, not translucent fog. Crisp hard-cut game sprites with only narrow antialiased edges. Keep every character and arm drawing pixel placement, size, face, hair, clothes, shading, palette and the four-part atlas arrangement unchanged. Do not add anything or change the art. The atlas will be cropped into four independent PNGs, so no glow can extend to any crop edges.
```

2回目の結果を `assets/rig/generated_atlas_source.png` に保存。薄いハローが残ったため `prepare_rig_assets.py` で既存Tachie Studioのprocessを適用し `generated_atlas_clear.png` を生成、透過部分を保って4パーツに切り出した。元絵と入力剣は変更していない。剣は画像生成で改変せず、原本の複製を縮小描画した。
