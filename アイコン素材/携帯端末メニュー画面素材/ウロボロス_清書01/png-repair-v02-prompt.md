# 指定5か所の修正：PNG v02

方式：組み込み画像生成による局所修正。透過を維持。元PNGとv01は保持し、生成出力を別名コピーした。

入力：ouroboros-png-clean-v01.png。

生成出力：C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-e23269c7-b1dc-4187-81bb-2bbcacb2edbe.png

保存：ouroboros-png-clean-v02.png、1254×1254 RGBA。

状態：部分修正・原作者確認待ち。口元の白い継ぎ目を金色へつなぐ修正を確認。上左と下右の鱗・帯も生成で変わっているため、原作者に修正範囲の見え方を確認してもらう。3番の「反対側」を右上の銀白色と解釈して指示したが、意味が未確定のため、銀白色／灰色のどちらに合わせるか質問中。5か所すべて完了とはしない。

検証：verify-png.cjsで四隅と内側の透過・中央の赤塗りを確認。png-comparison-proof-v02.pngで濃色・淡色・市松と32〜128pxを確認。HTMLの相対参照と背景／サイズ連動はテスト成功。HTMLブラウザQAは未実施。本編・メニュー・Unity・Gitコミットには未反映。

## 使用した指示

Use case: precise-object-edit.
Image 1 is the EDIT TARGET: the current transparent PNG ouroboros emblem. Make a localized color/fill repair of the user's FIVE marked locations. Do not redesign or recompose the emblem.
Coordinates below are normalized percentages from the LEFT and TOP of the entire square input image (1254 x 1254). Fix the nearby broken color band/paint seam, not merely a single pixel:
1. x87.9%, y46.8% (about1102,587): right mouth/tail approach. Continue the existing silver-white, slate-gray and gold band colors through this junction. Remove the accidental unfilled or wrongly white wedge that interrupts the tapering band's color. The gold border and appropriate body color must meet continuously.
2. x17.4%, y52.7% (about218,661): left mouth/tail junction, especially the little white patch and abrupt cut across the otherwise continuing color band. Repair the fill continuation so the same snake body color and gold edge extend continuously around the bend and into the other mouth.
3. x32.2%, y76.9% (about404,964): lower-left body band. Its body coloration does not match the corresponding opposite body. Match its silver-white/slate-gray band colors, tone and arrangement to the corresponding opposite upper-right body at roughly x67.8%,y23.1%, following the matching BAND rather than sampling gold trim or a dark diamond. Both opposite body segments should use the SAME corresponding flat colors. Preserve scale shapes and gold trim; no unrelated recoloring.
4. x76.4%, y80.1% (about958,1004): lower-right body/diamond band where color breaks. Connect the existing body-band fill cleanly across this location; remove the unwanted abrupt band termination/unfilled seam. Continue the existing color through the interrupted segment.
5. x27.4%, y18.7% (about344,234): upper-left body/diamond band where color breaks. Connect the existing band fill smoothly across the interruption, keeping the diamond scale motif intact.
Treat these as paint/fill continuity repairs: each colored band is a continuous filled ribbon along its own curve, not detached panels with random white/transparent seams. Preserve intentional diamond motifs and the intentional open spaces BETWEEN the snakes and circles.
Invariants: identical canvas, framing, emblem scale, silhouettes, TWO snakes mutually biting tails, two deep-red snake eyes, geometrical diamond scales, double thin silver clock circles, twelve ticks with four gold cardinal ticks, perfectly round concentric gold iris ring, solid deep-red pointed vertical central pupil. Keep existing restrained silver-white/slate-gray/champagne-gold/deep-red palette. Keep all other areas as close to input as possible. Do not change the heads, clock dial, center symbol, ring sizes or add decorations.
Output a SINGLE corrected PNG emblem with REAL transparent alpha, preserving current transparency outside, inside and between the circles. NO filled dark disk, background, checkerboard, text, labels, numbers, duplicate icon, tile, glow, sparkle, 3D metal or new texture. Smooth flat clean painted bands and antialiased edges.
