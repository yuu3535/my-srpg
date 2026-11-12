# 支援会話：相手選び — Unity 組み込み（1回目）2026-11-12

状態: **試作対象**。見た目の正本は `docs/10-design/ui/support_select/`（仕様書・図）。決めたことの一覧は同じフォルダの `README.md`。

## 触り方

1. 2D の探索で右上の MENU の星（または Esc）→ 拠点メニュー Hub2。
2. 太陽盤の「支援会話」を押す → この画面。今は**開発中の切り替え**で、支援が解放される前でも開く。
3. カードを押すと、その人の支援の相手に切り替わる。「詳細｜簡易」で一覧の見せ方を変える。
4. 「会話する」→ 暗転（1.9秒）→ まだ会話画面の支援モードが無いので、この画面に戻って「まだつながっていません」。
5. 右上の星（BACK）か Esc → 拠点メニューに戻る（メニューは開いたまま）。

開発用: Unity のエディターで動かしているときは **F8** で見本 ref_01〜05 を 40% で重ねる（押すたびに次へ、最後は消える）。

## 入っている物

- 太陽盤（項目名を消した絵＋文字。「支援会話」が真ん中・金の光）。入ってくるとき項目名が上から降りる。右の中身は右から寄る。
- 見出し「SUPPORT／支援会話」、帯（話せる会話の数と一文。一文は選んでいる人・軍の誰か・誰もいない、で出し分け、名前はランクの色）。
- 仲間のカード（加入順、選んだ人は10px浮いて金の枠と角の菱形、押す・ホバーで6px浮いて立ち絵1.05倍、話せる会話がある人に金の点と光の輪）。立ち絵のない人はシルエット。
- BOND の欄（並び: 話せる → ためている途中 → 条件待ち → すべて見た）。詳細（顔・名前・ランクの菱形・状態・会話するタイル）と簡易（2列）。別の人を選ぶ・切り替えると一番上へ戻る。
- ランクの菱形（届いていない／見た＝べた塗り／未読＝枠と文字だけで3.2秒の点滅）。
- 「続きがある」印（一覧がスクロールでき、最後まで見ていないとき。消えても場所は空けたまま）。
- 暗転（「SUPPORT ― RANK B」「アルシェ × アルバス」と開発確認用の一文）。
- 設定「端末の演出：なし」では、点滅・跳ね・入ってくる動きを止める。

## 仕様書と違うところ

- 立ち絵は手元の絵（会話用の立ち絵、アルバスは `albas.png`）。アルシェ・アルバスは見本のカードに総当たりで重ねて大きさと位置を決め、ほかの人は目で測った値。リングホルムは Unity に絵（`ringholm.png`、背を向けた絵）があるが、見本に合わせて今はシルエット（`tools/build_support_portraits.py` に足して作り直し、`support_roster.json` の `portrait` に名前を入れれば出る）。
- 字の太さ 700 は、原作者の指定で 16px 以下は SemiBold、19px 以上は ExtraBold。仕様書の 400・500 も SemiBold（手元に無いため）。
- ガラス・暗がりなど暗い半透明と、線・シルエットなど明るい半透明は、Unity が色を線形の空間で混ぜるため、ブラウザと同じ見え方になるよう不透明度を直して使う（`Hub2Textures.Seen`／`SeenLight`）。
- 背景の 3px のぼかしは省いた（WebGL で重いため。Hub2 と同じ）。
- 一覧の上下の端のフェードと細いスクロールバー（HTML にはある）は、仕様書の「スクロールバーは出さない」に合わせて入れていない。

## 同じときに直した Hub2

- フォントを試作と同じにした（Shippori Mincho SemiBold・ExtraBold、英字だけの文字は Barlow Condensed SemiBold。ゲームの字だけに絞って `Resources/Fonts/`。SIL OFL）。英字に合成の太字を重ねていたのをやめた（潰れて見えた）。
- まだ解放されていない物（運命予報・支援の深い仲間・所持金と名声・名声報酬・ログ）を隠す（`Hub2Menu.Unlocks`。原作者 2026-11-09「A: 隠す」）。
- 暗い下地（左の暗がり・右のガラス・タイル・カード）が試作より明るく透けていたのを、試作と同じ暗さにした。
- 字間: 空白のある文字で、空白のあとの字が詰まっていたのを直した（`LetterSpacing`）。

## ファイル

- `unity-prototype/Assets/Scripts/Battle/Menu/SupportSelectView.cs` — 画面（コードで組み立てる。`SupportSelectView.Motion` は動きの式）
- `unity-prototype/Assets/Scripts/Battle/Menu/SupportRoster.cs` — データと決まり（並び順・話せる会話の数・帯の一文・ランクの菱形）。画面に触れない
- `unity-prototype/Assets/Resources/Support/support_roster.json` — 仮のデータ（見本 ref_01 と同じ5人）。組み合わせ・加入順・確定枠は未決
- `unity-prototype/Assets/Resources/Support/Portraits/` — 顔の大きさをそろえて縮めた立ち絵と `faces.json`（`py -3.12 tools/build_support_portraits.py` で作る。手で直さない）
- `unity-prototype/Assets/Resources/Menu/sun_dial_blank.png` — 項目名を消した太陽盤
- `unity-prototype/Assets/DesignRefs/SupportSelect/` — 見本 ref_01〜05（エディターで重ねる用。どこからも参照しないので公開版には入らない）
- Hub2 側: `Hub2Menu.cs`（太陽盤の「支援会話」で開く・開いている間は Hub2 の中身を隠す・Esc で戻る）
- テスト: `Tests/EditMode/SupportRosterTests.cs`（6件）、`Tests/PlayMode/Hub2MenuPlayTests.cs` の `SupportSelectOpensFromTheDialAndGoesBack`
- 確認の画像: `docs/40-reviews/support_select_unity_2026-11-12/`（ss_01＝基本、ss_01_overlay＝見本を40%で重ねた物、ss_02＝簡易、ss_03＝8人・アルバス、ss_03_arshe7＝主人公の相手7人でスクロール、ss_04＝話せる会話なし、ss_05＝暗転、hub2_all＝直した Hub2）

## まだの物

- 会話画面の支援モード（暗転の間に切り替える所は `SupportSelectView.StepVeil`）。
- 支援のデータ（支援値のたまり方・ランクの上がり方・組み合わせ）とセーブ。
- 解放の前に開ける切り替え（`OpenBeforeUnlock`）を false に戻す。
- 仲間カードの長押し → ステータス画面、カリマ軍の太陽盤、帯の一文を順番に流すか、実機で見てからの字の大きさの調整（仕様書 §14）。
