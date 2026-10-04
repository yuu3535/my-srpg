# コマンド右端の炎（試作対象）

## 現行と新案の切替を接続（2026-10-04）

原作者の確認で新案を比較用の実画面へ接続。layout.htmlの「炎の形」で現行／新案を切り替える。初期は新案だが正式採用ではなく、両素材を残す。69・83・−27・11は共通、配色も従来の金／青系を維持。新案の支点は57%78%、現行は17%83%。新案の点火と揺れは縦scale中心とし、下縁の火種の横揺れを抑える。以下の未接続という記述は生成時の履歴。最新の接続内容は回転輪メモを参照する。

## 下縁に沿う火種の別素材（2026-10-04、見本・未接続）

- 原作者が「今の素材を残して、その形の別素材を見本として比べてみよう」と依頼。組み込み画像生成を使用し、CLI/API・画像の手動加工は使用しない。
- `command-flame-bottom-v02-candidate.png`: 下部を横に広く厚い火種へ変え、右端から2本の炎が右上へ立ち上がる新案。1254×1254、32bit ARGB、角alpha0・火種内部alpha253を確認。原本は `C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-e6fc2b3d-8553-4563-9126-3ac45a9835aa.png`。
- `command-flame-bottom-v02-comparison.png`: 現行／新案を同じ名前札へ置いた静止の画像生成見本。上はアルシェの金、下はカリマの銀青。現行ブラウザーのキャプチャや実アニメーションではない。札の字形・線・面・青紫の色合いは生成上の表現で、ゲーム側の変更・採用値ではない。原本は `C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-0be570b0-dbce-4413-873e-7bd44ee1578b.png`。
- 参照は現行素材と作者スクリーンショット `C:/Users/jade-/AppData/Local/Temp/codex-clipboard-bcef9f3c-0f9c-4a94-b7f5-950faf5bb678.png`。生成前に両方を開いて確認し、実画像を生成呼出しへ添付。
- 生成指示（素材）: change only the flame's lower root silhouette into a thicker, wider, low horizontal fire bed hugging the command plaque's lower edge, turning upward at the right into two tongues. Preserve gold/amber and ivory core, true alpha, clean coherent silhouette at 69px. Leave upper-left empty for lettering; no plaque/text/background/smoke/particles or sprite sheet. 1254×1254。
- 生成指示（比較）: use the actual existing and alternate flames on identical slim V-notch/square-right plaques, two columns 現行／新案, two colorway rows アルシェ／カリマ, text 所持品 unchanged. New root along only rightmost third of bottom border, not covering letters or a full-width glowing underline. Neutral gray; no disk redraw, device, animation timeline or invented functions. 1536×1024。
- 現行 `command-flame-gold-v01.png` と `wheel.js` の参照は変更しない。共通の作者値69・83・−27・11も変更しない。新素材の配置・色の差替え・動きは未実装で、作者の選択後に別途合わせる。正式採用・本編／Unity反映・コミット／プッシュなし。

## 現行素材の生成記録（以下の54pxなどは最初の組み込み時の履歴）

`command-flame-gold-v01.png` は組み込み画像生成で作った透過ラスタ。1254×1254、RGBA、576659 bytes。元の太陽盤素材を変更していない。

選択元は直近の見本の表示順3「右へなびく炎」:
`C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-3adebcaf-057c-4b0a-bbb8-984c6d52182d.png`

生成原本:
`C:/Users/jade-/.codex/generated_images/01a10163-0f98-7633-9c5a-e70ff4a002fe/exec-0facd3e8-730b-427c-8a49-4ecd0efaec64.png`

生成指示の要旨：見本の金の炎だけを単独の透過素材にする。淡い象牙色の芯、金・琥珀色の透ける2本の舌、左下の共通根元から右上へなびく。札・文字・背景・アイコン枠・煙・散る粒は含めない。小さなゲームUI用に縮小しても判別できる形。組み込み画像生成を使用、CLI/APIは不使用。

実装では54pxの正方形へ等比縮小。画像の根元はおよそ17%・83%で、transform-originもここへ。点火時は1.16倍、選択中は0.74倍・opacity0.52の親＋子画像の淡い揺れ。カリマは同じ形を色相180度・彩度0.64・明るさ1.06で青系へ変える。別素材を生成し直さず調整可能。

これ自体はアニメーションのスプライトシートではない。PNGの小さい変形と透明度を組み合わせた試作で、見た目と実機負荷は作者確認待ち。正式採用・本編／Unity反映なし。
