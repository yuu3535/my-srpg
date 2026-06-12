"use strict";
// =============================================
// シナリオデータ定義
// =============================================
// scene の type:
//   "dialogue" : 会話（speaker, text, setCharacters?）
//   "battle"   : バトル移行（battleId）
//   "choice"   : 選択肢 ※未実装
//   "cg"       : 一枚絵 ※未実装
//   "explore"  : 探索マップ ※未実装
//
// setCharacters: 登場キャラの配列。省略すると前のシーンを引き継ぐ。
//   文字列      → CHARACTERS_DATA の portraitImage を使用
//   オブジェクト → { name:"名前", image:"パス" } で個別画像を指定可能
//
// speaker: "──" → 地の文・ナレーション
// =============================================

// ── 立ち絵パス定数（プロローグ用） ──────────────────────────
// ※ tachie_clear.py で透過処理済み（立ち絵透過済み/ フォルダ）
// bgSize / bgPos はシナリオ立ち絵のトリミング設定（entry.bgSize が CHARACTERS_DATA より優先）
// ギュンター：大人・基準
const _G  = { name: "ギュンター", image: "立ち絵透過済み/ギュンター立ち絵_transparent.png",
              bgSize: "auto 230%", bgPos: "center top" };
// アルシェ：少年。140%でちょうど上半身〜太ももくらい表示
const _AE = (e) => ({ name: "アルシェ", image: `立ち絵透過済み/アルシェ幼少期表情/${e}_transparent.png`,
                      bgSize: "auto 140%", bgPos: "center top" });
const _A  = _AE("元気");   // デフォルト表情
// カリマ：少年・アルシェより少し小さめ
const _K  = { name: "カリマ", image: "立ち絵透過済み/カリマ幼少期表情/ChatGPT Image 2026年5月29日 01_46_01_transparent.png",
              bgSize: "auto 145%", bgPos: "center top" };
const _CH = { name: "???",  image: "" };   // 後編の謎キャラ（未設定）

const CHAPTERS = [

    // ============================================================
    // プロローグ：百年戦争と祝賀会の朝
    // 前編（チュートリアルバトルまで）→ バトル → 後編（1章プロローグ後.xlsxから追記予定）
    // ============================================================
    {
        id: "prologue",
        chapter: 0,
        protagonist: "アルシェ",
        title: "プロローグ：百年戦争と祝賀会の朝",
        scenes: [

            // ──────────────────────────────────────
            // No.1 場面説明
            // ──────────────────────────────────────
            {
                type: "dialogue",
                speaker: "──",
                text: "黒い石造りの鍛錬場に、短剣の刃が光る。高い天井の奥では紫の魔灯が揺れ、遠くから祝宴の準備に急ぐ者たちの足音がかすかに響いていた。",
                bg: "背景/オルクス魔王城鍛錬場.png",
                setCharacters: [_G],
            },

            // No.2〜10 百年戦争の説明
            { type:"dialogue", speaker:"ギュンター",
              text:"――百年戦争。アルストロ王国とオルクス王国が、百年以上にわたって争った大戦です" },
            { type:"dialogue", speaker:"カリマ",
              text:"百年以上……",
              setCharacters: [_G, _K] },
            { type:"dialogue", speaker:"アルシェ",
              text:"長すぎないか？　途中で飽きなかったの？",
              setCharacters: [_G, _AE("生意気"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"アル……鍛錬中くらいはしっかりしなよ。ギュンターが話してくれてるんだから" },
            { type:"dialogue", speaker:"ギュンター",
              text:"戦は遊びではありません、アルシェ様" },
            { type:"dialogue", speaker:"アルシェ",
              text:"分かってるって。……でもさ、今は和平してるんだろ？　今日の祝賀会だって、そのためのものだし",
              setCharacters: [_G, _AE("元気"), _K] },
            { type:"dialogue", speaker:"ギュンター",
              text:"はい。ヒトの国アルストロと、魔物の国オルクス。かつて敵同士だった二国は、先代魔王サタンの討伐をきっかけに和平を結びました" },
            { type:"dialogue", speaker:"カリマ",
              text:"勇者リングホルムが、魔王サタンを討ったんだよね" },
            { type:"dialogue", speaker:"ギュンター",
              text:"ええ。アルストロに現れた勇者が魔王を討ち、戦を終わらせた。そう伝えられています" },

            // No.11〜16 カリマの勇者憧れ・兄弟の掛け合い
            { type:"dialogue", speaker:"カリマ",
              text:"父上から聞いた話と同じだ……。ぼく、その話好き。勇者がみんなの希望を背負って、魔王に立ち向かうところ" },
            { type:"dialogue", speaker:"アルシェ",
              text:"カリマ、その話になると目がきらきらするよな",
              setCharacters: [_G, _AE("笑顔"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"だって、かっこいいもん…。ぼくもいつか、そういうふうに誰かを守れる王子になりたい" },
            { type:"dialogue", speaker:"アルシェ",
              text:"へー。じゃあ今日の鍛錬は俺より長く走るか？",
              setCharacters: [_G, _AE("生意気"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"それとこれとは別" },
            { type:"dialogue", speaker:"アルシェ",
              text:"別なのかよ",
              setCharacters: [_G, _AE("呆れ"), _K] },

            // No.17〜19 伝承の不確かさ・祝賀会の話
            { type:"dialogue", speaker:"ギュンター",
              text:"勇者の伝承は、今もアルストロとオルクスを結ぶ象徴の一つです。ですが、歴史とは残された者が語るもの。真実がすべて記されるとは限りません" },
            { type:"dialogue", speaker:"アルシェ",
              text:"また難しいこと言ってる",
              setCharacters: [_G, _AE("呆れ"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"でも、聞いておいた方がいいよ。ぼくたちは今日、オルクス王族として祝賀会に出るんだから" },

            // No.20〜28 王子としての不安・ヒトの養子
            { type:"dialogue", speaker:"アルシェ",
              text:"分かってるって。王子らしく、だろ？",
              setCharacters: [_G, _AE("元気"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"……ぼくも、ちゃんと王子らしく見えるかな" },
            { type:"dialogue", speaker:"アルシェ",
              text:"ん？",
              setCharacters: [_G, _AE("明るい"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"みんなから浮かないか心配なんだ。ぼくたち、ヒトだし。……頭飾り、つけちゃだめかな。ツノみたいに見えるやつ" },
            { type:"dialogue", speaker:"アルシェ",
              text:"それは逆に目立つんじゃね？",
              setCharacters: [_G, _AE("呆れ"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"でも、少しくらい魔物っぽく見えた方が……" },
            { type:"dialogue", speaker:"アルシェ",
              text:"カリマはカリマだろ。変にツノとか生やさなくていいって",
              setCharacters: [_G, _AE("明るい"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"アルはそういうところ気にしなさすぎ" },
            { type:"dialogue", speaker:"アルシェ",
              text:"気にしてないわけじゃないけどさ",
              setCharacters: [_G, _AE("落ち込み"), _K] },

            // No.29〜31 ギュンターの言葉
            { type:"dialogue", speaker:"ギュンター",
              text:"お二人は、魔王様がお認めになった王子です。それ以上でも、それ以下でもありません" },
            { type:"dialogue", speaker:"カリマ",
              text:"……うん" },
            { type:"dialogue", speaker:"アルシェ",
              text:"ほら、ギュンターもこう言ってるし",
              setCharacters: [_G, _AE("笑顔"), _K] },

            // No.32〜37 師範呼び・弟扱いへの反発
            { type:"dialogue", speaker:"ギュンター",
              text:"せめて鍛錬中は師範とお呼びください" },
            { type:"dialogue", speaker:"カリマ",
              text:"アル、鍛錬中くらいはちゃんと師範って呼んであげて" },
            { type:"dialogue", speaker:"アルシェ",
              text:"カリマまでそっち側かよ！",
              setCharacters: [_G, _AE("怒る"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"ぼく、今日はアルよりしっかりしてるって思われなきゃいけないんだ。毎回ぼくの方が弟扱いされるの、嫌だし" },
            { type:"dialogue", speaker:"アルシェ",
              text:"へっ　弟だろ",
              setCharacters: [_G, _AE("生意気"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"そういうところ！" },

            // No.38〜43 鍛錬・おしゃれ準備
            { type:"dialogue", speaker:"ギュンター",
              text:"では、兄弟喧嘩はそこまで。祝賀会の前に、軽く身体を動かしましょう" },
            { type:"dialogue", speaker:"カリマ",
              text:"はやく終わらせて、おしゃれの準備もしたいしね" },
            { type:"dialogue", speaker:"アルシェ",
              text:"鍛錬よりそっちが本命じゃないか？",
              setCharacters: [_G, _AE("生意気"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"王子として身だしなみは大事だよ、アル" },
            { type:"dialogue", speaker:"ギュンター",
              text:"カリマ様の言う通りです" },
            { type:"dialogue", speaker:"アルシェ",
              text:"俺だけ味方がいない！",
              setCharacters: [_G, _AE("ギャグ"), _K] },

            // No.44〜47 チュートリアル宣言
            { type:"dialogue", speaker:"ギュンター",
              text:"では、構えてください。まずは移動と攻撃の基本から確認します！" },
            { type:"dialogue", speaker:"アルシェ",
              text:"よし来た！　行くぞ、ギュンター師範！",
              setCharacters: [_G, _AE("やる気"), _K] },
            { type:"dialogue", speaker:"カリマ",
              text:"ぼくも負けないから" },
            { type:"dialogue", speaker:"ギュンター",
              text:"はい。お二人とも、訓練とはいえ真剣にやるぞ！" },

            // ──────────────────────────────────────
            // No.48〜50 チュートリアルバトル
            // ──────────────────────────────────────
            {
                type: "battle",
                battleId: "battle_tutorial",
            },

            // ──────────────────────────────────────
            // 【後編】1章プロローグ後.xlsx から追記予定
            // ──────────────────────────────────────
        ],
    },

    // ============================================================
    // 第1章：はじまりの森
    // ============================================================
    {
        id: "ch1",
        chapter: 1,
        protagonist: "アルシェ",
        title: "第1章：はじまりの森",
        scenes: [
            {
                type: "dialogue",
                speaker: "リングホルム",
                text: "……この森、静かすぎる。気を抜くな。",
                setCharacters: ["リングホルム"],
            },
            {
                type: "dialogue",
                speaker: "アルシェ",
                text: "（じっと周囲を見渡す）",
                setCharacters: [
                    "リングホルム",
                    { name: "アルシェ", image: "立ち絵透過済み/幼少期アルシェ1_transparent.png" },
                ],
            },
            {
                type: "dialogue",
                speaker: "リングホルム",
                text: "……来るぞ。構えろ。",
            },
            {
                type: "battle",
                battleId: "battle_ch1",
            },
            {
                type: "dialogue",
                speaker: "リングホルム",
                text: "……片付いたな。行くぞ。",
                setCharacters: ["リングホルム"],
            },
            {
                type: "dialogue",
                speaker: "アルシェ",
                text: "うん。",
                setCharacters: [
                    "リングホルム",
                    { name: "アルシェ", image: "立ち絵透過済み/幼少期アルシェ1_transparent.png" },
                ],
            },
        ],
    },

    // 今後の章はここに追加
    // { id: "ch2", chapter: 2, protagonist: "カリマ", title: "第2章：…", scenes: [...] },
];
