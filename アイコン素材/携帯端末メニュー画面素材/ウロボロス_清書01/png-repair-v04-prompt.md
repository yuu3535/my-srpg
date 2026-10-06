# 白いはみ出し線の除去：PNG v04

指定：x87.4%、y69.1%の白いはみ出した線を消す。右下の灰色の頭の下の白い鱗線の先端が対象。

方式：組み込み画像生成の局所修正。透過背景を維持し、生成された絵とアルファを加工せず別名コピー。以前のPNGを保持。

入力：ouroboros-png-clean-v03.png。

生成出力：C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-66a6440b-a274-4452-b491-26496038440c.png

保存：ouroboros-png-clean-v04.png（1254×1254 RGBA）。状態：原作者確認待ち。

検証：頭の下へはみ出す白い尖った線がなくなり、残りの白い鱗が残ることを目視確認。アルファの厳密な四隅=0検査は左下の1画素がalpha=1のため失敗。外周10pxを確認し、他はすべて0。量子化残り1/255は警告で明示するよう検証を調整し、素材の画素は加工しない。PNGの透過・中央の赤塗り、濃色・淡色の静止画を確認。確認HTMLのブラウザ表示・保存操作は未検証。

## 最終プロンプト

Use case: precise-object-edit.
Image 1 is the EDIT TARGET, the current transparent ouroboros PNG. Make ONE tiny localized correction, not a redesign.
At x87.4%, y69.1% from the canvas left/top (about1096,867 in this1254px square), immediately under the bottom edge of the lower-right slate-gray snake HEAD, there is a stray SILVER-WHITE diagonal line/spike protruding upward from the body's uppermost outlined diamond scale. REMOVE ONLY THAT PROTRUDING WHITE STROKE. Trim the scale stroke so it stays neatly inside the body and does not poke out, overlap the head's dark contour, or intrude into the head/body join. Where it lies over the gray body, restore the same neighboring slate-gray body fill. If any of this stray stroke lies outside the intended silhouette, that tiny outside piece must be transparent. Preserve the legitimate diamond scale below and all other scales.
Keep EVERYTHING ELSE as close to pixel-identical as possible: existing silhouettes and canvas/framing, the two snakes' silver-white and slate-gray bodies, silver-white lower-left body, both heads and red eyes, all other scale motifs, champagne-gold trim, repaired mouth/tail joins, concentric silver clock dial with twelve ticks, perfectly round gold ring and solid red pointed vertical central pupil.
Do not thicken or simplify lines, recolor other parts, move shapes, add elements, texture or glow. Keep the alpha transparency outside and in all existing open spaces. Output a single corrected transparent PNG with no background, checkerboard, text or tile.
