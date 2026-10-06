# 胴体の銀白色統一：PNG v03

原作者指定：3番の左下の胴体を、右上の銀白色に合わせる。

方式：組み込み画像生成による局所色修正。透過背景を指定し、生成された絵とアルファは加工せず別名コピー。以前のPNGは保持。

入力：ouroboros-png-clean-v02.png。

生成出力：C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-fc8aac63-4679-4af2-adb0-d637ade6b29a.png

保存：ouroboros-png-clean-v03.png（1254×1254 RGBA）。状態：原作者確認待ち。

検証：左下の広い灰色帯が銀白色になったこと、金の縁・鱗・赤い目と瞳孔を目視確認。verify-png.cjsでPNGのアルファ、四隅と内側の空白の透過、中央の赤い塗りを検証。png-comparison-proof-v03.pngで濃色／淡色／市松と32〜128pxを確認。確認HTMLのブラウザ表示・保存操作は未検証。

## 最終プロンプト

Use case: precise-object-edit.
Image 1 is the EDIT TARGET, current transparent PNG v02. The user has now clarified one remaining color repair. Change ONLY the lower-left snake BODY COLOR, around x32.2%, y76.9% (404,964 on the1254px square), to match the SILVER-WHITE main snake body in the UPPER-RIGHT. Do not interpret this as matching the lower-right gray snake.
The slate-gray patch/band along the LOWER-LEFT arc is the wrong body color. Extend the upper-right's same clean SILVER-WHITE main-body fill continuously through the corresponding lower-left body segment. The corrected lower-left body must read silver-white like the opposite upper-right, not a broad dark-gray body panel. Use the existing upper-right silver-white as the color source, not a new tint. Preserve the scale motif and its contours: retain the existing dark diamond shapes and thin accent stripe where needed, rather than removing scales or washing everything into an empty white arc. Preserve the champagne-gold edge ribbon and the prior smoothly repaired mouth/tail fill joins.
Do NOT recolor the upper-left gray panel or the lower-right gray head/body. Do NOT change either head, burgundy eyes, silhouettes, body outlines, clock dial, ticks, circular gold iris ring, or central solid red pointed vertical pupil.
Keep exact same canvas, size, placement, line style and design. No new design, changed curve, repositioning, cropping, extra pattern, grain, glow, bevel, text or numbers.
Output one corrected PNG with real transparent background; preserve transparency outside and in the open center and gaps between circles. No dark-filled center, backdrop or checkerboard.
