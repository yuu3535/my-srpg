# PNG清書の生成記録

方式：組み込み画像生成（imagegen）。透過背景を指定。生成後に絵・アルファを手加工せず、元出力をコピー。

入力：reference-approved.png（上段の大きな紋章が清書対象）。旧SVGは入力しない。

生成出力：C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-cf8c0fd8-04cf-4ec7-ba18-88324cc94bd5.png

保存：ouroboros-png-clean-v01.png（1254×1254 RGBA）。状態：初稿・原作者確認待ち。

注意：指示のうち、菱形の透過抜き・全体の完全な均一色・輪郭線なしは完全には実現していない。背景は透過。詳細はdesign-qa.md。

## 最終プロンプト

Use case: precise-object-edit and background-extraction.
Input image 1: EDIT TARGET, the approved ouroboros symbol mockup. Use ONLY the LARGE emblem in the upper part, not the small repeated app tile below.
Primary request: Clean up that exact selected emblem into a production-quality transparent PNG game UI icon. This is final cleanup of an approved design, NOT a redesign or a new option. Preserve its character, curves, proportions and element positions faithfully.
Output: one single centered emblem on a square canvas, occupying about 88% of its width, with even transparent margins. No lower duplicate, no rounded square app tile, no background.
Keep: exactly TWO interlocking snakes biting each other's tails to form a single circular ouroboros. The pale silver-white head at upper-left and dark slate-gray head at lower-right, small deep burgundy eyes, linked geometric diamond scales, existing silver-white and slate-gray body sections, restrained champagne-gold edge accents.
Inside keep the concentric double thin silver clock dial and its twelve ticks (four longer gold cardinal ticks), the large perfectly round gold iris ring following the inner ends of the dial ticks, and the small CENTRAL SOLID DEEP RED vertical pointed pupil. Do NOT make the pupil hollow. No clock hands or numbers.
Clean up ONLY imperfections: make body colors smooth and solid, crisp antialiased edges, evenly finished thin lines and diamond shapes. Remove grain, blotchy pixels, unwanted line breaks and accidental gaps. Critically, every tapered tail is a CONTINUOUS fully colored extension of its own snake body, ending inside the other snake's mouth. Repair both head-to-tail joins and the tapering gold/silver accents so that no tail tip has a missing color segment, unfilled notch, jagged seam or abrupt open cut. Preserve intentional diamond negative-space patterns but keep them out of the mouth-tail joins. No detached tail pieces. Do not simplify the snakes into generic flat geometric arcs.
Style: refined flat 2D fantasy-digital UI emblem with quiet uncanny mood. No shiny 3D metal, bevel, glow, gradient, sparkle, brush texture, black stroke outlining everything, or newly added decoration.
Transparency: REAL alpha transparency everywhere outside the emblem and in ALL negative space: the open center around the red pupil, spaces between concentric rings, between the two snakes, and the diamond cutouts. Do NOT keep the charcoal backdrop, do NOT render a dark-filled central disk, do NOT draw a checkerboard. Gold/silver/gray/red strokes and bodies themselves stay opaque and clean.
No text, letters, labels, hands, numerals, portrait, watermark or extra motif.
