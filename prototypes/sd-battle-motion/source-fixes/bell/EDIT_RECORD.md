# ベルの耳修正 — 2026-10-05

共有コピー名: 修正前は `original.png`、修正版は `pointed-ears.png`。以下の日本語名はローカルの入力・出力名。どちらも元ファイルとSHA256が一致。本編・Unity・PoCのキャラ参照は置き換えていない。

原作者の指定: 人間の丸い耳ではなく、魔物の尖り耳へ。耳以外は変更対象にしない。

入力: `ベル.png`（1225×1284 / RGBA）。元画像は上書きしない。
出力: `ベル_耳修正.png`（1225×1284 / RGBA / 透過PNG）。確認用の修正版。本編・Unity・共通身体PoCへの自動差し替えは行っていない。

imagegenスキルの組込み画像編集を使用。`transparent_background: true`。参照パスは入力画像1枚のみ。画面左の露出した耳が尖った形になり、反対側を覆う髪・顔・服・ポーズが維持されていることを目視確認。画像生成による編集のため、耳以外のピクセル完全一致を保証するものではない。追加の透過加工は行わず、生成alphaを保持してコピーした。

## 編集プロンプト

```text
Use case: precise-object-edit.
Asset type: transparent anime SD game sprite, localized ear correction only.
Input image 1 is the sole EDIT TARGET: the attached full-body purple-haired character Bell, with amber eyes, purple tunic, dark shorts and boots, sword sheathed behind his back. This is NOT the eyepatch character.
Primary request: Change ONLY the exposed human-like ROUND EAR on the LEFT side of the IMAGE (the character's right ear) into a small distinctly POINTED monster/elf-like ear. Keep its root and earlobe in the same place, extending only the upper/outer ear contour to a tapered tip pointing outward and slightly upward. Match the existing warm skin color, dark outline, and cel shading. It should be a modest pointed ear proportional to this SD head, not a giant ear or animal ear. The other ear is obscured by hair; leave the covering hair intact and do not invent an extra visible ear.
Invariants: Preserve the exact face, expression, amber eyes, eyebrows, purple hair silhouette and two ahoge loops, bangs, body proportions, hands, tunic pockets and collar, belt, shorts, sleeves, boots, sheathed sword, pose, framing and character position. No eyepatch. Do not redesign, rescale, repaint or restyle the character. Only the small ear area should change; keep every other region as close to the source as possible. Preserve full original canvas and all transparent margins; do not crop boots or hair.
Background: preserve genuine transparency with zero alpha outside the solid sprite contours. No black/white background, no haze, no glow, no shadows, no added props or text.
```
