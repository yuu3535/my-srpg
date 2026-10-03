# 太陽盤 素材試作03 — 枠と面の分離

作成: 2026-10-03 / 比較用試作。正式採用ではない。
原作者指示: 白い面を抜いて分離し、枠を透かさない。盤と針の大きさ・位置も個別に変更可能にする。

## 4層の素材
- disk-frame.png: 盤の金色枠。白・琥珀のガラス面を除いた候補。
- disk-panes.png: 盤のガラス面。
- rays-frame.png: 針の金色枠。白い内面と中心面を除いた候補。
- rays-panes.png: 針の内面と中心面。
全て1254×1254 RGBA。元の試作02画像を基準に、組み込み画像生成で編集した。
生成による分離なので微細な輪郭一致や低アルファの残りは仕上げ対象。厳密な画素単位の抽出とは扱わない。

## 確認ページ
../太陽盤_試作01/preview.html を更新し、試作03を初期表示。
盤、針それぞれの「面の不透明度・直径・中心X・中心Y・角度」を独立調整できる。
枠と面は同じ親要素に置き、同じ移動・拡縮・回転をする。
枠のopacityは常に1、面だけのopacityを変える。面0％でも枠は残る。
「枠だけを見る」、中心表示、左端配置、30度回転、調整値保存・コピーを追加。
844×390基準の座標。初期値は盤・針とも直径560、中心(0,195)、面25％。
初期値は仮の配置。調整後の値は作者の確認を経て正式な配置へ反映する。
保存はブラウザのlocalStorage。環境で保存不可の場合はJSONコピーで渡せる。
旧版v01/v02は比較用に残し、枠と面が一体のため分離表示の対象ではない。

## 制限
ブラウザ操作ツールはfile:// URLを拒否したため、その経路の実機表示検証は行わない。
ファイル・スクリプト・制御の確認と原作者の表示確認を分ける。
本編、Unity、共通UI見本には反映しない。

## 2026-10-04 追記 — 再生成しない配色・質感調整

状態: 配置・配色検討ツール。正式なパレット、質感は未決定。
元PNGは変更せず、確認ページ側のSVGフィルタで色を調整する。

- 白いガラス面／金色の枠／黄土・琥珀色の面の3系統を独立調整。
- 各系統に色相環、色相数値、彩度、明度、陰影強度、光沢。
- 色相環はポインター／タッチ、左右上下キー、Shiftで10度、Home／Endに対応。
- 白い面の初回色相操作は彩度を35％にする。無彩色だと色相だけを変えても色が付かないため。
- 元の色・質感を系統ごとに戻せる。全体を一時OFFにして比較可能。
- 色だけをリセットして盤・針のサイズ・位置を維持可能。
- 配色は盤・針に共通適用。盤・針別の配置・角度・面の不透明度は引き続き独立。
- 配色値を保存／JSONコピーに含める。schemaはv04。v03の既存配置保存も読み込む。
- 外側・穴のアルファは元画像を再適用するため、着色しても背景を塗り潰さない。

白／黄土の面分けはR-Bの色差から作るソフトマスク。金枠は既存の別PNG。
厳密な手描き部位マスクではないため、淡い琥珀や枠が残った画素は境界の影響を受ける。
陰影は元の明暗のコントラスト、光沢は明るい部分の反射量を変える2D表現。
物理的な屈折、凹凸、光源の生成やPNGの書き出し機能ではない。

実装: material-engine.js（DOMなしの計算）、material-controls.js（操作UI）。
ライブラリ追加なし。file表示でCanvasの画素読取りやネット通信は不要。
画像生成は実施していない。元の4PNGはそのまま保持。

確認コマンド:
`node アイコン素材/携帯端末メニュー画面素材/太陽盤_試作03/material-engine.test.cjs`
`node アイコン素材/携帯端末メニュー画面素材/太陽盤_試作03/verify-preview.cjs`

確認済み: スクリプト・参照ファイル、色領域間の独立性、アルファ保持、値の上限、
色相環の入力、独立配置、保存・復元、旧schema読込、読込エラー、コピー不可時の代替表示。
ブラウザ実描画の検証は上記制限のため未実施。

## 2026-10-04 追記 — 一覧できるワークベンチ配置

原作者指示: 色調整・大きさ位置調整を一目で見ながら操作できる構成にする。
旧ページは大きなプレビューと長い説明が上段を占め、下の調整を触るとプレビューが画面外へ出ていた。

- ページの幅を使い、左は常時見えるプレビュー、右上は3種類の色・質感、右下は盤・針の配置を同時表示。
- 色調整と配置調整はタブで切り替えず、同時に見える。
- 色相環を68px、操作行を36pxにし、低いウィンドウでは32pxへ詰める。
- 説明・参考素材は閉じたdetailsに移し、基本操作の縦の長さを削減。
- 配置に数値入力を追加。スライダーと同期、Enter／変更確定で反映。上限と下限を検証。
- 保存・コピー・全リセットはフッターへ集約。既存の保存形式や調整内容は維持。
- 950px未満の極端に狭いウィンドウは横スクロールで操作幅を保持。ツールを縦に積み直さない。

元画像・本編・Unityは変更なし。コード検証は通過。ブラウザ実描画の確認は既述の制限で未実施。

## 2026-10-04 カリマの銀縁提案の確認

原作者から送られたカリマのv04設定を基準に、枠だけを色相200・彩度10・明度75・陰影65・光沢25へ変更。
白い面、青い面、盤・針の配置と不透明度は原作者のJSONを保持。背景はJSONどおりcorridor。
試作01フォルダの「カリマ_銀縁調整案.html」を開くと、この設定が入った調整画面を表示する。
通常ページにも「カリマ：銀縁案」ボタンを追加。保存を押すまでは既存のlocalStorageを上書きしない。
正式採用ではなく提案値の比較用。画像再生成・元素材変更はしていない。

## 2026-10-04 色違い方針の確認後

後続の原作者確認で、形・配置・回転の仕組みは共通、操作キャラによる色違いとして整理した。
正本: ../太陽盤_色違い方針_2026-10-04.md、配色値: character-colors.js。
通常画面のキャラ色ボタンは配色のみ変更し、現在の角度・サイズ・位置・面の濃さ・背景を保持。
先のカリマ銀縁案ボタンの「全設定を変更する」動作を置換した。
個別見本ページの初期角度は両方0度で、共通配置から開始。270度はキャラ固有の指定ではない。
これは共通素材の色違いという方針の確認であり、本編・Unity・全HOME UIの正式採用ではない。

## 実際の生成プロンプト（素材作成時の記録・以下）
### 盤の枠
Use case: precise-object-edit. Edit target: supplied rotatable stained-glass solar disk sprite.
Create ONLY its opaque METAL FRAME layer by extracting the existing gold frame. Preserve EXACT geometry, crop, layout, diameter, central pivot and all line positions of the source. Return 1254x1254 square registered perfectly to the source, front-facing full circle.
REMOVE the entire white/ivory/light-gray pane interiors and ALL broad amber colored GLASS pane interiors, leaving genuinely TRANSPARENT EMPTY HOLES in their place. Keep only thin gold rims and thin curving gold seam outlines and solid small gold rim joints. Do NOT fill the empty holes with gray/white/cream/dark/black/checkerboard or translucent glow. All holes must have alpha ZERO.
The source image is a stained glass disk: the sweeping thick honey panels are glass, remove their face color but preserve their thin gold border lines. The outer narrow double circle, inner ring surrounding central hole and curving seam lines should remain crisp solid metallic gold with original shading. Preserve dark outlines. No desaturation/restyling, no adding new details. Make the isolated framework OPAQUE so its visibility stays constant when the separate glass layer changes opacity.
Outside disk and central hole true alpha zero. No specks or detached pixels, no glow. Same center and scale as original; no recentering/cropping/resizing of the silhouette. Single clean transparent PNG asset, not whole UI.

### 盤の面
Use case: precise-object-edit. Input image: edit target solar stained-glass disk.
Extract ONLY the glass PANE FACES layer, REMOVE every gold/metal rim, gold joint, seam outline, dark outline and rim border. Preserve exact positions and footprints of all existing white/ivory/gray and amber faces from the source.
Return centered front-view on identical 1254x1254 square canvas, exact center/scale/no crop/no recenter.
This is a registered fill-layer sprite to sit UNDER a separate gold framework. There must be NO drawn seam lines or circular metal rings in this output. At original gold line positions, transparent gaps should remain.
Retain source calm smooth flat neutral pale-gray glass faces and restrained honey tint, broad simple shading only. No sparkle, no opal swirls, no glow. No backdrop scene or pattern.
Outside circle and central hole completely transparent alpha. Pane faces can be opaque color art as they will be displayed with adjustable opacity in the game. True alpha transparency everywhere that was framing or empty space. Single isolated PNG glass fill sprite, no text or any other objects.

### 針の枠
Use case: precise-object-edit. Edit target: supplied twelve-ray solar needle game sprite.
Extract ONLY the OPAQUE gold outline/framework layer. Keep EXACT original twelve alternating straight diamond-tipped rays and curved flame rays, exact shape/width/diameter, ring positions and canvas registration. Same full centered orthographic 1254x1254 square sprite, don't crop or recenter.
Remove ALL white, ivory, pearl/light-gray faces inside every straight needle, every curved ray, and the large center disk. These should be completely empty transparent holes, including center disk. Keep their thin gold outline borders, all golden metal edging, narrow gold center rings and tiny solid golden joints. Remove broad gold/amber inner face fills too, preserving only their boundary structure where feasible.
Critical: all removed white/gray pane interiors must have alpha zero, not white paint, not black paint, not checkerboard, not a glow or semitransparent pearl reflection. The framework is solid opaque metal. It will be laid over a separately translucent glass face layer.
Preserve exact placement and footprint of existing metal edges, satin/cel-shaded original style. No new symbols, no redesign, no outer disk/rim, no arms in the gaps, no compass letters, no text, no sparkles.
Outside and spaces between rays genuine transparent alpha. SINGLE registered PNG top framework layer.

### 針の面
Use case: precise-object-edit. Edit target: supplied twelve-ray sun needle sprite. Extract ONLY glass/enamel FACE FILLS, deleting its METAL OUTLINES. This is the separate transparent-material layer that sits beneath an opaque gold outline layer.
Keep source geometry exactly registered: same complete twelve rays alternating straight diamond-tipped needle and curved flame, exact center disk size, 1254x1254 square canvas, pivot exactly image center, full silhouette uncut, no crop or recenter.
Retain white/ivory/light gray faces within the straight diamond-ended needles, curved flame-ray faces, and center disk; broad amber inner face accents may remain. DELETE all thin gold boundaries, seam lines, concentric gold rings, solid gold joint diamonds and outside outlines. Those pixels are transparent gaps. Preserve the original simple calm cel-shaded face colors. No added text, no restyling, no sparkles, no glow, no radial metal decorations or new outlines.
Canvas outside rays/hub and between rays actual alpha zero. Removed metal positions actual alpha zero. Pane faces may have solid color as runtime controls adjust their opacity separately.
Single transparent PNG face-fill asset, not a whole menu or composite, exact original registration.
