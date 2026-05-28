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
// =============================================

const CHAPTERS = [
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
                    { name: "アルシェ", image: "立ち絵AI生成/幼少期アルシェ1.png" },
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
                    { name: "アルシェ", image: "立ち絵AI生成/幼少期アルシェ1.png" },
                ],
            },
        ],
    },
    // 今後の章はここに追加
    // { id: "ch2", chapter: 2, protagonist: "カリマ", title: "第2章：…", scenes: [...] },
];
